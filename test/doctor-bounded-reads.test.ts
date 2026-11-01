import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';

const temp = mkdtempSync(join(tmpdir(), 'tw-doctor-reads-'));
const cli = join(__dirname, '../node_modules/.cache/tw-doctor-reads.mjs');
beforeAll(() => {
  mkdirSync(join(__dirname, '../node_modules/.cache'), { recursive: true });
  buildSync({ entryPoints: [join(__dirname, '../src/cli/index.ts')], bundle: true,
    platform: 'node', format: 'esm', packages: 'external', outfile: cli });
});
afterAll(() => { rmSync(temp, { recursive: true, force: true }); rmSync(cli, { force: true }); });

function repo(): string {
  const cwd = mkdtempSync(join(temp, 'repo-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, '.tamperward.yml'), 'version: 1\nverify:\n  command: npm test\n');
  mkdirSync(join(cwd, '.github/workflows'), { recursive: true });
  return cwd;
}
function doctor(cwd: string, json = false): { status: number | null; stdout: string; stderr: string; error?: Error } {
  return spawnSync(process.execPath, [cli, 'doctor', '--cwd', cwd,
    '--workflow', '.github/workflows/tamperward.yml', ...(json ? ['--json'] : [])],
  { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 });
}

describe('bounded doctor authority reads (#800)', () => {
  it.each(['fifo', 'symlink'])('refuses a %s workflow without hanging or following it', kind => {
    const cwd = repo(); const path = join(cwd, '.github/workflows/tamperward.yml');
    if (kind === 'fifo') execFileSync('mkfifo', [path]);
    else symlinkSync('/dev/zero', path);
    const result = doctor(cwd);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('cannot inspect workflow');
  });

  it('reports an unreadable version pin as broken rather than absent', () => {
    const cwd = repo();
    writeFileSync(join(cwd, '.github/workflows/tamperward.yml'),
      'name: ci\non: pull_request\njobs:\n  ci:\n    runs-on: ubuntu-latest\n    timeout-minutes: 70\n    steps:\n      - run: tamperward verify --base main\n');
    mkdirSync(join(cwd, '.husky'));
    symlinkSync('/dev/zero', join(cwd, '.husky/pre-commit'));
    const result = doctor(cwd, true);
    expect(result.error).toBeUndefined();
    const report = JSON.parse(result.stdout) as { authoritative: boolean; checks: Array<{ id: string; state: string; detail: string }> };
    expect(report.authoritative).toBe(false);
    expect(report.checks.find(x => x.id === 'binary-version')).toMatchObject({
      state: 'BROKEN', detail: expect.stringContaining('cannot inspect version pins'),
    });
  });
});
