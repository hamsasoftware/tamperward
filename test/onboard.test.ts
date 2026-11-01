// `tamperward onboard` — the interactive first-run path (#388). The contract under
// test: orchestration over the canonical init / verifier detection / verify /
// doctor primitives with an injected prompt answerer; nothing is written before
// an explicit confirmation; no inferred verifier command is ever written without
// operator acceptance; the demo runs only on disposable state it created and
// leaves the working tree byte-for-byte as it was; non-interactive stdin refuses
// unless scripted; abort and re-run are idempotent and diagnosable.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { readlineAsker, runOnboard, type OnboardIo, type OnboardOpts } from '../src/cli/onboard';
import { RED, YELLOW, CYAN, BOLD } from '../src/cli/render/status';
import type { DoctorOutcome } from '../src/cli/doctor';
import { runInit } from '../src/cli/init';
import { runRuntime } from '../src/cli/runtime';
import { loadPolicy } from '../src/policy-load';
import { treeFingerprint } from '../src/fingerprint';
import { guardedMain } from '../src/cli/main';
import { TW_VERSION } from '../src/wiring';

// Several scenarios run the fixture suite twice through the real verify (npm
// test, ~2s each) after a real init; under a loaded parallel run that exceeds
// vitest's 5s default.
vi.setConfig({ testTimeout: 60_000 });

// The GitHub step reuses doctor's repository inference, which prefers
// GITHUB_REPOSITORY over the origin remote. Under Actions that variable names
// THIS repository, so the fixture's acme/project origin would never be seen;
// scrub it for this file (test/setup.ts only scrubs GITHUB_ACTIONS/STEP_SUMMARY).
const inheritedRepo = process.env.GITHUB_REPOSITORY;
beforeAll(() => { delete process.env.GITHUB_REPOSITORY; });
afterAll(() => { if (inheritedRepo !== undefined) process.env.GITHUB_REPOSITORY = inheritedRepo; });

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** A green JavaScript fixture: `npm test` runs `node test/check.test.js`, whose
 *  first statement is an `it(` block, so the demo has a skip target. */
function repo(opts: { pkg?: boolean; pytest?: boolean; origin?: boolean; commit?: boolean } = {}): string {
  const d = mkdtempSync(join(tmpdir(), 'tw-onboard-'));
  dirs.push(d);
  git(d, 'init', '-q');
  git(d, 'config', 'user.email', 't@b');
  git(d, 'config', 'user.name', 'acme');
  mkdirSync(join(d, 'test'));
  if (opts.pkg !== false) {
    writeFileSync(
      join(d, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { test: 'node test/check.test.js' } }, null, 2) + '\n',
    );
  }
  if (opts.pytest) writeFileSync(join(d, 'pytest.ini'), '[pytest]\n');
  writeFileSync(join(d, 'src.js'), 'module.exports = 42;\n');
  // A real runner (node:test), not a local `it` shim: the test-skip AST path
  // deliberately ignores a locally shadowed runner, so the demo needs the real one.
  writeFileSync(
    join(d, 'test', 'check.test.js'),
    "const { it } = require('node:test');\nconst assert = require('node:assert');\n" +
      "it('returns 42', () => { assert.strictEqual(require('../src.js'), 42); });\n",
  );
  if (opts.origin) git(d, 'remote', 'add', 'origin', 'https://github.com/acme/project.git');
  if (opts.commit !== false) {
    git(d, 'add', '-A');
    git(d, 'commit', '-qm', 'base');
  }
  return d;
}

interface Session {
  code: number;
  out: string;
  err: string;
  questions: string[];
}

/** Drive onboarding with a scripted answerer. `answers` are consumed in order;
 *  a `null` answer models the operator closing stdin (Ctrl-D / Ctrl-C). When the
 *  script runs out, the answer is an empty line (Enter = the default). */
async function onboard(
  cwd: string,
  answers: Array<string | null> = [],
  opts: Partial<OnboardOpts> = {},
  io: Partial<OnboardIo> = {},
): Promise<Session> {
  const questions: string[] = [];
  const queue = [...answers];
  const so = process.stdout.write;
  const se = process.stderr.write;
  let out = '';
  let err = '';
  process.stdout.write = ((chunk: unknown) => { out += String(chunk); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => { err += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    const code = await runOnboard(
      { cwd, ...opts },
      {
        interactive: true,
        ask: async (question: string) => {
          questions.push(question);
          return queue.length ? queue.shift() ?? null : '';
        },
        ...io,
      },
    );
    return { code, out, err, questions };
  } finally {
    process.stdout.write = so;
    process.stderr.write = se;
  }
}

const WIRED = ['.tamperward.yml', '.claude/settings.json', '.git/hooks/pre-commit', '.github/workflows/tamperward.yml', '.github/CODEOWNERS'];
const wired = (d: string): boolean => WIRED.every((f) => existsSync(join(d, f)));
const snapshot = (d: string): Record<string, string> =>
  Object.fromEntries(WIRED.filter((f) => existsSync(join(d, f))).map((f) => [f, readFileSync(join(d, f), 'utf8')]));

describe('happy path', () => {
  it('walks a fresh repository to a diagnosed posture through the canonical primitives', async () => {
    const d = repo();
    // yes: continue past preflight is not asked on a clean tree; the questions are:
    // write the plan? / accept `npm test`? / run first verify? / run the demo? / check GitHub?
    const s = await onboard(d, ['y', 'y', 'y', 'y'], { noGithub: true });
    expect(s.err).toBe('');
    expect(s.out).toContain(`v${TW_VERSION}`);
    expect(s.out).toMatch(/1\/5\s+Environment/);
    // Runtime detection runs before the plan: a fresh repo has no runtime marker
    // yet, so onboarding states the neutral default rather than assuming a runtime.
    expect(s.out).toMatch(/RUNTIME\s+No agent runtime detected/);
    expect(s.out).toMatch(/QUALIFY\s+Runtime capability evidence is not available.*runtime verify --runtime <id>/);
    // The canonical init plan is rendered compactly, then applied silently.
    expect(s.out).toMatch(/ADD\s+Policy\s+\.tamperward\.yml/);
    expect(s.out).toMatch(/Applied 5 setup change\(s\)/);
    expect(wired(d)).toBe(true);
    // The verifier suggestion was accepted explicitly and written to the policy.
    expect(s.questions.some((q) => /npm test/.test(q) && /verifier command/.test(q))).toBe(true);
    expect(loadPolicy(d).verify?.command).toBe('npm test');
    // The first verify ran through runVerify silently and was summarized once.
    expect(s.out).toMatch(/Verification passed — visible and pristine suites are green/);
    expect(s.out).not.toMatch(/tamperward verify — verified/);
    // The demo showed a real finding and restored the tree byte-for-byte.
    expect(s.out).toMatch(/BLOCK\s+test-skip/);
    expect(s.out).toMatch(/restored byte-for-byte/);
    // Doctor is summarized rather than replayed; without an origin GitHub is
    // optional guidance rather than something TamperWard claims is missing.
    expect(s.out).not.toMatch(/tamperward doctor: \[/);
    expect(s.out).toMatch(/READY\s+(Configured with the limitation|TamperWard is configured)/);
    expect(s.out).toMatch(/GitHub authority is not configured for this repository/);
    expect(s.out).toContain('tamperward check --worktree');
    expect(s.out).toContain('tamperward verify --base');
    expect(s.out).toContain('tamperward doctor --github');
    expect(s.out).toMatch(/NEXT\s+Commit repository setup files:/);
    expect(s.out).not.toMatch(/NEXT[^\n]*\.git\/hooks\/pre-commit/);
    expect(s.out).not.toMatch(/ONE STEP LEFT|subreaper\/ECHILD|backend: container/);
    expect(s.code).toBe(0);
  });

  it('shows the canonical local-protection plan without the old installation essay', async () => {
    const d = repo();
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true });
    for (const item of ['Policy', 'In-loop (Claude)', 'Pre-commit', 'CI workflow', 'CODEOWNERS']) {
      expect(s.out).toContain(item);
    }
    expect(s.out).not.toMatch(/What each item is for|ONE STEP LEFT|workflow from its OWN head/);
  });

  it('names a neutral-only runtime and warns that in-loop steering is Claude-only', async () => {
    const d = repo();
    // A Cursor marker with no .claude: the runtime is detected, but in-loop
    // steering does not ship for it yet, so onboarding must say so plainly.
    mkdirSync(join(d, '.cursor'));
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true });
    expect(s.out).toMatch(/RUNTIME\s+Detected Cursor/);
    expect(s.out).toMatch(/NOTE[^\n]*Claude Code only/);
    expect(s.out).toMatch(/QUALIFY\s+Cursor: no shipped qualification adapter/);
    expect(s.out).not.toContain('runtime verify --runtime cursor');
    expect(s.out).not.toMatch(/#(482|602)\b/);
  });
});

describe('runtime qualification in onboarding (#599)', () => {
  // A Claude Code marker committed with the fixture, so detection finds an adapter-backed
  // runtime and the tree stays clean (no preflight prompt before the QUALIFY line).
  function claudeRepo(): string {
    const d = repo({ commit: false });
    writeFileSync(join(d, 'CLAUDE.md'), '# agent notes\n');
    git(d, 'add', '-A');
    git(d, 'commit', '-qm', 'base');
    return d;
  }
  const withVersion = async <T,>(version: string, fn: () => Promise<T> | T): Promise<T> => {
    const prev = process.env.TAMPERWARD_RUNTIME_VERSION;
    process.env.TAMPERWARD_RUNTIME_VERSION = version;
    try {
      return await fn();
    } finally {
      if (prev === undefined) delete process.env.TAMPERWARD_RUNTIME_VERSION;
      else process.env.TAMPERWARD_RUNTIME_VERSION = prev;
    }
  };
  /** Record a real qualification into the fixture's git-local store through the runtime
   *  command itself (its stdout document is swallowed), so onboarding reads a genuine record. */
  const qualify = (cwd: string, version: string): void => {
    const so = process.stdout.write;
    const prev = process.env.TAMPERWARD_RUNTIME_VERSION;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    process.env.TAMPERWARD_RUNTIME_VERSION = version;
    try {
      expect(runRuntime('verify', { cwd, runtime: 'claude-code', json: true })).toBe(0);
    } finally {
      process.stdout.write = so;
      if (prev === undefined) delete process.env.TAMPERWARD_RUNTIME_VERSION;
      else process.env.TAMPERWARD_RUNTIME_VERSION = prev;
    }
  };
  const storeFile = (d: string) => join(d, '.git', 'tamperward', 'runtime-qualification.json');
  const session = (d: string, version: string): Promise<Session> =>
    withVersion(version, () => onboard(d, ['n'], { noGithub: true, skipDemo: true }));

  it('with nothing recorded, points at runtime verify rather than claiming a posture', async () => {
    const d = claudeRepo();
    const s = await session(d, '1.0.0');
    expect(s.out).toMatch(/RUNTIME\s+Detected Claude Code/);
    expect(s.out).toMatch(/QUALIFY\s+Claude Code: run `tamperward runtime verify --runtime claude-code`/);
    expect(s.out).not.toMatch(/in-loop protection (FULL|PARTIAL|NONE)/);
  });

  it('renders the recorded aggregate, evidence id and TamperWard version from the store', async () => {
    const d = claudeRepo();
    qualify(d, '1.0.0');
    const s = await session(d, '1.0.0');
    // Through the real verify path a static adapter declaration grades PARTIAL: onboarding
    // renders the recorded aggregate as-is and never manufactures FULL from a label.
    expect(s.out).toMatch(
      /QUALIFY\s+Claude Code: in-loop protection PARTIAL \(qualified \d{4}-\d{2}-\d{2}T[^,]+, evidence [0-9a-f]{16}, tamperward \d+\.\d+\.\d+\)/,
    );
    expect(s.out).toContain('tamperward runtime status --runtime claude-code');
    expect(s.out).not.toMatch(/QUALIFY\s+Claude Code: run `tamperward runtime verify/);
    expect(s.out).not.toMatch(/STALE|rejected/);
  });

  it('flags a recorded qualification STALE when a load-bearing input changed, naming the input', async () => {
    const d = claudeRepo();
    qualify(d, '1.0.0');
    const s = await session(d, '2.0.0');
    expect(s.out).toMatch(
      /QUALIFY\s+Claude Code: recorded in-loop protection PARTIAL is STALE \(changed: [^)]*runtime[^)]*\); run `tamperward runtime verify --runtime claude-code`/,
    );
    expect(s.out).not.toMatch(/evidence [0-9a-f]{16}/);
  });

  it('treats a stored record that fails validation as unrecorded, with the reason', async () => {
    const d = claudeRepo();
    qualify(d, '1.0.0');
    const store = JSON.parse(readFileSync(storeFile(d), 'utf8'));
    store.records['claude-code'].evidence_id = 'deadbeefdeadbeef';
    writeFileSync(storeFile(d), JSON.stringify(store));
    const s = await session(d, '1.0.0');
    expect(s.out).toMatch(/QUALIFY\s+Claude Code: the stored qualification was rejected \(evidence_id mismatch/);
    expect(s.out).toMatch(/treated as unrecorded; run `tamperward runtime verify --runtime claude-code`/);
    expect(s.out).not.toMatch(/in-loop protection (FULL|PARTIAL|NONE)/);
  });
});

describe('declined writes', () => {
  it('does not claim planned files were written when init returns before applying them', async () => {
    const d = repo();
    const s = await onboard(d, ['y', ''], { noGithub: true, skipDemo: true }, {
      runners: { init: () => 2 },
    });
    expect(s.out).toMatch(/some setup items still need attention|some setup items remain/i);
    expect(s.out).toMatch(/ADD\s+Policy\s+\.tamperward\.yml/);
    expect(s.out).not.toMatch(/NEXT\s+Commit repository setup files:/);
  });

  it('writes nothing when the operator declines the plan and reports an incomplete posture', async () => {
    const d = repo();
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true });
    expect(snapshot(d)).toEqual({});
    expect(s.out).toMatch(/No setup files were changed/i);
    expect(s.out).toMatch(/INCOMPLETE\s+Setup needs/);
    expect(s.code).toBe(1);
  });

  it('defaults to applying the displayed non-destructive setup plan when the operator presses Enter', async () => {
    const d = repo();
    const s = await onboard(d, ['', 'n', ''], { noGithub: true, skipDemo: true });
    expect(wired(d)).toBe(true);
    expect(s.out).toMatch(/Applied 5 setup change/);
  });
});

describe('existing and partial installation', () => {
  it('reports an already wired repository without asking to write, and is idempotent', async () => {
    const d = repo();
    expect(runInit({ cwd: d })).toBe(0);
    writeFileSync(join(d, '.tamperward.yml'), readFileSync(join(d, '.tamperward.yml'), 'utf8') + 'verify:\n  command: npm test\n  budget: 60\n');
    const before = snapshot(d);
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true });
    expect(s.questions.some((q) => /write/i.test(q))).toBe(false);
    expect(s.out).toMatch(/Local protection is already wired/);
    expect(s.out).toMatch(/Trusted test command: npm test/);
    expect(snapshot(d)).toEqual(before);
    expect(s.code).toBe(0);
  });

  it('previews and writes only the missing item of a partial installation', async () => {
    const d = repo();
    expect(runInit({ cwd: d })).toBe(0);
    rmSync(join(d, '.github', 'CODEOWNERS'));
    const policy = readFileSync(join(d, '.tamperward.yml'), 'utf8');
    const s = await onboard(d, ['y', 'n', ''], { noGithub: true, skipDemo: true });
    expect(s.out).toMatch(/ADD\s+CODEOWNERS\s+\.github\/CODEOWNERS/);
    expect(s.out).toMatch(/OK\s+Policy\s+\.tamperward\.yml/);
    expect(existsSync(join(d, '.github', 'CODEOWNERS'))).toBe(true);
    // Declining the verifier suggestion and the manual entry leaves the policy untouched.
    expect(readFileSync(join(d, '.tamperward.yml'), 'utf8')).toBe(policy);
  });
});

describe('verifier configuration is explicit', () => {
  it('never writes the single detected candidate without acceptance', async () => {
    const d = repo();
    const s = await onboard(d, ['y', 'n', ''], { noGithub: true, skipDemo: true });
    expect(loadPolicy(d).verify?.command).toBeUndefined();
    expect(s.out).toMatch(/Verification is not configured|verify\.command was not written/);
    expect(s.out).toMatch(/CI will fail closed/i);
    expect(s.out).toMatch(/ACTION\s+Verification is not configured; choose the trusted test command/);
    expect(s.out).not.toMatch(/ERROR\s+verifier/);
    expect(s.out).toMatch(/INCOMPLETE\s+Setup needs/);
    expect(s.code).toBe(1);
  });

  it('lists ambiguous candidates and writes the operator’s numbered choice', async () => {
    const d = repo({ pytest: true });
    const s = await onboard(d, ['y', '2', 'n'], { noGithub: true, skipDemo: true });
    expect(s.out).toContain('1. npm test');
    expect(s.out).toContain('2. pytest');
    expect(s.questions.some((q) => /Choose 1-2/.test(q))).toBe(true);
    expect(loadPolicy(d).verify?.command).toBe('pytest');
    expect(loadPolicy(d).verify?.budget).toBe(300);
    // The policy file keeps init's commented baseline: the block was merged, not rewritten.
    expect(readFileSync(join(d, '.tamperward.yml'), 'utf8')).toMatch(/^# protected:/m);
  });

  it('accepts a manually typed command when nothing is detected', async () => {
    const d = repo({ pkg: false });
    const s = await onboard(d, ['y', 'node test/check.test.js', 'y'], { noGithub: true, skipDemo: true });
    expect(s.out).toMatch(/No test command was detected automatically/i);
    expect(loadPolicy(d).verify?.command).toBe('node test/check.test.js');
    expect(s.out).toMatch(/Verification passed — visible and pristine suites are green/);
  });

  it('treats a blank manual entry as a skip and leaves the policy bytes untouched', async () => {
    const d = repo({ pkg: false });
    const before = () => readFileSync(join(d, '.tamperward.yml'), 'utf8');
    await onboard(d, ['y'], { noGithub: true, skipDemo: true });
    const written = before();
    const s = await onboard(d, ['   '], { noGithub: true, skipDemo: true });
    expect(before()).toBe(written);
    expect(loadPolicy(d).verify?.command).toBeUndefined();
    expect(s.out).toMatch(/Verification is not configured|verify\.command was not written/);
  });

  it('refuses a symlink policy instead of writing through it to operator state', async () => {
    const d = repo();
    expect(runInit({ cwd: d })).toBe(0);
    const outside = mkdtempSync(join(tmpdir(), 'tw-onboard-outside-policy-'));
    dirs.push(outside);
    const sentinel = join(outside, 'policy.yml');
    const original = 'version: 1\n# operator-owned sentinel\n';
    writeFileSync(sentinel, original);
    rmSync(join(d, '.tamperward.yml'));
    symlinkSync(sentinel, join(d, '.tamperward.yml'));

    // Stub init because this test is specifically the onboarding-owned verifier
    // write boundary; no earlier primitive gets a chance to alter the symlink.
    const s = await onboard(d, ['y', 'y'], { noGithub: true, skipDemo: true }, {
      runners: { init: () => 0 },
    });

    expect(readFileSync(sentinel, 'utf8')).toBe(original);
    expect(s.out).toMatch(/verify\.command was not written/);
    expect(s.out).toMatch(/not a regular file|symlink/i);
  });
});

describe('the first verification is explained without changing verify semantics', () => {
  it('explains SUITE_RED as a red suite, exit 1', async () => {
    const d = repo();
    writeFileSync(join(d, 'src.js'), 'module.exports = 41;\n');
    git(d, 'commit', '-qam', 'break');
    const s = await onboard(d, ['y', 'y', 'y'], { noGithub: true, skipDemo: true });
    expect(s.out).toMatch(/Your test suite is red/);
    expect(s.out).toMatch(/ACTION\s+Your test suite is red|ACTION\s+Verification blocked/);
  });

  it('explains MASKED_FAILURE as a weakened check, exit 1', async () => {
    const d = repo();
    writeFileSync(join(d, 'src.js'), 'module.exports = 41;\n');
    writeFileSync(join(d, 'test', 'check.test.js'), "const { it } = require('node:test');\nit('trivially passes', () => {});\n");
    git(d, 'add', '-A');
    // Onboard is run against the committed base; the weakening is the working tree.
    const s = await onboard(d, ['y', 'y', 'y', 'y'], { noGithub: true, skipDemo: true });
    expect(s.out).toMatch(/existing changed\/untracked path/);
    expect(s.out).toMatch(/Verification blocked — the visible suite passes, but the pristine suite fails/);
    expect(s.out).toMatch(/ACTION\s+Your test suite is red|ACTION\s+Verification blocked/);
  });

  it('explains a cannot-verify result as failing closed, exit 2', async () => {
    const d = repo();
    const verify = () => 2;
    const s = await onboard(d, ['y', 'y', 'y'], { noGithub: true, skipDemo: true }, {
      runners: { verify },
    });
    expect(s.out).toMatch(/Could not verify.*failed closed/i);
    expect(s.out).toMatch(/ERROR\s+Could not verify/);
  });
});

describe('dirty working tree', () => {
  it('warns, asks before continuing, and never stashes or resets user work', async () => {
    const d = repo();
    writeFileSync(join(d, 'src.js'), 'module.exports = 42; // wip\n');
    writeFileSync(join(d, 'scratch.txt'), 'untracked\n');
    const s = await onboard(d, ['y', 'y', 'y', 'y', 'y'], { noGithub: true });
    expect(s.out).toMatch(/existing changed\/untracked path/);
    expect(s.questions[0]).toMatch(/continue/i);
    expect(readFileSync(join(d, 'src.js'), 'utf8')).toBe('module.exports = 42; // wip\n');
    expect(readFileSync(join(d, 'scratch.txt'), 'utf8')).toBe('untracked\n');
    expect(git(d, 'status', '--porcelain')).toContain('src.js');
    expect(s.out).toMatch(/restored byte-for-byte/);
  });

  it('stops when the operator declines to continue on a dirty tree', async () => {
    const d = repo();
    writeFileSync(join(d, 'src.js'), 'module.exports = 42; // wip\n');
    const s = await onboard(d, ['n'], { noGithub: true });
    expect(snapshot(d)).toEqual({});
    expect(s.code).toBe(2);
    expect(s.out).toMatch(/commit or stash/i);
  });
});

describe('installed dependency hygiene', () => {
  it('wires node_modules into .gitignore before the first git add', async () => {
    const d = repo({ commit: false });
    mkdirSync(join(d, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(d, 'node_modules', 'dep', 'index.js'), '// eslint-disable-next-line no-new\n');

    const s = await onboard(d, ['y', 'n', ''], { noGithub: true, skipDemo: true });

    expect(s.out).toMatch(/ADD\s+Git ignore\s+\.gitignore/);
    expect(readFileSync(join(d, '.gitignore'), 'utf8')).toContain('node_modules/');
    expect(s.out).toMatch(/NEXT\s+Commit repository setup files:.*\.gitignore/);

    git(d, 'add', '.');
    expect(git(d, 'ls-files', '--cached', '--', 'node_modules')).toBe('');
    expect(git(d, 'status', '--porcelain', '--', 'node_modules')).toBe('');
  });

  it('the real CLI path stays green after onboard -> git add . on an unborn Node repo', async () => {
    const d = repo({ commit: false });
    mkdirSync(join(d, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(
      join(d, 'node_modules', 'dep', 'index.js'),
      '// eslint-disable-next-line no-new\nconst x = value as unknown as Thing;\n',
    );

    const so = process.stdout.write;
    const se = process.stderr.write;
    let out = '';
    let err = '';
    process.stdout.write = ((chunk: unknown) => { out += String(chunk); return true; }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => { err += String(chunk); return true; }) as typeof process.stderr.write;
    try {
      const onboardCode = await guardedMain([
        'onboard', '--yes', '--cwd', d, '--verify-command', 'npm test', '--skip-demo', '--no-github',
      ]);
      expect(onboardCode).toBe(0);
      expect(out).toMatch(/Git ignore\s+\.gitignore/);

      git(d, 'add', '.');
      expect(git(d, 'ls-files', '--cached', '--', 'node_modules')).toBe('');

      out = '';
      err = '';
      const checkCode = await guardedMain(['check', '--staged', '--cwd', d]);
      expect(checkCode).toBe(0);
      expect(out).not.toMatch(/node_modules/);
      expect(out).not.toMatch(/BLOCK/);
      expect(err).toBe('');
    } finally {
      process.stdout.write = so;
      process.stderr.write = se;
    }
  });
});
describe('first commit guidance', () => {
  it('does not mislabel an unborn repository as a dirty working tree or ask to continue', async () => {
    const d = repo({ commit: false });
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true });

    expect(s.out).toMatch(/No first commit yet; \d+ path\(s\) are not part of a committed baseline/);
    expect(s.out).not.toMatch(/existing changed\/untracked path/);
    expect(s.questions.some((q) => /Continue with the existing working-tree changes/.test(q))).toBe(false);
    expect(s.questions[0]).toMatch(/Apply \d+ setup change/);
    expect(s.out).toMatch(/NEXT\s+Create the initial repository commit before verify or the safe demo/);
  });

  it('skips the safe demo without prompting when HEAD does not exist', async () => {
    const d = repo({ commit: false });
    const s = await onboard(d, ['n'], { noGithub: true });

    expect(s.questions.some((q) => /demo/i.test(q))).toBe(false);
    expect(s.out).toMatch(/SKIP\s+Safe demo becomes available after the first commit/);
    expect(s.out).not.toMatch(/Demo needs at least one commit/);
  });
});

describe('preflight refusals', () => {
  it('refuses outside a git repository', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tw-onboard-nogit-'));
    dirs.push(d);
    const s = await onboard(d, [], { noGithub: true });
    expect(s.code).toBe(2);
    expect(s.err).toMatch(/not (inside )?a git repository/i);
    expect(s.questions).toEqual([]);
  });

  it('refuses a child directory with a compact root-mismatch diagnostic', async () => {
    const parent = repo();
    const child = join(parent, 'test-proj');
    mkdirSync(child);
    writeFileSync(join(child, 'package.json'), JSON.stringify({ name: 'child', scripts: { test: 'node --test' } }) + '\n');

    const s = await onboard(child, [], { noGithub: true });
    expect(s.code).toBe(2);
    expect(s.err).toMatch(/ERROR\s+Repository root mismatch/i);
    expect(s.err).toMatch(/CURRENT\s+/);
    expect(s.err).toMatch(/GIT ROOT\s+/);
    expect(s.err).toContain(parent);
    expect(s.err).toContain(child);
    expect(s.err).toMatch(/NEXT\s+Run `tamperward onboard` from the Git root/i);
    expect(s.err).toMatch(/OR\s+Run `git init` here/i);
    expect(existsSync(join(child, '.tamperward.yml'))).toBe(false);
  });

  it('preserves ANSI colour in preflight errors instead of exposing escape fragments', async () => {
    const parent = repo();
    const child = join(parent, 'test-proj');
    mkdirSync(child);

    const s = await onboard(child, [], { noGithub: true }, { colour: true });
    expect(s.code).toBe(2);
    expect(s.err).toContain(BOLD + RED + 'ERROR');
    expect(s.err).toContain(CYAN + 'GIT ROOT');
    expect(s.err).toContain(YELLOW + 'NEXT');
    expect(s.err).not.toContain('\uFFFD[1m');
    expect(s.err).not.toContain('\uFFFD[38;2;');
  });

  it('accepts a symlink alias that resolves to the repository root', async () => {
    const d = repo();
    const holder = mkdtempSync(join(tmpdir(), 'tw-onboard-root-alias-'));
    dirs.push(holder);
    const alias = join(holder, 'repo');
    symlinkSync(d, alias, 'dir');

    const s = await onboard(alias, ['n'], { noGithub: true, skipDemo: true });
    expect(s.err).toBe('');
    expect(s.out).toMatch(/Local protection/);
    expect(s.code).toBe(1);
  });

  it('presents macOS as a clear run limitation instead of dumping lifecycle internals', async () => {
    const d = repo();
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true }, { platform: 'darwin' });
    expect(s.out).toMatch(/LIMITED\s+macOS: check \+ verify work here; .*run.*requires Linux/);
    expect(s.out.match(/macOS:.*run.*requires Linux/g) ?? []).toHaveLength(1);
    expect(s.out).not.toMatch(/subreaper|ECHILD/);
    expect(s.out).toMatch(/run-lifecycle:.*Linux host/);
    expect(s.out).toMatch(/container-verify:.*Fix the verifier configuration/);
  });

  it('uses colour for interactive status while keeping words as the source of meaning', async () => {
    const d = repo();
    const s = await onboard(d, ['n'], { noGithub: true, skipDemo: true }, { colour: true });
    expect(s.out).toContain(CYAN);
    expect(s.out).toContain('Environment');
    expect(s.out).toMatch(/ACTION|INCOMPLETE/);
  });

  it('strips repository-controlled terminal control bytes from compact output and prompts', async () => {
    const d = repo();
    const pkg = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')) as { scripts: { test: string } };
    pkg.scripts.test = "node test/check.test.js\u001b[2J\nFORGED";
    writeFileSync(join(d, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    git(d, 'add', '-A');
    git(d, 'commit', '-qm', 'hostile display text');

    const s = await onboard(d, ['y', 'n', ''], { noGithub: true, skipDemo: true }, { colour: false });
    expect(s.out).not.toContain('\u001b[2J');
    expect(s.questions.join('\n')).not.toContain('\u001b[2J');
    expect(s.out).not.toContain('\nFORGED');
  });

  it('refuses a non-interactive stdin without a scripted mode, and never hangs', async () => {
    const d = repo();
    const s = await onboard(d, [], { noGithub: true }, { interactive: false });
    expect(s.code).toBe(2);
    expect(s.err).toMatch(/interactive terminal/);
    expect(s.err).toMatch(/--yes/);
    expect(s.questions).toEqual([]);
    expect(snapshot(d)).toEqual({});
  });

  it('scripted mode (--yes) asks nothing, writes the plan, and only writes an EXPLICIT verifier command', async () => {
    const d = repo();
    const s = await onboard(d, [], { noGithub: true, yes: true }, { interactive: false });
    expect(s.questions).toEqual([]);
    expect(wired(d)).toBe(true);
    expect(loadPolicy(d).verify?.command).toBeUndefined();
    expect(s.out).toMatch(/--verify-command/);
    expect(s.code).toBe(1);

    const d2 = repo();
    const s2 = await onboard(d2, [], { noGithub: true, yes: true, verifyCommand: 'npm test' }, { interactive: false });
    expect(s2.questions).toEqual([]);
    expect(loadPolicy(d2).verify?.command).toBe('npm test');
    expect(s2.out).toMatch(/Verification passed — visible and pristine suites are green/);
    // The demo is opt-in under --yes: nothing ran that was not asked for.
    expect(s2.out).not.toMatch(/test-skip/);
    expect(s2.code).toBe(0);
  });

  it('scripted mode runs the demo only with --demo', async () => {
    const d = repo();
    const s = await onboard(d, [], { noGithub: true, yes: true, verifyCommand: 'npm test', demo: true }, { interactive: false });
    expect(s.out).toMatch(/BLOCK\s+test-skip/);
    expect(s.out).toMatch(/restored byte-for-byte/);
  });
});

describe('unsupported platform', () => {
  it('surfaces the support contract and skips local verify without inventing a verdict', async () => {
    const d = repo();
    const calls: unknown[] = [];
    const s = await onboard(d, ['y', 'y', 'y', 'y'], { noGithub: true, skipDemo: true }, {
      platform: 'win32',
      runners: { verify: (o) => { calls.push(o); return 0; } },
    });
    expect(s.out).toMatch(/Windows/);
    expect(s.out).toMatch(/local verify and `run` are unavailable|Local verification is unavailable/);
    expect(calls).toEqual([]);
    expect(s.out).not.toMatch(/VERIFIED: your suite passes/);
  });
});

describe('GitHub authority', () => {
  const manual = (out: string): void => {
    expect(out).toMatch(/required check: tamperward/i);
    expect(out).toMatch(/Code Owner/);
    expect(out).toMatch(/[Dd]ismiss stale/);
  };

  it('prints the exact manual controls and doctor command when no repository can be determined', async () => {
    const d = repo();
    const s = await onboard(d, ['y', 'y', 'n'], { skipDemo: true });
    manual(s.out);
    expect(s.out).toContain('tamperward doctor --github --repo OWNER/REPO --branch <default-branch>');
    expect(s.out).toMatch(/GitHub authority is not configured for this repository/);
    expect(s.out).toMatch(/If this repository will use GitHub CI authority, configure/);
    expect(s.out).not.toMatch(/GitHub still needs three repository controls/);
    expect(s.questions.some((q) => /GitHub/.test(q))).toBe(false);
  });

  it('offers doctor --github when the origin is on github.com and reports an unauthenticated failure honestly', async () => {
    const d = repo({ origin: true });
    const doctorCalls: unknown[] = [];
    const doctor = (o: { github?: boolean; repo?: string; branch?: string }): DoctorOutcome => {
      doctorCalls.push(o);
      return {
        code: 2,
        authoritative: false,
        summary: [],
        checks: [
          { id: 'policy', state: 'OK', detail: 'ok' },
          { id: 'github-authority', state: 'BROKEN', detail: 'cannot inspect GitHub repository authority. Rules API: HTTP 401. Authenticate gh with metadata read' },
        ],
        failure: { id: 'github-authority', message: 'cannot inspect GitHub repository authority. Rules API: HTTP 401. Authenticate gh with metadata read' },
      };
    };
    const s = await onboard(d, ['y', 'y', 'n', 'y'], { skipDemo: true, branch: 'main' }, { runners: { doctor } });
    expect(s.questions.some((q) => /GitHub branch protection/.test(q))).toBe(true);
    expect(doctorCalls).toEqual([{ cwd: d, github: true, repo: 'acme/project', branch: 'main' }]);
    expect(s.out).toMatch(/GitHub authority is not verified yet/);
    expect(s.out).toMatch(/HTTP 401/);
    expect(s.out).toContain('tamperward doctor --github --repo acme/project --branch main');
    manual(s.out);
    expect(s.out).toMatch(/INCOMPLETE\s+Setup needs/);
    expect(s.code).toBe(1);
  });

  it('reports ENFORCED only when doctor --github verified it', async () => {
    const d = repo({ origin: true });
    const doctor = (): DoctorOutcome => ({
      code: 0,
      authoritative: true,
      summary: ['tamperward doctor: GitHub repository authority OK — acme/project#main requires tamperward, Code Owner review, and stale-review dismissal on new pushes.'],
      checks: [
        { id: 'policy', state: 'OK', detail: 'ok' },
        { id: 'github-authority', state: 'OK', detail: 'acme/project#main requires tamperward status, Code Owner review, and stale-review dismissal on new pushes' },
      ],
      github: { repo: 'acme/project', branch: 'main' },
    });
    const s = await onboard(d, ['y', 'y', 'n', 'y'], { skipDemo: true, branch: 'main' }, { runners: { doctor } });
    expect(s.out).toMatch(/GitHub authority enforced/);
    expect(s.out).toMatch(/READY\s+TamperWard is configured/);
    expect(s.code).toBe(0);
  });

  it('--no-github never calls the GitHub API and says the authority is unverified', async () => {
    const d = repo({ origin: true });
    const doctorCalls: Array<{ github?: boolean }> = [];
    const doctor = (o: { github?: boolean }): DoctorOutcome => {
      doctorCalls.push(o);
      return { code: 0, authoritative: true, summary: [], checks: [{ id: 'policy', state: 'OK', detail: 'ok' }] };
    };
    const s = await onboard(d, ['y', 'y', 'n'], { skipDemo: true, noGithub: true }, { runners: { doctor } });
    expect(doctorCalls.map((c) => c.github ?? false)).toEqual([false]);
    expect(s.out).toContain('tamperward doctor --github --repo acme/project --branch <default-branch>');
    expect(s.out).toMatch(/GitHub authority is not verified yet/);
  });
});

describe('posture is derived from doctor', () => {
  it('treats the macOS run limitation as READY WITH WARNINGS, not a broken installation', async () => {
    const d = repo();
    const doctor = (): DoctorOutcome => ({
      code: 0,
      authoritative: false,
      summary: [],
      checks: [
        { id: 'policy', state: 'OK', detail: 'ok' },
        { id: 'verifier', state: 'WARN', detail: 'checkpointed-local verifier' },
        { id: 'platform', state: 'BROKEN', detail: 'darwin: run lifecycle unavailable' },
      ],
    });
    const s = await onboard(d, ['y', 'y', 'n'], { skipDemo: true, noGithub: true }, {
      platform: 'darwin',
      runners: { doctor },
    });
    expect(s.out).toMatch(/LIMITED\s+macOS: .*run.*requires Linux/);
    expect(s.out).toMatch(/READY\s+Configured with the limitation/);
    expect(s.out).not.toMatch(/BLOCKED\s+Fix the broken item/);
    expect(s.code).toBe(0);
  });

  it('READY WITH WARNINGS when doctor completes with warnings only', async () => {
    const d = repo();
    const doctor = (): DoctorOutcome => ({
      code: 0,
      authoritative: true,
      summary: [],
      checks: [
        { id: 'policy', state: 'OK', detail: 'ok' },
        { id: 'verifier', state: 'WARN', detail: 'checkpointed-local verifier' },
      ],
    });
    const s = await onboard(d, ['y', 'y', 'n'], { skipDemo: true, noGithub: true }, { runners: { doctor } });
    expect(s.out).toMatch(/READY\s+Configured with the limitation/);
    expect(s.out).toMatch(/verifier — checkpointed-local verifier/);
    expect(s.code).toBe(0);
  });

  it('BROKEN when doctor completes with a broken check', async () => {
    const d = repo();
    const doctor = (): DoctorOutcome => ({
      code: 0,
      authoritative: false,
      summary: [],
      checks: [
        { id: 'claude-hooks', state: 'BROKEN', detail: 'error: .claude/settings.json exists but is not valid JSON' },
      ],
    });
    const s = await onboard(d, ['y', 'y', 'n'], { skipDemo: true, noGithub: true }, { runners: { doctor } });
    expect(s.out).toMatch(/BLOCKED\s+Fix the broken item/);
    expect(s.out).toMatch(/claude-hooks/);
    expect(s.code).toBe(1);
  });

  it('INCOMPLETE when the real doctor cannot certify (a broken CI envelope)', async () => {
    const d = repo();
    const s0 = await onboard(d, ['y', 'y', 'n'], { skipDemo: true, noGithub: true });
    expect(s0.code).toBe(0);
    const wf = join(d, '.github', 'workflows', 'tamperward.yml');
    writeFileSync(wf, readFileSync(wf, 'utf8').replace(/timeout-minutes: \d+/, 'timeout-minutes: 1'));
    const s = await onboard(d, ['n'], { skipDemo: true, noGithub: true });
    expect(s.out).toMatch(/INCOMPLETE\s+Setup needs/);
    expect(s.out).toMatch(/timeout-minutes 1 is too small/);
    expect(s.code).toBe(1);
  });
});

describe('interrupted and re-run', () => {
  it('an abort at the write prompt leaves nothing written and says how to resume; a re-run completes; a third run is a no-op', async () => {
    const d = repo();
    const aborted = await onboard(d, [null], { skipDemo: true, noGithub: true });
    expect(aborted.code).toBe(2);
    expect(aborted.out).toMatch(/cancelled/i);
    expect(aborted.out).toMatch(/tamperward onboard/);
    expect(aborted.out).toMatch(/tamperward doctor/);
    expect(snapshot(d)).toEqual({});

    const done = await onboard(d, ['y', 'y', 'n'], { skipDemo: true, noGithub: true });
    expect(done.code).toBe(0);
    expect(wired(d)).toBe(true);
    const after = snapshot(d);

    const again = await onboard(d, ['n'], { skipDemo: true, noGithub: true });
    expect(again.code).toBe(0);
    expect(again.out).toMatch(/Local protection is already wired/);
    expect(snapshot(d)).toEqual(after);
  });

  it('an abort between init and the verifier step leaves init’s files in place and the policy untouched', async () => {
    const d = repo();
    const s = await onboard(d, ['y', null], { skipDemo: true, noGithub: true });
    expect(s.code).toBe(2);
    expect(wired(d)).toBe(true);
    expect(loadPolicy(d).verify?.command).toBeUndefined();
    expect(s.out).toMatch(/cancelled/i);
  });
});

describe('the safe demo', () => {
  it('shows a test-skip finding on disposable state and restores the working tree byte-for-byte', async () => {
    const d = repo();
    const before = treeFingerprint(d);
    const s = await onboard(d, ['y', 'y', 'n', 'y'], { noGithub: true });
    expect(s.out).toMatch(/BLOCK\s+test-skip\s+test\/check\.test\.js/);
    expect(s.out).toMatch(/restored byte-for-byte/);
    expect(s.out).toContain(treeFingerprint(d).slice(0, 16));
    // The demo happened after init wrote its files, so the fingerprint moved for
    // that reason only; the test file itself is exactly as committed.
    expect(git(d, 'status', '--porcelain', '--', 'test')).toBe('');
    expect(readFileSync(join(d, 'test', 'check.test.js'), 'utf8')).not.toContain('skip');
    expect(existsSync(join(d, '.git', 'worktrees'))).toBe(false);
    expect(before).not.toBe(treeFingerprint(d)); // init wrote files; the demo did not
  });

  it('is easy to skip and skipping runs nothing', async () => {
    const d = repo();
    const s = await onboard(d, ['y', 'y', 'n', ''], { noGithub: true });
    expect(s.questions.some((q) => /demo/i.test(q))).toBe(true);
    expect(s.out).not.toMatch(/test-skip/);
    expect(s.out).not.toMatch(/test-skip/);
  });

  it('is skipped with an explanation when the repository has no JavaScript test block to skip', async () => {
    const d = repo();
    writeFileSync(join(d, 'test', 'check.test.js'), "require('../src.js');\n");
    git(d, 'commit', '-qam', 'no it blocks');
    const s = await onboard(d, ['y', 'y', 'n', 'y'], { noGithub: true });
    expect(s.out).toMatch(/no .*test block .*to demonstrate/i);
    expect(s.out).not.toMatch(/BLOCK\s+test-skip/);
  });

  it('is skipped without a demo prompt when there is no commit to build disposable state from', async () => {
    const d = repo({ commit: false });
    const s = await onboard(d, ['n'], { noGithub: true });
    expect(s.questions.some((q) => /demo/i.test(q))).toBe(false);
    expect(s.out).toMatch(/Safe demo becomes available after the first commit/i);
    expect(s.out).not.toMatch(/BLOCK\s+test-skip/);
  });

  it('never selects a test-shaped symlink whose write would escape the disposable worktree', async () => {
    const d = repo();
    // Leave no ordinary JS test block for the demo, then add the exact shape
    // that used to be exploitable: the symlink blob begins with "it(", while
    // following it reaches an external sentinel through a second tracked link.
    writeFileSync(join(d, 'test', 'check.test.js'), "require('../src.js');\n");
    const outside = mkdtempSync(join(tmpdir(), 'tw-onboard-outside-demo-'));
    dirs.push(outside);
    const sentinel = join(outside, 'sentinel');
    const original = 'operator-owned\n';
    writeFileSync(sentinel, original);
    symlinkSync(outside, join(d, 'test', 'it('));
    symlinkSync('it(/sentinel', join(d, 'test', 'evil.test.js'));
    git(d, 'add', '-A');
    git(d, 'commit', '-qm', 'symlink-shaped test');

    const s = await onboard(
      d,
      [],
      { noGithub: true, yes: true, verifyCommand: 'npm test', demo: true },
      { runners: { verify: () => 0 } },
    );

    expect(readFileSync(sentinel, 'utf8')).toBe(original);
    expect(s.out).toMatch(/no JavaScript test block .*to demonstrate/i);
    expect(s.out).not.toMatch(/weakening move: test\/evil\.test\.js/);
  });
});

describe('prompting', () => {
  it('readlineAsker answers from the input stream and resolves null when it closes', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    output.resume();
    const ask = readlineAsker(input, output);
    const first = ask('first? ');
    input.write('yes\n');
    expect(await first).toBe('yes');
    const second = ask('second? ');
    input.end();
    expect(await second).toBeNull();
    expect(await ask('third? ')).toBeNull();
  });
});

describe('CLI dispatch', () => {
  const run = async (argv: string[]): Promise<{ code: number; err: string }> => {
    const se = process.stderr.write;
    const so = process.stdout.write;
    let err = '';
    process.stderr.write = ((chunk: unknown) => { err += String(chunk); return true; }) as typeof process.stderr.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      const code = await guardedMain(argv);
      return { code, err };
    } finally {
      process.stderr.write = se;
      process.stdout.write = so;
    }
  };

  it('rejects conflicting or unknown options before touching anything', async () => {
    const d = repo();
    expect((await run(['onboard', '--demo', '--skip-demo', '--cwd', d])).code).toBe(2);
    expect((await run(['onboard', '--bogus', '--cwd', d])).err).toMatch(/unknown option/);
    expect((await run(['onboard', '--verify-command', '--cwd', d])).err).toMatch(/needs a value/);
    expect(snapshot(d)).toEqual({});
  });

  it('refuses under a non-interactive stdin (the test runner) instead of hanging', async () => {
    const d = repo();
    const r = await run(['onboard', '--cwd', d, '--no-github']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/interactive terminal/);
    expect(snapshot(d)).toEqual({});
  });
});
