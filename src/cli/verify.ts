// `tamperward verify` — pristine-suite re-execution, productized from the
// taskbench run-correctness oracle.
//
// The question it answers is the one no diff rule can: does the ORIGINAL suite
// still pass against the current source? In the Phase-3 sweep this layer
// identified every masked failure in all 53 trajectories — every skip, row
// deletion, assertion removal, and half-fix, in both arms — while diff-time
// detection was routed around (PHASE3.md). That is a trajectory record on one
// frame, not a guarantee; it is also the strongest signal the programme has.
//
// Mechanics: materialize TWO separate copies of the working tree (tracked +
// untracked non-ignored files). The local backend may link the frozen attested
// node_modules closure into those copies; the isolated backend links no host
// dependency tree and uses verifier-image-owned dependencies instead. Run the
// suite in one copy as-is (the VISIBLE run). In the other, restore every
// protected test/snapshot/config file plus the verification surface from the
// trusted base, and remove agent-added files on those surfaces (an added runner
// config can weaken or deselect the restored suite). Then run the PRISTINE
// suite. Two copies, not one reused: visible-run artifacts must not contaminate
// pristine verification.
//
//   visible green + pristine green  → VERIFIED        exit 0
//   visible green + pristine red    → MASKED_FAILURE  exit 1  ← the point
//   visible red                     → SUITE_RED       exit 1
//   budget exceeded / cannot run    → fail CLOSED     exit 2
//
// MASKED_FAILURE is the one verdict a human may overrule, and only out of band:
// the CI channel `check --diff` already honours (TAMPERWARD_OOB_SIGNOFF with
// TAMPERWARD_OOB_HEAD, resolved by the workflow from a PR label someone with
// write access applied) accepts a `verify@<head-sha>` legacy token or a compact
// `tw1:<digest>` label. That is the case
// where the original suite is genuinely wrong for the change — a behaviour
// change whose old expectations must fail — and a reviewer has read the test
// edit and said so. SUITE_RED and cannot-verify are not approvable states: a
// label cannot make a red suite green or turn "could not run" into "verified".
// The committed ledger is never consulted; nothing in the tree under judgment
// can clear its own verdict.
//
// The suite command and budget come from policy `verify:` (or flags). That
// block is a guarded surface: policy-diff flags command changes and budget
// lowering as policy weakening — a verify an agent can point at `true` is no
// verification at all.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadPolicy, loadPolicyAt } from '../policy-load';
import { repoRoot } from '../repo-context';
import { materialize, materializationFailureReason, probeFilesystemCaseSensitivity, safeSymlink, validateSymlinkGraph, workingTreePaths } from '../candidate-snapshot';
import { assertRev } from '../git/build';
import { trustedGitEnv } from '../git/trusted';
import { readTrustedGit } from '../git/process';
import { treeFingerprint } from '../fingerprint';
import {
  attestDependencyEnvironment,
  checkDependencyEnvironment,
  dependencyEnvironmentReport,
  dependencyEnvironmentSummary,
  discoverDependencyEnvironment,
  reuseDependencyEnvironmentAttestation,
  type DependencyEnvironmentAttestation,
  type DependencyEnvironmentDescriptor,
} from '../dependency-env';
import { defaultPolicy, isProtected, matchesAny } from '../policy';
import {
  prepareVerifierBackend,
  runContainerStage,
  verifierBackendReport,
  verifierBackendSummary,
  type PreparedVerifierBackend,
} from '../verifier-backend';
import { Policy } from '../types';
import {
  MACHINE_SCHEMA_VERSION,
  type VerifyCannotVerifyReason,
} from '../machine-output';
import { oobFromEnv, oobHeadFromEnv, oobHeadProblem, oobToken } from '../signoff';
import {
  beginVerifying,
  endVerifying,
  invalidateVerificationRecordIfCurrent,
  readVerificationRecord,
  recordVerification,
  verificationPolicyDigest,
  verificationVerifierDigest,
  type VerificationInputs,
} from '../verification-state';
import { receiptFromRecord, removeStoredReceipt, storeReceipt } from '../verification-receipt';
import { suiteExitAssurance as oracleAssuranceReport } from '../oracle-assurance';
import { TW_VERSION } from '../wiring';
export { oracleAssuranceReport };
export type { OracleAssuranceReport } from '../oracle-assurance';
import {
  diagnosticLines,
  runCapturedProcessSync,
  type SuiteDiagnostics,
} from '../suite-diagnostics';
import { colourEnabled } from './render/text';
import { paint, severityColour, BOLD, type Severity } from './render/status';
import { configuredAuditPath } from './audit';
import { measurementComparison, recordMeasurement, type MeasurementOutcome } from './measurements';

export { materialize, materializationFailureReason, probeFilesystemCaseSensitivity } from '../candidate-snapshot';

export interface VerifyOpts {
  cwd?: string;
  base?: string;
  cmd?: string;
  budget?: number;
  json?: boolean;
  /** @internal Suppress human/machine stdout when verify is nested inside another JSON envelope. */
  silent?: boolean;
  keep?: boolean;
  /** Refuse when the requested base is not an ancestor of HEAD — i.e. when
   *  merge-base would silently anchor to something older. The envelope
   *  enforces this itself; standalone CI wiring needs to ask for it. */
  requireAncestor?: boolean;
  cargoTargetRoot?: string;
  policyOverride?: Policy; // frozen entry-time policy (envelope): the overlay classes
                           // must not be widened by a policy the agent just wrote
  /** A parse fault (`--base --json`): recorded rather than guessed around, so
   *  runVerify fails closed on it instead of verifying against a flag. */
  invalid?: string;
  /** Frozen by tamperward run before the agent. Standalone verify discovers
   *  once at its own entry boundary. Never rediscovered after candidate code. */
  dependencyEnvironment?: DependencyEnvironmentDescriptor;
  /** @internal Just-computed same-descriptor checkpoint from tamperward run.
   *  Reused only at the immediately adjacent verifier-entry boundary. */
  dependencyEntryAttestation?: DependencyEnvironmentAttestation;
  /** @internal Carries the post-pristine checkpoint back to the envelope for
   *  diagnostics/future equivalence decisions. The envelope currently keeps
   *  its independent final check because background processes may still run. */
  onDependencyFinalAttestation?: (attestation: DependencyEnvironmentAttestation) => void;
  /** Internal envelope override matching --allow-dep-drift. */
  allowDepDrift?: boolean;
  /** Prepared before the agent by tamperward run. Standalone verify prepares
   *  the backend from the trusted policy at its own entry boundary. */
  verifierBackend?: PreparedVerifierBackend;
  /** @internal Observes the verdict verify reached, so an orchestrator
   *  (`tamperward onboard`) can explain it without parsing output. Called at most
   *  once, before the exit code is returned; the exit code is never derived from it. */
  onVerdict?: (verdict: VerifyVerdictSummary) => void;
  /** @internal Replaces the filesystem case-sensitivity probe (#426), so the
   *  case-folded overlay contract can be exercised on a host whose temp
   *  filesystem is case-sensitive. Production always probes. */
  probeCaseSensitivity?: (dir: string) => boolean;
  /** @internal Replaces the per-stage suite runner so fail-closed decisions can
   *  be tested without racing the OS reaper. Production runs the real stage. */
  runStage?: (dir: string) => RunResult;
}

/** What `onVerdict` receives: the verdict verify printed, and for CANNOT_VERIFY
 *  the same reason/detail the JSON document carries. */
export interface VerifyVerdictSummary {
  verdict: 'VERIFIED' | 'MASKED_FAILURE' | 'SUITE_RED' | 'BUDGET_EXCEEDED' | 'CANNOT_VERIFY';
  reason?: VerifyCannotVerifyReason;
  detail?: string;
}

export interface RunResult {
  exit: number | null;
  secs: number;
  failure?: 'budget' | 'backend' | 'resource';
  resource?: 'memory';
  reason?: string;
  /** The suite exited but a process still held stdout open — not quiescent. */
  pipeHeldOpen?: boolean;
  diagnostics?: SuiteDiagnostics;
}

export const OVERLAY_CLASSES = ['tests', 'snapshots', 'config'] as const;

// The VERIFICATION SURFACE: files a test runner auto-consults to decide what to
// collect, how to configure it, and which plugins to load. Deliberately NOT the
// policy's `protected` classes, which answer a different question — what the
// agent may not weaken. `package.json` is policy-protected because gutting the
// test script is weakening; `pytest.ini` need not be policy-protected at all,
// and still must never be inherited by the pristine run. Keeping the two lists
// separate means widening this one does not widen in-loop denials.
//
// 1.14.1 removed agent-added files in the protected classes and called the
// class closed. It was not: the `config` class is jest/vitest/tsconfig/eslint
// only, so an added pytest.ini, setup.cfg, tox.ini or pyproject.toml still
// reached the pristine run and could deselect the restored base tests
// (docs/THREAT-MODEL-pristine-run.md). This list is a lagging indicator of
// runner behaviour by construction — a runner can always add a configuration
// source — so it bounds the class rather than eliminating it.
//
// It lagged again, one layer down. The list named what the TEST RUNNER reads
// and nothing the PACKAGE MANAGER in front of it reads — and `npm test` is npm
// first. npm loads the project's `.npmrc` before it runs anything, and
// `node-options=--require ./p.cjs` there is exported as NODE_OPTIONS to every
// node it spawns; a `p.cjs` that stubs `node:test`'s `test`/`it`/`describe` to
// no-ops made `node --test` find nothing to run and exit 0 in BOTH copies, and
// verify reported VERIFIED over a source the base suite fails. Not a config the
// runner consults: a config the runner is *started under*. The package-manager
// files are on the list now; the half of this class no file list can hold —
// `~/.npmrc`, which the candidate owns inside the envelope — is closed in the
// environment the suites run in (runSuite). What remains residual is a runner
// input that is neither a file here nor a variable there.
export const VERIFICATION_SURFACE = [
  // Python / pytest — read from the rootdir, and conftest at any depth
  '**/conftest.py',
  '**/pytest.ini',
  '**/.pytest.ini',
  '**/setup.cfg',
  '**/tox.ini',
  '**/pyproject.toml',
  '**/setup.py', // a pytest rootdir marker, and what an editable install executes
  // Interpreter start-up hooks: imported by site.py before pytest exists,
  // wherever the tree reaches sys.path (PYTHONPATH=., an editable install).
  '**/sitecustomize.py',
  '**/usercustomize.py',
  // JavaScript / TypeScript runners and the transforms they load
  '**/jest.config.*',
  '**/jest.setup.*',
  '**/vitest.config.*',
  '**/vitest.workspace.*',
  '**/.mocharc.*',
  '**/mocha.opts',
  '**/karma.conf.*',
  '**/ava.config.*',
  '**/.taprc',
  '**/spec/support/jasmine.json',
  '**/playwright.config.*',
  '**/cypress.config.*',
  '**/.nycrc*',
  '**/.c8rc*',
  '**/babel.config.*',
  '**/.babelrc*',
  '**/vite.config.*',
  '**/.swcrc',
  '**/package.json',
  // Package-manager configuration: read before the runner starts, and able to
  // choose what the runner is started under (`node-options`), which shell runs
  // the script (`script-shell`), or which program is run at all (`yarn-path`).
  '**/.npmrc',
  '**/.yarnrc',
  '**/.yarnrc.yml',
  // pnpm 10 reads its settings (`nodeOptions` among them) from here as well,
  // and its environment layer does NOT outrank this file (verified, pnpm
  // 10.33) — so the file list is the only control for it.
  '**/pnpm-workspace.yaml',
  '**/.pnpmfile.cjs',
  // The runner the package manager executes when the project pins one: yarn's
  // `yarnPath` release and its plugins, and the PnP loader every spawned node
  // is made to `--require`.
  '**/.yarn/releases/*',
  '**/.yarn/plugins/**',
  '**/.pnp.cjs',
  '**/.pnp.js',
  '**/.pnp.loader.mjs',
  // dotenv files: `node --env-file`, a jest/vitest setup that loads dotenv,
  // pytest-dotenv. An .env carries NODE_OPTIONS as easily as an .npmrc does.
  '**/.env',
  '**/.env.*',
  // Version-manager pins: which interpreter the shims select for this cwd.
  '**/.nvmrc',
  '**/.node-version',
  '**/.python-version',
  // What git does to content on its way into and out of the tree — the base's
  // decision, never the candidate's.
  '**/.gitattributes',
  // Ruby / PHP / .NET
  '**/.rspec',
  '**/phpunit.xml',
  '**/phpunit.xml.dist',
  '**/*.runsettings',
];

// Every git read here feeds the trust anchor, so every one of them is made with
// replace-object resolution disabled (src/git/trusted.ts).
function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, env: trustedGitEnv() });
}

/** merge-base semantics like `check --diff base...head`: the PR cannot dodge by
 *  being behind. Falls back to the rev itself when no merge base exists. */
function resolveBase(base: string, cwd: string): string {
  assertRev(base);
  const rev = git(['rev-parse', '--verify', `${base}^{commit}`], cwd).trim();
  try {
    return git(['merge-base', rev, 'HEAD'], cwd).trim();
  } catch {
    return rev;
  }
}

/** Whether `base` is an ancestor of HEAD. When it is not, merge-base resolves
 *  to something OLDER than the caller asked for — legitimate for a PR branched
 *  from an older main, and an anchor downgrade when the history under review
 *  was rewritten beneath the base. `run` enforces descendancy itself; the
 *  documented standalone CI wiring (`verify --base <sha>`) could not, so it
 *  gets an opt-in guard. (P1-3, external review.) */
function baseIsAncestorOfHead(base: string, cwd: string): boolean {
  const r = spawnSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'], { cwd, env: trustedGitEnv() });
  return r.status === 0;
}

/** The case-fold used when the filesystem is case-insensitive. A simple
 *  lower-casing: it models the collapse the issue demonstrated, and is what
 *  the glob lists (all lower-case) match against. Unicode-normalising
 *  filesystems (APFS's NFD) fold more than this; see the residual. */
function foldCase(p: string): string {
  return p.toLowerCase();
}

/** The first pair of `paths` that are distinct but fold to the same name, or
 *  null. Two such paths cannot both exist in a copy on a case-insensitive
 *  filesystem, so nothing materialised there is the tree under verification. */
export function caseFoldCollision(paths: string[]): [string, string] | null {
  const seen = new Map<string, string>();
  for (const p of paths) {
    const key = foldCase(p);
    const prior = seen.get(key);
    if (prior !== undefined && prior !== p) return [prior, p];
    if (prior === undefined) seen.set(key, p);
  }
  return null;
}

/**
 * Files the VERIFIER ITSELF executes, as they exist at the base.
 *
 * The overlay restores the tests and the runner's configuration, and then hands
 * the whole thing to `sh -c <command>` — a command that, in every real repo,
 * runs a PROGRAM. `verify: { command: "node runner.js" }` restores the test
 * files and then executes the agent's `runner.js` over them. `npm test` is a
 * step worse: `package.json` is on the verification surface, so the base's
 * `"test": "sh scripts/test.sh"` is faithfully restored — and then delegates to
 * a script nothing restored. Nothing in the overlay classes covers either file,
 * so both were the agent's, in the run whose entire purpose is to execute code
 * the agent did not write. 1.14.3 froze the command STRING; this freezes what
 * the string runs.
 *
 * Two sources, because neither alone is enough:
 *
 *   implicit — command tokens that name a file existing at the base. Catches the
 *     direct case (`node runner.js`, `sh scripts/ci.sh`, `./run-tests`) with no
 *     configuration at all, and can only ever restore a file the base itself
 *     shipped, so a token that happens to match nothing is simply not restored.
 *
 *   explicit — `verify: { inputs: [globs] }` in the policy at the base. Required
 *     for delegation, which is not statically decidable: `npm test`, `make
 *     check`, `tox` name no file. Narrowing this list is policy weakening
 *     (src/detectors/policy-diff.ts), so it cannot be quietly given up.
 *
 * This is a bound on the class, not its elimination — a command can always
 * reach a file neither source names. It is documented as a residual in
 * docs/THREAT-MODEL-pristine-run.md.
 */
export function verifierInputs(cmd: string, atBase: string[], policy: Policy): Set<string> {
  const baseFiles = new Set(atBase);
  const picked = new Set<string>();
  for (const raw of cmd.split(/[\s;&|()<>]+/)) {
    const tok = raw.replace(/^['"]|['"]$/g, '').replace(/^\.\//, '');
    if (tok && baseFiles.has(tok)) picked.add(tok);
  }
  const globs = policy.verify?.inputs;
  if (globs && globs.length) {
    for (const rel of atBase) if (matchesAny(rel, globs)) picked.add(rel);
  }
  return picked;
}

export function verifierCoveredInputs(
  cmd: string,
  atBase: string[],
  policy: Policy,
): Set<string> {
  const verifierOwned = verifierInputs(cmd, atBase, policy);
  const verifierGlobs = policy.verify?.inputs ?? [];
  const covered = new Set<string>();
  for (const path of atBase) {
    if (
      OVERLAY_CLASSES.some((category) => isProtected(path, policy, category)) ||
      matchesAny(path, VERIFICATION_SURFACE) ||
      verifierOwned.has(path) ||
      (verifierGlobs.length > 0 && matchesAny(path, verifierGlobs))
    ) {
      covered.add(path);
    }
  }
  return covered;
}

export function verifierInputCovered(
  path: string,
  cmd: string,
  atBase: string[],
  policy: Policy,
): boolean {
  return verifierCoveredInputs(cmd, atBase, policy).has(path);
}

interface BaseEntry {
  mode: string; // 100644 | 100755 | 120000 | 160000
  type: string; // blob | commit
  path: string;
}

/** The base tree with MODE and TYPE, not just names.
 *
 *  `--name-only` was the whole of the previous read, so the overlay restored
 *  content and left the mode as whatever `materialize` had copied from the
 *  agent's working tree — or, for a file the agent had deleted, as the 0644 a
 *  fresh `writeFileSync` produces. A base test at 100755 therefore arrived in
 *  the pristine copy non-executable, and a discovery command that runs the
 *  executable files under `test/` found nothing to run and exited 0 in both
 *  copies: VERIFIED, over a source that fails. The agent never edited a byte
 *  of the test. `chmod -x` was the entire attack. */
function baseEntries(base: string, cwd: string): BaseEntry[] {
  return git(['ls-tree', '-r', '-z', base], cwd)
    .split('\0')
    .filter(Boolean)
    .map((rec) => {
      const tab = rec.indexOf('\t');
      const [mode, type] = rec.slice(0, tab).split(' ');
      return { mode, type, path: rec.slice(tab + 1) };
    });
}

/** Content AND mode of the overlay files in the copy, so a write that lands in
 *  the pristine tree after the overlay is applied cannot go unnoticed. */
function overlayDigest(dest: string, paths: string[]): string {
  const h = createHash('sha256');
  for (const rel of [...paths].sort()) {
    h.update(rel);
    h.update('\0');
    const p = join(dest, rel);
    try {
      const st = lstatSync(p);
      h.update(String(st.mode));
      h.update(st.isSymbolicLink() ? readlinkSync(p) : readFileSync(p));
    } catch {
      h.update('<gone>');
    }
    h.update('\0');
  }
  return h.digest('hex');
}

/** Restore protected files as they are at `base` into the copy, and remove any
 *  the agent added inside a protected class. Returns the restored paths (so the
 *  caller can re-check them after the run) and the number removed. */
function overlayPristine(
  cwd: string,
  base: string,
  dest: string,
  policy: Policy,
  cmd: string,
  dependencyRoot: string | null,
  caseSensitive: boolean,
): { restored: string[]; removed: number } {
  const entries = baseEntries(base, cwd);
  const atBase = entries.map((e) => e.path);
  // On a case-insensitive filesystem the copy identifies paths by their folded
  // form, so the overlay must too: membership tests consult the folded path as
  // well as the exact one, and the base-protected set is keyed on the fold.
  // On a case-sensitive filesystem the fold is the identity and every test
  // below is exactly what it was.
  const fold = caseSensitive ? (p: string): string => p : foldCase;
  // Base-owned = the policy's overlay classes UNION the verification surface
  // UNION whatever the verifier command itself executes.
  // The EXPLICIT half is a glob, so it also governs removal: a file the agent
  // ADDED under `verify.inputs` is a new input to the verifier — the added
  // conftest.py argument, one layer down. The implicit half cannot do this
  // (it can only recognise a path that exists at the base), which is exactly
  // why delegation needs the explicit list.
  const verifierGlobs = policy.verify?.inputs ?? [];
  const coveredBaseInputs = verifierCoveredInputs(cmd, atBase, policy);
  const isOverlayExact = (p: string): boolean =>
    coveredBaseInputs.has(p) ||
    // Candidate-added files do not exist in atBase and therefore cannot appear
    // in the precomputed set. They still must be removed when they land on a
    // protected class or the built-in verification surface.
    OVERLAY_CLASSES.some((category) => isProtected(p, policy, category)) ||
    matchesAny(p, VERIFICATION_SURFACE) ||
    (verifierGlobs.length > 0 && matchesAny(p, verifierGlobs));
  const coveredFolded = new Set(caseSensitive ? [] : [...coveredBaseInputs].map(foldCase));
  // Case-insensitive: `CONFTEST.PY` is `conftest.py` to the runner, so it is
  // on the surface; `test/FOO.test.js` is the base's `test/foo.test.js`
  // inode, so it is a covered input. The glob lists are lower-case, which is
  // what the folded path is matched against.
  const isOverlay = caseSensitive
    ? isOverlayExact
    : (p: string): boolean => isOverlayExact(p) || isOverlayExact(foldCase(p)) || coveredFolded.has(foldCase(p));
  const restored: string[] = [];
  const restoredLinks: Array<{ path: string; out: string; target: string }> = [];
  const baseProtected = new Set<string>();
  for (const e of entries) {
    if (!isOverlay(e.path)) continue;
    baseProtected.add(fold(e.path));
    if (e.type === 'commit') {
      // A submodule inside an overlay class cannot be materialised faithfully
      // from this repository alone. "Cannot verify" is the honest answer.
      throw new Error(`the base's ${e.path} is a submodule; the pristine copy cannot reproduce it`);
    }
    // `git show`, deliberately, and not `git cat-file --filters`. The latter
    // would hand the blob back as a checkout does — smudged — which is what an
    // LFS-tracked or clean-filtered file needs to be usable. But a smudge is a
    // COMMAND, `filter.<driver>.smudge`, read from git config the candidate
    // writes with an ordinary `git config`, and selected by attributes read
    // from the WORKING TREE's `.gitattributes` and `$GIT_DIR/info/attributes`,
    // both of which the candidate writes too; no environment switch turns off
    // the repository's own config (GIT_CONFIG_GLOBAL/SYSTEM cover only the
    // other two). "The base's bytes" would then mean "whatever the candidate's
    // filter emits", in the one read whose whole point is that the candidate
    // did not choose it. So the raw object: an LFS pointer on the surface is
    // restored as a pointer, and a pointer is not a test, so the pristine run
    // fails closed rather than through a filter the candidate could redirect.
    const content = execFileSync('git', ['show', `${base}:${e.path}`], { cwd, maxBuffer: 1 << 28, env: trustedGitEnv() });
    const out = join(dest, e.path);
    mkdirSync(dirname(out), { recursive: true });
    rmSync(out, { force: true }); // never write THROUGH whatever is there now
    if (e.mode === '120000') {
      const target = content.toString('utf8');
      safeSymlink(target, out, dest, `the base's ${e.path}`);
      restoredLinks.push({ path: e.path, out, target });
    } else {
      writeFileSync(out, content);
      chmodSync(out, parseInt(e.mode.slice(-4), 8) & 0o777); // the mode is part of the file
    }
    restored.push(e.path);
  }
  // Agent-added protected files are REMOVED from the pristine copy, not kept.
  // "They can only add strictness" was false, and demonstrably so: a file added
  // inside a protected class can SUBTRACT from the restored run. An added
  // conftest.py is auto-loaded by pytest, and `pytest_collection_modifyitems`
  // can deselect by node id the very base tests this overlay just restored — so
  // the pristine run goes green without ever executing them, and a masked
  // failure is reported VERIFIED. The agent never modifies or deletes a
  // base-protected asset; it adds a new protected control file that the
  // pristine run then trusts. The invariant: the pristine tree's protected
  // surface is exactly the base's, never the base plus whatever the agent
  // contributed. Added tests are not lost information — the visible run still
  // executes them; the pristine run asks only whether the agent's source passes
  // the ORIGINAL suite, to which an agent-authored file is not an input.
  //
  // The set is keyed on the FOLDED path when the filesystem folds (#426): a
  // case variant of a base-protected path is, there, the restored file itself,
  // and unlinking it unlinked the restoration. Never removed.
  let removed = 0;
  const inCopy = workingTreePaths(cwd);
  for (const rel of inCopy) {
    if (!isOverlay(rel) || baseProtected.has(fold(rel))) continue;
    rmSync(join(dest, rel), { force: true });
    removed++;
  }

  // Overlay restoration can introduce a base-owned symlink after materialize()
  // has already validated the candidate graph. Validate those links against the
  // FINAL pristine graph as well: a trusted-base path such as
  // ../node_modules/../fixture is ordinary inside the original worktree, but
  // would cross the verifier's external dependency edge inside the copy.
  for (const link of restoredLinks) {
    validateSymlinkGraph(link.target, link.out, dest, dependencyRoot, `the base's ${link.path}`);
  }

  return { restored, removed };
}

/**
 * The suite is run through a tiny Node supervisor rather than spawnSync directly,
 * because spawnSync's timeout signals ONE process — the shell — and nothing else.
 * A runner that forks workers (every jest/vitest/pytest-xdist does) left them
 * running after a budget-exceeded verdict: in a directory about to be removed,
 * executing the candidate's code after the verdict had already been returned.
 * spawnSync cannot create a process group (`detached` is an async-spawn option),
 * so the supervisor does: it spawns the shell detached — its own group — and on
 * budget or exit kills that whole group. The outcome comes back through a file,
 * since no exit code can be told apart from one the suite chose for itself.
 */
/**
 * The environment both suites run in.
 *
 * The surface list governs what the copies CONTAIN. It says nothing about what
 * the runner reads from outside them, and it reads plenty: npm loads `~/.npmrc`
 * ahead of the project's, pnpm the same file, yarn `~/.yarnrc` — and each can
 * name code to execute before the first test. Inside `tamperward run` the
 * candidate owns HOME and can write all of those. It cannot write into THIS
 * process's environment, which is the one input here that is unconditionally
 * the operator's. So the environment is the control for the half of the class
 * no file list can bound: every runner setting resolved from the env is pinned
 * to a value chosen here, and every env input that names code to load is
 * dropped. Applied to both runs alike, so an honest suite sees no difference
 * between them, and to the supervisor too — it is a node process as well.
 *
 *   NODE_OPTIONS            `--require` / `--import` / `--loader` run before the
 *                           suite's first line. Dropped, not inherited: npm
 *                           leaves an inherited value in place whenever its own
 *                           `node-options` is unset (verified, npm 10.9), so a
 *                           value in the operator's env reaches both runs.
 *   NODE_PATH               legacy global module resolution; a relative entry
 *                           resolves against the copy, an absolute one against
 *                           wherever it points. Dropped.
 *   NODE_REPL_EXTERNAL_MODULE  a module node loads at start-up. REPL only — but
 *                           a "load this file first" knob is that knob. Dropped.
 *   npm_config_node_options npm and pnpm export the `node-options` setting as
 *                           NODE_OPTIONS to every script they run, and read it
 *                           from the project .npmrc, `~/.npmrc` and the global
 *                           file — all BELOW the environment. Set to a single
 *                           space, because npm's env layer skips an empty value
 *                           outright (`envVal === ''` is `continue`d, so
 *                           NPM_CONFIG_NODE_OPTIONS='' changes nothing) and
 *                           trims a non-empty one to '': "set, to nothing".
 *                           Verified against npm 10.9 and pnpm 10.33; node
 *                           itself accepts a whitespace NODE_OPTIONS should a
 *                           future npm stop trimming. pnpm 10 also reads
 *                           `nodeOptions` from pnpm-workspace.yaml and the env
 *                           does NOT outrank that file, which is why that one
 *                           is on the surface list instead.
 *   npm_config_userconfig   `~/.npmrc` — HOME-owned, candidate-writable inside
 *   npm_config_globalconfig the envelope — and `$PREFIX/etc/npmrc`. Pointed at
 *                           two empty files in this run's scratch directory
 *                           (two, because npm refuses to load one path twice).
 *                           Honoured by npm and pnpm, in either letter case,
 *                           which is also why the inherited variants are
 *                           dropped case-insensitively before being pinned.
 *   YARN_IGNORE_PATH        yarn's `yarn-path` / `yarnPath` names a file to run
 *                           IN PLACE OF yarn, and `~/.yarnrc` is read before any
 *                           project file (verified: yarn 1.22 ran the file a
 *                           home .yarnrc named; this switch stopped it). A
 *                           project pinning its release this way runs the yarn
 *                           on PATH instead; corepack's `packageManager` pin is
 *                           unaffected. Yarn 1.22 does not export
 *                           `node-options` at all (verified), and its bundle
 *                           has no such setting.
 *   PYTHONPATH              the one way the tree reaches sys.path at interpreter
 *                           start-up, where `sitecustomize.py` is imported
 *                           before pytest exists — the case the threat model
 *                           left untested. Dropped; a suite that needs it sets
 *                           it in its own command, which is frozen.
 *   PYTHONSTARTUP           a file the interpreter executes at start-up.
 *   PYTEST_ADDOPTS          arguments pytest prepends to its own: `-p`, `-k`,
 *                           `--deselect` — the pytest.ini vectors, from the env.
 *   PYTEST_PLUGINS          modules pytest imports as plugins, resolved on
 *                           sys.path — an in-tree module the candidate wrote.
 *
 * Everything else — PATH, HOME, a venv, the operator's own variables — is
 * inherited, so the suite still runs. NOT covered, and residual (documented in
 * docs/THREAT-MODEL-pristine-run.md): a runner input that is neither a file on
 * the surface list nor a variable named here. Python's user site-packages is
 * the known one — a `.pth` there runs code at start-up, and PYTHONNOUSERSITE
 * would close it at the price of every `pip install --user` suite — and npm's
 * builtin npmrc under its own installation is another, in the shared-dependency
 * class the copies never addressed.
 */
const DROPPED_ENV = new Set([
  'NODE_OPTIONS',
  'NODE_PATH',
  'NODE_REPL_EXTERNAL_MODULE',
  'PYTHONPATH',
  'PYTHONSTARTUP',
  'PYTEST_ADDOPTS',
  'PYTEST_PLUGINS',
]);
const PINNED_NPM = /^npm_config_(node_options|userconfig|globalconfig)$/i;

export function suiteEnv(scratch: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (DROPPED_ENV.has(k) || PINNED_NPM.test(k)) continue;
    env[k] = v;
  }
  const userRc = join(scratch, 'npmrc-user');
  const globalRc = join(scratch, 'npmrc-global');
  for (const f of [userRc, globalRc]) writeFileSync(f, '', { mode: 0o444 });
  env.npm_config_userconfig = userRc;
  env.npm_config_globalconfig = globalRc;
  env.npm_config_node_options = ' ';
  env.YARN_IGNORE_PATH = '1';
  return env;
}

export interface LocalVerifierShell {
  executable: string;
  args: string[];
}

/**
 * Shell contract for the checkpointed-local verifier.
 *
 * Verification commands are policy strings and therefore require shell
 * semantics. TamperWard intentionally supports that contract only on hosts
 * where a POSIX /bin/sh is part of the platform contract. Windows is refused
 * before any candidate stage is materialised/executed rather than relying on
 * Git-for-Windows/MSYS PATH accidents or silently changing command semantics.
 */
export function localVerifierShell(
  platform: NodeJS.Platform = process.platform,
  command: string,
): LocalVerifierShell | null {
  switch (platform) {
    case 'linux':
    case 'darwin':
    case 'freebsd':
    case 'openbsd':
    case 'aix':
    case 'sunos':
      return { executable: '/bin/sh', args: ['-c', command] };
    default:
      return null;
  }
}

export function cargoStageTargets(root: string, cwd: string): Record<'visible' | 'pristine', string> {
  const absolute = resolve(cwd, root);
  mkdirSync(absolute, { recursive: true });
  const canonical = realpathSync(absolute);
  const checkout = realpathSync(cwd);
  const contains = (parent: string, child: string) => {
    const rel = relative(parent, child);
    return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
  };
  if (contains(checkout, canonical) || contains(canonical, checkout)) {
    throw new Error('Cargo target root must be outside the checkout and cannot contain it');
  }
  const targets = { visible: join(canonical, 'visible'), pristine: join(canonical, 'pristine') };
  for (const target of Object.values(targets)) {
    mkdirSync(target, { recursive: true });
    if (lstatSync(target).isSymbolicLink() || realpathSync(target) !== target) {
      throw new Error('Cargo stage targets must be distinct real directories, not links');
    }
  }
  return targets;
}

function runLocalSuite(dir: string, cmd: string, budgetSecs: number, stage: 'visible' | 'pristine', target: string | undefined, progress: boolean): RunResult {
  const t0 = Date.now();
  const shell = localVerifierShell(process.platform, cmd);
  if (!shell) {
    return {
      exit: null,
      secs: 0,
      failure: 'backend',
      reason: `checkpointed-local verifier is unsupported on ${process.platform}; no trusted local shell contract is defined`,
    };
  }
  const scratch = mkdtempSync(join(tmpdir(), 'tw-verify-run-'));
  try {
    const env = suiteEnv(scratch);
    if (target) {
      let valid = false;
      try { valid = realpathSync(target) === target && !lstatSync(target).isSymbolicLink(); } catch {}
      if (!valid) {
        return { exit: null, secs: 0, failure: 'backend', reason: 'Cargo stage target changed before execution' };
      }
      env.CARGO_TARGET_DIR = target;
    }
    const r = runCapturedProcessSync(shell.executable, shell.args, {
      cwd: dir,
      env,
      timeoutMs: budgetSecs * 1000,
      detached: true,
      killGroupOnFinish: true,
      backstopMs: 30_000,
      progressStage: progress ? stage : undefined,
    });
    const secs = Math.round((Date.now() - t0) / 1000);
    if (r.timedOut) {
      return {
        exit: null,
        secs,
        failure: 'budget',
        reason: 'verifier stage exceeded its budget',
        diagnostics: r.diagnostics,
      };
    }
    if (r.error) {
      return {
        exit: null,
        secs,
        failure: 'backend',
        reason: r.error,
        diagnostics: r.diagnostics,
      };
    }
    if (r.exit === null) {
      return {
        exit: null,
        secs,
        failure: 'backend',
        reason: `verifier suite did not return an exit code${r.signal ? ` (signal ${r.signal})` : ''}`,
        diagnostics: r.diagnostics,
      };
    }
    return {
      exit: r.exit,
      secs,
      ...(r.pipeHeldOpen ? { pipeHeldOpen: true } : {}),
      diagnostics: r.diagnostics,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function diagnosticsJson(
  diagnostics: SuiteDiagnostics | undefined,
  includeTail: boolean,
): Record<string, unknown> | undefined {
  if (!diagnostics) return undefined;
  const stream = (d: SuiteDiagnostics['stdout']) => ({
    captured_bytes: d.captured_bytes,
    retained_bytes: d.retained_bytes,
    truncated: d.truncated,
    ...(includeTail && d.captured_bytes > 0 ? { tail: d.tail } : {}),
  });
  return {
    stdout: stream(diagnostics.stdout),
    stderr: stream(diagnostics.stderr),
  };
}

function stageJson(result: RunResult): Record<string, unknown> {
  const includeTail = result.exit !== 0 || result.failure !== undefined;
  return {
    exit: result.exit,
    secs: result.secs,
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.diagnostics
      ? { diagnostics: diagnosticsJson(result.diagnostics, includeTail) }
      : {}),
  };
}

function renderStageDiagnostics(
  out: (s: string) => void,
  stage: string,
  result: RunResult,
): void {
  if (!result.diagnostics) return;
  for (const line of diagnosticLines(stage, result.diagnostics)) out(line);
}

/** Context for the human verify verdict line. */
export interface VerifyVerdictContext {
  restored: number;
  base: string;
  visibleExit: number | null;
  pristineExit: number | null;
  budget: number;
}

/** Pure renderer for the verdict text after "tamperward verify — ". Exported so
 *  the documented wording is a testable production contract, not a copy. */
export function verifyVerdictLine(verdict: string, ctx: VerifyVerdictContext): string {
  const base10 = ctx.base.slice(0, 10);
  switch (verdict) {
    case 'VERIFIED':
      return `verified: the suite passes, and still passes with all ${ctx.restored} protected files restored from ${base10}.`;
    case 'MASKED_FAILURE':
      return (
        `MASKED FAILURE: the visible suite passes, but with the ${ctx.restored} protected files restored from ` +
        `${base10} it FAILS (exit ${ctx.pristineExit}). Something weakened the checks; the code does not pass the original suite.`
      );
    case 'SUITE_RED':
      return `suite red: the visible suite fails (exit ${ctx.visibleExit}) — fix the code first (pristine exit ${ctx.pristineExit}).`;
    case 'BUDGET_EXCEEDED':
      return `budget exceeded (${ctx.budget}s): could not verify — failing closed, not open.`;
    default:
      return verdict;
  }
}

export function runVerify(opts: VerifyOpts): number {
  // A verification is now in progress. `tamperward status` reads this marker and
  // reports VERIFYING while a live process holds it (#600). Best-effort and
  // never authoritative: skipped for nested verifies (the envelope owns the
  // lifecycle), and a write/clear failure never changes the verdict. Cleared in
  // `finally` so an early fail-closed return still releases it.
  const markerCwd = repoRoot(opts.cwd ?? process.cwd());
  const marked = opts.silent ? false : beginVerifying(markerCwd);
  const started = performance.now();
  let path: string | null = null;
  try { path = configuredAuditPath(markerCwd); } catch { /* evidence only */ }
  const measurement: { outcome: MeasurementOutcome; comparison?: string; oob_signoff?: boolean } = { outcome: 'INCOMPLETE' };
  try {
    return runVerifyImpl({ ...opts, onVerdict: v => { measurement.outcome = v.verdict; opts.onVerdict?.(v); } }, path ? measurement : undefined);
  } catch (error) {
    measurement.outcome = 'INCOMPLETE';
    delete measurement.oob_signoff;
    throw error;
  } finally {
    if (marked) endVerifying(markerCwd);
    recordMeasurement(path, { kind: 'verify', duration_ms: Math.max(0, Math.round(performance.now() - started)), ...measurement });
  }
}

function runVerifyImpl(opts: VerifyOpts, measurement?: { comparison?: string; oob_signoff?: boolean }): number {
  // Normalize to the repository root once, so policy load, git enumeration,
  // materialization, verifier inputs and suite execution all agree on one tree.
  // Invoked from a package subdirectory, the caller's cwd would otherwise
  // enumerate only that subtree while policy came from the root — running the
  // root suite against an incomplete copy and reporting a false SUITE_RED (#554).
  // `repoRoot` returns the worktree root (linked worktrees included), or the
  // path unchanged outside a repository, where git operations fail closed anyway.
  const cwd = repoRoot(opts.cwd ?? process.cwd());
  const colour = opts.silent ? false : colourEnabled(process.env, process.stdout);
  // Colour only the shared `verify:` label so the line strips to a byte-identical one; a
  // failing-closed line reads red, everything else the neutral info cyan.
  const paintVerify = (s: string): string => {
    if (!s.startsWith('verify:')) return s;
    const sev: Severity = /failing closed/i.test(s) ? 'bad' : 'info';
    return paint('verify:', (sev === 'bad' ? BOLD : '') + severityColour(sev), colour) + s.slice('verify:'.length);
  };
  const out = opts.silent
    ? (_s: string): void => {}
    : (s: string): void => void process.stdout.write(paintVerify(s) + '\n');

  // Probed once the temp root exists, then reported in every document so the
  // fold assumption the overlay ran under is auditable (#426).
  let filesystemCaseSensitive: boolean | undefined;
  const caseReport = (): Record<string, unknown> =>
    filesystemCaseSensitive === undefined ? {} : { filesystem_case_sensitive: filesystemCaseSensitive };

  const cannotVerify = (
    reason: VerifyCannotVerifyReason,
    detail?: string,
    extra: Record<string, unknown> = {},
  ): number => {
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason, ...(detail ? { detail } : {}) });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason,
        ...(detail ? { detail } : {}),
        ...caseReport(),
        ...extra,
      }));
    } else if (detail) {
      out(`verify: ${detail} — failing closed`);
    }
    return 2;
  };

  if (opts.invalid) {
    return cannotVerify('INVALID_ARGUMENTS', opts.invalid);
  }

  // POLICY PROVENANCE. The candidate must not choose the rules it is judged by.
  // With a --base, the overlay classes, the verification surface config and the
  // verifier command/budget all come from THAT COMMIT, never from the working
  // tree: a PR that rewrote `verify: { command: true }` would otherwise have
  // standalone `verify` grade itself and report VERIFIED. `check --diff` does
  // flag that as hook-tampering, so the generated workflow caught it as a pair —
  // but only if both jobs are required, and anyone running `verify` alone had no
  // protection at all. The base governs, so the guarantee holds job-by-job.
  //
  // Without a --base there is no trusted commit to read from and the working
  // tree's policy is all there is; that is the local-developer path, not the
  // authority path.
  let policy: Policy;
  try {
    if (opts.policyOverride) policy = opts.policyOverride;
    else if (opts.base) policy = loadPolicyAt(resolveBase(opts.base, cwd), cwd) ?? defaultPolicy();
    else policy = loadPolicy(cwd);
  } catch (e) {
    return cannotVerify('POLICY_ERROR', `cannot load policy (${e instanceof Error ? e.message : String(e)})`);
  }
  if (opts.requireAncestor) {
    const requested = git(['rev-parse', '--verify', `${opts.base ?? 'HEAD'}^{commit}`], cwd).trim();
    if (!baseIsAncestorOfHead(requested, cwd)) {
      return cannotVerify(
        'BASE_NOT_ANCESTOR',
        `--require-ancestor: ${requested.slice(0, 10)} is not an ancestor of HEAD; the anchor would silently resolve to an older commit`,
        { base: requested },
      );
    }
  }
  const cmd = opts.cmd ?? policy.verify?.command;
  if (!cmd) {
    return cannotVerify(
      'NO_SUITE_COMMAND',
      opts.base
        ? 'no suite command in the policy at the trusted base; add it at the base or pass --cmd explicitly'
        : 'no suite command; set policy verify.command or pass --cmd',
    );
  }
  const budget = opts.budget ?? policy.verify?.budget ?? 300;
  const floorVerification = policy.organizationFloor?.verify;
  if (floorVerification && (cmd !== floorVerification.command || budget < floorVerification.budget)) {
    return cannotVerify('POLICY_ERROR', 'verification flags would weaken the organisation policy floor');
  }

  // Establish the EXECUTION boundary before materialising or executing candidate
  // code. Container mode never falls back to local: inability to prove the
  // engine + digest-pinned image is a cannot-verify verdict.
  const verifierBackend = opts.verifierBackend ?? prepareVerifierBackend(policy.verify);
  const backendReport = () => verifierBackendReport(verifierBackend);
  if (!verifierBackend.available) {
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason: 'VERIFIER_BACKEND_UNAVAILABLE', ...(verifierBackend.reason ? { detail: verifierBackend.reason } : {}) });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason: 'VERIFIER_BACKEND_UNAVAILABLE',
        verifier_backend: backendReport(),
        oracle_assurance: oracleAssuranceReport(),
      }));
    } else {
      out('verify: isolated verifier backend is unavailable — failing closed');
      out('verify: ' + (verifierBackend.reason ?? 'unknown backend failure'));
    }
    return 2;
  }
  const isolated = verifierBackend.kind === 'container';
  let cargoTargets: Record<'visible' | 'pristine', string> | undefined;
  if (opts.cargoTargetRoot !== undefined) {
    if (isolated) return cannotVerify('INVALID_ARGUMENTS', '--cargo-target-root is supported only by the checkpointed-local backend');
    try {
      cargoTargets = cargoStageTargets(opts.cargoTargetRoot, cwd);
    } catch (e) {
      return cannotVerify('INVALID_ARGUMENTS', `cannot configure Cargo stage targets (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  if (!isolated && !localVerifierShell(process.platform, cmd)) {
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason: 'LOCAL_VERIFIER_UNSUPPORTED_PLATFORM', detail: `checkpointed-local verifier is unsupported on ${process.platform}` });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason: 'LOCAL_VERIFIER_UNSUPPORTED_PLATFORM',
        platform: process.platform,
        verifier_backend: backendReport(),
        oracle_assurance: oracleAssuranceReport(),
      }));
    } else {
      out(
        `verify: checkpointed-local verifier is unsupported on ${process.platform}; ` +
          'no trusted local shell contract is defined. Failing closed before candidate execution.',
      );
    }
    return 2;
  }

  // Same-host dependency attestation is a LOCAL-backend control. The isolated
  // backend mounts no agent dependency environment at all: its immutable image
  // owns runtime/dependencies and the materialised copy gets dependencyRoot=null.
  const dependencyEnvironment = isolated
    ? null
    : (opts.dependencyEnvironment ?? discoverDependencyEnvironment(cwd, cmd));
  const dependencyReport = () =>
    dependencyEnvironment
      ? dependencyEnvironmentReport(dependencyEnvironment)
      : {
          status: 'verifier-owned',
          roots: [],
          image: verifierBackend.image,
        };
  if (dependencyEnvironment?.status === 'unattestable' && !opts.allowDepDrift) {
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason: 'DEPENDENCY_ENVIRONMENT_UNATTESTABLE', ...(dependencyEnvironment.reason ? { detail: dependencyEnvironment.reason } : {}) });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason: 'DEPENDENCY_ENVIRONMENT_UNATTESTABLE',
        verifier_backend: backendReport(),
        dependency_environment: dependencyReport(),
        oracle_assurance: oracleAssuranceReport(),
      }));
    } else {
      out('verify: dependency environment is not attestable — failing closed');
      out('verify: ' + (dependencyEnvironment.reason ?? 'unknown dependency environment'));
    }
    return 2;
  }
  const frozenNodeModules = dependencyEnvironment
    ? (dependencyEnvironment.roots.find((root) => root.kind === 'node_modules')?.realPath ?? null)
    : null;
  const checkDeps = () =>
    dependencyEnvironment ? checkDependencyEnvironment(cwd, dependencyEnvironment) : { ok: true };
  const runStage = (dir: string, stage: 'visible' | 'pristine'): RunResult => opts.runStage ? opts.runStage(dir) :
    isolated
      ? runContainerStage(verifierBackend, dir, cmd, budget, opts.silent ? undefined : stage)
      : runLocalSuite(dir, cmd, budget, stage, cargoTargets?.[stage], !opts.silent);

  // A stage that exits with a process still holding stdout open is not quiescent:
  // that process can still mutate the tree or verification material before the
  // other stage runs, so fail closed rather than certify the recovered exit code.
  const notQuiescent = (stage: 'visible' | 'pristine', r: RunResult): number => {
    const detail =
      `the ${stage} suite exited (code ${r.exit ?? 'unknown'}) but left a process ` +
      'holding stdout open after termination was attempted; the stage is not ' +
      'quiescent, so the run cannot be certified';
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason: 'VERIFIER_BACKEND_RUNTIME_FAILURE', detail });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason: 'VERIFIER_BACKEND_RUNTIME_FAILURE',
        stage,
        ...caseReport(),
        detail,
        diagnostics: diagnosticsJson(r.diagnostics, true),
        verifier_backend: backendReport(),
        oracle_assurance: oracleAssuranceReport(),
      }));
    } else {
      out(`verify: the ${stage} suite exited but left a process holding stdout open — the stage is not quiescent, failing closed`);
      out('verify: ' + detail);
      renderStageDiagnostics(out, stage, r);
    }
    return 2;
  };

  let base: string;
  try {
    base = resolveBase(opts.base ?? 'HEAD', cwd);
  } catch {
    return cannotVerify('BASE_UNRESOLVABLE', `cannot resolve base rev "${opts.base ?? 'HEAD'}"`);
  }

  let candidateHead: string;
  try {
    candidateHead = readTrustedGit(['rev-parse', '--verify', 'HEAD^{commit}'], cwd).trim();
  } catch {
    return cannotVerify('BASE_UNRESOLVABLE', 'cannot resolve candidate HEAD for verification evidence', {
      verifier_backend: backendReport(), dependency_environment: dependencyReport(), oracle_assurance: oracleAssuranceReport(),
    });
  }

  // SEQUENCING IS THE CONTROL (H1). The two copies used to be siblings under one
  // root, both materialised and the overlay fully applied, BEFORE the visible run
  // started. The visible run executes the candidate's code — so the candidate's
  // code could simply write ../pristine/test/<the test that convicts it> and both
  // runs returned 0. No race, no background process, no git: three lines in a
  // file the agent already controls, and the whole pristine layer reported
  // VERIFIED over an unfixed bug.
  //
  // The pristine copy is therefore built only AFTER the visible run has exited.
  // There is nothing to write into while the candidate is running, because it
  // does not exist yet. Separate temp roots as well, so "the sibling directory"
  // is not even a shape the attack can assume — that is defence in depth, not
  // the control; a background process can still enumerate a temp directory, and
  // the digest check after the pristine run is what covers that.
  const visRoot = mkdtempSync(join(tmpdir(), 'tw-verify-vis-'));
  const visDir = join(visRoot, 't');
  const cleanup = (dirs: string[]): void => {
    if (opts.keep) return;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  };

  // The filesystem the copies live on decides what "the same path" means
  // (#426). Both roots come from the same temp directory, so one probe covers
  // both materialisations. On a case-insensitive filesystem two in-tree paths
  // that fold together cannot both exist in a copy — whichever is written
  // second silently replaces the first — so the copy would not be the tree
  // under verification, and neither run is evidence about it. Refused before
  // any candidate code runs.
  filesystemCaseSensitive = (opts.probeCaseSensitivity ?? probeFilesystemCaseSensitivity)(visRoot);
  if (!filesystemCaseSensitive) {
    // A listed-but-gone index entry never reaches a copy (materialize skips
    // it), so it cannot collide there either.
    const present = (rel: string): boolean => {
      try {
        lstatSync(join(cwd, rel));
        return true;
      } catch {
        return false;
      }
    };
    const collision =
      caseFoldCollision(workingTreePaths(cwd).filter(present)) ??
      caseFoldCollision(baseEntries(base, cwd).map((e) => e.path));
    if (collision) {
      cleanup([visRoot]);
      return cannotVerify(
        'PATH_CASE_COLLISION',
        `${collision[0]} and ${collision[1]} are distinct paths that the case-insensitive filesystem the copies are ` +
          'materialised on cannot tell apart; the copy could not be the tree under verification',
        { verifier_backend: backendReport(), dependency_environment: dependencyReport(), oracle_assurance: oracleAssuranceReport() },
      );
    }
  }

  // The tree under verification must not move either: the pristine copy is now
  // materialised from it AFTER the candidate's code has had a turn, so a visible
  // run that reaches back into the original working tree (its path is one
  // readlink away, through the node_modules symlink) would be choosing what the
  // pristine copy is made of.
  const protectedIgnored = (rel: string): boolean => isProtected(rel, policy);
  const treeBefore = treeFingerprint(cwd, protectedIgnored);
  const evidenceIdentity = {
    head: candidateHead,
    base, tree: treeBefore, gate_version: TW_VERSION,
    policy_hash: verificationPolicyDigest(policy),
    verifier_hash: verificationVerifierDigest(policy, cmd, budget),
  };
  if (measurement) {
    try { measurement.comparison = measurementComparison(git(['rev-parse', 'HEAD'], cwd).trim(), treeBefore, cmd); } catch { /* evidence only */ }
  }
  const dependencyAtEntry = dependencyEnvironment
    ? (
        reuseDependencyEnvironmentAttestation(
          cwd,
          dependencyEnvironment,
          opts.dependencyEntryAttestation,
        ) ?? checkDeps()
      )
    : { ok: true };
  if (!dependencyAtEntry.ok && !opts.allowDepDrift) {
    cleanup([visRoot]);
    return cannotVerify(
      'DEPENDENCY_DRIFT',
      dependencyAtEntry.reason ?? 'dependency identity changed before the visible suite ran',
      { dependency_environment: dependencyReport(), verifier_backend: backendReport(), oracle_assurance: oracleAssuranceReport() },
    );
  }

  try {
    mkdirSync(visDir);
    materialize(cwd, visDir, frozenNodeModules);
  } catch (e) {
    cleanup([visRoot]);
    return cannotVerify(
      'MATERIALIZATION_FAILED',
      `could not materialize (${e instanceof Error ? e.message : String(e)})`,
      { verifier_backend: backendReport(), dependency_environment: dependencyReport(), oracle_assurance: oracleAssuranceReport(), materialization_reason: materializationFailureReason(e) },
    );
  }

  const visible = runStage(visDir, 'visible');
  if (visible.pipeHeldOpen) {
    cleanup([visRoot]);
    return notQuiescent('visible', visible);
  }

  if (visible.failure === 'backend' || visible.failure === 'resource') {
    cleanup([visRoot]);
    const exhausted = visible.failure === 'resource';
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason: exhausted ? 'VERIFIER_RESOURCE_EXHAUSTED' : 'VERIFIER_BACKEND_RUNTIME_FAILURE', ...(visible.reason ? { detail: visible.reason } : {}) });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason: exhausted ? 'VERIFIER_RESOURCE_EXHAUSTED' : 'VERIFIER_BACKEND_RUNTIME_FAILURE',
        stage: 'visible',
        ...caseReport(),
        ...(visible.resource ? { resource: visible.resource } : {}),
        detail: visible.reason,
        diagnostics: diagnosticsJson(visible.diagnostics, true),
        verifier_backend: backendReport(),
        oracle_assurance: oracleAssuranceReport(),
      }));
    } else {
      out(
        exhausted
          ? 'verify: isolated verifier resource envelope was exhausted during the visible stage — failing closed'
          : 'verify: verifier execution backend failed while running the visible stage — failing closed',
      );
      if (visible.reason) out('verify: ' + visible.reason);
      renderStageDiagnostics(out, 'visible', visible);
    }
    return 2;
  }
  // A visible budget timeout cannot produce useful pristine evidence: the
  // verifier has already exhausted its allowed stage time, so continuing would
  // spend another full stage while the final verdict is already fail-closed.
  // Stop before materialising or executing pristine.
  if (visible.failure === 'budget') {
    const pristineNotRun: RunResult = {
      exit: null,
      secs: 0,
      failure: 'budget',
      reason: 'not run: visible stage exceeded its budget',
    };
    cleanup([visRoot]);
    opts.onVerdict?.({ verdict: 'BUDGET_EXCEEDED' });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'BUDGET_EXCEEDED',
        base,
        command: cmd,
        budget_secs: budget,
        visible: stageJson(visible),
        pristine: stageJson(pristineNotRun),
        protected_restored: 0,
        added_protected_removed: 0,
        filesystem_case_sensitive: filesystemCaseSensitive,
        verifier_backend: backendReport(),
        dependency_environment: dependencyReport(),
        oracle_assurance: oracleAssuranceReport(),
        ...(opts.keep ? { visible_dir: visDir } : {}),
      }));
    } else {
      out(`tamperward verify — ${verifyVerdictLine('BUDGET_EXCEEDED', {
        restored: 0,
        base,
        visibleExit: visible.exit,
        pristineExit: pristineNotRun.exit,
        budget,
      })}`);
      out('verifier backend: ' + verifierBackendSummary(verifierBackend));
      out('oracle assurance: suite-exit-only (candidate source executes inside the suite process; execution-domain isolation is not semantic/oracle isolation)');
      out(
        dependencyEnvironment
          ? 'dependency environment: ' + dependencyEnvironmentSummary(dependencyEnvironment)
          : 'dependency environment: verifier-owned by ' + (verifierBackend.image ?? 'isolated image'),
      );
      renderStageDiagnostics(out, 'visible', visible);
    }
    return 2;
  }

  if (treeFingerprint(cwd, protectedIgnored) !== treeBefore) {
    cleanup([visRoot]);
    return cannotVerify(
      'WORKTREE_CHANGED',
      'the working tree changed while the visible suite was running',
      { stage: 'visible', verifier_backend: backendReport(), dependency_environment: dependencyReport(), oracle_assurance: oracleAssuranceReport() },
    );
  }
  const dependencyAfterVisible = checkDeps();
  if (!dependencyAfterVisible.ok && !opts.allowDepDrift) {
    cleanup([visRoot]);
    return cannotVerify(
      'DEPENDENCY_DRIFT',
      dependencyAfterVisible.reason ?? 'dependency identity changed while the visible suite was running',
      { stage: 'visible', dependency_environment: dependencyReport(), verifier_backend: backendReport(), oracle_assurance: oracleAssuranceReport() },
    );
  }

  const priRoot = mkdtempSync(join(tmpdir(), 'tw-verify-pri-'));
  const priDir = join(priRoot, 't');
  let restored: string[] = [];
  let removedAdded = 0;
  try {
    mkdirSync(priDir);
    materialize(cwd, priDir, frozenNodeModules);
    ({ restored, removed: removedAdded } = overlayPristine(
      cwd, base, priDir, policy, cmd, frozenNodeModules, filesystemCaseSensitive,
    ));
  } catch (e) {
    cleanup([visRoot, priRoot]);
    return cannotVerify(
      'MATERIALIZATION_FAILED',
      `could not materialize pristine copy (${e instanceof Error ? e.message : String(e)})`,
      { stage: 'pristine', verifier_backend: backendReport(), dependency_environment: dependencyReport(), oracle_assurance: oracleAssuranceReport(), materialization_reason: materializationFailureReason(e) },
    );
  }

  const overlayBefore = overlayDigest(priDir, restored);
  const pristine = runStage(priDir, 'pristine');
  if (pristine.pipeHeldOpen) {
    cleanup([visRoot, priRoot]);
    return notQuiescent('pristine', pristine);
  }
  if (pristine.failure === 'backend' || pristine.failure === 'resource') {
    cleanup([visRoot, priRoot]);
    const exhausted = pristine.failure === 'resource';
    opts.onVerdict?.({ verdict: 'CANNOT_VERIFY', reason: exhausted ? 'VERIFIER_RESOURCE_EXHAUSTED' : 'VERIFIER_BACKEND_RUNTIME_FAILURE', ...(pristine.reason ? { detail: pristine.reason } : {}) });
    if (opts.json) {
      out(JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict: 'CANNOT_VERIFY',
        reason: exhausted ? 'VERIFIER_RESOURCE_EXHAUSTED' : 'VERIFIER_BACKEND_RUNTIME_FAILURE',
        stage: 'pristine',
        ...caseReport(),
        ...(pristine.resource ? { resource: pristine.resource } : {}),
        detail: pristine.reason,
        diagnostics: diagnosticsJson(pristine.diagnostics, true),
        verifier_backend: backendReport(),
        oracle_assurance: oracleAssuranceReport(),
      }));
    } else {
      out(
        exhausted
          ? 'verify: isolated verifier resource envelope was exhausted during the pristine stage — failing closed'
          : 'verify: verifier execution backend failed while running the pristine stage — failing closed',
      );
      if (pristine.reason) out('verify: ' + pristine.reason);
      renderStageDiagnostics(out, 'pristine', pristine);
    }
    return 2;
  }
  const overlayMoved = overlayDigest(priDir, restored) !== overlayBefore;
  const treeMoved = treeFingerprint(cwd, protectedIgnored) !== treeBefore;
  const dependencyAfterPristineAttestation = dependencyEnvironment
    ? attestDependencyEnvironment(cwd, dependencyEnvironment)
    : undefined;
  const dependencyAfterPristine =
    dependencyAfterPristineAttestation?.check ?? { ok: true };
  if (dependencyAfterPristineAttestation) {
    opts.onDependencyFinalAttestation?.(dependencyAfterPristineAttestation);
  }
  const depsMoved = !dependencyAfterPristine.ok && !opts.allowDepDrift;
  cleanup([visRoot, priRoot]);

  if (overlayMoved || treeMoved || depsMoved) {
    const reason: VerifyCannotVerifyReason = overlayMoved
      ? 'PRISTINE_INTEGRITY_CHANGED'
      : treeMoved
        ? 'WORKTREE_CHANGED'
        : 'DEPENDENCY_DRIFT';
    const detail = overlayMoved
      ? 'a restored file in the pristine copy changed while the pristine suite was running'
      : treeMoved
        ? 'the working tree changed while the pristine suite was running'
        : (dependencyAfterPristine.reason ?? 'the frozen dependency environment changed while the pristine suite was running');
    return cannotVerify(reason, detail, {
      stage: 'pristine',
      verifier_backend: backendReport(),
      dependency_environment: dependencyReport(),
      oracle_assurance: oracleAssuranceReport(),
    });
  }

  let verdict: 'VERIFIED' | 'MASKED_FAILURE' | 'SUITE_RED' | 'BUDGET_EXCEEDED';
  let code: number;
  if (visible.exit === null || pristine.exit === null) {
    verdict = 'BUDGET_EXCEEDED';
    code = 2; // cannot verify ≠ verified — fail closed
  } else if (visible.exit === 0 && pristine.exit === 0) {
    verdict = 'VERIFIED';
    code = 0;
  } else if (visible.exit === 0) {
    verdict = 'MASKED_FAILURE';
    code = 1;
  } else {
    verdict = 'SUITE_RED';
    code = 1;
  }
  opts.onVerdict?.({ verdict });

  // Record the verified state for `tamperward status` (#600). ONLY a genuine
  // VERIFIED result — the source passes the original suite — is recorded; a
  // masked failure (even one cleared out of band) and a red suite are not. The
  // record binds the exact tree, base/HEAD, policy, verifier contract, protected
  // surface and runtime wiring so status can tell CURRENT from STALE. Best-effort
  // evidence only: a write failure never changes the exit code, and the record is
  // never repository/CI merge authority.
  if (verdict === 'VERIFIED') {
    try {
      const inputs: VerificationInputs = {
        base_ref: opts.base ?? 'HEAD',
        explicit_base: opts.base !== undefined,
        command_source: opts.cmd !== undefined ? 'flag' : 'policy',
        command: cmd,
        budget_source: opts.budget !== undefined ? 'flag' : 'policy',
        budget,
      };
      // Reuse the tree fingerprint proved unchanged above (finding 6): the record
      // binds the same tree without a second full read of the worktree.
      recordVerification(cwd, inputs, treeBefore);
      // Emit the transportable receipt (#601) bound to the SAME state, stored
      // under `.git/tamperward/` — outside the candidate-controlled tree. It is
      // a projection of the record just written, so it re-derives no identity.
      const written = readVerificationRecord(cwd);
      if (written) storeReceipt(cwd, receiptFromRecord(written));
    } catch {
      // Evidence only. Recording must never change the verification verdict.
    }
  } else {
    // A non-VERIFIED adjudication of this SAME state — a flaky SUITE_RED, a
    // MASKED_FAILURE, or budget exhaustion — must not leave a prior VERIFIED
    // record standing at CURRENT (#600 finding 3). Invalidate it when its binding
    // still matches the live state; a record for a different state is left as
    // STALE. Evidence only: a failure here never changes the verdict.
    try {
      // Remove the transportable receipt whenever the #600 record it projects is
      // invalidated (#601 finding 3): otherwise a red run on the same tree would
      // leave `verification-receipt.json` behind, and it could still be exported
      // or transported as a claim for a state that is no longer verified. The
      // receipt is a projection of the record — it must never outlive it.
      if (invalidateVerificationRecordIfCurrent(cwd)) removeStoredReceipt(cwd);
    } catch {
      // Evidence only. Reconciliation must never change the verification verdict.
    }
  }

  // Out-of-band sign-off, MASKED_FAILURE only. The verdict is still reported as
  // what it is — the source does not pass the original suite — and the exit
  // code alone is what the approval changes. Same token rules as the diff gate:
  // once the workflow names the head it is adjudicating, only a token bound to
  // that commit counts, so the approval dies with the next push.
  const oob = oobFromEnv();
  const oobHead = oobHeadFromEnv();
  const signedOff = verdict === 'MASKED_FAILURE' ? oobToken('verify', oob, oobHead) : null;
  if (measurement) measurement.oob_signoff = Boolean(signedOff);
  if (signedOff) code = 0;
  // A `verify` approval offered under a head the gate cannot identify clears nothing
  // (oobToken refuses every token under it); say so once, on stderr, so the label does
  // not merely look lost (#709).
  const headProblem = verdict === 'MASKED_FAILURE' && oob.length > 0 ? oobHeadProblem(oobHead) : null;
  if (headProblem) process.stderr.write(`tamperward: ${headProblem}\n`);

  if (opts.json) {
    out(
      JSON.stringify({
        schema_version: MACHINE_SCHEMA_VERSION,
        verdict,
        base,
        // The candidate tree fingerprint this run actually ADJUDICATED — the same
        // identity `verify` binds into the #600 record (`treeBefore`). Additive
        // (verify-v1 is `additionalProperties: true`), it lets `receipt reconcile`
        // tell whether CI's verdict is about the receipt's tree or a different one:
        // in a `pull_request` run the enforcement verify runs over the MERGE result,
        // so when the branch is behind its base this differs from the branch-tip
        // tree a receipt binds, and reconcile must report NON_APPLICABLE rather than
        // attribute CI's verdict to a tree CI never ran (#601 re-review).
        adjudicated_tree: treeBefore,
        ...(verdict !== 'BUDGET_EXCEEDED' && !opts.allowDepDrift ? { evidence_binding: { ...evidenceIdentity, completed: true, integrity: 'CLEAN' } } : {}),
        command: cmd,
        budget_secs: budget,
        visible: stageJson(visible),
        pristine: stageJson(pristine),
        protected_restored: restored.length,
        added_protected_removed: removedAdded,
        filesystem_case_sensitive: filesystemCaseSensitive,
        verifier_backend: backendReport(),
        dependency_environment: dependencyReport(),
        oracle_assurance: oracleAssuranceReport(),
        ...(signedOff ? { oob_signoff: signedOff } : {}),
        ...(opts.keep ? { visible_dir: visDir, pristine_dir: priDir } : {}),
      }),
    );
  } else {
    out(
      `tamperward verify — ${verifyVerdictLine(verdict, {
        restored: restored.length,
        base,
        visibleExit: visible.exit,
        pristineExit: pristine.exit,
        budget,
      })}`,
    );
    out(`verifier backend: ${verifierBackendSummary(verifierBackend)}`);
    out(
      'oracle assurance: suite-exit-only (candidate source executes inside the suite process; ' +
        'execution-domain isolation is not semantic/oracle isolation)',
    );
    out(
      dependencyEnvironment
        ? `dependency environment: ${dependencyEnvironmentSummary(dependencyEnvironment)}` +
          (opts.allowDepDrift && dependencyEnvironment.status === 'unattestable' ? ' (operator override)' : '')
        : `dependency environment: verifier-owned by ${verifierBackend.image ?? 'isolated image'}`,
    );
    if (verdict !== 'VERIFIED') {
      if (visible.exit !== 0 || visible.failure !== undefined) {
        renderStageDiagnostics(out, 'visible', visible);
      }
      if (pristine.exit !== 0 || pristine.failure !== undefined) {
        renderStageDiagnostics(out, 'pristine', pristine);
      }
    }
    if (signedOff) {
      const approval = signedOff.startsWith('tw1:') ? signedOff : `tamperward:allow:${signedOff}`;
      out(
        `masked failure cleared by out-of-band approval (${approval}): a reviewer ` +
          'accepted that the original suite no longer applies to this change. Exit 0.',
      );
    }
    if (removedAdded > 0)
      out(
        `(${removedAdded} protected file(s) added since ${base.slice(0, 10)} were removed from the pristine run: ` +
          'the pristine tree carries exactly the base\'s protected surface.)',
      );
  }
  return code;
}

export function parseVerify(args: string[]): VerifyOpts {
  const o: VerifyOpts = {};
  // A value-taking flag takes the NEXT argument, and only when that is a
  // value. `verify --base --json` used to read the base as "--json", and a
  // trailing `--base` with nothing after it silently fell back to HEAD. A flag
  // is never a value: the fault is recorded, the flag is left to be parsed as
  // itself, and runVerify fails closed on the record.
  const value = (i: number, flag: string): string | undefined => {
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) {
      o.invalid ??= `${flag} needs a value` + (v === undefined ? '' : ` (got the flag "${v}")`);
      return undefined;
    }
    return v;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') o.json = true;
    else if (a === '--keep') o.keep = true;
    else if (a === '--require-ancestor') o.requireAncestor = true;
    else if (a === '--base' || a === '--cmd' || a === '--cwd' || a === '--budget' || a === '--cargo-target-root') {
      const v = value(i, a);
      if (v === undefined) continue;
      i++;
      if (a === '--base') o.base = v;
      else if (a === '--cmd') o.cmd = v;
      else if (a === '--cwd') o.cwd = v;
      else if (a === '--cargo-target-root') o.cargoTargetRoot = v;
      else {
        o.budget = Number(v);
        if (!Number.isFinite(o.budget) || o.budget <= 0)
          o.invalid ??= `--budget needs a positive number of seconds (got "${v}")`;
      }
    }
  }
  return o;
}
