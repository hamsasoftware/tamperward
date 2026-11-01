import { afterEach, describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { runCheck } from '../src/cli/check';
import { runVerify } from '../src/cli/verify';
import { runDoctor } from '../src/cli/doctor';
import * as verifierBackend from '../src/verifier-backend';
import { runEnvelope, trustedLinuxPython } from '../src/cli/run';
import { runInit } from '../src/cli/init';
import { validateCliArgs } from '../src/cli/main';
import { defaultPolicy } from '../src/policy';
import { defaultEventLog } from '../src/cli/watch';
import {
  MACHINE_SCHEMA_VERSION,
  MATERIALIZATION_FAILURE_REASONS,
  RUN_CANNOT_ADJUDICATE_REASONS,
  RUN_VERDICTS,
  STATUS_AUTHORITY_STATES,
  STATUS_CHANGED_INPUTS,
  STATUS_INTERVENTION_STATES,
  STATUS_VERIFICATION_STATES,
  VERIFY_CANNOT_VERIFY_REASONS,
  VERIFY_VERDICTS,
} from '../src/machine-output';
import {
  BINDING_INPUTS,
  CANDIDATE_IDENTITY_INPUTS,
  ENVIRONMENT_INPUTS,
  VERIFICATION_STATES,
} from '../src/verification-state';
import {
  RECEIPT_DISPOSITIONS,
  RECEIPT_INTEGRITY_RESULTS,
  RECEIPT_STAGE_RESULTS,
  RECONCILE_AGREEMENTS,
} from '../src/verification-receipt';

const ROOT = resolve(__dirname, '..');
const dirs: string[] = [];
const SCHEMA_NAMES = ['check', 'verify', 'run', 'doctor', 'research', 'audit', 'stats', 'status', 'runtime-qualification', 'receipt', 'reconcile'] as const;
const PUBLISHED_SCHEMA_FILES = readdirSync(join(ROOT, 'schemas')).filter(name => name.endsWith('.schema.json')).sort();
const PACKAGE_VERSION: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const CANONICAL_ID_RE = /^https:\/\/raw\.githubusercontent\.com\/hexrift\/tamperward\/(v\d+\.\d+\.\d+)\/schemas\/([^/]+)$/;

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** The publication rule for a v1 schema's `$id` (#662): the immutable release-tag URL
 *  of the release that FIRST shipped these exact bytes. The ref is either the tag this
 *  checkout's version will receive (`v<package.json version>`, which the release
 *  workflow creates and then dereferences byte-for-byte over HTTPS), or an existing
 *  earlier tag at which the file was byte-identical to the working copy — so an
 *  unchanged schema keeps its identifier across releases and a changed one must ship
 *  under the next tag. The release workflow's "Verify published schema identifiers"
 *  step applies the same rule. Returns a problem description, or null when canonical. */
function canonicalIdProblem(filename: string, id: unknown, bytes: Buffer): string | null {
  if (typeof id !== 'string') return `${filename}: $id is not a string`;
  const m = CANONICAL_ID_RE.exec(id);
  if (!m) return `${filename}: $id ${id} is not a release-tag schema URL`;
  const [, ref, named] = m;
  if (named !== filename) return `${filename}: $id names ${named}`;
  if (ref === `v${PACKAGE_VERSION}`) return null;
  if (compareSemver(ref.slice(1), PACKAGE_VERSION) >= 0) {
    return `${filename}: $id ref ${ref} is not older than package.json ${PACKAGE_VERSION}`;
  }
  const tagged = spawnSync('git', ['show', `${ref}:schemas/${filename}`], { cwd: ROOT });
  if (tagged.status !== 0) {
    return `${filename}: $id ref ${ref} is not a release tag in this checkout (git fetch --tags)`;
  }
  if (!tagged.stdout.equals(bytes)) {
    return `${filename}: bytes differ from ${ref}; a changed schema ships under v${PACKAGE_VERSION}`;
  }
  return null;
}
type SchemaName = typeof SCHEMA_NAMES[number];
type NpmPackEntry = { filename: string; files?: Array<{ path: string }> };

function normalizeNpmPackJson(value: unknown): NpmPackEntry[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
      : null;

  if (
    !entries ||
    !entries.every(
      (entry): entry is NpmPackEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as { filename?: unknown }).filename === 'string' &&
        (
          (entry as { files?: unknown }).files === undefined ||
          Array.isArray((entry as { files?: unknown }).files)
        ),
    )
  ) {
    throw new Error('npm pack --json returned an unsupported result shape');
  }
  return entries;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function initGit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@b'], { cwd });
}

function repo(withTest = false): string {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-schema-'));
  dirs.push(cwd);
  initGit(cwd);
  writeFileSync(join(cwd, 'src.js'), 'module.exports = 42;\n');
  if (withTest) {
    mkdirSync(join(cwd, 'test'), { recursive: true });
    writeFileSync(
      join(cwd, 'test', 'check.test.js'),
      "const v=require('../src.js'); if(v!==42){console.error('expected 42, got '+v);process.exit(1)}\n",
    );
  }
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd });
  return cwd;
}

function capture(fn: () => number | void): { code: number; out: string; err: string } {
  let out = '';
  let err = '';
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    out += String(chunk);
    return true;
  }) as typeof process.stdout.write);
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    err += String(chunk);
    return true;
  }) as typeof process.stderr.write);
  const code = fn();
  vi.restoreAllMocks();
  return { code: typeof code === 'number' ? code : 0, out, err };
}

function parseOnlyJson(out: string): any {
  const trimmed = out.trim();
  expect(trimmed).not.toBe('');
  expect(() => JSON.parse(trimmed)).not.toThrow();
  return JSON.parse(trimmed);
}

function schemaFrom(root: string, name: SchemaName): any {
  const path = join(root, 'schemas', `${name}-v1.schema.json`);
  expect(existsSync(path), `published schema missing: ${path}`).toBe(true);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ajv(): Ajv2020 {
  return new Ajv2020({ allErrors: true, strict: true });
}

function validateDoc(name: SchemaName, doc: unknown, root = ROOT): string[] {
  const validator = ajv();
  const schema = schemaFrom(root, name);
  expect(validator.validateSchema(schema), JSON.stringify(validator.errors)).toBe(true);
  const validate = validator.compile(schema);
  return validate(doc) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

function writeVerifierPolicy(cwd: string, backend: 'local' | 'container' = 'local'): void {
  const image = 'node@sha256:' + 'a'.repeat(64);
  writeFileSync(
    join(cwd, '.tamperward.yml'),
    [
      'version: 1',
      'verify:',
      '  command: node test/check.test.js',
      '  budget: 30',
      `  backend: ${backend}`,
      ...(backend === 'container' ? [`  image: ${image}`] : []),
      '',
    ].join('\n'),
  );
}

function healthyDoctorRepo(): string {
  const cwd = repo(true);
  writeVerifierPolicy(cwd, 'container');
  capture(() => runInit({ cwd, forceWorkflow: true }));

  const log = defaultEventLog(cwd);
  mkdirSync(dirname(log), { recursive: true });
  writeFileSync(
    log + '.health.json',
    JSON.stringify({
      version: 1,
      state: 'healthy',
      backend: 'fallback',
      pid: process.pid,
      started_at: new Date().toISOString(),
      stopped_at: null,
      watched_dirs: 1,
      last_append_at: null,
      event_count: 0,
      dropped_events: 0,
      error_count: 0,
      last_error: null,
      log,
    }) + '\n',
  );
  return cwd;
}

function buildPackExtract(): { packageRoot: string; tarball: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'tw-pack-schema-'));
  dirs.push(tmp);
  const staging = join(tmp, 'package');
  const packageRoot = join(tmp, 'extract', 'package');
  const dist = join(staging, 'dist');
  mkdirSync(dirname(packageRoot), { recursive: true });
  mkdirSync(join(dist, 'cli'), { recursive: true });

  // Stage the real publish manifest and declared package files without
  // touching the checkout's dist/ or creating root-level test artifacts.
  for (const name of ['package.json', 'LICENSE', 'NOTICE', 'README.md']) {
    copyFileSync(join(ROOT, name), join(staging, name));
  }
  cpSync(join(ROOT, 'schemas'), join(staging, 'schemas'), { recursive: true });

  buildSync({
    entryPoints: [join(ROOT, 'src', 'cli', 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile: join(dist, 'cli', 'index.js'),
  });

  const packed = normalizeNpmPackJson(JSON.parse(execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', tmp],
    { cwd: staging, encoding: 'utf8' },
  )));
  expect(packed).toHaveLength(1);

  const paths = new Set((packed[0].files ?? []).map((x) => x.path));
  expect(paths.has('dist/cli/index.js')).toBe(true);
  for (const name of SCHEMA_NAMES) {
    expect(paths.has(`schemas/${name}-v1.schema.json`)).toBe(true);
  }

  const tarball = join(tmp, packed[0].filename);
  execFileSync('tar', ['-xzf', tarball, '-C', dirname(packageRoot)]);
  // The packed artifact intentionally excludes dependencies. Link the checkout's
  // installed modules only into this extracted test fixture so its bundled CLI
  // resolves external imports without putting node_modules into the tarball.
  if (existsSync(join(ROOT, 'node_modules'))) {
    symlinkSync(
      join(ROOT, 'node_modules'),
      join(packageRoot, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  return { packageRoot, tarball };
}

function packagedCli(
  packageRoot: string,
  cwd: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(
    process.execPath,
    [join(packageRoot, 'dist', 'cli', 'index.js'), ...args],
    { cwd, encoding: 'utf8', env: process.env },
  );
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('npm pack JSON compatibility', () => {
  it('accepts both the legacy array and npm 12 package-keyed object shapes', () => {
    const entry: NpmPackEntry = {
      filename: 'tamperward-2.19.0.tgz',
      files: [{ path: 'dist/cli/index.js' }],
    };

    expect(normalizeNpmPackJson([entry])).toEqual([entry]);
    expect(normalizeNpmPackJson({ tamperward: entry })).toEqual([entry]);
    expect(() => normalizeNpmPackJson({ tamperward: 'not-a-pack-entry' }))
      .toThrow(/unsupported result shape/);
  });
});

describe('machine-readable schema v1 (#333)', () => {
  it('all published schemas are valid Draft 2020-12 schemas, and the validator is not permissive', () => {
    const validator = ajv();
    for (const name of SCHEMA_NAMES) {
      const s = schemaFrom(ROOT, name);
      expect(s.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(validator.validateSchema(s), `${name}: ${JSON.stringify(validator.errors)}`).toBe(true);
      expect(() => validator.compile(s)).not.toThrow();
    }

    const denyEverything = validator.compile(false);
    expect(denyEverything({ schema_version: 1 })).toBe(false);
    expect(
      validator.validateSchema({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'definitely-not-a-json-schema-type',
      }),
    ).toBe(false);
  });

  it('every published schema $id is the release-tag URL of the release that first shipped its bytes (#662)', () => {
    const validator = ajv();
    for (const filename of PUBLISHED_SCHEMA_FILES) {
      const bytes = readFileSync(join(ROOT, 'schemas', filename));
      const schema = JSON.parse(bytes.toString('utf8'));
      expect(canonicalIdProblem(filename, schema.$id, bytes)).toBeNull();
      expect(validator.validateSchema(schema), filename + ': ' + JSON.stringify(validator.errors)).toBe(true);
    }
  });

  it('the canonical-id rule rejects a mutable ref, the wrong file, a newer ref, and changed bytes (#662)', () => {
    const filename = 'check-v1.schema.json';
    const bytes = readFileSync(join(ROOT, 'schemas', filename));
    const base = 'https://raw.githubusercontent.com/hexrift/tamperward';
    expect(canonicalIdProblem(filename, `${base}/v${PACKAGE_VERSION}/schemas/${filename}`, bytes)).toBeNull();
    expect(canonicalIdProblem(filename, `${base}/v1/schemas/${filename}`, bytes)).toMatch(/not a release-tag/);
    expect(canonicalIdProblem(filename, `${base}/main/schemas/${filename}`, bytes)).toMatch(/not a release-tag/);
    expect(canonicalIdProblem(filename, `${base}/0123456789abcdef0123456789abcdef01234567/schemas/${filename}`, bytes)).toMatch(/not a release-tag/);
    expect(canonicalIdProblem(filename, `${base}/v${PACKAGE_VERSION}/schemas/verify-v1.schema.json`, bytes)).toMatch(/names verify-v1/);
    expect(canonicalIdProblem(filename, `${base}/v99.0.0/schemas/${filename}`, bytes)).toMatch(/not older/);
    // An earlier tag whose bytes differ from the working copy (the v1-ref $id shipped
    // at v2.37.2) is rejected; exercised only when that tag is present locally.
    const older = spawnSync('git', ['rev-parse', '-q', '--verify', 'refs/tags/v2.37.2^{commit}'], { cwd: ROOT });
    if (older.status === 0) {
      expect(canonicalIdProblem(filename, `${base}/v2.37.2/schemas/${filename}`, bytes)).toMatch(/bytes differ/);
    }
  });

  it('v1 schemas have stable IDs and self-validating examples (#425)', () => {
    for (const name of SCHEMA_NAMES) {
      const schema = schemaFrom(ROOT, name);
      expect(canonicalIdProblem(`${name}-v1.schema.json`, schema.$id, readFileSync(join(ROOT, 'schemas', `${name}-v1.schema.json`)))).toBeNull();
      expect(schema.examples).toEqual(expect.any(Array));
      expect(schema.examples.length).toBeGreaterThan(0);
      for (const example of schema.examples) {
        expect(validateDoc(name, example), `${name} example`).toEqual([]);
      }
    }
  });

  it('check v1 covers clean, block, and warn without changing exit semantics', () => {
    const clean = repo(true);
    let r = capture(() => runCheck({ cwd: clean, worktree: true, json: true }));
    expect(r.code).toBe(0);
    let doc = parseOnlyJson(r.out);
    expect(validateDoc('check', doc)).toEqual([]);
    expect(doc.summary).toEqual({ block: 0, warn: 0 });

    const block = repo(true);
    rmSync(join(block, 'test', 'check.test.js'));
    r = capture(() => runCheck({ cwd: block, worktree: true, json: true }));
    expect(r.code).toBe(1);
    doc = parseOnlyJson(r.out);
    expect(validateDoc('check', doc)).toEqual([]);
    expect(doc.summary.block).toBeGreaterThan(0);

    const warn = repo(true);
    rmSync(join(warn, 'test', 'check.test.js'));
    const policy = defaultPolicy();
    policy.rules['test-deletion'] = { ...policy.rules['test-deletion'], severity: 'warn' };
    r = capture(() => runCheck({ cwd: warn, worktree: true, json: true, policyOverride: policy }));
    expect(r.code).toBe(0);
    doc = parseOnlyJson(r.out);
    expect(validateDoc('check', doc)).toEqual([]);
    expect(doc.summary.warn).toBeGreaterThan(0);
    expect(doc.summary.block).toBe(0);
  });

  it('verify v1 covers verified, suite-red, masked, budget and cannot-verify paths', () => {
    const ok = repo(true);
    let r = capture(() => runVerify({ cwd: ok, base: 'HEAD', cmd: 'node test/check.test.js', budget: 2, json: true }));
    expect(r.code).toBe(0);
    let doc = parseOnlyJson(r.out);
    expect(doc.verdict).toBe('VERIFIED');
    expect(validateDoc('verify', doc)).toEqual([]);

    const red = repo(true);
    writeFileSync(join(red, 'src.js'), 'module.exports = 41;\n');
    r = capture(() => runVerify({ cwd: red, base: 'HEAD', cmd: 'node test/check.test.js', budget: 2, json: true }));
    expect(r.code).toBe(1);
    doc = parseOnlyJson(r.out);
    expect(doc.verdict).toBe('SUITE_RED');
    expect(validateDoc('verify', doc)).toEqual([]);

    const masked = repo(true);
    writeFileSync(join(masked, 'src.js'), 'module.exports = 41;\n');
    writeFileSync(join(masked, 'test', 'check.test.js'), 'process.exit(0);\n');
    r = capture(() => runVerify({ cwd: masked, base: 'HEAD', cmd: 'node test/check.test.js', budget: 2, json: true }));
    expect(r.code).toBe(1);
    doc = parseOnlyJson(r.out);
    expect(doc.verdict).toBe('MASKED_FAILURE');
    expect(validateDoc('verify', doc)).toEqual([]);

    const budget = repo(true);
    r = capture(() => runVerify({
      cwd: budget,
      base: 'HEAD',
      cmd: `${JSON.stringify(process.execPath)} -e "setTimeout(()=>{},5000)"`,
      budget: 0.1,
      json: true,
    }));
    expect(r.code).toBe(2);
    doc = parseOnlyJson(r.out);
    expect(doc.verdict).toBe('BUDGET_EXCEEDED');
    expect(validateDoc('verify', doc)).toEqual([]);

    const invalid = repo(true);
    r = capture(() => runVerify({ cwd: invalid, json: true, invalid: '--base needs a value' }));
    expect(r.code).toBe(2);
    doc = parseOnlyJson(r.out);
    expect(doc).toMatchObject({ schema_version: 1, verdict: 'CANNOT_VERIFY', reason: 'INVALID_ARGUMENTS' });
    expect(validateDoc('verify', doc)).toEqual([]);
  }, 30_000);

  it('doctor v1 covers authoritative healthy/degraded posture, broken posture, and malformed policy', () => {
    if (process.platform === 'linux' && trustedLinuxPython().path) {
      const healthy = healthyDoctorRepo();
      const diagnoseHealthy = () => {
        vi.spyOn(verifierBackend, 'prepareVerifierBackend').mockImplementation(verify => ({
          kind: 'container', trust: 'isolated-container', available: true,
          engine: 'docker', image: verify?.image,
        }));
        return runDoctor({ cwd: healthy, json: true });
      };
      let r = capture(diagnoseHealthy);
      expect(r.code).toBe(0);
      let doc = parseOnlyJson(r.out);
      expect(doc.authoritative).toBe(true);
      expect(doc.checks.every((x: any) => x.state === 'OK')).toBe(true);
      expect(validateDoc('doctor', doc)).toEqual([]);

      rmSync(defaultEventLog(healthy) + '.health.json', { force: true });
      r = capture(diagnoseHealthy);
      expect(r.code).toBe(0);
      doc = parseOnlyJson(r.out);
      expect(doc.authoritative).toBe(true);
      expect(doc.checks.some((x: any) => x.state === 'WARN')).toBe(true);
      expect(validateDoc('doctor', doc)).toEqual([]);
    }

    const broken = repo(true);
    writeVerifierPolicy(broken);
    let r = capture(() => runDoctor({ cwd: broken, json: true }));
    expect(r.code).toBe(2);
    let doc = parseOnlyJson(r.out);
    expect(doc.authoritative).toBe(false);
    expect(doc.checks.some((x: any) => x.state === 'BROKEN')).toBe(true);
    expect(validateDoc('doctor', doc)).toEqual([]);

    const malformed = repo(true);
    writeFileSync(join(malformed, '.tamperward.yml'), 'verify: [not-a-mapping\n');
    r = capture(() => runDoctor({ cwd: malformed, json: true }));
    expect(r.code).toBe(2);
    doc = parseOnlyJson(r.out);
    expect(doc.authoritative).toBe(false);
    expect(doc.checks.some((x: any) => x.id === 'policy' && x.state === 'BROKEN')).toBe(true);
    expect(validateDoc('doctor', doc)).toEqual([]);
  }, 30_000);

  it.skipIf(process.platform !== 'linux' || !trustedLinuxPython().path)('run v1 covers success, agent failure, timeout, enforcement failure and cannot-adjudicate', () => {
    expect(validateCliArgs('run', ['--json', '--', 'sh', '-c', 'true'])).toBeUndefined();

    const ok = repo(true);
    let r = capture(() => runEnvelope({ cwd: ok, cmd: 'node test/check.test.js', budget: 2, json: true, argv: ['sh', '-c', 'true'] }));
    expect(r.code).toBe(0);
    let doc = parseOnlyJson(r.out);
    expect(doc.verdict).toBe('VERIFIED');
    expect(validateDoc('run', doc)).toEqual([]);

    const failed = repo(true);
    r = capture(() => runEnvelope({ cwd: failed, cmd: 'node test/check.test.js', budget: 2, json: true, argv: ['sh', '-c', 'exit 7'] }));
    expect(r.code).toBe(7);
    doc = parseOnlyJson(r.out);
    expect(doc).toMatchObject({ verdict: 'AGENT_FAILED', exit_code: 7 });
    expect(validateDoc('run', doc)).toEqual([]);

    const timeout = repo(true);
    r = capture(() => runEnvelope({
      cwd: timeout,
      cmd: 'node test/check.test.js',
      budget: 2,
      agentBudget: 0.1,
      json: true,
      argv: ['sh', '-c', 'sleep 5'],
    }));
    expect(r.code).toBe(124);
    doc = parseOnlyJson(r.out);
    expect(doc).toMatchObject({ verdict: 'AGENT_TIMEOUT', exit_code: 124 });
    expect(validateDoc('run', doc)).toEqual([]);

    const blocked = repo(true);
    r = capture(() => runEnvelope({
      cwd: blocked,
      cmd: 'true',
      budget: 2,
      json: true,
      argv: ['sh', '-c', 'rm test/check.test.js'],
    }));
    expect(r.code).toBe(1);
    doc = parseOnlyJson(r.out);
    expect(doc.exit_code).toBe(1);
    expect(['ENFORCEMENT_FAILED', 'NOT_QUIESCENT']).toContain(doc.verdict);
    expect(validateDoc('run', doc)).toEqual([]);

    const cannot = repo(true);
    r = capture(() => runEnvelope({
      cwd: cannot,
      cmd: 'true',
      budget: 2,
      json: true,
      lifecycleTestMode: 'drain-timeout',
      argv: ['sh', '-c', 'true'],
    }));
    expect(r.code).toBe(2);
    doc = parseOnlyJson(r.out);
    expect(doc).toMatchObject({
      verdict: 'CANNOT_ADJUDICATE',
      exit_code: 2,
      reason: 'AGENT_LIFECYCLE_NOT_OWNED',
    });
    expect(validateDoc('run', doc)).toEqual([]);
  }, 45_000);

  it('negative fixtures prove required fields, nested types, discriminants, versions and numeric constraints', () => {
    const cwd = repo(true);
    const r = capture(() => runVerify({ cwd, base: 'HEAD', cmd: 'node test/check.test.js', budget: 2, json: true }));
    const doc = parseOnlyJson(r.out);
    expect(validateDoc('verify', doc)).toEqual([]);

    const badVersion = structuredClone(doc);
    badVersion.schema_version = 2;
    expect(validateDoc('verify', badVersion)).not.toEqual([]);

    const missingBackendCore = structuredClone(doc);
    delete missingBackendCore.verifier_backend.available;
    expect(validateDoc('verify', missingBackendCore)).not.toEqual([]);

    const wrongNestedType = structuredClone(doc);
    wrongNestedType.visible.exit = '0';
    expect(validateDoc('verify', wrongNestedType)).not.toEqual([]);

    const badDiscriminator = structuredClone(doc);
    badDiscriminator.verdict = 'TOTALLY_GREEN';
    expect(validateDoc('verify', badDiscriminator)).not.toEqual([]);

    const negativeNumeric = structuredClone(doc);
    negativeNumeric.visible.secs = -1;
    expect(validateDoc('verify', negativeNumeric)).not.toEqual([]);

    const additive = structuredClone(doc);
    additive.future_evidence = { safe_to_ignore_in_v1: true };
    additive.verifier_backend.future_backend_evidence = 1;
    expect(validateDoc('verify', additive)).toEqual([]);
  });

  it('npm pack contains usable schemas and the packaged CLI emits one clean JSON document with a noisy agent', () => {
    const { packageRoot, tarball } = buildPackExtract();
    expect(existsSync(tarball)).toBe(true);

    for (const name of SCHEMA_NAMES) {
      const s = schemaFrom(packageRoot, name);
      const validator = ajv();
      expect(validator.validateSchema(s), `${name}: ${JSON.stringify(validator.errors)}`).toBe(true);
      expect(() => validator.compile(s)).not.toThrow();
    }

    const cwd = repo(true);
    const check = packagedCli(packageRoot, cwd, ['check', '--json', '--worktree']);
    expect(check.status).toBe(0);
    expect(validateDoc('check', parseOnlyJson(check.stdout), packageRoot)).toEqual([]);

    const verify = packagedCli(packageRoot, cwd, ['verify', '--json', '--base', 'HEAD', '--cmd', 'node test/check.test.js', '--budget', '2']);
    expect(verify.status).toBe(0);
    expect(validateDoc('verify', parseOnlyJson(verify.stdout), packageRoot)).toEqual([]);

    const doctor = packagedCli(packageRoot, cwd, ['doctor', '--json']);
    expect(doctor.status).toBe(2);
    expect(validateDoc('doctor', parseOnlyJson(doctor.stdout), packageRoot)).toEqual([]);

    const auditEvent = {
      schema_version: 1,
      id: 'sha256:' + 'a'.repeat(32),
      timestamp: '2026-09-14T12:00:00.000Z',
      surface: 'pretooluse',
      agent: 'claude-code',
      rule: 'test-skip',
      severity: 'block',
      decision: 'deny',
      session: 'sha256:' + 'b'.repeat(24),
    };
    expect(validateDoc('audit', auditEvent, packageRoot)).toEqual([]);
    const auditFile = join(cwd, 'audit.jsonl');
    writeFileSync(auditFile, JSON.stringify(auditEvent) + '\n');
    const stats = packagedCli(packageRoot, cwd, ['stats', '--file', auditFile, '--json']);
    expect(stats.status).toBe(0);
    expect(validateDoc('stats', parseOnlyJson(stats.stdout), packageRoot)).toEqual([]);
    rmSync(auditFile);

    if (process.platform === 'linux' && trustedLinuxPython().path) {
      const run = packagedCli(packageRoot, cwd, [
        'run', '--json', '--cmd', 'node test/check.test.js', '--budget', '2', '--',
        'sh', '-c', 'printf "agent-stdout\\n"; printf "agent-stderr\\n" >&2',
      ]);
      expect(run.status).toBe(0);
      const runDoc = parseOnlyJson(run.stdout);
      expect(run.stdout.trim().split('\n')).toHaveLength(1);
      expect(run.stdout).not.toContain('agent-stdout');
      expect(run.stderr).toContain('agent-stdout');
      expect(run.stderr).toContain('agent-stderr');
      expect(validateDoc('run', runDoc, packageRoot)).toEqual([]);
    }
  }, 60_000);

  it('every discriminator vocabulary in the schemas equals the constant the emitters use', () => {
    // One source: a verdict or reason added to the CLI without the schema (or
    // vice versa) fails here, so the published contract cannot lag the code.
    const verify = schemaFrom(ROOT, 'verify');
    expect(verify.properties.verdict.enum).toEqual([...VERIFY_VERDICTS]);
    expect(verify.properties.reason.enum).toEqual([...VERIFY_CANNOT_VERIFY_REASONS]);
    expect(verify.properties.materialization_reason.enum).toEqual([...MATERIALIZATION_FAILURE_REASONS]);
    const run = schemaFrom(ROOT, 'run');
    expect(run.properties.verdict.enum).toEqual([...RUN_VERDICTS]);
    expect(run.properties.reason.enum).toEqual([...RUN_CANNOT_ADJUDICATE_REASONS]);
    const status = schemaFrom(ROOT, 'status');
    expect(status.properties.authority.properties.state.enum).toEqual([...STATUS_AUTHORITY_STATES]);
    expect(status.properties.intervention.properties.state.enum).toEqual([...STATUS_INTERVENTION_STATES]);
    expect(status.properties.verification.properties.state.enum).toEqual([...STATUS_VERIFICATION_STATES]);
    expect(status.properties.verification.properties.changed_input.enum).toEqual([...STATUS_CHANGED_INPUTS]);
    // The published contract, the machine-output constants and the state-machine
    // module must all agree on the vocabularies (single source, no drift).
    expect([...STATUS_VERIFICATION_STATES]).toEqual([...VERIFICATION_STATES]);
    expect([...STATUS_CHANGED_INPUTS]).toEqual([...BINDING_INPUTS]);
    // #601: the receipt and reconciliation schemas single-source their closed
    // vocabularies from src/verification-receipt.ts, and reuse verify's verdicts
    // and #600's binding inputs — no parallel notion of "what was verified".
    const receipt = schemaFrom(ROOT, 'receipt');
    expect(receipt.properties.stages.properties.candidate.enum).toEqual([...RECEIPT_STAGE_RESULTS]);
    expect(receipt.properties.stages.properties.pristine.enum).toEqual([...RECEIPT_STAGE_RESULTS]);
    expect(receipt.properties.stages.properties.integrity.enum).toEqual([...RECEIPT_INTEGRITY_RESULTS]);
    const reconcile = schemaFrom(ROOT, 'reconcile');
    expect(reconcile.properties.result.enum).toEqual([...VERIFY_VERDICTS]);
    expect(reconcile.properties.ci.properties.verdict.enum).toEqual([...VERIFY_VERDICTS]);
    expect(reconcile.properties.local.properties.disposition.enum).toEqual([...RECEIPT_DISPOSITIONS]);
    expect(reconcile.properties.reconciliation.properties.agreement.enum).toEqual([...RECONCILE_AGREEMENTS]);
    // Applicability is decided by the reproducible CANDIDATE identity only; the
    // machine-local environment inputs are reported as informational divergence
    // and are the ONLY values `environment_divergence` carries (#601 finding 2).
    expect(reconcile.properties.reconciliation.properties.mismatched_input.enum).toEqual([...CANDIDATE_IDENTITY_INPUTS]);
    expect(reconcile.properties.reconciliation.properties.environment_divergence.items.enum).toEqual([...ENVIRONMENT_INPUTS]);
    for (const name of SCHEMA_NAMES) {
      expect(schemaFrom(ROOT, name).properties.schema_version).toEqual({ const: MACHINE_SCHEMA_VERSION });
    }
  });

  it('negative fixtures: machine reasons are closed vocabularies, run documents declare completeness, doctor authority agrees with its checks', () => {
    expect(validateDoc('verify', { schema_version: 1, verdict: 'CANNOT_VERIFY', reason: 'NO_SUITE_COMMAND', detail: 'x' })).toEqual([]);
    expect(validateDoc('verify', { schema_version: 1, verdict: 'CANNOT_VERIFY', reason: 'because it felt like it', detail: 'x' })).not.toEqual([]);
    expect(validateDoc('verify', { schema_version: 1, verdict: 'CANNOT_VERIFY', detail: 'x' })).not.toEqual([]);
    // #426: the filesystem case-fold assumption is auditable, and a fold
    // collision is a closed-vocabulary reason, not prose.
    expect(validateDoc('verify', { schema_version: 1, verdict: 'CANNOT_VERIFY', reason: 'PATH_CASE_COLLISION', detail: 'x', filesystem_case_sensitive: false })).toEqual([]);
    expect(validateDoc('verify', { schema_version: 1, verdict: 'CANNOT_VERIFY', reason: 'NO_SUITE_COMMAND', detail: 'x', filesystem_case_sensitive: 'yes' })).not.toEqual([]);

    const core = {
      schema_version: 1, exit_code: 0, complete: false, base: 'a'.repeat(40),
      agent: { exit_code: 0, timed_out: false, lifecycle_owned: true },
      verifier_backend: { kind: 'local', trust: 'checkpointed-local', available: true },
      dependency_environment: { status: 'none', roots: [] },
    };
    const full = { head: 'b'.repeat(40), checks: { diff: 0, worktree: 0, verify: 0 }, observer: { enabled: false, blocking: false } };
    expect(validateDoc('run', { ...core, ...full, verdict: 'VERIFIED', complete: true })).toEqual([]);
    expect(validateDoc('run', { ...core, ...full, verdict: 'VERIFIED' })).not.toEqual([]); // VERIFIED is always complete
    const { complete: _c, ...noComplete } = { ...core, ...full, verdict: 'VERIFIED' };
    expect(validateDoc('run', noComplete)).not.toEqual([]);
    expect(validateDoc('run', { ...core, verdict: 'HISTORY_REWRITE', exit_code: 1, head: 'b'.repeat(40) })).toEqual([]);
    expect(validateDoc('run', { ...core, verdict: 'HISTORY_REWRITE', exit_code: 1, complete: true, head: 'b'.repeat(40) })).not.toEqual([]); // complete needs checks/observer
    expect(validateDoc('run', { ...core, ...full, verdict: 'ENFORCEMENT_FAILED', exit_code: 1 })).not.toEqual([]); // enforcement verdicts are complete
    expect(validateDoc('run', { ...core, verdict: 'CANNOT_ADJUDICATE', exit_code: 2, reason: 'AGENT_LIFECYCLE_NOT_OWNED' })).toEqual([]);
    expect(validateDoc('run', { ...core, verdict: 'CANNOT_ADJUDICATE', exit_code: 2 })).not.toEqual([]); // reason required
    expect(validateDoc('run', { ...core, verdict: 'CANNOT_ADJUDICATE', exit_code: 2, reason: 'shrug' })).not.toEqual([]);
    expect(validateDoc('run', { ...core, verdict: 'HISTORY_REWRITE', exit_code: 1, reason: 'VERIFY_CANNOT_VERIFY' })).not.toEqual([]); // reason only on CANNOT_ADJUDICATE

    const ok = { id: 'policy', state: 'OK', detail: 'fine' };
    const broken = { id: 'hooks', state: 'BROKEN', detail: 'missing' };
    expect(validateDoc('doctor', { schema_version: 1, command: 'doctor', authoritative: true, checks: [ok] })).toEqual([]);
    expect(validateDoc('doctor', { schema_version: 1, command: 'doctor', authoritative: false, checks: [ok, broken] })).toEqual([]);
    expect(validateDoc('doctor', { schema_version: 1, command: 'doctor', authoritative: true, checks: [ok, broken] })).not.toEqual([]);
    expect(validateDoc('doctor', { schema_version: 1, command: 'doctor', authoritative: false, checks: [ok] })).not.toEqual([]);
  });

  it.skipIf(process.platform !== 'linux' || !trustedLinuxPython().path)('run v1 discriminates early convictions from complete adjudication and names the layer that could not judge', () => {
    const rewritten = repo(true);
    let r = capture(() => runEnvelope({
      cwd: rewritten,
      cmd: 'node test/check.test.js',
      budget: 2,
      json: true,
      argv: ['sh', '-c', 'git -c user.email=a@b -c user.name=a commit -q --amend --allow-empty -m rewritten'],
    }));
    expect(r.code).toBe(1);
    let doc = parseOnlyJson(r.out);
    expect(doc).toMatchObject({ verdict: 'HISTORY_REWRITE', exit_code: 1, complete: false });
    expect(doc.checks).toBeUndefined();
    expect(doc.observer).toBeUndefined();
    expect(validateDoc('run', doc)).toEqual([]);

    const cannot = repo(true);
    r = capture(() => runEnvelope({
      cwd: cannot,
      cmd: `${JSON.stringify(process.execPath)} -e "setTimeout(()=>{},5000)"`,
      budget: 0.1,
      json: true,
      argv: ['sh', '-c', 'true'],
    }));
    expect(r.code).toBe(2);
    doc = parseOnlyJson(r.out);
    expect(doc).toMatchObject({
      verdict: 'CANNOT_ADJUDICATE',
      exit_code: 2,
      complete: true,
      reason: 'VERIFY_CANNOT_VERIFY',
      checks: { diff: 0, worktree: 0, verify: 2 },
    });
    expect(validateDoc('run', doc)).toEqual([]);
  }, 45_000);
});
