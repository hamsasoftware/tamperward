import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { inspectPath, inspectRel } from '../disk';
import { repoRoot } from '../repo-context';
import { treeFingerprint } from '../fingerprint';
import { trustedGitEnv } from '../git/trusted';
import { prepareVerifierBackend, runContainerStage } from '../verifier-backend';
import { evaluateOracleCases, oracleProgram, parseOraclePlan, type OracleEvaluation } from '../external-oracle';
import { materialize, probeFilesystemCaseSensitivity } from '../candidate-snapshot';

export interface ExternalOracleOpts { cwd: string; manifest: string; sha256: string; schemaVersion?: 1 | 2 }
type OracleFailureReason = 'MANIFEST_INVALID' | 'BACKEND_UNAVAILABLE' | 'SNAPSHOT_CHANGED' | 'CLEANUP_FAILED' | 'INFRASTRUCTURE_FAILED';
class OracleFailure extends Error {
  constructor(readonly reason: OracleFailureReason) { super(reason); }
}
export function runExternalOracle(opts: ExternalOracleOpts, removeSnapshot: typeof rmSync = rmSync): number {
  const cwd = repoRoot(opts.cwd);
  let temp: string | undefined;
  const emit = (result: OracleEvaluation, binding?: { head: string; tree: string; manifest: string; image: string }, failureReason?: OracleFailureReason): number => {
    process.stdout.write(JSON.stringify({ schema_version: opts.schemaVersion ?? 1, ...result,
      ...(opts.schemaVersion === 2 && failureReason ? { reason: failureReason } : {}),
      ...(binding ? { binding } : {}), oracle_assurance: {
      level: 'external-json-rpc', assertions_outside_candidate: true,
      candidate_controls_rpc_response: true, scope: 'CommonJS JSON function-response cases only; no framework-wide or exhaustive semantic guarantee',
    } }) + '\n');
    return result.verdict === 'VERIFIED' ? 0 : result.verdict === 'ORACLE_RED' ? 1 : 2;
  };
  let planned = 0;
  let evaluation: OracleEvaluation | undefined;
  let binding: { head: string; tree: string; manifest: string; image: string } | undefined;
  let failureReason: OracleFailureReason | undefined;
  try {
    if (!isAbsolute(opts.manifest) || !/^[a-f0-9]{64}$/.test(opts.sha256)) throw new OracleFailure('MANIFEST_INVALID');
    let rel: string;
    try { rel = relative(realpathSync(cwd), realpathSync(opts.manifest)); }
    catch { throw new OracleFailure('MANIFEST_INVALID'); }
    if (rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))) throw new OracleFailure('MANIFEST_INVALID');
    const entry = inspectPath(opts.manifest);
    if (entry.kind !== 'file' || !entry.content || entry.content.length > 256 * 1024 || createHash('sha256').update(entry.content).digest('hex') !== opts.sha256) throw new OracleFailure('MANIFEST_INVALID');
    let plan;
    try { plan = parseOraclePlan(JSON.parse(entry.content.toString('utf8'))); }
    catch { throw new OracleFailure('MANIFEST_INVALID'); }
    planned = plan.cases.length;
    const backend = prepareVerifierBackend({ command: '', budget: plan.budget_secs, backend: 'container', image: plan.image });
    if (!backend.available) throw new OracleFailure('BACKEND_UNAVAILABLE');
    const git = (args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8', env: trustedGitEnv(), maxBuffer: 1 << 28 });
    const head = git(['rev-parse', 'HEAD']).trim();
    const tree = treeFingerprint(cwd);
    const paths = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))];
    for (const path of paths) {
      const e = inspectRel(cwd, path);
      if (!['file', 'symlink'].includes(e.kind) || e.content === null) throw new Error('unsupported oracle candidate entry');
    }
    const snapshot = mkdtempSync(join(tmpdir(), 'tw-external-oracle-'));
    temp = snapshot;
    if (!probeFilesystemCaseSensitivity(snapshot)) throw new Error('oracle snapshot requires a case-sensitive filesystem');
    materialize(cwd, snapshot, null);
    for (const path of paths) {
      const source = inspectRel(cwd, path), copy = inspectRel(snapshot, path);
      if (source.kind !== copy.kind || source.mode !== copy.mode || !source.content || !copy.content || !source.content.equals(copy.content)) throw new OracleFailure('SNAPSHOT_CHANGED');
    }
    if (treeFingerprint(cwd) !== tree || git(['rev-parse', 'HEAD']).trim() !== head) throw new OracleFailure('SNAPSHOT_CHANGED');
    evaluation = evaluateOracleCases(plan, (request, budget) => runContainerStage(backend, snapshot, oracleProgram(request), budget));
    if (treeFingerprint(cwd) !== tree || git(['rev-parse', 'HEAD']).trim() !== head) throw new OracleFailure('SNAPSHOT_CHANGED');
    binding = { head, tree, manifest: opts.sha256, image: plan.image };
  } catch (error) {
    // Only the host-completed cases from an actual evaluation may survive a
    // later snapshot/infrastructure failure. Preflight has no completed cases.
    evaluation = { verdict: 'CANNOT_VERIFY', planned, completed: evaluation?.completed ?? 0,
      passed: evaluation?.passed ?? 0, reason: 'EXECUTION_FAILED' };
    failureReason = error instanceof OracleFailure ? error.reason : 'INFRASTRUCTURE_FAILED';
    binding = undefined;
  } finally {
    if (temp) {
      try { removeSnapshot(temp, { recursive: true, force: true }); }
      catch {
        // Cleanup is part of a successful evaluation. Never print VERIFIED
        // before it completes, or let a failed cleanup leave a green report.
        evaluation = { verdict: 'CANNOT_VERIFY', planned, completed: evaluation?.completed ?? 0,
          passed: evaluation?.passed ?? 0, reason: 'EXECUTION_FAILED' };
        failureReason = 'CLEANUP_FAILED';
        binding = undefined;
      }
    }
  }
  return emit(evaluation ?? { verdict: 'CANNOT_VERIFY', planned, completed: 0, passed: 0, reason: 'EXECUTION_FAILED' }, binding, failureReason);
}
export function runOracle(args: string[]): number {
  let cwd = process.cwd(), manifest = '', sha256 = '', schemaVersion: 1 | 2 = 1;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--cwd', '--manifest', '--sha256', '--schema-version'].includes(flag) || seen.has(flag) || !value || value.startsWith('--')) throw new Error('invalid oracle arguments');
    seen.add(flag);
    if (flag === '--cwd') cwd = value;
    if (flag === '--manifest') manifest = value;
    if (flag === '--sha256') sha256 = value;
    if (flag === '--schema-version') {
      if (value !== '1' && value !== '2') throw new Error('oracle schema-version must be 1 or 2');
      schemaVersion = value === '2' ? 2 : 1;
    }
  }
  return runExternalOracle({ cwd, manifest, sha256, schemaVersion });
}
