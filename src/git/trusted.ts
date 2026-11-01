// Trusted git reads — the object layer under the trust anchor.
//
// Every guarantee in this tool reduces to one sentence: "the base commit says
// X". Three git mechanisms let a process with write access to `.git` change
// what that sentence resolves to, without touching a single tracked file and
// without moving a single ref:
//
//   refs/replace/<sha>   `git replace` — every read of <sha> transparently
//                        returns another object instead. `git show base:t.py`,
//                        `git ls-tree base`, `git merge-base` all follow it.
//   .git/info/grafts     rewrites the parent list of a commit, so ancestry —
//                        and therefore merge-base — answers differently.
//   .git/shallow         the same, by truncating history at a boundary.
//
// The verifier restores "the protected files as they are at the base" and the
// envelope asserts "HEAD is a descendant of the base". Both are object-layer
// reads. An agent that runs `git replace base <its-own-commit>` gets a pristine
// run overlaid from a tree it wrote, reported as VERIFIED — no diff rule sees
// it, because no file changed.
//
// Two defences, because the mechanisms differ:
//
//   1. GIT_NO_REPLACE_OBJECTS=1 on every read whose answer is trusted. This is
//      complete for replace refs: git resolves the real object.
//   2. Grafts and shallow have no such switch — they are read from `.git`
//      unconditionally. So the envelope FINGERPRINTS the rewrite state before
//      the agent starts and again at adjudication, and a change is a
//      non-quiescence finding like any other tree movement. It cannot prevent
//      a pre-existing graft (that predates the envelope's authority); it does
//      close the case where the agent installs one during its run.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import { readStateFile } from '../disk';

/**
 * Environment for a git command whose answer is trusted.
 *
 * `GIT_NO_REPLACE_OBJECTS=1` is the env form of `--no-replace-objects`; using
 * the env var means it also covers the git that a helper or a sub-invocation
 * spawns, which a per-command flag would not.
 */
export function trustedGitEnv(): NodeJS.ProcessEnv {
  return { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
}

function gitPathOf(cwd: string, rel: string): string {
  try {
    const d = execFileSync('git', ['rev-parse', '--git-path', rel], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: trustedGitEnv(),
      timeout: 1000,
    }).trim();
    if (!d) throw new Error('empty Git path');
    return isAbsolute(d) ? d : join(cwd, d);
  } catch (e) {
    throw new Error('cannot inspect Git rewrite metadata path ' + rel + ': ' +
      (e instanceof Error ? e.message : String(e)));
  }
}

/**
 * A fingerprint of everything that can make an object read answer differently
 * without any ref or file changing: the replace refs, `info/grafts`, and
 * `shallow`. Compared, never interpreted — the envelope only needs to know
 * whether it moved.
 *
 * Unreadable inputs prevent a fingerprint altogether. A stable unreadable
 * marker at both endpoints would otherwise permit a false clean comparison.
 */
export function objectRewriteState(cwd: string): string {
  const parts: string[] = [];
  const metadataParts: string[] = [];
  // Resolve Git's effective paths, including the common directory of a linked
  // worktree. Inspect before for-each-ref: Git itself can consume shallow and
  // graft metadata, so a FIFO must not hold this command indefinitely.
  for (const rel of ['info/grafts', 'shallow']) {
    const path = gitPathOf(cwd, rel);
    try {
      metadataParts.push(`${rel}:` + (readStateFile(path)?.trim() ?? ''));
    } catch (e) {
      throw new Error('cannot inspect Git rewrite metadata ' + rel + ': ' +
        (e instanceof Error ? e.message : String(e)));
    }
  }
  try {
    parts.push(
      'replace:' +
        execFileSync('git', ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/replace/'], {
          cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: trustedGitEnv(),
          timeout: 3000,
          maxBuffer: 1024 * 1024,
        }).trim(),
    );
  } catch (e) {
    throw new Error('cannot inspect Git rewrite metadata replace refs: ' +
      (e instanceof Error ? e.message : String(e)));
  }
  parts.push(...metadataParts);
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}
