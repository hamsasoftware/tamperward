export type InputFiles = Record<string, Buffer>;
export type InputModes = Record<string, '100644' | '100755'>;
export interface ReleaseSnapshot {
  commit: string;
  files: InputFiles;
  modes: InputModes;
}
export interface CommandOptions {
  cwd: string;
  input?: string;
}
export type CommandRunner = (command: string, args: string[], options: CommandOptions) => string;
export interface ArtifactOptions {
  expectedCommit: string;
  expectedVersion: string;
  repository?: string;
  run?: CommandRunner;
  tempRoot?: string;
}
export interface ArtifactReceipt {
  schema_version: 1;
  commit: string;
  version: string;
  inputs_sha256: string;
  input_modes_sha256: string;
  artifact: string;
  sha256: string;
  reviewed_pr?: { number: number; head: string };
  repository?: string;
}
export interface PackageManifest {
  name: string;
  version: string;
  [field: string]: unknown;
}
export interface PackageLock {
  lockfileVersion: number;
  packages: Record<string, Record<string, unknown>>;
  [field: string]: unknown;
}
export type ConsumerLock = PackageLock & {
  packages: {
    '': { dependencies: Record<string, string> };
    'node_modules/tamperward': { integrity: string };
  };
};
export function compareInputFiles(expected: InputFiles, actual: InputFiles, options?: { version?: string; allowVersionOnly?: boolean }): void;
export function inputDigest(files: InputFiles): string;
export function inputModeDigest(modes: InputModes): string;
export function compareInputModes(expected: InputModes, actual: InputModes): void;
export function snapshotInputs(cwd: string, commit: string, run?: CommandRunner): ReleaseSnapshot;
export function reviewedPullRequest(value: unknown, commit: string, repository: string): { number: number; head: string };
export function workingInputs(cwd: string): InputFiles;
export function workingInputModes(cwd: string): InputModes;
export function normalizePackResult(value: unknown): { filename: string };
export function consumerLock(manifest: PackageManifest, lock: PackageLock, artifact: string, bytes: Buffer): ConsumerLock;
export function verifyPackageTree(root: string, inputs: InputFiles, dist: InputFiles): void;
export function validateSchemas(root: string, version: string, cwd: string, run?: CommandRunner): void;
export function verifyCli(root: string, fixture: string, run?: CommandRunner): void;
export function verifyArtifact(cwd: string, options: ArtifactOptions): string;
export function publishArtifact(cwd: string, receiptPath: string, options: ArtifactOptions): void;
