import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import semver from 'semver';

const INPUT_DIRECTORIES = ['src', 'schemas'];
const INPUT_FILES = ['LICENSE', 'NOTICE', 'README.md', '.npmrc', '.github/scripts/release-artifact.mjs', '.github/workflows/ci.yml', '.github/workflows/release.yml'];
const ROOT_INPUT = /\.(?:json|[cm]?js|[cm]?ts)$/;
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const json = bytes => JSON.parse(bytes.toString('utf8'));

function runCommand(command, args, options) {
  return execFileSync(command, args, { ...options, encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024 * 1024 });
}

function listFiles(root, prefix = '') {
  const paths = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) paths.push(...listFiles(root, path));
    else if (entry.isFile()) paths.push(path);
    else throw new Error(`release input is not a regular file: ${path}`);
  }
  return paths.sort();
}

function inputPath(path) {
  return INPUT_FILES.includes(path) || INPUT_DIRECTORIES.some(dir => path.startsWith(`${dir}/`)) || (!path.includes('/') && ROOT_INPUT.test(path));
}

export function inputDigest(files) {
  return hash(JSON.stringify(Object.keys(files).sort().map(path => [path, hash(files[path])])));
}

export function inputModeDigest(modes) {
  return hash(JSON.stringify(Object.keys(modes).sort().map(path => [path, modes[path]])));
}

export function compareInputModes(expected, actual) {
  if (!isDeepStrictEqual(Object.keys(expected).sort(), Object.keys(actual).sort())) throw new Error('release input mode file set changed');
  for (const path of Object.keys(expected)) {
    if (!['100644', '100755'].includes(expected[path]) || expected[path] !== actual[path]) throw new Error(`release input mode changed: ${path}`);
  }
}

function versionNormalized(path, bytes, version) {
  const value = json(bytes);
  value.version = version;
  if (path === 'package-lock.json') {
    if (!value.packages?.['']) throw new Error('package-lock.json has no root package');
    value.packages[''].version = version;
  }
  return value;
}

function assertVersion(files, version) {
  const manifest = json(files['package.json']);
  const lock = json(files['package-lock.json']);
  if (!semver.valid(version) || manifest.name !== 'tamperward' || manifest.version !== version || lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('release version does not match package.json and both package-lock.json version fields');
  }
}

export function compareInputFiles(expected, actual, options = {}) {
  const paths = Object.keys(expected).sort();
  if (!isDeepStrictEqual(paths, Object.keys(actual).sort())) throw new Error('release input file set changed');
  if (options.allowVersionOnly) assertVersion(actual, options.version);
  for (const path of paths) {
    if (expected[path].equals(actual[path])) continue;
    if (options.allowVersionOnly && ['package.json', 'package-lock.json'].includes(path)) {
      if (isDeepStrictEqual(versionNormalized(path, expected[path], options.version), json(actual[path]))) continue;
    }
    throw new Error(`release input changed: ${path}`);
  }
}

export function snapshotInputs(cwd, commit, run = runCommand) {
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('expected release commit must be a full Git SHA');
  const resolved = run('git', ['rev-parse', '--verify', `${commit}^{commit}`], { cwd }).trim();
  if (resolved !== commit) throw new Error('release commit identity differs');
  const entries = run('git', ['ls-tree', '-r', '-z', commit], { cwd }).split('\0').filter(Boolean);
  const files = {};
  const modes = {};
  for (const entry of entries) {
    const match = /^([0-9]+) ([^ ]+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('malformed release Git tree entry');
    const [, mode, type, object, path] = match;
    if (!inputPath(path)) continue;
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) throw new Error(`release input is not a regular file: ${path}`);
    modes[path] = mode;
    const bytes = Buffer.from(run('git', ['show', `${commit}:${path}`], { cwd }));
    if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== object) throw new Error(`release Git blob bytes differ: ${path}`);
    files[path] = bytes;
  }
  if (!files['package.json'] || !files['package-lock.json']) throw new Error('release commit has no package manifests');
  return { commit, files, modes };
}

export function reviewedPullRequest(value, commit, repository) {
  if (!Array.isArray(value)) throw new Error('release has no unambiguous reviewed pull request');
  const matches = value.filter(pull => pull && pull.merge_commit_sha === commit && typeof pull.merged_at === 'string' && Number.isFinite(Date.parse(pull.merged_at))
    && pull.base?.ref === 'main' && pull.base?.repo?.full_name === repository);
  const pull = matches[0];
  if (matches.length !== 1 || !Number.isSafeInteger(pull.number) || pull.number <= 0 || !/^[a-f0-9]{40}$/.test(pull.head?.sha)) {
    throw new Error('release has no unambiguous reviewed pull request');
  }
  return { number: pull.number, head: pull.head.sha };
}

function verifyReviewedInputs(cwd, options, release, run) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repository)) throw new Error('invalid release repository identity');
  const pulls = json(Buffer.from(run('gh', ['api', `repos/${options.repository}/commits/${options.expectedCommit}/pulls?per_page=100`], { cwd })));
  const reviewed = reviewedPullRequest(pulls, options.expectedCommit, options.repository);
  run('git', ['fetch', '--no-tags', 'origin', `refs/pull/${reviewed.number}/head`], { cwd });
  const fetched = run('git', ['rev-parse', '--verify', 'FETCH_HEAD^{commit}'], { cwd }).trim();
  if (fetched !== reviewed.head) throw new Error('reviewed pull request head changed during release verification');
  const source = snapshotInputs(cwd, reviewed.head, run);
  compareInputFiles(source.files, release.files, { version: options.expectedVersion, allowVersionOnly: true });
  compareInputModes(source.modes, release.modes);
  return reviewed;
}

function workingInputPaths(cwd) {
  const paths = [];
  for (const directory of INPUT_DIRECTORIES) paths.push(...listFiles(cwd, directory));
  for (const entry of readdirSync(cwd, { withFileTypes: true })) {
    if (!entry.name.includes('/') && ROOT_INPUT.test(entry.name)) paths.push(entry.name);
  }
  for (const path of INPUT_FILES) {
    try {
      lstatSync(join(cwd, path));
      paths.push(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return [...new Set(paths)].sort();
}

export function workingInputs(cwd) {
  return Object.fromEntries(workingInputPaths(cwd).map(path => {
    if (!lstatSync(join(cwd, path)).isFile()) throw new Error(`release input is not a regular file: ${path}`);
    return [path, readFileSync(join(cwd, path))];
  }));
}

export function workingInputModes(cwd) {
  return Object.fromEntries(workingInputPaths(cwd).map(path => {
    const entry = lstatSync(join(cwd, path));
    if (!entry.isFile()) throw new Error(`release input is not a regular file: ${path}`);
    return [path, entry.mode & 0o100 ? '100755' : '100644'];
  }));
}

export function normalizePackResult(value) {
  const entries = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
  const entry = entries[0];
  if (entries.length !== 1 || !entry || typeof entry.filename !== 'string' || basename(entry.filename) !== entry.filename || !/^[a-zA-Z0-9._-]+\.tgz$/.test(entry.filename)) {
    throw new Error('npm pack must return exactly one safe tarball filename');
  }
  return entry;
}

export function consumerLock(manifest, lock, artifact, bytes) {
  const dependency = `file:${artifact}`;
  const consumer = { name: 'tamperward-release-verification', version: '0.0.0', private: true, dependencies: { tamperward: dependency } };
  return {
    ...structuredClone(lock), name: consumer.name, version: consumer.version,
    packages: {
      ...structuredClone(lock.packages),
      '': consumer,
      'node_modules/tamperward': {
        version: manifest.version, resolved: dependency, integrity: `sha512-${hash(bytes, 'sha512', 'base64')}`,
        dependencies: manifest.dependencies, optionalDependencies: manifest.optionalDependencies,
        peerDependencies: manifest.peerDependencies, peerDependenciesMeta: manifest.peerDependenciesMeta,
        bin: manifest.bin, engines: manifest.engines, license: manifest.license,
      },
    },
  };
}

export function verifyPackageTree(root, inputs, dist) {
  const expected = Object.fromEntries(Object.entries(inputs).filter(([path]) => path.startsWith('schemas/') || ['package.json', 'LICENSE', 'NOTICE', 'README.md'].includes(path)));
  Object.assign(expected, dist);
  const actualPaths = listFiles(root);
  for (const path of Object.keys(expected)) {
    if (!actualPaths.includes(path)) throw new Error(`packed release file missing: ${path}`);
    const actual = readFileSync(join(root, path));
    if (path === 'package.json') {
      if (!isDeepStrictEqual(json(expected[path]), json(actual))) throw new Error('packed package.json differs from release inputs');
    } else if (!actual.equals(expected[path])) throw new Error(`packed release bytes differ: ${path}`);
  }
  if (!isDeepStrictEqual(actualPaths, Object.keys(expected).sort())) throw new Error('packed release has an unexpected file set');
  if (json(readFileSync(join(root, 'package.json'))).bin?.tamperward !== 'dist/cli/index.js') throw new Error('packed release does not declare the expected CLI');
}

export function validateSchemas(root, version, cwd, run = runCommand) {
  const paths = listFiles(root, 'schemas').filter(path => path.endsWith('.schema.json'));
  if (paths.length === 0) throw new Error('release contains no schemas');
  for (const path of paths) {
    const bytes = readFileSync(join(root, path));
    const schema = json(bytes);
    const match = /^https:\/\/raw\.githubusercontent\.com\/hexrift\/tamperward\/(v\d+\.\d+\.\d+)\/schemas\/([^/]+)$/.exec(schema.$id);
    if (!match || match[2] !== basename(path) || semver.gt(match[1].slice(1), version)) throw new Error(`canonical schema identifier malformed: ${path}`);
    if (match[1] !== `v${version}`) {
      const tagged = Buffer.from(run('git', ['show', `refs/tags/${match[1]}:${path}`], { cwd }));
      if (!bytes.equals(tagged)) throw new Error(`canonical schema bytes differ from ${match[1]}: ${path}`);
    }
    const validator = new Ajv2020({ strict: true, allErrors: true });
    if (!validator.validateSchema(schema)) throw new Error(`invalid release schema ${path}: ${JSON.stringify(validator.errors)}`);
    validator.compile(schema);
  }
}

export function verifyCli(root, fixture, run = runCommand) {
  mkdirSync(fixture, { recursive: true });
  run('git', ['init', '-q'], { cwd: fixture });
  mkdirSync(join(fixture, 'test'), { recursive: true });
  writeFileSync(join(fixture, 'test/release.test.ts'), "import { test } from 'node:test';\ntest('installed release', () => {});\n");
  run('git', ['add', '.'], { cwd: fixture });
  const output = run(join(dirname(root), '.bin/tamperward'), ['check', '--json', '--staged'], { cwd: fixture });
  const document = JSON.parse(output);
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(json(readFileSync(join(root, 'schemas/check-v1.schema.json'))));
  if (!validate(document) || document.findings.length !== 0) throw new Error(`installed CLI output failed the shipped check schema: ${JSON.stringify(validate.errors)}`);
}

export function verifyArtifact(cwd, options) {
  const run = options.run ?? runCommand;
  const expected = snapshotInputs(cwd, options.expectedCommit, run);
  assertVersion(expected.files, options.expectedVersion);
  compareInputFiles(expected.files, workingInputs(cwd));
  compareInputModes(expected.modes, workingInputModes(cwd));
  const reviewed = options.repository ? verifyReviewedInputs(cwd, options, expected, run) : undefined;
  const workspace = mkdtempSync(join(options.tempRoot ?? tmpdir(), 'tamperward-artifact-'));
  let complete = false;
  try {
    rmSync(join(cwd, 'dist'), { recursive: true, force: true });
    run('npm', ['run', 'build', '--ignore-scripts'], { cwd });
    compareInputFiles(expected.files, workingInputs(cwd));
    compareInputModes(expected.modes, workingInputModes(cwd));
    const dist = Object.fromEntries(listFiles(cwd, 'dist').map(path => [path, readFileSync(join(cwd, path))]));
    if (!dist['dist/cli/index.js']) throw new Error('build produced no CLI');
    const packed = normalizePackResult(JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', workspace], { cwd })));
    const artifact = join(workspace, packed.filename);
    const bytes = readFileSync(artifact);
    const consumer = join(workspace, 'consumer');
    mkdirSync(consumer);
    const lock = consumerLock(json(expected.files['package.json']), json(expected.files['package-lock.json']), artifact, bytes);
    writeFileSync(join(consumer, 'package.json'), JSON.stringify(lock.packages['']));
    writeFileSync(join(consumer, 'package-lock.json'), JSON.stringify(lock));
    run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], { cwd: consumer });
    const installed = join(consumer, 'node_modules/tamperward');
    verifyPackageTree(installed, expected.files, dist);
    const bin = join(consumer, 'node_modules/.bin/tamperward');
    if (realpathSync(bin) !== join(installed, 'dist/cli/index.js') || (lstatSync(realpathSync(bin)).mode & 0o111) === 0) throw new Error('installed CLI bin is not executable or resolves outside the package');
    validateSchemas(installed, options.expectedVersion, cwd, run);
    verifyCli(installed, join(workspace, 'fixture'), run);
    compareInputFiles(expected.files, workingInputs(cwd));
    compareInputModes(expected.modes, workingInputModes(cwd));
    if (hash(readFileSync(artifact)) !== hash(bytes)) throw new Error('release artifact changed during verification');
    const receipt = {
      schema_version: 1, commit: options.expectedCommit, version: options.expectedVersion,
      inputs_sha256: inputDigest(expected.files), artifact, sha256: hash(bytes),
      input_modes_sha256: inputModeDigest(expected.modes),
      ...(reviewed ? { repository: options.repository, reviewed_pr: reviewed } : {}),
    };
    const receiptPath = join(workspace, 'receipt.json');
    writeFileSync(receiptPath, JSON.stringify(receipt) + '\n');
    rmSync(consumer, { recursive: true, force: true });
    rmSync(join(workspace, 'fixture'), { recursive: true, force: true });
    complete = true;
    return receiptPath;
  } finally {
    if (!complete) rmSync(workspace, { recursive: true, force: true });
  }
}

export function publishArtifact(cwd, receiptPath, options) {
  const receipt = json(readFileSync(receiptPath));
  if (receipt.schema_version !== 1 || receipt.commit !== options.expectedCommit || receipt.version !== options.expectedVersion || !isAbsolute(receipt.artifact) || dirname(receipt.artifact) !== dirname(resolve(receiptPath)) || !receipt.artifact.endsWith('.tgz') || !/^[0-9a-f]{64}$/.test(receipt.sha256) || !/^[0-9a-f]{64}$/.test(receipt.inputs_sha256) || !/^[0-9a-f]{64}$/.test(receipt.input_modes_sha256)) throw new Error('verified artifact identity differs from release plan');
  if (inputDigest(workingInputs(cwd)) !== receipt.inputs_sha256) throw new Error('release inputs changed after artifact verification');
  if (inputModeDigest(workingInputModes(cwd)) !== receipt.input_modes_sha256) throw new Error('release input modes changed after artifact verification');
  if (options.repository && (receipt.repository !== options.repository || !Number.isSafeInteger(receipt.reviewed_pr?.number) || receipt.reviewed_pr.number <= 0 || !/^[a-f0-9]{40}$/.test(receipt.reviewed_pr?.head))) throw new Error('release receipt lacks reviewed pull request identity');
  if (hash(readFileSync(receipt.artifact)) !== receipt.sha256) throw new Error('release artifact changed after verification');
  const tag = semver.prerelease(receipt.version) ? 'next' : 'latest';
  (options.run ?? runCommand)('npm', ['publish', receipt.artifact, '--ignore-scripts', '--provenance', '--access', 'public', '--tag', tag], { cwd });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = { expectedCommit: process.env.EXPECTED_COMMIT, expectedVersion: process.env.EXPECTED_VERSION, repository: process.env.EXPECTED_REPOSITORY };
    if (process.argv[2] === 'verify') {
      const receiptPath = verifyArtifact(process.cwd(), options);
      const receipt = json(readFileSync(receiptPath));
      console.log(`verified release ${receipt.version} commit=${receipt.commit} inputs=${receipt.inputs_sha256} modes=${receipt.input_modes_sha256} artifact=${receipt.sha256}`);
      if (receipt.reviewed_pr) console.log(`reviewed pull request ${receipt.repository}#${receipt.reviewed_pr.number} head=${receipt.reviewed_pr.head}`);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `receipt=${receiptPath}\n`);
      else console.log(`receipt=${receiptPath}`);
    } else if (process.argv[2] === 'publish' && process.env.ARTIFACT_RECEIPT) {
      publishArtifact(process.cwd(), process.env.ARTIFACT_RECEIPT, options);
    } else throw new Error('usage: release-artifact.mjs verify|publish with EXPECTED_COMMIT and EXPECTED_VERSION');
  } catch (error) {
    console.error(`release artifact verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
