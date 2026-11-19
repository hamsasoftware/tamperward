import { describe, expect, it } from 'vitest';
import { globMatch } from '../src/detectors/hook-wiring.js';

describe('globMatch', () => {
  it('matches * and ? wildcards over a whole name', () => {
    expect(globMatch('pre-*', 'pre-commit')).toBe(true);
    expect(globMatch('*.json', 'settings.json')).toBe(true);
    expect(globMatch('lefthook.y?l', 'lefthook.yml')).toBe(true);
    expect(globMatch('pre-*', 'commit-msg')).toBe(false);
    expect(globMatch('settings', 'settings.json')).toBe(false);
    expect(globMatch('*', '')).toBe(true);
    expect(globMatch('', 'x')).toBe(false);
  });

  it('treats regex metacharacters literally', () => {
    expect(globMatch('a.b', 'a.b')).toBe(true);
    expect(globMatch('a.b', 'axb')).toBe(false);
    expect(globMatch('(x)+', '(x)+')).toBe(true);
  });

  it('stays fast on a hostile many-star pattern', () => {
    const hostile = 'a*'.repeat(60) + 'b';
    const start = Date.now();
    expect(globMatch(hostile, 'a'.repeat(40))).toBe(false);
    expect(Date.now() - start).toBeLessThan(200);
  });
});
