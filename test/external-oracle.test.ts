import { afterEach, describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as backend from '../src/verifier-backend';
import { runExternalOracle, runOracle } from '../src/cli/oracle';
import { evaluateOracleCases, oracleProgram, ORACLE_WORKER, parseOraclePlan, type OracleRequest } from '../src/external-oracle';
import { emptySuiteDiagnostics, runCapturedProcessSync } from '../src/suite-diagnostics';
import type { BackendRunResult } from '../src/verifier-backend';

const image = 'registry.invalid/node@sha256:' + 'a'.repeat(64);
const raw = () => ({ protocol: 'node-json-rpc-v1', image, budget_secs: 10, cases: [{ module: 'src/answer.cjs', export: 'answer', args: [21], expected: 42 }] });
const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const d of dirs.splice(0)) rmSync(d, { force: true, recursive: true }); });
function response(request: OracleRequest, value: unknown, rawText?: string): BackendRunResult {
  const text = rawText ?? JSON.stringify({ protocol: 'node-json-rpc-v1', nonce: request.nonce, value });
  const diagnostics = emptySuiteDiagnostics();
  diagnostics.stdout = { captured_bytes: Buffer.byteLength(text), retained_bytes: Buffer.byteLength(text), truncated: false, tail: text };
  return { exit: 0, secs: 0, diagnostics };
}
function commandFixture(caseCount = 2) {
  const root = mkdtempSync(join(tmpdir(), 'tw-oracle-report-')); dirs.push(root);
  const cwd = join(root, 'candidate'); mkdirSync(cwd);
  const git = (...args: string[]) => execFileSync('git', args, { cwd });
  git('init', '-q'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(join(cwd, 'answer.cjs'), 'exports.answer = n => n * 2;\n');
  git('add', '.'); git('commit', '-qm', 'fixture');
  const plan = raw(); plan.cases = Array.from({ length: caseCount }, () => ({ ...plan.cases[0], module: 'answer.cjs' }));
  const manifest = join(root, 'plan.json'), bytes = JSON.stringify(plan); writeFileSync(manifest, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const report = () => JSON.parse(String(output.mock.calls.at(-1)?.[0]));
  return { cwd, manifest, sha256, report };
}
describe('independent JSON RPC oracle controller (#782)', () => {
  it('accepts a fractional remaining budget through the real capture supervisor', () => {
    const result = runCapturedProcessSync(process.execPath, ['-e', 'process.stdout.write("42")'], {
      cwd: process.cwd(), env: process.env, timeoutMs: 4999.75,
    });
    expect(result.exit).toBe(0);
    expect(result.diagnostics.stdout.tail).toBe('42');
  });
  it('passes hostile request strings only as data, never shell or worker source', () => {
    const request: OracleRequest = { module: 'src/answer.cjs', export: 'answer', nonce: 'a'.repeat(32), args: ["'); process.exit(19); //", '$(exit 19)', '`exit 19`', '\n\"\\'] };
    const program = oracleProgram(request);
    expect(program.executable).toBe('/usr/local/bin/node');
    expect(program.args.slice(0, 2)).toEqual(['-e', ORACLE_WORKER]);
    expect(program.args).toHaveLength(3);
    expect(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8'))).toEqual(request);
    const argv = backend.containerRunArgs({ image, name: 'test', workspace: '/snapshot', command: program, uid: 1000, gid: 1000 });
    expect(argv.slice(-6)).toEqual(['--entrypoint', program.executable, image, ...program.args]);
    expect(argv).not.toContain('/bin/sh');
  });
  it('materializes a real repository before invoking the independent controller', () => {
    const root = mkdtempSync(join(tmpdir(), 'tw-oracle-snapshot-')); dirs.push(root);
    const cwd = join(root, 'candidate'); mkdirSync(cwd);
    const git = (...args: string[]) => execFileSync('git', args, { cwd });
    git('init', '-q'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
    writeFileSync(join(cwd, 'answer.cjs'), 'exports.answer = n => n * 2;\n');
    git('add', '.'); git('commit', '-qm', 'fixture');
    const plan = raw(); plan.cases[0].module = 'answer.cjs';
    const manifest = join(root, 'plan.json'), bytes = JSON.stringify(plan); writeFileSync(manifest, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    vi.spyOn(backend, 'prepareVerifierBackend').mockReturnValue({ kind: 'container', trust: 'isolated-container', available: true, image });
    const invoke = vi.spyOn(backend, 'runContainerStage').mockImplementation((_backend, snapshot, program) => {
      expect(readFileSync(join(snapshot, 'answer.cjs'), 'utf8')).toBe('exports.answer = n => n * 2;\n');
      if (typeof program === 'string') throw new Error('unexpected shell command');
      return response(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8')), 42);
    });
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const code = runExternalOracle({ cwd, manifest, sha256 });
    expect(code, String(output.mock.calls.at(-1)?.[0])).toBe(0);
    expect(invoke).toHaveBeenCalledOnce();
  });
  it('reports only trustworthy completion across preflight, an interrupted case, and a changed candidate after evaluation (#802)', () => {
    const { cwd, manifest, sha256, report } = commandFixture();
    const preflight = vi.spyOn(backend, 'prepareVerifierBackend').mockReturnValue({ kind: 'container', trust: 'isolated-container', available: false });
    expect(runExternalOracle({ cwd, manifest, sha256 })).toBe(2);
    expect(report()).toMatchObject({ verdict: 'CANNOT_VERIFY', planned: 2, completed: 0, passed: 0, reason: 'EXECUTION_FAILED' });

    preflight.mockReturnValue({ kind: 'container', trust: 'isolated-container', available: true, image });
    let invoked = 0;
    const invoke = vi.spyOn(backend, 'runContainerStage').mockImplementation((_backend, _snapshot, program) => {
      if (++invoked === 2) throw new Error('private runtime detail');
      if (typeof program === 'string') throw new Error('unexpected shell command');
      return response(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8')), 42);
    });
    expect(runExternalOracle({ cwd, manifest, sha256 })).toBe(2);
    expect(report()).toMatchObject({ verdict: 'CANNOT_VERIFY', planned: 2, completed: 1, passed: 1, reason: 'EXECUTION_FAILED' });
    expect(JSON.stringify(report())).not.toContain('private runtime detail');

    invoked = 0;
    invoke.mockImplementation((_backend, _snapshot, program) => {
      if (typeof program === 'string') throw new Error('unexpected shell command');
      if (++invoked === 2) writeFileSync(join(cwd, 'answer.cjs'), 'exports.answer = () => 0;\n');
      return response(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8')), 42);
    });
    expect(runExternalOracle({ cwd, manifest, sha256 })).toBe(2);
    expect(report()).toMatchObject({ verdict: 'CANNOT_VERIFY', planned: 2, completed: 2, passed: 2, reason: 'EXECUTION_FAILED' });
    expect(report()).not.toHaveProperty('binding');
    expect(invoked).toBe(2);
  });
  it('refuses to emit VERIFIED when snapshot cleanup fails after all cases pass (#801, #802)', () => {
    const { cwd, manifest, sha256, report } = commandFixture(1);
    vi.spyOn(backend, 'prepareVerifierBackend').mockReturnValue({ kind: 'container', trust: 'isolated-container', available: true, image });
    vi.spyOn(backend, 'runContainerStage').mockImplementation((_backend, _snapshot, program) => {
      if (typeof program === 'string') throw new Error('unexpected shell command');
      return response(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8')), 42);
    });
    expect(runExternalOracle({ cwd, manifest, sha256 }, path => {
      dirs.push(String(path));
      throw new Error('private cleanup detail');
    })).toBe(2);
    expect(report()).toMatchObject({ verdict: 'CANNOT_VERIFY', planned: 1, completed: 1, passed: 1, reason: 'EXECUTION_FAILED' });
    expect(report()).not.toHaveProperty('binding');
    expect(JSON.stringify(report())).not.toContain('private cleanup detail');
  });
  it('versions structured preflight and post-evaluation reasons without changing v1 (#802)', () => {
    const { cwd, manifest, sha256, report } = commandFixture(1);
    const schema = new Ajv2020({ strict: true }).compile(JSON.parse(readFileSync(join(__dirname, '../schemas/oracle-v2.schema.json'), 'utf8')));
    const check = (reason: string, completed: number) => {
      const value = report();
      expect(value).toMatchObject({ schema_version: 2, verdict: 'CANNOT_VERIFY', planned: 1, completed, passed: completed, reason });
      expect(value).not.toHaveProperty('binding');
      expect(schema(value), JSON.stringify(schema.errors)).toBe(true);
    };
    expect(runOracle(['--cwd', cwd, '--manifest', manifest, '--sha256', 'b'.repeat(64), '--schema-version', '2'])).toBe(2);
    expect(report()).toMatchObject({ schema_version: 2, reason: 'MANIFEST_INVALID', planned: 0, completed: 0, passed: 0 });
    const preflight = vi.spyOn(backend, 'prepareVerifierBackend').mockReturnValue({ kind: 'container', trust: 'isolated-container', available: false });
    expect(runExternalOracle({ cwd, manifest, sha256, schemaVersion: 2 })).toBe(2);
    check('BACKEND_UNAVAILABLE', 0);
    expect(runExternalOracle({ cwd, manifest, sha256 })).toBe(2);
    expect(report()).toMatchObject({ schema_version: 1, reason: 'EXECUTION_FAILED' });

    preflight.mockImplementation(() => { throw new Error('private engine path'); });
    expect(runExternalOracle({ cwd, manifest, sha256, schemaVersion: 2 })).toBe(2);
    check('INFRASTRUCTURE_FAILED', 0);
    expect(JSON.stringify(report())).not.toContain('private engine path');

    preflight.mockReturnValue({ kind: 'container', trust: 'isolated-container', available: true, image });
    vi.spyOn(backend, 'runContainerStage').mockImplementation((_backend, _snapshot, program) => {
      if (typeof program === 'string') throw new Error('unexpected shell command');
      writeFileSync(join(cwd, 'answer.cjs'), 'exports.answer = () => 0;\n');
      return response(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8')), 42);
    });
    expect(runExternalOracle({ cwd, manifest, sha256, schemaVersion: 2 })).toBe(2);
    check('SNAPSHOT_CHANGED', 1);
  });
  it('reports v2 cleanup failures and rejects unsupported schema requests (#802)', () => {
    const { cwd, manifest, sha256, report } = commandFixture(1);
    vi.spyOn(backend, 'prepareVerifierBackend').mockReturnValue({ kind: 'container', trust: 'isolated-container', available: true, image });
    vi.spyOn(backend, 'runContainerStage').mockImplementation((_backend, _snapshot, program) => {
      if (typeof program === 'string') throw new Error('unexpected shell command');
      return response(JSON.parse(Buffer.from(program.args[2], 'base64').toString('utf8')), 42);
    });
    expect(() => runOracle(['--schema-version', '3'])).toThrow(/schema-version/);
    expect(runExternalOracle({ cwd, manifest, sha256, schemaVersion: 2 }, path => {
      dirs.push(String(path));
      throw new Error('private cleanup detail');
    })).toBe(2);
    expect(report()).toMatchObject({ schema_version: 2, reason: 'CLEANUP_FAILED', completed: 1, passed: 1 });
    expect(JSON.stringify(report())).not.toContain('private cleanup detail');
  });
  it('the actual worker emits a JSON frame and a real newline, not escaped delimiter text', () => {
    // Substitute only module resolution for the container's /workspace mount;
    // execute the exact worker bytes and real Node stdout transport.
    const fixture = `const Module = require('node:module'); const original = Module._load;
      Module._load = function(name, ...args) {
        if (name === '/workspace/src/answer.cjs') return { answer: n => n * 2 };
        return original.call(this, name, ...args);
      };`;
    const result = evaluateOracleCases(parseOraclePlan(raw()), request => {
      const child = spawnSync(process.execPath, ['-e', fixture + ORACLE_WORKER, Buffer.from(JSON.stringify(request)).toString('base64')], { encoding: 'utf8', timeout: 5000, maxBuffer: 16384 });
      expect(child.status, child.stderr).toBe(0);
      expect(child.stdout.endsWith('\n')).toBe(true);
      return response(request, 42, child.stdout);
    });
    expect(result.verdict).toBe('VERIFIED');
  });
  it('validates published contracts and refuses candidate-owned plans before execution', () => {
    const root = mkdtempSync(join(tmpdir(), 'tw-oracle-plan-')); dirs.push(root);
    const cwd = join(root, 'candidate'); mkdirSync(cwd);
    const manifest = join(root, 'plan.json'), bytes = JSON.stringify(raw()); writeFileSync(manifest, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const preflight = vi.spyOn(backend, 'prepareVerifierBackend').mockReturnValue({ kind: 'container', trust: 'isolated-container', available: false });
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const ajv = new Ajv2020({ strict: true });
    const validatePlan = ajv.compile(JSON.parse(readFileSync(join(__dirname, '../schemas/external-oracle-plan-v1.schema.json'), 'utf8')));
    expect(validatePlan(raw()), JSON.stringify(validatePlan.errors)).toBe(true);
    expect(runExternalOracle({ cwd, manifest, sha256 })).toBe(2);
    expect(preflight).toHaveBeenCalledOnce(); preflight.mockClear();
    const validateResult = ajv.compile(JSON.parse(readFileSync(join(__dirname, '../schemas/oracle-v1.schema.json'), 'utf8')));
    expect(validateResult(JSON.parse(String(out.mock.calls.at(-1)?.[0]))), JSON.stringify(validateResult.errors)).toBe(true);
    expect(runExternalOracle({ cwd, manifest, sha256: 'b'.repeat(64) })).toBe(2);
    const inside = join(cwd, 'plan.json'); writeFileSync(inside, bytes);
    expect(runExternalOracle({ cwd, manifest: inside, sha256 })).toBe(2);
    expect(preflight).not.toHaveBeenCalled();
  });
  it('owns each assertion and the final completion count, withholding expected values from execution', () => {
    const plan = parseOraclePlan(raw());
    const result = evaluateOracleCases(plan, request => {
      expect(request).not.toHaveProperty('expected');
      expect(Object.keys(request).sort()).toEqual(['args', 'export', 'module', 'nonce']);
      expect(Buffer.from(oracleProgram(request).args[2], 'base64').toString('utf8')).not.toContain('expected');
      return response(request, Number(request.args[0]) * 2);
    });
    expect(result).toEqual({ verdict: 'VERIFIED', planned: 1, completed: 1, passed: 1 });
  });
  it('an ordinary wrong response is red even with a zero suite/process exit', () => {
    expect(evaluateOracleCases(parseOraclePlan(raw()), r => response(r, 0))).toEqual({ verdict: 'ORACLE_RED', planned: 1, completed: 1, passed: 0, reason: 'ASSERTION_FAILED' });
  });
  it.each(['', '{}', 'not json', '{"completed":true}', '{"protocol":"node-json-rpc-v1","nonce":"old","value":42}', '{}\n{}'])('rejects missing/malformed/forged completion %j at exit zero', text => {
    expect(evaluateOracleCases(parseOraclePlan(raw()), r => response(r, 42, text))).toMatchObject({ verdict: 'CANNOT_VERIFY', completed: 0, passed: 0 });
  });
  it('rejects replayed responses between fresh per-case nonces', () => {
    const p = raw(); p.cases.push(p.cases[0]); let first: OracleRequest | undefined;
    const result = evaluateOracleCases(parseOraclePlan(p), r => { first ??= r; return response(first, 42); });
    expect(result).toMatchObject({ verdict: 'CANNOT_VERIFY', planned: 2, completed: 1, passed: 1 });
  });
  it('does not mistake a valid partial result for completion of the plan', () => {
    const p = raw(); p.cases.push(p.cases[0]); let n = 0;
    expect(evaluateOracleCases(parseOraclePlan(p), r => ++n === 1 ? response(r, 42) : { exit: 0, secs: 0, diagnostics: emptySuiteDiagnostics() })).toMatchObject({ verdict: 'CANNOT_VERIFY', planned: 2, completed: 1 });
  });
  it('fails closed on runtime errors, timeouts, output truncation and extra fields', () => {
    const plan = parseOraclePlan(raw());
    expect(evaluateOracleCases(plan, () => { throw new Error('runtime failed'); }).verdict).toBe('CANNOT_VERIFY');
    expect(evaluateOracleCases(plan, () => ({ exit: null, secs: 0, failure: 'budget' })).reason).toBe('BUDGET_EXCEEDED');
    expect(evaluateOracleCases(plan, () => ({ exit: 1, secs: 0 })).verdict).toBe('CANNOT_VERIFY');
    expect(evaluateOracleCases(plan, r => { const x = response(r, 42); if (x.diagnostics) x.diagnostics.stdout.truncated = true; return x; }).verdict).toBe('CANNOT_VERIFY');
    expect(evaluateOracleCases(plan, r => response(r, 42, JSON.stringify({ protocol: plan.protocol, nonce: r.nonce, value: 42, completed: true }))).verdict).toBe('CANNOT_VERIFY');
  });
  it('refuses empty/unpinned/unsupported plans and unsafe paths instead of silently skipping cases', () => {
    expect(() => parseOraclePlan({ ...raw(), cases: [] })).toThrow();
    expect(() => parseOraclePlan({ ...raw(), image: 'node:latest' })).toThrow();
    expect(() => parseOraclePlan({ ...raw(), protocol: 'suite-exit' })).toThrow();
    expect(() => parseOraclePlan({ ...raw(), budget_secs: 0 })).toThrow();
    for (const module of ['../answer.cjs', '/answer.cjs', 'src/../answer.cjs', 'src/answer.js', "src/x';true.cjs"]) {
      expect(() => parseOraclePlan({ ...raw(), cases: [{ ...raw().cases[0], module }] })).toThrow();
    }
    expect(() => parseOraclePlan({ ...raw(), cases: [{ ...raw().cases[0], expected: Infinity }] })).toThrow();
    expect(() => parseOraclePlan({ ...raw(), cases: [{ ...raw().cases[0], extra: true }] })).toThrow();
  });
});
