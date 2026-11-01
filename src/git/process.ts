import { execFileSync, spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { trustedGitEnv } from './trusted';

const GIT_TIMEOUT_MS = 3000;
const GIT_MAX_BYTES = 256 * 1024 * 1024;

function gitOptions(cwd?: string): SpawnSyncOptionsWithStringEncoding {
  return {
    cwd,
    encoding: 'utf8',
    env: trustedGitEnv(),
    timeout: GIT_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: GIT_MAX_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
}

export function readTrustedGit(args: string[], cwd?: string): string {
  return execFileSync('git', args, gitOptions(cwd));
}

export function trustedGitAncestor(base: string, head: string, cwd: string): boolean {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', base, head], gitOptions(cwd));
  if (!result.error && result.signal === null) {
    if (result.status === 0) return true;
    if (result.status === 1) return false;
  }
  const detail = result.error?.message ?? result.stderr?.trim() ?? `Git exited ${result.status}`;
  throw new Error(`cannot establish Git ancestry: ${detail}`);
}
