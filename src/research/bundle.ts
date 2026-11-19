// Reproducible, provenance-checked research bundles (#481).
// The archive contains records and derived readouts, never workspaces or locks.

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MACHINE_SCHEMA_VERSION } from '../machine-output';
import { ResearchError } from './adapter';
import { readPairFiles } from './ledger-files';
import { portablePairRecordFrom, type PairRecord } from './record';
import { renderResearchReport } from './report';
import { summarizeRecords } from './summarize';

const BLOCK = 512;
const BUNDLE_VERSION = 1;

/** Every field a `provenance.json` may carry (#664): a field outside this set is
 *  refused before the bundle is accepted, so provenance can only say what the
 *  validator binds to the derived summary and the archive contents. */
const PROVENANCE_KEYS = new Set([
  'bundle_schema_version', 'protocol', 'schema_version', 'manifest_sha256',
  'adapter', 'model', 'tamperward_version', 'agent_argv', 'agent_budget', 'records',
  'manifest_included', 'prompts_included',
]);
/** The entries a bundle may hold besides `ledger/pairs/<name>.json`: anything else
 *  in an archive is refused by the validator, so "valid" means "holds nothing but
 *  the evidence it claims to" (#663). */
const TOP_LEVEL_ENTRIES = new Set(['summary.json', 'report.txt', 'provenance.json', 'manifest.json']);
const PAIR_ENTRY_RE = /^ledger\/pairs\/[^/]+\.json$/;
/** A ustar header stores at most 99 bytes of name; a longer name would be cut or
 *  collide, so it is refused before anything is written rather than truncated. */
const TAR_NAME_MAX = 99;

interface Entry { name: string; bytes: Buffer }

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

const NAME_FIELD = 100;
const TYPE_OFFSET = 156;
const PREFIX_OFFSET = 345;
const PREFIX_FIELD = 155;

/** The one ustar header form this bundle format writes: the name in the name
 *  field alone (no prefix), mode 0644, uid and gid 0, mtime 0, type `0`, magic
 *  `ustar` version `00`, and an empty link name, owner names and device numbers.
 *  The reader accepts exactly this form and nothing else (#663). */
function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(BLOCK, 0);
  header.write(name, 0, 'utf8');
  header.write(octal(0o644, 8), 100, 'ascii');
  header.write(octal(0, 8), 108, 'ascii');
  header.write(octal(0, 8), 116, 'ascii');
  header.write(octal(size, 12), 124, 'ascii');
  // Fixed mtime keeps the archive bytes reproducible for the same records and
  // provenance; wall-clock creation time is not research evidence.
  header.write(octal(0, 12), 136, 'ascii');
  header.fill(0x20, 148, 156);
  header[TYPE_OFFSET] = 0x30;
  header.write('ustar', 257, 'ascii');
  header.write('00', 263, 'ascii');
  const checksum = header.reduce((sum, b) => sum + b, 0);
  header.write(octal(checksum, 8), 148, 'ascii');
  return header;
}

function tarEntry(name: string, bytes: Buffer): Buffer {
  if (name.startsWith('/') || Buffer.byteLength(name, 'utf8') > TAR_NAME_MAX) {
    throw new ResearchError(`archive entry name ${name} cannot be stored byte for byte in a ustar header`);
  }
  const padding = Buffer.alloc((BLOCK - (bytes.length % BLOCK)) % BLOCK, 0);
  return Buffer.concat([tarHeader(name, bytes.length), bytes, padding]);
}

function makeTar(entries: Entry[]): Buffer {
  return Buffer.concat([...entries.map((e) => tarEntry(e.name, e.bytes)), Buffer.alloc(BLOCK * 2, 0)]);
}

/** A NUL-terminated header field as text. */
function field(header: Buffer, start: number, length: number): string {
  const raw = header.subarray(start, start + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
}

/** Parse an archive this bundle format wrote, and nothing looser: every header
 *  must be byte for byte the form `tarHeader` emits (so a ustar prefix, a link or
 *  device entry, a foreign checksum or owner cannot change what a name means), a
 *  payload's padding must be zero, and the archive must end with exactly two zero
 *  blocks and nothing after them. A tar reader and this validator therefore agree
 *  on every path and every byte the archive carries (#663). */
function parseTar(bytes: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  for (;;) {
    if (offset + BLOCK > bytes.length) throw new ResearchError('research bundle is missing its end-of-archive blocks');
    const header = bytes.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) {
      const second = bytes.subarray(offset + BLOCK, offset + 2 * BLOCK);
      if (second.length !== BLOCK || !second.every((b) => b === 0) || offset + 2 * BLOCK !== bytes.length) {
        throw new ResearchError('research bundle carries bytes after its end-of-archive blocks');
      }
      return files;
    }
    const name = field(header, 0, NAME_FIELD);
    const prefix = field(header, PREFIX_OFFSET, PREFIX_FIELD);
    if (prefix) {
      throw new ResearchError(`research bundle entry ${prefix}/${name} uses a ustar prefix; this bundle format stores every name in the name field`);
    }
    const type = header[TYPE_OFFSET];
    if (type !== 0x30) {
      throw new ResearchError(`research bundle entry ${name} is not a regular file entry (type flag ${JSON.stringify(String.fromCharCode(type))})`);
    }
    const size = Number.parseInt(field(header, 124, 12).trim() || '0', 8);
    if (!name || name.startsWith('/') || name.split('/').includes('..') || !Number.isSafeInteger(size) || size < 0) {
      throw new ResearchError('research bundle contains an unsafe or malformed archive entry');
    }
    if (Buffer.byteLength(name, 'utf8') > TAR_NAME_MAX || !header.equals(tarHeader(name, size))) {
      throw new ResearchError(`research bundle entry ${name} has a header this bundle format does not write`);
    }
    const start = offset + BLOCK;
    const end = start + size;
    if (end > bytes.length) throw new ResearchError('research bundle is truncated');
    const padded = start + Math.ceil(size / BLOCK) * BLOCK;
    if (padded > bytes.length || !bytes.subarray(end, padded).every((b) => b === 0)) {
      throw new ResearchError(`research bundle entry ${name} carries bytes in its padding`);
    }
    if (files.has(name)) throw new ResearchError(`research bundle contains a duplicate archive entry ${name}`);
    files.set(name, Buffer.from(bytes.subarray(start, end)));
    offset = padded;
  }
}

/** The pair records a bundle carries, read once through the hardened ledger
 *  reader (#663): only a regular file placed directly in pairs/ is read, every
 *  record is proved to carry nothing outside the v1 pair contract, and the
 *  archive holds the canonical serialization of the proved record rather than
 *  the file's raw bytes, so a duplicate key or stray bytes cannot travel either. */
function packagedRecords(ledger: string): { records: PairRecord[]; entries: Entry[] } {
  const files = readPairFiles(ledger);
  if (files.length === 0) throw new ResearchError(`ledger ${ledger} holds no pair records`);
  const records: PairRecord[] = [];
  const entries: Entry[] = [];
  for (const f of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(f.bytes.toString('utf8'));
    } catch (e) {
      throw new ResearchError(`ledger record ${f.path} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const record = portablePairRecordFrom(raw, f.path);
    const archiveName = `ledger/pairs/${f.name}`;
    const nameBytes = Buffer.byteLength(archiveName, 'utf8');
    if (nameBytes > TAR_NAME_MAX) {
      throw new ResearchError(`pair record name ${f.name} is too long for the archive (${nameBytes} bytes as ${archiveName}; the limit is ${TAR_NAME_MAX})`);
    }
    records.push(record);
    entries.push({ name: archiveName, bytes: jsonBytes(record) });
  }
  return { records, entries };
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export interface ResearchBundleOpts {
  ledger: string;
  out?: string;
  manifest?: string;
  validate?: string;
}

export function validateResearchBundle(path: string): { records: number; manifest_sha256: string } {
  let files: Map<string, Buffer>;
  try { files = parseTar(gunzipSync(readFileSync(resolve(path)))); }
  catch (e) { throw new ResearchError(`cannot read research bundle ${path}: ${e instanceof Error ? e.message : String(e)}`); }
  for (const name of files.keys()) {
    if (!TOP_LEVEL_ENTRIES.has(name) && !PAIR_ENTRY_RE.test(name)) {
      throw new ResearchError(`research bundle carries an entry that is not evidence: ${name}`);
    }
  }
  const provenance = files.get('provenance.json');
  const summaryBytes = files.get('summary.json');
  const report = files.get('report.txt');
  if (!provenance || !summaryBytes || !report) throw new ResearchError('research bundle is missing provenance.json, summary.json or report.txt');
  let p: Record<string, unknown>;
  let summary: unknown;
  try { p = JSON.parse(provenance.toString('utf8')); summary = JSON.parse(summaryBytes.toString('utf8')); }
  catch { throw new ResearchError('research bundle contains invalid JSON'); }
  if (p.bundle_schema_version !== BUNDLE_VERSION || p.schema_version !== MACHINE_SCHEMA_VERSION) {
    throw new ResearchError('research bundle schema version is unsupported');
  }
  const manifest = files.get('manifest.json');
  if (p.manifest_included !== Boolean(manifest) || p.prompts_included !== Boolean(manifest)) {
    throw new ResearchError('research bundle manifest inclusion metadata is inconsistent');
  }
  if (manifest && createHash('sha256').update(manifest).digest('hex') !== p.manifest_sha256) {
    throw new ResearchError('research bundle manifest does not match its recorded sha256');
  }
  const parsedSummary = summary as Record<string, unknown>;
  if (parsedSummary.document !== 'summary' || parsedSummary.command !== 'research') throw new ResearchError('research bundle summary is not a research summary');
  for (const key of Object.keys(p)) {
    if (!PROVENANCE_KEYS.has(key)) throw new ResearchError(`research bundle provenance contains unknown field ${key}`);
  }
  if (p.manifest_sha256 !== parsedSummary.manifest_sha256) throw new ResearchError('research bundle provenance manifest hash disagrees with summary');
  if (!isDeepStrictEqual(p.adapter, parsedSummary.adapter)) throw new ResearchError('research bundle provenance adapter disagrees with summary');
  if (p.model !== parsedSummary.model) throw new ResearchError('research bundle provenance model disagrees with summary');
  if (p.tamperward_version !== parsedSummary.tamperward_version) throw new ResearchError('research bundle provenance TamperWard version disagrees with summary');
  if (!isDeepStrictEqual(p.agent_argv, parsedSummary.agent_argv)) throw new ResearchError('research bundle provenance agent argv disagrees with summary');
  if (p.agent_budget !== parsedSummary.agent_budget) throw new ResearchError('research bundle provenance agent budget disagrees with summary');
  const records: PairRecord[] = [];
  for (const [name, bytes] of files) {
    if (!PAIR_ENTRY_RE.test(name)) continue;
    let raw: unknown;
    try { raw = JSON.parse(bytes.toString('utf8')); } catch { throw new ResearchError(`invalid JSON in ${name}`); }
    const record = portablePairRecordFrom(raw, name);
    // The archive must hold exactly the canonical serialization of the record it
    // proves: no duplicate key, no stray whitespace, nothing the reader ignores.
    if (!bytes.equals(jsonBytes(record))) throw new ResearchError(`${name} is not the canonical serialization of its pair record`);
    records.push(record);
  }
  if (records.length === 0) throw new ResearchError('research bundle contains no pair records');
  const derived = summarizeRecords(records);
  if (p.records !== records.length) throw new ResearchError('research bundle provenance record count disagrees with pair records');
  if (JSON.stringify(derived) !== JSON.stringify(summary)) throw new ResearchError('research bundle summary does not match its pair records');
  if (report.toString('utf8') !== renderResearchReport(derived)) throw new ResearchError('research bundle report does not match its summary');
  if (!p.protocol || p.protocol !== 'research-bundle-v1') throw new ResearchError('research bundle protocol is missing or unsupported');
  return { records: records.length, manifest_sha256: String(p.manifest_sha256) };
}

export function createResearchBundle(opts: ResearchBundleOpts): string {
  if (!opts.ledger) throw new ResearchError('research bundle requires --ledger');
  if (!opts.out) throw new ResearchError('research bundle requires --out');
  const ledger = resolve(opts.ledger);
  const { records, entries } = packagedRecords(ledger);
  const summary = summarizeRecords(records);
  if (opts.manifest) {
    const manifest = readFileSync(resolve(opts.manifest));
    const sha = createHash('sha256').update(manifest).digest('hex');
    if (sha !== summary.manifest_sha256) throw new ResearchError(`manifest sha256 ${sha} does not match ledger ${summary.manifest_sha256}`);
    entries.push({ name: 'manifest.json', bytes: manifest });
  }
  const provenance = {
    bundle_schema_version: BUNDLE_VERSION,
    protocol: 'research-bundle-v1',
    schema_version: MACHINE_SCHEMA_VERSION,
    manifest_sha256: summary.manifest_sha256,
    adapter: summary.adapter,
    model: summary.model,
    tamperward_version: summary.tamperward_version,
    agent_argv: summary.agent_argv,
    agent_budget: summary.agent_budget,
    records: entries.filter((e) => e.name.startsWith('ledger/pairs/')).length,
    manifest_included: Boolean(opts.manifest),
    prompts_included: Boolean(opts.manifest),
  };
  entries.push({ name: 'summary.json', bytes: jsonBytes(summary) });
  entries.push({ name: 'report.txt', bytes: Buffer.from(renderResearchReport(summary), 'utf8') });
  entries.push({ name: 'provenance.json', bytes: jsonBytes(provenance) });
  const out = resolve(opts.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, gzipSync(makeTar(entries)), { flag: 'wx', mode: 0o600 });
  return out;
}

export function runResearchBundle(opts: ResearchBundleOpts): number {
  try {
    if (opts.validate) {
      const result = validateResearchBundle(opts.validate);
      process.stdout.write(`tamperward research bundle: valid (${result.records} records, manifest ${result.manifest_sha256})\n`);
      return 0;
    }
    const out = createResearchBundle(opts);
    process.stdout.write(`tamperward research bundle: wrote ${out}\n`);
    return 0;
  } catch (e) {
    if (e instanceof ResearchError || e instanceof Error) {
      process.stderr.write(`tamperward research: ${e.message}\n`);
      return 2;
    }
    throw e;
  }
}
