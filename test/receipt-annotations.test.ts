import { afterEach, describe, expect, it, vi } from 'vitest';
import { runReceiptReconcile } from '../src/cli/receipt';
import { runVerify, type VerifyOpts } from '../src/cli/verify';
import * as state from '../src/verification-state';
import * as repos from '../src/repo-context';

const binding: state.VerificationBinding = { tree: 'c'.repeat(64), head: 'a'.repeat(40), base: 'b'.repeat(40), policy: 'd'.repeat(64), verifier: 'e'.repeat(64), surface: 'f'.repeat(64), intervention: '0'.repeat(64), dependencies: '1'.repeat(64) };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const prepare = () => {
  vi.spyOn(repos, 'repoContext').mockReturnValue({ root: '/tmp', gitDir: '/tmp/.git' });
  vi.spyOn(state, 'computeBinding').mockReturnValue(binding);
  vi.stubEnv('GITHUB_ACTIONS', 'true'); vi.stubEnv('GITHUB_STEP_SUMMARY', '');
  let output = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => { output += String(chunk); return true; });
  return () => output;
};

describe('receipt reconciliation workflow annotations', () => {
  it('emits exactly one actionable error for an unreadable CI verification result', () => {
    const output = prepare();
    expect(runReceiptReconcile({ cwd: '/tmp', ciResult: '/tmp/tamperward-missing-review-result/ci.json' })).toBe(2);
    const errors = output().split('\n').filter(line => line.startsWith('::error '));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('The CI verify result could not be read.');
  });

  it.each([
    ['SUITE_RED', 1, '::error '], ['MASKED_FAILURE', 0, '::warning '],
  ] as const)('emits a single annotation while preserving %s', (verdict, exit, prefix) => {
    const output = prepare();
    const verifier: typeof runVerify = (opts: VerifyOpts) => { opts.onVerdict?.({ verdict }); return exit; };
    expect(runReceiptReconcile({ cwd: '/tmp', runVerifyImpl: verifier })).toBe(exit);
    expect(output().split('\n').filter(line => line.startsWith(prefix))).toHaveLength(1);
    expect(output()).toContain(verdict);
  });

  it('keeps JSON unannotated without upgrading a red result', () => {
    const output = prepare();
    const verifier: typeof runVerify = (opts: VerifyOpts) => { opts.onVerdict?.({ verdict: 'SUITE_RED' }); return 1; };
    expect(runReceiptReconcile({ cwd: '/tmp', json: true, runVerifyImpl: verifier })).toBe(1);
    expect(JSON.parse(output())).toMatchObject({ result: 'SUITE_RED' });
    expect(output()).not.toContain('::error ');
  });
});
