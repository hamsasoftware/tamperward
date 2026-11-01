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

export function evaluateGitHubProtection(
  snapshot: GitHubProtectionSnapshot,
  requiredCheck = 'tamperward',
  requiredChecks: readonly string[] = [requiredCheck],
): string[] {
  let hasCodeOwnerReview = false;
  let dismissesStaleReviews = false;
  const presentChecks = new Set<string>();

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
            if (typeof check?.context === 'string') presentChecks.add(check.context);
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
    if (Array.isArray(contexts)) {
      for (const context of contexts) if (typeof context === 'string') presentChecks.add(context);
    }
    const checks = status.checks;
    if (Array.isArray(checks)) {
      for (const rawCheck of checks) {
        const check = asMapping(rawCheck);
        if (typeof check?.context === 'string') presentChecks.add(check.context);
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
