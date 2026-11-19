// #429: `runner.modifier.each` chains were read three different ways. test-skip's AST
// path required `skip|only|todo` to be the LAST hop, so `describe.only.each` and
// `it.skip.each` were never an AST hit (the single-line regex caught them by luck;
// the multi-line spelling walked past both). test-deletion did not unwrap a
// modifier between the runner and `each`, so `it.each` → `it.concurrent.each` read
// as every row deleted and blocked a refactor. assertion-weakening accepted only a
// bare `it(...)` / `describe(...)`, so `it.concurrent('adds', …)` and a test under
// `describe.each(...)('…')` were never compared. One chain reader serves all three.
import { describe, expect, it } from 'vitest';
import { parseDiff } from '../src/diff/parse';
import { defaultPolicy } from '../src/policy';
import { testSkip } from '../src/detectors/test-skip';
import { testDeletion, countTestBlocks } from '../src/detectors/test-deletion';
import { assertionWeakening } from '../src/detectors/assertion-weakening';
import type { Change } from '../src/types';

const P = defaultPolicy();
const PATH = 'src/a.spec.ts';

/** The same edit on both producers: `diffOnly` is what the pure diff parser hands a
 *  detector (hunks, no content); `full` carries BEFORE/AFTER the git builder loads. */
function both(before: string, after: string): { diffOnly: Change[]; full: Change[] } {
  const b = before.split('\n');
  const a = after.split('\n');
  const diff = [
    `diff --git a/${PATH} b/${PATH}`,
    `--- a/${PATH}`,
    `+++ b/${PATH}`,
    `@@ -1,${b.length} +1,${a.length} @@`,
    ...b.map((l) => `-${l}`),
    ...a.map((l) => `+${l}`),
    '',
  ].join('\n');
  const diffOnly = parseDiff(diff);
  const full = diffOnly.map((c): Change => (c.kind === 'file' ? { ...c, before, after } : c));
  return { diffOnly, full };
}

const messages = (d: { run: (c: Change[], p: typeof P) => Array<{ message: string }> }, c: Change[]) =>
  d.run(c, P).map((f) => f.message);

const SKIP_MARKER = 'Test skipped or narrowed: a .skip/.only/.todo marker.';

describe('test-skip reads a skip/focus marker anywhere before .each / .for (#429)', () => {
  it('describe.each → describe.only.each is a focus marker on both producers', () => {
    const { diffOnly, full } = both(
      "describe.each([[1], [2]])('n %s', (n) => { it('x', () => {}); });",
      "describe.only.each([[1], [2]])('n %s', (n) => { it('x', () => {}); });",
    );
    expect(messages(testSkip, diffOnly)).toEqual([SKIP_MARKER]);
    expect(messages(testSkip, full)).toEqual([SKIP_MARKER]);
    // the focus is not a deletion: two rows before, two rows after
    expect(messages(testDeletion, full)).toEqual([]);
  });

  it('it.each → it.skip.each is a skip marker on both producers, not a "2 → 0 blocks" deletion', () => {
    const { diffOnly, full } = both(
      "it.each([[1], [2]])('n %s', (n) => { expect(n).toBeGreaterThan(0); });",
      "it.skip.each([[1], [2]])('n %s', (n) => { expect(n).toBeGreaterThan(0); });",
    );
    expect(messages(testSkip, diffOnly)).toEqual([SKIP_MARKER]);
    expect(messages(testSkip, full)).toEqual([SKIP_MARKER]);
    expect(messages(testDeletion, full)).toEqual([]);
  });

  it('finds the marker in a multi-line chain the line matcher cannot see (AST only)', () => {
    const before = [
      "import { describe, it } from 'vitest';",
      'describe',
      '  .each([[1], [2]])',
      "  ('n %s', (n) => { it('x', () => {}); });",
    ].join('\n');
    const after = [
      "import { describe, it } from 'vitest';",
      'describe',
      '  .only',
      '  .each([[1], [2]])',
      "  ('n %s', (n) => { it('x', () => {}); });",
    ].join('\n');
    const f = testSkip.run(both(before, after).full, P);
    expect(f.map((x) => x.message)).toEqual([SKIP_MARKER]);
    expect(f[0].line).toBe(3);
  });

  it('reads the marker through a concurrency modifier on either side of it, and .for like .each', () => {
    for (const after of [
      "it.concurrent.skip.each([[1]])('n %s', () => {});",
      "it.skip.concurrent.each([[1]])('n %s', () => {});",
      "it.todo.each([[1]])('n %s', () => {});",
      "describe.only.for([[1]])('n %s', () => { it('x', () => {}); });",
      "it.concurrent.only.for([[1]])('n %s', () => {});",
    ]) {
      const { diffOnly, full } = both("it.each([[1]])('n %s', () => {});", after);
      expect(messages(testSkip, diffOnly), after).toEqual([SKIP_MARKER]);
      expect(messages(testSkip, full), after).toEqual([SKIP_MARKER]);
    }
  });

  it('is silent on a modifier chain that carries no marker', () => {
    const { diffOnly, full } = both(
      "it.each([[1]])('n %s', () => {});",
      "it.concurrent.each([[1]])('n %s', () => {});",
    );
    expect(messages(testSkip, diffOnly)).toEqual([]);
    expect(messages(testSkip, full)).toEqual([]);
  });

  it('does not inherit a marker for a proven non-runner root', () => {
    const src = [
      'const it = { skip: { each: (_t: unknown[]) => (_n: string, _f: () => void) => {} } };',
      "it.skip.each([[1]])('n %s', () => {});",
    ].join('\n');
    const f = testSkip.run(both("const it = 1;", src).full, P);
    expect(f).toHaveLength(0);
  });
});

describe('test-deletion unwraps chain modifiers before .each / .for (#429)', () => {
  it('counts each-table rows through a modifier', () => {
    expect(countTestBlocks("it.concurrent.each([[1], [2], [3]])('n %s', () => {});")).toBe(3);
    expect(countTestBlocks("test.skip.each([[1], [2]])('n %s', () => {});")).toBe(2);
    expect(countTestBlocks("it.concurrent.for([[1], [2]])('n %s', () => {});")).toBe(2);
    expect(countTestBlocks('it.concurrent.each`\n a | b\n 1 | 2\n 3 | 4\n`("n", () => {});')).toBe(2);
    expect(countTestBlocks("describe.concurrent.each([[1], [2]])('n %s', () => { it('x', () => {}); });")).toBe(2);
    expect(countTestBlocks("describe.only.each([[1], [2]])('n %s', () => { it('x', () => {}); it('y', () => {}); });")).toBe(4);
    expect(countTestBlocks("it.concurrent.skip('x', () => {}); it.concurrent.only('y', () => {});")).toBe(2);
  });

  it('it.each → it.concurrent.each is a refactor with the same block count (control)', () => {
    const { diffOnly, full } = both(
      "it.each([[1], [2], [3]])('n %s', (n) => { expect(n).toBeGreaterThan(0); });",
      "it.concurrent.each([[1], [2], [3]])('n %s', (n) => { expect(n).toBeGreaterThan(0); });",
    );
    expect(messages(testDeletion, full)).toEqual([]);
    expect(messages(testDeletion, diffOnly)).toEqual([]);
  });

  it('describe.each → describe.concurrent.each is a refactor (control)', () => {
    const { full } = both(
      "describe.each([[1], [2]])('n %s', (n) => { it('x', () => { expect(n).toBe(n); }); });",
      "describe.concurrent.each([[1], [2]])('n %s', (n) => { it('x', () => { expect(n).toBe(n); }); });",
    );
    expect(messages(testDeletion, full)).toEqual([]);
  });

  it('still counts rows dropped from a modifier-chained table as deleted', () => {
    const { full } = both(
      "it.concurrent.each([[1], [2], [3]])('n %s', (n) => { expect(n).toBeGreaterThan(0); });",
      "it.concurrent.each([[1]])('n %s', (n) => { expect(n).toBeGreaterThan(0); });",
    );
    const f = messages(testDeletion, full);
    expect(f).toHaveLength(1);
    expect(f[0]).toContain('3 → 1');
  });
});

describe('assertion-weakening compares modifier-chained and describe.each identities (#429)', () => {
  it('it.concurrent(…) is compared like it(…) (full content); diff-only has no content to compare', () => {
    const { diffOnly, full } = both(
      "it.concurrent('adds', () => { expect(sum(1, 1)).toBe(2); });",
      "it.concurrent('adds', () => { expect(sum(1, 1)).toBeDefined(); });",
    );
    const f = assertionWeakening.run(full, P);
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('"adds"');
    expect(f[0].message).toMatch(/toBe was replaced by weaker toBeDefined/);
    expect(assertionWeakening.run(diffOnly, P)).toHaveLength(0);
  });

  it('a test under describe.each(table)(title) is paired by that title', () => {
    const { full } = both(
      "describe.each([[1], [2]])('n=%s', (n) => { it('adds', () => { expect(sum(n, 1) > n).toBe(true); }); });",
      "describe.each([[1], [2]])('n=%s', (n) => { it('adds', () => { expect(sum(n, 1) > n).toBeTruthy(); }); });",
    );
    const f = assertionWeakening.run(full, P);
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('"n=%s > adds"');
  });

  it('a modifier chain on the suite and a chain on the test pair alike', () => {
    const { full } = both(
      "describe.concurrent('math', () => { test.sequential('throws', () => { expect(() => parse('!')).toThrow(/bad/); }); });",
      "describe.concurrent('math', () => { test.sequential('throws', () => { expect(() => parse('!')).toThrow(); }); });",
    );
    const f = assertionWeakening.run(full, P);
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('"math > throws"');
  });

  it('describe.each → describe.each with an ordinary body change is judged normally (control)', () => {
    const { full } = both(
      "describe.each([[1], [2]])('n=%s', (n) => { it('adds', () => { expect(sum(n, 1)).toBe(n + 1); }); });",
      "describe.each([[1], [2]])('n=%s', (n) => { it('adds', () => { expect(sum(n, 1)).toBe(n + 1); expect(n).toBeGreaterThan(0); }); });",
    );
    expect(assertionWeakening.run(full, P)).toHaveLength(0);
  });

  it('a nested modifier-chained test is not folded into its parent block', () => {
    const { full } = both(
      "describe('outer', () => { it('a', () => { expect(x).toBe(1); }); it.concurrent('b', () => { expect(y).toBe(2); }); });",
      "describe('outer', () => { it('a', () => { expect(x).toBe(1); }); it.concurrent('b', () => { expect(y).toBe(3); }); });",
    );
    // literal → literal is deliberately not a finding; and 'b' must not be read as
    // an assertion removed from 'a'
    expect(assertionWeakening.run(full, P)).toHaveLength(0);
  });
});
