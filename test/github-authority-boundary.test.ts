import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateGitHubProtection as pure } from '../src/github-authority';
import { evaluateGitHubProtection as doctorExport } from '../src/cli/doctor';

describe('GitHub authority module boundary (#800)', () => {
  it('preserves the existing doctor export while letting admission code import the evaluator directly', () => {
    expect(doctorExport).toBe(pure);
  });

  it('keeps the evaluator independent of API transport, filesystem, subprocesses and CLI rendering', () => {
    const source = readFileSync(join(__dirname, '../src/github-authority.ts'), 'utf8');
    expect(source).not.toMatch(/(?:from|import\()\s*['"](?:node:)?(?:fs|child_process)/);
    expect(source).not.toMatch(/(?:from|import\()\s*['"].*\/cli\//);
    expect(source).not.toMatch(/\b(?:fetch|spawnSync|execFileSync|readFileSync)\s*\(/);
  });
});
