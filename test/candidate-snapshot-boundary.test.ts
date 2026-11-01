import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import * as snapshot from '../src/candidate-snapshot';
import * as verification from '../src/cli/verify';

function importsAt(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(join(__dirname, '..', path), 'utf8'), ts.ScriptTarget.Latest, true);
  return source.statements.filter(ts.isImportDeclaration).map(statement => {
    if (!ts.isStringLiteral(statement.moduleSpecifier)) throw new Error('nonliteral module import');
    return statement.moduleSpecifier.text;
  });
}

describe('candidate snapshot command boundary (#800)', () => {
  it('preserves existing verification exports as the same shared functions', () => {
    expect(verification.materialize).toBe(snapshot.materialize);
    expect(verification.materializationFailureReason).toBe(snapshot.materializationFailureReason);
    expect(verification.probeFilesystemCaseSensitivity).toBe(snapshot.probeFilesystemCaseSensitivity);
  });

  it('shares materialization with the oracle without importing verification orchestration', () => {
    const oracleImports = importsAt('src/cli/oracle.ts');
    expect(oracleImports).toContain('../candidate-snapshot');
    expect(oracleImports).not.toContain('./verify');
    expect(importsAt('src/candidate-snapshot.ts').some(path => path.includes('/cli/') || path.startsWith('./cli/'))).toBe(false);
  });
});
