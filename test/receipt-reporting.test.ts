import { afterEach, describe, expect, it, vi } from 'vitest';
import { runReceiptReconcile, reconcileDocument } from '../src/cli/receipt';
import { runVerify, type VerifyOpts } from '../src/cli/verify';
import * as state from '../src/verification-state';
import * as repos from '../src/repo-context';
import { classifyReceipt, receiptEvidenceDigest, receiptFromRecord, reconcile } from '../src/verification-receipt';
import { suiteExitAssurance } from '../src/oracle-assurance';

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

describe('receipt assurance and annotation reporting (#801)', () => {
  it('reports the suite residual in JSON without upgrading a red result', () => {
    const output = prepare();
    const verifier: typeof runVerify = (opts: VerifyOpts) => { opts.onVerdict?.({ verdict: 'SUITE_RED' }); return 1; };
    expect(runReceiptReconcile({ cwd: '/tmp', json: true, runVerifyImpl: verifier })).toBe(1);
    expect(JSON.parse(output())).toMatchObject({ result: 'SUITE_RED', oracle_assurance: suiteExitAssurance() });
  });

  it('labels human reconciliation with the same bounded suite-exit assurance', () => {
    const output = prepare();
    const verifier: typeof runVerify = (opts: VerifyOpts) => { opts.onVerdict?.({ verdict: 'VERIFIED' }); return 0; };
    expect(runReceiptReconcile({ cwd: '/tmp', runVerifyImpl: verifier })).toBe(0);
    expect(output()).toContain('oracle assurance: suite-exit-only');
    expect(output()).toContain(suiteExitAssurance().limitation);
  });

  it('adds receipt assurance without changing the existing digest or rejecting older receipts', () => {
    const record: state.VerificationRecord = { schema_version: 1, verdict: 'VERIFIED', tw_version: '2.49.1', verified_at: '2026-11-01T12:00:00.000Z', binding, inputs: { base_ref: 'HEAD', explicit_base: true, command_source: 'flag', command: 'true', budget_source: 'flag', budget: 1 } };
    const receipt = receiptFromRecord(record);
    expect(receipt.oracle_assurance).toEqual(suiteExitAssurance());
    expect(receipt.evidence_digest).toBe(receiptEvidenceDigest(receipt));
    const { oracle_assurance, ...older } = receipt;
    expect(classifyReceipt(older).disposition).toBe('PRESENT');
    expect(classifyReceipt({ ...receipt, oracle_assurance: { ...oracle_assurance, level: 'external-json-rpc' } }).disposition).toBe('MALFORMED');
    expect(reconcileDocument(reconcile({ verdict: 'SUITE_RED', binding }, classifyReceipt(receipt)))).toMatchObject({ result: 'SUITE_RED', oracle_assurance: suiteExitAssurance() });
  });
});
