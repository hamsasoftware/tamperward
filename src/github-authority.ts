// Pure GitHub authority evidence evaluation. API collection and CLI rendering live elsewhere.
import { isRecord } from './narrow';

function asMapping(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export interface GitHubProtectionSnapshot {
  rules?: unknown;
  branchProtection?: unknown;
  /** Bypass actors from the active ruleset detail, when available. */
  bypassActors?: unknown;
}

export const REPOSITORY_REQUIRED_CHECKS = [
  'typecheck',
  'test (20)',
  'test (22)',
  'test (24)',
  'build',
  'gate',
  // platform-contract is a matrix over os: [ubuntu-latest, macos-latest, windows-latest]
  // (see .github/workflows/ci.yml). GitHub publishes one check context per matrix cell,
  // named "<job> (<os>)"; the bare job name is never a real context, so it must be
  // enumerated per cell or the required-status check reports a false authority failure.
  'platform-contract (ubuntu-latest)',
  'platform-contract (macos-latest)',
  'platform-contract (windows-latest)',
  'harness-core',
  'round4-harness',
  'pilot-provisioning',
  'verifier-container',
] as const;

export const REPOSITORY_REQUIRED_CHECK_INTEGRATION_ID = 15368;

export function evaluateGitHubProtection(
  snapshot: GitHubProtectionSnapshot,
  requiredCheck = 'tamperward',
  requiredChecks: readonly string[] = [requiredCheck],
  expectedIntegrationId?: number,
): string[] {
  let hasCodeOwnerReview = false;
  let dismissesStaleReviews = false;
  const presentChecks = new Set<string>();
  const checkIntegrations = new Map<string, unknown[]>();
  const recordIntegration = (context: string, integrationId: unknown): void => {
    const observed = checkIntegrations.get(context) ?? [];
    observed.push(integrationId);
    checkIntegrations.set(context, observed);
  };

  if (Array.isArray(snapshot.rules)) {
    for (const raw of snapshot.rules) {
      const rule = asMapping(raw);
      const params = asMapping(rule?.parameters);
      if (!rule || !params) continue;

      if (rule.type === 'pull_request') {
        if (params.require_code_owner_review === true) hasCodeOwnerReview = true;
        if (params.dismiss_stale_reviews_on_push === true) dismissesStaleReviews = true;
      }

      if (rule.type === 'required_status_checks') {
        const checks = params.required_status_checks;
        if (Array.isArray(checks)) {
          for (const rawCheck of checks) {
            const check = asMapping(rawCheck);
            if (typeof check?.context === 'string') {
              presentChecks.add(check.context);
              recordIntegration(check.context, check.integration_id);
            }
          }
        }
      }
    }
  }

  const classic = asMapping(snapshot.branchProtection);
  const reviews = asMapping(classic?.required_pull_request_reviews);
  if (reviews?.require_code_owner_reviews === true) hasCodeOwnerReview = true;
  if (reviews?.dismiss_stale_reviews === true) dismissesStaleReviews = true;

  const status = asMapping(classic?.required_status_checks);
  if (status) {
    const contexts = status.contexts;
    const checks = status.checks;
    const checksWithContext = new Set<string>();
    if (Array.isArray(checks)) {
      for (const rawCheck of checks) {
        const check = asMapping(rawCheck);
        if (typeof check?.context === 'string') {
          presentChecks.add(check.context);
          checksWithContext.add(check.context);
          recordIntegration(check.context, check.app_id);
        }
      }
    }
    // The legacy `contexts` field carries no source identity. When GitHub also
    // provides the richer `checks` entries, use those instead of double counting.
    if (Array.isArray(contexts)) {
      for (const context of contexts) {
        if (typeof context !== 'string') continue;
        presentChecks.add(context);
        if (!checksWithContext.has(context)) recordIntegration(context, undefined);
      }
    }
  }

  const findings: string[] = [];
  const missing = requiredChecks.filter((check) => !presentChecks.has(check));
  if (missing.length) findings.push(
    missing.length === 1
      ? 'require the ' + missing[0] + ' status check'
      : 'require status checks: ' + missing.join(', '),
  );
  if (expectedIntegrationId !== undefined) {
    for (const check of requiredChecks) {
      if (!presentChecks.has(check)) continue;
      const integrations = checkIntegrations.get(check) ?? [];
      if (integrations.length === 0 || integrations.some(id => id !== expectedIntegrationId)) {
        findings.push(
          'bind status check ' + check + ' to GitHub Actions integration ' + expectedIntegrationId,
        );
      }
    }
  }
  if (!hasCodeOwnerReview) findings.push('require Code Owner review');
  if (!dismissesStaleReviews) findings.push('dismiss stale pull request approvals on new pushes');
  // GitHub omits bypass_actors when the requester cannot inspect it. Absence
  // is unknown evidence, not an empty grant list (#795).
  if (!Array.isArray(snapshot.bypassActors)) {
    findings.push('ruleset bypass actors could not be verified');
  } else if (snapshot.bypassActors.length > 0) {
    findings.push('remove unintended ruleset bypass actors');
  }
  return findings;
}
