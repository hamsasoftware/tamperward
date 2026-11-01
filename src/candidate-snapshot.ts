import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { trustedGitEnv } from './git/trusted';
import type { MaterializationFailureReason } from './machine-output';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, env: trustedGitEnv() });
}

function inside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function linkParts(path: string): string[] {

  const parts = sep === '\\' ? path.split(/[\\/]+/) : path.split('/');
  return parts.filter((part) => part !== '' && part !== '.');
}

class MaterializationError extends Error {
  constructor(
    readonly materializationReason: MaterializationFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'MaterializationError';
  }
}

export function materializationFailureReason(error: unknown): MaterializationFailureReason {
  if (error instanceof MaterializationError) return error.materializationReason;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (/tracked\s+node_modules|node_modules.*(?:attested|dependency).*(?:conflict|replace)/i.test(message)) {
    return 'TRACKED_NODE_MODULES_CONFLICT';
  }
  if (/symlink.*(?:escape|cycle|parent directory)|escapes the materialised tree/i.test(message)) {
    return 'SYMLINK_ESCAPE';
  }
  if (/(?:special file|where git expects a file)/i.test(message)) {
    return 'SPECIAL_FILE';
  }
  if (code === 'ENOENT' || /(?:ENOENT|no such file|file not found)/i.test(message)) {
    return 'RACING_DELETION';
  }
  return 'UNKNOWN';
}

function linkEscape(label: string, target: string): Error {
  return new MaterializationError(
    'SYMLINK_ESCAPE',
    `${label} is a symlink that escapes the materialised tree (${JSON.stringify(target)})`,
  );
}

function driveRelativeLinkTarget(target: string): boolean {
  return sep === '\\' && /^[A-Za-z]:(?![\\/])/.test(target);
}

function rootedLinkTarget(target: string): boolean {

  return isAbsolute(target) || driveRelativeLinkTarget(target);
}

export function safeSymlink(target: string, out: string, root: string, label: string): void {
  if (rootedLinkTarget(target) || !inside(root, resolve(dirname(out), target))) {
    throw linkEscape(label, target);
  }
  rmSync(out, { force: true });
  symlinkSync(target, out);
}

export function validateSymlinkGraph(
  target: string,
  out: string,
  root: string,
  dependencyRoot: string | null,
  label: string,
): void {
  type Domain = 'tree' | 'deps';
  let domain: Domain = 'tree';
  let stack = linkParts(relative(root, dirname(out)));
  const pending = linkParts(target);
  const seen = new Set<string>();
  let hops = 0;

  for (let part = pending.shift(); part !== undefined; part = pending.shift()) {
    if (part === '..') {
      if (!stack.length) throw linkEscape(label, target);
      stack.pop();
      continue;
    }

    stack.push(part);

    if (domain === 'tree' && dependencyRoot && stack.length === 1 && stack[0] === 'node_modules') {
      domain = 'deps';
      stack = [];
      continue;
    }

    const base = domain === 'deps' && dependencyRoot ? dependencyRoot : root;
    const current = join(base, ...stack);
    let st;
    try {
      st = lstatSync(current);
    } catch {
      continue;
    }
    if (!st.isSymbolicLink()) continue;

    if (++hops > 128) {
      throw new MaterializationError(
        'SYMLINK_ESCAPE',
        `${label} contains a symlink cycle while materialising (${JSON.stringify(target)})`,
      );
    }
    const key = `${domain}:${current}:${pending.join(sep)}`;
    if (seen.has(key)) {
      throw new MaterializationError(
        'SYMLINK_ESCAPE',
        `${label} contains a symlink cycle while materialising (${JSON.stringify(target)})`,
      );
    }
    seen.add(key);

    const next = readlinkSync(current);
    stack.pop();
    if (driveRelativeLinkTarget(next)) {
      throw linkEscape(label, target);
    }
    if (isAbsolute(next)) {
      if (domain === 'tree' || !dependencyRoot || !inside(dependencyRoot, next)) {
        throw linkEscape(label, target);
      }
      stack = [];
      pending.unshift(...linkParts(relative(dependencyRoot, resolve(next))));
    } else {
      pending.unshift(...linkParts(next));
    }
  }
}

function rejectLinkedParent(cwd: string, rel: string): void {
  const parts = rel.split('/').slice(0, -1);
  let current = cwd;
  for (const part of parts) {
    current = join(current, part);
    let st;
    try {
      st = lstatSync(current);
    } catch {

      continue;
    }
    if (st.isSymbolicLink()) {
      throw new MaterializationError(
        'SYMLINK_ESCAPE',
        `${rel} has a symlinked parent directory (${relative(cwd, current)})`,
      );
    }
  }
}

export function materialize(cwd: string, dest: string, dependencyRoot: string | null): void {
  const listed = workingTreePaths(cwd);
  if (
    dependencyRoot &&
    listed.some((rel) => rel === 'node_modules' || rel.startsWith('node_modules/'))
  ) {
    throw new MaterializationError(
      'TRACKED_NODE_MODULES_CONFLICT',
      'tracked node_modules conflicts with the attested dependency root',
    );
  }
  const links: Array<{ rel: string; out: string; target: string }> = [];
  for (const rel of listed) {
    const src = join(cwd, rel);
    rejectLinkedParent(cwd, rel);
    let st;
    try {
      st = lstatSync(src);
    } catch {
      continue;
    }
    const out = join(dest, rel);
    mkdirSync(dirname(out), { recursive: true });
    dropSymlink(out);
    if (st.isSymbolicLink()) {
      const target = readlinkSync(src);
      safeSymlink(target, out, dest, rel);
      links.push({ rel, out, target });
    } else if (st.isFile()) {
      cpSync(src, out, { dereference: true });
      chmodSync(out, st.mode);
    } else {
      throw new MaterializationError(
        'SPECIAL_FILE',
        `${rel} is ${st.isDirectory() ? 'a directory' : 'a special file'} where git expects a file`,
      );
    }
  }

  for (const link of links) {
    validateSymlinkGraph(link.target, link.out, dest, dependencyRoot, link.rel);
  }

  if (dependencyRoot) symlinkSync(dependencyRoot, join(dest, 'node_modules'), 'dir');
}

export function workingTreePaths(cwd: string): string[] {
  return git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd)
    .split('\0')
    .filter(Boolean);
}

export function probeFilesystemCaseSensitivity(dir: string): boolean {
  const upper = join(dir, '.tw-case-probe-A');
  const lower = join(dir, '.tw-case-probe-a');
  try {
    writeFileSync(upper, '', { flag: 'wx' });
    return !existsSync(lower);
  } finally {
    rmSync(upper, { force: true });
  }
}

function dropSymlink(p: string): void {
  try {
    if (lstatSync(p).isSymbolicLink()) rmSync(p, { force: true });
  } catch {
  }
}
