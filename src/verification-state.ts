// First-class verification state (#600).
//
// The question this answers, continuously and mechanically: is the EXACT
// candidate state a viewer is looking at still the state that was independently
// verified? A `tamperward verify` that reached VERIFIED records, under a
// non-candidate authority (`.git/tamperward/`), stable fingerprints of every
// load-bearing input it judged. `tamperward status` recomputes those same
// fingerprints from the live tree and reports:
//
//   CURRENT     every bound input matches the last successful verification
//   STALE       a load-bearing input changed since that verification
//   VERIFYING   a verification is in progress (a live process holds the marker)
//   BROKEN      the recorded authority wiring can no longer be evaluated
//   UNVERIFIED  no applicable successful verification exists
//
// A mere exit-0 is NOT enough to stay CURRENT: the record binds the candidate
// tree, the trusted entry/base commit, HEAD, the TamperWard policy, the verifier
// command/budget/inputs/backend, the protected verification surface at the base,
// and the local runtime steering wiring. Change any of them and CURRENT is lost.
//
// This module is deliberately free of CLI/rendering concerns and never imports
// the verify engine, so `verify` can persist a record without an import cycle.
// The stored record is EVIDENCE/posture, never repository or CI merge authority
// (#600 non-goals): a malformed or missing record fails safe to UNVERIFIED, and
// authority wiring that cannot be evaluated fails safe to BROKEN — never CURRENT.
//
// The store is written through a temp file and a rename, and read only as regular
// files (#720). `writeFileSync` opened the record's path as the OS found it, so a
// link planted there carried verify's own record — the in-progress marker, the
// VERIFIED record — into whatever the link named, a hard link put it into that
// file's inode, and a FIFO held verify (and every reader: status, receipt export)
// until a peer appeared. `.git/` is not a protected path; verify is run by the
// operator and by the agent itself. The rename replaces a link or a FIFO with the
// record and never follows; a reader that meets such an entry reports it by name
// instead of parsing it, and `status` fails safe to UNVERIFIED with that reason.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertRev } from './git/build';
import { trustedGitEnv } from './git/trusted';
import { treeFingerprint } from './fingerprint';
import { isProtected, matchesAny, defaultPolicy } from './policy';
import { execFailure } from './narrow';
import { loadPolicy, loadPolicyAt } from './policy-load';
import { repoContext, repoRoot } from './repo-context';
import { claudeConfigDir, TW_VERSION } from './wiring';
import { discoverDependencyEnvironment } from './dependency-env';
import { readStateFile, stateDirectory, StateFileError } from './disk';
import { atomicReplaceFile } from './safe-write';
import type { Policy } from './types';

/** Independent of the machine-output `schema_version`: the on-disk record format
 *  under `.git/tamperward/`. A record whose version this binary does not
 *  understand is treated as absent (fail safe to UNVERIFIED). */
export const VERIFICATION_STATE_SCHEMA_VERSION = 1 as const;

/** The first-class verification states (#600). Stable, machine-readable
 *  vocabulary shared by the CLI, editor integrations and dashboards, so no
 *  consumer re-derives security state by scraping prose. */
export const VERIFICATION_STATES = [
  'CURRENT',
  'STALE',
  'VERIFYING',
  'BROKEN',
  'UNVERIFIED',
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/** The load-bearing inputs CURRENT is bound to. When STALE, exactly one of these
 *  names the first input that changed. */
export const BINDING_INPUTS = [
  'tree',
  'head',
  'base',
  'policy',
  'verifier',
  'surface',
  'intervention',
  'dependencies',
] as const;
export type BindingInput = (typeof BINDING_INPUTS)[number];

/** Human, stable reason for each STALE cause. */
export const STALE_REASON: Record<BindingInput, string> = {
  tree: 'candidate tree changed since verification',
  head: 'HEAD commit changed since verification',
  base: 'trusted base commit changed since verification',
  policy: 'TamperWard policy changed since verification',
  verifier: 'verifier configuration changed since verification',
  surface: 'protected verification surface changed since verification',
  intervention: 'runtime steering wiring changed since verification',
  dependencies: 'dependency environment changed since verification',
};

/** Stable fingerprints of every load-bearing input, as of a successful verify. */
export interface VerificationBinding {
  /** Filesystem fingerprint of the candidate worktree (content + mode + type). */
  tree: string;
  /** HEAD commit object id. */
  head: string;
  /** Resolved trusted entry/base commit object id. */
  base: string;
  /** Digest of the effective TamperWard policy. */
  policy: string;
  /** Digest of the verifier contract: command, budget, inputs, backend, image. */
  verifier: string;
  /** Digest of the protected verification surface (base files the policy protects). */
  surface: string;
  /** Digest of local runtime steering wiring (the agent hook configuration). */
  intervention: string;
  /** Digest of the dependency environment `verify` froze as load-bearing: the
   *  local backend's attested dependency fingerprint (the same identity `verify`
   *  computes and refuses `DEPENDENCY_DRIFT` against), or, for the isolated
   *  container backend, the digest-pinned verifier image that owns them. */
  dependencies: string;
}

/** How the recorded verify resolved its inputs, so `status` recomputes the SAME
 *  identity without the original argv. */
export interface VerificationInputs {
  /** The revision `verify` resolved its base from (`HEAD` or an explicit --base). */
  base_ref: string;
  /** Whether the policy came from the base commit (--base) or the worktree. */
  explicit_base: boolean;
  /** Whether the verifier command was a --cmd override or the policy's. */
  command_source: 'policy' | 'flag';
  command: string;
  /** Whether the budget was a --budget override or the policy's. */
  budget_source: 'policy' | 'flag';
  budget: number;
}

export interface VerificationRecord {
  schema_version: typeof VERIFICATION_STATE_SCHEMA_VERSION;
  /** Only a genuine VERIFIED result is ever recorded — never a masked failure. */
  verdict: 'VERIFIED';
  verified_at: string;
  tw_version: string;
  inputs: VerificationInputs;
  binding: VerificationBinding;
}

/** A verification that is currently running: a live process holds this marker. */
export interface VerifyingMarker {
  schema_version: typeof VERIFICATION_STATE_SCHEMA_VERSION;
  pid: number;
  started_at: string;
}

/** What `evaluateVerificationState` concluded. */
export interface VerificationEvaluation {
  state: VerificationState;
  /** Human explanation for STALE / BROKEN / UNVERIFIED / VERIFYING. */
  reason?: string;
  /** For STALE: the first load-bearing input that changed. */
  changed_input?: BindingInput;
  /** Machine-actionable detail for BROKEN, and for an UNVERIFIED whose store holds
   *  something other than a regular file at a record path (#720): the entry, named. */
  detail?: string;
  /** Present whenever a record exists. */
  verified_at?: string;
  /** Live resolved base/head object ids, when computable. */
  base?: string;
  head?: string;
  /** The verifier command the record was taken under, when a record exists. */
  verifier_command?: string;
  record?: VerificationRecord;
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: trustedGitEnv(),
  });
}

/** merge-base semantics like `verify` and `check --diff base...head`: the base a
 *  PR cannot dodge by being behind. Falls back to the rev itself. */
function resolveBaseRev(baseRef: string, cwd: string): string {
  assertRev(baseRef);
  const rev = git(['rev-parse', '--verify', `${baseRef}^{commit}`], cwd).trim();
  try {
    return git(['merge-base', rev, 'HEAD'], cwd).trim();
  } catch {
    return rev;
  }
}

/** The CONCRETE commit a ref names (no merge-base step), or null when it cannot
 *  be resolved. Used to cross-check a CI `verify --json` document's `base` against
 *  the trusted base CI was told to use (#601 finding 4): the enforcement verify on
 *  a PR merge ref records `merge-base(base, merge-commit) === base`, i.e. the
 *  concrete base commit, so the document's `base` must match either this or the
 *  merge-base the reconcile itself resolved. */
export function resolveConcreteCommit(cwd: string, ref: string): string | null {
  try {
    assertRev(ref);
    return git(['rev-parse', '--verify', `${ref}^{commit}`], repoRoot(cwd)).trim();
  } catch {
    return null;
  }
}

/** Deterministic JSON with recursively sorted object keys, so a digest depends on
 *  content and not on key insertion order. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/** The concrete protected verification surface at the base: every base-tracked
 *  file the policy protects, plus any declared verify.inputs. This is what
 *  `verify` restores from the trusted base, so a change to that set — a protected
 *  test added, removed or renamed at the base, or the protected/verify.inputs
 *  globs themselves changing — is a load-bearing change. A base whose tree cannot
 *  be listed (the commit resolves, but a tree object under it cannot be read) has
 *  an UNKNOWN surface, not an empty one: the failure is thrown, so `computeBinding`
 *  reaches the BROKEN path carrying git's error instead of a `surface` mismatch
 *  reporting a change that never happened (#707). */
function surfacePaths(base: string, cwd: string, policy: Policy): string[] {
  let listing: string;
  try {
    listing = git(['ls-tree', '-r', '--name-only', '-z', base], cwd);
  } catch (e) {
    const failure = execFailure(e);
    const detail = failure.stderr.trim().split('\n')[0] || failure.message.split('\n')[0];
    throw new Error(`cannot list the protected verification surface at base ${base}: ${detail}`);
  }
  const inputs = policy.verify?.inputs ?? [];
  return listing
    .split('\0')
    .filter(Boolean)
    .filter((p) => isProtected(p, policy) || matchesAny(p, inputs))
    .sort();
}

/** Local runtime steering wiring: the agent hook configuration that lets
 *  TamperWard intervene on a tool call before it runs. The identity is the
 *  EVALUATED wiring, not raw bytes: the PARSED `hooks` and `disableAllHooks`
 *  canonicalised across every Claude Code settings source the runtime actually
 *  reads hooks from — the project file and its local override, and the user-level
 *  file and its local override (`$CLAUDE_CONFIG_DIR`, else `~/.claude`). Reading
 *  bytes of the project file alone flipped STALE on a whitespace-only reformat and
 *  stayed CURRENT when a hook was removed at the user level (`isClaudeSettings`
 *  recognises all these sources); parsing what the runtime steers on binds the
 *  wiring that actually intervenes. Managed settings are not read from a system
 *  path in this hot recompute (a documented follow-up). */
export function interventionWiring(cwd: string): unknown {
  const dir = claudeConfigDir();
  const sources: Array<[string, string]> = [
    ['repo', join(cwd, '.claude', 'settings.json')],
    ['repo.local', join(cwd, '.claude', 'settings.local.json')],
    ['user', join(dir, 'settings.json')],
    ['user.local', join(dir, 'settings.local.json')],
  ];
  return sources.map(([source, path]) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return { source, present: false };
    }
    if (!isRecord(parsed)) return { source, present: true, shape: 'non-object' };
    return {
      source,
      present: true,
      hooks: parsed.hooks ?? null,
      disableAllHooks: parsed.disableAllHooks ?? null,
    };
  });
}

/** The dependency environment `verify` treats as load-bearing, as a digest
 *  `status` can recompute deterministically. For the local backend this reuses
 *  the SAME discovery/fingerprint `verify` runs (and refuses `DEPENDENCY_DRIFT`
 *  against), so an `npm install` of a different version with an unchanged tree —
 *  `node_modules` is git-ignored and never in the `tree` fingerprint — flips
 *  STALE naming `dependencies`. For the isolated container backend the
 *  dependencies are verifier-owned, so the digest-pinned image that actually runs
 *  is their identity. `backend` is included so a local↔container switch is bound
 *  here too. */
function dependenciesBinding(root: string, policy: Policy, command: string): string {
  const backend = policy.verify?.backend ?? 'local';
  if (backend === 'container') {
    return digest({ backend, image: policy.verify?.image ?? null });
  }
  const dep = discoverDependencyEnvironment(root, command);
  return digest({ backend, status: dep.status, fingerprint: dep.fingerprint ?? null });
}

/**
 * Recompute the binding fingerprints for the CURRENT live state, using the same
 * input resolution the recorded verify used. Throws when the recorded authority
 * wiring can no longer be evaluated (an unresolvable base, an invalid policy, a
 * verifier command that is no longer configured, or a base tree that cannot be
 * listed) — the caller maps that to BROKEN. Never returns a partial binding.
 */
export function computeBinding(
  cwd: string,
  inputs: VerificationInputs,
  precomputed?: { tree?: string },
): VerificationBinding {
  const root = repoRoot(cwd);
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}'], root).trim();
  const base = resolveBaseRev(inputs.base_ref, root);
  const policy = inputs.explicit_base
    ? (loadPolicyAt(base, root) ?? defaultPolicy())
    : loadPolicy(root);

  const command =
    inputs.command_source === 'flag' ? inputs.command : (policy.verify?.command ?? '');
  if (!command) {
    throw new Error('no verifier command is configured for the recorded verification');
  }
  const budget =
    inputs.budget_source === 'flag' ? inputs.budget : (policy.verify?.budget ?? 300);

  const protectedIgnored = (rel: string): boolean => isProtected(rel, policy);
  return {
    // NOTE (#500/#600 follow-up): `tree` hashes every tracked and ignored-protected
    // file and `dependencies` walks the attested dependency roots, on EVERY call.
    // Right for `verify` (once per run) and reused there via `precomputed.tree`,
    // but `status` is meant to be polled continuously by a status bar/dashboard,
    // where a large repository makes each poll a full read. This is intentional
    // (ADR 0002 / #752): clean index status and stat metadata cannot prove live
    // bytes, and substituting blob ids would change existing verification digests.
    tree: precomputed?.tree ?? treeFingerprint(root, protectedIgnored),
    head,
    base,
    policy: digest(policy),
    verifier: digest({
      command,
      budget,
      inputs: policy.verify?.inputs ?? [],
      backend: policy.verify?.backend ?? 'local',
      image: policy.verify?.image ?? null,
    }),
    surface: digest(surfacePaths(base, root, policy)),
    intervention: digest(interventionWiring(root)),
    dependencies: dependenciesBinding(root, policy, command),
  };
}

export function verificationPolicyDigest(policy: Policy): string {
  return digest(policy);
}

export function verificationVerifierDigest(policy: Policy, command: string, budget: number): string {
  return digest({ command, budget, inputs: policy.verify?.inputs ?? [], backend: policy.verify?.backend ?? 'local', image: policy.verify?.image ?? null });
}

/** `.git/tamperward/` for this repository, or null outside a repository. State
 *  lives under the git directory — a non-candidate authority — never in the
 *  tracked, candidate-writable tree. */
/** The store's directory, accepted only as a directory of its own (#721): a link at
 *  `.git/tamperward` itself is a `StateFileError` naming it, exactly like a link at
 *  a record's path, so no writer or reader below traverses it. */
function stateDir(cwd: string): string | null {
  const ctx = repoContext(cwd);
  return ctx ? stateDirectory(ctx.gitDir) : null;
}

export function verificationRecordPath(cwd: string): string | null {
  const dir = stateDir(cwd);
  return dir ? join(dir, 'verification-state.json') : null;
}

export function verifyingMarkerPath(cwd: string): string | null {
  const dir = stateDir(cwd);
  return dir ? join(dir, 'verifying.json') : null;
}

/** Snapshot the live binding under `inputs` and persist it. Best-effort: the
 *  record is evidence, so a write failure must never change a verify verdict.
 *  Returns whether a record was written. */
export function recordVerification(
  cwd: string,
  inputs: VerificationInputs,
  treeFingerprintValue?: string,
): boolean {
  const path = verificationRecordPath(cwd);
  if (!path) return false;
  // `verify` passes the tree fingerprint it has already taken and just proved
  // unchanged (finding 6): the record binds the same identity without a second
  // full tree read per verification.
  const binding = computeBinding(
    repoRoot(cwd),
    inputs,
    treeFingerprintValue ? { tree: treeFingerprintValue } : undefined,
  );
  const record: VerificationRecord = {
    schema_version: VERIFICATION_STATE_SCHEMA_VERSION,
    verdict: 'VERIFIED',
    verified_at: new Date().toISOString(),
    tw_version: TW_VERSION,
    inputs,
    binding,
  };
  mkdirSync(dirname(path), { recursive: true });
  // A temp file and a rename (#720): whatever stands at the path — a link, a hard
  // link, a FIFO — is replaced by the record, never written through or waited on.
  atomicReplaceFile(path, JSON.stringify(record) + '\n', 0o666);
  return true;
}

/**
 * Invalidate a recorded verification when a fresh verification of that SAME
 * bound state did not reach VERIFIED (#600). Only VERIFIED writes a record and
 * nothing removed one, so after a green verify at tree T a later `SUITE_RED`,
 * `MASKED_FAILURE` or budget exhaustion under the same inputs (a flaky or
 * environment-dependent suite) left `status` reporting CURRENT off a record the
 * later run disproved. This removes the record IFF its binding still matches the
 * live state, so `status` reports UNVERIFIED with no successful verification —
 * never a false CURRENT.
 *
 * Fail-safe and evidence-only:
 *  - a record bound to a DIFFERENT state (any binding mismatch) is left in place,
 *    so `status` still reports STALE for it rather than losing that information;
 *  - authority wiring that can no longer be evaluated is left for the BROKEN
 *    path (computeBinding throws) rather than deleted;
 *  - a delete failure never changes a verify verdict.
 *
 * Returns whether a record was removed.
 */
export function invalidateVerificationRecordIfCurrent(cwd: string): boolean {
  let record: VerificationRecord | null;
  try {
    record = readVerificationRecord(cwd);
  } catch (e) {
    // Something other than a regular file stands at the record's path (#720): not
    // a record, so nothing to invalidate — and never removed from here, so the
    // entry stays visible to `status`, which names it.
    if (e instanceof StateFileError) return false;
    throw e;
  }
  if (!record) return false;
  let live: VerificationBinding;
  try {
    live = computeBinding(cwd, record.inputs);
  } catch {
    return false; // unevaluable authority → status reports BROKEN, not CURRENT
  }
  if (firstMismatch(record.binding, live)) return false; // different state → STALE stands
  const path = verificationRecordPath(cwd);
  if (!path) return false;
  try {
    rmSync(path, { force: true });
    return true;
  } catch {
    return false;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBinding(v: unknown): v is VerificationBinding {
  if (!isRecord(v)) return false;
  return BINDING_INPUTS.every((k) => {
    const val = v[k];
    return typeof val === 'string' && val.length > 0;
  });
}

/** Parse and validate a persisted record. A record that does not validate is
 *  rejected (the caller treats a rejected record as absent → UNVERIFIED), so a
 *  malformed or truncated record can never present as CURRENT. */
export function parseVerificationRecord(value: unknown): VerificationRecord | null {
  if (!isRecord(value)) return null;
  if (value.schema_version !== VERIFICATION_STATE_SCHEMA_VERSION) return null;
  if (value.verdict !== 'VERIFIED') return null;
  if (typeof value.verified_at !== 'string') return null;
  if (typeof value.tw_version !== 'string') return null;
  const inputs = value.inputs;
  if (!isRecord(inputs)) return null;
  if (typeof inputs.base_ref !== 'string' || inputs.base_ref.length === 0) return null;
  if (typeof inputs.explicit_base !== 'boolean') return null;
  if (inputs.command_source !== 'policy' && inputs.command_source !== 'flag') return null;
  if (typeof inputs.command !== 'string') return null;
  if (inputs.budget_source !== 'policy' && inputs.budget_source !== 'flag') return null;
  if (typeof inputs.budget !== 'number' || !Number.isFinite(inputs.budget)) return null;
  if (!isBinding(value.binding)) return null;
  return {
    schema_version: VERIFICATION_STATE_SCHEMA_VERSION,
    verdict: 'VERIFIED',
    verified_at: value.verified_at,
    tw_version: value.tw_version,
    inputs: {
      base_ref: inputs.base_ref,
      explicit_base: inputs.explicit_base,
      command_source: inputs.command_source,
      command: inputs.command,
      budget_source: inputs.budget_source,
      budget: inputs.budget,
    },
    binding: value.binding,
  };
}

/** The stored record, or null when there is none or it fails to validate: a
 *  missing or malformed record fails safe to null (→ UNVERIFIED), never to
 *  CURRENT. Read as a regular file or not at all (#720): a link wherever it
 *  points, a FIFO, a device or a directory at the record's path is a
 *  `StateFileError` naming it — never followed or waited on — for the caller to
 *  report rather than a missing record. */
export function readVerificationRecord(cwd: string): VerificationRecord | null {
  const path = verificationRecordPath(cwd);
  if (!path) return null;
  const raw = readStateFile(path);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseVerificationRecord(parsed);
}

/** True when `pid` names a process this host can signal (alive), best-effort.
 *  EPERM means it exists but is owned by another user — still alive. */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but is owned by another user — still alive.
    return isRecord(e) && e.code === 'EPERM';
  }
}

/** Mark that a verification is in progress. Best-effort; returns whether written. */
export function beginVerifying(cwd: string): boolean {
  try {
    // Inside the try: a refused state directory (#721) is a marker not written,
    // never a verify that does not run.
    const path = verifyingMarkerPath(cwd);
    if (!path) return false;
    const marker: VerifyingMarker = {
      schema_version: VERIFICATION_STATE_SCHEMA_VERSION,
      pid: process.pid,
      started_at: new Date().toISOString(),
    };
    mkdirSync(dirname(path), { recursive: true });
    // A temp file and a rename (#720): never written through a link or held by a FIFO.
    atomicReplaceFile(path, JSON.stringify(marker) + '\n', 0o666);
    return true;
  } catch {
    return false;
  }
}

/** Clear the in-progress marker. Best-effort. */
export function endVerifying(cwd: string): void {
  try {
    const path = verifyingMarkerPath(cwd);
    if (!path) return;
    rmSync(path, { force: true });
  } catch {
    /* nothing to clear */
  }
}

/** The in-progress marker, but only when a live process still holds it. A stale
 *  marker (the verify process is gone, or the file is malformed) is ignored so
 *  status never sticks at VERIFYING after a crash. Read as a regular file or not
 *  at all (#720): anything else at the marker's path is a `StateFileError`
 *  naming it, never followed or waited on. */
export function readVerifyingMarker(cwd: string): VerifyingMarker | null {
  const path = verifyingMarkerPath(cwd);
  if (!path) return null;
  const raw = readStateFile(path);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.schema_version !== VERIFICATION_STATE_SCHEMA_VERSION) return null;
  if (typeof parsed.pid !== 'number' || !Number.isInteger(parsed.pid) || parsed.pid <= 0) return null;
  if (typeof parsed.started_at !== 'string') return null;
  if (!pidAlive(parsed.pid)) return null;
  return { schema_version: VERIFICATION_STATE_SCHEMA_VERSION, pid: parsed.pid, started_at: parsed.started_at };
}

// Report the MOST SPECIFIC cause first. A verify-config edit, a protected-glob
// edit and a policy edit all also move the worktree file they live in, so a plain
// `tree` mismatch is the least informative answer: the specific inputs are checked
// before it, and `tree` is the fall-through for an ordinary source/test edit that
// changed nothing else.
const MISMATCH_PRIORITY: readonly BindingInput[] = [
  'head',
  'base',
  'verifier',
  'surface',
  'intervention',
  'dependencies',
  'policy',
  'tree',
];

/**
 * The load-bearing identity split (#601 cross-machine reconciliation).
 *
 * `status` runs on the same machine that verified, so EVERY bound input — the
 * runtime steering wiring and the discovered dependency environment included —
 * is load-bearing for CURRENT (`firstMismatch` over all of MISMATCH_PRIORITY).
 *
 * A receipt reconciled in CI is judged by a DIFFERENT machine. Two of the bound
 * inputs are irreducibly machine-local and cannot be expected to match a runner:
 *   - `intervention` digests `~/.claude/settings.json` (present on a developer's
 *     machine, absent on a fresh runner);
 *   - `dependencies` (local backend) digests the discovered dependency
 *     environment, which need not match a fresh install on the runner.
 * The rest — `tree`, `head`, `base`, `policy`, `verifier`, `surface` — are
 * reproducible from the same commit and the same trusted base on any machine, so
 * they are the CANDIDATE IDENTITY that decides APPLICABILITY. The two
 * environment inputs are reported as INFORMATIONAL divergence and never, on their
 * own, make a receipt non-applicable. (A container-backend `dependencies` digest
 * IS reproducible — it is the pinned image — but treating it as informational is
 * strictly safer here: it can only downgrade a spurious mismatch to a note, never
 * make a mismatched state look applicable, and CI's own verdict is authority
 * regardless.)
 */
export const CANDIDATE_IDENTITY_INPUTS = [
  'tree',
  'head',
  'base',
  'policy',
  'verifier',
  'surface',
] as const;
export type CandidateIdentityInput = (typeof CANDIDATE_IDENTITY_INPUTS)[number];

/** The machine-local inputs reported as informational divergence, never
 *  authoritative for cross-machine applicability. */
export const ENVIRONMENT_INPUTS = ['intervention', 'dependencies'] as const;
export type EnvironmentInput = (typeof ENVIRONMENT_INPUTS)[number];

const CANDIDATE_IDENTITY_SET = new Set<BindingInput>(CANDIDATE_IDENTITY_INPUTS);
const CANDIDATE_MISMATCH_PRIORITY: readonly CandidateIdentityInput[] = MISMATCH_PRIORITY.filter(
  (i): i is CandidateIdentityInput => CANDIDATE_IDENTITY_SET.has(i),
);

/** The first binding input (in most-specific-first priority order) whose recorded
 *  fingerprint differs from the live one, or null when every input matches.
 *  Exported as `firstBindingMismatch` so the receipt reconciler (#601) decides
 *  receipt applicability with the SAME identity comparison `status` uses — a
 *  receipt binds to the exact candidate state or it is non-applicable, never
 *  "close enough". */
function firstMismatch(recorded: VerificationBinding, live: VerificationBinding): BindingInput | null {
  for (const input of MISMATCH_PRIORITY) {
    if (recorded[input] !== live[input]) return input;
  }
  return null;
}

/** The first CANDIDATE-IDENTITY input that diverges (cross-machine applicability),
 *  ignoring the machine-local environment inputs, or null when the whole candidate
 *  identity matches. This is what decides whether a receipt APPLIES to the state
 *  CI adjudicated (#601 finding 2). */
function firstCandidateIdentityMismatch(
  recorded: VerificationBinding,
  live: VerificationBinding,
): CandidateIdentityInput | null {
  for (const input of CANDIDATE_MISMATCH_PRIORITY) {
    if (recorded[input] !== live[input]) return input;
  }
  return null;
}

/** The machine-local environment inputs that diverge between the receipt and CI's
 *  identity, reported as INFORMATIONAL (they never make a receipt non-applicable). */
function environmentInputDivergences(
  recorded: VerificationBinding,
  live: VerificationBinding,
): EnvironmentInput[] {
  return ENVIRONMENT_INPUTS.filter((input) => recorded[input] !== live[input]);
}

export {
  firstMismatch as firstBindingMismatch,
  firstCandidateIdentityMismatch,
  environmentInputDivergences,
};

/** Deterministic digest of an arbitrary JSON value, shared with the receipt
 *  layer so an evidence digest is computed the one canonical way (#601). */
export function stableDigest(value: unknown): string {
  return digest(value);
}

/**
 * The verification-state machine (#600). Order of precedence:
 *   VERIFYING   a live process holds the in-progress marker;
 *   UNVERIFIED  no valid record exists (or it failed to validate);
 *   BROKEN      the recorded authority wiring can no longer be evaluated;
 *   STALE       a load-bearing input changed;
 *   CURRENT     every load-bearing input still matches.
 */
export function evaluateVerificationState(cwd: string): VerificationEvaluation {
  let marker: VerifyingMarker | null;
  let record: VerificationRecord | null;
  try {
    marker = readVerifyingMarker(cwd);
    record = marker ? null : readVerificationRecord(cwd);
  } catch (e) {
    // Something other than a regular file stands at the marker's or the record's
    // path (#720). Not "no record" and never CURRENT: the fail-safe state, with
    // the entry named so it can be removed.
    if (!(e instanceof StateFileError)) throw e;
    return {
      state: 'UNVERIFIED',
      reason: 'the verification store cannot be read: something other than a regular file stands at a record path',
      detail: e.message,
    };
  }
  if (marker) {
    return { state: 'VERIFYING', reason: 'a verification is in progress' };
  }
  if (!record) {
    return {
      state: 'UNVERIFIED',
      reason: 'no successful verification has been recorded for this repository',
    };
  }
  let live: VerificationBinding;
  try {
    live = computeBinding(cwd, record.inputs);
  } catch (e) {
    return {
      state: 'BROKEN',
      reason: 'verification authority wiring is invalid or unavailable',
      detail: e instanceof Error ? e.message : String(e),
      verified_at: record.verified_at,
      verifier_command: record.inputs.command,
      record,
    };
  }
  const changed = firstMismatch(record.binding, live);
  if (!changed) {
    return {
      state: 'CURRENT',
      verified_at: record.verified_at,
      base: live.base,
      head: live.head,
      verifier_command: record.inputs.command,
      record,
    };
  }
  return {
    state: 'STALE',
    changed_input: changed,
    reason: STALE_REASON[changed],
    verified_at: record.verified_at,
    base: live.base,
    head: live.head,
    verifier_command: record.inputs.command,
    record,
  };
}
