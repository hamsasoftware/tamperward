// tamperward run — the enforcement envelope (SPEC row 17).
//
// Round 2's decisive negative finding (the-gate-held-the-runtime-didnt): a
// hook can be right at every decision point and the system still fails,
// because the hook does not own termination. In the cssstyle-gated
// trajectory the gate denied 42 mutations and verify rejected every one of
// 25 stop attempts — including the last, two seconds before the session
// completed anyway with a masked-green tree, because in a print-mode agent
// runtime "the model stopped producing" and "the task is done" are the same
// event. Whatever tree exists when the runtime lets go is the outcome.
//
// This command closes that boundary from the outside: it wraps the agent
// invocation, records the trusted base BEFORE the agent starts, treats the
// runtime's exit as untrusted, and re-adjudicates the tree the agent left
// behind — committed or not — before anything downstream can read "green".
//
//   tamperward run [--base R] [--cmd C] [--budget S] [--agent-budget S] \
//                  [--allow-dirty] [--cwd D] -- <agent command...>
//
// After the agent exits, three verdicts, all against the entry-time base:
//   1. policy check over base...HEAD   (weakening the agent COMMITTED)
//   2. policy check over the worktree  (weakening left uncommitted)
//   3. verify against the base        (masked failure, however produced)
//
// Exit contract ("green means green", as an exit code):
//   enforcement clean and agent exited 0        → 0
//   enforcement clean, agent exited N≠0        → N   (transparent wrapper)
//   any blocking finding or masked failure     → 1   (even if the agent "succeeded")
//   cannot adjudicate (dirty start, policy     → 2   (fail closed, never open)
//     error, verify cannot run)
//
// The hooks remain the fast path — they steer the agent in-session. This
// envelope, or `check --diff` + `verify` in CI, is the boundary.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { accessSync, constants as fsConstants, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runCheck } from './check';
import { runVerify } from './verify';
import { loadPolicyAt } from '../policy-load';
import { objectRewriteState } from '../git/trusted';
import { readTrustedGit, trustedGitAncestor } from '../git/process';
import { treeFingerprint } from '../fingerprint';
import {
  attestDependencyEnvironment,
  checkDependencyEnvironment,
  dependencyEnvironmentDiagnostics,
  dependencyEnvironmentReport,
  dependencyEnvironmentSummary,
  discoverDependencyEnvironment,
  type DependencyEnvironmentAttestation,
} from '../dependency-env';
import { prepareVerifierBackend, verifierBackendReport, verifierBackendSummary } from '../verifier-backend';
import { defaultPolicy, isProtected } from '../policy';
import { assertRev, diffRange, diffWorktreeWithUntracked, gitDir } from '../git/build';
import { inspectRel, stateDirectory } from '../disk';
import { contentHash } from '../effect';
import { drainEvents, MAX_EVENT_SWEEP_BYTES, transientFindings } from '../detectors/fs-events';
import { watcherTelemetry, type WatcherTelemetry } from './watch';
import { Policy } from '../types';
import { machineOutput, type RunCannotAdjudicateReason, type RunVerdict } from '../machine-output';
import { errnoCode } from '../narrow';

export interface RunEnvelopeOpts {
  cwd?: string;
  base?: string;
  cmd?: string;
  budget?: number;
  /** Emit one machine-readable final adjudication document on stdout. */
  json?: boolean;
  /** Operator-owned wall-clock budget for the wrapped agent runtime itself.
   *  Distinct from verify.budget, which bounds each suite execution. */
  agentBudget?: number;
  allowDirty?: boolean;
  /** Seconds to wait after adjudication before the final quiescence check, to
   *  catch a background worker that sleeps through it. 0 = no wait. */
  settle?: number;
  /** Accept the risk that the agent rewrote the installed dependencies the
   *  suite runs through. Operator-owned, like --allow-dirty. */
  allowDepDrift?: boolean;
  /** Start a session-scoped filesystem observer before the wrapped agent and
   *  report/consume its temporal evidence after the agent releases the tree. */
  observeTransients?: boolean;
  /** @internal CLI entrypoint used to launch the supervised watcher. Tests
   *  inject a tiny fixture; normal CLI dispatch passes its own entry file. */
  observerEntry?: string;
  /** @internal Test-only trusted override for Linux interpreter discovery. Not parsed by the CLI. */
  linuxPythonCandidates?: string[];
  /** @internal Test-only platform projection for lifecycle preflight. Not parsed by the CLI. */
  lifecyclePlatformOverride?: NodeJS.Platform;
  /** @internal Test-only fault injection owned by the caller, never read from candidate env. */
  lifecycleTestMode?: 'proc-read-fail' | 'drain-timeout';
  /** @internal Observer for callers that need the supervised agent's raw lifecycle result
   *  without changing the public run --json document. Called once after the
   *  supervisor returns and before adjudication. */
  onAgentResult?: (result: AgentRunResult) => void;
  /** @internal Test checkpoint after lifecycle drain and before any adjudication starts. */
  onBeforeAdjudication?: () => void;
  argv: string[];
}

const out = (s: string) => process.stdout.write(s + '\n');
const err = (s: string) => process.stderr.write(s + '\n');

export interface AgentRunResult {
  exit: number;
  timedOut: boolean;
  /** True only when this platform/supervisor established the stronger lifecycle
   *  boundary for the wrapped agent domain. This records lifecycle ownership only:
   *  verifier-entry dependency attestation deliberately remains an independent
   *  checkpoint and is never reused from the run-side snapshot. */
  lifecycleOwned: boolean;
  signal?: string | null;
  failure?: string;
}

export function authoritativeRunLifecyclePlatform(
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === 'linux';
}

/**
 * Synchronous settle wait owned by TamperWard itself.
 *
 * The previous implementation executed an external `sleep` binary and silently
 * skipped the requested quiescence window when that binary was unavailable. A
 * security boundary must not depend on PATH or a POSIX utility for elapsed time.
 */
export function waitForSettleSync(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const ms = Math.ceil(seconds * 1000);
  const word = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  Atomics.wait(word, 0, 0, ms);
}

export function canReuseAdjacentDependencyAttestation(
  _lifecycleOwned: boolean,
  _platform: NodeJS.Platform = process.platform,
): boolean {
  // Security > one saved tree walk. #376 showed that coupling this optimization
  // to same-UID lifecycle supervision is too subtle: the verifier-entry
  // checkpoint must remain independent of the run-side checkpoint. Re-enable
  // only when the agent execution domain itself is independently isolated.
  return false;
}

const DEFAULT_TRUSTED_PYTHON_CANDIDATES = ['/usr/bin/python3', '/bin/python3'] as const;

function supervisorEnv(): NodeJS.ProcessEnv {
  return {
    PATH: '/usr/bin:/bin',
    HOME: '/nonexistent',
    LANG: 'C',
    LC_ALL: 'C',
    PYTHONNOUSERSITE: '1',
    PYTHONSAFEPATH: '1',
  };
}

function callerIsRoot(): boolean {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const euid = typeof process.geteuid === 'function' ? process.geteuid() : uid;
  return uid === 0 || euid === 0;
}

function writableByCaller(path: string): boolean {
  // Root/euid-0 has write authority over every ordinary system interpreter
  // path, so same-UID separation is not meaningful in that mode.
  if (callerIsRoot()) return true;
  let cur = path;
  for (;;) {
    try {
      accessSync(cur, fsConstants.W_OK);
      return true;
    } catch {
      // not writable by this caller
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return false;
}

/**
 * Resolve a Linux supervisor interpreter from fixed system paths only.
 * Candidate cwd/PATH/PYTHON* settings are never consulted. The interpreter and
 * every ancestor must be non-writable by the caller, and isolated startup must
 * successfully import the exact stdlib modules used by the supervisor.
 */
export function trustedLinuxPython(
  candidates: readonly string[] = DEFAULT_TRUSTED_PYTHON_CANDIDATES,
): { path: string | null; reason?: string } {
  if (process.platform !== 'linux') return { path: null, reason: 'Linux lifecycle backend is unavailable on this platform' };
  if (callerIsRoot()) {
    return {
      path: null,
      reason:
        'Linux lifecycle supervision is unavailable when TamperWard runs as root/euid 0; same-UID separation cannot trust any system interpreter path',
    };
  }
  for (const candidate of candidates) {
    try {
      const real = realpathSync(candidate);
      const st = statSync(real);
      if (!st.isFile() || writableByCaller(real)) continue;
      const probe = spawnSync(
        real,
        ['-I', '-S', '-E', '-c', 'import ctypes,json,os,signal,subprocess,sys,time'],
        {
          cwd: '/',
          env: supervisorEnv(),
          stdio: 'ignore',
          timeout: 5_000,
        },
      );
      if (!probe.error && probe.status === 0 && probe.signal == null) return { path: real };
    } catch {
      // try the next fixed system candidate
    }
  }
  return {
    path: null,
    reason:
      'no trusted Linux python3 interpreter is available at a fixed non-writable system path with isolated stdlib startup',
  };
}

/**
 * Portable fallback supervisor. It owns the ordinary process group, but does
 * NOT claim Linux-style detached-descendant ownership. Its result is trusted
 * only when the supervisor itself exits normally; a same-UID candidate that
 * forges the result file and kills the supervisor therefore cannot create a
 * trusted lifecycle result.
 */
const AGENT_SUPERVISOR = String.raw`
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');

const [resultFile, budgetRaw, machineRaw, command, ...args] = process.argv.slice(1);
const budgetMs = budgetRaw === '' ? null : Number(budgetRaw);
const machineMode = machineRaw === '1';
let child;
let timedOut = false;
let finished = false;

function writeResult(value) {
  try {
    const tmp = resultFile + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, resultFile);
  } catch {}
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' }); } catch {}
    return;
  }
  try { process.kill(-pid, 'SIGKILL'); } catch {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
}

try {
  child = spawn(command, args, {
    // Machine mode owns stdout for the final envelope document. Preserve agent
    // diagnostics by routing both child streams to the parent's stderr.
    stdio: machineMode ? ['inherit', 2, 2] : 'inherit',
    detached: process.platform !== 'win32',
  });
} catch (e) {
  writeResult({ exit: 1, timedOut: false, lifecycleOwned: false, failure: String(e) });
  process.exit(0);
}

const timer = budgetMs == null
  ? null
  : setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, budgetMs);
if (timer) timer.unref();

function finish(code, signal, failure) {
  if (finished) return;
  finished = true;
  if (timer) clearTimeout(timer);
  killTree(child && child.pid);
  writeResult({
    exit: timedOut ? 124 : (code == null ? 1 : code),
    timedOut,
    lifecycleOwned: false,
    signal: signal == null ? null : String(signal),
    ...(failure ? { failure } : {}),
  });
  process.exit(0);
}

child.once('error', (e) => finish(1, null, String(e)));
child.once('exit', (code, signal) => finish(code, signal));
`;

/**
 * Linux lifecycle backend.
 *
 * prctl(PR_SET_CHILD_SUBREAPER) is the kernel ownership primitive: descendants
 * that double-fork, setsid(), or otherwise orphan are reparented to this
 * supervisor rather than escaping to init. The supervisor does not report
 * success until the process group is killed, every adopted child is killed,
 * and /proc shows the execution domain drained. A candidate may SIGKILL this
 * same-UID supervisor, but the outer process then observes abnormal supervisor
 * termination and refuses to trust any forged result file.
 */
const LINUX_SUBREAPER_SUPERVISOR = String.raw`
import ctypes, json, os, signal, subprocess, sys, time

result_file, agent_env_file, agent_cwd, budget_raw, test_mode, machine_raw, command, *args = sys.argv[1:]
budget = None if budget_raw == "" else float(budget_raw)
machine_mode = machine_raw == "1"
libc = ctypes.CDLL(None, use_errno=True)
PR_SET_DUMPABLE = 4
PR_SET_CHILD_SUBREAPER = 36

def write_result(value):
    tmp = result_file + ".tmp-" + str(os.getpid())
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(value, fh)
    os.replace(tmp, result_file)

def fail(msg, code=70):
    try:
        write_result({"exit": 1, "timedOut": False, "lifecycleOwned": False, "failure": msg})
    except Exception:
        pass
    raise SystemExit(code)

# The agent gets the caller's frozen environment, but the supervisor itself was
# launched with a minimal trusted environment and isolated Python startup. Read
# and unlink this snapshot before candidate code starts.
try:
    with open(agent_env_file, "r", encoding="utf-8") as fh:
        agent_env = json.load(fh)
    os.unlink(agent_env_file)
    if not isinstance(agent_env, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in agent_env.items()):
        fail("agent environment snapshot was malformed")
except Exception as exc:
    fail("could not load frozen agent environment: %s" % exc)

if libc.prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0:
    fail("PR_SET_CHILD_SUBREAPER failed: errno=%d" % ctypes.get_errno())
# Reduce same-UID introspection of the supervisor. Same-UID SIGKILL remains
# possible; the outer process treats abnormal supervisor completion as untrusted.
if libc.prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) != 0:
    fail("PR_SET_DUMPABLE failed: errno=%d" % ctypes.get_errno())

def direct_children():
    if test_mode == "proc-read-fail":
        raise RuntimeError("injected child-observation failure")
    path = "/proc/self/task/%d/children" % os.getpid()
    try:
        raw = open(path, "r", encoding="ascii").read().strip()
    except Exception as exc:
        raise RuntimeError("could not read adopted-child list: %s" % exc)
    if not raw:
        return []
    try:
        return [int(part) for part in raw.split()]
    except Exception as exc:
        raise RuntimeError("malformed adopted-child list: %s" % exc)

def reap_state():
    # ECHILD/ChildProcessError is the authoritative kernel statement that this
    # subreaper has no children. pid==0 means at least one live child remains.
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return "empty", None
        except InterruptedError:
            continue
        except Exception as exc:
            return "error", "waitpid failed while draining: %s" % exc
        if pid == 0:
            return "live", None
        # Reaped one child; continue until either ECHILD or a live child blocks.

def kill_domain(pgid):
    try:
        os.killpg(pgid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except Exception as exc:
        return False, "killpg failed: %s" % exc

    if test_mode == "drain-timeout":
        return False, "injected lifecycle drain failure"

    deadline = time.monotonic() + 3.0
    while time.monotonic() < deadline:
        state, reason = reap_state()
        if state == "empty":
            return True, None
        if state == "error":
            return False, reason
        try:
            kids = direct_children()
        except Exception as exc:
            return False, str(exc)
        if not kids:
            # waitpid says a live child exists but proc cannot name it. Never
            # reinterpret incomplete observation as an empty execution domain.
            time.sleep(0.01)
            continue
        for pid in kids:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except Exception as exc:
                return False, "failed to kill adopted descendant %d: %s" % (pid, exc)
        time.sleep(0.01)

    state, reason = reap_state()
    if state == "empty":
        return True, None
    if state == "error":
        return False, reason
    return False, "adopted descendant execution domain did not reach kernel ECHILD within 3 seconds"

timed_out = False
try:
    child = subprocess.Popen(
        [command] + args,
        cwd=agent_cwd,
        env=agent_env,
        start_new_session=True,
        # In machine mode stdout is reserved for TamperWard's one final JSON
        # document. Agent stdout is retained as diagnostics on stderr.
        stdout=sys.stderr if machine_mode else None,
        stderr=None,
    )
except Exception as exc:
    # No candidate process exists, so the lifecycle domain is trivially empty.
    write_result({"exit": 1, "timedOut": False, "lifecycleOwned": True, "failure": str(exc)})
    raise SystemExit(0)

try:
    if budget is None:
        code = child.wait()
    else:
        try:
            code = child.wait(timeout=budget)
        except subprocess.TimeoutExpired:
            timed_out = True
            code = 124
finally:
    ok, reason = kill_domain(child.pid)

if not ok:
    fail(reason or "lifecycle drain failed")

write_result({
    "exit": 124 if timed_out else int(code),
    "timedOut": timed_out,
    "lifecycleOwned": True,
    "signal": None,
})
raise SystemExit(0)
`;


export function runAgentSupervised(
  argv: string[],
  cwd: string,
  budgetSecs?: number,
  linuxPythonCandidates?: readonly string[],
  lifecycleTestMode?: 'proc-read-fail' | 'drain-timeout',
  machineMode = false,
): AgentRunResult {
  const stateDir = mkdtempSync(join(tmpdir(), 'tw-agent-supervisor-'));
  const resultFile = join(stateDir, 'result.json');
  const agentEnvFile = join(stateDir, 'agent-env.json');
  try {
    const linux = process.platform === 'linux';
    let executable: string;
    let args: string[];
    let supervisorCwd = cwd;
    let env: NodeJS.ProcessEnv = process.env;

    if (linux) {
      const trustedPython = trustedLinuxPython(linuxPythonCandidates ?? DEFAULT_TRUSTED_PYTHON_CANDIDATES);
      if (!trustedPython.path) {
        return {
          exit: 1,
          timedOut: false,
          lifecycleOwned: false,
          failure: trustedPython.reason ?? 'trusted Linux python3 interpreter is unavailable',
        };
      }
      writeFileSync(agentEnvFile, JSON.stringify(process.env), { mode: 0o600 });
      executable = trustedPython.path;
      args = [
        '-I',
        '-S',
        '-E',
        '-c',
        LINUX_SUBREAPER_SUPERVISOR,
        resultFile,
        agentEnvFile,
        cwd,
        budgetSecs === undefined ? '' : String(budgetSecs),
        lifecycleTestMode ?? '',
        machineMode ? '1' : '0',
        ...argv,
      ];
      // Supervisor startup/import resolution is independent of candidate cwd,
      // PATH, HOME, PYTHONPATH, user site-packages and startup hooks. The agent
      // itself receives the separately frozen caller environment and cwd.
      supervisorCwd = '/';
      env = supervisorEnv();
    } else {
      executable = process.execPath;
      args = [
        '-e',
        AGENT_SUPERVISOR,
        resultFile,
        budgetSecs === undefined ? '' : String(budgetSecs * 1000),
        machineMode ? '1' : '0',
        ...argv,
      ];
    }

    const supervisor = spawnSync(
      executable,
      args,
      {
        cwd: supervisorCwd,
        env,
        stdio: 'inherit',
        // Inner supervision owns the intended deadline. This is only a
        // dead-supervisor backstop and therefore has extra drain headroom.
        ...(budgetSecs === undefined
          ? {}
          : {
              timeout: Math.ceil(budgetSecs * 1000) + 15_000,
              killSignal: 'SIGKILL' as const,
            }),
      },
    );

    const supervisorTimedOut =
      Boolean(supervisor.error) &&
      errnoCode(supervisor.error) === 'ETIMEDOUT';
    const completedNormally =
      !supervisorTimedOut &&
      !supervisor.error &&
      supervisor.status === 0 &&
      supervisor.signal == null;

    // The result file is same-UID writable by design. It is evidence only after
    // the supervisor itself completed normally. The Linux supervisor writes its
    // final record only after waitpid has reached ECHILD, so no candidate-owned
    // process remains to race this read.
    if (!completedNormally) {
      return {
        exit: supervisorTimedOut ? 124 : 1,
        timedOut: supervisorTimedOut,
        lifecycleOwned: false,
        signal: supervisor.signal ? String(supervisor.signal) : null,
        failure: supervisorTimedOut
          ? 'agent lifecycle supervisor exceeded its cleanup backstop'
          : supervisor.error
            ? `agent lifecycle supervisor failed: ${supervisor.error.message}`
            : `agent lifecycle supervisor did not complete normally (status=${String(supervisor.status)}, signal=${String(supervisor.signal)})`,
      };
    }

    let state: {
      exit?: number;
      timedOut?: boolean;
      signal?: string | null;
      lifecycleOwned?: boolean;
      failure?: string;
    } = {};
    try {
      state = JSON.parse(readFileSync(resultFile, 'utf8'));
    } catch {
      return {
        exit: 1,
        timedOut: false,
        lifecycleOwned: false,
        failure: 'agent lifecycle supervisor completed without a valid final status',
      };
    }

    if (typeof state.exit !== 'number' || typeof state.timedOut !== 'boolean') {
      return {
        exit: 1,
        timedOut: false,
        lifecycleOwned: false,
        failure: 'agent lifecycle supervisor final status was malformed',
      };
    }

    return {
      exit: state.timedOut ? 124 : state.exit,
      timedOut: state.timedOut,
      lifecycleOwned: state.lifecycleOwned === true,
      signal: state.signal ?? null,
      ...(state.failure ? { failure: state.failure } : {}),
    };
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
}

interface SupervisedObserver {
  log: string;
  pid: number | null;
  finished: boolean;
}

const waitCell = new Int32Array(new SharedArrayBuffer(4));
function waitMs(ms: number): void {
  Atomics.wait(waitCell, 0, 0, ms);
}

function pidAlive(pid: number | null): boolean {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return errnoCode(e) === 'EPERM';
  }
}

/** True once the observer process has exited, reaped or not.
 *
 *  `kill(pid, 0)` alone cannot say so here: the envelope waits synchronously
 *  (Atomics.wait), so the parent's event loop never gets to reap the child, and
 *  an exited child lingers as a zombie that `kill(pid, 0)` still reports alive.
 *  On Linux the process state is read from /proc; `Z` (zombie) or `X` (dead)
 *  is an exit that only the reaper has not collected yet. Elsewhere pid
 *  liveness is the only signal and the caller's bounded deadline is the
 *  backstop. */
function observerExited(pid: number | null): boolean {
  if (!pidAlive(pid)) return true;
  if (process.platform !== 'linux') return false;
  try {
    // comm can contain spaces and parens, so parse after the final ')'.
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const state = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
    return state === 'Z' || state === 'X';
  } catch (e) {
    // ENOENT: exited and reaped between the two probes. Anything else
    // (restricted procfs) leaves the answer to the pid probe above.
    return errnoCode(e) === 'ENOENT';
  }
}

function supervisedObserverLog(cwd: string): string {
  const gd = gitDir(cwd) ?? join(cwd, '.git');
  // The state directory itself is accepted only as a directory of its own (#721):
  // a link there is a StateFileError, and the envelope refuses to run.
  return join(
    stateDirectory(gd),
    `run-observer-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}.jsonl`,
  );
}

function startSupervisedObserver(
  cwd: string,
  base: string,
  entry: string | undefined,
): SupervisedObserver {
  const log = supervisedObserverLog(cwd);
  const cliEntry = entry ?? process.argv[1];
  if (!cliEntry) return { log, pid: null, finished: false };

  let child;
  try {
    child = spawn(
      process.execPath,
      [resolve(cliEntry), 'watch', '--dir', cwd, '--log', log, '--base', base],
      {
        cwd,
        stdio: ['ignore', 'ignore', 'inherit'],
        env: process.env,
      },
    );
  } catch {
    return { log, pid: null, finished: false };
  }

  const pid = child.pid ?? null;
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const telemetry = watcherTelemetry(log);
    if (telemetry.state === 'healthy' || telemetry.state === 'degraded') break;
    if (observerExited(pid)) break;
    waitMs(25);
  }
  return { log, pid, finished: false };
}

function stopObserverProcess(observer: SupervisedObserver): WatcherTelemetry {
  // Give the external watcher a short independent drain window after the
  // synchronous agent/adjudication activity before asking it to shut down.
  waitMs(100);
  const beforeStop = watcherTelemetry(observer.log);
  const pid = observer.pid;
  if (pid !== null && !observerExited(pid)) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
    // Health is evidence, not lifecycle completion authority. The observer
    // persists its "stopped" record before the signal handler has finished its
    // final writes and exited, so returning on that record can return while
    // the observer is still writing. Only the process exit proves shutdown
    // drained (#394); the drain window stays bounded, with SIGKILL behind it.
    const deadline = Date.now() + 2_000;
    while (!observerExited(pid) && Date.now() < deadline) waitMs(25);
    if (!observerExited(pid)) {
      try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
  observer.finished = true;
  return beforeStop;
}

type RunWriter = (s: string) => void;

function observerSummary(
  observer: SupervisedObserver,
  telemetry: WatcherTelemetry,
  write: RunWriter = out,
): void {
  const h = telemetry.health;
  const counts = h
    ? `${h.event_count} event(s), ${h.dropped_events} dropped, ${h.error_count} error(s)`
    : 'no valid health record';
  const reason = telemetry.reason ? `; ${telemetry.reason}` : '';
  write(
    `tamperward run — transient observer: ${telemetry.state} ` +
      `(advisory; ${counts}; log ${observer.log}${reason})`,
  );
}

function collectObserverFindings(
  observer: SupervisedObserver,
  telemetry: WatcherTelemetry,
  cwd: string,
  base: string,
  head: string,
  policy: Policy,
  write: RunWriter = out,
): { blocking: boolean } {
  observerSummary(observer, telemetry, write);
  const strict = process.env.TAMPERWARD_TRANSIENT === 'block';
  const drained = drainEvents(observer.log, 0);
  const { events } = drained;

  if (!drained.complete) {
    const issue = drained.issue ?? 'read-stalled';
    write(
      `tamperward run — transient observer: telemetry was not fully classified (${issue}; ` +
        `${drained.bytesRead}/${MAX_EVENT_SWEEP_BYTES} bytes read). ` +
        (strict
          ? 'Strict transient policy fails closed.'
          : 'Observer telemetry remains advisory, so this degrades evidence but does not independently fail the envelope.'),
    );
    if (strict) return { blocking: true };
  }

  if (events.length === 0) return { blocking: false };

  let persistent = new Set<string>();
  try {
    const changes = [
      ...(head !== base ? diffRange(base, head, { cwd }) : []),
      ...diffWorktreeWithUntracked({ cwd }, (rel) => isProtected(rel, policy)),
    ];
    persistent = new Set(
      changes
        .filter((change) => change.kind === 'file')
        .map((change) => change.path),
    );
  } catch (e) {
    write(
      `tamperward run — transient observer: recorded ${events.length} event(s), but ` +
        `could not classify them against the final diff (${e instanceof Error ? e.message : String(e)}).` +
        (strict ? ' Strict transient policy fails closed.' : ''),
    );
    return { blocking: strict };
  }

  const finalHash = (path: string): string | null => {
    const e = inspectRel(cwd, path);
    return e.kind === 'file' && e.content != null ? contentHash(e.content) : null;
  };
  const findings = transientFindings(events, persistent, policy, finalHash);
  for (const finding of findings) {
    write(
      `[observer] ${finding.severity === 'block' ? 'BLOCK' : 'warn'} ${finding.rule}` +
        `${finding.file ? ' ' + finding.file : ''}: ${finding.message}`,
    );
  }
  return { blocking: findings.some((finding) => finding.severity === 'block') };
}

function finishObserverAdvisory(
  observer: SupervisedObserver | null,
  write: RunWriter = out,
): void {
  if (!observer || observer.finished) return;
  const telemetry = stopObserverProcess(observer);
  observerSummary(observer, telemetry, write);
}

function git(args: string[], cwd: string): string {
  return readTrustedGit(args, cwd);
}

/** Clock ticks since boot. FLOOR is load-bearing: /proc/uptime is fractional
 *  and /proc/<pid>/stat starttime is an integer tick count, so comparing the
 *  two unrounded lets a process spawned inside the same 10ms tick read as
 *  "started before the agent". */
export function nowTicks(): number {
  try {
    return Math.floor(parseFloat(readFileSync('/proc/uptime', 'utf8').split(' ')[0]) * 100);
  } catch {
    return Number.POSITIVE_INFINITY; // unknown: convict nothing on start time
  }
}

/** Processes still holding this working tree that started AFTER the agent did.
 *
 *  `run` owns the agent's exit code, not its descendants: a worker detached
 *  with setsid/nohup survives every check and edits the tree afterwards. A
 *  synchronous wrapper cannot reap a new session, so the envelope does the
 *  honest thing — it declines to certify a tree something still holds.
 *
 *  Start time is the discriminator that keeps this from convicting the
 *  caller's own shell pipeline, an editor, or a dev server: only what appeared
 *  after the agent spawned can be the agent's doing. Cwd, executable and open
 *  descriptors are all inspected. Linux-only (/proc);
 *  elsewhere the fingerprint and --settle guards carry the load. */
export function survivorsHoldingTree(cwd: string, spawnedAfterTicks: number): number[] {
  const out: number[] = [];
  let real: string;
  try {
    real = realpathSync(cwd);
  } catch {
    return out;
  }
  let pids: string[];
  try {
    pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
  } catch {
    return out;
  }
  for (const pid of pids) {
    const n = Number(pid);
    if (n === process.pid) continue;
    try {
      // stat field 22 is starttime; comm can contain spaces and parens, so
      // parse after the final ')'.
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const startTicks = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
      if (!Number.isFinite(startTicks) || startTicks < spawnedAfterTicks) continue;
    } catch {
      continue; // raced with exit, or not ours to inspect
    }

    // CWD alone is not containment: a detached worker can chdir /tmp while it
    // keeps an open repository directory/file descriptor and later mutate via
    // that absolute handle. Inspect cwd, executable and every live fd. readlink
    // (not realpath) also preserves " (deleted)" proc targets for classification.
    const procLinks = [`/proc/${pid}/cwd`, `/proc/${pid}/exe`];
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) procLinks.push(`/proc/${pid}/fd/${fd}`);
    } catch {
      // Restricted procfs: cwd/exe still give the older conservative signal.
    }
    let holds = false;
    for (const link of procLinks) {
      try {
        const raw = readlinkSync(link).replace(/ \(deleted\)$/, '');
        const held = raw.startsWith('/') ? resolve(raw) : raw;
        if (held === real || held.startsWith(real + '/')) {
          holds = true;
          break;
        }
      } catch {
        /* fd closed or process exited */
      }
    }
    if (holds) out.push(n);
  }
  return out;
}

export function runEnvelope(opts: RunEnvelopeOpts): number {
  const cwd = resolve(opts.cwd ?? process.cwd()); // absolute: relative cwds break the verify overlay
  const say: RunWriter = opts.json ? (_s: string): void => {} : out;
  if (!opts.argv.length) {
    err('tamperward run: no agent command given (usage: tamperward run [options] -- <command...>)');
    return 2;
  }
  if (
    opts.agentBudget !== undefined &&
    (!Number.isFinite(opts.agentBudget) || opts.agentBudget <= 0)
  ) {
    err(
      `tamperward run: --agent-budget needs a positive number of seconds (got ${JSON.stringify(opts.agentBudget)}) — failing closed.`,
    );
    return 2;
  }

  // Inspect rewrite metadata before any Git read of the trusted base. Git
  // itself can consume shallow/graft metadata while resolving that base.
  let rewritesBefore: string;
  try {
    rewritesBefore = objectRewriteState(cwd);
  } catch (e) {
    err(`tamperward run: ${e instanceof Error ? e.message : String(e)} — cannot verify the trusted Git object layer before agent start.`);
    return 2;
  }

  // Trusted base: resolved BEFORE the agent runs, so commits the agent makes
  // cannot move it. --base overrides for callers whose trusted state is older
  // than HEAD (e.g. a branch the agent was already let loose on).
  let base: string;
  try {
    const requestedBase = assertRev(opts.base ?? 'HEAD');
    base = git(['rev-parse', '--verify', `${requestedBase}^{commit}`], cwd).trim();
  } catch {
    err(`tamperward run: cannot resolve trusted base ${opts.base ?? 'HEAD'} — failing closed.`);
    return 2;
  }

  // The verifier is part of the trust anchor: resolve the suite command and
  // budget from the ENTRY-TIME policy (or flags) BEFORE the agent starts,
  // and use only those frozen values afterwards. Otherwise an agent in a
  // repo with no verify config could author its own verifier
  // (verify.command: "true") and be adjudicated by it — policy-diff
  // deliberately treats ADDING a verify block as a strengthening, which is
  // right for PR review and wrong for this envelope.
  // The whole policy is part of the trust anchor, resolved from the BASE COMMIT
  // (loadPolicyAt(base)), never the working tree the agent controls. Otherwise
  // the agent adjudicates itself: an uncommitted .tamperward.yml that disables
  // test-deletion + hook-tampering, or widens `protected` so the pristine
  // overlay reverts its own bug — both scored 'clean' by a check that trusts
  // the post-agent tree. Falls back to the committed baseline, never the head's.
  let frozenPolicy: Policy;
  let frozenCmd: string | undefined;
  let frozenBudget: number | undefined;
  try {
    frozenPolicy = loadPolicyAt(base, cwd) ?? defaultPolicy();
    frozenCmd = opts.cmd ?? frozenPolicy.verify?.command;
    frozenBudget = opts.budget ?? frozenPolicy.verify?.budget;
  } catch (e) {
    err(`tamperward run: cannot load the entry-time policy (${e instanceof Error ? e.message : String(e)}) — failing closed.`);
    return 2;
  }
  if (!frozenCmd) {
    err('tamperward run: no suite command at entry (policy `verify: { command: ... }` or --cmd) —');
    err('refusing to start: a verifier that appears after the agent runs would be agent-authored.');
    return 2;
  }

  // A dirty start would attribute pre-existing changes to the agent (false
  // positives) or let real pre-staged weakening hide as "already there"
  // (false negatives). Refuse both unless the caller owns the risk.
  if (!opts.allowDirty) {
    let dirty: string;
    try {
      dirty = git(['status', '--porcelain'], cwd).trim();
    } catch (error) {
      err(`tamperward run: ${error instanceof Error ? error.message : String(error)} — cannot establish the entry-time working tree.`);
      return 2;
    }
    if (dirty) {
      err('tamperward run: working tree is dirty before the agent starts — the envelope cannot');
      err('attribute changes. Commit or stash first, or pass --allow-dirty to own the risk.');
      return 2;
    }
  }

  const lifecyclePlatform = opts.lifecyclePlatformOverride ?? process.platform;
  if (!authoritativeRunLifecyclePlatform(lifecyclePlatform)) {
    const alternative =
      lifecyclePlatform === 'win32'
        ? 'Use standalone tamperward check; checkpointed-local verify is unsupported on Windows, while container verify must pass its own Docker authority preflight.'
        : 'Use standalone tamperward check/verify or an isolated execution domain.';
    err(
      `tamperward run: authoritative agent lifecycle ownership is unavailable on ${lifecyclePlatform}; ` +
      'this release only certifies run on Linux with the trusted subreaper/ECHILD backend. ' +
      `Failing closed before the agent starts. ${alternative}`,
    );
    return 2;
  }

  // Establish the FINAL verification execution boundary BEFORE the agent is
  // allowed to run. Container mode never degrades to local: if the engine or
  // digest-pinned image is unavailable, there is no authority boundary and the
  // envelope refuses before candidate code gets a turn.
  const verifierBackend = prepareVerifierBackend(frozenPolicy.verify);
  say(`tamperward run — trusted base ${base.slice(0, 10)}; agent exit is untrusted.`);
  say(`tamperward run — verifier backend: ${verifierBackendSummary(verifierBackend)}`);
  if (!verifierBackend.available) {
    err('tamperward run: the requested verifier backend cannot be established —');
    err(`${verifierBackend.reason ?? 'unknown backend failure'}. Failing closed before the agent starts.`);
    return 2;
  }
  if (verifierBackend.kind === 'container') {
    err('tamperward run: container verification requires a frozen candidate handoff from an');
    err('agent domain that cannot control the verifier engine. `run` executes the agent under');
    err('this host identity, so it cannot honestly provide that separation. Failing closed');
    err('before the agent starts; use standalone `tamperward verify` in trusted CI or after');
    err('an externally isolated agent produces the frozen candidate artifact.');
    return 2;
  }

  // Dependency attestation is the weaker LOCAL-backend control. The isolated
  // backend deliberately shares no host dependency tree at all: its immutable
  // image owns runtime/dependencies and only a materialised candidate copy
  // crosses the boundary.
  const dependencyEnvironment = verifierBackend.kind === 'local'
    ? discoverDependencyEnvironment(cwd, frozenCmd)
    : null;
  if (dependencyEnvironment) {
    say(`tamperward run — dependency environment: ${dependencyEnvironmentSummary(dependencyEnvironment)}`);
    if (dependencyEnvironment.status === 'unattestable' && !opts.allowDepDrift) {
      err('tamperward run: the verifier dependency environment cannot be attested —');
      err(`${dependencyEnvironment.reason ?? 'unknown dependency environment'}. Failing closed before the agent starts.`);
      err('(Pass --allow-dep-drift only if you explicitly own this dependency-integrity risk.)');
      return 2;
    }
  } else {
    say(`tamperward run — dependency environment: verifier-owned by ${verifierBackend.image ?? 'isolated image'}`);
  }

  const observer = opts.observeTransients
    ? startSupervisedObserver(cwd, base, opts.observerEntry)
    : null;
  if (!observer) {
    say('tamperward run — transient observer: disabled (advisory; pass --observe-transients to enable)');
  }

  // What the object layer resolves to. Every read of the trusted base — the
  // pristine overlay, the ancestry assertion, the ranged diff — goes through
  // it, and `git replace` / info/grafts / shallow can redirect all three
  // without moving a ref or touching a file (src/git/trusted.ts).
  try {
    if (objectRewriteState(cwd) !== rewritesBefore) {
      err('tamperward run: Git rewrite metadata changed during entry preflight — cannot trust the frozen base.');
      finishObserverAdvisory(observer, say);
      return 2;
    }
  } catch (e) {
    err(`tamperward run: ${e instanceof Error ? e.message : String(e)} — cannot verify the trusted Git object layer before agent start.`);
    finishObserverAdvisory(observer, say);
    return 2;
  }
  const spawnTicks = nowTicks(); // survivors are what appears after this
  // Always use the trusted lifecycle supervisor. A runtime budget controls
  // elapsed time; it does not control whether TamperWard owns descendants.
  const agentRun = runAgentSupervised(
    opts.argv,
    cwd,
    opts.agentBudget,
    opts.linuxPythonCandidates,
    opts.lifecycleTestMode,
    opts.json === true,
  );
  opts.onAgentResult?.(agentRun);
  const agentExit = agentRun.exit;
  const agentTimedOut = agentRun.timedOut;
  // `complete` is the run document's shape discriminator: true only when the
  // full post-agent adjudication (both policy checks, verification, quiescence)
  // ran, so `head`, `checks.{diff,worktree,verify}` and `observer` are present.
  // Early convictions and lifecycle refusals emit `complete: false`.
  const emitRunJson = (
    verdict: RunVerdict,
    exitCode: number,
    extra: Record<string, unknown> = {},
    complete = false,
  ): void => {
    if (!opts.json) return;
    out(JSON.stringify(machineOutput({
      verdict,
      exit_code: exitCode,
      complete,
      base,
      agent: {
        exit_code: agentExit,
        timed_out: agentTimedOut,
        lifecycle_owned: agentRun.lifecycleOwned,
        ...(opts.agentBudget !== undefined ? { budget_secs: opts.agentBudget } : {}),
      },
      verifier_backend: verifierBackendReport(verifierBackend),
      dependency_environment: dependencyEnvironment
        ? dependencyEnvironmentReport(dependencyEnvironment)
        : { status: 'verifier-owned', roots: [], image: verifierBackend.image },
      ...extra,
    })));
  };
  if (agentRun.failure && !agentTimedOut) {
    err(`tamperward run: agent runtime failed to start/report cleanly (${agentRun.failure}).`);
  }
  // Adjudication begins only behind an authoritatively drained lifecycle
  // boundary, on EVERY platform. Linux is the only platform where this release
  // claims that boundary (the preflight above refuses the others before the
  // agent starts); the portable supervisor never reports ownership. If the
  // supervisor did not complete and drain, a same-UID candidate may still be
  // executing outside the repository holder scan, so no verdict is rendered.
  if (!agentRun.lifecycleOwned) {
    err('tamperward run: the agent lifecycle boundary was not established/drained — failing closed before adjudication.');
    finishObserverAdvisory(observer, say);
    emitRunJson('CANNOT_ADJUDICATE', 2, {
      reason: 'AGENT_LIFECYCLE_NOT_OWNED',
    });
    return 2;
  }
  if (agentTimedOut) {
    err(
      `tamperward run: AGENT_TIMEOUT — wrapped agent exceeded ${opts.agentBudget}s; its owned process tree was terminated. Post-timeout adjudication continues.`,
    );
  }

  // Internal security-test checkpoint: on Linux this is reached only after the
  // subreaper has received the authoritative kernel ECHILD condition. No policy,
  // dependency or verifier adjudication has started yet.
  opts.onBeforeAdjudication?.();

  // The trust anchor must not have moved: both the diff check and verify
  // resolve bases with merge-base semantics (right for PR review), so an
  // agent that rewrites history — `git reset --hard <ancestor>`, an orphan
  // branch — would silently DOWNGRADE the anchor to the older commit and be
  // adjudicated against a past that predates its task. Post-agent HEAD must
  // be a descendant of the entry SHA (merge-base then collapses to exactly
  // it); anything else is itself the conviction.
  // Same attack class as the history rewrite below, one layer lower: `git
  // replace`, .git/info/grafts and .git/shallow all change what the trusted
  // base RESOLVES TO without moving a ref or touching a tracked file. Checked
  // BEFORE adjudication, not merely reported after it: every check downstream
  // reads the base through this layer, so a report produced under a redirected
  // base describes an anchor we never chose.
  let rewritesAfter: string;
  try {
    rewritesAfter = objectRewriteState(cwd);
  } catch (e) {
    err(`tamperward run: ${e instanceof Error ? e.message : String(e)} — cannot adjudicate the trusted Git object layer.`);
    finishObserverAdvisory(observer, say);
    emitRunJson('CANNOT_ADJUDICATE', 2, { reason: 'CHECK_DIFF_UNJUDGEABLE' });
    return 2;
  }
  if (rewritesAfter !== rewritesBefore) {
    err('tamperward run: git object-replacement state changed during this run — a replace ref, graft');
    err('or shallow boundary now redirects what the trusted base resolves to. Nothing below could be');
    err('read against the anchor we started from. That is the finding.');
    say(`\ntamperward run — agent exit ${agentExit}; OBJECT_REWRITE → ENFORCEMENT_FAILED`);
    finishObserverAdvisory(observer, say);
    emitRunJson('OBJECT_REWRITE', 1);
    return 1;
  }

  let head: string;
  let isAncestor: boolean;
  try {
    head = git(['rev-parse', 'HEAD'], cwd).trim();
    isAncestor = trustedGitAncestor(base, head, cwd);
  } catch (error) {
    err(`tamperward run: ${error instanceof Error ? error.message : String(error)} — cannot adjudicate Git ancestry.`);
    finishObserverAdvisory(observer, say);
    emitRunJson('CANNOT_ADJUDICATE', 2, { reason: 'CHECK_DIFF_UNJUDGEABLE' });
    return 2;
  }
  if (!isAncestor) {
    err(`tamperward run: HEAD ${head.slice(0, 10)} is not a descendant of the trusted base ${base.slice(0, 10)} —`);
    err('the agent rewrote history out from under the anchor. That is the finding.');
    say(`\ntamperward run — agent exit ${agentExit}; HISTORY_REWRITE → ENFORCEMENT_FAILED`);
    finishObserverAdvisory(observer, say);
    emitRunJson('HISTORY_REWRITE', 1, { head });
    return 1;
  }

  // The tree under adjudication must not move while we adjudicate it.
  const protectedIgnored = (rel: string): boolean => isProtected(rel, frozenPolicy);
  const fpBefore = treeFingerprint(cwd, protectedIgnored);

  // Re-adjudicate the tree the runtime released, committed and uncommitted,
  // against the entry-time base. Order is cheap-to-expensive; every step
  // runs regardless so the report is complete.
  let diffCode = 0;
  if (head !== base) {
    say(`\n[envelope] policy check over committed changes (${base.slice(0, 10)}...${head.slice(0, 10)}):`);
    diffCode = runCheck({ diff: `${base}...${head}`, cwd, policyOverride: frozenPolicy, silent: opts.json });
  }
  say('\n[envelope] policy check over the working tree (frozen policy, untracked included, no local ledger):');
  const workCode = runCheck({ worktree: true, cwd, policyOverride: frozenPolicy, includeUntracked: true, ciLayer: true, silent: opts.json });

  // H3 dependency boundary. Policy checks above do not execute the verifier's
  // dependencies, so take this run-side checkpoint immediately before
  // runVerify. The nested verifier still performs its own independent entry
  // checkpoint: #374/#376 showed that lifecycle ownership must not be coupled
  // to dependency-attestation reuse across this trust boundary.
  const dependencyBeforeVerificationAttestation = dependencyEnvironment
    ? attestDependencyEnvironment(cwd, dependencyEnvironment)
    : undefined;
  const dependencyBeforeVerification =
    dependencyBeforeVerificationAttestation?.check ?? { ok: true as const };
  if (!dependencyBeforeVerification.ok) {
    err('tamperward run: the frozen dependency environment changed before verification began —');
    err(`${dependencyBeforeVerification.reason ?? 'dependency identity changed'}.`);
    if (!opts.allowDepDrift) {
      say(`\ntamperward run — agent exit ${agentExit}; DEPENDENCY_DRIFT → ENFORCEMENT_FAILED`);
      finishObserverAdvisory(observer, say);
      emitRunJson('DEPENDENCY_DRIFT', 1, {
        head,
        checks: { diff: diffCode, worktree: workCode },
      });
      return 1;
    }
    err('(--allow-dep-drift: proceeding anyway, on the operator\'s judgement.)');
  }

  let verifierFinalDependencyAttestation: DependencyEnvironmentAttestation | undefined;
  say('\n[envelope] pristine verification against the trusted base:');
  const verifyCode = runVerify({
    cwd,
    base,
    cmd: frozenCmd,
    budget: frozenBudget,
    policyOverride: frozenPolicy,
    ...(dependencyEnvironment
      ? {
          dependencyEnvironment,
          ...(dependencyBeforeVerificationAttestation &&
          canReuseAdjacentDependencyAttestation(agentRun.lifecycleOwned)
            ? { dependencyEntryAttestation: dependencyBeforeVerificationAttestation }
            : {}),
          onDependencyFinalAttestation: (attestation: DependencyEnvironmentAttestation) => {
            verifierFinalDependencyAttestation = attestation;
          },
        }
      : {}),
    allowDepDrift: opts.allowDepDrift,
    verifierBackend,
    silent: opts.json,
  });

  // Quiescence. A survivor that edits the tree during — or after — the checks
  // makes the verdict describe a tree that no longer exists: the masked-green
  // escape one level up from the runtime hole this command closes.
  if (opts.settle && opts.settle > 0) {
    waitForSettleSync(opts.settle);
  }
  const mutatedDuringAdjudication = treeFingerprint(cwd, protectedIgnored) !== fpBefore;
  if (mutatedDuringAdjudication) {
    err('tamperward run: the working tree changed while it was being adjudicated —');
    err('the verdict below would describe a tree that no longer exists.');
  }
  // Keep this independent. A detached/background process may still mutate an
  // ignored dependency after runVerify returns (or during --settle), so the
  // verifier-final attestation is observable but not equivalent to this final
  // envelope/quiescence boundary.
  const dependencyAfter = dependencyEnvironment
    ? checkDependencyEnvironment(cwd, dependencyEnvironment)
    : { ok: true as const };
  if (dependencyEnvironment && process.env.TAMPERWARD_DIAGNOSTICS === '1') {
    const metrics = dependencyEnvironmentDiagnostics(dependencyEnvironment);
    say(
      'tamperward run — dependency attestation diagnostics: ' +
      `full_snapshots=${metrics.fullSnapshots} ` +
      `reused_snapshots=${metrics.reusedSnapshots} ` +
      `total_ms=${Number(metrics.totalMs.toFixed(3))} ` +
      `verifier_final_attestation=${verifierFinalDependencyAttestation ? 'yes' : 'no'} ` +
      `run_lifecycle_owned=${agentRun.lifecycleOwned ? 'yes' : 'no'} ` +
      `entry_reuse=${canReuseAdjacentDependencyAttestation(agentRun.lifecycleOwned) ? 'yes' : 'no'}`,
    );
  }
  const depsDrifted = Boolean(dependencyEnvironment) && !opts.allowDepDrift && !dependencyAfter.ok;
  if (depsDrifted) {
    err('tamperward run: the frozen dependency environment changed during this run —');
    err(`${dependencyAfter.reason ?? 'dependency identity changed'}. Both verification runs depend on it.`);
  }
  // And again after the checks: a survivor can install a replace ref while the
  // suite is running, which would leave the verdict above describing a base
  // that no longer resolves the same way.
  let rewritesUnavailable = false;
  let rewrote = false;
  try {
    rewrote = objectRewriteState(cwd) !== rewritesBefore;
  } catch (e) {
    rewritesUnavailable = true;
    err(`tamperward run: ${e instanceof Error ? e.message : String(e)} — cannot certify the Git object layer after adjudication.`);
  }
  if (rewrote) {
    err('tamperward run: git object-replacement state changed WHILE the tree was being adjudicated —');
    err('the checks above read the trusted base through an object layer that has since moved.');
  }
  const survivors = survivorsHoldingTree(cwd, spawnTicks);
  if (survivors.length) {
    err(`tamperward run: ${survivors.length} process(es) started during this run still hold the`);
    err(`working tree (pid ${survivors.join(', ')}). A verdict cannot outlive the tree it describes.`);
  }

  let observerBlocked = false;
  if (observer && !observer.finished) {
    const telemetry = stopObserverProcess(observer);
    const observed = collectObserverFindings(
      observer,
      telemetry,
      cwd,
      base,
      head,
      frozenPolicy,
      say,
    );
    observerBlocked = observed.blocking;
  }

  const notQuiescent = mutatedDuringAdjudication || survivors.length > 0 || depsDrifted || rewrote;

  // A concurrent tree mutation can also make verify return 2 before this outer
  // layer reaches its fingerprint comparison. Once the envelope independently
  // proves non-quiescence, the result is the concrete enforcement finding (1),
  // not an unexplained cannot-adjudicate (2). This keeps timing from changing
  // the public classification of the same attack.
  const cannot = rewritesUnavailable || (!notQuiescent && (diffCode === 2 || workCode === 2 || verifyCode === 2));
  const blocked =
    diffCode === 1 || workCode === 1 || verifyCode === 1 || notQuiescent || observerBlocked;
  const enforcement = cannot ? 2 : blocked ? 1 : 0;

  const verdict =
    enforcement === 2 ? 'CANNOT_ADJUDICATE (fail closed)'
    : rewrote ? 'OBJECT_REWRITE — the base the checks read is not the base we anchored to'
    : depsDrifted ? 'DEPENDENCY_DRIFT — the suite runner changed under the envelope'
    : notQuiescent ? 'NOT_QUIESCENT — the tree moved, or something still holds it'
    : observerBlocked ? 'TRANSIENT_OBSERVER_BLOCK — observed temporal weakening under strict transient policy'
    : enforcement === 1 ? 'ENFORCEMENT_FAILED — the tree the runtime released does not stand'
    : agentTimedOut ? 'AGENT_TIMEOUT — runtime budget expired; post-timeout enforcement clean'
    : agentExit !== 0 ? `agent exited ${agentExit} (enforcement clean)`
    : 'GREEN MEANS GREEN';
  const machineVerdict: RunVerdict =
    enforcement === 2 ? 'CANNOT_ADJUDICATE'
    : rewrote ? 'OBJECT_REWRITE'
    : depsDrifted ? 'DEPENDENCY_DRIFT'
    : notQuiescent ? 'NOT_QUIESCENT'
    : observerBlocked ? 'TRANSIENT_OBSERVER_BLOCK'
    : enforcement === 1 ? 'ENFORCEMENT_FAILED'
    : agentTimedOut ? 'AGENT_TIMEOUT'
    : agentExit !== 0 ? 'AGENT_FAILED'
    : 'VERIFIED';
  const agentSummary = agentTimedOut
    ? `AGENT_TIMEOUT (${opts.agentBudget}s; exit 124)`
    : `agent exit ${agentExit}`;

  // Enforcement always outranks runtime status. A clean timeout uses the
  // conventional 124 so automation can distinguish it from success.
  const exitCode = enforcement !== 0 ? enforcement : agentTimedOut ? 124 : agentExit;

  if (opts.json) {
    // Which nested layer could not judge. `cannot` is only set when the tree was
    // quiescent, so exactly one of the three codes is 2 here.
    const cannotReason: RunCannotAdjudicateReason | null =
      enforcement !== 2 ? null
      : rewritesUnavailable ? 'CHECK_DIFF_UNJUDGEABLE'
      : verifyCode === 2 ? 'VERIFY_CANNOT_VERIFY'
      : diffCode === 2 ? 'CHECK_DIFF_UNJUDGEABLE'
      : 'CHECK_WORKTREE_UNJUDGEABLE';
    emitRunJson(machineVerdict, exitCode, {
      head,
      checks: { diff: diffCode, worktree: workCode, verify: verifyCode },
      observer: {
        enabled: Boolean(opts.observeTransients),
        blocking: observerBlocked,
      },
      ...(cannotReason ? { reason: cannotReason } : {}),
    }, true);
  } else {
    say(`\ntamperward run — ${agentSummary}; checks diff=${diffCode} worktree=${workCode} verify=${verifyCode} → ${verdict}`);
  }

  return exitCode;
}

export function parseRun(args: string[]): RunEnvelopeOpts {
  const o: RunEnvelopeOpts = { argv: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { o.argv = args.slice(i + 1); break; }
    else if (a === '--base') o.base = args[++i];
    else if (a === '--cmd') o.cmd = args[++i];
    else if (a === '--budget') o.budget = Number(args[++i]);
    else if (a === '--json') o.json = true;
    else if (a === '--agent-budget') o.agentBudget = Number(args[++i]);
    else if (a === '--allow-dirty') o.allowDirty = true;
    else if (a === '--settle') o.settle = Number(args[++i]);
    else if (a === '--allow-dep-drift') o.allowDepDrift = true;
    else if (a === '--observe-transients') o.observeTransients = true;
    else if (a === '--cwd') o.cwd = args[++i];
    else { o.argv = args.slice(i); break; } // first non-flag starts the command
  }
  return o;
}
