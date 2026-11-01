import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTrustedGit, trustedGitAncestor } from '../src/git/process';

const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const path of dirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'tw-git-process-'));
  dirs.push(cwd);
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'test');
  git('config', 'user.email', 'test@example.com');
  writeFileSync(join(cwd, 'candidate'), 'first\n');
  git('add', '.');
  git('commit', '-qm', 'first');
  const first = git('rev-parse', 'HEAD');
  writeFileSync(join(cwd, 'candidate'), 'second\n');
  git('add', '.');
  git('commit', '-qm', 'second');
  return { cwd, first, head: git('rev-parse', 'HEAD') };
}

describe('bounded trusted Git processes (#800)', () => {
  it('distinguishes established ancestry from a genuine nonancestor', () => {
    const { cwd, first, head } = repo();
    expect(readTrustedGit(['rev-parse', 'HEAD'], cwd).trim()).toBe(head);
    expect(trustedGitAncestor(first, head, cwd)).toBe(true);
    expect(trustedGitAncestor(head, first, cwd)).toBe(false);
  });

  it('reports an unreadable commit as unavailable evidence rather than a nonancestor', () => {
    const { cwd, first, head } = repo();
    rmSync(join(cwd, '.git', 'objects', head.slice(0, 2), head.slice(2)));
    expect(() => trustedGitAncestor(first, head, cwd)).toThrow(/cannot establish Git ancestry/);
  });

  it('does not turn a missing Git executable into a history finding', () => {
    const { cwd, first, head } = repo();
    vi.stubEnv('PATH', cwd);
    expect(() => trustedGitAncestor(first, head, cwd)).toThrow(/cannot establish Git ancestry/);
  });

  it.skipIf(process.platform === 'win32')('terminates a Git process that never returns', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tw-git-deadline-'));
    dirs.push(cwd);
    const bin = join(cwd, 'bin');
    mkdirSync(bin);
    const executable = join(bin, 'git');
    writeFileSync(executable, `#!${process.execPath}\nsetInterval(() => {}, 1000);\n`);
    chmodSync(executable, 0o755);
    vi.stubEnv('PATH', bin);
    const started = Date.now();
    expect(() => readTrustedGit(['rev-parse', 'HEAD'], cwd)).toThrow();
    expect(Date.now() - started).toBeLessThan(6000);
  }, 10000);
});
