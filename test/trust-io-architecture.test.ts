import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditTrustIo, type TrustIoException } from './support/trust-io-contract';

const readException: TrustIoException = { name: 'TEST-REVIEWED-READ', owner: 'read', api: 'node:fs.readFileSync', calls: 1 };

describe('trust I/O architecture checker', () => {
  it('permits an explicitly reviewed call through an imported alias', () => {
    expect(auditTrustIo("import { readFileSync as load } from 'node:fs'; function read() { return load('input'); }", [readException])).toEqual([]);
  });

  it.each([
    "import { readFileSync } from 'node:fs'; function read() { return readFileSync('input'); }",
    "import * as fs from 'node:fs'; fs.readFileSync('input');",
    "const fs = require('fs'); fs.readFileSync('input');",
    "globalThis['require']('fs').readFileSync('input');",
    "import('node:child_process').then(p => p.execSync('command'));",
    "process.getBuiltinModule('fs').readFileSync('input');",
    "globalThis['process']['stdout'].write('output');",
    "const runtime = process; runtime.stdout.write('output');",
    "const runtime = globalThis.process; runtime.stdout.write('output');",
    "const runtime = globalThis['process']; runtime.stdout.write('output');",
    "export { readFileSync } from 'node:fs';",
    "import fs = require('node:fs'); fs.readFileSync('input');",
  ])('rejects unreviewed raw I/O: %s', source => {
    expect(auditTrustIo(source, [])).not.toEqual([]);
  });

  it('rejects extra calls, moved owners, stale exceptions and extracted aliases', () => {
    for (const source of [
      "import { readFileSync as load } from 'node:fs'; function read() { load('one'); return load('two'); }",
      "import { readFileSync as load } from 'node:fs'; function another() { return load('input'); }",
      "import { readFileSync as load } from 'node:fs'; const indirect = load; function read() { return indirect('input'); }",
      "function read() { load('first'); return load('second'); } import { readFileSync as load } from 'node:fs';",
      'function read() { return null; }',
    ]) expect(auditTrustIo(source, [readException])).not.toEqual([]);
  });

  it('ignores I/O spellings inside data and permits pure environment inspection', () => {
    const source = `const source = "require('fs').readFileSync('input')"; const environment = process.env;`;
    expect(auditTrustIo(source, [])).toEqual([]);
  });
});

const snapshotExceptions: TrustIoException[] = [
  { name: 'SNAPSHOT-LIVE-LIST', owner: 'git', api: 'node:child_process.execFileSync', calls: 1 },
  { name: 'SNAPSHOT-TREE-CONTAINMENT', owner: 'safeSymlink', api: 'node:fs.rmSync', calls: 1 },
  { name: 'SNAPSHOT-TREE-CONTAINMENT', owner: 'safeSymlink', api: 'node:fs.symlinkSync', calls: 1 },
  { name: 'SNAPSHOT-DEPENDENCY-DOMAIN', owner: 'validateSymlinkGraph', api: 'node:fs.lstatSync', calls: 1 },
  { name: 'SNAPSHOT-DEPENDENCY-DOMAIN', owner: 'validateSymlinkGraph', api: 'node:fs.readlinkSync', calls: 1 },
  { name: 'SNAPSHOT-TREE-CONTAINMENT', owner: 'rejectLinkedParent', api: 'node:fs.lstatSync', calls: 1 },
  ...['lstatSync', 'mkdirSync', 'readlinkSync', 'cpSync', 'chmodSync', 'symlinkSync'].map(api => ({
    name: 'SNAPSHOT-ENTRY-SHAPE', owner: 'materialize', api: `node:fs.${api}`, calls: 1,
  })),
  ...['writeFileSync', 'existsSync', 'rmSync'].map(api => ({
    name: 'SNAPSHOT-VOLUME-CASE', owner: 'probeFilesystemCaseSensitivity', api: `node:fs.${api}`, calls: 1,
  })),
  ...['lstatSync', 'rmSync'].map(api => ({
    name: 'SNAPSHOT-DESTINATION-LINK', owner: 'dropSymlink', api: `node:fs.${api}`, calls: 1,
  })),
];

describe('selected trust primitive I/O boundaries (#800)', () => {
  it.each([
    ['src/candidate-snapshot.ts', snapshotExceptions],
    ['src/git/trusted.ts', [
      { name: 'GIT-METADATA-PATH', owner: 'gitPathOf', api: 'node:child_process.execFileSync', calls: 1 },
      { name: 'GIT-REWRITE-REFS', owner: 'objectRewriteState', api: 'node:child_process.execFileSync', calls: 1 },
    ]],
    ['src/git/process.ts', [
      { name: 'GIT-BOUNDED-READ', owner: 'readTrustedGit', api: 'node:child_process.execFileSync', calls: 1 },
      { name: 'GIT-ANCESTRY-RESULT', owner: 'trustedGitAncestor', api: 'node:child_process.spawnSync', calls: 1 },
    ]],
    ['src/github-authority.ts', []],
    ['src/external-oracle.ts', []],
  ] satisfies Array<[string, TrustIoException[]]>)('keeps %s within its reviewed exceptions', (path, exceptions) => {
    expect(auditTrustIo(readFileSync(join(__dirname, '..', path), 'utf8'), exceptions)).toEqual([]);
  });
});
