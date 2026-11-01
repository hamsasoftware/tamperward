import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { yaml } from '../lazy-deps';
import { defaultPolicy, POLICY_VERSION } from '../policy';
import { loadPolicy, loadPolicyAt, PolicyError } from '../policy-load';
import { requiredVerifierAuthoritySeconds } from '../verifier-limits';
import { defaultEventLog, watcherTelemetry } from './watch';
import { planInit } from './init';
import { compareVersions, TW_VERSION } from '../wiring';
import { trustedLinuxPython } from './run';
import { machineOutput, type MachineSchemaVersion } from '../machine-output';
import { execFailure, isRecord } from '../narrow';
import { repoRoot } from '../repo-context';
import { colourEnabled } from './render/text';
import { evaluateGitHubProtection, REPOSITORY_REQUIRED_CHECKS } from '../github-authority';
export { evaluateGitHubProtection, REPOSITORY_REQUIRED_CHECKS } from '../github-authority';
export type { GitHubProtectionSnapshot } from '../github-authority';
import { readStateFile } from '../disk';
import { paint, severityColour, BOLD, type Severity } from './render/status';
import { capabilityReadiness, type CapabilityReadiness } from '../capability-readiness';
import { prepareVerifierBackend } from '../verifier-backend';

export interface DoctorOpts {
  cwd?: string;
  /** Trusted policy revision. Generated PR CI passes the pull request base SHA. */
  base?: string;
  /** Workflow to inspect. When omitted, discover every .yml/.yaml workflow. */
  workflow?: string;
  /** Also validate GitHub repository authority on the protected branch. */
  github?: boolean;
  /** GitHub repository in OWNER/REPO form. Inferred from env/origin when omitted. */
  repo?: string;
  /** Protected branch. Defaults to GITHUB_BASE_REF or GitHub's default branch. */
  branch?: string;
  /** Exact required status contexts, or the named repository contract. */
  requiredChecks?: string[];
  checkContract?: 'tamperward-repo';
  /** Emit one machine-readable posture document instead of prose. */
  json?: boolean;
}

export type DoctorState = 'OK' | 'WARN' | 'BROKEN';

export interface DoctorCheck {
  id: string;
  state: DoctorState;
  detail: string;
}

export interface DoctorReport {
  schema_version: MachineSchemaVersion;
  command: 'doctor';
  authoritative: boolean;
  checks: DoctorCheck[];
  capabilities: CapabilityReadiness[];
}

/** @internal Pure platform rendering for tests; runtime calls trustedLinuxPython itself. */
export function lifecyclePlatformCheck(
  platform: NodeJS.Platform = process.platform,
  linuxPython: { path: string | null; reason?: string } | null =
    platform === 'linux' ? trustedLinuxPython() : null,
): DoctorCheck {
  if (platform === 'linux') {
    if (linuxPython?.path) {
      return {
        id: 'platform',
        state: 'OK',
        detail:
          `Linux: authoritative run lifecycle uses PR_SET_CHILD_SUBREAPER via trusted ${linuxPython.path} ` +
          'with isolated Python startup and ECHILD drain; verifier-entry dependency attestation remains independent',
      };
    }
    return {
      id: 'platform',
      state: 'BROKEN',
      detail:
        'Linux: authoritative run lifecycle is unavailable (' +
        (linuxPython?.reason ?? 'trusted system python3 unavailable') +
        '); tamperward run fails closed before agent start',
    };
  }
  if (platform === 'win32') {
    return {
      id: 'platform',
      state: 'BROKEN',
      detail:
        'Windows: authoritative tamperward run lifecycle ownership is unavailable; taskkill /T /F is only a best-effort tree fallback, so run fails closed before agent start. Standalone check remains available; checkpointed-local verify is unsupported because this release defines verifier command semantics only through POSIX /bin/sh. A container verifier must pass its own Docker authority preflight.',
    };
  }
  return {
    id: 'platform',
    state: 'BROKEN',
    detail:
      `${platform}: authoritative tamperward run lifecycle ownership is unavailable because this release has no ` +
      'subreaper/ECHILD-equivalent backend; run fails closed before agent start. Standalone check/verify remain available.',
  };
}

const VERIFY_COMMAND = /\btamperward(?:@\S+)?\s+verify\b/;

/**
 * What doctor concluded, before anything is printed. `runDoctor` renders it;
 * `tamperward onboard` reads it to derive its final posture from doctor rather
 * than from a second definition of a valid installation (#388).
 */
export interface DoctorOutcome {
  /** 0 when every check could be evaluated, 2 when doctor could not certify. */
  code: 0 | 2;
  authoritative: boolean;
  checks: DoctorCheck[];
  verifierBackend?: 'local' | 'container';
  /** Set when doctor stopped early: the failing check id and its message. */
  failure?: { id: string; message: string };
  /** Human summary lines runDoctor prints before the check report on success. */
  summary: string[];
  /** Present when `--github` was requested and the authority was verified. */
  github?: { repo: string; branch: string };
}

function failed(message: string, id = 'doctor', checks: DoctorCheck[] = []): DoctorOutcome {
  return {
    code: 2,
    authoritative: false,
    checks: [
      ...checks.filter((check) => check.id !== id),
      { id, state: 'BROKEN', detail: message },
    ],
    failure: { id, message },
    summary: [],
  };
}

function policyFor(opts: DoctorOpts, cwd: string) {
  if (!opts.base) return loadPolicy(cwd);
  const atBase = loadPolicyAt(opts.base, cwd);
  return atBase ?? defaultPolicy();
}

function asMapping(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}


function wiringState(status: string, authority: boolean): DoctorState {
  if (status === 'ok') return 'OK';
  if (status === 'skip') return 'WARN';
  return authority ? 'BROKEN' : 'WARN';
}

function pinsInFile(path: string): string[] {
  const src = readStateFile(path);
  return src === null ? [] : Array.from(src.matchAll(/\btamperward@((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\b/g), (m) => m[1]);
}

function permissionWrites(value: unknown): string[] | null {
  if (typeof value === 'string') {
    if (/write/i.test(value)) return [value];
    if (/^(?:read-all|none)$/i.test(value)) return [];
    return null;
  }
  const mapping = asMapping(value);
  if (!mapping) return null;
  return Object.entries(mapping)
    .filter(([, permission]) => typeof permission === 'string' && /write/i.test(permission))
    .map(([name, permission]) => `${name}=${String(permission)}`);
}

function containerPreflightCheck(verify: ReturnType<typeof loadPolicy>['verify']): DoctorCheck {
  try {
    const backend = prepareVerifierBackend(verify);
    return {
      id: 'container-preflight',
      state: backend.available ? 'OK' : 'BROKEN',
      detail: backend.available
        ? `Docker authority and locally present digest-pinned image ${backend.image} passed the read-only preflight; verify repeats it before each execution`
        : `${backend.reason ?? 'Docker authority preflight failed'}; fix Docker authority and preload the pinned image, then rerun tamperward doctor`,
    };
  } catch (error) {
    return {
      id: 'container-preflight', state: 'BROKEN',
      detail: `Docker authority preflight could not complete: ${error instanceof Error ? error.message : String(error)}; inspect Docker and rerun tamperward doctor`,
    };
  }
}

function workflowPermissionCheck(
  cwd: string,
  workflowRels: string[] = ['.github/workflows/tamperward.yml'],
): DoctorCheck {
  const broken: string[] = [];
  const warnings: string[] = [];

  for (const rel of workflowRels) {
    const path = resolve(cwd, rel);
    let text: string | null;
    try { text = readStateFile(path); } catch (e) {
      broken.push(`${rel} cannot be inspected (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    if (text === null) {
      broken.push(`${rel} is missing`);
      continue;
    }

    let doc: unknown;
    try {
      doc = yaml.parse(text);
    } catch (e) {
      broken.push(`${rel} is not valid YAML (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }

    const root = asMapping(doc);
    if (!root) {
      broken.push(`${rel} is not a YAML mapping`);
      continue;
    }

    const rootPermissions = root.permissions;
    if (rootPermissions === undefined) {
      broken.push(`${rel}: workflow does not declare least-privilege permissions; repository defaults could grant write access`);
    } else {
      const writes = permissionWrites(rootPermissions);
      if (writes === null) {
        broken.push(`${rel}: workflow permissions shape is unsupported`);
      } else if (writes.length) {
        broken.push(`${rel}: workflow grants write permission: ${writes.join(', ')}`);
      } else {
        const mapping = asMapping(rootPermissions);
        if (mapping && mapping.contents !== 'read') {
          warnings.push(`${rel}: workflow permissions contain no writes but contents: read is not declared`);
        }
      }
    }

    const jobs = asMapping(root.jobs);
    if (!jobs) continue;
    for (const [name, rawJob] of Object.entries(jobs)) {
      const job = asMapping(rawJob);
      if (!job || job.permissions === undefined) continue;
      const writes = permissionWrites(job.permissions);
      if (writes === null) {
        broken.push(`${rel} job "${name}": permissions shape is unsupported`);
      } else if (writes.length) {
        broken.push(`${rel} job "${name}" grants write permission: ${writes.join(', ')}`);
      }
    }
  }

  if (broken.length) {
    return {
      id: 'workflow-permissions',
      state: 'BROKEN',
      detail: broken.join('; '),
    };
  }
  if (warnings.length) {
    return {
      id: 'workflow-permissions',
      state: 'WARN',
      detail: warnings.join('; '),
    };
  }
  return {
    id: 'workflow-permissions',
    state: 'OK',
    detail: `${workflowRels.join(', ')}: workflow/job token permissions contain no write grants and workflow contents access is read-only`,
  };
}

/**
 * Read-only local/repository posture. Reuse init's canonical wiring planner so
 * doctor cannot drift into a second definition of "correctly installed".
 */
export function collectLocalPosture(
  cwd: string,
  policy: ReturnType<typeof loadPolicy>,
  authorityWorkflows?: string[],
  explicitWorkflow = false,
): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  checks.push(
    policy.version <= POLICY_VERSION
      ? { id: 'policy', state: 'OK', detail: `policy version ${policy.version} is understood (current schema ${POLICY_VERSION})` }
      : { id: 'policy', state: 'BROKEN', detail: `policy version ${policy.version} is newer than this binary's schema ${POLICY_VERSION}; authority cannot be certified for unknown policy semantics` },
  );

  let plan: ReturnType<typeof planInit> = [];
  try {
    plan = planInit(cwd);
  } catch (e) {
    checks.push({
      id: 'installation-plan',
      state: 'BROKEN',
      detail: `canonical wiring could not be evaluated: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  const byItem = new Map(plan.map((x) => [x.item, x]));
  const addWiring = (id: string, item: string, authority: boolean): void => {
    const action = byItem.get(item);
    if (!action) {
      checks.push({ id, state: authority ? 'BROKEN' : 'WARN', detail: `${item} wiring could not be evaluated` });
      return;
    }
    checks.push({
      id,
      state: wiringState(action.status, authority),
      detail: action.status === 'ok'
        ? action.detail
        : `${action.status}: ${action.detail}`,
    });
  };

  addWiring('claude-hooks', 'agent', true);
  addWiring('pre-commit', 'pre-commit', false);

  const canonicalWorkflow = '.github/workflows/tamperward.yml';
  if (authorityWorkflows?.length) {
    const normalized = authorityWorkflows.map((x) => x.replace(/\\/g, '/'));
    if (explicitWorkflow) {
      checks.push({
        id: 'ci-wiring',
        state: 'OK',
        detail: `explicit verifier authority workflow: ${normalized.join(', ')}; verifier step/timeout validated by doctor`,
      });
    } else if (normalized.includes(canonicalWorkflow)) {
      addWiring('ci-wiring', 'ci', true);
    } else {
      checks.push({
        id: 'ci-wiring',
        state: 'OK',
        detail: `discovered verifier authority workflow(s): ${normalized.join(', ')}; verifier step/timeout validated by doctor`,
      });
    }
  } else {
    addWiring('ci-wiring', 'ci', true);
  }

  addWiring('codeowners', 'codeowners', true);
  checks.push(workflowPermissionCheck(cwd, authorityWorkflows));

  let pins: string[] = [];
  let pinError: string | null = null;
  try {
    pins = [
      ...pinsInFile(join(cwd, '.claude', 'settings.json')),
      ...pinsInFile(join(cwd, '.git', 'hooks', 'pre-commit')),
      ...pinsInFile(join(cwd, '.husky', 'pre-commit')),
    ];
  } catch (e) {
    pinError = e instanceof Error ? e.message : String(e);
  }
  const below = pins.filter((pin) => (compareVersions(pin, TW_VERSION) ?? 0) < 0);
  const above = pins.filter((pin) => (compareVersions(TW_VERSION, pin) ?? 0) < 0);
  checks.push(
    pinError
      ? { id: 'binary-version', state: 'BROKEN', detail: `cannot inspect version pins: ${pinError}` }
      : below.length
      ? { id: 'binary-version', state: 'BROKEN', detail: `wiring pins older TamperWard version(s): ${Array.from(new Set(below)).join(', ')}; running binary is ${TW_VERSION}` }
      : above.length
        ? { id: 'binary-version', state: 'WARN', detail: `repository wiring targets newer TamperWard version(s): ${Array.from(new Set(above)).join(', ')}; running binary is ${TW_VERSION}` }
        : pins.length
          ? { id: 'binary-version', state: 'OK', detail: `wiring pins agree with running TamperWard ${TW_VERSION}` }
          : { id: 'binary-version', state: 'WARN', detail: `no canonical TamperWard version pin was found; running binary is ${TW_VERSION}` },
  );

  if (!policy.verify?.command) {
    checks.push({ id: 'verifier', state: 'BROKEN', detail: 'verify.command is not configured' });
  } else {
    const backend = policy.verify.backend ?? 'local';
    const inputs = policy.verify.inputs?.length ?? 0;
    checks.push({
      id: 'verifier',
      state: backend === 'container' ? 'OK' : 'WARN',
      detail:
        backend === 'container'
          ? `isolated-container verifier; budget ${policy.verify.budget}s/stage; ${inputs} declared verify.inputs glob(s); container-preflight reports runtime/image authority and verify rechecks it`
          : `checkpointed-local verifier; budget ${policy.verify.budget}s/stage; ${inputs} declared verify.inputs glob(s); same-host/self-restoring mutation remains a documented residual`,
    });
    if (backend === 'container') checks.push(containerPreflightCheck(policy.verify));
  }

  checks.push(lifecyclePlatformCheck());

  return checks;
}

function observerCheck(cwd: string): DoctorCheck {
  const observer = watcherTelemetry(defaultEventLog(cwd));
  if (observer.state === 'healthy' && observer.health) {
    return {
      id: 'observer',
      state: 'OK',
      detail: `healthy ${observer.health.backend}; ${observer.health.watched_dirs} watched dir(s), ${observer.health.event_count} event(s); advisory telemetry only`,
    };
  }
  if (observer.state === 'degraded' && observer.health) {
    return {
      id: 'observer',
      state: 'WARN',
      detail: `degraded: ${observer.health.error_count} error(s), ${observer.health.dropped_events} dropped event(s); ${observer.reason ?? 'telemetry may be incomplete'}; advisory only`,
    };
  }
  return {
    id: 'observer',
    state: 'WARN',
    detail: `unavailable${observer.reason ? ': ' + observer.reason : ''}; optional/advisory, and zero events are not evidence of no transient activity`,
  };
}

function emitReport(opts: DoctorOpts, checks: DoctorCheck[], authoritative: boolean, verifierBackend?: 'local' | 'container'): void {
  const capabilities = capabilityReadiness({ checks, platform: process.platform, verifierBackend });
  if (opts.json) {
    const report: DoctorReport = machineOutput({ command: 'doctor' as const, authoritative, checks, capabilities });
    process.stdout.write(JSON.stringify(report) + '\n');
    return;
  }
  const colour = colourEnabled(process.env, process.stdout);
  for (const check of checks) {
    if (check.id === 'observer') {
      process.stdout.write(`tamperward doctor: transient observer: ${check.detail}\n`);
    } else {
      const sev: Severity = check.state === 'OK' ? 'ok' : check.state === 'WARN' ? 'warn' : check.state === 'BROKEN' ? 'bad' : 'info';
      const tag = paint(`[${check.state}]`, (sev === 'bad' ? BOLD : '') + severityColour(sev), colour);
      process.stdout.write(`tamperward doctor: ${tag} ${check.id} — ${check.detail}\n`);
    }
  }
  for (const capability of capabilities) {
    process.stdout.write(`tamperward doctor: ${capability.id} ${capability.state} — ${capability.next}\n`);
  }
}

function gitText(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function githubRepoFromRemote(remote: string): string | null {
  const m = remote.match(/github\.com(?::|\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  return m ? m[1] + '/' + m[2].replace(/\.git$/i, '') : null;
}

/** OWNER/REPO from GITHUB_REPOSITORY or a github.com origin remote, or null. */
export function inferGitHubRepo(cwd: string): string | null {
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (envRepo && /^[^/\s]+\/[^/\s]+$/.test(envRepo)) return envRepo;

  const remote = gitText(cwd, ['config', '--get', 'remote.origin.url']);
  return remote ? githubRepoFromRemote(remote) : null;
}

const GITHUB_API_SCRIPT = [
  "const endpoint = process.argv[1];",
  "const token = process.env.TAMPERWARD_GITHUB_TOKEN || '';",
  "const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'tamperward-doctor' };",
  "if (token) headers.Authorization = 'Bearer ' + token;",
  "fetch('https://api.github.com/' + endpoint, { headers }).then(async (r) => {",
  "  const body = await r.text();",
  "  if (!r.ok) { process.stderr.write('HTTP ' + r.status + ': ' + body); process.exit(22); }",
  "  process.stdout.write(body);",
  "}).catch((e) => { process.stderr.write(String(e)); process.exit(23); });",
].join('\n');

/** @internal Pure description of the trusted GitHub API subprocess. */
export function githubApiInvocation(endpoint: string, token: string): {
  executable: string;
  args: string[];
  env: Record<string, string>;
} {
  return {
    executable: process.execPath,
    args: ['-e', GITHUB_API_SCRIPT, endpoint],
    env: {
      TAMPERWARD_GITHUB_TOKEN: token,
      LANG: 'C',
      LC_ALL: 'C',
    },
  };
}

function githubApi(cwd: string, endpoint: string): unknown {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
  const invocation = githubApiInvocation(endpoint, token);
  try {
    const stdout = execFileSync(
      invocation.executable,
      invocation.args,
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: invocation.env,
        timeout: 15_000,
      },
    );
    return JSON.parse(stdout);
  } catch (e) {
    const failure = execFailure(e);
    const detail = failure.stderr ? failure.stderr.replace(/\s+/g, ' ').trim() : failure.message;
    throw new Error(
      'GitHub API ' + endpoint + ' failed: ' + (detail || 'unknown error'),
    );
  }
}

/** @internal The transport seam exercises collection and fallback without live API access. */
export function githubAuthority(
  opts: DoctorOpts,
  cwd: string,
  readApi: typeof githubApi = githubApi,
): { repo: string; branch: string; findings: string[] } {
  const repo = opts.repo ?? inferGitHubRepo(cwd);
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error(
      'cannot determine GitHub repository; pass --repo OWNER/REPO or configure a github.com origin',
    );
  }

  let branch = opts.branch ?? process.env.GITHUB_BASE_REF ?? '';
  if (!branch) {
    const meta = asMapping(readApi(cwd, 'repos/' + repo));
    if (typeof meta?.default_branch === 'string') branch = meta.default_branch;
  }
  if (!branch) throw new Error('cannot determine protected branch; pass --branch BRANCH');

  if (opts.checkContract && opts.requiredChecks) {
    throw new Error('choose either --check-contract or --required-checks');
  }
  const requiredChecks = opts.checkContract === 'tamperward-repo' ||
    (repo.toLowerCase() === 'hexrift/tamperward' && !opts.requiredChecks)
    ? REPOSITORY_REQUIRED_CHECKS
    : opts.requiredChecks ?? ['tamperward'];
  if (requiredChecks.length === 0 || requiredChecks.some(check => !check.trim())) {
    throw new Error('required status checks must be nonempty');
  }

  let rules: unknown[] | undefined;
  let rulesError: Error | null = null;
  try {
    rules = [];
    for (let page = 1; page <= 10; page++) {
      const batch = readApi(cwd, 'repos/' + repo + '/rules/branches/' + encodeURIComponent(branch) + '?per_page=100&page=' + page);
      if (!Array.isArray(batch)) throw new Error('branch rules response is not an array');
      rules.push(...batch);
      if (batch.length < 100) break;
      if (page === 10) throw new Error('branch rules exceed the 1000-rule inspection limit');
    }
  } catch (e) {
    rulesError = e instanceof Error ? e : new Error(String(e));
  }

  const inspectionFindings: string[] = [];
  const sources = new Map<number, string>();
  for (const raw of rules ?? []) {
    const item = asMapping(raw);
    const id = item?.ruleset_id;
    const source = item?.ruleset_source;
    const sourceType = item?.ruleset_source_type;
    if (!Number.isSafeInteger(id) || (id as number) <= 0 || typeof source !== 'string' ||
        (sourceType !== 'Repository' && sourceType !== 'Organization')) {
      inspectionFindings.push('branch rule has unknown ruleset provenance');
      continue;
    }
    const endpoint = sourceType === 'Organization'
      ? /^[-\w]+$/.test(source) ? 'orgs/' + source + '/rulesets/' + id : null
      : source === repo ? 'repos/' + repo + '/rulesets/' + id : null;
    if (!endpoint || (sources.has(id as number) && sources.get(id as number) !== endpoint)) {
      inspectionFindings.push('branch rule has inconsistent ruleset provenance');
      continue;
    }
    sources.set(id as number, endpoint);
  }
  let bypassActors: unknown = [];
  if (inspectionFindings.length > 0 || rulesError) bypassActors = undefined;
  for (const [id, endpoint] of sources) {
    try {
      const detail = asMapping(readApi(cwd, endpoint));
      if (!Array.isArray(detail?.bypass_actors)) {
        inspectionFindings.push('ruleset ' + id + ' bypass actors could not be verified');
        if (!Array.isArray(bypassActors) || bypassActors.length === 0) bypassActors = undefined;
      } else if (detail.bypass_actors.length > 0) {
        bypassActors = detail.bypass_actors;
      }
    } catch (e) {
      inspectionFindings.push('ruleset ' + id + ' bypass actors could not be verified: ' +
        (e instanceof Error ? e.message : String(e)));
      if (!Array.isArray(bypassActors) || bypassActors.length === 0) bypassActors = undefined;
    }
  }
  // Fallback can supply a missing requirement, but cannot discard adverse or
  // unknown observations or silently replace the requested check contract.
  if (rulesError) inspectionFindings.push('branch rules could not be verified: ' + rulesError.message);
  const evaluate = (branchProtection?: unknown): string[] => [
    ...evaluateGitHubProtection(
      { rules, bypassActors, branchProtection },
      'tamperward',
      requiredChecks,
    ),
    ...inspectionFindings,
  ];
  let findings = evaluate();
  if (findings.length === 0) return { repo, branch, findings };

  let branchProtection: unknown;
  let classicError: Error | null = null;
  try {
    branchProtection = readApi(
      cwd,
      'repos/' + repo + '/branches/' + encodeURIComponent(branch) + '/protection',
    );
  } catch (e) {
    classicError = e instanceof Error ? e : new Error(String(e));
  }

  findings = evaluate(branchProtection);
  if (findings.length > 0 && rules === undefined && branchProtection === undefined) {
    throw new Error(
      'cannot inspect GitHub repository authority. Rules API: ' +
        (rulesError?.message ?? 'unavailable') +
        '. Classic branch protection API: ' +
        (classicError?.message ?? 'unavailable') +
        '. Authenticate gh with metadata read; classic-protection fallback may also need Administration read.',
    );
  }

  if (findings.length > 0 && branchProtection === undefined && classicError) {
    findings.push(
      'classic branch protection could not be inspected; if it supplies a missing requirement, use GH_TOKEN/GITHUB_TOKEN with Administration read',
    );
  }

  return { repo, branch, findings };
}

function verifyJobs(doc: unknown): Array<{ name: string; job: Record<string, unknown> }> {
  const root = asMapping(doc);
  const jobs = asMapping(root?.jobs);
  if (!jobs) return [];
  const found: Array<{ name: string; job: Record<string, unknown> }> = [];
  for (const [name, raw] of Object.entries(jobs)) {
    const job = asMapping(raw);
    if (!job || !Array.isArray(job.steps)) continue;
    const hasVerify = job.steps.some((step) => {
      const item = asMapping(step);
      return typeof item?.run === 'string' && VERIFY_COMMAND.test(item.run);
    });
    if (hasVerify) found.push({ name, job });
  }
  return found;
}

/**
 * Validate that every job which runs TamperWard verify has enough outer wall
 * clock for the trusted policy's visible + pristine stage budgets plus the
 * fixed authority reserve.
 *
 * This is deliberately a diagnostic, not a policy-schema restriction. A large
 * verify.budget remains valid for custom runners; generated GitHub CI refuses
 * to pretend its own outer timeout can accommodate one that exceeds its host.
 */
export function diagnose(opts: DoctorOpts = {}): DoctorOutcome {
  // The posture is the repository's: policy, workflows and wiring are read at the
  // root from any subdirectory (#412).
  const cwd = repoRoot(resolve(opts.cwd ?? process.cwd()));

  let policy;
  try {
    policy = policyFor(opts, cwd);
  } catch (e) {
    return failed(
      e instanceof PolicyError || e instanceof Error ? e.message : String(e),
      'policy',
    );
  }

  let postureWorkflows: string[] | undefined = opts.workflow ? [opts.workflow] : undefined;
  const fail = (id: string, message: string): DoctorOutcome => ({
    ...failed(
      message,
      id,
      collectLocalPosture(cwd, policy, postureWorkflows, Boolean(opts.workflow)),
    ),
    verifierBackend: policy.verify?.backend ?? 'local',
  });

  if (!policy.verify?.command) {
    return fail('verifier', 'trusted policy has no verify.command; generated CI cannot verify this repository');
  }

  const workflowRels: string[] = [];
  if (opts.workflow) {
    workflowRels.push(opts.workflow);
  } else {
    const workflowDirRel = '.github/workflows';
    const workflowDir = resolve(cwd, workflowDirRel);
    if (!existsSync(workflowDir)) {
      return fail('ci-verifier', `${workflowDirRel}: workflow directory does not exist`);
    }
    let entries: string[];
    try {
      entries = readdirSync(workflowDir)
        .filter((name) => /\.ya?ml$/i.test(name))
        .sort();
    } catch (e) {
      return fail('ci-verifier', 
        `${workflowDirRel}: could not enumerate workflows (${e instanceof Error ? e.message : String(e)})`,
      );
    }
    for (const name of entries) workflowRels.push(join(workflowDirRel, name));
  }

  const requiredSecs = requiredVerifierAuthoritySeconds(policy.verify.budget);
  const requiredMinutes = Math.ceil(requiredSecs / 60);
  let verifyJobCount = 0;
  const authorityWorkflows: string[] = [];

  for (const workflowRel of workflowRels) {
    const workflowPath = resolve(cwd, workflowRel);
    let workflowText: string | null;
    try { workflowText = readStateFile(workflowPath); } catch (e) {
      return fail('ci-verifier', `${workflowRel}: cannot inspect workflow (${e instanceof Error ? e.message : String(e)})`);
    }
    if (workflowText === null) {
      return fail('ci-verifier', `${workflowRel}: workflow does not exist`);
    }

    let doc: unknown;
    try {
      doc = yaml.parse(workflowText);
    } catch (e) {
      return fail('ci-verifier', 
        `${workflowRel}: workflow is not valid YAML (${e instanceof Error ? e.message : String(e)})`,
      );
    }

    const jobs = verifyJobs(doc);
    verifyJobCount += jobs.length;
    if (jobs.length > 0) {
      authorityWorkflows.push(workflowRel);
      postureWorkflows = [...authorityWorkflows];
    }

    for (const { name, job } of jobs) {
      const timeout = job['timeout-minutes'];
      if (timeout === undefined || timeout === null) {
        return fail('ci-verifier', 
          `${workflowRel} job "${name}": timeout-minutes is missing; requires at least ${requiredMinutes} minutes`,
        );
      }
      if (typeof timeout === 'string' && timeout.includes('${{')) {
        return fail('ci-verifier', 
          `${workflowRel} job "${name}": timeout-minutes must be a static numeric value; requires at least ${requiredMinutes} minutes`,
        );
      }
      if (typeof timeout !== 'number' || !Number.isFinite(timeout)) {
        return fail('ci-verifier', 
          `${workflowRel} job "${name}": timeout-minutes must be numeric; got ${JSON.stringify(timeout)}`,
        );
      }
      if (timeout <= 0) {
        return fail('ci-verifier', 
          `${workflowRel} job "${name}": timeout-minutes must be positive; got ${timeout}`,
        );
      }
      if (!Number.isInteger(timeout)) {
        return fail('ci-verifier', 
          `${workflowRel} job "${name}": timeout-minutes must be a whole number; got ${timeout}`,
        );
      }
      if (timeout < requiredMinutes) {
        return fail('ci-verifier', 
          `${workflowRel} job "${name}": timeout-minutes ${timeout} is too small; trusted verify.budget ${policy.verify.budget}s requires at least ${requiredMinutes} minutes for visible + pristine + authority overhead`,
        );
      }
    }
  }

  if (verifyJobCount === 0) {
    const scope = opts.workflow ?? '.github/workflows/*.yml|*.yaml';
    return fail('ci-verifier', `${scope}: no job contains a tamperward verify step`);
  }

  let github: { repo: string; branch: string; findings: string[] } | null = null;
  if (opts.github) {
    try {
      github = githubAuthority(opts, cwd);
    } catch (e) {
      return fail('github-authority', e instanceof Error ? e.message : String(e));
    }
    if (github.findings.length > 0) {
      return fail(
        'github-authority',
        'GitHub repository authority for ' + github.repo + '#' + github.branch +
          ' is incomplete: ' + github.findings.join('; '),
      );
    }
  }

  const checks = collectLocalPosture(
    cwd,
    policy,
    authorityWorkflows,
    Boolean(opts.workflow),
  );
  checks.push({
    id: 'ci-verifier',
    state: 'OK',
    detail: `${verifyJobCount} verify job(s); trusted budget ${policy.verify.budget}s/stage requires >=${requiredMinutes}m outer timeout`,
  });
  if (github) {
    checks.push({
      id: 'github-authority',
      state: 'OK',
      detail:
        github.repo + '#' + github.branch +
        ' requires tamperward status, Code Owner review, and stale-review dismissal on new pushes',
    });
  }
  checks.push(observerCheck(cwd));

  const summary = [
    `tamperward doctor: CI verifier envelope OK — ${verifyJobCount} verify job(s), trusted budget ${policy.verify.budget}s/stage, requires >=${requiredMinutes}m outer timeout.`,
  ];
  if (github) {
    summary.push(
      'tamperward doctor: GitHub repository authority OK — ' + github.repo + '#' +
        github.branch +
        ' requires tamperward, Code Owner review, and stale-review dismissal on new pushes.',
    );
  }
  return {
    code: 0,
    authoritative: !checks.some((x) => x.state === 'BROKEN'),
    checks,
    verifierBackend: policy.verify?.backend ?? 'local',
    summary,
    ...(github ? { github: { repo: github.repo, branch: github.branch } } : {}),
  };
}

export function runDoctor(opts: DoctorOpts = {}): number {
  const outcome = diagnose(opts);
  if (outcome.failure) {
    if (opts.json) {
      emitReport(opts, outcome.checks, false, outcome.verifierBackend);
    } else {
      process.stderr.write(`tamperward doctor: ${outcome.failure.message}\n`);
    }
    return outcome.code;
  }
  if (!opts.json) {
    for (const line of outcome.summary) process.stdout.write(line + '\n');
  }
  emitReport(opts, outcome.checks, outcome.authoritative, outcome.verifierBackend);
  return outcome.code;
}
