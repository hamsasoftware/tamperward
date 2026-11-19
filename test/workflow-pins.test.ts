// #423: the repository's own workflows must meet the supply-chain bar the tool
// enforces on everyone else. Every `uses:` resolves to an immutable commit (a 40-hex
// SHA with the human-readable version alongside it, so Dependabot can move it and a
// reviewer can still read it), the two artifact actions share one version (a v5
// download cannot read a v4 upload across workflows), the publish job fetches nothing
// unpinned from the registry at publish time, a dispatch input is read from the
// environment rather than spliced into JavaScript source, and the root-privileged
// pilot/counted runners neither persist the checkout credential in .git/config nor
// hand GITHUB_TOKEN to the privileged task/agent process.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const DIR = join(__dirname, '..', '.github', 'workflows');
const FILES = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).sort();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

function stepsOf(file: string): Step[] {
  const doc: unknown = parse(readFileSync(join(DIR, file), 'utf8'));
  if (!isRecord(doc) || !isRecord(doc.jobs)) throw new Error(`${file}: no jobs`);
  const out: Step[] = [];
  for (const job of Object.values(doc.jobs)) {
    if (!isRecord(job) || !Array.isArray(job.steps)) continue;
    for (const s of job.steps) {
      if (!isRecord(s)) continue;
      const step: Step = {};
      if (typeof s.name === 'string') step.name = s.name;
      if (typeof s.uses === 'string') step.uses = s.uses;
      if (typeof s.run === 'string') step.run = s.run;
      if (isRecord(s.with)) step.with = s.with;
      if (isRecord(s.env)) step.env = s.env;
      out.push(step);
    }
  }
  return out;
}

function usesLines(file: string): string[] {
  return readFileSync(join(DIR, file), 'utf8')
    .split('\n')
    .filter((l) => /^\s*(-\s+)?uses:\s/.test(l));
}

// owner/repo@<40 hex>  # vX.Y.Z   (the comment is what a human and Dependabot read)
const PINNED = /^\s*(?:-\s+)?uses:\s+[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+\s*$/;

describe('every workflow action is pinned to a commit SHA (#423)', () => {
  it('finds the workflows', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(14);
  });

  for (const file of FILES) {
    it(`${file}: every uses: is <owner>/<repo>@<40-hex sha>  # vN.N.N`, () => {
      const lines = usesLines(file);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(l, `${file}: ${l.trim()}`).toMatch(PINNED);
    });
  }

  it('upload-artifact and download-artifact are on one version everywhere', () => {
    const versions = new Set<string>();
    for (const file of FILES) {
      for (const l of usesLines(file)) {
        const m = /actions\/(?:upload|download)-artifact@[0-9a-f]{40}\s+#\s*(v\d+)\./.exec(l);
        if (m) versions.add(m[1]);
      }
    }
    expect([...versions]).toEqual(['v7']);
  });
});

describe('Dependabot moves the pins (#423)', () => {
  it('.github/dependabot.yml covers github-actions and npm weekly', () => {
    const doc: unknown = parse(readFileSync(join(DIR, '..', 'dependabot.yml'), 'utf8'));
    if (!isRecord(doc) || !Array.isArray(doc.updates)) throw new Error('dependabot.yml has no updates');
    const eco = new Map<string, string>();
    for (const u of doc.updates) {
      if (!isRecord(u) || typeof u['package-ecosystem'] !== 'string') continue;
      const sched = u.schedule;
      eco.set(u['package-ecosystem'], isRecord(sched) && typeof sched.interval === 'string' ? sched.interval : '');
    }
    expect(doc.version).toBe(2);
    expect(eco.get('github-actions')).toBe('weekly');
    expect(eco.get('npm')).toBe('weekly');
  });
});

describe('release.yml fetches nothing unpinned at publish time (#423)', () => {
  const src = readFileSync(join(DIR, 'release.yml'), 'utf8');

  it('does not run npx --yes semver (or any npx) from the registry', () => {
    expect(src).not.toMatch(/npx\s+(--yes\s+)?semver/);
    expect(src).not.toMatch(/\bnpx\s/);
  });

  it('the forward-version guard uses the lock-pinned semver devDependency after npm ci', () => {
    const steps = stepsOf('release.yml');
    const guard = steps.findIndex((s) => s.name === 'Version must move forward');
    const ci = steps.findIndex((s) => s.run !== undefined && /^npm ci\b/.test(s.run.trim()));
    expect(guard).toBeGreaterThan(-1);
    expect(ci).toBeGreaterThan(-1);
    expect(ci, 'npm ci must run before the guard so its semver import resolves').toBeLessThan(guard);
    // The guard delegates to a unit-tested helper (#548) that classifies each
    // registry lookup as present/absent/failure and fails on a failure rather
    // than skip. The semver comparison lives in that helper, still on the
    // lock-pinned devDependency (no npx).
    expect(steps[guard].run).toMatch(/forward-guard\.mjs/);
    const guardSrc = readFileSync(join(DIR, '..', 'scripts', 'forward-guard.mjs'), 'utf8');
    expect(guardSrc).toMatch(/from ['"]semver['"]/);
    expect(guardSrc).toMatch(/includePrerelease:\s*true/);
    expect(guardSrc).not.toMatch(/\bnpx\s/);
    const pkg: unknown = JSON.parse(readFileSync(join(DIR, '..', '..', 'package.json'), 'utf8'));
    const lock: unknown = JSON.parse(readFileSync(join(DIR, '..', '..', 'package-lock.json'), 'utf8'));
    if (!isRecord(pkg) || !isRecord(pkg.devDependencies)) throw new Error('no devDependencies');
    const pinned = pkg.devDependencies.semver;
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    if (!isRecord(lock) || !isRecord(lock.packages)) throw new Error('no lock packages');
    const entry = lock.packages['node_modules/semver'];
    if (!isRecord(entry)) throw new Error('semver is not in the lockfile');
    expect(entry.version).toBe(pinned);
    expect(entry.dev).toBe(true);
    expect(typeof entry.integrity).toBe('string');
  });
});

describe('mine.yml reads the dispatch input from the environment (#423)', () => {
  it('never splices $POOL into node -e source', () => {
    const src = readFileSync(join(DIR, 'mine.yml'), 'utf8');
    expect(src).not.toContain('\'"$POOL"\'');
    expect(src).not.toMatch(/'\s*"\$\{?POOL\}?"\s*'/);
    const sanity = stepsOf('mine.yml').find((s) => s.name !== undefined && /Pool sanity/.test(s.name));
    if (!sanity || sanity.run === undefined) throw new Error('no pool sanity step');
    expect(sanity.run).toMatch(/process\.env\.POOL/);
  });
});

for (const file of ['pilot.yml', 'counted.yml']) {
  describe(`${file}: root-privileged runner does not keep or leak the token (#423)`, () => {
    const steps = stepsOf(file);

    it('checkout does not persist credentials', () => {
      const checkouts = steps.filter((s) => s.uses !== undefined && s.uses.startsWith('actions/checkout@'));
      expect(checkouts.length).toBeGreaterThan(0);
      for (const c of checkouts) expect(c.with?.['persist-credentials']).toBe(false);
    });

    it('GITHUB_TOKEN reaches only steps that call the state script, and never the sudo wrapper', () => {
      const withToken = steps.filter((s) => s.env !== undefined && 'GITHUB_TOKEN' in s.env);
      expect(withToken.length).toBeGreaterThan(0);
      for (const s of withToken) {
        expect(s.run, `${s.name ?? '<unnamed>'} has GITHUB_TOKEN but does not use ci-pilot-state.sh`).toMatch(/ci-pilot-state\.sh/);
      }
      const runner = steps.find((s) => s.run !== undefined && /run\(\)\s*\{\s*sudo/.test(s.run));
      if (!runner || runner.run === undefined) throw new Error('no privileged run() wrapper');
      expect(runner.run).toMatch(/run\(\)\s*\{\s*sudo\s+-E\s+env\s+-u\s+GITHUB_TOKEN\b/);
    });
  });
}
