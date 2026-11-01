import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runVerify } from '../src/cli/verify';
import { computeBinding } from '../src/verification-state';
import { TW_VERSION } from '../src/wiring';
import * as gitProcess from '../src/git/process';

const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const repo = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-evidence-producer-')); dirs.push(cwd);
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(join(cwd, 'source.js'), 'module.exports = 42;\n'); mkdirSync(join(cwd, 'test'));
  writeFileSync(join(cwd, 'test', 'check.test.js'), "if(require('../source.js')!==42)process.exit(1);\n");
  git('add', '-A'); git('commit', '-qm', 'base');
  return { cwd, git };
};
const capture = () => {
  let output = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => { output += String(chunk); return true; });
  return () => JSON.parse(output);
};

describe('completed verification producer identity (#801)', () => {
  it('refuses completed evidence when the bounded candidate identity read fails', () => {
    const { cwd } = repo(), output = capture();
    vi.spyOn(gitProcess, 'readTrustedGit').mockImplementation(() => { throw new Error('Git read deadline exceeded'); });
    const stage = vi.fn(() => ({ exit: 0, secs: 0 }));
    expect(runVerify({ cwd, base: 'HEAD', cmd: 'node source.js', budget: 4, json: true, runStage: stage })).toBe(2);
    expect(output()).toMatchObject({ verdict: 'CANNOT_VERIFY', reason: 'BASE_UNRESOLVABLE' });
    expect(output()).not.toHaveProperty('evidence_binding');
    expect(stage).not.toHaveBeenCalled();
  }, 30_000);

  it('fails closed with JSON evidence when the candidate HEAD cannot be resolved', () => {
    const { cwd, git } = repo(), base = git('rev-parse', 'HEAD'), output = capture();
    writeFileSync(join(cwd, '.git', 'HEAD'), 'ref: refs/heads/no-candidate-head\n');
    const stage = vi.fn(() => ({ exit: 0, secs: 0 }));
    expect(runVerify({ cwd, base, cmd: 'node source.js', budget: 4, json: true, runStage: stage })).toBe(2);
    expect(output()).toMatchObject({ verdict: 'CANNOT_VERIFY', reason: 'BASE_UNRESOLVABLE' });
    expect(output()).not.toHaveProperty('evidence_binding');
    expect(stage).not.toHaveBeenCalled();
  }, 30_000);

  it('binds a completed result to the candidate, policy and verifier actually used', () => {
    const { cwd } = repo(), output = capture(), command = 'node test/check.test.js';
    expect(runVerify({ cwd, base: 'HEAD', cmd: command, budget: 4, json: true })).toBe(0);
    const actual = computeBinding(cwd, { base_ref: 'HEAD', explicit_base: true, command_source: 'flag', command, budget_source: 'flag', budget: 4 });
    expect(output().evidence_binding).toEqual({ head: actual.head, base: actual.base, tree: actual.tree, policy_hash: actual.policy, verifier_hash: actual.verifier, gate_version: TW_VERSION, completed: true, integrity: 'CLEAN' });
  }, 30_000);
});
