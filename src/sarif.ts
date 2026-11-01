import type { Finding } from './types';
import type { VerifyVerdict } from './machine-output';
import { TW_VERSION } from './wiring';

export const SARIF_RULE_VOCABULARY_VERSION = 1;

const RULE_DEFINITIONS_V1: ReadonlyArray<readonly [string, 'error' | 'warning', string]> = [
  ['no-verify', 'error', 'Verification hooks were bypassed.'],
  ['ts-any-cast', 'error', 'An explicit any cast or TypeScript suppression weakens type checking.'],
  ['ts-any-launder', 'warning', 'An any annotation or generic can weaken type checking.'],
  ['ts-cast-growth', 'warning', 'Type assertions grew in source code.'],
  ['lint-suppression', 'error', 'A lint suppression weakens static checks.'],
  ['test-skip', 'error', 'A test was skipped or excluded from execution.'],
  ['coverage-lowering', 'error', 'A coverage threshold was lowered.'],
  ['config-weakening', 'warning', 'A verification configuration was weakened.'],
  ['coverage-exclusion', 'warning', 'Source code was excluded from coverage measurement.'],
  ['ci-tampering', 'error', 'A CI integrity gate was weakened.'],
  ['hook-tampering', 'error', 'A hook, policy or enforcement integration was weakened.'],
  ['test-deletion', 'error', 'Protected tests were deleted or moved out of protection.'],
  ['test-content-removal', 'error', 'Content was removed from a protected test.'],
  ['test-support', 'warning', 'Protected test support content was removed.'],
  ['snapshot-rewrite', 'warning', 'A protected snapshot was rewritten.'],
  ['snapshot-only-rewrite', 'warning', 'A snapshot was rewritten without an accompanying source change.'],
  ['assertion-weakening', 'warning', 'A test assertion was weakened.'],
  ['guard-removal', 'warning', 'A source guard was removed.'],
  ['transient-protected-mutation', 'warning', 'A protected file was changed and restored during execution.'],
  ['hidden-drift', 'error', 'A protected path could not be judged by content.'],
  ['detector-error', 'error', 'A detector failed; the change could not be judged completely.'],
  ['verify-masked-failure', 'error', 'The visible suite passed but the suite restored from the trusted base failed.'],
  ['verify-suite-red', 'error', 'The visible suite failed.'],
  ['verify-budget-exceeded', 'error', 'Verification exceeded its configured budget.'],
  ['verify-cannot-verify', 'error', 'A trusted verification result could not be established.'],
  ['unrecognized-rule', 'error', 'An unrecognized integrity rule reported a finding.'],
];

export const SARIF_RULES_V1 = RULE_DEFINITIONS_V1.map(([name, level, description]) => ({
  id: `tamperward/v1/${name}`,
  name,
  level,
  description,
}));

export const SARIF_RULE_IDS_V1 = SARIF_RULES_V1.map(rule => rule.id);

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: 'error' | 'warning';
  message: { text: string };
  locations?: Array<{ physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine: number };
  } }>;
  properties: Record<string, unknown>;
}

function ruleReference(name: string): Pick<SarifResult, 'ruleId' | 'ruleIndex'> {
  const found = SARIF_RULES_V1.findIndex(rule => rule.name === name);
  const ruleIndex = found < 0 ? SARIF_RULES_V1.length - 1 : found;
  return { ruleId: SARIF_RULES_V1[ruleIndex].id, ruleIndex };
}

function sarifLog(command: 'check' | 'verify', properties: Record<string, unknown>, results: SarifResult[], executionSuccessful: boolean) {
  return {
    $schema: 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: {
        name: 'Tamperward',
        semanticVersion: TW_VERSION,
        informationUri: 'https://github.com/hexrift/tamperward',
        rules: SARIF_RULES_V1.map(rule => ({
          id: rule.id,
          name: rule.name,
          shortDescription: { text: rule.description },
          fullDescription: { text: rule.description },
          help: { text: rule.description + ' Review the finding remediation and restore the integrity check.' },
          helpUri: 'https://github.com/hexrift/tamperward/blob/main/docs/guide/rules.md',
          defaultConfiguration: { level: rule.level },
        })),
      } },
      automationDetails: { id: `tamperward/${command}/` },
      invocations: [{ executionSuccessful }],
      results,
      properties: {
        command,
        rule_vocabulary_version: SARIF_RULE_VOCABULARY_VERSION,
        receipt_digest: null,
        signed_verdict: null,
        ...properties,
      },
    }],
  };
}

export function checkSarif(input: { findings: Finding[]; scanned: number; ignoredFiles: number }) {
  const results: SarifResult[] = input.findings.map(finding => {
    const line = finding.line;
    return {
      ...ruleReference(finding.rule),
      level: finding.severity === 'block' ? 'error' : 'warning',
      message: { text: `${finding.message}\nRemediation: ${finding.remediation}` },
      ...(finding.file ? { locations: [{ physicalLocation: {
        artifactLocation: { uri: finding.file.split('/').map(encodeURIComponent).join('/') },
        ...(typeof line === 'number' && Number.isInteger(line) && line > 0 ? { region: { startLine: line } } : {}),
      } }] } : {}),
      properties: {
        detector_rule: finding.rule,
        severity: finding.severity,
        evidence: finding.evidence,
        remediation: finding.remediation,
        signoff: finding.signoff,
      },
    };
  });
  const blocks = input.findings.filter(finding => finding.severity === 'block').length;
  const complete = !input.findings.some(finding => finding.rule === 'detector-error' || finding.rule === 'hidden-drift');
  return sarifLog('check', {
    verdict: blocks > 0 ? 'BLOCKED' : 'CLEAN',
    scanned: input.scanned,
    ignoredFiles: input.ignoredFiles,
    summary: { block: blocks, warn: input.findings.length - blocks },
  }, results, complete);
}

export interface VerifySarifInput extends Record<string, unknown> {
  verdict: VerifyVerdict;
  reason?: string;
  detail?: string;
  oob_signoff?: string;
}

export function verifySarif(input: VerifySarifInput, receiptDigest: string | null = null) {
  const results: SarifResult[] = input.verdict === 'VERIFIED' ? [] : [{
    ...ruleReference(`verify-${input.verdict.toLowerCase().replaceAll('_', '-')}`),
    level: input.verdict === 'MASKED_FAILURE' && input.oob_signoff ? 'warning' : 'error',
    message: { text: [input.verdict, input.reason, input.detail].filter(Boolean).join(': ') },
    properties: { verdict: input.verdict, ...(input.reason ? { reason: input.reason } : {}) },
  }];
  return sarifLog('verify', { ...input, receipt_digest: receiptDigest }, results,
    input.verdict !== 'CANNOT_VERIFY' && input.verdict !== 'BUDGET_EXCEEDED');
}
