import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredPolicyFloor, loadPolicy, loadPolicyAt, parsePolicy, PolicyError } from '../src/policy-load';

const invalid = [
  [{ verify: { command: 'npm test', input: ['scripts/**'] } }, 'verify.input'],
  [{ verify: { command: 'npm test', budgets: 30 } }, 'verify.budgets'],
  [{ verify: { command: 'npm test', Backend: 'container' } }, 'verify.Backend'],
  [{ verify: { command: 'npm test', images: 'unused' } }, 'verify.images'],
  [{ signoff: { required: ['block'] } }, 'signoff.required'],
  [{ signoff: { Ledger: 'approvals.jsonl' } }, 'signoff.Ledger'],
  [{ rules: { 'test-skip': { severty: 'block' } } }, 'rules.test-skip.severty'],
  [{ rules: { 'test-skip': { enable: false } } }, 'rules.test-skip.enable'],
  [{ rules: { 'test-skip': { excludes: ['tests/**'] } } }, 'rules.test-skip.excludes'],
] as const;
const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'tw-nested-policy-')); roots.push(root);
  const cwd = join(root, 'repo'); mkdirSync(cwd);
  const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.name', 'h'); git('config', 'user.email', 'h@x');
  return { root, cwd, git };
}

describe('schema-defined nested policy vocabulary (#799)', () => {
  it.each(invalid)('rejects %j with the full key path %s', (raw, path) => {
    expect(() => parsePolicy(raw)).toThrow(PolicyError);
    expect(() => parsePolicy(raw)).toThrow(path);
  });
  it.each(invalid)('uses the same validation for a pinned external floor: %j', (raw, path) => {
    const f = repository(); const file = join(f.root, 'floor.yml'); const bytes = JSON.stringify(raw);
    writeFileSync(file, bytes);
    vi.stubEnv('TAMPERWARD_POLICY_FLOOR', file);
    vi.stubEnv('TAMPERWARD_POLICY_FLOOR_SHA256', createHash('sha256').update(bytes).digest('hex'));
    expect(() => configuredPolicyFloor(f.cwd)).toThrow(path);
  });
  it('rejects the typo from both working-tree and trusted-revision policy loaders', () => {
    const f = repository();
    writeFileSync(join(f.cwd, '.tamperward.yml'), 'verify:\n  command: npm test\n  input: [scripts/**]\n');
    f.git('add', '.'); f.git('commit', '-qm', 'policy');
    expect(() => loadPolicy(f.cwd)).toThrow('verify.input');
    expect(() => loadPolicyAt('HEAD', f.cwd)).toThrow('verify.input');
  });
  it.each(['required_for', 'requiredFor'])('retains the supported signoff spelling %s', key => {
    expect(parsePolicy({ signoff: { [key]: ['warn'], ledger: 'approvals.jsonl' } }).signoff)
      .toEqual({ requiredFor: ['warn'], ledger: 'approvals.jsonl' });
  });
  it('retains unknown rule identifiers and protected categories, not unknown rule fields', () => {
    const p = parsePolicy({ rules: { 'future-rule': { enabled: true, severity: 'warn', exclude: ['fixtures/**'] } }, protected: { custom: ['custom/**'] } });
    expect(p.rules['future-rule']).toEqual({ enabled: true, severity: 'warn', exclude: ['fixtures/**'] });
    expect(p.protected.custom).toEqual(['custom/**']);
    expect(() => parsePolicy({ rules: { 'future-rule': { severity: 'warn', enable: true } } })).toThrow('rules.future-rule.enable');
  });
  it('accepts every defined verifier field and leaves its values intact', () => {
    const verify = { command: 'npm test', budget: 25, inputs: ['scripts/**'], backend: 'container', image: 'example.invalid/verifier@sha256:' + 'a'.repeat(64) };
    expect(parsePolicy({ verify }).verify).toEqual(verify);
  });
});
