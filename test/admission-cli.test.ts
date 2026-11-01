import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { suiteExitAssurance } from '../src/oracle-assurance';
import { guardedMain } from '../src/cli/main';
import { TW_VERSION } from '../src/wiring';

const now = Date.parse('2026-11-01T12:00:00.000Z');
const binding = {
  repository: 'hexrift/tamperward', head: 'a'.repeat(40), base: 'b'.repeat(40), tree: 'c'.repeat(64),
  gate_version: TW_VERSION, policy_hash: 'd'.repeat(64), verifier_hash: 'e'.repeat(64), verdict: 'VERIFIED',
  assurance: 'suite-exit-only', exception: null, audience: 'hexrift/tamperward:merge', nonce: 'request-42/attempt-1',
};
const payload = (b = binding) => ({ schema_version: 2, ...b, issued_at: new Date(now).toISOString(), expires_at: new Date(now + 600_000).toISOString() });
const keyPair = () => generateKeyPairSync('ed25519', { privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const report = (b = binding) => ({
  schema_version: 1, verdict: b.verdict, base: b.base, adjudicated_tree: b.tree,
  command: 'node test/check.test.js', budget_secs: 4, protected_restored: 1, added_protected_removed: 0,
  verifier_backend: { kind: 'local', trust: 'checkpointed-local', available: true },
  dependency_environment: { status: 'none', roots: [] },
  visible: { exit: 0, secs: 1 }, pristine: { exit: b.verdict === 'MASKED_FAILURE' ? 1 : 0, secs: 1 },
  oracle_assurance: suiteExitAssurance(),
  evidence_binding: { head: b.head, base: b.base, tree: b.tree, gate_version: b.gate_version, policy_hash: b.policy_hash, verifier_hash: b.verifier_hash, completed: true, integrity: 'CLEAN' },
});
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('executable suite admission (#801)', () => {
  it('executes opt-in CLI signing and admission with a fresh request nonce', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tw-admission-cli-')); dirs.push(dir);
    const file = (name: string) => join(dir, name), key = keyPair();
    const raw = bytes(report()), current = Date.now();
    writeFileSync(file('payload.json'), JSON.stringify({ ...payload(), issued_at: new Date(current).toISOString(), expires_at: new Date(current + 600_000).toISOString() }));
    writeFileSync(file('result.json'), raw); writeFileSync(file('request.json'), JSON.stringify(binding));
    writeFileSync(file('private.pem'), key.privateKey); writeFileSync(file('public.pem'), key.publicKey);
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true); vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const args = ['attestation', 'sign', '--schema-version', '2', '--payload', file('payload.json'), '--evidence', file('result.json'), '--sha256', sha256(raw), '--key', file('private.pem'), '--out', file('signed.json')];
    expect(guardedMain(args)).toBe(0);
    const admit = ['attestation', 'admit', '--statement', file('signed.json'), '--key', file('public.pem'), '--expect', file('request.json')];
    expect(guardedMain(admit)).toBe(0);
    expect(String(out.mock.calls.at(-1)?.[0])).toContain('suite-exit-only');
    writeFileSync(file('request.json'), JSON.stringify({ ...binding, nonce: 'request-42/attempt-2' }));
    expect(guardedMain(admit)).toBe(2);
    expect(guardedMain(args)).toBe(2);
    expect(guardedMain(args.filter((_, i) => i !== 3 && i !== 4))).toBe(2);
  });

});
