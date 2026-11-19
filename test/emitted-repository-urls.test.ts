import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSarif } from '../src/sarif';
import { planInit } from '../src/cli/init';

const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe('repository URLs emitted by the CLI', () => {
  it('SARIF points the tool and rule help at hamsasoftware/tamperward', () => {
    const text = JSON.stringify(checkSarif({ findings: [], scanned: 0, ignoredFiles: 0 }));
    expect(text).toContain('https://github.com/hamsasoftware/tamperward');
    expect(text).not.toContain('hexrift');
  });

  it('init writes a policy header linking hamsasoftware/tamperward', () => {
    const d = mkdtempSync(join(tmpdir(), 'tw-url-'));
    dirs.push(d);
    execFileSync('git', ['init', '-q'], { cwd: d });
    for (const a of planInit(d)) a.apply?.();
    const policy = readFileSync(join(d, '.tamperward.yml'), 'utf8');
    expect(policy).toContain('# Docs: https://github.com/hamsasoftware/tamperward#readme');
    expect(policy).not.toContain('hexrift');
  });
});
