import { describe, expect, it, vi } from 'vitest';
import { evaluateGitHubProtection, githubAuthority, REPOSITORY_REQUIRED_CHECKS } from '../src/cli/doctor';

const opts = { repo: 'acme/project', branch: 'main', checkContract: 'tamperward-repo' as const };
const prefix = 'repos/acme/project';
function rulesFor(checks: readonly string[] = REPOSITORY_REQUIRED_CHECKS): unknown[] {
  return [
    { type: 'pull_request', ruleset_id: 7, ruleset_source: 'acme/project', ruleset_source_type: 'Repository', parameters: { require_code_owner_review: true, dismiss_stale_reviews_on_push: true } },
    { type: 'required_status_checks', ruleset_id: 7, ruleset_source: 'acme/project', ruleset_source_type: 'Repository', parameters: { required_status_checks: checks.map(context => ({ context })) } },
  ];
}
function classicFor(checks: readonly string[] = REPOSITORY_REQUIRED_CHECKS): unknown {
  return {
    required_pull_request_reviews: { require_code_owner_reviews: true, dismiss_stale_reviews: true },
    required_status_checks: { contexts: checks },
  };
}
interface Fixture {
  rules?: unknown;
  detail?: unknown;
  classic?: unknown;
  rulesError?: string;
  detailError?: string;
}
function apiFor(fixture: Fixture = {}) {
  return vi.fn((_cwd: string, endpoint: string): unknown => {
    switch (endpoint) {
      case `${prefix}/rules/branches/main?per_page=100&page=1`:
        if (fixture.rulesError) throw new Error(fixture.rulesError);
        return 'rules' in fixture ? fixture.rules : rulesFor([]);
      case `${prefix}/rulesets/7`:
        if (fixture.detailError) throw new Error(fixture.detailError);
        return 'detail' in fixture ? fixture.detail : { bypass_actors: [] };
      case `${prefix}/branches/main/protection`:
        return 'classic' in fixture ? fixture.classic : classicFor();
      default: throw new Error(`unexpected API endpoint: ${endpoint}`);
    }
  });
}

describe('GitHub authority evidence survives fallback (#795)', () => {
  it('retains observed bypass actors after classic protection supplies the missing checks', () => {
    const api = apiFor({ detail: { bypass_actors: [{ actor_id: 1, actor_type: 'RepositoryRole' }] } });
    expect(githubAuthority(opts, '.', api).findings).toContain('remove unintended ruleset bypass actors');
    expect(api).toHaveBeenCalledWith('.', `${prefix}/branches/main/protection`);
  });

  it.each([undefined, null, false, 'unavailable', {}])('does not interpret bypass data %j as a verified empty list', (bypassActors) => {
    const api = apiFor({ detail: { bypass_actors: bypassActors } });
    expect(githubAuthority(opts, '.', api).findings).toContain('ruleset bypass actors could not be verified');
  });

  it('preserves a ruleset inspection failure even with complete classic protection', () => {
    const findings = githubAuthority(opts, '.', apiFor({ detailError: 'HTTP 403: forbidden' })).findings;
    expect(findings).toContain('ruleset bypass actors could not be verified');
    expect(findings.some(message => message.includes('HTTP 403: forbidden'))).toBe(true);
  });

  it('preserves unavailable branch-rule evidence even with complete classic protection', () => {
    const findings = githubAuthority(opts, '.', apiFor({ rulesError: 'HTTP 503: unavailable' })).findings;
    expect(findings.some(message => message.includes('HTTP 503: unavailable'))).toBe(true);
  });

  it.each([undefined, null, {}, 'not-rules'])('does not certify malformed branch rules %j through fallback', (rules) => {
    const findings = githubAuthority(opts, '.', apiFor({ rules })).findings;
    expect(findings.some(message => message.includes('branch rules could not be verified'))).toBe(true);
  });

  it('retains the repository required-check contract in classic fallback', () => {
    const findings = githubAuthority(opts, '.', apiFor({ classic: classicFor(['tamperward']) })).findings;
    expect(findings.some(message => message.includes('typecheck'))).toBe(true);
    expect(findings.some(message => message.includes('verifier-container'))).toBe(true);
  });

  it('accepts complete composed requirements only when bypass evidence is explicitly empty', () => {
    expect(githubAuthority(opts, '.', apiFor()).findings).toEqual([]);
  });

  it('does not query optional classic protection once complete ruleset evidence suffices', () => {
    const api = apiFor({ rules: rulesFor() });
    expect(githubAuthority(opts, '.', api).findings).toEqual([]);
    expect(api).not.toHaveBeenCalledWith('.', `${prefix}/branches/main/protection`);
  });

  it('cannot improve a safe verdict by adding unknown or adverse bypass evidence', () => {
    const rules = rulesFor(['tamperward']);
    expect(evaluateGitHubProtection({ rules, bypassActors: [] })).toEqual([]);
    for (const bypassActors of [undefined, null, {}, [{ actor_id: 1 }]]) {
      expect(evaluateGitHubProtection({ rules, bypassActors }).length).toBeGreaterThan(0);
    }
  });
});
