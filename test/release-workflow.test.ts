// #420: the publish workflow must be re-entrant and must publish the reviewed bump
// commit. These tests pin the invariants of .github/workflows/release.yml directly:
// the tag and GitHub-release steps converge on re-run independently of whether the
// registry already has the version, the release gate does not re-run the suite that
// exact-head PR CI already ran, `plan` refuses a HEAD that is not the bump commit
// unless a dispatch input says otherwise, and the checkout fetches tags so the
// "Full Changelog" compare link can be computed.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const WF = join(__dirname, '..', '.github', 'workflows', 'release.yml');

interface Step {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function load(): { doc: Record<string, unknown>; steps: Step[] } {
  const doc: unknown = parse(readFileSync(WF, 'utf8'));
  if (!isRecord(doc)) throw new Error('release.yml is not a mapping');
  const jobs = doc.jobs;
  if (!isRecord(jobs) || !isRecord(jobs.publish)) throw new Error('no publish job');
  const raw = jobs.publish.steps;
  if (!Array.isArray(raw)) throw new Error('publish job has no steps');
  const steps: Step[] = [];
  for (const s of raw) {
    if (!isRecord(s)) continue;
    const step: Step = {};
    if (typeof s.name === 'string') step.name = s.name;
    if (typeof s.id === 'string') step.id = s.id;
    if (typeof s.if === 'string') step.if = s.if;
    if (typeof s.uses === 'string') step.uses = s.uses;
    if (typeof s.run === 'string') step.run = s.run;
    if (isRecord(s.with)) step.with = s.with;
    if (isRecord(s.env)) step.env = s.env;
    steps.push(step);
  }
  return { doc, steps };
}

function byId(steps: Step[], id: string): Step {
  const s = steps.find((x) => x.id === id);
  if (!s) throw new Error(`no step with id ${id}`);
  return s;
}

function byName(steps: Step[], re: RegExp): Step {
  const s = steps.find((x) => x.name !== undefined && re.test(x.name));
  if (!s) throw new Error(`no step named ${re}`);
  return s;
}

describe('release.yml re-entrancy (#420)', () => {
  it('plan checks the remote for the tag and the release, independent of the registry', () => {
    const { steps } = load();
    const plan = byId(steps, 'plan');
    expect(plan.run).toMatch(/git ls-remote --tags origin "?refs\/tags\/v\$\{?VERSION\}?"?/);
    expect(plan.run).toContain("tag_missing=");
    expect(plan.run).toMatch(/gh release view/);
    expect(plan.run).toContain("release_missing=");
  });

  it('the tag step is gated on the ls-remote result, not on publish', () => {
    const { steps } = load();
    const tag = byName(steps, /^Tag the published commit$/);
    expect(tag.if).toContain("steps.plan.outputs.tag_missing == 'true'");
    expect(tag.if).not.toContain('publish');
  });

  it('the GitHub release step is gated on the release lookup, not on publish', () => {
    const { steps } = load();
    const rel = byName(steps, /^GitHub release$/);
    expect(rel.if).toContain("steps.plan.outputs.release_missing == 'true'");
    expect(rel.if).not.toContain('publish');
  });

  it('the publish step itself stays gated on the registry check', () => {
    const { steps } = load();
    const pub = byName(steps, /^Publish$/);
    expect(pub.if).toContain("steps.plan.outputs.publish == 'true'");
  });
});

describe('release.yml gate does not re-run the suite (#420)', () => {
  it('has no npm test / vitest step: required PR CI tests the synthetic merge tree', () => {
    const { steps } = load();
    const offenders = steps.filter(
      (s) => s.run !== undefined && /\bnpm (run )?test\b|\bvitest\b/.test(s.run),
    );
    expect(offenders.map((s) => s.name ?? s.run)).toEqual([]);
  });

  it('documents why the suite is not re-run', () => {
    const text = readFileSync(WF, 'utf8');
    expect(text).toMatch(/perf-smoke/);
    expect(text).toMatch(/synthetic merge tree/);
    expect(text).toMatch(/squash\s*\n\s*# merge creates a different commit SHA/i);
    expect(text).toMatch(/does not prove[\s\S]*npm tarball bytes equal the PR test artifact/);
  });
});

describe('release.yml publishes the bump commit (#420)', () => {
  it('plan resolves the bump commit by its VERSION change (#701) and compares it against GITHUB_SHA', () => {
    const { steps } = load();
    const plan = byId(steps, 'plan');
    // The last commit to TOUCH package.json is not the bump commit: a dependency or
    // script edit satisfies it without moving the version (#701).
    expect(plan.run).not.toContain('git log -1 --format=%H -- package.json');
    expect(plan.run).toContain('BUMP_SHA="$(node .github/scripts/bump-commit.mjs)"');
    expect(plan.run).toContain('GITHUB_SHA');
    expect(plan.run).toContain('ALLOW_NON_BUMP_HEAD');
    expect(plan.env).toBeDefined();
    expect(String(plan.env?.ALLOW_NON_BUMP_HEAD)).toContain('inputs.allow_non_bump_head');
  });

  it('exposes a workflow_dispatch input allow_non_bump_head that defaults to false', () => {
    const { doc } = load();
    const on = doc.on;
    if (!isRecord(on) || !isRecord(on.workflow_dispatch)) throw new Error('no workflow_dispatch');
    const inputs = on.workflow_dispatch.inputs;
    if (!isRecord(inputs) || !isRecord(inputs.allow_non_bump_head)) {
      throw new Error('no allow_non_bump_head input');
    }
    expect(inputs.allow_non_bump_head.type).toBe('boolean');
    expect(inputs.allow_non_bump_head.default).toBe(false);
  });
});

describe('release.yml checkout (#420)', () => {
  it('fetches tags and full history so PREV and the bump commit are computable', () => {
    const { steps } = load();
    const checkout = steps.find((s) => s.uses?.startsWith('actions/checkout@'));
    if (!checkout) throw new Error('no checkout step');
    expect(checkout.with?.['fetch-tags']).toBe(true);
    expect(checkout.with?.['fetch-depth']).toBe(0);
  });
});
