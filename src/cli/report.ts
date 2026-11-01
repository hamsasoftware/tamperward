// Verdict presentation. One verdict, several audiences.
//
// The engine produces exactly one thing — Finding[] — and nothing below this file may
// change it. Rendering is the only place where the audience matters: a developer at a
// terminal, a reviewer looking at a PR, and a script parsing output want the same facts
// laid out three different ways.
//
// FORMAT IS AUTO-DETECTED so the CI wiring stays one line. Running under Actions
// (GITHUB_ACTIONS=true) selects the GitHub renderer, which is the case where the default
// was worst: the verdict existed only inside a collapsed job log. `--format` overrides
// the detection when you want a specific view.

import { Finding } from '../types';
import { machineOutput } from '../machine-output';
import { colourEnabled, renderText, terminalWidth } from './render/text';
import { annotations, isGitHubActions, renderSummary, writeSummary } from './render/github';
import { checkSarif } from '../sarif';

export type Format = 'auto' | 'text' | 'json' | 'github' | 'sarif';

export const FORMATS: Format[] = ['auto', 'text', 'json', 'github', 'sarif'];

export function isFormat(s: string): s is Format {
  return FORMATS.some((f) => f === s);
}

export interface ReportInput {
  findings: Finding[];
  scanned: number;
  ignoredFiles: number;
  format?: Format;
  /** Deprecated alias for `format: 'json'`, kept so `--json` never changes meaning. */
  json?: boolean;
}

/** `--json` wins outright; then an explicit `--format`; then the environment. */
export function resolveFormat(
  input: Pick<ReportInput, 'format' | 'json'>,
  env: NodeJS.ProcessEnv = process.env,
): Exclude<Format, 'auto'> {
  if (input.json) return 'json';
  if (input.format && input.format !== 'auto') return input.format;
  return isGitHubActions(env) ? 'github' : 'text';
}

/** Human- (and CI-log-) readable rendering of the verdict. */
export function report(input: ReportInput): void {
  const { findings, scanned, ignoredFiles } = input;
  const format = resolveFormat(input);

  if (format === 'sarif') {
    process.stdout.write(JSON.stringify(checkSarif(input), null, 2) + '\n');
    return;
  }

  if (format === 'json') {
    const blocks = findings.filter((f) => f.severity === 'block').length;
    process.stdout.write(
      JSON.stringify(
        // `findings`, `scanned` and `ignoredFiles` keep their exact prior shape; `summary`
        // is additive, so an existing consumer reading only the old keys is unaffected.
        machineOutput({ findings, scanned, ignoredFiles, summary: { block: blocks, warn: findings.length - blocks } }),
        null,
        2,
      ) + '\n',
    );
    return;
  }

  const text = renderText(
    { findings, scanned, ignoredFiles },
    { colour: colourEnabled(), width: terminalWidth() },
  );

  if (format === 'github') {
    // Annotations first: they land at the top of the failing step, where the eye goes.
    for (const a of annotations(findings)) process.stdout.write(a + '\n');
    writeSummary(renderSummary({ findings, scanned, ignoredFiles }));
  }

  process.stdout.write(text);
}
