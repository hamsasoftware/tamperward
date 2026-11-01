import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface CandidateEntryFixture {
  cwd: string;
  destination: string;
  relative: string;
  path: string;
  outside: string;
}

export function candidateEntryContracts(name: string, read: (fixture: CandidateEntryFixture) => string | null): void {
  describe(name, () => {
    const directories: string[] = [];
    afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
    const fixture = (): CandidateEntryFixture => {
      const root = mkdtempSync(join(tmpdir(), 'tw-entry-contract-'));
      directories.push(root);
      const cwd = join(root, 'candidate'), destination = join(root, 'copy');
      mkdirSync(cwd);
      mkdirSync(destination);
      const git = (...args: string[]): void => { execFileSync('git', args, { cwd, timeout: 10_000, maxBuffer: 1024 * 1024 }); };
      git('init', '-q');
      git('config', 'user.name', 'test');
      git('config', 'user.email', 'test@example.invalid');
      const relative = 'entry.txt', path = join(cwd, relative), outside = join(root, 'outside');
      writeFileSync(path, 'old bytes\n');
      writeFileSync(outside, 'outside bytes\n');
      git('add', relative);
      git('commit', '-qm', 'candidate entry fixture');
      return { cwd, destination, relative, path, outside };
    };

    it('reads the current regular bytes rather than the committed bytes', () => {
      const entry = fixture();
      writeFileSync(entry.path, 'new bytes\n');
      expect(read(entry)).toBe('new bytes\n');
    });

    it('reads a replacement inode even when its size and timestamps match', () => {
      const entry = fixture(), before = statSync(entry.path), replacement = join(entry.cwd, 'replacement');
      writeFileSync(replacement, 'new bytes\n');
      utimesSync(replacement, before.atime, before.mtime);
      renameSync(replacement, entry.path);
      expect(read(entry)).toBe('new bytes\n');
    });

    it('preserves absence when a listed input was removed before inspection', () => {
      const entry = fixture();
      rmSync(entry.path);
      expect(read(entry)).toBeNull();
    });

    it('refuses a directory in place of the listed file', () => {
      const entry = fixture();
      rmSync(entry.path);
      mkdirSync(entry.path);
      expect(() => read(entry)).toThrow(/directory/);
    });

    it.skipIf(process.platform === 'win32')('refuses a FIFO in place of the listed file', () => {
      const entry = fixture();
      rmSync(entry.path);
      execFileSync('mkfifo', [entry.path], { timeout: 10_000 });
      expect(() => read(entry)).toThrow(/fifo|special file/);
    });

    it.skipIf(process.platform === 'win32')('does not import outside bytes through a replacement symlink', () => {
      const entry = fixture();
      rmSync(entry.path);
      symlinkSync(entry.outside, entry.path);
      expect(() => read(entry)).toThrow(/symbolic link|symlink/);
    });
  });
}
