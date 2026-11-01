import { describe, expect, it } from 'vitest';
import { capabilityReadiness } from '../src/capability-readiness';
import type { DoctorCheck } from '../src/cli/doctor';

const base = (): DoctorCheck[] => [
  { id: 'policy', state: 'OK', detail: '' },
  { id: 'verifier', state: 'WARN', detail: 'checkpointed-local residual' },
  { id: 'platform', state: 'OK', detail: '' },
  ...['ci-verifier', 'ci-wiring', 'codeowners', 'workflow-permissions', 'github-authority']
    .map(id => ({ id, state: 'OK' as const, detail: '' })),
];
const states = (checks: DoctorCheck[], platform: NodeJS.Platform, verifierBackend: 'local' | 'container' = 'local', containerPreflight?: boolean) =>
  Object.fromEntries(capabilityReadiness({ checks, platform, verifierBackend, containerPreflight }).map(x => [x.id, x.state]));
const replace = (checks: DoctorCheck[], id: string, state: DoctorCheck['state']) =>
  checks.map(x => x.id === id ? { ...x, state } : x);

describe('command-specific readiness from doctor evidence (#803)', () => {
  it.each([
    ['linux', 'OK', 'AVAILABLE', 'AVAILABLE'],
    ['darwin', 'BROKEN', 'AVAILABLE', 'BLOCKED'],
    ['win32', 'BROKEN', 'BLOCKED', 'BLOCKED'],
  ] as const)('%s retains static checks while local and lifecycle support differ', (platform, platformState, local, lifecycle) => {
    const checks = replace(base(), 'platform', platformState);
    expect(states(checks, platform)).toMatchObject({
      'static-check': 'AVAILABLE', 'local-verify': local, 'container-verify': 'UNVERIFIED',
      'run-lifecycle': lifecycle, 'protected-ci': 'AVAILABLE',
    });
  });
  it('missing trusted Linux runtime blocks only lifecycle, without promoting global authority', () => {
    const checks = replace(base(), 'platform', 'BROKEN');
    expect(checks.some(x => x.state === 'BROKEN')).toBe(true);
    expect(states(checks, 'linux')).toMatchObject({ 'run-lifecycle': 'BLOCKED', 'local-verify': 'AVAILABLE' });
  });
  it('knows a non-Linux lifecycle is blocked even when doctor stopped before its platform check', () => {
    const early = base().filter(x => x.id !== 'platform');
    expect(states(early, 'darwin')['run-lifecycle']).toBe('BLOCKED');
    expect(states(early, 'win32')['run-lifecycle']).toBe('BLOCKED');
    expect(states(early, 'linux')['run-lifecycle']).toBe('UNVERIFIED');
  });
  it('Docker configuration alone is unverified; a failed preflight blocks container verification', () => {
    const checks = base();
    expect(states(checks, 'linux', 'container')['container-verify']).toBe('UNVERIFIED');
    expect(states(checks, 'linux', 'container', false)['container-verify']).toBe('BLOCKED');
    expect(states(checks, 'linux', 'container', true)['container-verify']).toBe('AVAILABLE');
    expect(states(checks, 'linux', 'container')['local-verify']).toBe('UNVERIFIED');
  });
  it('partial installation and missing GitHub evidence never claim protected CI readiness', () => {
    const partial = replace(base(), 'verifier', 'BROKEN').filter(x => x.id !== 'github-authority');
    expect(states(partial, 'linux')).toMatchObject({ 'local-verify': 'BLOCKED', 'container-verify': 'BLOCKED', 'protected-ci': 'UNVERIFIED' });
    expect(states(replace(base(), 'workflow-permissions', 'BROKEN'), 'linux')['protected-ci']).toBe('BLOCKED');
    expect(states(replace(base(), 'policy', 'BROKEN'), 'linux')['static-check']).toBe('BLOCKED');
  });
  it('keeps named doctor preflight evidence authoritative over a separate readiness hint', () => {
    const checks = [...base(), { id: 'container-preflight', state: 'BROKEN' as const, detail: 'Docker unavailable' }];
    expect(states(checks, 'linux', 'container', true)['container-verify']).toBe('BLOCKED');
    checks[checks.length - 1] = { id: 'container-preflight', state: 'OK', detail: 'Docker and pinned image checked' };
    expect(states(checks, 'linux', 'container')['container-verify']).toBe('AVAILABLE');
  });
  it('keeps actionable command guidance on every state', () => {
    const values = capabilityReadiness({ checks: base(), platform: 'linux', verifierBackend: 'local' });
    expect(values.map(x => x.id)).toEqual(['static-check', 'local-verify', 'container-verify', 'run-lifecycle', 'protected-ci']);
    expect(values.every(x => x.next.length > 20)).toBe(true);
  });
});
