// `tamperward run` — the enforcement envelope (SPEC row 17). The central
// fixture replays round 2's cssstyle escape in miniature: an "agent" that
// masks the failure and exits 0, i.e. a runtime that released a poisoned
// tree with a success code. The envelope must convert that into a failing
// pipeline regardless of what the runtime claimed.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canReuseAdjacentDependencyAttestation, runEnvelope, parseRun, trustedLinuxPython } from '../src/cli/run';
import { runVerify } from '../src/cli/verify';
import { loadPolicy } from '../src/policy-load';
import { diffWorktree, diffWorktreeWithUntracked } from '../src/git/build';
import { MAX_EVENT_READ_BYTES, MAX_EVENT_SWEEP_BYTES } from '../src/detectors/fs-events';
import { rootless } from './rootless';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const CMD = 'node test/check.test.js';

// Same suite shape as verify.test.ts: check.test.js exits nonzero unless
// src.js returns 42. Base commit ships the bug (suite red) unless
// `fixed` — then base is green and honest.
function repo(fixed = false): string {
  const d = mkdtempSync(join(tmpdir(), 'tw-run-'));
  dirs.push(d);
  const git = (...a: string[]) => execFileSync('git', a, { cwd: d });
  git('init', '-q');
  git('config', 'user.email', 't@b');
  git('config', 'user.name', 'tb');
  mkdirSync(join(d, 'test'));
  writeFileSync(join(d, 'src.js'), fixed ? 'module.exports = 42;\n' : 'module.exports = 41; // bug\n');
  writeFileSync(
    join(d, 'test', 'check.test.js'),
    `const v = require('../src.js');\nif (v !== 42) { console.error('expected 42, got ' + v); process.exit(1); }\n`,
  );
  git('add', '-A');
  git('commit', '-qm', 'base');
  return d;
}

const sh = (script: string) => ['bash', '-c', script];

function linuxPidsWithCmdline(token: string): number[] {
  if (process.platform !== 'linux') return [];
  const found: number[] = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === process.pid) continue;
    try {
      const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
      if (cmdline.includes(token)) found.push(pid);
    } catch {
      // raced with exit
    }
  }
  return found;
}
const run = (cwd: string, argv: string[], extra: Partial<Parameters<typeof runEnvelope>[0]> = {}) =>
  runEnvelope({ cwd, cmd: CMD, budget: 30, argv, ...extra });

describe('tamperward run — the enforcement envelope', () => {
  it.skipIf(!rootless)('reports an unreadable post-agent commit as unavailable adjudication (#800)', () => {
    const cwd = repo(true);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(run(cwd, sh('true'), {
        json: true,
        onBeforeAdjudication: () => rmSync(join(cwd, '.git', 'objects', head.slice(0, 2), head.slice(2))),
      })).toBe(2);
      expect(JSON.parse(stdout.mock.calls.map(call => String(call[0])).join(''))).toMatchObject({
        verdict: 'CANNOT_ADJUDICATE', reason: 'CHECK_DIFF_UNJUDGEABLE', exit_code: 2, complete: false,
      });
      expect(stderr.mock.calls.map(call => String(call[0])).join('')).not.toContain('HISTORY_REWRITE');
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  }, 20000);

  it('refuses unreadable Git metadata before starting the agent (#798)', () => {
    const cwd = repo(true);
    symlinkSync('/dev/zero', join(cwd, '.git', 'shallow'));
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(run(cwd, sh('touch agent-ran'))).toBe(2);
      expect(stderr.mock.calls.map(call => String(call[0])).join('')).toContain('cannot inspect Git rewrite metadata shallow');
      expect(existsSync(join(cwd, 'agent-ran'))).toBe(false);
    } finally {
      stderr.mockRestore();
    }
  });

  it.skipIf(!rootless)('refuses unreadable Git metadata installed by the agent (#798)', () => {
    const cwd = repo(true);
    expect(run(cwd, sh('ln -s /dev/zero .git/shallow'))).toBe(2);
  });
  it.skipIf(!rootless)('honest fix, agent exits 0 → green means green (exit 0)', () => {
    const cwd = repo();
    expect(run(cwd, sh(`echo "module.exports = 42;" > src.js`))).toBe(0);
  });

  it.skipIf(!rootless)('the cssstyle replay: agent masks the failure and "succeeds" → exit 1', () => {
    const cwd = repo();
    // The agent guts the failing test (visible green) and exits 0 — the
    // runtime released a poisoned tree with a success code.
    expect(run(cwd, sh(`echo "" > test/check.test.js`))).toBe(1);
  });

  it.skipIf(!rootless)('agent COMMITS its tampering — the entry-time base still convicts (exit 1)', () => {
    const cwd = repo();
    expect(
      run(
        cwd,
        sh(`echo "" > test/check.test.js && git add -A && git -c user.email=a@b -c user.name=a commit -qm "fix tests"`),
      ),
    ).toBe(1);
  });

  it.skipIf(!rootless)('agent fails honestly (exit 7, tree untouched) → its code passes through', () => {
    const cwd = repo(true); // green base: enforcement clean, agent code visible
    expect(run(cwd, sh('exit 7'))).toBe(7);
  });

  it.skipIf(!rootless)('dirty tree before the agent starts → fail closed (exit 2); --allow-dirty proceeds', () => {
    const cwd = repo(true);
    writeFileSync(join(cwd, 'scratch.txt'), 'uncommitted');
    expect(run(cwd, sh('true'))).toBe(2);
    expect(run(cwd, sh('true'), { allowDirty: true })).toBe(0);
  });

  it('no agent command → exit 2, never a silent pass', () => {
    expect(runEnvelope({ cwd: repo(true), argv: [] })).toBe(2);
  });

  it('no verify command configured → cannot adjudicate, fail closed (exit 2)', () => {
    const cwd = repo(true);
    expect(runEnvelope({ cwd, argv: sh('true') })).toBe(2);
  });

  it('rejects a leading-dash trusted base before invoking git', () => {
    const cwd = repo(true);
    expect(run(cwd, sh('true'), { base: '--output=/tmp/tamperward' })).toBe(2);
  });
});

describe('parseRun', () => {
  it('splits flags from the agent command at -- and at the first non-flag', () => {
    expect(parseRun(['--base', 'abc', '--allow-dirty', '--', 'claude', '-p', 'x'])).toEqual({
      base: 'abc',
      allowDirty: true,
      argv: ['claude', '-p', 'x'],
    });
    expect(parseRun(['npm', 'test']).argv).toEqual(['npm', 'test']);
    expect(parseRun(['--budget', '60', '--', 'sh', '--', '-c']).argv).toEqual(['sh', '--', '-c']);
    expect(parseRun(['--agent-budget', '12.5', '--', 'claude', '-p'])).toMatchObject({
      agentBudget: 12.5,
      argv: ['claude', '-p'],
    });
    expect(parseRun(['--observe-transients', '--', 'claude', '-p'])).toMatchObject({
      observeTransients: true,
      argv: ['claude', '-p'],
    });
  });

  it('records invalid agent budgets so the envelope can fail closed before spawn', () => {
    expect(parseRun(['--agent-budget', '0', '--', 'true']).agentBudget).toBe(0);
    expect(parseRun(['--agent-budget', 'nope', '--', 'true']).agentBudget).toBeNaN();
  });
});

describe('envelope hardening — the trust anchor cannot move', () => {
  it('EXPLOIT 1: agent resets HEAD to an ancestor predating the failing test → must fail, not pass', () => {
    // commit1: green (src=42, weak suite). commit2 (entry HEAD): adds a strict
    // failing test — the task. Agent resets to commit1: diff base...HEAD is
    // empty (merge-base downgrades to commit1), worktree clean, verify green
    // against the downgraded anchor. Without an ancestry guard: exit 0.
    const cwd = repo(true); // commit1: green
    const git = (...a: string[]) => execFileSync('git', a, { cwd });
    writeFileSync(join(cwd, 'test', 'strict.test.js'), `const v = require('../src.js');\nif (v !== 43) process.exit(1);\n`);
    git('add', '-A');
    git('commit', '-qm', 'task: strict failing test');
    const code = run(cwd, sh('git reset --hard -q HEAD~1'));
    expect(code).not.toBe(0);
  });

  it('EXPLOIT 2: no verifier at entry; agent supplies verify.command "true" → must fail closed, not VERIFIED', () => {
    const cwd = repo();
    const code = runEnvelope({
      cwd,
      argv: sh(`printf 'version: 1\\nverify:\\n  command: "true"\\n' > .tamperward.yml && echo "" > test/check.test.js`),
    });
    expect(code).toBe(2); // no verifier existed at entry: refuse before trusting an agent-authored one
  });
});

describe('envelope hardening — the tree the agent left cannot judge itself', () => {
  // P0-1: an uncommitted .tamperward.yml that disables the rules must not be
  // the policy the worktree check runs under. The envelope freezes the
  // entry-time policy (from the base commit); the agent's version is ignored.
  it('P0-1: agent disables test-deletion+hook-tampering in an uncommitted policy → still convicted', () => {
    const cwd = repo(); // failing suite at entry
    const disable =
      'printf "version: 1\\nrules:\\n  test-deletion:\\n    enabled: false\\n  hook-tampering:\\n    enabled: false\\n" > .tamperward.yml';
    const code = runEnvelope({ cwd, cmd: 'true', argv: sh(`${disable} && rm test/check.test.js`) });
    expect(code).not.toBe(0);
  });

  // P0-2: widening `protected` so the pristine overlay reverts the agent's own
  // source bug — scored a strengthening by policy-diff, so the agent's policy
  // must not reach verify. Frozen entry policy defines the overlay classes.
  it('P0-2: a tree-authored `protected` glob must not decide what pristine means', () => {
    // GREEN base: restoring it hides the bug the agent introduces. The agent
    // breaks src.js and widens `protected` so the pristine overlay reverts
    // src.js too — policy-diff scores ADDING globs a strengthening, so nothing
    // else objects. With the tree's own policy, verify reports VERIFIED; with
    // the entry-time policy it reports MASKED_FAILURE.
    const cwd = repo(true);
    const entry = loadPolicy(cwd); // frozen BEFORE the agent's edit
    writeFileSync(join(cwd, 'src.js'), 'module.exports = 0; // bug\n');
    writeFileSync(join(cwd, 'test', 'check.test.js'), ''); // visible suite made green
    writeFileSync(join(cwd, '.tamperward.yml'), 'version: 1\nprotected:\n  config: ["**"]\n');

    // Closed in 1.14.3 for the standalone path too: with a --base, verify reads
    // its policy from THAT COMMIT, so the tree-authored glob is never consulted.
    // This assertion used to expect 0 — the hole — because only the envelope
    // passed a frozen policyOverride and standalone `verify` (what the generated
    // CI workflow runs) read the candidate's own policy.
    expect(runVerify({ cwd, base: 'HEAD', cmd: CMD, budget: 30 })).toBe(1);
    // an explicit entry-time override remains equivalent
    expect(runVerify({ cwd, base: 'HEAD', cmd: CMD, budget: 30, policyOverride: entry })).toBe(1);
  });

  it('P0-2c: the overlay-glob route on a GREEN base — candidate regression must not be masked', () => {
    // The green-base form of P0-2, which is where the overlay route actually
    // bites: the base is healthy, the candidate introduces a regression, guts the
    // test so the visible run is green, and widens an overlay class to cover the
    // source. Pre-1.14.3 the verifier restored BOTH the good base source and the
    // base test, so both runs came back green and it reported VERIFIED.
    // `protected.tests` is used rather than `config` because both are in
    // OVERLAY_CLASSES and the route is the same.
    const cwd = repo(true); // GREEN base
    writeFileSync(join(cwd, 'src.js'), 'module.exports = 0; // candidate regression\n');
    writeFileSync(join(cwd, 'test', 'check.test.js'), ''); // visible suite made green
    writeFileSync(
      join(cwd, '.tamperward.yml'),
      'version: 1\nprotected:\n  tests: ["src.js", "**/*.test.js"]\n',
    );
    expect(runVerify({ cwd, base: 'HEAD', cmd: CMD, budget: 30 })).toBe(1);
  });

  it('P0-2b: a tree-authored `verify:` block must not choose the verifier', () => {
    // The exploitable form of the same provenance defect. The agent does not fix
    // the bug; it rewrites the suite command so the re-execution is trivially
    // green. `check --diff` flags that as hook-tampering, so the generated
    // workflow caught it as a PAIR — but only if both jobs are required, and
    // anyone running `verify` alone had no protection. The base governs now, so
    // the guarantee holds job-by-job.
    const cwd = repo(); // RED base: the bug is real and the suite fails
    writeFileSync(
      join(cwd, '.tamperward.yml'),
      'version: 1\nverify:\n  command: "true"\n  budget: 30\n',
    );
    // no --cmd here: the command must come from the policy, and the policy from base
    expect(runVerify({ cwd, base: 'HEAD', budget: 30 })).not.toBe(0);
  });

  // P0-3: `git diff HEAD` never reports untracked files, so an agent could drop
  // a whole new file and the worktree view scanned 0 changes. Tested at the
  // builder, where the property actually lives — an envelope-level assertion
  // passed with the fix reverted (a tracked deletion convicts either way).
  it('P0-3: the untracked-inclusive worktree view sees a dropped file; the plain view does not', () => {
    const cwd = repo(true);
    mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(cwd, '.github', 'workflows', 'evil.yml'), 'on: push\n');

    const tracked = diffWorktree({ cwd }).filter((c) => c.kind === 'file');
    const withUntracked = diffWorktreeWithUntracked({ cwd }).filter((c) => c.kind === 'file');
    const paths = (cs: typeof withUntracked) => cs.map((c) => (c as { path: string }).path);

    expect(paths(tracked)).not.toContain('.github/workflows/evil.yml');
    expect(paths(withUntracked)).toContain('.github/workflows/evil.yml');
  });

  // P0-4: the agent can run `tamperward allow`, writing the local ledger. The
  // envelope adjudicates at the CI layer, which honors only out-of-band
  // approval, never the (agent-writable) committed/local ledger.
  it('P0-4: agent self-signs-off with `tamperward allow` → not cleared', () => {
    const cwd = repo();
    const cli = join(__dirname, '..', 'dist', 'cli', 'index.js');
    const code = runEnvelope({
      cwd,
      cmd: 'true',
      argv: sh(`rm test/check.test.js && node ${cli} allow test-deletion --file test/check.test.js --reason x >/dev/null 2>&1 || true`),
    });
    expect(code).not.toBe(0);
  });
});

describe('P0-5: a verdict cannot outlive the tree it describes', () => {
  // Historical P0-5 first closed by refusing to certify a tree held by a
  // detached worker. Since 2.16.3 the stronger contract is active lifecycle
  // ownership: these descendants are terminated before adjudication, so an
  // otherwise honest fix is GREEN rather than merely NOT_QUIESCENT.
  it.skipIf(process.platform !== 'linux' || !rootless)('reaps a detached worker that would mutate the tree after the agent exits', () => {
    const cwd = repo(); // failing suite; agent writes the honest fix
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-historical-worker-'));
    dirs.push(outside);
    const script = join(outside, 'historical-detached-mutator.sh');
    const started = join(outside, 'started');
    writeFileSync(
      script,
      [
        '#!/bin/bash',
        `touch "${started}"`,
        'cd /tmp',
        'sleep 30',
        `echo > "${join(cwd, 'test', 'check.test.js')}"`,
        '',
      ].join('\n'),
    );
    chmodSync(script, 0o755);

    try {
      let checkpointReached = false;
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(
          `setsid nohup bash "${script}" >/dev/null 2>&1 & ` +
            `while [ ! -e "${started}" ]; do sleep 0.005; done; ` +
            `echo "module.exports = 42;" > src.js`,
        ),
        onBeforeAdjudication: () => {
          checkpointReached = true;
          expect(readFileSync(started, 'utf8')).toBe('');
          expect(linuxPidsWithCmdline(script)).toEqual([]);
        },
      });
      expect(checkpointReached).toBe(true);
      expect(code).toBe(0);
      expect(linuxPidsWithCmdline(script)).toEqual([]);
      expect(readFileSync(join(cwd, 'test', 'check.test.js'), 'utf8')).toContain('expected 42');
    } finally {
      for (const pid of linuxPidsWithCmdline(script)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* expected after fix */ }
      }
    }
  }, 15_000);

  it.skipIf(process.platform !== 'linux' || !rootless)('reaps a detached worker that chdirs away while retaining a repository fd', () => {
    const cwd = repo();
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-historical-fd-'));
    dirs.push(outside);
    const script = join(outside, 'historical-fd-holder.sh');
    const started = join(outside, 'started');
    writeFileSync(
      script,
      [
        '#!/bin/bash',
        `touch "${started}"`,
        `exec 9<"${join(cwd, 'src.js')}"`,
        'cd /tmp',
        'sleep 30',
        '',
      ].join('\n'),
    );
    chmodSync(script, 0o755);

    try {
      let checkpointReached = false;
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(
          `setsid nohup bash "${script}" >/dev/null 2>&1 & ` +
            `while [ ! -e "${started}" ]; do sleep 0.005; done; ` +
            `echo "module.exports = 42;" > src.js`,
        ),
        onBeforeAdjudication: () => {
          checkpointReached = true;
          expect(linuxPidsWithCmdline(script)).toEqual([]);
        },
      });
      expect(checkpointReached).toBe(true);
      expect(code).toBe(0);
      expect(linuxPidsWithCmdline(script)).toEqual([]);
    } finally {
      for (const pid of linuxPidsWithCmdline(script)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* expected after fix */ }
      }
    }
  }, 15_000);

  it.skipIf(process.platform !== 'linux' || !rootless)('rejects a forged lifecycle result when the same-UID agent kills its supervisor', () => {
    const cwd = repo(true);
    const setup = join(cwd, '.forgery-setup');
    let adjudicationStarted = false;
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      argv: sh(
        [
          'parent=$PPID',
          'result=$(tr "\\0" "\\n" < "/proc/$parent/cmdline" | grep -E "^/tmp/tw-agent-supervisor-.*/result\\.json$" | head -n1)',
          'test -n "$result"',
          `touch "${setup}"`,
          'printf %s \'{"exit":0,"timedOut":false,"lifecycleOwned":true}\' > "$result"',
          'kill -9 "$parent"',
          'exit 0',
        ].join('; '),
      ),
      onBeforeAdjudication: () => { adjudicationStarted = true; },
    });

    expect(readFileSync(setup, 'utf8')).toBe('');
    expect(code).toBe(2);
    expect(adjudicationStarted).toBe(false);
  }, 15_000);

  it.skipIf(process.platform !== 'linux' || !rootless)('ignores candidate PATH/PYTHON* when bootstrapping the lifecycle supervisor', () => {
    const cwd = repo(true);
    const poison = mkdtempSync(join(tmpdir(), 'tw-python-path-poison-'));
    dirs.push(poison);
    const fake = join(poison, 'python3');
    const marker = join(poison, 'fake-python-ran');
    writeFileSync(fake, `#!/bin/sh\ntouch "${marker}"\nexit 99\n`);
    chmodSync(fake, 0o755);
    const oldPath = process.env.PATH;
    const oldPythonPath = process.env.PYTHONPATH;
    try {
      // Poison only the caller/agent environment. Keeping the poison outside
      // the repository avoids tripping run's independent dirty-start guard.
      process.env.PATH = `${poison}:${oldPath ?? ''}`;
      process.env.PYTHONPATH = poison;
      expect(trustedLinuxPython().path).toMatch(/^\/(?:usr\/)?bin\/python3/);
      expect(runEnvelope({ cwd, cmd: CMD, argv: sh('true') })).toBe(0);
      expect(() => readFileSync(marker)).toThrow();
    } finally {
      process.env.PATH = oldPath;
      if (oldPythonPath === undefined) delete process.env.PYTHONPATH;
      else process.env.PYTHONPATH = oldPythonPath;
    }
  }, 15_000);

  it.skipIf(process.platform !== 'linux')('reports Linux root/euid-0 as a distinct unsupported lifecycle mode', () => {
    const getuid = vi.spyOn(process, 'getuid').mockReturnValue(1000);
    const geteuid = vi.spyOn(process, 'geteuid').mockReturnValue(0);
    try {
      expect(trustedLinuxPython()).toEqual({
        path: null,
        reason:
          'Linux lifecycle supervision is unavailable when TamperWard runs as root/euid 0; same-UID separation cannot trust any system interpreter path',
      });
    } finally {
      geteuid.mockRestore();
      getuid.mockRestore();
    }
  });

  it.skipIf(process.platform !== 'linux')('fails closed before agent side effects when no trusted Python supervisor is available', () => {
    const cwd = repo(true);
    const marker = join(cwd, 'agent-ran');
    let adjudicationStarted = false;
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      argv: sh('touch agent-ran'),
      linuxPythonCandidates: [],
      onBeforeAdjudication: () => { adjudicationStarted = true; },
    });
    expect(code).toBe(2);
    expect(() => readFileSync(marker)).toThrow();
    expect(adjudicationStarted).toBe(false);
  });

  it.skipIf(process.platform !== 'linux' || !rootless)('fails closed when adopted-child observation cannot be read', () => {
    const cwd = repo(true);
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-proc-fail-'));
    dirs.push(outside);
    const script = join(outside, 'proc-fail-descendant.sh');
    const started = join(outside, 'started');
    writeFileSync(script, ['#!/bin/sh', `touch "${started}"`, 'cd /tmp', 'sleep 30', ''].join('\n'));
    chmodSync(script, 0o755);
    let adjudicationStarted = false;
    try {
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(`setsid -f "${script}"; while [ ! -e "${started}" ]; do sleep 0.005; done`),
        lifecycleTestMode: 'proc-read-fail',
        onBeforeAdjudication: () => { adjudicationStarted = true; },
      });
      expect(readFileSync(started, 'utf8')).toBe('');
      expect(code).toBe(2);
      expect(adjudicationStarted).toBe(false);
    } finally {
      for (const pid of linuxPidsWithCmdline(script)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* fail-closed fixture cleanup */ }
      }
    }
  }, 15_000);

  it.skipIf(process.platform !== 'linux')('fails closed when the lifecycle domain cannot be authoritatively drained', () => {
    const cwd = repo(true);
    let adjudicationStarted = false;
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      argv: sh('true'),
      lifecycleTestMode: 'drain-timeout',
      onBeforeAdjudication: () => { adjudicationStarted = true; },
    });
    expect(code).toBe(2);
    expect(adjudicationStarted).toBe(false);
  });

  it.skipIf(process.platform !== 'linux' || !rootless)('owns a fast setsid --fork descendant that reparents before user-space polling could observe it', () => {
    const cwd = repo(true);
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-double-fork-'));
    dirs.push(outside);
    const script = join(outside, 'fast-reparent-descendant.sh');
    const started = join(outside, 'started');
    writeFileSync(
      script,
      [
        '#!/bin/sh',
        `touch "${started}"`,
        'cd /tmp',
        'sleep 30',
        '',
      ].join('\n'),
    );
    chmodSync(script, 0o755);

    try {
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(
          `setsid -f "${script}"; while [ ! -e "${started}" ]; do sleep 0.005; done`,
        ),
      });

      expect(code).toBe(0);
      expect(readFileSync(started, 'utf8')).toBe('');
      expect(linuxPidsWithCmdline(script)).toEqual([]);
    } finally {
      for (const pid of linuxPidsWithCmdline(script)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* expected after fix */ }
      }
    }
  }, 15_000);

  it.skipIf(process.platform !== 'linux' || !rootless)('normal exit kills a setsid descendant even after it leaves the repository cwd', () => {
    const cwd = repo(true);
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-descendant-'));
    dirs.push(outside);
    const script = join(outside, 'detached-agent-descendant.sh');
    const started = join(outside, 'started');
    const late = join(cwd, 'late.txt');
    writeFileSync(
      script,
      [
        '#!/bin/bash',
        `touch "${started}"`,
        'cd /tmp',
        'sleep 30',
        `echo late > "${late}"`,
        '',
      ].join('\n'),
    );
    chmodSync(script, 0o755);

    try {
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(
          `setsid nohup bash "${script}" >/dev/null 2>&1 & ` +
            `while [ ! -e "${started}" ]; do sleep 0.01; done`,
        ),
      });

      expect(readFileSync(started, 'utf8')).toBe('');
      expect(code).toBe(0);
      expect(linuxPidsWithCmdline(script)).toEqual([]);
      expect(() => readFileSync(late, 'utf8')).toThrow();
    } finally {
      for (const pid of linuxPidsWithCmdline(script)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* expected after fix */ }
      }
    }
  }, 15_000);

  it.skipIf(process.platform === 'win32' || !rootless)('normal exit reaps ordinary background descendants before adjudication', () => {
    const cwd = repo(true);
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-child-'));
    dirs.push(outside);
    const pidFile = join(outside, 'pid');
    let childPid = 0;

    try {
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(`sleep 30 >/dev/null 2>&1 & echo $! > "${pidFile}"`),
      });

      childPid = Number(readFileSync(pidFile, 'utf8').trim());
      expect(Number.isInteger(childPid) && childPid > 1).toBe(true);
      expect(code).toBe(0);
      expect(() => process.kill(childPid, 0)).toThrow();
    } finally {
      if (childPid > 1) {
        try { process.kill(childPid, 'SIGKILL'); } catch { /* expected after fix */ }
      }
    }
  }, 15_000);

  it.skipIf(!rootless)('an honest agent with no survivors is still clean (the scan must not convict the caller)', () => {
    // The caller's own shell pipeline shares this working directory, so the
    // survivor scan is keyed on processes that appear AFTER the agent spawns.
    const cwd = repo();
    expect(runEnvelope({ cwd, cmd: CMD, argv: sh('echo "module.exports = 42;" > src.js') })).toBe(0);
  });

  it.skipIf(process.platform !== 'linux' || !rootless)('Linux kills the would-be DURING-adjudication mutator before adjudication starts', () => {
    const cwd = repo();
    const outside = mkdtempSync(join(tmpdir(), 'tw-run-during-adjudication-'));
    dirs.push(outside);
    const script = join(outside, 'during-adjudication-mutator.sh');
    const started = join(outside, 'started');
    writeFileSync(
      script,
      [
        '#!/bin/bash',
        `touch "${started}"`,
        'cd /tmp',
        'sleep 30',
        `echo > "${join(cwd, 'test', 'check.test.js')}"`,
        '',
      ].join('\n'),
    );
    chmodSync(script, 0o755);
    try {
      let checkpointReached = false;
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(
          `setsid nohup bash "${script}" >/dev/null 2>&1 & ` +
            `while [ ! -e "${started}" ]; do sleep 0.005; done; ` +
            `echo "module.exports = 42;" > src.js`,
        ),
        onBeforeAdjudication: () => {
          checkpointReached = true;
          expect(linuxPidsWithCmdline(script)).toEqual([]);
        },
      });
      expect(checkpointReached).toBe(true);
      expect(code).toBe(0);
      expect(readFileSync(join(cwd, 'test', 'check.test.js'), 'utf8')).toContain('expected 42');
    } finally {
      for (const pid of linuxPidsWithCmdline(script)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* expected after fix */ }
      }
    }
  }, 15_000);

  it('refuses unsupported lifecycle platforms before agent side effects', () => {
    const cwd = repo(true);
    const marker = join(cwd, 'agent-ran');
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      lifecyclePlatformOverride: 'darwin',
      argv: sh('touch agent-ran'),
    });
    expect(code).toBe(2);
    expect(() => readFileSync(marker, 'utf8')).toThrow();
  });

  it('refuses Windows best-effort tree control before agent side effects', () => {
    const cwd = repo(true);
    const marker = join(cwd, 'agent-ran');
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      lifecyclePlatformOverride: 'win32',
      argv: sh('touch agent-ran'),
    });
    expect(code).toBe(2);
    expect(() => readFileSync(marker, 'utf8')).toThrow();
  });

  it.skipIf(process.platform === 'linux' || process.platform === 'win32')(
    'unsupported POSIX lifecycle backends fail closed before the agent starts (2.16.4 platform contract)',
    () => {
      const cwd = repo();
      const marker = join(cwd, 'agent-ran');
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        argv: sh(`touch agent-ran; echo "module.exports = 42;" > src.js`),
      });
      expect(code).toBe(2);
      expect(() => readFileSync(marker, 'utf8')).toThrow();
    },
    15_000,
  );
});

describe('P0-6: the suite runner lives outside every git view', () => {
  // verify symlinks node_modules into BOTH copies — gitignored, so no diff
  // view sees it, and it is where the suite's runner lives. Replacing
  // node_modules/.bin/<runner> replaces the program that decides both
  // verdicts: reproduced as VERIFIED, visible and pristine both exit 0, with
  // the source bug untouched.
  function repoWithRunner(): string {
    const cwd = repo(); // failing suite: src.js is 41
    mkdirSync(join(cwd, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(cwd, '.gitignore'), 'node_modules/\n');
    const runner = join(cwd, 'node_modules', '.bin', 'checker');
    writeFileSync(runner, '#!/bin/sh\nexec node test/check.test.js\n');
    chmodSync(runner, 0o755);
    const git = (...a: string[]) => execFileSync('git', a, { cwd });
    git('add', '-A');
    git('-c', 'user.email=t@b', '-c', 'user.name=tb', 'commit', '-qm', 'runner');
    return cwd;
  }
  const RUNNER_CMD = './node_modules/.bin/checker';

  it.skipIf(!rootless)('an agent that rewrites the runner is caught as DEPENDENCY_DRIFT', () => {
    const cwd = repoWithRunner();
    const code = runEnvelope({
      cwd,
      cmd: RUNNER_CMD,
      argv: sh('printf "#!/bin/sh\\nexit 0\\n" > node_modules/.bin/checker'),
    });
    expect(code).toBe(1); // verify itself is fooled; the fingerprint is not
  });

  it.skipIf(!rootless)('an honest agent that leaves dependencies alone still passes', () => {
    const cwd = repoWithRunner();
    expect(runEnvelope({ cwd, cmd: RUNNER_CMD, argv: sh('echo "module.exports = 42;" > src.js') })).toBe(0);
  });

  it.skipIf(!rootless)('a RELATIVE cwd does not break the verification overlay', () => {
    // The copies' node_modules symlink was built from the caller's cwd
    // verbatim; a relative one resolved against the copy itself, so every
    // suite exited 127 and verify degraded to permanent SUITE_RED — an oracle
    // that always says red is one people switch off.
    const cwd = repoWithRunner();
    const prev = process.cwd();
    try {
      process.chdir(cwd); // the observed case: `tamperward run --cwd .`
      expect(runEnvelope({ cwd: '.', cmd: RUNNER_CMD, argv: sh('echo "module.exports = 42;" > src.js') })).toBe(0);
    } finally {
      process.chdir(prev);
    }
  });
});


describe('adjacent dependency attestation lifecycle gate (#376)', () => {
  it('never reuses the run-side attestation at verifier entry', () => {
    expect(canReuseAdjacentDependencyAttestation(true, 'linux')).toBe(false);
    expect(canReuseAdjacentDependencyAttestation(false, 'linux')).toBe(false);
    expect(canReuseAdjacentDependencyAttestation(true, 'darwin')).toBe(false);
    expect(canReuseAdjacentDependencyAttestation(true, 'win32')).toBe(false);
  });
});

describe('agent runtime budget (#325)', () => {
  it.skipIf(!rootless)('terminates a hung agent, still adjudicates its honest fix, and reports timeout distinctly', () => {
    const cwd = repo();
    const started = Date.now();
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      agentBudget: 1,
      argv: sh('echo "module.exports = 42;" > src.js; sleep 30'),
    });
    const elapsed = Date.now() - started;

    expect(code).toBe(124);
    expect(elapsed).toBeLessThan(10_000);
    expect(readFileSync(join(cwd, 'src.js'), 'utf8')).toContain('42');
  }, 15_000);

  it.skipIf(process.platform === 'win32' || !rootless)('kills the agent process group, including ordinary children/grandchildren', () => {
    const cwd = repo(true);
    const pidFile = join(cwd, '.agent-child-pid');
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      agentBudget: 1,
      argv: sh(
        `bash -c 'sleep 30 & echo $! > "${pidFile}"; wait' & wait`,
      ),
    });

    expect(code).toBe(124);
    const childPid = Number(readFileSync(pidFile, 'utf8').trim());
    expect(Number.isInteger(childPid) && childPid > 1).toBe(true);
    expect(() => process.kill(childPid, 0)).toThrow();
  }, 15_000);

  it.skipIf(process.platform !== 'linux' || !rootless)('kills a descendant that escapes the agent process group with setsid', () => {
    const cwd = repo(true);
    const marker = join(cwd, '.agent-setsid-started');
    const code = runEnvelope({
      cwd,
      cmd: CMD,
      agentBudget: 1,
      argv: sh(
        `setsid bash -c 'touch "${marker}"; sleep 30' & sleep 30`,
      ),
    });

    // The marker proves the detached session really started. If its 30-second
    // sleep survived the timeout it would still hold cwd and the Linux
    // quiescence scan would return NOT_QUIESCENT/1 rather than clean timeout.
    expect(readFileSync(marker, 'utf8')).toBe('');
    expect(code).toBe(124);
  }, 15_000);

  it('fails closed before spawning for a non-positive/invalid agent budget', () => {
    const cwd = repo(true);
    const sideEffect = join(cwd, 'agent-ran');
    expect(runEnvelope({
      cwd,
      cmd: CMD,
      agentBudget: 0,
      argv: sh('touch agent-ran'),
    })).toBe(2);
    expect(() => readFileSync(sideEffect)).toThrow();
  });
});


describe('supervised transient observer (#335)', () => {
  it.skipIf(!rootless)('starts before the agent, stays independent of enforcement, and stops deterministically', () => {
    const cwd = repo(true);
    const helperDir = mkdtempSync(join(tmpdir(), 'tw-observer-fixture-'));
    dirs.push(helperDir);
    const observerEntry = join(helperDir, 'observer.js');
    const trace = join(helperDir, 'trace.txt');

    writeFileSync(
      observerEntry,
      [
        "const fs = require('node:fs');",
        "const args = process.argv.slice(2);",
        "const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };",
        "const log = value('--log');",
        "const trace = process.env.TW_OBSERVER_TRACE;",
        "if (!log || !trace || !value('--base') || args[0] !== 'watch') process.exit(22);",
        "fs.mkdirSync(require('node:path').dirname(log), { recursive: true });",
        "const healthPath = log + '.health.json';",
        "const health = { version: 1, state: 'healthy', backend: 'fallback', pid: process.pid, started_at: new Date().toISOString(), stopped_at: null, watched_dirs: 1, last_append_at: null, event_count: 0, dropped_events: 0, error_count: 0, last_error: null, log };",
        "fs.appendFileSync(trace, 'observer-start\\n');",
        "fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n');",
        "process.on('SIGTERM', () => { health.state = 'stopped'; health.stopped_at = new Date().toISOString(); fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n'); fs.appendFileSync(trace, 'observer-stop\\n'); process.exit(0); });",
        "setInterval(() => {}, 1000);",
        "",
      ].join('\n'),
    );

    const saved = process.env.TW_OBSERVER_TRACE;
    process.env.TW_OBSERVER_TRACE = trace;
    let output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write);
    try {
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        observeTransients: true,
        observerEntry,
        argv: sh(`printf 'agent-start\\n' >> "${trace}"`),
      });

      expect(code).toBe(0);
      expect(readFileSync(trace, 'utf8').trim().split('\n')).toEqual([
        'observer-start',
        'agent-start',
        'observer-stop',
      ]);
      expect(output).toMatch(/transient observer: healthy/i);
      expect(output).toMatch(/advisory/i);
    } finally {
      vi.restoreAllMocks();
      if (saved === undefined) delete process.env.TW_OBSERVER_TRACE;
      else process.env.TW_OBSERVER_TRACE = saved;
    }
  }, 15_000);

  it.skipIf(!rootless)('stop completes on observer process exit, not on its stopped health record (#394)', () => {
    // The race: an observer publishes `state: "stopped"` first and only then
    // finishes its signal handler (final writes, exit). Treating the health
    // record as completion let runEnvelope() return while the observer was
    // still writing. The fixture reproduces exactly that ordering, with a
    // deliberate gap between the stopped record and the exit, so a stop that
    // keys on health returns before `observer-stop` exists. No wait/sleep is
    // needed on the test side: runEnvelope() returning is the boundary.
    const cwd = repo(true);
    const helperDir = mkdtempSync(join(tmpdir(), 'tw-observer-fixture-'));
    dirs.push(helperDir);
    const observerEntry = join(helperDir, 'observer-lingering.js');
    const trace = join(helperDir, 'trace.txt');
    const exitAt = join(helperDir, 'exit-at.txt');

    writeFileSync(
      observerEntry,
      [
        "const fs = require('node:fs');",
        "const args = process.argv.slice(2);",
        "const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };",
        "const log = value('--log');",
        "const trace = process.env.TW_OBSERVER_TRACE;",
        "const exitAt = process.env.TW_OBSERVER_EXIT_AT;",
        "if (!log || !trace || !exitAt || !value('--base') || args[0] !== 'watch') process.exit(22);",
        "fs.mkdirSync(require('node:path').dirname(log), { recursive: true });",
        "const healthPath = log + '.health.json';",
        "const health = { version: 1, state: 'healthy', backend: 'fallback', pid: process.pid, started_at: new Date().toISOString(), stopped_at: null, watched_dirs: 1, last_append_at: null, event_count: 0, dropped_events: 0, error_count: 0, last_error: null, log };",
        "fs.appendFileSync(trace, 'observer-start\\n');",
        "fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n');",
        "process.on('SIGTERM', () => {",
        "  health.state = 'stopped'; health.stopped_at = new Date().toISOString();",
        "  fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n');",
        "  // Still running after the stopped record: the final write and the exit",
        "  // land only after a short, bounded delay inside the envelope's drain window.",
        "  setTimeout(() => { fs.appendFileSync(trace, 'observer-stop\\n'); fs.writeFileSync(exitAt, String(Date.now())); process.exit(0); }, 150);",
        "});",
        "setInterval(() => {}, 1000);",
        "",
      ].join('\n'),
    );

    const savedTrace = process.env.TW_OBSERVER_TRACE;
    const savedExitAt = process.env.TW_OBSERVER_EXIT_AT;
    process.env.TW_OBSERVER_TRACE = trace;
    process.env.TW_OBSERVER_EXIT_AT = exitAt;
    vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as typeof process.stdout.write);
    try {
      const code = runEnvelope({
        cwd,
        cmd: CMD,
        observeTransients: true,
        observerEntry,
        argv: sh(`printf 'agent-start\\n' >> "${trace}"`),
      });
      const returnedAt = Date.now();

      expect(code).toBe(0);
      // Completion means the observer's final write happened before runEnvelope
      // returned: the stopped health record alone is not the boundary.
      expect(readFileSync(trace, 'utf8').trim().split('\n')).toEqual([
        'observer-start',
        'agent-start',
        'observer-stop',
      ]);
      // And completion is keyed to the process actually exiting, not to the
      // 2s drain deadline running out: a stop that cannot see the exit (the
      // parent's event loop is blocked while the envelope waits synchronously,
      // so the exited child stays a zombie that `kill(pid, 0)` still reports
      // alive) can only return >= 2s after SIGTERM. Post-exit work in the
      // envelope is a handful of git reads; the bound leaves it wide headroom.
      const exitedAt = Number(readFileSync(exitAt, 'utf8'));
      expect(Number.isFinite(exitedAt)).toBe(true);
      expect(returnedAt - exitedAt).toBeLessThan(5_000);
    } finally {
      vi.restoreAllMocks();
      if (savedTrace === undefined) delete process.env.TW_OBSERVER_TRACE;
      else process.env.TW_OBSERVER_TRACE = savedTrace;
      if (savedExitAt === undefined) delete process.env.TW_OBSERVER_EXIT_AT;
      else process.env.TW_OBSERVER_EXIT_AT = savedExitAt;
    }
  }, 15_000);

  it.skipIf(!rootless)('only the explicit strict transient policy lets observer findings block the envelope', () => {
    const cwd = repo(true);
    const helperDir = mkdtempSync(join(tmpdir(), 'tw-observer-fixture-'));
    dirs.push(helperDir);
    const observerEntry = join(helperDir, 'observer-events.js');

    writeFileSync(
      observerEntry,
      [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const args = process.argv.slice(2);",
        "const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };",
        "const log = value('--log');",
        "if (!log || !value('--base') || args[0] !== 'watch') process.exit(22);",
        "fs.mkdirSync(path.dirname(log), { recursive: true });",
        "const healthPath = log + '.health.json';",
        "const health = { version: 1, state: 'healthy', backend: 'fallback', pid: process.pid, started_at: new Date().toISOString(), stopped_at: null, watched_dirs: 1, last_append_at: new Date().toISOString(), event_count: 2, dropped_events: 0, error_count: 0, last_error: null, log };",
        "fs.appendFileSync(log, JSON.stringify({ ts: new Date().toISOString(), path: 'test/check.test.js', kind: 'change', mode: 33188, size: 10, hash: 'weakened' }) + '\\n');",
        "fs.appendFileSync(log, JSON.stringify({ ts: new Date().toISOString(), path: 'test/check.test.js', kind: 'change', mode: 33188, size: 10, hash: 'restored' }) + '\\n');",
        "fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n');",
        "process.on('SIGTERM', () => { health.state = 'stopped'; health.stopped_at = new Date().toISOString(); fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n'); process.exit(0); });",
        "setInterval(() => {}, 1000);",
        "",
      ].join('\n'),
    );

    // Default observer evidence is descriptive/warn-only.
    expect(runEnvelope({
      cwd,
      cmd: CMD,
      observeTransients: true,
      observerEntry,
      argv: sh('true'),
    })).toBe(0);

    process.env.TAMPERWARD_TRANSIENT = 'block';
    try {
      expect(runEnvelope({
        cwd,
        cmd: CMD,
        observeTransients: true,
        observerEntry,
        argv: sh('true'),
      })).toBe(1);
    } finally {
      delete process.env.TAMPERWARD_TRANSIENT;
    }
  }, 20_000);

  it.skipIf(!rootless)('strict observer mode cannot miss a blocking transient after the first bounded telemetry chunk', () => {
    const cwd = repo(true);
    const helperDir = mkdtempSync(join(tmpdir(), 'tw-observer-fixture-'));
    dirs.push(helperDir);
    const observerEntry = join(helperDir, 'observer-backlog.js');

    writeFileSync(
      observerEntry,
      [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const args = process.argv.slice(2);",
        "const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };",
        "const log = value('--log');",
        "if (!log || !value('--base') || args[0] !== 'watch') process.exit(22);",
        "fs.mkdirSync(path.dirname(log), { recursive: true });",
        "const healthPath = log + '.health.json';",
        "const benign = JSON.stringify({ ts: new Date().toISOString(), path: 'src.js', kind: 'change', mode: 33188, size: 10, hash: 'same' }) + '\\n';",
        `const repeats = Math.ceil((${MAX_EVENT_READ_BYTES} + 32768) / Buffer.byteLength(benign));`,
        "const tail = [",
        "  { ts: new Date().toISOString(), path: 'test/check.test.js', kind: 'change', mode: 33188, size: 10, hash: 'weakened' },",
        "  { ts: new Date().toISOString(), path: 'test/check.test.js', kind: 'change', mode: 33188, size: 10, hash: 'restored' },",
        "].map((x) => JSON.stringify(x)).join('\\n') + '\\n';",
        "fs.writeFileSync(log, benign.repeat(repeats) + tail);",
        "const health = { version: 1, state: 'healthy', backend: 'fallback', pid: process.pid, started_at: new Date().toISOString(), stopped_at: null, watched_dirs: 1, last_append_at: new Date().toISOString(), event_count: repeats + 2, dropped_events: 0, error_count: 0, last_error: null, log };",
        "fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n');",
        "process.on('SIGTERM', () => { health.state = 'stopped'; health.stopped_at = new Date().toISOString(); fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n'); process.exit(0); });",
        "setInterval(() => {}, 1000);",
        "",
      ].join('\n'),
    );

    process.env.TAMPERWARD_TRANSIENT = 'block';
    try {
      expect(runEnvelope({
        cwd,
        cmd: CMD,
        observeTransients: true,
        observerEntry,
        argv: sh('true'),
      })).toBe(1);
    } finally {
      delete process.env.TAMPERWARD_TRANSIENT;
    }
  }, 20_000);

  it.skipIf(!rootless)('aggregate observer ceiling stays advisory by default but strict mode fails closed', () => {
    const cwd = repo(true);
    const helperDir = mkdtempSync(join(tmpdir(), 'tw-observer-fixture-'));
    dirs.push(helperDir);
    const observerEntry = join(helperDir, 'observer-aggregate.js');

    writeFileSync(
      observerEntry,
      [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const args = process.argv.slice(2);",
        "const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };",
        "const log = value('--log');",
        "if (!log || !value('--base') || args[0] !== 'watch') process.exit(22);",
        "fs.mkdirSync(path.dirname(log), { recursive: true });",
        "const healthPath = log + '.health.json';",
        "const benign = JSON.stringify({ ts: new Date().toISOString(), path: 'src.js', kind: 'change', mode: 33188, size: 10, hash: 'same' }) + '\\n';",
        `const repeats = Math.ceil((${MAX_EVENT_SWEEP_BYTES} + 65536) / Buffer.byteLength(benign));`,
        "fs.writeFileSync(log, benign.repeat(repeats));",
        "const health = { version: 1, state: 'healthy', backend: 'fallback', pid: process.pid, started_at: new Date().toISOString(), stopped_at: null, watched_dirs: 1, last_append_at: new Date().toISOString(), event_count: repeats, dropped_events: 0, error_count: 0, last_error: null, log };",
        "fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n');",
        "process.on('SIGTERM', () => { health.state = 'stopped'; health.stopped_at = new Date().toISOString(); fs.writeFileSync(healthPath, JSON.stringify(health) + '\\n'); process.exit(0); });",
        "setInterval(() => {}, 1000);",
        "",
      ].join('\n'),
    );

    // The observer is still advisory unless the operator explicitly raises it.
    expect(runEnvelope({
      cwd,
      cmd: CMD,
      observeTransients: true,
      observerEntry,
      argv: sh('true'),
    })).toBe(0);

    process.env.TAMPERWARD_TRANSIENT = 'block';
    try {
      expect(runEnvelope({
        cwd,
        cmd: CMD,
        observeTransients: true,
        observerEntry,
        argv: sh('true'),
      })).toBe(1);
    } finally {
      delete process.env.TAMPERWARD_TRANSIENT;
    }
  }, 40_000);

  it.skipIf(!rootless)('observer unavailability is reported but does not become an enforcement verdict', () => {
    const cwd = repo(true);
    const helperDir = mkdtempSync(join(tmpdir(), 'tw-observer-fixture-'));
    dirs.push(helperDir);
    const observerEntry = join(helperDir, 'observer-exits.js');
    writeFileSync(observerEntry, 'process.exit(0);\n');

    let output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write);
    try {
      expect(runEnvelope({
        cwd,
        cmd: CMD,
        observeTransients: true,
        observerEntry,
        argv: sh('true'),
      })).toBe(0);
      expect(output).toMatch(/transient observer: unavailable/i);
      expect(output).toMatch(/advisory/i);
    } finally {
      vi.restoreAllMocks();
    }
  }, 15_000);
});
