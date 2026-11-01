import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from '../src/types';
import { checkSarif, verifySarif, SARIF_RULE_IDS_V1, SARIF_RULES_V1 } from '../src/sarif';
import { defaultPolicy } from '../src/policy';
import { expectSarif } from './support/sarif-schema';

function validated<T>(document: T): T {
  expectSarif(document);
  return document;
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    rule: 'test-skip', severity: 'block', file: 'test/a.test.ts', line: 3,
    message: 'A test was skipped.', evidence: 'it.skip("works", () => {})',
    remediation: 'Restore the test.', signoff: { required: true, command: 'tamperward allow test-skip' },
    ...overrides,
  };
}

describe('SARIF rendering', () => {
  it('maps findings to stable rules, configured levels and precise locations', () => {
    const document = validated(checkSarif({
      scanned: 2, ignoredFiles: 1,
      findings: [finding(), finding({ severity: 'warn', line: 8 })],
    }));
    const run = document.runs[0];
    expect(document.version).toBe('2.1.0');
    expect(run.properties).toMatchObject({ verdict: 'BLOCKED', receipt_digest: null, signed_verdict: null, rule_vocabulary_version: 1 });
    expect(run.results.map(result => result.level)).toEqual(['error', 'warning']);
    expect(run.results[0]).toMatchObject({ ruleId: 'tamperward/v1/test-skip', locations: [{ physicalLocation: {
      artifactLocation: { uri: 'test/a.test.ts' }, region: { startLine: 3 },
    } }] });
    expect(run.tool.driver.rules[run.results[0].ruleIndex].id).toBe(run.results[0].ruleId);
    expect(run.tool.driver.rules.find(rule => rule.id === run.results[0].ruleId)?.help.text).toContain('test');
  });

  it('preserves escaped evidence and paths without inventing command locations', () => {
    const file = 'test/topic #1?%\n"✓.ts';
    const message = 'bad "value"\n::error title=forged::message\\';
    const document = validated(checkSarif({
      scanned: 2, ignoredFiles: 0,
      findings: [finding({ file, message }), finding({ rule: 'no-verify', file: undefined, line: undefined })],
    }));
    const stdout = JSON.stringify(document);
    const [located, command] = document.runs[0].results;
    const uri = located.locations?.[0].physicalLocation.artifactLocation.uri;
    expect(uri && decodeURIComponent(uri)).toBe(file);
    expect(located.message.text).toContain(message);
    expect(located.properties.evidence).toBe(finding().evidence);
    expect(command.locations).toBeUndefined();
    expect(stdout.split('\n').filter(line => line.startsWith('::'))).toEqual([]);
  });

  it.each(['detector-error', 'hidden-drift'])('marks incomplete check analysis for %s', rule => {
    const document = validated(checkSarif({
      scanned: 1, ignoredFiles: 0, findings: [finding({ rule })],
    }));
    expect(document.runs[0].invocations[0].executionSuccessful).toBe(false);
    expect(document.runs[0]).toMatchObject({ properties: { verdict: 'BLOCKED' } });
  });

  it('publishes the exact versioned rule vocabulary and covers every baseline rule', () => {
    const published = JSON.parse(readFileSync(join(__dirname, '../schemas/sarif-rules-v1.json'), 'utf8'));
    expect(published).toEqual({ version: 1, rules: SARIF_RULES_V1 });
    expect(new Set(SARIF_RULE_IDS_V1).size).toBe(SARIF_RULE_IDS_V1.length);
    for (const name of Object.keys(defaultPolicy().rules)) {
      expect(SARIF_RULE_IDS_V1).toContain(`tamperward/v1/${name}`);
    }
  });

  it.each([undefined, 0, -1, 1.5, NaN])('omits an unavailable or invalid line %s', line => {
    const document = validated(checkSarif({ findings: [finding({ line })], scanned: 1, ignoredFiles: 0 }));
    expect(document.runs[0].results[0].locations).toHaveLength(1);
    expect(document.runs[0].results[0].locations?.[0].physicalLocation.region).toBeUndefined();
  });

  it('represents a reasonless terminal verifier failure without inventing a location', () => {
    const document = verifySarif({ verdict: 'CANNOT_VERIFY', reason: 'MATERIALIZATION_FAILED', detail: 'bad\npath' });
    expectSarif(document);
    expect(document.runs[0].results[0].locations).toBeUndefined();
  });
});
