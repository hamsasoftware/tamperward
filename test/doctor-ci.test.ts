import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GENERATED_CI_MIN_OVERHEAD_RESERVE_SECS,
  GENERATED_CI_TIMEOUT_MINUTES,
  VERIFIER_STAGE_COUNT,
  maxStageBudgetForOuterTimeout,
  requiredVerifierAuthoritySeconds,
} from '../src/verifier-limits';
import { parse } from 'yaml';
import { REPOSITORY_REQUIRED_CHECKS, collectLocalPosture, evaluateGitHubProtection, githubApiInvocation, githubRepoFromRemote, lifecyclePlatformCheck, runDoctor } from '../src/cli/doctor';
import { defaultEventLog, startWatcher } from '../src/cli/watch';
import { defaultPolicy, POLICY_VERSION } from '../src/policy';
import { loadPolicy } from '../src/policy-load';
import { runInit } from '../src/cli/init';
import { rootless } from './rootless';

const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function repo(budget: number): string {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-doctor-ci-'));
  dirs.push(cwd);
  const git = (...args: string[]) => execFileSync('git', args, { cwd });
  git('init', '-q');
  git('config', 'user.email', 't@b');
  git('config', 'user.name', 'tb');
  writeFileSync(
    join(cwd, '.tamperward.yml'),
    `version: 1\nverify:\n  command: npm test\n  budget: ${budget}\n`,
  );
  git('add', '.tamperward.yml');
  git('commit', '-qm', 'trusted policy');
  return cwd;
}

function writeWorkflow(cwd: string, name: string, body: string): void {
  mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'workflows', name), body);
}

function workflow(cwd: string, timeout: string | number | undefined, job = 'ci'): void {
  const timeoutLine = timeout === undefined ? '' : `    timeout-minutes: ${timeout}\n`;
  writeWorkflow(
    cwd,
    'tamperward.yml',
    `name: ci\non: pull_request\njobs:\n  ${job}:\n    runs-on: ubuntu-latest\n${timeoutLine}    steps:\n      - run: tamperward verify --base main\n`,
  );
}

function installedRepo(budget = 300): string {
  const cwd = repo(budget);
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/project.git'], { cwd });
  execFileSync('git', ['config', 'user.name', 'acme'], { cwd });
  expect(runInit({ cwd })).toBe(0);
  return cwd;
}

function capture(fn: () => number): { code: number; out: string; err: string } {
  let out = '';
  let err = '';
  vi.spyOn(process.stdout, 'write').mockImplementation(((s: string | Uint8Array) => {
    out += String(s); return true;
  }) as typeof process.stdout.write);
  vi.spyOn(process.stderr, 'write').mockImplementation(((s: string | Uint8Array) => {
    err += String(s); return true;
  }) as typeof process.stderr.write);
  const code = fn();
  return { code, out, err };
}

describe('CI verifier envelope arithmetic (#331)', () => {
  it('derives the supported stage budget from stage count + reserve, not independent literals', () => {
    expect(VERIFIER_STAGE_COUNT).toBe(2);
    expect(GENERATED_CI_MIN_OVERHEAD_RESERVE_SECS).toBe(3_600);
    expect(GENERATED_CI_TIMEOUT_MINUTES).toBe(360);
    expect(maxStageBudgetForOuterTimeout(GENERATED_CI_TIMEOUT_MINUTES)).toBe(9_000);
    expect(requiredVerifierAuthoritySeconds(9_000)).toBe(18_000 + 3_600);
    expect(requiredVerifierAuthoritySeconds(9_000)).toBeLessThanOrEqual(GENERATED_CI_TIMEOUT_MINUTES * 60);
    expect(requiredVerifierAuthoritySeconds(9_001)).toBeGreaterThan(GENERATED_CI_TIMEOUT_MINUTES * 60);
  });
});

describe('tamperward doctor CI envelope (#331)', () => {
  it('accepts a custom job whose numeric outer timeout covers the trusted two-stage budget + reserve', () => {
    const cwd = repo(9_000);
    workflow(cwd, 360, 'security');
    expect(runDoctor({ cwd, base: 'HEAD' })).toBe(0);
  });

  it('refuses an outer timeout that cannot cover the trusted policy budget', () => {
    const cwd = repo(300);
    workflow(cwd, 10);
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/timeout-minutes.*10.*requires at least 70/i);
  });

  it.each([
    [undefined, /timeout-minutes is missing/i],
    ['nope', /timeout-minutes.*numeric/i],
    ['${{ vars.TIMEOUT }}', /timeout-minutes.*static numeric/i],
    [0, /timeout-minutes.*positive/i],
  ])('refuses missing/malformed timeout %j', (timeout, reason) => {
    const cwd = repo(300);
    workflow(cwd, timeout as string | number | undefined);
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(reason);
  });

  it('uses the trusted base policy rather than a candidate-edited working policy', () => {
    const cwd = repo(9_000);
    workflow(cwd, 360);
    writeFileSync(
      join(cwd, '.tamperward.yml'),
      'version: 1\nverify:\n  command: npm test\n  budget: 1\n',
    );
    expect(runDoctor({ cwd, base: 'HEAD' })).toBe(0);

    workflow(cwd, 100);
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/requires at least 360/i);
  });
  it('discovers custom workflow files when no explicit --workflow is supplied', () => {
    const cwd = repo(300);
    writeWorkflow(
      cwd,
      'security.yaml',
      'name: security\njobs:\n  verify-security:\n    timeout-minutes: 70\n    steps:\n      - run: /usr/local/bin/tamperward verify --base main\n',
    );
    expect(runDoctor({ cwd, base: 'HEAD' })).toBe(0);
  });

  it('validates every discovered verify job and never lets an unrelated roomy job mask an undersized authority', () => {
    const cwd = repo(300);
    writeWorkflow(
      cwd,
      'unrelated.yml',
      'name: unrelated\njobs:\n  roomy:\n    timeout-minutes: 360\n    steps:\n      - run: echo tamperward is installed\n',
    );
    writeWorkflow(
      cwd,
      'verify-a.yml',
      'name: a\njobs:\n  verify-a:\n    timeout-minutes: 70\n    steps:\n      - run: tamperward verify --base main\n',
    );
    writeWorkflow(
      cwd,
      'verify-b.yaml',
      'name: b\njobs:\n  verify-b:\n    timeout-minutes: 10\n    steps:\n      - run: tamperward verify --base main\n',
    );
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/verify-b\.yaml.*verify-b.*timeout-minutes 10/i);
  });

  it('validates all verify jobs in one workflow, not just a convenient sufficient one', () => {
    const cwd = repo(300);
    writeWorkflow(
      cwd,
      'multi.yml',
      'name: multi\njobs:\n  good:\n    timeout-minutes: 70\n    steps:\n      - run: tamperward verify\n  bad:\n    timeout-minutes: 5\n    steps:\n      - run: tamperward verify\n',
    );
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/multi\.yml.*bad.*timeout-minutes 5/i);
  });

  it('fails closed on invalid YAML while discovering workflows', () => {
    const cwd = repo(300);
    writeWorkflow(cwd, 'broken.yml', 'jobs:\n  x: [unterminated\n');
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/broken\.yml.*not valid YAML/i);
  });

  it('fails closed when discovery finds no TamperWard verify job', () => {
    const cwd = repo(300);
    writeWorkflow(
      cwd,
      'build.yml',
      'name: build\njobs:\n  build:\n    timeout-minutes: 360\n    steps:\n      - run: npm test\n',
    );
    const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/no job contains a tamperward verify step/i);
  });

  it('an explicit workflow path validates only that authority, even if another workflow is malformed', () => {
    const cwd = repo(300);
    workflow(cwd, 70);
    writeWorkflow(cwd, 'broken.yml', 'jobs:\n  x: [unterminated\n');
    expect(runDoctor({
      cwd,
      base: 'HEAD',
      workflow: '.github/workflows/tamperward.yml',
    })).toBe(0);
  });
});



describe('doctor authority verdict completeness (#318 follow-up)', () => {
  it('rejects a job-level write permission even when workflow root is contents: read', () => {
    const cwd = installedRepo();
    const rel = join(cwd, '.github', 'workflows', 'tamperward.yml');
    const src = readFileSync(rel, 'utf8');
    writeFileSync(
      rel,
      src.replace(
        '  tamperward:\n    runs-on: ubuntu-latest\n',
        '  tamperward:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n',
      ),
    );

    const checks = collectLocalPosture(cwd, loadPolicyForTest(cwd));
    const permissions = checks.find((x) => x.id === 'workflow-permissions');
    expect(permissions).toMatchObject({ state: 'BROKEN' });
    expect(permissions?.detail).toMatch(/tamperward.*contents.*write/i);
  });

  it('keeps a root write grant broken even if the verify job narrows itself', () => {
    const cwd = installedRepo();
    const rel = join(cwd, '.github', 'workflows', 'tamperward.yml');
    const src = readFileSync(rel, 'utf8');
    writeFileSync(
      rel,
      src
        .replace('permissions:\n  contents: read\n', 'permissions:\n  contents: write\n')
        .replace(
          '  tamperward:\n    runs-on: ubuntu-latest\n',
          '  tamperward:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n',
        ),
    );

    const checks = collectLocalPosture(cwd, loadPolicyForTest(cwd));
    expect(checks.find((x) => x.id === 'workflow-permissions')).toMatchObject({
      state: 'BROKEN',
    });
  });

  it('cannot certify authority under a policy schema newer than this binary understands', () => {
    const cwd = installedRepo();
    writeFileSync(
      join(cwd, '.tamperward.yml'),
      `version: ${POLICY_VERSION + 1}\nverify:\n  command: npm test\n  budget: 300\n`,
    );

    const r = capture(() => runDoctor({ cwd, json: true }));
    expect(r.code).toBe(0);
    const doc = JSON.parse(r.out);
    expect(doc.authoritative).toBe(false);
    expect(doc.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'policy',
        state: 'BROKEN',
        detail: expect.stringMatching(/newer than.*schema/i),
      }),
    ]));
  });

  it.skipIf(!rootless)('uses an explicit custom workflow consistently for timeout, wiring and permission posture', () => {
    const cwd = installedRepo();
    rmSync(join(cwd, '.github', 'workflows', 'tamperward.yml'));
    writeWorkflow(
      cwd,
      'security.yml',
      [
        'name: security',
        'on: pull_request',
        'permissions:',
        '  contents: read',
        'jobs:',
        '  authority:',
        '    runs-on: ubuntu-latest',
        '    timeout-minutes: 70',
        '    steps:',
        '      - run: tamperward verify --base main',
        '',
      ].join('\n'),
    );

    const r = capture(() => runDoctor({
      cwd,
      workflow: '.github/workflows/security.yml',
      json: true,
    }));
    expect(r.code).toBe(0);
    const doc = JSON.parse(r.out);
    expect(doc.authoritative).toBe(true);
    expect(doc.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ci-wiring',
        state: 'OK',
        detail: expect.stringMatching(/security\.yml/i),
      }),
      expect.objectContaining({
        id: 'workflow-permissions',
        state: 'OK',
        detail: expect.stringMatching(/security\.yml/i),
      }),
    ]));
  });

  it('aggregates permissions across every discovered workflow that carries verifier authority', () => {
    const cwd = installedRepo();
    writeWorkflow(
      cwd,
      'secondary.yml',
      [
        'name: secondary',
        'permissions:',
        '  contents: read',
        'jobs:',
        '  verify-secondary:',
        '    permissions:',
        '      contents: write',
        '    runs-on: ubuntu-latest',
        '    timeout-minutes: 70',
        '    steps:',
        '      - run: tamperward verify --base main',
        '',
      ].join('\n'),
    );

    const r = capture(() => runDoctor({ cwd, json: true }));
    expect(r.code).toBe(0);
    const doc = JSON.parse(r.out);
    expect(doc.authoritative).toBe(false);
    expect(doc.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'workflow-permissions',
        state: 'BROKEN',
        detail: expect.stringMatching(/secondary\.yml.*verify-secondary.*contents.*write/i),
      }),
    ]));
  });

  it.skipIf(!rootless)('reports a fully installed canonical repository as authoritative in JSON', () => {
    const cwd = installedRepo();
    const r = capture(() => runDoctor({ cwd, json: true }));
    expect(r.code).toBe(0);
    const doc = JSON.parse(r.out);
    expect(doc).toMatchObject({
      command: 'doctor',
      authoritative: true,
    });
    expect(doc.checks.filter((x: any) => x.state === 'BROKEN')).toEqual([]);
  });
});

describe('GitHub repository ruleset completeness (#478)', () => {
  it('reports missing direct CI checks and bypass actors', () => {
    const findings = evaluateGitHubProtection(
      {
        rules: [{
          type: 'pull_request',
          parameters: {
            require_code_owner_review: true,
            dismiss_stale_reviews_on_push: true,
          },
        }, {
          type: 'required_status_checks',
          parameters: { required_status_checks: [{ context: 'gate' }] },
        }],
        bypassActors: [{ actor_id: 1, actor_type: 'RepositoryRole' }],
      },
      'tamperward',
      ['gate', 'harness-core', 'build'],
    );
    expect(findings).toEqual([
      'require status checks: harness-core, build',
      'remove unintended ruleset bypass actors',
    ]);
  });

  it('accepts the documented CI dependency boundary when every check is required', () => {
    expect(evaluateGitHubProtection(
      {
        rules: [{
          type: 'pull_request',
          parameters: {
            require_code_owner_review: true,
            dismiss_stale_reviews_on_push: true,
          },
        }, {
          type: 'required_status_checks',
          parameters: {
            required_status_checks: [{ context: 'gate' }, { context: 'harness-core' }],
          },
        }],
        bypassActors: [],
      },
      'tamperward',
      ['gate', 'harness-core'],
    )).toEqual([]);
  });
});

describe('REPOSITORY_REQUIRED_CHECKS drift guard against ci.yml (#478)', () => {
  // The required-status ruleset is matched against GitHub check CONTEXTS, which for a
  // matrix job are one per cell ("job (value)") — never the bare job name. A drift
  // between this constant and ci.yml silently turns doctor's posture check into a false
  // authority failure (a bare matrix job name that can never match) or a stale name that
  // no longer exists. This test binds the constant to the workflow so either drift fails
  // here, using the same yaml parser as test/audit-workflow.test.ts.
  const ciWorkflow = parse(
    readFileSync(join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8'),
  ) as { jobs: Record<string, { strategy?: { matrix?: Record<string, unknown[]> } }> };

  // Erase the `as const` literal union so a re-introduced bare matrix name (the drift we
  // guard against) is still comparable rather than a compile-time "no overlap" error.
  const required: readonly string[] = REPOSITORY_REQUIRED_CHECKS;

  /** The check contexts GitHub publishes for a job: one per matrix cell, else the job name. */
  const contextsFor = (job: string): string[] => {
    const matrix = ciWorkflow.jobs[job]?.strategy?.matrix;
    if (!matrix) return [job];
    const keys = Object.keys(matrix).filter((k) => Array.isArray(matrix[k]));
    if (keys.length === 0) return [job];
    let combos: unknown[][] = [[]];
    for (const key of keys) {
      const next: unknown[][] = [];
      for (const combo of combos) for (const value of matrix[key]) next.push([...combo, value]);
      combos = next;
    }
    return combos.map((combo) => `${job} (${combo.join(', ')})`);
  };

  it('lists every non-matrix required check as a real single-job context', () => {
    for (const check of required) {
      if (check.includes('(')) continue; // matrix cell — asserted below
      const def = ciWorkflow.jobs[check];
      expect(def, `required check "${check}" has no matching job in ci.yml`).toBeDefined();
      expect(
        def!.strategy?.matrix,
        `required check "${check}" names a matrix job by its bare name; use the per-cell contexts`,
      ).toBeUndefined();
    }
  });

  it('expands the platform-contract matrix to exactly the required contexts', () => {
    const expected = contextsFor('platform-contract');
    const listed = required.filter(
      (c) => c === 'platform-contract' || c.startsWith('platform-contract ('),
    );
    expect([...listed].sort()).toEqual([...expected].sort());
  });

  it('keeps every matrix-derived required check in step with its job matrix', () => {
    // General guard: for each matrix cell listed, its job's full expansion must be
    // present — so adding a matrix leg (e.g. a new Node) without updating this constant,
    // or vice versa, fails here.
    const byJob = new Map<string, string[]>();
    for (const check of required) {
      const m = check.match(/^(.+) \(.+\)$/);
      if (!m) continue;
      const job = m[1];
      (byJob.get(job) ?? byJob.set(job, []).get(job)!).push(check);
    }
    for (const [job, listed] of byJob) {
      expect(ciWorkflow.jobs[job], `matrix required check for "${job}" has no job in ci.yml`).toBeDefined();
      expect([...listed].sort()).toEqual([...contextsFor(job)].sort());
    }
  });
});

describe('GitHub human-boundary freshness (#332)', () => {
  const healthyRules = [
    {
      type: 'pull_request',
      parameters: {
        require_code_owner_review: true,
        dismiss_stale_reviews_on_push: true,
        require_last_push_approval: false,
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        required_status_checks: [{ context: 'tamperward' }],
      },
    },
  ];

  it('accepts an active ruleset that binds Code Owner approval to the current pushed diff', () => {
    expect(evaluateGitHubProtection({ bypassActors: [], rules: healthyRules })).toEqual([]);
  });

  it('does not treat last-push approval alone as fresh Code Owner approval', () => {
    const rules = structuredClone(healthyRules);
    (rules[0].parameters as Record<string, unknown>).dismiss_stale_reviews_on_push = false;
    (rules[0].parameters as Record<string, unknown>).require_last_push_approval = true;
    const findings = evaluateGitHubProtection({ bypassActors: [], rules });
    expect(findings).toContain('dismiss stale pull request approvals on new pushes');
    expect(findings).not.toContain('require Code Owner review');
  });

  it('accepts equivalent classic branch protection fields', () => {
    expect(evaluateGitHubProtection({ bypassActors: [],
      branchProtection: {
        required_pull_request_reviews: {
          require_code_owner_reviews: true,
          dismiss_stale_reviews: true,
          require_last_push_approval: false,
        },
        required_status_checks: {
          contexts: ['tamperward'],
        },
      },
    })).toEqual([]);
  });

  it('composes effective rules across rulesets and classic branch protection', () => {
    expect(evaluateGitHubProtection({ bypassActors: [],
      rules: [{
        type: 'required_status_checks',
        parameters: { required_status_checks: [{ context: 'tamperward' }] },
      }],
      branchProtection: {
        required_pull_request_reviews: {
          require_code_owner_reviews: true,
          dismiss_stale_reviews: true,
        },
      },
    })).toEqual([]);
  });

  it('reports every missing repository-authority requirement', () => {
    expect(evaluateGitHubProtection({ bypassActors: [], rules: [] })).toEqual([
      'require the tamperward status check',
      'require Code Owner review',
      'dismiss stale pull request approvals on new pushes',
    ]);
  });
});




describe('GitHub doctor transport boundary (#332)', () => {
  it('uses TamperWard own Node executable and a minimal environment, not candidate PATH startup authority', () => {
    const invocation = githubApiInvocation(
      'repos/acme/project/rules/branches/main',
      'secret-token',
    );
    expect(invocation.executable).toBe(process.execPath);
    expect(invocation.args[0]).toBe('-e');
    expect(invocation.args.at(-1)).toBe('repos/acme/project/rules/branches/main');
    expect(invocation.env).toEqual({
      TAMPERWARD_GITHUB_TOKEN: 'secret-token',
      LANG: 'C',
      LC_ALL: 'C',
    });
    expect(invocation.env).not.toHaveProperty('PATH');
    expect(invocation.env).not.toHaveProperty('NODE_OPTIONS');
    expect(invocation.env).not.toHaveProperty('NODE_PATH');
  });
});


describe('GitHub repository inference (#332)', () => {
  it.each([
    ['https://github.com/acme/project.git', 'acme/project'],
    ['git@github.com:acme/project.git', 'acme/project'],
    ['ssh://git@github.com/acme/project.git', 'acme/project'],
  ])('parses %s', (remote, expected) => {
    expect(githubRepoFromRemote(remote)).toBe(expected);
  });

  it('refuses non-GitHub and malformed remotes', () => {
    expect(githubRepoFromRemote('https://gitlab.com/acme/project.git')).toBeNull();
    expect(githubRepoFromRemote('not-a-remote')).toBeNull();
  });
});


describe('doctor transient-observer health (#329)', () => {
  it('reports unavailable distinctly from a healthy observer that saw zero events', () => {
    const cwd = repo(300);
    workflow(cwd, 70);

    const unavailable = capture(() => runDoctor({ cwd, base: 'HEAD' }));
    expect(unavailable.code).toBe(0);
    expect(unavailable.out).toMatch(/transient observer: unavailable/i);
    expect(unavailable.out).toMatch(/zero events.*not evidence/i);

    process.env.TAMPERWARD_WATCH_NO_RECURSIVE = '1';
    const w = startWatcher(cwd, join(cwd, 'events.jsonl'), defaultPolicy());
    try {
      // doctor uses the canonical event log, so this custom observer must not
      // make the canonical channel look healthy.
      const stillUnavailable = capture(() => runDoctor({ cwd, base: 'HEAD' }));
      expect(stillUnavailable.code).toBe(0);
      expect(stillUnavailable.out).toMatch(/transient observer: unavailable/i);
    } finally {
      w.close();
      delete process.env.TAMPERWARD_WATCH_NO_RECURSIVE;
    }
  });

  it('reports canonical healthy observer state without turning it into authority', () => {
    const cwd = repo(300);
    workflow(cwd, 70);
    process.env.TAMPERWARD_WATCH_NO_RECURSIVE = '1';
    const w = startWatcher(cwd, defaultEventLog(cwd), defaultPolicy());
    try {
      const r = capture(() => runDoctor({ cwd, base: 'HEAD' }));
      expect(r.code).toBe(0);
      expect(r.out).toMatch(/transient observer: healthy/i);
      expect(r.out).toMatch(/0 event/i);
      expect(r.out).toMatch(/advisory/i);
    } finally {
      w.close();
      delete process.env.TAMPERWARD_WATCH_NO_RECURSIVE;
    }
  });
});


describe('doctor lifecycle backend posture (#376/#379)', () => {
  it('reports authoritative Linux subreaper readiness only with trusted Python', () => {
    expect(lifecyclePlatformCheck('linux', { path: '/usr/bin/python3' })).toMatchObject({
      id: 'platform',
      state: 'OK',
    });
    expect(lifecyclePlatformCheck('linux', {
      path: null,
      reason: 'no trusted interpreter',
    })).toMatchObject({
      id: 'platform',
      state: 'BROKEN',
    });
  });

  it('surfaces Linux root/euid-0 as an explicit BROKEN operator diagnostic', () => {
    const check = lifecyclePlatformCheck('linux', {
      path: null,
      reason:
        'Linux lifecycle supervision is unavailable when TamperWard runs as root/euid 0; same-UID separation cannot trust any system interpreter path',
    });
    expect(check.state).toBe('BROKEN');
    expect(check.detail).toMatch(/root\/euid 0/i);
    expect(check.detail).toMatch(/same-UID separation/i);
    expect(check.detail).not.toMatch(/missing python/i);
  });

  it('fails doctor posture closed when authoritative run lifecycle is unavailable', () => {
    const mac = lifecyclePlatformCheck('darwin', null);
    expect(mac.state).toBe('BROKEN');
    expect(mac.detail).toMatch(/run fails closed before agent start/i);
    expect(mac.detail).toMatch(/standalone check\/verify remain available/i);

    const win = lifecyclePlatformCheck('win32', null);
    expect(win.state).toBe('BROKEN');
    expect(win.detail).toMatch(/run fails closed before agent start/i);
    expect(win.detail).toMatch(/best-effort/i);
    expect(win.detail).toMatch(/standalone check remains available/i);
    expect(win.detail).toMatch(/local verify.*unsupported/i);
    expect(win.detail).not.toMatch(/#379/);
  });
});

describe('doctor installation posture (#318)', () => {
  it('projects canonical init wiring plus verifier/platform state into named posture checks', () => {
    const cwd = repo(300);
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/project.git'], { cwd });
    execFileSync('git', ['config', 'user.name', 'acme'], { cwd });

    // Policy already contains a verifier; init leaves it intact and wires the
    // remaining local/repository enforcement surfaces canonically.
    expect(runInit({ cwd })).toBe(0);

    const checks = collectLocalPosture(cwd, loadPolicyForTest(cwd));
    const byId = Object.fromEntries(checks.map((x) => [x.id, x]));
    expect(byId.policy.state).toBe('OK');
    expect(byId['claude-hooks'].state).toBe('OK');
    expect(byId['pre-commit'].state).toBe('OK');
    expect(byId['ci-wiring'].state).toBe('OK');
    expect(byId.codeowners.state).toBe('OK');
    expect(byId['workflow-permissions'].state).toBe('OK');
    expect(byId['binary-version'].state).toBe('OK');
    expect(byId.verifier.state).toMatch(/OK|WARN/);
    expect(byId.platform.state).toMatch(/OK|WARN/);
  });

  it('reports missing local enforcement surfaces without mutating them', () => {
    const cwd = repo(300);
    workflow(cwd, 70);
    const before = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
    const checks = collectLocalPosture(cwd, loadPolicyForTest(cwd));
    const byId = Object.fromEntries(checks.map((x) => [x.id, x]));

    expect(byId['claude-hooks'].state).not.toBe('OK');
    expect(byId['pre-commit'].state).not.toBe('OK');
    expect(byId.codeowners.state).not.toBe('OK');
    expect(execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })).toBe(before);
  });

  it('keeps broken doctor results machine-readable under --json', () => {
    const cwd = repo(300);
    workflow(cwd, 10);
    const r = capture(() => runDoctor({ cwd, base: 'HEAD', json: true }));
    expect(r.code).toBe(2);
    expect(r.err).toBe('');
    const doc = JSON.parse(r.out);
    expect(doc.authoritative).toBe(false);
    expect(doc.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ci-verifier',
          state: 'BROKEN',
          detail: expect.stringMatching(/timeout-minutes.*10.*requires at least 70/i),
        }),
      ]),
    );
  });

  it('emits one machine-readable posture report with --json', () => {
    const cwd = repo(300);
    workflow(cwd, 70);
    const r = capture(() => runDoctor({ cwd, base: 'HEAD', json: true }));
    expect(r.code).toBe(0);
    const doc = JSON.parse(r.out);
    expect(doc).toMatchObject({
      command: 'doctor',
      authoritative: false,
    });
    expect(Array.isArray(doc.checks)).toBe(true);
    expect(doc.checks.some((x: any) => x.id === 'ci-verifier' && x.state === 'OK')).toBe(true);
    expect(doc.checks.some((x: any) => x.id === 'claude-hooks')).toBe(true);
    expect(doc.checks.some((x: any) => x.id === 'observer')).toBe(true);
    expect(doc.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'container-verify', state: 'UNVERIFIED' }),
    ]));
    expect(doc.capabilities.find((x: any) => x.id === 'run-lifecycle')?.state)
      .toBe(doc.checks.find((x: any) => x.id === 'platform')?.state === 'OK' ? 'AVAILABLE' : 'BLOCKED');
  });
});

// #547 — doctor loads the repository policy through the same loader as verify.
// An incomplete `verify:` block that declares container posture but omits a usable
// command must fail closed before any posture check with the loader's descriptive
// PolicyError, not survive to a downstream "no verify.command" wiring complaint.
describe('doctor rejects an incomplete verify block before any posture check (#547)', () => {
  const DIGEST = 'sha256:' + 'a'.repeat(64);
  const IMAGE = 'ghcr.io/example/tamperward-verifier@' + DIGEST;

  function repoWithPolicy(body: string): string {
    const cwd = mkdtempSync(join(tmpdir(), 'tw-doctor-547-'));
    dirs.push(cwd);
    const git = (...a: string[]) => execFileSync('git', a, { cwd });
    git('init', '-q');
    git('config', 'user.email', 't@b');
    git('config', 'user.name', 'tb');
    writeFileSync(join(cwd, '.tamperward.yml'), body);
    git('add', '.tamperward.yml');
    git('commit', '-qm', 'policy');
    return cwd;
  }

  it('fails closed with a descriptive PolicyError when a container block omits its command', () => {
    const cwd = repoWithPolicy(`version: 1\nverify:\n  backend: container\n  image: ${IMAGE}\n`);
    const r = capture(() => runDoctor({ cwd }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/verify\.command is required/i);
    // The declared boundary is not silently dropped and then reported as a bare wiring
    // gap: the block is rejected at load, not accepted-and-discarded.
    expect(r.err).not.toMatch(/generated CI cannot verify/i);
  });

  it('rejects a whitespace-only command the same way', () => {
    const cwd = repoWithPolicy('version: 1\nverify:\n  command: "   "\n');
    const r = capture(() => runDoctor({ cwd }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/verify\.command is required/i);
  });
});

function loadPolicyForTest(cwd: string) {
  return loadPolicy(cwd);
}
