// Final P2 batch from the external review.

import { describe, it, expect } from 'vitest';
import { defaultPolicy, isProtected } from '../src/policy';
import { assertRev } from '../src/git/build';
import { mdCode, mdUrl } from '../src/cli/render/github';

describe('P2-13: test protection must not be silently absent outside JS/TS', () => {
  const p = defaultPolicy();
  const cases: Array<[string, string]> = [
    ['python (pytest)', 'tests/test_thing.py'],
    ['python (suffix)', 'app/thing_test.py'],
    ['go', 'pkg/thing_test.go'],
    ['rust', 'tests/integration.rs'],
    ['ruby (rspec)', 'spec/models/thing_spec.rb'],
    ['java/gradle', 'src/test/java/com/x/ThingTest.java'],
    ['php', 'tests/ThingTest.php'],
    ['c#', 'Project.Tests/ThingTests.cs'],
    ['typescript (unchanged)', 'src/thing.test.ts'],
  ];
  for (const [lang, file] of cases) {
    it(`protects ${lang}: ${file}`, () => {
      expect(isProtected(file, p, 'tests')).toBe(true);
    });
  }

  it('does not protect ordinary source that merely mentions test', () => {
    expect(isProtected('src/testing-utils.ts', p, 'tests')).toBe(false);
    expect(isProtected('src/latest.py', p, 'tests')).toBe(false);
  });
});

describe('P2-16: a revision git would read as an option is refused', () => {
  it('rejects a leading dash', () => {
    expect(() => assertRev('--output=/tmp/pwn')).toThrow(/option/);
  });
  it('accepts ordinary revisions', () => {
    for (const r of ['HEAD', 'origin/main', 'a1b2c3d4', 'v1.2.3']) expect(assertRev(r)).toBe(r);
  });
});

describe('P2-14: a crafted path cannot break out of the job summary', () => {
  // The path is repository content interpolated into a markdown link inside a
  // code span; cell() escaped only `|`, so `)` or a backtick escaped the
  // construct into the rendered GITHUB_STEP_SUMMARY.
  const NASTY = 'test/a`)](https://evil.example/x)b.test.js';

  it('code-span rendering cannot be terminated by a backtick', () => {
    expect(mdCode(NASTY)).not.toContain('`');
  });

  it('the link target cannot be terminated by a paren', () => {
    const url = mdUrl(NASTY);
    expect(url).not.toContain(')');
    expect(url).not.toContain('(');
    expect(url).toContain('%29'); // the paren survives, encoded
  });

  it('ordinary paths are left readable', () => {
    expect(mdCode('src/thing.test.ts')).toBe('src/thing.test.ts');
    expect(mdUrl('src/thing.test.ts')).toBe('src/thing.test.ts');
  });
});
