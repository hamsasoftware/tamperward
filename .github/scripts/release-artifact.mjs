import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import semver from 'semver';

const INPUT_DIRECTORIES = ['src', 'schemas'];
const INPUT_FILES = ['LICENSE', 'NOTICE', 'README.md', '.npmrc', '.github/scripts/release-artifact.mjs', '.github/workflows/ci.yml', '.github/workflows/release.yml'];
const ROOT_INPUT = /\.(?:json|[cm]?js|[cm]?ts)$/;
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const json = bytes => JSON.parse(bytes.toString('utf8'));

function runCommand(command, args, options) {
  return execFileSync(command, args, { ...options, encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024 });
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
  const paths = run('git', ['ls-tree', '-r', '--name-only', '-z', commit], { cwd }).split('\0').filter(inputPath);
  const files = {};
  for (const path of paths) files[path] = Buffer.from(run('git', ['show', `${commit}:${path}`], { cwd }));
  if (!files['package.json'] || !files['package-lock.json']) throw new Error('release commit has no package manifests');
  return { commit, files };
}

export function workingInputs(cwd) {
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
  return Object.fromEntries([...new Set(paths)].sort().map(path => {
    if (!lstatSync(join(cwd, path)).isFile()) throw new Error(`release input is not a regular file: ${path}`);
    return [path, readFileSync(join(cwd, path))];
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
        version: manifest.versiond: dependency, integrity: `sha512-${hash(bytes, 'sha512', 'base64')}`,
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
