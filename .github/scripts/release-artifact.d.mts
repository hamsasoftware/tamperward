export type InputFiles = Record<string, Buffer>;
export interface ReleaseSnapshot {
  commit: string;
  files: InputFiles;
}
export interface CommandOptions {
  cwd: string;
  input?: string;
}
export type CommandRunner = (command: string, args: string[], options: CommandOptions) => string;
export interface ArtifactOptions {
  expectedCommit: string;
  expectedVersion: string;
  run?: CommandRunner;
  tempRoot?: string;
}
export interface ArtifactReceipt {
  schema_version: 1;
  commit: string;
  version: string;
  inputs_sha256: string;
  artifact: string;
  sha256: string;
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
export function snapshotInputs(cwd: string, commit: string, run?: CommandRunner): ReleaseSnapshot;
export function workingInputs(cwd: string): InputFiles;
export function normalizePackResult(value: unknown): { filename: string };
export function consumerLock(manifest: PackageManifest, lock: PackageLock, artifact: string, bytes: Buffer): ConsumerLock;
export function verifyPackageTree(root: string, inputs: InputFiles, dist: InputFiles): void;
export function validateSchemas(root: string, version: string, cwd: string, run?: CommandRunner): void;
export function verifyCli(root: string, fixture: string, run?: CommandRunner): void;
export function verifyArtifact(cwd: string, options: ArtifactOptions): string;
export function publishArtifact(cwd: string, receiptPath: string, options: ArtifactOptions): void;
