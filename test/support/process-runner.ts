import { readFileSync, writeSync } from 'node:fs';
import { readTrustedGit } from '../../src/git/process';
import { runCapturedProcessSync } from '../../src/suite-diagnostics';

export type ProcessApi = 'trusted-git' | 'captured';

export interface ProcessObservation {
  exit: number | null;
  signal: string | null;
  timedOut: boolean;
  error?: string;
  pipeHeldOpen?: boolean;
  stdout: string;
  stderr?: string;
}

interface ProcessInvocation { api: ProcessApi; cwd: string; fixture: string }
interface TrustedGitFailure extends Error { status?: number | null; signal?: string | null; code?: string; stdout?: string; stderr?: string }

const CAPTURE_COMPLETION_MS = 5000;
const config: ProcessInvocation = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let observation: ProcessObservation;

if (config.api === 'trusted-git') {
  try {
    observation = { exit: 0, signal: null, timedOut: false, stdout: readTrustedGit(['rev-parse', 'HEAD'], config.cwd) };
  } catch (error) {
    const failure = error as TrustedGitFailure;
    observation = {
      exit: failure.status ?? null,
      signal: failure.signal ?? null,
      timedOut: failure.code === 'ETIMEDOUT',
      error: failure.message,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
} else {
  const result = runCapturedProcessSync(process.execPath, [config.fixture], {
    cwd: config.cwd,
    env: process.env,
    timeoutMs: process.env.TW_PROCESS_SCENARIO === 'deadline' ? 300 : CAPTURE_COMPLETION_MS,
    detached: false,
    killGroupOnFinish: false,
    backstopMs: 2000,
    drainMs: 100,
  });
  observation = { ...result, stdout: result.diagnostics.stdout.tail, stderr: result.diagnostics.stderr.tail };
}

writeSync(1, JSON.stringify(observation));
