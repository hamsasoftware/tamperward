// A conservative projection of doctor evidence into command-specific readiness.
// These labels are guidance, not a substitute for each command's own preflight.
import type { DoctorCheck } from './cli/doctor';

export type CapabilityId = 'static-check' | 'local-verify' | 'container-verify' | 'run-lifecycle' | 'protected-ci';
export type CapabilityState = 'AVAILABLE' | 'BLOCKED' | 'UNVERIFIED';
export interface CapabilityReadiness { id: CapabilityId; state: CapabilityState; next: string }
export interface CapabilityInputs {
  checks: readonly DoctorCheck[];
  platform: NodeJS.Platform;
  verifierBackend?: 'local' | 'container';
  /** Only an independently completed backend preflight may supply this evidence. */
  containerPreflight?: boolean;
}

export function capabilityReadiness(input: CapabilityInputs): CapabilityReadiness[] {
  const state = (id: string) => input.checks.find(c => c.id === id)?.state;
  const broken = (...ids: string[]) => ids.some(id => state(id) === 'BROKEN');
  const policyBlocked = broken('policy', 'doctor', 'policy-floor');
  const configured = state('verifier') !== undefined && state('verifier') !== 'BROKEN';
  const preflightCheck = state('container-preflight');
  const containerPreflight = preflightCheck === 'OK' ? true
    : preflightCheck === 'BROKEN' ? false
    : preflightCheck === undefined ? input.containerPreflight : undefined;
  const staticCheck: CapabilityReadiness = policyBlocked
    ? { id: 'static-check', state: 'BLOCKED', next: 'Fix the policy or authority input named by doctor, then run `tamperward check --worktree`.' }
    : state('policy') === 'OK'
      ? { id: 'static-check', state: 'AVAILABLE', next: 'Run `tamperward check --worktree` for the current diff.' }
      : { id: 'static-check', state: 'UNVERIFIED', next: 'Run `tamperward doctor` to inspect the policy, then `tamperward check --worktree`.' };

  const local: CapabilityReadiness = policyBlocked || broken('verifier') || input.platform === 'win32'
    ? { id: 'local-verify', state: 'BLOCKED', next: input.platform === 'win32'
      ? 'Local verification requires POSIX /bin/sh; configure and preflight a digest-pinned container verifier.'
      : 'Configure a trusted verify command and fix the broken policy before `tamperward verify`.' }
    : configured && input.verifierBackend === 'local'
      ? { id: 'local-verify', state: 'AVAILABLE', next: 'Run `tamperward verify --base <base>`; checkpointed-local retains its documented same-host residual.' }
      : { id: 'local-verify', state: 'UNVERIFIED', next: 'Configure and check a checkpointed-local verifier before relying on local verification.' };

  const container: CapabilityReadiness = policyBlocked || broken('verifier') || containerPreflight === false
    ? { id: 'container-verify', state: 'BLOCKED', next: 'Fix the verifier configuration, Docker authority or pinned image, then rerun `tamperward doctor` before verification.' }
    : configured && input.verifierBackend === 'container' && containerPreflight === true
      ? { id: 'container-verify', state: 'AVAILABLE', next: 'Run `tamperward verify`; recheck Docker and the pinned image for each verification.' }
      : { id: 'container-verify', state: 'UNVERIFIED', next: 'Configure a digest-pinned image and run `tamperward doctor` for a read-only Docker authority preflight.' };

  const lifecycle: CapabilityReadiness = input.platform !== 'linux' || state('platform') === 'BROKEN'
    ? { id: 'run-lifecycle', state: 'BLOCKED', next: 'Use a supported Linux host with trusted system Python for authoritative `tamperward run`.' }
    : state('platform') === 'OK'
      ? { id: 'run-lifecycle', state: 'AVAILABLE', next: 'Linux lifecycle supervision is available; `tamperward run` still checks repository and verifier authority.' }
      : { id: 'run-lifecycle', state: 'UNVERIFIED', next: 'Run `tamperward doctor` to check authoritative lifecycle prerequisites.' };

  const ciIds = ['ci-verifier', 'ci-wiring', 'codeowners', 'workflow-permissions', 'github-authority'];
  const ci: CapabilityReadiness = policyBlocked || broken(...ciIds)
    ? { id: 'protected-ci', state: 'BLOCKED', next: 'Fix the broken CI workflow or repository authority check and rerun `tamperward doctor --github`.' }
    : ciIds.every(id => state(id) === 'OK')
      ? { id: 'protected-ci', state: 'AVAILABLE', next: 'Keep required checks and branch authority pinned; recheck them when the repository changes.' }
      : { id: 'protected-ci', state: 'UNVERIFIED', next: 'Run `tamperward doctor --github --repo OWNER/REPO --branch <default-branch>` with authority access.' };
  return [staticCheck, local, container, lifecycle, ci];
}
