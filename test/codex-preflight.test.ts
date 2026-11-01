import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(versionCode = "console.log('codex-cli 0.0.1')") {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-codex-preflight-'));
  dirs.push(cwd);
  const checkout = join(cwd, 'checkout');
  const adapters = join(checkout, 'harness/adapters');
  mkdirSync(adapters, { recursive: true });
  for (const name of ['codex-probe.mjs', 'probe-driver.mjs']) copyFileSync(resolve(__dirname, '../harness/adapters', name), join(adapters, name));
  copyFileSync(resolve(__dirname, '../package.json'), join(checkout, 'package.json'));
  cpSync(resolve(__dirname, '../src'), join(checkout, 'src'), { recursive: true });
  const modules = join(checkout, 'node_modules');
  mkdirSync(modules);
  for (const name of ['esbuild', 'typescript', 'yaml', 'picomatch']) symlinkSync(resolve(__dirname, '../node_modules', name), join(modules, name), 'dir');
  const marker = join(cwd, 'runtime-executed');
  const executable = join(cwd, 'codex');
  writeFileSync(executable, `#!${process.execPath}\nif(process.argv[2]==='--version'){${versionCode}}else require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected');\n`);
  chmodSync(executable, 0o755);
  const run = (args: string[]) => spawnSync(process.execPath, [join(adapters, 'codex-probe.mjs'), ...args], {
    cwd: checkout, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL',
    env: {
      ...process.env, CODEX_BIN: executable, CODEX_VERSION_EXPECTED: '0.0.2', CODEX_MODEL: 'qualification-model-pin',
      CODEX_EXEC_ARGS: 'exec --dangerously-bypass-approvals-and-sandbox', CODEX_KEEP_PROBE_ARTIFACTS: '0',
    },
  });
  return { cwd, checkout, marker, run };
}

describe('Codex qualification preflight (#785)', () => {
  it.skipIf(process.platform === 'win32')('reports incomplete pins without executing a model-backed qualification case', () => {
    const { marker, run } = fixture();
    const result = run(['--preflight']);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('PREFLIGHT: INSUFFICIENT');
    expect(result.stdout).toContain('No model-backed qualification cases executed');
    expect(result.stdout).not.toContain('Enforcement (GATED');
    expect(existsSync(marker)).toBe(false);
  }, 30000);

  it.skipIf(process.platform === 'win32')('keeps another probe owner\'s cached driver intact', () => {
    const { checkout, run } = fixture();
    const cache = join(checkout, 'node_modules/.cache/tw-codex-probe');
    mkdirSync(cache, { recursive: true });
    const otherDriver = join(cache, 'other-owner.bundle.mjs');
    writeFileSync(otherDriver, 'other owner\n');
    expect(run(['--preflight']).status).toBe(1);
    expect(existsSync(otherDriver)).toBe(true);
  }, 30000);

  it.skipIf(process.platform === 'win32').each([{ args: ['--unknown'] }, { args: ['--preflight', '--preflight'] }])('rejects unsupported argument lists $args before invoking Codex', ({ args }) => {
    const versionMarker = join(tmpdir(), `tw-version-${process.pid}-${Math.random().toString(36).slice(2)}`);
    const { marker, run } = fixture(`require('node:fs').writeFileSync(${JSON.stringify(versionMarker)}, 'unexpected')`);
    try {
      const result = run(args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('usage: codex-probe.mjs [--preflight]');
      expect(existsSync(versionMarker)).toBe(false);
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(versionMarker, { force: true });
    }
  }, 30000);

  it.skipIf(process.platform === 'win32')('bounds the metadata version check without executing a qualification case', () => {
    const versionMarker = join(tmpdir(), `tw-version-${process.pid}-${Math.random().toString(36).slice(2)}`);
    const { marker, run } = fixture(`process.on('SIGTERM',()=>{});setTimeout(()=>{require('node:fs').writeFileSync(${JSON.stringify(versionMarker)},'late');console.log('codex-cli 0.0.1')},10000)`);
    try {
      const result = run(['--preflight']);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('codex_version: (unknown)');
      expect(result.stdout).toContain('PREFLIGHT: INSUFFICIENT');
      expect(existsSync(versionMarker)).toBe(false);
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(versionMarker, { force: true });
    }
  }, 30000);
});
