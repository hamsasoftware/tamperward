import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildSync } from 'esbuild';
import type { ProcessApi, ProcessObservation } from './process-runner';

type Scenario = 'complete' | 'nonzero' | 'crash' | 'deadline' | 'inherited-pipes';
interface FixtureProcess { pid: number; detached: boolean }

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch {
    return false;
  }
}

export function processContracts(name: string, api: ProcessApi): void {
  describe.skipIf(process.platform === 'win32')(name, () => {
    let root: string;
    let runner: string;

    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'tw-process-contract-'));
      runner = join(root, 'runner.mjs');
      buildSync({ entryPoints: [resolve(__dirname, 'process-runner.ts')], bundle: true, platform: 'node', format: 'esm', outfile: runner });
    });

    afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

    const run = async (scenario: Scenario): Promise<ProcessObservation> => {
      const cwd = mkdtempSync(join(root, 'case-'));
      const bin = join(cwd, 'bin');
      mkdirSync(bin);
      const fixture = join(bin, 'git');
      writeFileSync(fixture, `#!${process.execPath}\n${readFileSync(resolve(__dirname, 'process-fixture.cjs'), 'utf8')}`);
      chmodSync(fixture, 0o755);
      const pidsFile = join(cwd, 'pids');
      const exitFile = join(cwd, 'main-exited');
      const config = join(cwd, 'config.json');
      writeFileSync(config, JSON.stringify({ api, cwd, fixture }));
      const child = spawn(process.execPath, [runner, config], {
        cwd,
        env: { ...process.env, PATH: bin, TW_PROCESS_SCENARIO: scenario, TW_PROCESS_PIDS: pidsFile, TW_PROCESS_MAIN_EXITED: exitFile },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const killGroup = (): void => {
        if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
      };
      let expired = false;
      const deadline = setTimeout(() => { expired = true; killGroup(); }, 8000);
      let stdout = '', stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      try {
        const [exit, signal] = await once(child, 'close');
        expect(expired, `outer process deadline exceeded: ${stderr}`).toBe(false);
        expect({ exit, signal, stderr }).toEqual({ exit: 0, signal: null, stderr: '' });
        if (scenario === 'inherited-pipes') expect(existsSync(exitFile), stdout).toBe(true);
        return JSON.parse(stdout) as ProcessObservation;
      } finally {
        clearTimeout(deadline);
        killGroup();
        const processes: FixtureProcess[] = existsSync(pidsFile) ? readFileSync(pidsFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as FixtureProcess) : [];
        for (const pid of new Set(processes.filter(entry => entry.detached).map(entry => entry.pid))) {
          try { process.kill(-pid, 'SIGKILL'); } catch {}
        }
        const pids = [...new Set(processes.map(entry => entry.pid))];
        const cleanupDeadline = Date.now() + 2000;
        while (Date.now() < cleanupDeadline && pids.some(running)) await new Promise(resolve => setTimeout(resolve, 20));
        expect(pids.filter(running)).toEqual([]);
        rmSync(cwd, { recursive: true, force: true });
      }
    };

    it('returns complete exact output after ordinary completion', async () => {
      const result = await run('complete');
      expect(result).toMatchObject({ exit: 0, signal: null, timedOut: false, stdout: 'stdout:complete\n' });
      expect(result.error).toBeUndefined();
      expect(result.pipeHeldOpen).toBeUndefined();
      if (result.stderr !== undefined) expect(result.stderr).toBe('stderr:complete\n');
    }, 12000);

    it('preserves a nonzero exit instead of accepting its output as success', async () => {
      const result = await run('nonzero');
      expect(result).toMatchObject({ exit: 7, signal: null, timedOut: false, stdout: 'stdout:complete\n', stderr: 'stderr:complete\n' });
    }, 12000);

    it('preserves a crash instead of accepting its output as success', async () => {
      const result = await run('crash');
      expect(result).toMatchObject({ exit: null, signal: 'SIGKILL', timedOut: false, stdout: 'stdout:complete\n', stderr: 'stderr:complete\n' });
    }, 12000);

    it('reaches its own deadline before the outer deadline', async () => {
      const result = await run('deadline');
      expect(result.timedOut).toBe(true);
      expect(result.exit).not.toBe(0);
    }, 12000);

    it('does not report inherited pipes as complete output', async () => {
      const result = await run('inherited-pipes');
      expect(result.stdout).toBe('stdout:partial\n');
      expect(Boolean(result.error) || result.pipeHeldOpen === true).toBe(true);
      if (api === 'captured') expect(result).toMatchObject({ exit: 0, timedOut: false, pipeHeldOpen: true });
      else expect(result.timedOut).toBe(true);
    }, 12000);
  });
}
