// Load .tamperward.yml into a Policy, falling back to the baseline when absent. The
// YAML file uses snake_case (signoff.required_for) per convention; this maps it onto
// the camelCase Policy shape. parsePolicy is pure so it can be tested without disk I/O.
// The working-tree file is read only as a REGULAR FILE at the repository root (see
// loadPolicy); a link or a special file there is refused, never followed.

import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { yaml } from './lazy-deps';
import { Policy, Severity } from './types';
import { defaultPolicy, isNegatedGlob, mergeProtected, mergeRules, normalizeGlob, POLICY_FILE } from './policy';
import { fileAt } from './git/build';
import { inspectPath, notARegularFile, textOf } from './disk';
import { errorMessage } from './narrow';
import { repoRoot } from './repo-context';

/** A policy file that exists but cannot be understood — or that stands at the policy
 *  path as something other than a regular file the gate can read. Never swallowed
 *  into the baseline: falling back silently would run a WEAKER gate than the author
 *  wrote. */
export class PolicyError extends Error {}

/** The file's contents once every value has been CHECKED, built field by field
 *  from the narrowed values inside `validate` — never asserted from the parsed
 *  document. What the loader consumes is what validation proved. */
type RawPolicy = {
  version?: unknown;
  protected?: Record<string, string[]>;
  rules?: Policy['rules'];
  ignore?: string[];
  signoff?: { required_for?: Severity[]; requiredFor?: Severity[]; ledger?: string };
  verify?: { command?: string; budget?: number; inputs?: string[]; backend?: 'local' | 'container'; image?: string };
};

/** `version:` opts in to rule graduations, so a value that cannot be understood must
 *  fail CLOSED like any other unparseable policy — silently reading garbage as 1 would
 *  run a weaker gate than the author may have meant to write. */
function normalizeVersion(v: unknown, where = POLICY_FILE): number {
  if (v === undefined || v === null) return 1; // launch version: opted in to nothing
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new PolicyError(`${where}: version must be a positive integer, got ${JSON.stringify(v)}`);
  }
  return v; // a version newer than this build passes every gate it knows — see POLICY_VERSION
}

const SEVERITIES: ReadonlyArray<Severity> = ['block', 'warn'];
const isSeverity = (v: unknown): v is Severity => SEVERITIES.some((s) => s === v);
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isMapping = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);


/** The top-level keys a policy may carry — `src/types.ts` `Policy`, in file spelling. */
const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(['version', 'protected', 'rules', 'ignore', 'signoff', 'verify']);

/**
 * Whether a ledger path stays inside the repository. The ledger is the one file the
 * LOCAL layer trusts, so a policy that points it at `../../shared.jsonl` (or an
 * absolute path) hands the sign-off channel to whoever controls that location —
 * outside the diff, outside CODEOWNERS, outside every view the gate reads.
 */
export function ledgerInsideRepo(ledger: string): boolean {
  if (!ledger.trim() || isAbsolute(ledger) || /^[A-Za-z]:[\\/]/.test(ledger)) return false;
  const norm = posix.normalize(ledger.replace(/\\/g, '/'));
  return norm !== '..' && !norm.startsWith('../') && !norm.startsWith('/');
}

/**
 * Validate every override the file may carry, failing CLOSED on anything not
 * understood — the same stance `version:` already took.
 *
 * `rules.<name>.severity: BLOCK` (or `blocc`, or `blocking`) used to parse
 * cleanly and produce findings that were neither `block` nor `warn`. Nothing
 * treats such a finding as blocking, so the hook, the Stop sweep and the
 * pre-commit check all allowed what the rule exists to deny — and policy-diff
 * did not report the edit that introduced it, because it compared for `warn`
 * only. One mistyped word switched a rule off at every local layer with no
 * finding anywhere. A value that cannot be understood is now rejected exactly
 * like invalid YAML: `check` exits 2, the hook denies until the file is fixed.
 * Unknown RULE NAMES are still accepted (a policy written for a newer build
 * must keep loading on an older one); it is the VALUES that must be exact.
 */
function validate(r: Record<string, unknown>, where: string): RawPolicy {
  function bad(msg: string): never {
    throw new PolicyError(`${where}: ${msg}`);
  }
  const show = (v: unknown): string => JSON.stringify(v) ?? String(v);
  // Schema fields must be exact at every depth. Rule names and protected
  // categories remain extensible; misspelled fields must not vanish (#799).
  function knownKeys(value: Record<string, unknown>, field: string, allowed: readonly string[]): void {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        bad(`unknown key ${field}.${key} (expected one of ${allowed.join(', ')})`);
      }
    }
  }
  // A negated glob in an inclusion list matches EVERY path (see isNegatedGlob):
  // fail closed with the mechanism named, so the author lists the paths instead.
  function refuseNegated(field: string, list: string[]): void {
    const neg = list.find(isNegatedGlob);
    if (neg !== undefined) {
      bad(`${field}: negated glob ${show(neg)} is not allowed — a "!" pattern matches every path, so it would ${field === 'ignore' ? 'ignore every file' : field.startsWith('protected.') ? `put every file in ${field}` : 'blind the rule on every file'}; list the paths to include instead`);
    }
  }
  const out: RawPolicy = {};
  if (r.version !== undefined) out.version = r.version;

  // UNKNOWN TOP-LEVEL KEYS fail closed like unknown values do. `Rules:` (a
  // capital) or `ignored:` parsed as a policy that said nothing — the author
  // wrote an override that was silently not in force, which is exactly the
  // "weaker gate than written" case every other check here exists to refuse.
  // Rule NAMES under `rules` stay open (a policy for a newer build must load);
  // it is the schema's own vocabulary that must be exact.
  const unknown = Object.keys(r).filter((k) => !TOP_LEVEL_KEYS.has(k));
  if (unknown.length) {
    bad(`unknown top-level key${unknown.length === 1 ? '' : 's'} ${unknown.map((k) => JSON.stringify(k)).join(', ')} (expected one of ${[...TOP_LEVEL_KEYS].join(', ')})`);
  }

  if (r.rules !== undefined) {
    if (!isMapping(r.rules)) bad(`rules must be a mapping of rule name to { severity, enabled, exclude }, got ${show(r.rules)}`);
    const rules: Policy['rules'] = {};
    for (const [name, cfg] of Object.entries(r.rules)) {
      if (!isMapping(cfg)) bad(`rules.${name} must be a mapping like { severity: block }, got ${show(cfg)}`);
      knownKeys(cfg, `rules.${name}`, ['severity', 'enabled', 'exclude']);
      const { severity, enabled, exclude } = cfg;
      if (severity !== undefined && !isSeverity(severity)) {
        bad(`rules.${name}.severity must be "block" or "warn", got ${show(severity)}`);
      }
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        bad(`rules.${name}.enabled must be true or false, got ${show(enabled)}`);
      }
      if (exclude !== undefined && !isStringList(exclude)) {
        bad(`rules.${name}.exclude must be a list of globs, got ${show(exclude)}`);
      }
      if (exclude !== undefined) refuseNegated(`rules.${name}.exclude`, exclude);
      rules[name] = {
        ...(severity !== undefined ? { severity } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(exclude !== undefined ? { exclude } : {}),
      };
    }
    out.rules = rules;
  }
  if (r.ignore !== undefined) {
    if (!isStringList(r.ignore)) bad(`ignore must be a list of globs, got ${show(r.ignore)}`);
    refuseNegated('ignore', r.ignore);
    out.ignore = r.ignore;
  }
  if (r.protected !== undefined) {
    if (!isMapping(r.protected)) bad(`protected must be a mapping of category to a list of globs, got ${show(r.protected)}`);
    const categories: Record<string, string[]> = {};
    for (const [cat, globs] of Object.entries(r.protected)) {
      if (!isStringList(globs)) bad(`protected.${cat} must be a list of globs, got ${show(globs)}`);
      refuseNegated(`protected.${cat}`, globs);
      categories[cat] = globs;
    }
    out.protected = categories;
  }
  if (r.signoff !== undefined) {
    if (!isMapping(r.signoff)) bad(`signoff must be a mapping, got ${show(r.signoff)}`);
    knownKeys(r.signoff, 'signoff', ['required_for', 'requiredFor', 'ledger']);
    const signoff: NonNullable<RawPolicy['signoff']> = {};
    for (const key of ['required_for', 'requiredFor'] as const) {
      const v = r.signoff[key];
      if (v === undefined) continue;
      if (!(Array.isArray(v) && v.every(isSeverity))) {
        bad(`signoff.${key} must be a list of "block" / "warn", got ${show(v)}`);
      }
      signoff[key] = v;
    }
    const ledger = r.signoff.ledger;
    if (ledger !== undefined && typeof ledger !== 'string') bad(`signoff.ledger must be a path, got ${show(ledger)}`);
    if (typeof ledger === 'string') {
      if (!ledgerInsideRepo(ledger)) bad(`signoff.ledger must be a relative path inside the repository, got ${show(ledger)}`);
      signoff.ledger = ledger;
    }
    out.signoff = signoff;
  }
  if (r.verify !== undefined) {
    if (!isMapping(r.verify)) bad(`verify must be a mapping like { command: "npm test" }, got ${show(r.verify)}`);
    knownKeys(r.verify, 'verify', ['command', 'budget', 'inputs', 'backend', 'image']);
    const v = r.verify;
    const { command, budget, inputs, backend, image } = v;
    if (command !== undefined && typeof command !== 'string') bad(`verify.command must be a string, got ${show(command)}`);
    // Without a command the whole block is unusable and was silently dropped, discarding a
    // declared backend/image/budget/inputs; require one so the block cannot be lost.
    if (typeof command !== 'string' || command.trim() === '') {
      bad(`verify.command is required and must be a non-empty command when a verify block is present, got ${show(command)}`);
    }
    if (budget !== undefined && !(typeof budget === 'number' && Number.isFinite(budget) && budget > 0)) {
      bad(`verify.budget must be a positive number of seconds, got ${show(budget)}`);
    }
    if (inputs !== undefined && !isStringList(inputs)) bad(`verify.inputs must be a list of globs, got ${show(inputs)}`);
    if (backend !== undefined && backend !== 'local' && backend !== 'container') {
      bad(`verify.backend must be "local" or "container", got ${show(backend)}`);
    }
    if (image !== undefined && typeof image !== 'string') {
      bad(`verify.image must be an immutable container image reference, got ${show(image)}`);
    }
    if ((backend ?? 'local') === 'container') {
      if (typeof image !== 'string') bad('verify.image is required when verify.backend is "container"');
      if (!/^(?!-)[^\s@]+@sha256:[0-9a-f]{64}$/i.test(image)) {
        bad(`verify.image must be pinned by sha256 digest (name@sha256:<64 hex>), got ${show(image)}`);
      }
    } else if (image !== undefined) {
      bad('verify.image is only valid when verify.backend is "container"');
    }
    out.verify = {
      ...(command !== undefined ? { command } : {}),
      ...(budget !== undefined ? { budget } : {}),
      ...(inputs !== undefined ? { inputs } : {}),
      ...(backend !== undefined ? { backend } : {}),
      ...(image !== undefined ? { image } : {}),
    };
  }
  return out;
}

export function parsePolicy(raw: unknown, where: string = POLICY_FILE, floor?: Policy): Policy {
  const doc = raw ?? {};
  if (!isMapping(doc)) throw new PolicyError(`${where} is not a policy mapping`);
  const version = normalizeVersion(doc.version === undefined ? floor?.version : doc.version, where);
  const r = validate(doc, where);
  // The baseline is gated by the DECLARED version before user rules overlay it, so a
  // gated graduation applies only to opted-in policies while an explicit severity —
  // written by the user, in either direction — always wins.
  const base = floor ?? defaultPolicy(version);
  const verification = floor ? (r.verify ? { ...base.verify, ...r.verify } : base.verify) : r.verify;
  const globs = (list: string[] | undefined): string[] | undefined => list?.map(normalizeGlob);
  const userProtected = r.protected
    ? Object.fromEntries(Object.entries(r.protected).map(([cat, list]) => [cat, globs(list) ?? []]))
    : undefined;
  const userRules = r.rules
    ? Object.fromEntries(
        Object.entries(r.rules).map(([name, cfg]) => [name, cfg?.exclude ? { ...cfg, exclude: globs(cfg.exclude) } : cfg]),
      )
    : undefined;
  const policy: Policy = {
    version,
    ...(floor?.organizationFloor ? { organizationFloor: floor.organizationFloor } : {}),
    // Merge with the baseline, never replace. For an integrity tool, a config that sets
    // one rule's severity must NOT silently drop the other nine — nor may naming one
    // protected glob wipe out the rest of its category (see mergeProtected), nor may
    // an `exclude`-only override drop the rule's baseline severity (see mergeRules).
    protected: mergeProtected(base.protected, userProtected),
    rules: mergeRules(base.rules, userRules),
    ignore: globs(r.ignore) ?? base.ignore,
    signoff: {
      requiredFor: r.signoff?.required_for ?? r.signoff?.requiredFor ?? base.signoff.requiredFor,
      ledger: r.signoff?.ledger ?? base.signoff.ledger,
    },
    ...(verification?.command
      ? {
          verify: {
            command: verification.command,
            budget: verification.budget ?? 300,
            // Rebuilding the block field-by-field means a field added later and
            // not listed here is SILENTLY DROPPED — which is how `inputs` first
            // shipped as a no-op that parsed, validated, and restored nothing.
            ...(Array.isArray(verification.inputs) ? { inputs: verification.inputs.map(String) } : {}),
            ...(verification.backend ? { backend: verification.backend } : {}),
            ...(verification.image ? { image: verification.image } : {}),
          },
        }
      : {}),
  };
  if (floor) enforceFloor(policy, floor, userProtected, where);
  return policy;
}

function enforceFloor(policy: Policy, floor: Policy, declaredProtected: Policy['protected'] | undefined, where: string): void {
  const refuse = (field: string): never => { throw new PolicyError(`${where}: organisation policy floor refuses weakening or unsupported substitution of ${field}`); };
  const subset = (values: readonly string[] | undefined, allowed: readonly string[] | undefined): boolean => (values ?? []).every(v => (allowed ?? []).includes(v));
  const same = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean => subset(a, b) && subset(b, a);
  if (policy.version < floor.version) refuse('version');
  if (!subset(policy.ignore, floor.ignore)) refuse('ignore');
  for (const [name, minimum] of Object.entries(floor.rules)) {
    const actual = policy.rules[name];
    if (minimum.enabled !== false && (actual?.enabled === false || (minimum.severity === 'block' && actual?.severity !== 'block'))) refuse(`rules.${name}`);
    if (!subset(actual?.exclude, minimum.exclude)) refuse(`rules.${name}.exclude`);
  }
  // Protected categories alter detector classification, not just coverage.
  // Arbitrary added globs can suppress a source-only rule; v1 freezes these
  // sets rather than claiming to prove semantic glob containment/strength.
  for (const [category, globs] of Object.entries(declaredProtected ?? {})) {
    if (!same(globs, floor.protected[category])) refuse(`protected.${category}`);
  }
  if (!subset(floor.signoff.requiredFor, policy.signoff.requiredFor) || policy.signoff.ledger !== floor.signoff.ledger) refuse('signoff');
  if (floor.verify) {
    const v = policy.verify, minimum = floor.verify;
    if (!v || v.command !== minimum.command || v.budget < minimum.budget
      || (v.backend ?? 'local') !== (minimum.backend ?? 'local') || v.image !== minimum.image
      || !same(v.inputs, minimum.inputs)) refuse('verify');
  }
}

function parseOrThrow(src: string, where: string, floor?: Policy, strictRules = false): Policy {
  let raw: unknown;
  try {
    raw = yaml.parse(src);
  } catch (e) {
    throw new PolicyError(`${where} is not valid YAML: ${errorMessage(e)}`);
  }
  const policy = parsePolicy(raw, where, floor);
  if (strictRules && isMapping(raw) && isMapping(raw.rules)) {
    const known = defaultPolicy(policy.version).rules;
    if (Object.keys(raw.rules).some(name => !Object.hasOwn(known, name))) throw new PolicyError('organisation policy floor requires rules understood by this gate version');
  }
  return policy;
}

/** Configuration belongs to the operator's control plane, never the candidate.
 * Both path and exact-byte pin are mandatory; no remote retrieval or fallback. */
export function configuredPolicyFloor(cwd: string): Policy | undefined {
  const file = process.env.TAMPERWARD_POLICY_FLOOR;
  const pin = process.env.TAMPERWARD_POLICY_FLOOR_SHA256;
  if (file === undefined && pin === undefined) return undefined;
  if (!file || !isAbsolute(file) || !pin || !/^[a-f0-9]{64}$/.test(pin)) throw new PolicyError('organisation policy floor requires an absolute external path and TAMPERWARD_POLICY_FLOOR_SHA256');
  try {
    const root = realpathSync(repoRoot(resolve(cwd)));
    const rel = relative(root, realpathSync(file));
    if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) throw new PolicyError('organisation policy floor must be outside the candidate repository');
    const entry = inspectPath(file);
    if (entry.kind !== 'file' || entry.content === null) throw new PolicyError('organisation policy floor must be a readable regular file');
    if (createHash('sha256').update(entry.content).digest('hex') !== pin) throw new PolicyError('organisation policy floor SHA-256 pin mismatch');
    const policy = parseOrThrow(textOf(entry) ?? '', 'organisation policy floor', undefined, true);
    return { ...policy, organizationFloor: { sha256: pin, ...(policy.verify ? { verify: { command: policy.verify.command, budget: policy.verify.budget } } : {}) } };
  } catch (e) {
    if (e instanceof PolicyError) throw e;
    throw new PolicyError(`cannot load organisation policy floor: ${errorMessage(e)}`);
  }
}

/** The policy governing the repository `cwd` lies in. The file is read at the
 *  REPOSITORY ROOT, whatever subdirectory the command ran from — a session started
 *  in `packages/x` used to look beside `packages/x`, find nothing, and be governed by
 *  the baseline instead of the root policy (#412). Outside any repository the file
 *  beside `cwd` is read, as before.
 *
 *  Read as a REGULAR FILE, or not at all (#713). `existsSync` + `readFileSync` followed
 *  whatever stood at the path: a FIFO blocked the read until a writer opened it, so
 *  every local layer hung until the runtime's hook timeout cut the gate off; a
 *  symbolic link was followed, so the local layers were governed by its target — not
 *  the policy file, so an edit to it was an ordinary edit, and possibly outside the
 *  repository — where the trusted-revision loader below refuses the same link; a broken
 *  link read as "no policy" and the baseline governed silently. The path is now
 *  inspected the way the effect layer reads every protected file (src/disk.ts: lstat,
 *  an open that follows no link and never blocks, fstat after the open): absent is the
 *  baseline, a regular file is parsed, and anything else — a link wherever it points,
 *  a FIFO, socket, device or directory, a file past the read cap, an entry that cannot
 *  be read — is a PolicyError naming what stands there, so `check` exits 2 and the
 *  hooks deny at once with the reason. */
export function loadPolicy(cwd: string = process.cwd()): Policy {
  const floor = configuredPolicyFloor(cwd);
  const entry = inspectPath(join(repoRoot(cwd), POLICY_FILE));
  if (entry.kind === 'absent') return floor ?? defaultPolicy();
  if (entry.kind !== 'file') {
    throw new PolicyError(
      `${POLICY_FILE} ${notARegularFile(entry)}; the policy is read only as a regular file at the repository root — put one there (no symbolic link, FIFO, socket, device or directory) or remove it`,
    );
  }
  return parseOrThrow(textOf(entry) ?? '', POLICY_FILE, floor);
}

/**
 * The policy as of a TRUSTED revision, or null when that revision has no policy file.
 *
 * The head of a branch is agent-authorable, so its `.tamperward.yml` must not govern its own
 * verdict — the same principle SPEC §5.4 already applies to sign-off. At the CI layer the
 * governing policy is read from the merge-base instead, which is what the branch forked
 * from and therefore nothing on the branch can have altered. A weakening edit still shows
 * up as a finding (hook-tampering); it simply doesn't take effect until a human merges it.
 */
export function loadPolicyAt(rev: string, cwd?: string): Policy | null {
  const floor = configuredPolicyFloor(cwd ?? process.cwd());
  const src = fileAt(rev, POLICY_FILE, { cwd: cwd === undefined ? undefined : repoRoot(cwd) });
  if (src == null) return floor ?? null;
  return parseOrThrow(src, `${POLICY_FILE} at ${rev}`, floor);
}
