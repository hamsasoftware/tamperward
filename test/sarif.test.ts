import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { report, isFormat } from '../src/cli/report';
import { main, validateCliArgs } from '../src/cli/main';
import { parseVerify, runVerify } from '../src/cli/verify';
import { defaultPolicy } from '../src/policy';
import { runCheck } from '../src/cli/check';
import { receiptPath } from '../src/verification-receipt';
import { compactOobToken } from '../src/signoff';
import { expectSarif } from './support/sarif-schema';

const dirs: string[] = [];

function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-sarif-'));
  dirs.push(cwd);
  const git = (...args: string[]) => execFileSync('git', args, { cwd });
  git('init', '-q');
  git('config', 'user.email', 't@b');
  git('config', 'user.name', 'tb');
  mkdirSync(join(cwd, 'test'));
  writeFileSync(join(cwd, 'test/a.test.js'), 'it("works", () => {});\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  return cwd;
}

function capture(action: () => unknown): { code: unknown; document: any; stdout: string } {
  const writes: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { writes.push(String(chunk)); return true; });
  const code = action();
  const stdout = writes.join('');
  const document = JSON.parse(stdout);
  expectSarif(document);
  return { code, document, stdout };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('SARIF CLI presentation', () => {
  it('registers the format for both commands', () => {
    expect(isFormat('sarif')).toBe(true);
    expect(validateCliArgs('check', ['--staged', '--format', 'sarif'])).toBeUndefined();
    expect(validateCliArgs('verify', ['--format', 'sarif'])).toBeUndefined();
    expect(parseVerify(['--format', 'sarif'])).toMatchObject({ format: 'sarif' });
  });

  it('emits empty results for a clean check under GitHub Actions', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    try {
      const { document } = capture(() => report({ format: 'sarif', scanned: 0, ignoredFiles: 0, findings: [] }));
      expect(document.runs[0].results).toEqual([]);
      expect(document.runs[0].properties.verdict).toBe('CLEAN');
    } finally { vi.unstubAllEnvs(); }
  });

  it('projects fail-closed verification as SARIF without changing exit 2', () => {
    const { code, document } = capture(() => runVerify({ ...parseVerify(['--format', 'sarif']), invalid: 'bad "argument"\nvalue' }));
    expect(code).toBe(2);
    const run = document.runs[0];
    expect(run.properties).toMatchObject({ verdict: 'CANNOT_VERIFY', receipt_digest: null, signed_verdict: null, reason: 'INVALID_ARGUMENTS' });
    expect(run.results[0]).toMatchObject({ ruleId: 'tamperward/v1/verify-cannot-verify', level: 'error' });
    expect(run.results[0].locations).toBeUndefined();
    expect(run.invocations[0].executionSuccessful).toBe(false);
  });

  it.each(['check', 'verify'])('rejects malformed %s format arguments before output', command => {
    for (const args of [['--format'], ['--format', 'unknown'], ['--format', 'sarif', '--json']]) {
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      expect(main([command, ...args])).toBe(2);
      expect(stdout).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });

  it.each([['VERIFIED', 0], ['MASKED_FAILURE', 1], ['SUITE_RED', 1], ['BUDGET_EXCEEDED', 2]] as const)(
    'preserves the real %s verification exit %s', (verdict, expectedCode) => {
      const cwd = repo();
      let stage = 0;
      const { code, document } = capture(() => runVerify({
        cwd, cmd: 'true', format: 'sarif', runStage: () => ({
          exit: verdict === 'BUDGET_EXCEEDED' ? null : verdict === 'SUITE_RED' || (verdict === 'MASKED_FAILURE' && stage++ > 0) ? 1 : 0,
          secs: 0,
        }),
      }));
      expect(code).toBe(expectedCode);
      const run = document.runs[0];
      expect(run.properties.verdict).toBe(verdict);
      expect(run.results).toHaveLength(verdict === 'VERIFIED' ? 0 : 1);
      if (verdict === 'VERIFIED') {
        const receipt = JSON.parse(readFileSync(receiptPath(cwd)!, 'utf8'));
        expect(run.properties.receipt_digest).toBe(receipt.evidence_digest);
      } else expect(run.properties.receipt_digest).toBeNull();
    },
  );

  it('keeps an approved masked failure visible with its actual verdict and exit 0', () => {
    const cwd = repo();
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    vi.stubEnv('TAMPERWARD_OOB_HEAD', head);
    vi.stubEnv('TAMPERWARD_OOB_SIGNOFF', compactOobToken('verify', head)!);
    let stage = 0;
    const { code, document } = capture(() => runVerify({
      cwd, cmd: 'true', format: 'sarif', runStage: () => ({ exit: stage++ === 0 ? 0 : 1, secs: 0 }),
    }));
    expect(code).toBe(0);
    expect(document.runs[0].properties.verdict).toBe('MASKED_FAILURE');
    expect(document.runs[0].properties.receipt_digest).toBeNull();
    expect(document.runs[0].results[0].level).toBe('warning');
  });

  it('never associates a stale stored receipt with a later failed verification', () => {
    const cwd = repo();
    capture(() => runVerify({ cwd, cmd: 'true', format: 'sarif', runStage: () => ({ exit: 0, secs: 0 }) }));
    vi.restoreAllMocks();
    const { document } = capture(() => runVerify({ cwd, cmd: 'true', format: 'sarif', invalid: 'invalid' }));
    expect(document.runs[0].properties.receipt_digest).toBeNull();
  });

  it('preserves clean, warning and blocking check exits with one SARIF document', () => {
    const cwd = repo();
    expect(capture(() => main(['check', '--staged', '--format=sarif', '--cwd', cwd])).code).toBe(0);
    vi.restoreAllMocks();
    writeFileSync(join(cwd, 'test/a.test.js'), 'it.skip("works", () => {});\n');
    execFileSync('git', ['add', '-A'], { cwd });
    expect(capture(() => runCheck({ cwd, staged: true, format: 'sarif' })).code).toBe(1);
    vi.restoreAllMocks();
    const policy = defaultPolicy();
    policy.rules['test-skip'] = { severity: 'warn' };
    const warning = capture(() => runCheck({ cwd, staged: true, format: 'sarif', policyOverride: policy }));
    expect(warning.code).toBe(0);
    expect(warning.document.runs[0].results[0].level).toBe('warning');
  });
});
