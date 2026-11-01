// Local verification receipts and their CI reconciliation (#601).
//
// The property that matters most for a security tool has its own block below:
// a receipt is EVIDENCE, never authority. No receipt state — matching, stale,
// verifier-mismatched, policy-mismatched, malformed, tampered, missing or
// unknown-schema — can ever promote or strengthen CI's verdict. Every
// reconciliation's `result` is CI's own adjudication, full stop.

import { afterEach, describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runVerify, type VerifyOpts } from '../src/cli/verify';
import { runReceiptExport, runReceiptReconcile } from '../src/cli/receipt';
import {
  classifyReceipt,
  reconcile,
  receiptEvidenceDigest,
  receiptFromRecord,
  receiptPath,
  type VerificationReceipt,
} from '../src/verification-receipt';
import {
  computeBinding,
  readVerificationRecord,
  type VerificationBinding,
  type VerificationInputs,
} from '../src/verification-state';

const ROOT = resolve(__dirname, '..');
const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function initGit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@b'], { cwd });
}

/** A repo whose original suite asserts src.js === 42. */
function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-receipt-'));
  dirs.push(cwd);
  initGit(cwd);
  writeFileSync(join(cwd, 'src.js'), 'module.exports = 42;\n');
  mkdirSync(join(cwd, 'test'), { recursive: true });
  writeFileSync(
    join(cwd, 'test', 'check.test.js'),
    "const v=require('../src.js'); if(v!==42){console.error('bad');process.exit(1)}\n",
  );
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd });
  return cwd;
}

function capture(fn: () => number): { code: number; out: string } {
  let out = '';
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    out += String(chunk);
    return true;
  }) as typeof process.stdout.write);
  const code = fn();
  vi.restoreAllMocks();
  return { code, out };
}

const VERIFY_ARGS = { base: 'HEAD', cmd: 'node test/check.test.js', budget: 4 } as const;

function inputsFor(cwd: string, budget = VERIFY_ARGS.budget): VerificationInputs {
  return {
    base_ref: 'HEAD',
    explicit_base: true,
    command_source: 'flag',
    command: VERIFY_ARGS.cmd,
    budget_source: 'flag',
    budget,
  };
}

/** Run a real verify to a verdict (records + stores a receipt on VERIFIED). */
function verify(cwd: string, extra: Partial<VerifyOpts> = {}): number {
  return capture(() => runVerify({ cwd, ...VERIFY_ARGS, ...extra, silent: true })).code;
}

function storedReceipt(cwd: string): VerificationReceipt {
  const p = receiptPath(cwd)!;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** A valid PRESENT receipt for an arbitrary binding + verdict claim. */
function craftReceipt(binding: VerificationBinding): VerificationReceipt {
  const core = {
    schema_version: 1 as const,
    verdict: 'VERIFIED' as const,
    binding,
    stages: { candidate: 'PASS' as const, pristine: 'PASS' as const, integrity: 'CLEAN' as const },
  };
  return { ...core, tw_version: 'test', verified_at: '2026-01-01T00:00:00.000Z', evidence_digest: receiptEvidenceDigest(core) };
}

/** A path OUTSIDE any repo worktree — writing an artifact into `cwd` would add an
 *  untracked file to the tree fingerprint and change the very identity under test. */
function tmpFile(name: string): string {
  const d = mkdtempSync(join(tmpdir(), 'tw-receipt-art-'));
  dirs.push(d);
  return join(d, name);
}

function writeReceipt(_cwd: string, r: unknown): string {
  const p = tmpFile('receipt.json');
  writeFileSync(p, JSON.stringify(r));
  return p;
}

function headSha(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], { cwd, encoding: 'utf8' }).trim();
}

/** A genuine `tamperward verify --json` document shape (verify-v1): the fields a
 *  `--ci-result` file must carry to be accepted as CI's own adjudication (#601
 *  finding 4). `base` defaults to the current HEAD so it matches the base CI
 *  recomputes for the default `--base HEAD` reconcile in these tests.
 *  `adjudicatedTree` defaults to the live candidate tree — i.e. the up-to-date
 *  case where CI ran the same tree the receipt binds — so the tree cross-check
 *  (#601 re-review) is a no-op and a matching receipt still AGREEs. Pass a
 *  different value to simulate a behind branch (CI ran the merge result), or
 *  `undefined` to simulate an older verify document with no adjudicated tree. */
function ciVerifyDoc(
  cwd: string,
  verdict: string,
  base = headSha(cwd),
  adjudicatedTree: string | undefined = computeBinding(cwd, inputsFor(cwd)).tree,
): Record<string, unknown> {
  const failing = verdict !== 'VERIFIED';
  return {
    schema_version: 1,
    verdict,
    base,
    ...(adjudicatedTree !== undefined ? { adjudicated_tree: adjudicatedTree } : {}),
    command: VERIFY_ARGS.cmd,
    budget_secs: VERIFY_ARGS.budget,
    visible: { exit: failing ? 1 : 0, secs: 0 },
    pristine: { exit: failing ? 1 : 0, secs: 0 },
  };
}

function writeCiResult(doc: unknown): string {
  const p = tmpFile('ci-verify.json');
  writeFileSync(p, JSON.stringify(doc));
  return p;
}

function ajv(): Ajv2020 {
  return new Ajv2020({ allErrors: true, strict: true });
}
function validateReconcile(doc: unknown): string[] {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas', 'reconcile-v1.schema.json'), 'utf8'));
  const validate = ajv().compile(schema);
  return validate(doc) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}
function validateReceiptDoc(doc: unknown): string[] {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas', 'receipt-v1.schema.json'), 'utf8'));
  const validate = ajv().compile(schema);
  return validate(doc) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

describe('local verification receipt emission (#601)', () => {
  it('a successful verify emits a receipt bound to the EXACT verified state, and it self-validates', () => {
    const cwd = repo();
    expect(verify(cwd)).toBe(0);
    const p = receiptPath(cwd)!;
    expect(existsSync(p)).toBe(true);
    const receipt = storedReceipt(cwd);
    expect(receipt.verdict).toBe('VERIFIED');
    // Binds #600's identity verbatim — no parallel notion of "what was verified".
    const record = readVerificationRecord(cwd)!;
    expect(receipt.binding).toEqual(record.binding);
    // Self-consistent evidence digest, and valid against the published schema.
    expect(classifyReceipt(receipt).disposition).toBe('PRESENT');
    expect(validateReceiptDoc(receipt)).toEqual([]);
  }, 30_000);

  it('verify --json reports the adjudicated tree it ran, equal to the recorded binding (#601 re-review)', () => {
    // `receipt reconcile` needs to know WHICH tree CI's verify actually ran over —
    // in a `pull_request` run that is the merge result, which can differ from the
    // branch-tip tree a receipt binds. verify emits it as `adjudicated_tree`, the
    // same fingerprint it binds into the #600 record.
    const cwd = repo();
    const { code, out } = capture(() => runVerify({ cwd, ...VERIFY_ARGS, json: true }));
    expect(code).toBe(0);
    const doc = JSON.parse(out.trim().split('\n').filter(Boolean).pop()!);
    expect(doc.verdict).toBe('VERIFIED');
    const record = readVerificationRecord(cwd)!;
    expect(doc.adjudicated_tree).toBe(record.binding.tree);
  }, 30_000);

  it('a non-VERIFIED verify emits no receipt (only a genuine pass vouches for a state)', () => {
    const cwd = repo();
    writeFileSync(join(cwd, 'src.js'), 'module.exports = 41;\n'); // suite now red
    expect(verify(cwd)).toBe(1);
    // No prior receipt existed, and a red adjudication writes none.
    expect(existsSync(receiptPath(cwd)!)).toBe(false);
  }, 30_000);

  it('the receipt is bounded and non-sensitive: only the fixed evidence fields, no local paths', () => {
    const cwd = repo();
    verify(cwd);
    const receipt = storedReceipt(cwd);
    expect(Object.keys(receipt).sort()).toEqual(
      ['binding', 'evidence_digest', 'oracle_assurance', 'schema_version', 'stages', 'tw_version', 'verdict', 'verified_at'].sort(),
    );
    const raw = readFileSync(receiptPath(cwd)!, 'utf8');
    // No absolute local path (the checkout dir), no command body, no env leakage.
    expect(raw).not.toContain(cwd);
    expect(raw).not.toContain('check.test.js');
    expect(raw).not.toContain('/home/');
    expect(raw.length).toBeLessThan(2048); // bounded by construction
  }, 30_000);
});

describe('receipt export (explicit transport) (#601)', () => {
  it('exports the CURRENT verified receipt to a file that reconciles as AGREE', () => {
    const cwd = repo();
    verify(cwd);
    const out = tmpFile('exported.json');
    expect(capture(() => runReceiptExport({ cwd, out })).code).toBe(0);
    const exported = JSON.parse(readFileSync(out, 'utf8'));
    expect(validateReceiptDoc(exported)).toEqual([]);
    expect(exported.binding).toEqual(storedReceipt(cwd).binding);
  }, 30_000);

  it('refuses to export when the state is not CURRENT (nothing honest to vouch for)', () => {
    const cwd = repo();
    // Never verified → UNVERIFIED → export refuses, fail-closed exit 2.
    const x = tmpFile('x.json');
    expect(capture(() => runReceiptExport({ cwd, out: x })).code).toBe(2);
    expect(existsSync(x)).toBe(false);
  });
});

describe('CI reconciliation reruns canonical checks, then reconciles (#601)', () => {
  it('matching evidence on the exact state → AGREE, result VERIFIED, exit 0', () => {
    const cwd = repo();
    verify(cwd);
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(doc.result).toBe('VERIFIED');
    expect(doc.ci.verdict).toBe('VERIFIED');
    expect(doc.reconciliation.agreement).toBe('AGREE');
    expect(doc.reconciliation.applicable).toBe(true);
    expect(validateReconcile(doc)).toEqual([]);
    expect(code).toBe(0);
  }, 40_000);

  it('the human summary separates LOCAL / CI / RESULT and agreement', () => {
    const cwd = repo();
    verify(cwd);
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    const { out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc }));
    expect(out).toContain('LOCAL');
    expect(out).toContain('CI');
    expect(out).toContain('RESULT');
    expect(out).toContain('VERIFIED');
    expect(out).toContain('agree');
  }, 40_000);

  it('a stale tree → NON_APPLICABLE (tree), never counted as agreement; result is CI verdict', () => {
    const cwd = repo();
    verify(cwd);
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    // Change the tree but keep the suite green (a comment-only edit to src.js).
    writeFileSync(join(cwd, 'src.js'), 'module.exports = 42; // edited\n');
    const { out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.reconciliation.mismatched_input).toBe('tree');
    expect(doc.result).toBe(doc.ci.verdict); // CI is authority; the stale receipt cannot vouch
  }, 40_000);

  it('a verifier-config mismatch → NON_APPLICABLE (verifier)', () => {
    const cwd = repo();
    verify(cwd); // receipt bound to budget 4
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    // Reconcile under a different budget → CI's verifier identity differs.
    const { out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, budget: 7, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.reconciliation.mismatched_input).toBe('verifier');
  }, 40_000);

  it('a policy mismatch → NON_APPLICABLE (policy)', () => {
    const cwd = repo();
    verify(cwd);
    // A valid receipt (correct evidence_digest) whose policy binding is bogus.
    const tampered = { ...storedReceipt(cwd) };
    const binding = { ...tampered.binding, policy: 'deadbeef' };
    const crafted = craftReceipt(binding);
    const rc = writeReceipt(cwd, crafted);
    const { out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(classifyReceipt(crafted).disposition).toBe('PRESENT'); // valid, just describes another state
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.reconciliation.mismatched_input).toBe('policy');
  }, 40_000);

  it('a tampered receipt (binding edited, digest stale) → MALFORMED, ignored as evidence', () => {
    const cwd = repo();
    verify(cwd);
    const tampered = storedReceipt(cwd);
    tampered.binding.tree = 'f'.repeat(16); // edit a binding field, keep old digest
    const rc = writeReceipt(cwd, tampered);
    expect(classifyReceipt(tampered).disposition).toBe('MALFORMED');
    const { out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(doc.local.disposition).toBe('MALFORMED');
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.result).toBe(doc.ci.verdict);
  }, 40_000);

  it('an unknown schema/version → UNKNOWN_SCHEMA, fails safe, cannot strengthen CI', () => {
    const cwd = repo();
    verify(cwd);
    const future = { ...storedReceipt(cwd), schema_version: 2 };
    const rc = writeReceipt(cwd, future);
    const { out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(doc.local.disposition).toBe('UNKNOWN_SCHEMA');
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.result).toBe('VERIFIED'); // CI's own verdict, not the receipt's
  }, 40_000);

  it('a missing receipt → NO_CLAIM; absence is not an enforcement failure', () => {
    const cwd = repo();
    // No stored receipt, none provided. Use --ci-result so no verify writes one.
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED'));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.local.disposition).toBe('ABSENT');
    expect(doc.reconciliation.agreement).toBe('NO_CLAIM');
    expect(doc.result).toBe('VERIFIED');
    expect(code).toBe(0); // CI verified; no receipt does not fail the build
  }, 40_000);

  it('finding 1: a real verify then reconcile in the SAME checkout without --receipt → NO_CLAIM', () => {
    // This is exactly the shape of the generated CI workflow: verify runs first
    // (and writes `.git/tamperward/verification-receipt.json` on VERIFIED), then
    // reconcile runs. With no --receipt transported, reconcile must NOT pick up
    // the receipt verify just wrote and manufacture a LOCAL claim / AGREE — the
    // store fallback is gone, so the claim is ABSENT → NO_CLAIM.
    const cwd = repo();
    expect(verify(cwd)).toBe(0);
    expect(existsSync(receiptPath(cwd)!)).toBe(true); // verify DID write a store receipt
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED'));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.local.disposition).toBe('ABSENT'); // NOT PRESENT — the store is not read
    expect(doc.reconciliation.agreement).toBe('NO_CLAIM');
    expect(doc.result).toBe('VERIFIED');
    expect(code).toBe(0);
  }, 40_000);
});

describe('the receipt can NEVER promote a failing or unknown CI result (#601)', () => {
  it('local-green / CI-red on the SAME state → DIVERGENCE, result SUITE_RED, exit 1', () => {
    const cwd = repo();
    // Break the suite so CI adjudicates SUITE_RED.
    writeFileSync(join(cwd, 'src.js'), 'module.exports = 999;\n');
    execFileSync('git', ['add', '-A'], { cwd });
    execFileSync('git', ['commit', '-qm', 'break'], { cwd });
    // Forge a VERIFIED receipt bound to the EXACT current (red) state.
    const binding = computeBinding(cwd, inputsFor(cwd));
    const forged = craftReceipt(binding);
    expect(classifyReceipt(forged).disposition).toBe('PRESENT');
    const rc = writeReceipt(cwd, forged);
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true }));
    const doc = JSON.parse(out);
    expect(doc.reconciliation.applicable).toBe(true); // it really is this state
    expect(doc.reconciliation.agreement).toBe('DIVERGENCE');
    expect(doc.ci.verdict).toBe('SUITE_RED');
    expect(doc.result).toBe('SUITE_RED'); // NOT promoted to VERIFIED
    expect(doc.result).not.toBe('VERIFIED');
    expect(code).toBe(1); // stays failed
  }, 40_000);

  it('reconcile reruns verify FIRST and forwards ITS verdict — a VERIFIED receipt over a red CI stays red', () => {
    const cwd = repo();
    verify(cwd);
    const goodReceipt = storedReceipt(cwd); // a genuine VERIFIED receipt
    const rc = writeReceipt(cwd, goodReceipt);
    // Deterministic seam: CI's verify returns SUITE_RED regardless of the receipt.
    let ranVerifyFirst = false;
    const fakeVerify: typeof runVerify = (opts) => {
      ranVerifyFirst = true;
      opts.onVerdict?.({ verdict: 'SUITE_RED' });
      return 1;
    };
    // The receipt binding still matches (unchanged tree), so this is a genuine
    // divergence, and the result is CI's SUITE_RED — the receipt cannot flip it.
    const { code, out } = capture(() =>
      runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, json: true, runVerifyImpl: fakeVerify }),
    );
    const doc = JSON.parse(out);
    expect(ranVerifyFirst).toBe(true);
    expect(doc.ci.verdict).toBe('SUITE_RED');
    expect(doc.result).toBe('SUITE_RED');
    expect(code).toBe(1);
  }, 30_000);

  it('the reconcile invariant holds for EVERY claimed-receipt disposition (pure unit)', () => {
    const binding = {
      tree: 't', head: 'h', base: 'b', policy: 'p', verifier: 'v', surface: 's', intervention: 'i', dependencies: 'd',
    } as VerificationBinding;
    const good = craftReceipt(binding);
    const claims = [
      classifyReceipt(good), // PRESENT, matching
      classifyReceipt(null), // ABSENT
      classifyReceipt({ ...good, schema_version: 2 }), // UNKNOWN_SCHEMA
      classifyReceipt({ ...good, evidence_digest: 'sha256:0' }), // MALFORMED (tampered)
    ];
    for (const verdict of ['VERIFIED', 'SUITE_RED', 'MASKED_FAILURE', 'BUDGET_EXCEEDED', 'CANNOT_VERIFY'] as const) {
      for (const claimed of claims) {
        const r = reconcile({ verdict, binding }, claimed);
        // The one invariant: result is ALWAYS CI's verdict, never the receipt's.
        expect(r.result).toBe(verdict);
        if (verdict !== 'VERIFIED') expect(r.result).not.toBe('VERIFIED');
      }
    }
  });
});

describe('machine-readable reconciliation & --ci-result transport (#601)', () => {
  it('consumes a preceding verify --json result without rerunning the suite', () => {
    const cwd = repo();
    // A matching receipt for the current state.
    const binding = computeBinding(cwd, inputsFor(cwd));
    const rc = writeReceipt(cwd, craftReceipt(binding));
    // CI verify result provided as a file; suite is NOT rerun here.
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED'));
    const { code, out } = capture(() =>
      runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, ciResult, json: true }),
    );
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('VERIFIED');
    expect(doc.reconciliation.agreement).toBe('AGREE');
    expect(doc.result).toBe('VERIFIED');
    expect(validateReconcile(doc)).toEqual([]);
    expect(code).toBe(0);
  });

  it('--ci-result carrying a red verdict keeps a matching VERIFIED receipt from promoting it', () => {
    const cwd = repo();
    const binding = computeBinding(cwd, inputsFor(cwd));
    const rc = writeReceipt(cwd, craftReceipt(binding));
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'SUITE_RED'));
    const { code, out } = capture(() =>
      runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, ciResult, json: true }),
    );
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('SUITE_RED');
    expect(doc.result).toBe('SUITE_RED');
    expect(doc.reconciliation.agreement).toBe('DIVERGENCE');
    expect(code).toBe(1);
  });

  it('an unreadable --ci-result fails closed to CANNOT_VERIFY (never a pass)', () => {
    const cwd = repo();
    const { code, out } = capture(() =>
      runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult: join(cwd, 'nope.json'), json: true }),
    );
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('CANNOT_VERIFY');
    expect(doc.result).toBe('CANNOT_VERIFY');
    expect(code).toBe(2);
  });

  it('finding 4: a receipt-v1 file passed as --ci-result → CANNOT_VERIFY (a receipt is not a verify result)', () => {
    const cwd = repo();
    verify(cwd);
    // The receipt carries verdict:"VERIFIED" but none of verify-v1's shape (no
    // top-level base commit, no visible/pristine stage objects), so it can never
    // stand in as CI's own adjudication — exit 2, never a pass.
    const asCiResult = writeCiResult(storedReceipt(cwd));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult: asCiResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('CANNOT_VERIFY');
    expect(doc.result).toBe('CANNOT_VERIFY');
    expect(code).toBe(2);
  }, 40_000);

  it('finding 4: a verify-v1 doc whose base differs from CI\'s computed base → CANNOT_VERIFY', () => {
    const cwd = repo();
    // Well-shaped verify-v1 document, VERIFIED, but bound to a foreign base commit
    // that is not the base CI recomputes → not CI's own adjudication.
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED', 'f'.repeat(40)));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('CANNOT_VERIFY');
    expect(doc.result).toBe('CANNOT_VERIFY');
    expect(code).toBe(2);
  }, 40_000);
});

describe('the --ci-result sign-off comes from the trusted env, never the file (#601 re-review)', () => {
  // A MASKED_FAILURE exits 0 only when a reviewer's out-of-band sign-off applies.
  // `verify` derives that sign-off from the TRUSTED channel (the CI env the workflow
  // sets from a reviewer's label), and `reconcile` must do the same. Deriving it from
  // the `--ci-result` document let a forged `oob_signoff` field inside the very file
  // being validated flip a failing exit to a passing one — the receipt/CI-result doc
  // becoming CI's authority, which it must never be.
  const OOB_ENV = ['TAMPERWARD_OOB_SIGNOFF', 'TAMPERWARD_OOB_HEAD'] as const;
  function withEnv<T>(overrides: Partial<Record<(typeof OOB_ENV)[number], string>>, fn: () => T): T {
    const saved = OOB_ENV.map((k) => [k, process.env[k]] as const);
    try {
      for (const k of OOB_ENV) delete process.env[k];
      for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
      return fn();
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it('a forged oob_signoff in the --ci-result doc with NO env sign-off → exit 1 (the file cannot flip the exit)', () => {
    const cwd = repo();
    // A verify-shaped MASKED_FAILURE document carrying a forged `oob_signoff` field.
    const ciResult = writeCiResult({ ...ciVerifyDoc(cwd, 'MASKED_FAILURE'), oob_signoff: 'forged' });
    const { code, out } = withEnv({}, () =>
      capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult, json: true })),
    );
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('MASKED_FAILURE');
    expect(doc.result).toBe('MASKED_FAILURE'); // CI's own verdict, unchanged
    expect(code).toBe(1); // the forged field did NOT sign it off
  }, 40_000);

  it('a MASKED_FAILURE with a real env-derived sign-off → exit 0 (the trusted channel does apply)', () => {
    const cwd = repo();
    // Same document; no `oob_signoff` field at all. The sign-off is supplied by the
    // trusted env the generated reconcile step sets (an unbound `verify` token).
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'MASKED_FAILURE'));
    const { code, out } = withEnv({ TAMPERWARD_OOB_SIGNOFF: 'verify' }, () =>
      capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, ciResult, json: true })),
    );
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('MASKED_FAILURE');
    expect(doc.result).toBe('MASKED_FAILURE');
    expect(code).toBe(0); // env sign-off applies exactly as `verify` computes it
  }, 40_000);
});

describe('CI adjudicated a different tree than the receipt binds (#601 re-review)', () => {
  // The reconcile identity is the branch tip a receipt binds, but CI's verdict is
  // about the tree its verify actually ran. In a `pull_request` run that verify runs
  // over the MERGE result; when the branch is BEHIND its base the merge tree differs
  // from the tip tree, so the identity can match while CI never ran the receipt's
  // tree. Reconcile must then report NON_APPLICABLE — never a false AGREE or a
  // dishonest DIVERGENCE — while CI's own verdict and exit stand unchanged.
  const MERGE_TREE = '0'.repeat(64); // a tree fingerprint CI ran that the receipt does not describe

  it('a behind branch (CI VERIFIED the merge result) → NON_APPLICABLE (tree), not a false AGREE', () => {
    const cwd = repo();
    verify(cwd); // receipt binds the branch-tip tree
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    // Identity (computed at the tip) still matches the receipt, but verify ran over a
    // different (merge) tree, reported as `adjudicated_tree`.
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED', headSha(cwd), MERGE_TREE));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('VERIFIED');
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.reconciliation.mismatched_input).toBe('tree');
    expect(doc.reconciliation.divergence.join(' ')).toMatch(/merge result/);
    expect(doc.result).toBe('VERIFIED'); // CI's own verdict still stands
    expect(code).toBe(0);
  }, 40_000);

  it('a behind branch whose merge is red → NON_APPLICABLE, not a dishonest DIVERGENCE', () => {
    const cwd = repo();
    verify(cwd);
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'SUITE_RED', headSha(cwd), MERGE_TREE));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('SUITE_RED');
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE'); // NOT DIVERGENCE — CI ran another tree
    expect(doc.reconciliation.mismatched_input).toBe('tree');
    expect(doc.result).toBe('SUITE_RED'); // CI's verdict stands; the receipt just does not apply
    expect(code).toBe(1);
  }, 40_000);

  it('an up-to-date branch (CI ran the receipt tree) still AGREEs', () => {
    const cwd = repo();
    verify(cwd);
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    // Default adjudicated tree == the live/tip tree the receipt binds → cross-check
    // is a no-op → AGREE, as before.
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED'));
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.reconciliation.agreement).toBe('AGREE');
    expect(doc.reconciliation.mismatched_input).toBeUndefined();
    expect(doc.result).toBe('VERIFIED');
    expect(code).toBe(0);
  }, 40_000);

  it('degradation: an older verify doc with no adjudicated_tree → NON_APPLICABLE, noted (never a blind AGREE)', () => {
    const cwd = repo();
    verify(cwd);
    const rc = writeReceipt(cwd, storedReceipt(cwd));
    // A verify document that predates the field carries no `adjudicated_tree`. We
    // cannot confirm CI ran the receipt's tree, so fail safe.
    const olderDoc = ciVerifyDoc(cwd, 'VERIFIED');
    delete olderDoc.adjudicated_tree;
    const ciResult = writeCiResult(olderDoc);
    const { code, out } = capture(() => runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: rc, ciResult, json: true }));
    const doc = JSON.parse(out);
    expect(doc.ci.verdict).toBe('VERIFIED');
    expect(doc.reconciliation.agreement).toBe('NON_APPLICABLE');
    expect(doc.reconciliation.mismatched_input).toBe('tree');
    expect(doc.reconciliation.divergence.join(' ')).toMatch(/predates adjudicated-tree/);
    expect(doc.result).toBe('VERIFIED');
    expect(code).toBe(0);
  }, 40_000);
});

describe('candidate identity vs environment inputs (#601 finding 2)', () => {
  const fullBinding = (over: Partial<VerificationBinding> = {}): VerificationBinding => ({
    tree: 't', head: 'h', base: 'b', policy: 'p', verifier: 'v', surface: 's',
    intervention: 'i', dependencies: 'd', ...over,
  });

  it('an env-only divergence (intervention/dependencies) still AGREEs, noted informational', () => {
    // A genuine branch-tip receipt whose ONLY differences from CI are the
    // machine-local inputs — a developer who runs Claude Code (intervention) and
    // has a populated local dependency env — must still AGREE in CI, with those
    // differences reported as informational rather than making it non-applicable.
    const receipt = craftReceipt(fullBinding({ intervention: 'dev-hooks', dependencies: 'dev-node-modules' }));
    // CI ran the same tree the receipt binds ('t'), so the tree cross-check passes;
    // only the machine-local inputs differ.
    const ci = { verdict: 'VERIFIED' as const, binding: fullBinding({ intervention: 'runner', dependencies: 'runner-node-modules' }), adjudicated_tree: 't' };
    const r = reconcile(ci, classifyReceipt(receipt));
    expect(r.agreement).toBe('AGREE');
    expect(r.applicable).toBe(true);
    expect(r.result).toBe('VERIFIED');
    expect(r.environment_divergence.sort()).toEqual(['dependencies', 'intervention']);
    expect(r.divergence.join('\n')).toContain('informational');
  });

  it('a candidate-identity divergence (tree) is NON_APPLICABLE, not swallowed as informational', () => {
    const receipt = craftReceipt(fullBinding());
    const ci = { verdict: 'VERIFIED' as const, binding: fullBinding({ tree: 'DIFFERENT' }) };
    const r = reconcile(ci, classifyReceipt(receipt));
    expect(r.agreement).toBe('NON_APPLICABLE');
    expect(r.mismatched_input).toBe('tree');
    expect(r.applicable).toBe(false);
    expect(r.result).toBe('VERIFIED'); // still CI's own verdict
  });

  it('each candidate-identity input drives NON_APPLICABLE; each environment input stays informational', () => {
    for (const input of ['tree', 'head', 'base', 'policy', 'verifier', 'surface'] as const) {
      const r = reconcile(
        { verdict: 'VERIFIED', binding: fullBinding({ [input]: 'X' }) },
        classifyReceipt(craftReceipt(fullBinding())),
      );
      expect(r.agreement).toBe('NON_APPLICABLE');
      expect(r.mismatched_input).toBe(input);
    }
    for (const input of ['intervention', 'dependencies'] as const) {
      const r = reconcile(
        // CI ran the same tree ('t'); only a machine-local input differs.
        { verdict: 'VERIFIED', binding: fullBinding({ [input]: 'X' }), adjudicated_tree: 't' },
        classifyReceipt(craftReceipt(fullBinding())),
      );
      expect(r.agreement).toBe('AGREE');
      expect(r.mismatched_input).toBeUndefined();
      expect(r.environment_divergence).toEqual([input]);
    }
  });
});

describe('the stored receipt never outlives the #600 record (#601 finding 3)', () => {
  /** A repo whose suite passes iff the env var TW_RED is unset — a "flaky" suite
   *  that can go red on the SAME tree without any file change. */
  function flakyRepo(): { cwd: string; opts: Partial<VerifyOpts> } {
    const cwd = mkdtempSync(join(tmpdir(), 'tw-receipt-flaky-'));
    dirs.push(cwd);
    initGit(cwd);
    writeFileSync(join(cwd, 'src.js'), 'module.exports = 1;\n');
    mkdirSync(join(cwd, 'test'), { recursive: true });
    // A suite that passes iff TW_RED is unset — it can go red on the SAME tree
    // with no file change, so the record's binding still matches the live state.
    writeFileSync(join(cwd, 'test', 'flaky.test.js'), "if (process.env.TW_RED) { console.error('red'); process.exit(1); }\n");
    execFileSync('git', ['add', '-A'], { cwd });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd });
    return { cwd, opts: { base: 'HEAD', cmd: 'node test/flaky.test.js', budget: 4 } };
  }

  it('a red run on the SAME tree removes both the record and the receipt', () => {
    const { cwd, opts } = flakyRepo();
    // Green: records verification and stores a receipt.
    expect(capture(() => runVerify({ cwd, ...opts, silent: true })).code).toBe(0);
    expect(existsSync(receiptPath(cwd)!)).toBe(true);
    expect(readVerificationRecord(cwd)).not.toBeNull();

    // Red on the SAME tree (no file changed, same verifier): the record is
    // invalidated AND the receipt is removed, so neither can vouch for a state
    // that is no longer verified.
    process.env.TW_RED = '1';
    try {
      expect(capture(() => runVerify({ cwd, ...opts, silent: true })).code).toBe(1);
    } finally {
      delete process.env.TW_RED;
    }
    expect(readVerificationRecord(cwd)).toBeNull();
    expect(existsSync(receiptPath(cwd)!)).toBe(false); // receipt did not outlive the record
  }, 40_000);
});

describe('reconcile stage/receipt-file hygiene (#601 finding 5)', () => {
  it('finding 5a: a VERIFIED receipt whose stage says FAIL is MALFORMED, not rendered green', () => {
    // Build a receipt that is internally consistent (correct digest) but claims a
    // FAIL pristine stage under a VERIFIED verdict — a shape the emitter never
    // writes. It must be rejected as MALFORMED, never shown with a green ✓.
    const binding: VerificationBinding = {
      tree: 't', head: 'h', base: 'b', policy: 'p', verifier: 'v', surface: 's', intervention: 'i', dependencies: 'd',
    };
    const core = {
      schema_version: 1 as const,
      verdict: 'VERIFIED' as const,
      binding,
      stages: { candidate: 'PASS' as const, pristine: 'FAIL' as const, integrity: 'CLEAN' as const },
    };
    const receipt = { ...core, tw_version: 'test', verified_at: '2026-01-01T00:00:00.000Z', evidence_digest: receiptEvidenceDigest(core) };
    const claimed = classifyReceipt(receipt);
    expect(claimed.disposition).toBe('MALFORMED');
    if (claimed.disposition === 'MALFORMED') expect(claimed.detail).toContain('not a clean pass');
  });

  it('finding 5b: an unreadable --receipt is reported as a read failure, not an unknown schema', () => {
    const cwd = repo();
    verify(cwd);
    const ciResult = writeCiResult(ciVerifyDoc(cwd, 'VERIFIED'));
    const { out } = capture(() =>
      runReceiptReconcile({ cwd, ...VERIFY_ARGS, receipt: join(cwd, 'does-not-exist.json'), ciResult, json: true }),
    );
    const doc = JSON.parse(out);
    expect(doc.local.disposition).toBe('MALFORMED');
    expect(String(doc.local.detail)).toMatch(/could not be read/);
    expect(String(doc.local.detail)).not.toMatch(/schema_version/);
  }, 40_000);

  it('finding 5c: receipt export has no JSON envelope — the machine output is the receipt-v1 file itself', () => {
    const cwd = repo();
    verify(cwd);
    // export to stdout emits the receipt document directly (no wrapper), valid
    // against the published receipt-v1 schema.
    const { code, out } = capture(() => runReceiptExport({ cwd }));
    expect(code).toBe(0);
    const doc = JSON.parse(out);
    expect(doc.verdict).toBe('VERIFIED');
    expect(validateReceiptDoc(doc)).toEqual([]);
  }, 40_000);
});
