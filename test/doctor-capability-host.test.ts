import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { runDoctor, type DoctorReport } from '../src/cli/doctor';
import { runInit } from '../src/cli/init';
import { runCheck } from '../src/cli/check';
import { capabilityReadiness } from '../src/capability-readiness';
import { runOnboard } from '../src/cli/onboard';
import * as verifierBackend from '../src/verifier-backend';

const dirs: string[] = [];
const image = 'example/verifier@sha256:' + 'a'.repeat(64);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture(backend: 'local' | 'container' = 'local'): string {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-host-capability-'));
  dirs.push(cwd);
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd });
  writeFileSync(join(cwd, '.tamperward.yml'), [
    'version: 1', 'verify:', '  command: node -e "process.exit(0)"', '  budget: 30',
    `  backend: ${backend}`, ...(backend === 'container' ? [`  image: ${image}`] : []), '',
  ].join('\n'));
  execFileSync('git', ['add', '.tamperward.yml'], { cwd });
  execFileSync('git', ['commit', '-qm', 'fixture policy'], { cwd });
  expect(runInit({ cwd, quiet: true })).toBe(0);
  return cwd;
}

function capture(action: () => number): { code: number; out: string; err: string } {
  let out = '';
  let err = '';
  vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { out += String(chunk); return true; });
  vi.spyOn(process.stderr, 'write').mockImplementation(chunk => { err += String(chunk); return true; });
  const code = action();
  vi.restoreAllMocks();
  return { code, out, err };
}

function report(cwd: string): DoctorReport {
  const result = capture(() => runDoctor({ cwd, json: true }));
  const document: DoctorReport = JSON.parse(result.out);
  const schema = JSON.parse(readFileSync(join(__dirname, '../schemas/doctor-v1.schema.json'), 'utf8'));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
  return document;
}

describe('doctor capability contract on the current host (#803)', () => {
  it('runs doctor and readiness validation in the required real-host matrix', () => {
    const workflow = parse(readFileSync(join(__dirname, '../.github/workflows/ci.yml'), 'utf8'));
    const job = workflow.jobs['platform-contract'];
    const commands = job.steps.flatMap((step: { run?: string }) => step.run ? [step.run] : []).join('\n');
    expect(job.strategy.matrix.os).toEqual(['ubuntu-latest', 'macos-latest', 'windows-latest']);
    expect(commands).toContain('test/capability-readiness.test.ts');
    expect(commands).toContain('test/doctor-capability-host.test.ts');
    expect(workflow.jobs.gate.needs).toContain('platform-contract');
  });

  it('renders actual doctor JSON without obscuring usable static checks or local verification', () => {
    const cwd = fixture();
    const preflight = vi.spyOn(verifierBackend, 'prepareVerifierBackend');
    const document = report(cwd);
    expect(preflight).not.toHaveBeenCalled();
    const byId = Object.fromEntries(document.capabilities.map(capability => [capability.id, capability]));
    const platform = document.checks.find(check => check.id === 'platform');
    expect(byId['static-check'].state).toBe('AVAILABLE');
    expect(byId['local-verify'].state).toBe(process.platform === 'win32' ? 'BLOCKED' : 'AVAILABLE');
    expect(byId['run-lifecycle'].state).toBe(process.platform === 'linux' && platform?.state === 'OK' ? 'AVAILABLE' : 'BLOCKED');
    expect(byId['container-verify'].state).toBe('UNVERIFIED');
    expect(byId['protected-ci'].state).toBe('UNVERIFIED');
    expect(document.authoritative).toBe(!document.checks.some(check => check.state === 'BROKEN'));
    expect(document.capabilities.every(capability => capability.next.includes('`'))).toBe(true);
    process.stdout.write('doctor capability readiness: ' + JSON.stringify({
      host: process.platform, authoritative: document.authoritative, capabilities: document.capabilities,
    }) + '\n');
    expect(capture(() => runCheck({ cwd, staged: true, json: true })).code).toBe(0);
  });

  it('performs a bounded backend preflight and exposes unavailable Docker as a real failure', () => {
    const cwd = fixture('container');
    vi.stubEnv('TAMPERWARD_CONTAINER_ENGINE', 'unsupported-host-fixture');
    const document = report(cwd);
    expect(document.checks).toContainEqual(expect.objectContaining({
      id: 'container-preflight', state: 'BROKEN', detail: expect.stringContaining('unsupported isolated verifier engine'),
    }));
    expect(document.authoritative).toBe(false);
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'container-verify', state: 'BLOCKED' }));
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'static-check', state: 'AVAILABLE' }));
  });

  it('marks container readiness available only after the actual backend preflight succeeds', () => {
    const cwd = fixture('container');
    const preflight = vi.spyOn(verifierBackend, 'prepareVerifierBackend').mockReturnValue({
      kind: 'container', trust: 'isolated-container', available: true, image, engine: 'docker',
      daemonHost: 'unix:///var/run/docker.sock',
    });
    const result = capture(() => runDoctor({ cwd, json: true }));
    const document: DoctorReport = JSON.parse(result.out);
    expect(preflight).toHaveBeenCalledOnce();
    expect(preflight).toHaveBeenCalledWith(expect.objectContaining({ backend: 'container', image }));
    expect(document.checks).toContainEqual(expect.objectContaining({ id: 'container-preflight', state: 'OK' }));
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'container-verify', state: 'AVAILABLE' }));
    expect(document.authoritative).toBe(!document.checks.some(check => check.state === 'BROKEN'));
  });

  it('retains backend evidence when doctor stops at an unrelated incomplete CI installation', () => {
    const cwd = fixture('container');
    rmSync(join(cwd, '.github/workflows/tamperward.yml'));
    vi.stubEnv('TAMPERWARD_CONTAINER_ENGINE', 'unsupported-host-fixture');
    const result = capture(() => runDoctor({ cwd, json: true }));
    const document: DoctorReport = JSON.parse(result.out);
    expect(result.code).toBe(2);
    expect(document.authoritative).toBe(false);
    expect(document.checks).toContainEqual(expect.objectContaining({ id: 'container-preflight', state: 'BROKEN' }));
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'container-verify', state: 'BLOCKED' }));
  });

  it('retains successful container readiness while an unrelated CI failure keeps global authority false', () => {
    const cwd = fixture('container');
    rmSync(join(cwd, '.github/workflows/tamperward.yml'));
    vi.spyOn(verifierBackend, 'prepareVerifierBackend').mockReturnValue({
      kind: 'container', trust: 'isolated-container', available: true, image, engine: 'docker',
    });
    const result = capture(() => runDoctor({ cwd, json: true }));
    const document: DoctorReport = JSON.parse(result.out);
    expect(result.code).toBe(2);
    expect(document.authoritative).toBe(false);
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'container-verify', state: 'AVAILABLE' }));
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'protected-ci', state: 'BLOCKED' }));
  });

  it('uses the same preflight check in terminal and shared capability output', () => {
    const cwd = fixture('container');
    vi.stubEnv('TAMPERWARD_CONTAINER_ENGINE', 'unsupported-host-fixture');
    const result = capture(() => runDoctor({ cwd }));
    expect(result.out).toContain('container-preflight');
    expect(result.out).toContain('unsupported isolated verifier engine');
    expect(result.out).toContain('container-verify BLOCKED');
    const capabilities = capabilityReadiness({ checks: [
      { id: 'policy', state: 'OK', detail: 'policy' },
      { id: 'verifier', state: 'OK', detail: 'container configuration' },
      { id: 'container-preflight', state: 'BROKEN', detail: 'unavailable Docker' },
    ], platform: process.platform, verifierBackend: 'container' });
    expect(capabilities).toContainEqual(expect.objectContaining({ id: 'container-verify', state: 'BLOCKED' }));
  });

  it('keeps an unexpected preflight error fail-closed in machine output', () => {
    const cwd = fixture('container');
    vi.spyOn(verifierBackend, 'prepareVerifierBackend').mockImplementation(() => { throw new Error('host metadata unreadable'); });
    const document = report(cwd);
    expect(document.authoritative).toBe(false);
    expect(document.checks).toContainEqual(expect.objectContaining({
      id: 'container-preflight', state: 'BROKEN', detail: expect.stringContaining('host metadata unreadable'),
    }));
    expect(document.capabilities).toContainEqual(expect.objectContaining({ id: 'container-verify', state: 'BLOCKED' }));
  });

  it('shares doctor preflight failure and usable static guidance with onboard', async () => {
    const cwd = fixture('container');
    vi.stubEnv('TAMPERWARD_CONTAINER_ENGINE', 'unsupported-host-fixture');
    const document = report(cwd);
    const lines: string[] = [];
    const code = await runOnboard({ cwd, yes: true, noGithub: true, skipDemo: true }, {
      interactive: false, colour: false, out: line => lines.push(line),
      runners: {
        init: () => 0, verify: () => 0,
        doctor: () => ({ code: 0, authoritative: document.authoritative, checks: document.checks, verifierBackend: 'container', summary: [] }),
      },
    });
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('container-preflight');
    expect(lines.join('\n')).toContain('unsupported isolated verifier engine');
    expect(lines.join('\n')).toMatch(/BLOCKED\s+container-verify:/);
    expect(lines.join('\n')).toMatch(/AVAILABLE\s+static-check:/);
  });
});
