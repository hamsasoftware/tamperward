import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const script = join(__dirname, '..', '.github/docs/docs-smoke.mjs');

const run = (root: string) =>
  spawnSync(process.execPath, [script, root], { encoding: 'utf8' });

// A minimal VitePress artifact: the rules page the #513 check requires, a home
// page without <main>, and the `/tamperward/` base read off an asset reference.
const BASE = '/tamperward/';
const page = (body: string) =>
  `<html><head><link rel="stylesheet" href="${BASE}assets/style.css"></head><body><main><div class="vp-doc">${body}</div></main></body></html>`;

function scaffold(root: string): void {
  mkdirSync(join(root, 'guide'), { recursive: true });
  mkdirSync(join(root, 'research'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<div class="VPHome"><h1>Home</h1></div>');
  writeFileSync(
    join(root, 'guide/rules.html'),
    page('<h1 id="the-rules" tabindex="-1">The rules <a class="header-anchor" href="#the-rules">​</a></h1><p><code>ci-tampering</code></p>'),
  );
  writeFileSync(
    join(root, 'research/round-4.html'),
    page(
      '<h1 id="round-4" tabindex="-1">Round 4</h1>' +
        '<h2 id="security-result" tabindex="-1">Security result — 0 strict tamper bypasses, stated precisely <a class="header-anchor" href="#security-result">​</a></h2>' +
        '<h2 id="deviations" tabindex="-1">Deviations</h2>',
    ),
  );
}

describe('rendered-site fragment check (#532)', () => {
  it('resolves fragment-only, relative and base-prefixed links and leaves external links alone', () => {
    const root = mkdtempSync(join(tmpdir(), 'tamperward-docs-'));
    try {
      scaffold(root);
      writeFileSync(
        join(root, 'research/security-evaluations.html'),
        page(
          '<h1 id="security-evaluations">Security evaluations</h1>' +
            '<a href="#security-evaluations">same page</a>' +
            '<a href="./round-4.html#security-result">relative with extension</a>' +
            '<a href="./round-4#deviations">relative, cleanUrls spelling</a>' +
            '<a href="../guide/rules.html#the-rules">parent-relative</a>' +
            `<a href="${BASE}research/round-4.html#security-result">base-prefixed</a>` +
            `<a href="${BASE}guide/rules.html">base-prefixed page, no fragment</a>` +
            `<a href="${BASE}">site root</a>` +
            '<a href="https://github.com/hamsasoftware/tamperward#readme">external</a>' +
            '<a href="mailto:security@example.invalid">mailto</a>' +
            '<a href="//cdn.example.invalid/x.html#frag">protocol-relative</a>' +
            '<a href="./round-4?ref=1#deviations">query string</a>',
        ),
      );
      const result = run(root);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a fragment that is not an id on the target page (the #532 symptom)', () => {
    const root = mkdtempSync(join(tmpdir(), 'tamperward-docs-'));
    try {
      scaffold(root);
      // The heading slug kept its em dash; the hand-written link did not.
      writeFileSync(
        join(root, 'research/security-evaluations.html'),
        page('<a href="./round-4#security-result-0-strict-tamper-bypasses-stated-precisely">Round 4 page</a>'),
      );
      const result = run(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('docs smoke test failed');
      expect(result.stderr).toContain(
        'fragment #security-result-0-strict-tamper-bypasses-stated-precisely is not an id on research/round-4.html (linked from research/security-evaluations.html)',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a local link whose target page does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'tamperward-docs-'));
    try {
      scaffold(root);
      writeFileSync(
        join(root, 'research/security-evaluations.html'),
        page('<a href="./round-5#security-result">missing page</a>' + `<a href="${BASE}guide/missing.html">missing base-prefixed page</a>`),
      );
      const result = run(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('local link target does not exist: ./round-5#security-result (from research/security-evaluations.html)');
      expect(result.stderr).toContain(`local link target does not exist: ${BASE}guide/missing.html (from research/security-evaluations.html)`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a site-absolute link that escapes the configured base', () => {
    const root = mkdtempSync(join(tmpdir(), 'tamperward-docs-'));
    try {
      scaffold(root);
      writeFileSync(
        join(root, 'research/security-evaluations.html'),
        page('<a href="/research/round-4.html#security-result">base dropped</a>'),
      );
      const result = run(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`site-absolute link outside the base ${BASE}: /research/round-4.html#security-result`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
