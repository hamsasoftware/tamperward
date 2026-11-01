import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  compareInputFiles, consumerLock, inputDigest, normalizePackResult, publishArtifact,
  snapshotInputs, validateSchemas, verifyArtifact, verifyCli, verifyPackageTree, workingInputs,
  reviewedPullRequest, compareInputModes, inputModeDigest, workingInputModes,
  type CommandRunner, type InputFiles,
} from '../.github/scripts/release-artifact.mjs';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
const temporary = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tw-release-'));
  dirs.push(dir);
  return dir;
};
const encoded = (files: Record<string, string>): InputFiles => Object.fromEntries(
  Object.entries(files).map(([path, value]) => [path, Buffer.from(value)]),
);
const manifest = (version = '1.0.0') => ({
  name: 'tamperward', version, type: 'module', license: 'Apache-2.0',
  bin: { tamperward: 'dist/cli/index.js' }, files: ['dist', 'schemas', 'LICENSE', 'NOTICE'],
  scripts: { build: 'node build.mjs', prepublishOnly: 'node -e "process.exit(97)"' },
  dependencies: {},
});
const lock = (version = '1.0.0') => ({
  name: 'tamperward', version, lockfileVersion: 3,
  packages: { '': manifest(version) },
});
const schema = (name = 'check-v1.schema.json', version = '1.0.0') => JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://raw.githubusercontent.com/hexrift/tamperward/v${version}/schemas/${name}`,
  type: 'object', required: ['schema_version', 'findings'],
  properties: { schema_version: { const: 1 }, findings: { type: 'array' } },
});
const inputs = (version = '1.0.0'): InputFiles => encoded({
  'package.json': JSON.stringify(manifest(version)),
  'package-lock.json': JSON.stringify(lock(version)),
  'src/cli/index.ts': 'export const release = true;\n',
  'schemas/check-v1.schema.json': schema(),
  'schemas/oracle-v2.schema.json': schema('oracle-v2.schema.json'),
  LICENSE: 'license\n', NOTICE: 'notice\n', 'README.md': 'readme\n',
});
function writeFiles(root: string, files: InputFiles): void {
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
  }
}
const execute: CommandRunner = (command, args, options) => execFileSync(command, args, {
  ...options, encoding: 'utf8', timeout: 60_000, env: { ...process.env, npm_config_cache: join(tmpdir(), 'tw-release-npm-cache') },
});
function fixture(): { cwd: string; commit: string } {
  const cwd = temporary();
  writeFiles(cwd, inputs());
  const cli = '#!/usr/bin/env node\nconsole.log(JSON.stringify({schema_version:1,findings:[]}));\n';
  writeFileSync(join(cwd, 'build.mjs'), [
    "import { mkdirSync, writeFileSync } from 'node:fs';",
    "mkdirSync('dist/cli', { recursive: true });",
    `writeFileSync('dist/cli/index.js', ${JSON.stringify(cli)});`,
  ].join('\n'));
  execute('git', ['init', '-q'], { cwd });
  execute('git', ['add', '.'], { cwd });
  execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], { cwd });
  return { cwd, commit: execute('git', ['rev-parse', 'HEAD'], { cwd }).trim() };
}

describe('release input identity (#804)', () => {
  it('rejects lossy UTF-8 captures even when reviewed and final snapshots would otherwise compare equal', () => {
    const { cwd } = fixture();
    const path = 'src/cli/index.ts';
    const reviewedBytes = Buffer.concat([Buffer.from('// '), Buffer.from([0xff]), Buffer.from('\nexport const release = true;\n')]);
    const finalBytes = Buffer.from('// \ufffd\nexport const release = true;\n');
    writeFileSync(join(cwd, path), reviewedBytes);
    execute('git', ['add', path], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'reviewed bytes'], { cwd });
    const reviewed = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    writeFileSync(join(cwd, path), finalBytes);
    execute('git', ['add', path], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'final bytes'], { cwd });
    const released = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    expect(reviewedBytes.equals(finalBytes)).toBe(false);
    expect(execute('git', ['rev-parse', `${reviewed}:${path}`], { cwd })).not.toBe(execute('git', ['rev-parse', `${released}:${path}`], { cwd }));
    expect(execute('git', ['show', `${reviewed}:${path}`], { cwd })).toBe(execute('git', ['show', `${released}:${path}`], { cwd }));
    expect(() => compareInputFiles(snapshotInputs(cwd, released).files, workingInputs(cwd))).not.toThrow();
    expect(() => snapshotInputs(cwd, reviewed)).toThrow(/Git blob bytes differ: src\/cli\/index.ts/);
  });

  it('retains regular executable modes from the Git snapshot', () => {
    const { cwd } = fixture();
    execute('git', ['update-index', '--chmod=+x', 'src/cli/index.ts'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'executable input'], { cwd });
    const commit = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    expect(snapshotInputs(cwd, commit)).toMatchObject({ modes: { 'src/cli/index.ts': '100755', 'package.json': '100644' } });
  });

  it('rejects a reviewed symlink even when a later regular input has identical blob bytes', () => {
    const { cwd } = fixture();
    const blob = execute('git', ['hash-object', '-w', '--stdin'], { cwd, input: 'true' }).trim();
    execute('git', ['update-index', '--cacheinfo', '120000', blob, 'src/cli/index.ts'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'reviewed link'], { cwd });
    const reviewed = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    execute('git', ['update-index', '--cacheinfo', '100644', blob, 'src/cli/index.ts'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'regular release input'], { cwd });
    const released = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    expect(execute('git', ['show', `${reviewed}:src/cli/index.ts`], { cwd })).toBe(execute('git', ['show', `${released}:src/cli/index.ts`], { cwd }));
    expect(() => snapshotInputs(cwd, reviewed)).toThrow(/not a regular file/);
  });

  it('rejects a Git submodule as a release input', () => {
    const { cwd, commit } = fixture();
    execute('git', ['update-index', '--add', '--cacheinfo', '160000', commit, 'src/submodule'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'submodule input'], { cwd });
    const head = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    expect(() => snapshotInputs(cwd, head)).toThrow(/not a regular file/);
  });

  it('compares mode identities independently of bytes and binds names into their digest', () => {
    const regular = { 'src/input.ts': '100644' } as const;
    const executable = { 'src/input.ts': '100755' } as const;
    expect(() => compareInputModes(regular, regular)).not.toThrow();
    expect(() => compareInputModes(executable, executable)).not.toThrow();
    expect(() => compareInputModes(regular, executable)).toThrow(/mode changed/);
    expect(() => compareInputModes(regular, {})).toThrow(/file set/);
    expect(inputModeDigest(regular)).not.toBe(inputModeDigest(executable));
    expect(inputModeDigest(regular)).not.toBe(inputModeDigest({ 'src/other.ts': '100644' }));
  });

  it.skipIf(process.platform === 'win32')('rejects a working executable-mode change before building', () => {
    const { cwd, commit } = fixture();
    chmodSync(join(cwd, 'src/cli/index.ts'), 0o755);
    expect(workingInputModes(cwd)['src/cli/index.ts']).toBe('100755');
    expect(() => verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.0', run: execute })).toThrow(/mode changed/);
    expect(existsSync(join(cwd, 'dist'))).toBe(false);
  });

  it('selects the immutable reviewed head of the exact main merge', () => {
    const commit = 'a'.repeat(40), head = 'b'.repeat(40);
    const pull = { number: 42, merged_at: '2026-11-01T12:00:00Z', merge_commit_sha: commit,
      head: { sha: head }, base: { ref: 'main', repo: { full_name: 'hexrift/tamperward' } } };
    expect(reviewedPullRequest([pull], commit, 'hexrift/tamperward')).toEqual({ number: 42, head });
    for (const candidate of [
      { ...pull, merged_at: null }, { ...pull, merge_commit_sha: 'c'.repeat(40) },
      { ...pull, base: { ...pull.base, ref: 'feature' } },
      { ...pull, base: { ...pull.base, repo: { full_name: 'another/repository' } } },
      { ...pull, head: { sha: 'main' } }, { ...pull, number: '../42' },
    ]) expect(() => reviewedPullRequest([candidate], commit, 'hexrift/tamperward')).toThrow(/reviewed pull request/);
    expect(() => reviewedPullRequest([], commit, 'hexrift/tamperward')).toThrow(/reviewed pull request/);
    expect(() => reviewedPullRequest([pull, pull], commit, 'hexrift/tamperward')).toThrow(/reviewed pull request/);
  });

  it('accepts identical input bytes and binds the file names into the digest', () => {
    expect(() => compareInputFiles(inputs(), inputs())).not.toThrow();
    expect(inputDigest(encoded({ a: 'one' }))).not.toBe(inputDigest(encoded({ b: 'one' })));
  });

  it('accepts only the three version fields when an explicit version-only comparison is requested', () => {
    expect(() => compareInputFiles(inputs(), inputs('1.0.1'), { version: '1.0.1', allowVersionOnly: true })).not.toThrow();
    expect(() => compareInputFiles(inputs(), inputs('1.0.1'))).toThrow(/package/);
  });

  it.each(['src/cli/index.ts', 'schemas/oracle-v2.schema.json', 'NOTICE'])('rejects unexpected changes to %s', path => {
    const changed = inputs('1.0.1');
    changed[path] = Buffer.from('changed');
    expect(() => compareInputFiles(inputs(), changed, { version: '1.0.1', allowVersionOnly: true })).toThrow(path);
  });

  it.each(['package.json', 'package-lock.json'])('rejects dependency changes alongside version metadata in %s', path => {
    const changed = inputs('1.0.1');
    const value = JSON.parse(changed[path].toString());
    if (path === 'package.json') value.dependencies.yaml = '^2.8.0';
    else value.packages['node_modules/yaml'] = { version: '2.8.0', integrity: 'unexpected' };
    changed[path] = Buffer.from(JSON.stringify(value));
    expect(() => compareInputFiles(inputs(), changed, { version: '1.0.1', allowVersionOnly: true })).toThrow(path);
  });

  it('rejects inconsistent versions, missing inputs and new inputs', () => {
    expect(() => compareInputFiles(inputs(), inputs('1.0.2'), { version: '1.0.1', allowVersionOnly: true })).toThrow(/version/);
    const missing = inputs();
    delete missing['src/cli/index.ts'];
    expect(() => compareInputFiles(inputs(), missing)).toThrow(/file set/);
    expect(() => compareInputFiles(inputs(), { ...inputs(), 'src/new.ts': Buffer.from('new') })).toThrow(/file set/);
  });

  it('reads expected inputs from the named commit and rejects changed or untracked source files', () => {
    const { cwd, commit } = fixture();
    const expected = snapshotInputs(cwd, commit);
    expect(() => compareInputFiles(expected.files, workingInputs(cwd))).not.toThrow();
    writeFileSync(join(cwd, 'src/new.ts'), 'unexpected\n');
    expect(() => compareInputFiles(expected.files, workingInputs(cwd))).toThrow(/file set/);
    expect(() => snapshotInputs(cwd, '0'.repeat(40))).toThrow();
  });
});

describe('packed release contents (#804)', () => {
  it.each([[], [{ filename: '../escape.tgz' }], [{ filename: 'a.tgz' }, { filename: 'b.tgz' }], null])('rejects an ambiguous or unsafe pack result %j', value => {
    expect(() => normalizePackResult(value)).toThrow(/npm pack/);
  });

  it('accepts npm array and keyed result formats', () => {
    expect(normalizePackResult([{ filename: 'tamperward-1.0.0.tgz' }]).filename).toBe('tamperward-1.0.0.tgz');
    expect(normalizePackResult({ tamperward: { filename: 'tamperward-1.0.0.tgz' } }).filename).toBe('tamperward-1.0.0.tgz');
  });

  it('installs the tarball with the lock-pinned dependency graph and artifact integrity', () => {
    const original = { ...lock(), packages: { ...lock().packages, 'node_modules/yaml': { version: '2.8.0', integrity: 'sha512-pinned' } } };
    const consumer = consumerLock(manifest(), original, '/tmp/artifact.tgz', Buffer.from('tarball'));
    expect(consumer.packages['node_modules/yaml']).toEqual(original.packages['node_modules/yaml']);
    expect(consumer.packages['node_modules/tamperward'].integrity).toBe('sha512-' + createHash('sha512').update('tarball').digest('base64'));
    expect(consumer.packages[''].dependencies.tamperward).toBe('file:/tmp/artifact.tgz');
    expect(original.packages).not.toHaveProperty('node_modules/tamperward');
  });

  it.each(['package.json', 'schemas/oracle-v2.schema.json', 'dist/cli/index.js', 'NOTICE'])('rejects a missing or changed published %s', path => {
    const root = temporary();
    const source = inputs();
    const dist = encoded({ 'dist/cli/index.js': 'cli\n' });
    const published = { ...source, ...dist };
    delete published['src/cli/index.ts'];
    delete published['package-lock.json'];
    writeFiles(root, published);
    expect(() => verifyPackageTree(root, source, dist)).not.toThrow();
    rmSync(join(root, path));
    expect(() => verifyPackageTree(root, source, dist)).toThrow(path);
    writeFiles(root, { [path]: Buffer.from('changed') });
    expect(() => verifyPackageTree(root, source, dist)).toThrow();
  });

  it('rejects unexpected packaged files', () => {
    const root = temporary();
    const source = inputs();
    const dist = encoded({ 'dist/cli/index.js': 'cli\n' });
    const published: InputFiles = { ...source, ...dist, 'dist/extra.js': Buffer.from('unexpected') };
    delete published['src/cli/index.ts'];
    delete published['package-lock.json'];
    writeFiles(root, published);
    expect(() => verifyPackageTree(root, source, dist)).toThrow(/unexpected|file set/);
  });

  it('validates every schema major and rejects mutable or wrong-file canonical identifiers', () => {
    const root = temporary();
    writeFiles(root, inputs());
    expect(() => validateSchemas(root, '1.0.0', root)).not.toThrow();
    writeFileSync(join(root, 'schemas/oracle-v2.schema.json'), schema('oracle-v2.schema.json').replace('/v1.0.0/', '/main/'));
    expect(() => validateSchemas(root, '1.0.0', root)).toThrow(/oracle-v2/);
    writeFileSync(join(root, 'schemas/oracle-v2.schema.json'), schema('check-v1.schema.json'));
    expect(() => validateSchemas(root, '1.0.0', root)).toThrow(/oracle-v2/);
  });

  it('rejects schema bytes changed since their advertised older tag', () => {
    const root = temporary();
    writeFiles(root, inputs());
    const run: CommandRunner = () => 'different tagged bytes';
    expect(() => validateSchemas(root, '1.0.1', root, run)).toThrow(/bytes differ/);
  });

  it('requires a release tag even when a matching branch exists', () => {
    const { cwd } = fixture();
    execute('git', ['branch', 'v1.0.0'], { cwd });
    expect(() => validateSchemas(cwd, '1.0.1', cwd, execute)).toThrow();
  });

  it('rejects CLI output that is not one valid schema document', () => {
    const root = temporary();
    writeFiles(root, inputs());
    for (const output of ['tamperward help', '{}', '{"schema_version":2,"findings":[]}', '{"schema_version":1,"findings":[]}\nextra']) {
      const run: CommandRunner = command => command === 'git' ? '' : output;
      expect(() => verifyCli(root, temporary(), run)).toThrow();
    }
  });

  it('propagates a failed installed CLI invocation', () => {
    const root = temporary();
    writeFiles(root, inputs());
    const run: CommandRunner = command => {
      if (command === 'git') return '';
      throw new Error('installed CLI exited 2');
    };
    expect(() => verifyCli(root, temporary(), run)).toThrow('installed CLI exited 2');
  });
});

describe('release artifact lifecycle (#804)', () => {
  it('rejects reviewed-to-release mode changes before building even with identical source bytes', () => {
    const { cwd } = fixture();
    execute('git', ['update-index', '--chmod=+x', 'src/cli/index.ts'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'executable reviewed input'], { cwd });
    const reviewed = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    execute('git', ['update-index', '--chmod=-x', 'src/cli/index.ts'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'nonexecutable release input'], { cwd });
    const commit = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    execute('git', ['remote', 'add', 'origin', cwd], { cwd });
    execute('git', ['update-ref', 'refs/pull/42/head', reviewed], { cwd });
    const run: CommandRunner = (command, args, options) => command === 'gh'
      ? JSON.stringify([{ number: 42, merged_at: '2026-11-01T12:00:00Z', merge_commit_sha: commit,
        head: { sha: reviewed }, base: { ref: 'main', repo: { full_name: 'hexrift/tamperward' } } }])
      : execute(command, args, options);
    expect(() => verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.0', repository: 'hexrift/tamperward', run })).toThrow(/mode changed/);
    expect(existsSync(join(cwd, 'dist'))).toBe(false);
  });

  it('binds a final package to the independently recorded merged PR head', () => {
    const { cwd, commit: reviewed } = fixture();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify(manifest('1.0.1')));
    writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify(lock('1.0.1')));
    execute('git', ['add', '.'], { cwd });
    execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'version metadata'], { cwd });
    const commit = execute('git', ['rev-parse', 'HEAD'], { cwd }).trim();
    execute('git', ['tag', 'v1.0.0', reviewed], { cwd });
    execute('git', ['remote', 'add', 'origin', cwd], { cwd });
    execute('git', ['update-ref', 'refs/pull/42/head', reviewed], { cwd });
    const run: CommandRunner = (command, args, options) => {
      if (command === 'gh') return JSON.stringify([{ number: 42, merged_at: '2026-11-01T12:00:00Z', merge_commit_sha: commit,
        head: { sha: reviewed }, base: { ref: 'main', repo: { full_name: 'hexrift/tamperward' } } }]);
      if (command === 'npm' && args[0] === 'publish') throw new Error('unexpected publication');
      return execute(command, args, options);
    };
    const receiptPath = verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.1', repository: 'hexrift/tamperward', run, tempRoot: temporary() });
    expect(JSON.parse(readFileSync(receiptPath, 'utf8'))).toMatchObject({ repository: 'hexrift/tamperward', reviewed_pr: { number: 42, head: reviewed } });
    expect(() => publishArtifact(cwd, receiptPath, { expectedCommit: commit, expectedVersion: '1.0.1', repository: 'another/repository', run })).toThrow(/reviewed pull request/);
  }, 60000);

  it('builds and packs once, installs the exact tarball, and publishes only unchanged bytes with scripts disabled', () => {
    const { cwd, commit } = fixture();
    const commands: Array<[string, string[]]> = [];
    const run: CommandRunner = (command, args, options) => {
      commands.push([command, args]);
      if (command === 'npm' && args[0] === 'publish') return '';
      return execute(command, args, options);
    };
    const receiptPath = verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.0', run, tempRoot: temporary() });
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    expect(receipt.input_modes_sha256).toBe(inputModeDigest(snapshotInputs(cwd, commit).modes));
    expect(existsSync(receipt.artifact)).toBe(true);
    expect(commands.filter(([command, args]) => command === 'npm' && args[0] === 'pack')).toHaveLength(1);
    expect(commands.find(([command, args]) => command === 'npm' && args[0] === 'ci')?.[1]).toEqual(expect.arrayContaining(['--offline', '--ignore-scripts', '--omit=dev']));
    publishArtifact(cwd, receiptPath, { expectedCommit: commit, expectedVersion: '1.0.0', run });
    expect(commands.at(-1)).toEqual(['npm', ['publish', receipt.artifact, '--ignore-scripts', '--provenance', '--access', 'public', '--tag', 'latest']]);
    writeFileSync(receipt.artifact, 'changed after verification');
    expect(() => publishArtifact(cwd, receiptPath, { expectedCommit: commit, expectedVersion: '1.0.0', run })).toThrow(/artifact.*changed/i);
  }, 60_000);

  it('blocks publish after release inputs change or when the planned identity differs', () => {
    const { cwd, commit } = fixture();
    const receiptPath = verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.0', run: execute, tempRoot: temporary() });
    const publish: CommandRunner = () => { throw new Error('unexpected publish'); };
    expect(() => publishArtifact(cwd, receiptPath, { expectedCommit: commit, expectedVersion: '1.0.1', run: publish })).toThrow(/identity/);
    if (process.platform !== 'win32') {
      const input = join(cwd, 'src/cli/index.ts'), mode = statSync(input).mode;
      chmodSync(input, mode ^ 0o100);
      expect(() => publishArtifact(cwd, receiptPath, { expectedCommit: commit, expectedVersion: '1.0.0', run: publish })).toThrow(/input modes changed/);
      chmodSync(input, mode);
    }
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    delete receipt.input_modes_sha256;
    const missingModeReceipt = join(dirname(receiptPath), 'missing-modes.json');
    writeFileSync(missingModeReceipt, JSON.stringify(receipt));
    expect(() => publishArtifact(cwd, missingModeReceipt, { expectedCommit: commit, expectedVersion: '1.0.0', run: publish })).toThrow(/identity/);
    writeFileSync(join(cwd, 'src/cli/index.ts'), 'changed after verification');
    expect(() => publishArtifact(cwd, receiptPath, { expectedCommit: commit, expectedVersion: '1.0.0', run: execute })).toThrow(/inputs.*changed/i);
  }, 60_000);

  it('fails before building when the planned version disagrees with the commit', () => {
    const { cwd, commit } = fixture();
    expect(() => verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.1', run: execute, tempRoot: temporary() })).toThrow(/version/);
    expect(existsSync(join(cwd, 'dist'))).toBe(false);
  });

  it('rejects inputs modified by the build before any package is made', () => {
    const { cwd, commit } = fixture();
    const run: CommandRunner = (command, args, options) => {
      if (command === 'npm' && args[0] === 'pack') throw new Error('unexpected pack');
      const output = execute(command, args, options);
      if (command === 'npm' && args[0] === 'run') writeFileSync(join(cwd, 'src/cli/index.ts'), 'changed by build');
      return output;
    };
    expect(() => verifyArtifact(cwd, { expectedCommit: commit, expectedVersion: '1.0.0', run, tempRoot: temporary() })).toThrow('src/cli/index.ts');
  }, 60_000);
});
