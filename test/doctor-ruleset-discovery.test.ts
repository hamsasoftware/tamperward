import { describe, expect, it, vi } from 'vitest';
import { githubAuthority } from '../src/cli/doctor';
import { validateCliArgs } from '../src/cli/main';

const prefix = 'repos/acme/project';
const opts = { repo: 'acme/project', branch: 'release/next' };
const rule = (id: number, source = 'acme/project', sourceType = 'Repository') => ({
  type: 'pull_request', ruleset_id: id, ruleset_source: source, ruleset_source_type: sourceType,
  parameters: { require_code_owner_review: true, dismiss_stale_reviews_on_push: true },
});
const checks = (id: number, contexts = ['tamperward']) => ({
  type: 'required_status_checks', ruleset_id: id, ruleset_source: 'acme/project', ruleset_source_type: 'Repository',
  parameters: { required_status_checks: contexts.map(context => ({ context })) },
});

function api(rules: unknown[], details: Record<string, unknown>, classic: unknown = {}) {
  return vi.fn((_cwd: string, endpoint: string): unknown => {
    if (endpoint.startsWith(`${prefix}/rules/branches/`)) {
      const page = Number(new URLSearchParams(endpoint.split('?')[1]).get('page'));
      return rules.slice((page - 1) * 100, page * 100);
    }
    if (endpoint in details) return details[endpoint];
    if (endpoint === `${prefix}/branches/release%2Fnext/protection`) return classic;
    throw new Error(`unexpected endpoint: ${endpoint}`);
  });
}

describe('applicable ruleset collection (#797)', () => {
  it('uses branch-rule provenance, not ruleset display names, for an arbitrary branch', () => {
    const read = api([rule(7), checks(7)], { [`${prefix}/rulesets/7`]: { name: 'renamed', bypass_actors: [] } });
    expect(githubAuthority(opts, '.', read).findings).toEqual([]);
    expect(read).toHaveBeenCalledWith('.', `${prefix}/rulesets/7`);
  });

  it('inspects every applicable repository and inherited organisation ruleset', () => {
    const read = api([rule(7), checks(7), rule(8, 'acme', 'Organization')], {
      [`${prefix}/rulesets/7`]: { bypass_actors: [] },
      'orgs/acme/rulesets/8': { bypass_actors: [{ actor_id: 1 }] },
    });
    expect(githubAuthority(opts, '.', read).findings).toContain('remove unintended ruleset bypass actors');
    expect(read).toHaveBeenCalledWith('.', 'orgs/acme/rulesets/8');
  });

  it('paginates branch rules without losing a late adverse ruleset', () => {
    const rules: unknown[] = Array.from({ length: 100 }, () => rule(7)); rules.push(rule(8)); rules.push(checks(7));
    const read = api(rules, {
      [`${prefix}/rulesets/7`]: { bypass_actors: [] },
      [`${prefix}/rulesets/8`]: { bypass_actors: [{ actor_id: 2 }] },
    });
    expect(githubAuthority(opts, '.', read).findings).toContain('remove unintended ruleset bypass actors');
    expect(read).toHaveBeenCalledWith('.', `${prefix}/rules/branches/release%2Fnext?per_page=100&page=2`);
  });

  it('keeps unknown provenance or unavailable detail adverse after classic fallback', () => {
    const unknown = api([{ type: 'pull_request', parameters: { require_code_owner_review: true, dismiss_stale_reviews_on_push: true } }, checks(7)], {
      [`${prefix}/rulesets/7`]: { bypass_actors: [] },
    }, { required_status_checks: { contexts: ['tamperward'] } });
    expect(githubAuthority(opts, '.', unknown).findings.some(f => f.includes('ruleset'))).toBe(true);

    const denied = api([rule(7), checks(7)], {}, {});
    expect(githubAuthority(opts, '.', denied).findings.some(f => f.includes('ruleset'))).toBe(true);
  });

  it('permits classic-only protection with a verified empty branch-rule collection', () => {
    const read = api([], {}, {
      required_pull_request_reviews: { require_code_owner_reviews: true, dismiss_stale_reviews: true },
      required_status_checks: { contexts: ['tamperward'] },
    });
    expect(githubAuthority(opts, '.', read).findings).toEqual([]);
  });

  it('uses the explicit check contract unchanged during classic fallback', () => {
    const read = api([rule(7)], { [`${prefix}/rulesets/7`]: { bypass_actors: [] } }, {
      required_status_checks: { contexts: ['tamperward'] },
    });
    expect(githubAuthority({ ...opts, requiredChecks: ['tamperward', 'integration'] }, '.', read).findings)
      .toContain('require the integration status check');
  });

  it('treats a full tenth page as unknown instead of silently truncating', () => {
    const read = api(Array.from({ length: 1000 }, () => rule(7)), {
      [`${prefix}/rulesets/7`]: { bypass_actors: [] },
    });
    expect(githubAuthority(opts, '.', read).findings.some(f => f.includes('inspection limit'))).toBe(true);
  });

  it('refuses an unknown or malformed bypass list even with other healthy rulesets', () => {
    const read = api([rule(7), checks(7), rule(8)], {
      [`${prefix}/rulesets/7`]: { bypass_actors: [] },
      [`${prefix}/rulesets/8`]: { bypass_actors: null },
    });
    expect(githubAuthority(opts, '.', read).findings).toContain('ruleset bypass actors could not be verified');
  });

  it('validates the named and exact-check CLI contracts', () => {
    expect(validateCliArgs('doctor', ['--github', '--check-contract', 'tamperward-repo'])).toBeUndefined();
    expect(validateCliArgs('doctor', ['--github', '--required-checks', 'tamperward,integration'])).toBeUndefined();
    expect(validateCliArgs('doctor', ['--check-contract', 'unknown'])).toContain('tamperward-repo');
    expect(validateCliArgs('doctor', ['--check-contract', 'tamperward-repo', '--required-checks', 'tamperward']))
      .toContain('either');
  });
});
