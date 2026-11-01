import ts from 'typescript';

export interface TrustIoException {
  name: string;
  owner: string;
  api: string;
  calls: number;
}

function rawModule(name: string): string | null {
  const bare = name.replace(/^node:/, '');
  return ['fs', 'fs/promises', 'child_process', 'process', 'module'].includes(bare) ? `node:${bare}` : null;
}

function ownerOf(node: ts.Node): string {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
    if (ts.isFunctionExpression(parent) && parent.name) return parent.name.text;
    if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
      return ts.isVariableDeclaration(parent.parent) && ts.isIdentifier(parent.parent.name)
        ? parent.parent.name.text : '<anonymous>';
    }
    if (ts.isMethodDeclaration(parent)) return parent.name.getText();
  }
  return '<module>';
}

function accessPath(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${accessPath(node.expression)}.${node.name.text}`;
  if (ts.isElementAccessExpression(node)) {
    const key = node.argumentExpression;
    return `${accessPath(node.expression)}.${key && ts.isStringLiteral(key) ? key.text : '<computed>'}`;
  }
  return '';
}

export function auditTrustIo(text: string, exceptions: readonly TrustIoException[]): string[] {
  const source = ts.createSourceFile('trust-primitive.ts', text, ts.ScriptTarget.Latest, true);
  const errors: string[] = [];
  const imported = new Map<string, string>();
  const importCounts = new Map<string, number>();
  const counts = new Map<string, number>();
  const reviewed = new Map<string, TrustIoException>();
  for (const exception of exceptions) {
    const key = `${exception.owner}|${exception.api}`;
    if (!exception.name || !Number.isInteger(exception.calls) || exception.calls < 1 || reviewed.has(key)) {
      errors.push(`invalid exception ${exception.name}`);
    }
    reviewed.set(key, exception);
  }

  for (const node of source.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = rawModule(node.moduleSpecifier.text);
      if (module && !node.importClause?.isTypeOnly) {
        const bindings = node.importClause?.namedBindings;
        if (node.importClause?.name || !bindings || !ts.isNamedImports(bindings)) {
          errors.push(`unreviewed raw module import ${module}`);
        } else {
          for (const binding of bindings.elements) {
            if (binding.isTypeOnly) continue;
            const api = `${module}.${binding.propertyName?.text ?? binding.name.text}`;
            imported.set(binding.name.text, api);
            const count = (importCounts.get(api) ?? 0) + 1;
            importCounts.set(api, count);
            if (count > 1 || !exceptions.some(exception => exception.api === api)) errors.push(`unreviewed raw import ${api}`);
          }
        }
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference) && reference.expression && ts.isStringLiteral(reference.expression) && rawModule(reference.expression.text)) {
        errors.push(`unreviewed raw module alias ${reference.expression.text}`);
      }
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && rawModule(node.moduleSpecifier.text)) {
      errors.push(`unreviewed raw module export ${node.moduleSpecifier.text}`);
    }
    if (ts.isIdentifier(node) && imported.has(node.text)) {
      if (!ts.isCallExpression(node.parent) || node.parent.expression !== node) errors.push(`indirect raw API reference ${node.text}`);
    }
    if (ts.isIdentifier(node) && node.text === 'process') {
      const parent = node.parent;
      if (!(ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent))) errors.push('unreviewed process alias');
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && imported.has(node.expression.text)) {
        const api = imported.get(node.expression.text)!;
        const key = `${ownerOf(node)}|${api}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (!reviewed.has(key)) errors.push(`unreviewed raw call ${key}`);
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || accessPath(node.expression).replace(/^globalThis\./, '') === 'require') {
        const module = node.arguments[0];
        if (!module || !ts.isStringLiteral(module) || rawModule(module.text)) errors.push('unreviewed raw module loader');
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const outer = node.parent;
      if (!((ts.isPropertyAccessExpression(outer) || ts.isElementAccessExpression(outer)) && outer.expression === node)) {
        const path = accessPath(node).replace(/^globalThis\./, '');
        if ((path === 'process' || path.startsWith('process.')) && path !== 'process.env' && !path.startsWith('process.env.')) errors.push(`unreviewed raw process access ${path}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const [key, exception] of reviewed) {
    if (counts.get(key) !== exception.calls) errors.push(`${exception.name}: expected ${exception.calls} reviewed call(s) at ${key}, saw ${counts.get(key) ?? 0}`);
  }
  return errors;
}
