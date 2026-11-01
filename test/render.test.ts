// Presentation tests. These guard the accessibility contract, not the prose: severity
// must survive with colour stripped, GitHub's workflow-command grammar must not be
// breakable by finding text, and `--json` must keep the shape its consumers already read.

import { describe, expect, it } from 'vitest';
import { Finding } from '../src/types';
import { colourEnabled, orderFindings, renderText, terminalWidth } from '../src/cli/render/text';
import { annotations, renderSummary } from '../src/cli/render/github';
import { isFormat, resolveFormat } from '../src/cli/report';

const ESC = '\u001b';
const ANSI = /\u001b\[[0-9;]*m/g;

function finding(over: Partial<Finding> = {}): Finding {
  return {
    rule: 'test-deletion',
    severity: 'block',
    file: 'src/calc.test.ts',
    line: 12,
    message: '4 test cases were removed from a protected test file.',
    evidence: "  it('rejects a negative balance', () => {",
    remediation: 'Restore the tests and fix the code under test.',
    signoff: { required: true, command: 'tamperward allow test-deletion --reason "..."' },
    ...over,
  };
}

const plain = { colour: false, width: 100 };

describe('text renderer', () => {
  it('states the verdict before any detail, so it survives a truncated scroll', () => {
    const out = renderText({ findings: [finding()], scanned: 3, ignoredFiles: 0 }, plain);
    expect(out.split('\n')[0]).toBe('tamperward: 1 blocking');
  });

  it('carries severity as a word, so stripping colour loses nothing', () => {
    const coloured = renderText({ findings: [finding()], scanned: 1, ignoredFiles: 0 }, { ...plain, colour: true });
    const mono = renderText({ findings: [finding()], scanned: 1, ignoredFiles: 0 }, plain);
    expect(coloured.replace(ANSI, '')).toBe(mono);
    expect(mono).toContain('BLOCK');
  });

  it('emits no escape sequences at all when colour is off', () => {
    const out = renderText(
      { findings: [finding(), finding({ severity: 'warn', rule: 'guard-removal' })], scanned: 2, ignoredFiles: 1 },
      plain,
    );
    expect(out).not.toContain(ESC);
  });

  it('keeps path:line together so the terminal can linkify it', () => {
    const out = renderText({ findings: [finding()], scanned: 1, ignoredFiles: 0 }, plain);
    expect(out).toContain('src/calc.test.ts:12');
  });

  it('labels a command finding rather than leaving the location blank', () => {
    const out = renderText(
      { findings: [finding({ rule: 'no-verify', file: undefined, line: undefined })], scanned: 1, ignoredFiles: 0 },
      plain,
    );
    expect(out).toContain('(command)');
  });

  it('never exceeds the requested measure', () => {
    const long = finding({
      message: 'A very long sentence '.repeat(20),
      remediation: 'Another long sentence '.repeat(20),
    });
    const out = renderText({ findings: [long], scanned: 1, ignoredFiles: 0 }, { colour: false, width: 60 });
    for (const line of out.split('\n')) expect(line.length).toBeLessThanOrEqual(60);
  });

  it('clips evidence instead of reflowing it — a wrapped source line stops being quotable', () => {
    const out = renderText(
      { findings: [finding({ evidence: 'x'.repeat(300) })], scanned: 1, ignoredFiles: 0 },
      { colour: false, width: 60 },
    );
    expect(out).toContain('…');
    expect(out).not.toContain('x'.repeat(300));
  });

  it('reports clean without inventing findings', () => {
    const out = renderText({ findings: [], scanned: 7, ignoredFiles: 2 }, plain);
    expect(out).toContain('clean');
    expect(out).toContain('7 changes scanned, 2 files ignored by policy');
  });

  it('singularises counts', () => {
    expect(renderText({ findings: [], scanned: 1, ignoredFiles: 1 }, plain)).toContain(
      '1 change scanned, 1 file ignored by policy',
    );
  });

  it('orders blocking findings ahead of warnings, then by file and line', () => {
    const ordered = orderFindings([
      finding({ severity: 'warn', file: 'a.ts', line: 1 }),
      finding({ severity: 'block', file: 'b.ts', line: 9 }),
      finding({ severity: 'block', file: 'b.ts', line: 2 }),
      finding({ severity: 'block', file: 'a.ts', line: 5 }),
    ]);
    expect(ordered.map((f) => `${f.severity}:${f.file}:${f.line}`)).toEqual([
      'block:a.ts:5',
      'block:b.ts:2',
      'block:b.ts:9',
      'warn:a.ts:1',
    ]);
  });
});

describe('colour detection', () => {
  const tty = { isTTY: true };
  it('is on for a TTY', () => expect(colourEnabled({}, tty)).toBe(true));
  it('is off when piped', () => expect(colourEnabled({}, { isTTY: false })).toBe(false));
  it('honours NO_COLOR at any non-empty value', () => {
    expect(colourEnabled({ NO_COLOR: '1' }, tty)).toBe(false);
    expect(colourEnabled({ NO_COLOR: '0' }, tty)).toBe(false);
  });
  it('treats an empty NO_COLOR as unset, per the convention', () =>
    expect(colourEnabled({ NO_COLOR: '' }, tty)).toBe(true));
  it('lets FORCE_COLOR re-enable colour off a TTY', () =>
    expect(colourEnabled({ FORCE_COLOR: '1' }, { isTTY: false })).toBe(true));
  it('respects FORCE_COLOR=0', () => expect(colourEnabled({ FORCE_COLOR: '0' }, { isTTY: false })).toBe(false));
  it('gives NO_COLOR precedence over FORCE_COLOR', () =>
    expect(colourEnabled({ NO_COLOR: '1', FORCE_COLOR: '1' }, tty)).toBe(false));
  it('is off on a dumb terminal', () => expect(colourEnabled({ TERM: 'dumb' }, tty)).toBe(false));
});

describe('terminal width', () => {
  it('falls back to 80 when the width is unknown', () => expect(terminalWidth({})).toBe(80));
  it('caps at 100 so the measure stays readable', () => expect(terminalWidth({ columns: 400 })).toBe(100));
  it('ignores an implausibly narrow report', () => expect(terminalWidth({ columns: 10 })).toBe(80));
  it('uses the real width in between', () => expect(terminalWidth({ columns: 72 })).toBe(72));
});

describe('github annotations', () => {
  it('maps block to error and warn to warning', () => {
    const [a, b] = annotations([finding(), finding({ severity: 'warn', file: 'z.ts' })]);
    expect(a.startsWith('::error ')).toBe(true);
    expect(b.startsWith('::warning ')).toBe(true);
  });

  it('carries file and line so GitHub can place it on the diff', () => {
    expect(annotations([finding()])[0]).toContain('file=src/calc.test.ts,line=12');
  });

  it('omits file properties for a command finding rather than emitting an empty path', () => {
    const a = annotations([finding({ rule: 'no-verify', file: undefined, line: undefined })])[0];
    expect(a).not.toContain('file=');
    expect(a).toContain('title=tamperward%3A no-verify');
  });

  it('escapes the property delimiters, so a comma in a path cannot forge a property', () => {
    const a = annotations([finding({ file: 'weird,name:1.ts', line: 3 })])[0];
    expect(a).toContain('file=weird%2Cname%3A1.ts');
    // file, line, title — and nothing injected between them.
    expect(a.slice('::error '.length).split('::')[0].split(',').length).toBe(3);
  });

  it('escapes newlines in the message, so a finding cannot end the command early', () => {
    const a = annotations([finding({ message: 'line one\nline two', remediation: 'x' })])[0];
    expect(a).not.toContain('\n');
    expect(a).toContain('%0A');
  });

  it('escapes percent first, so an escape sequence in the text is not double-decoded', () => {
    expect(annotations([finding({ message: '100%25 covered', remediation: 'x' })])[0]).toContain('100%2525 covered');
  });

  it('includes the remediation, since the annotation may be all a reviewer reads', () => {
    expect(annotations([finding()])[0]).toContain('Restore the tests');
  });
});

describe('github job summary', () => {
  const env = {
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'hexrift/tamperward',
    GITHUB_SHA: 'abc123',
  };

  it('leads with the verdict as a heading', () => {
    expect(renderSummary({ findings: [finding()], scanned: 2, ignoredFiles: 0 }, {})).toMatch(
      /^## Tamperward: 1 blocking/,
    );
  });

  it('is a real table with a header row, not aligned whitespace', () => {
    const md = renderSummary({ findings: [finding()], scanned: 1, ignoredFiles: 0 }, {});
    expect(md).toContain('| Severity | Rule | Location | Finding | Instead |');
    expect(md).toContain('| --- | --- | --- | --- | --- |');
  });

  it('spells out the severity rather than relying on a colour or a glyph', () => {
    const md = renderSummary(
      { findings: [finding(), finding({ severity: 'warn' })], scanned: 2, ignoredFiles: 0 },
      {},
    );
    expect(md).toContain('| **BLOCK** |');
    expect(md).toContain('| warn |');
  });

  it('deep-links the location when Actions supplies the context', () => {
    expect(renderSummary({ findings: [finding()], scanned: 1, ignoredFiles: 0 }, env)).toContain(
      '(https://github.com/hexrift/tamperward/blob/abc123/src/calc.test.ts#L12)',
    );
  });

  it('encodes reserved filename characters without changing the URL fragment', () => {
    const file = 'tests/topic#1?.test % (✓).ts';
    const md = renderSummary(
      { findings: [finding({ file, line: 3 })], scanned: 1, ignoredFiles: 0 },
      env,
    );
    const target = md.match(/\]\((https?:\/\/[^)]*#L3)\)/)?.[1];
    expect(target).toBeTruthy();
    const url = new URL(target!);
    expect(url.search).toBe('');
    expect(url.hash).toBe('#L3');
    const encodedPath = '/blob/abc123/';
    expect(decodeURIComponent(url.pathname.slice(url.pathname.indexOf(encodedPath) + encodedPath.length))).toBe(file);
    expect(url.pathname).toContain('topic%231%3F.test%20%25%20%28%E2%9C%93%29.ts');
  });

  it('degrades to a plain code span without that context', () => {
    const md = renderSummary({ findings: [finding()], scanned: 1, ignoredFiles: 0 }, {});
    expect(md).toContain('`src/calc.test.ts:12`');
    expect(md).not.toContain('](');
  });

  it('escapes a pipe in finding text so it cannot split the row', () => {
    const md = renderSummary(
      { findings: [finding({ message: 'a | b', remediation: 'c | d' })], scanned: 1, ignoredFiles: 0 },
      {},
    );
    const row = md.split('\n').find((l) => l.includes('**BLOCK**'))!;
    expect(row.split(/(?<!\\)\|/).length - 1).toBe(6); // 5 cells => 6 unescaped pipes
  });

  it('flattens a multi-line message so it cannot end the row', () => {
    const md = renderSummary({ findings: [finding({ message: 'one\ntwo' })], scanned: 1, ignoredFiles: 0 }, {});
    expect(md).toContain('one two');
  });

  it('lists each distinct sign-off command once', () => {
    const md = renderSummary({ findings: [finding(), finding({ line: 40 })], scanned: 2, ignoredFiles: 0 }, {});
    expect(md.match(/tamperward allow test-deletion/g)?.length).toBe(1);
  });

  it('omits the sign-off section when nothing needs one', () => {
    const md = renderSummary(
      {
        findings: [finding({ severity: 'warn', signoff: { required: false, command: '' } })],
        scanned: 1,
        ignoredFiles: 0,
      },
      {},
    );
    expect(md).not.toContain('Clearing a blocking finding');
  });

  it('says so when there is nothing to report', () => {
    expect(renderSummary({ findings: [], scanned: 4, ignoredFiles: 0 }, {})).toContain('Tamperward: clean');
  });
});

describe('format resolution', () => {
  it('defaults to text off CI', () => expect(resolveFormat({}, {})).toBe('text'));
  it('defaults to github under Actions', () =>
    expect(resolveFormat({}, { GITHUB_ACTIONS: 'true' })).toBe('github'));
  it('keeps --json meaning json even under Actions', () =>
    expect(resolveFormat({ json: true }, { GITHUB_ACTIONS: 'true' })).toBe('json'));
  it('lets --format override the detection', () =>
    expect(resolveFormat({ format: 'text' }, { GITHUB_ACTIONS: 'true' })).toBe('text'));
  it('treats auto as detection', () =>
    expect(resolveFormat({ format: 'auto' }, { GITHUB_ACTIONS: 'true' })).toBe('github'));
  it('rejects an unknown format name', () => {
    expect(isFormat('github')).toBe(true);
    expect(isFormat('unknown')).toBe(false);
  });
});
