import { afterEach, describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signAdmissionVerdict, admitVerdict, type AdmissionBinding } from '../src/admission-evidence';
import { suiteExitAssurance } from '../src/oracle-assurance';
import { runVerify } from '../src/cli/verify';
import { computeBinding } from '../src/verification-state';
import { TW_VERSION } from '../src/wiring';

const now = Date.parse('2026-11-01T12:00:00.000Z');
const binding: AdmissionBinding = {
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
  ...(b.exception ? { oob_signoff: b.exception.approval } : {}),
});
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const signReport = (key: ReturnType<typeof keyPair>, b = binding, value: unknown = report(b)) => {
  const raw = bytes(value);
  return signAdmissionVerdict(payload(b), raw, sha256(raw), key.privateKey, now);
};
const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('signed suite admission evidence (#801)', () => {
  it('signs the completed producer identity, stage results and assurance for an independent request', () => {
    const key = keyPair(), signed = signReport(key);
    expect(admitVerdict(signed, key.publicKey, binding, now)).toMatchObject({
      ...payload(), evidence_sha256: sha256(bytes(report())),
      oracle_assurance: suiteExitAssurance(), stages: { candidate: 'PASS', pristine: 'PASS', integrity: 'CLEAN' },
    });
    const definition = JSON.parse(readFileSync(join(__dirname, '../schemas/signed-verdict-v2.schema.json'), 'utf8'));
    expect(definition.$id).toBe('https://raw.githubusercontent.com/hexrift/tamperward/v2.51.0/schemas/signed-verdict-v2.schema.json');
    const schema = new Ajv2020({ strict: true }).compile(definition);
    expect(schema(signed), JSON.stringify(schema.errors)).toBe(true);
  });

  it.each([
    ['repository', 'another/repo'], ['head', 'f'.repeat(40)], ['base', 'f'.repeat(40)], ['tree', 'f'.repeat(64)],
    ['policy_hash', 'f'.repeat(64)], ['verifier_hash', 'f'.repeat(64)], ['gate_version', '999.0.0'],
    ['audience', 'hexrift/tamperward:deploy'], ['nonce', 'request-43/attempt-1'],
  ])('rejects stale or differently scoped %s without admitting the claim', (field, value) => {
    const key = keyPair(), signed = signReport(key);
    expect(() => admitVerdict(signed, key.publicKey, { ...binding, [field]: value }, now)).toThrow(/binding mismatch/);
  });

  it('rejects the wrong signer, expiry, unsigned evidence and stronger unsupported assurance', () => {
    const key = keyPair(), signed = signReport(key);
    expect(() => admitVerdict(signed, keyPair().publicKey, binding, now)).toThrow(/signing key/);
    expect(() => admitVerdict(signed, key.publicKey, binding, now + 600_000)).toThrow(/validity/);
    expect(() => admitVerdict(report(), key.publicKey, binding, now)).toThrow();
    expect(() => admitVerdict(signed, key.publicKey, { ...binding, assurance: 'external-json-rpc' }, now)).toThrow(/assurance/);
    expect(() => admitVerdict({ ...signed, statement: { ...signed.statement, assurance: 'external-json-rpc' } }, key.publicKey, binding, now)).toThrow();
    expect(() => admitVerdict(signed, key.publicKey, { ...binding, head: undefined }, now)).toThrow();
  });

  it('rejects changed signatures, unsigned extensions and cross-version statements', () => {
    const key = keyPair(), signed = signReport(key);
    for (const statement of [
      { ...signed.statement, tree: 'f'.repeat(64) },
      { ...signed.statement, evidence_sha256: 'f'.repeat(64) },
      { ...signed.statement, oracle_assurance: { ...signed.statement.oracle_assurance, extra: true } },
      { ...signed.statement, stages: { ...signed.statement.stages, pristine: 'FAIL' } },
      { ...signed.statement, issued_at: '2026-11-01T12:00:01.000Z' },
    ]) expect(() => admitVerdict({ ...signed, statement }, key.publicKey, binding, now)).toThrow();
    expect(() => admitVerdict({ ...signed, signature: 'A'.repeat(86) }, key.publicKey, binding, now)).toThrow(/signature/);
    expect(() => admitVerdict({ ...signed, schema_version: 1 }, key.publicKey, binding, now)).toThrow();
    expect(() => admitVerdict({ ...signed, authority: true }, key.publicKey, binding, now)).toThrow();
    expect(() => admitVerdict(signed, key.publicKey, { ...binding, authority: true }, now)).toThrow();
    expect(() => signAdmissionVerdict({ ...payload(), expires_at: new Date(now + 86_400_001).toISOString() }, bytes(report()), sha256(bytes(report())), key.privateKey, now)).toThrow(/validity/);
  });

  it('refuses to sign incomplete, mismatched, unpinned or self-contradictory producer evidence', () => {
    const key = keyPair(), complete = report(), raw = bytes(complete);
    expect(() => signAdmissionVerdict(payload(), raw, '0'.repeat(64), key.privateKey, now)).toThrow(/digest/);
    for (const value of [
      { ...complete, command: undefined }, { ...complete, budget_secs: undefined },
      { ...complete, verifier_backend: undefined }, { ...complete, dependency_environment: undefined },
      { ...complete, verifier_backend: { ...complete.verifier_backend, available: false } },
      { ...complete, dependency_environment: { status: 'unattestable', roots: [] } },
      { ...complete, pristine: undefined }, { ...complete, pristine: { exit: null, secs: 1 } },
      { ...complete, evidence_binding: undefined }, { ...complete, evidence_binding: { ...complete.evidence_binding, completed: false } },
      { ...complete, evidence_binding: { ...complete.evidence_binding, policy_hash: 'f'.repeat(64) } },
      { ...complete, evidence_binding: { ...complete.evidence_binding, verifier_hash: 'f'.repeat(64) } },
      { ...complete, evidence_binding: { ...complete.evidence_binding, integrity: 'CHANGED' } },
      { ...complete, adjudicated_tree: 'f'.repeat(64) }, { ...complete, base: 'f'.repeat(40) },
      { ...complete, oracle_assurance: { ...suiteExitAssurance(), semantic_isolation: true } },
      { ...complete, visible: { exit: 1, secs: 1 } }, { ...complete, pristine: { exit: 0, secs: 1, failure: 'budget' } },
      { ...complete, pristine: { exit: 0, secs: 1, reason: 'budget exceeded' } },
    ]) expect(() => signReport(key, binding, value)).toThrow();
  });

  it.each(['SUITE_RED', 'CANNOT_VERIFY', 'BUDGET_EXCEEDED'])('never promotes a %s producer result to an admitted pass', verdict => {
    const key = keyPair();
    expect(() => signReport(key, binding, { ...report(), verdict })).toThrow();
    expect(() => signReport(key, { ...binding, verdict } as AdmissionBinding)).toThrow();
  });

  it('keeps an explicitly approved masked failure distinct from VERIFIED', () => {
    const key = keyPair();
    const exception = { rule: 'verify' as const, head: binding.head, approval: 'tw1:review-42' };
    const approved: AdmissionBinding = { ...binding, verdict: 'MASKED_FAILURE', exception };
    const signed = signReport(key, approved);
    expect(admitVerdict(signed, key.publicKey, approved, now)).toMatchObject({ verdict: 'MASKED_FAILURE', exception, stages: { candidate: 'PASS', pristine: 'FAIL', integrity: 'CLEAN' } });
    expect(() => admitVerdict(signed, key.publicKey, binding, now)).toThrow(/binding mismatch/);
    expect(() => admitVerdict(signed, key.publicKey, { ...approved, exception: { ...exception, approval: 'another-approval' } }, now)).toThrow(/binding mismatch/);
    expect(() => signReport(key, { ...approved, exception: null })).toThrow(/exception/);
    expect(() => signReport(key, { ...binding, exception })).toThrow(/exception/);
    expect(() => signReport(key, approved, { ...report(approved), oob_signoff: 'other-approval' })).toThrow(/exception/);
  });

  it('anchors a real completed verification to the policy and verifier actually used', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tw-admission-producer-')); dirs.push(cwd);
    const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    git('init', '-q'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
    writeFileSync(join(cwd, 'source.js'), 'module.exports = 42;\n'); mkdirSync(join(cwd, 'test'));
    writeFileSync(join(cwd, 'test', 'check.test.js'), "if(require('../source.js')!==42)process.exit(1);\n");
    git('add', '-A'); git('commit', '-qm', 'base');
    let output = ''; vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => { output += String(chunk); return true; });
    const command = 'node test/check.test.js';
    expect(runVerify({ cwd, base: 'HEAD', cmd: command, budget: 4, json: true })).toBe(0);
    const document = JSON.parse(output), identity = computeBinding(cwd, { base_ref: 'HEAD', explicit_base: true, command_source: 'flag', command, budget_source: 'flag', budget: 4 });
    const actual: AdmissionBinding = { ...binding, head: identity.head, base: identity.base, tree: identity.tree, policy_hash: identity.policy, verifier_hash: identity.verifier };
    expect(document.evidence_binding).toEqual({ head: actual.head, base: actual.base, tree: actual.tree, policy_hash: actual.policy_hash, verifier_hash: actual.verifier_hash, gate_version: TW_VERSION, completed: true, integrity: 'CLEAN' });
    const raw = Buffer.from(output), key = keyPair();
    const signed = signAdmissionVerdict(payload(actual), raw, sha256(raw), key.privateKey, now);
    expect(admitVerdict(signed, key.publicKey, actual, now).verdict).toBe('VERIFIED');
    writeFileSync(join(cwd, 'source.js'), 'module.exports = 0;\n');
    expect(() => admitVerdict(signed, key.publicKey, { ...actual, tree: computeBinding(cwd, { base_ref: 'HEAD', explicit_base: true, command_source: 'flag', command, budget_source: 'flag', budget: 4 }).tree }, now)).toThrow(/binding mismatch/);
  }, 30_000);
});
