// `tamperward runtime verify` / `tamperward runtime status` (#599).
//
// An HONEST, version-bound, operation-specific runtime capability report. It reports what is
// PROVEN / UNPROVEN / UNSUPPORTED / FAIL-OPEN on THIS runtime/version/config today. `PROVEN` is
// gated on RETAINED real-runtime probe evidence (src/adapters/evidence.ts) matching the full
// binding; the shipped adapter's declared capabilities (src/adapters/contract.ts, #482) can only
// grade PARTIAL/UNPROVEN on their own — never a fabricated PROVEN, never a promotion, never a
// Round 4.1 verdict.
//
//  - `verify` computes the qualification, binds it to the interpretability inputs (runtime
//    version, TamperWard version/commit, adapter capability hash, hook config hash, execution
//    mode, platform, model, tested capability set, timestamp, evidence id), and PERSISTS it to
//    the git-local store so `status` can render it later without rerunning.
//  - `status` renders the latest stored qualification WITHOUT rerunning it, and marks it STALE
//    when any load-bearing input has changed since it was recorded.
//
// This surface consults EXISTING retained evidence. It does not run a live credentialed probe
// here (those are gated, #611/#616, and live in `npm run probe:*` / `spike:*`); it grades against
// the committed, sanitized probe captures those runs retained. A mock or adapter declaration can
// never move a live capability to PROVEN — only a retained real-runtime observation matching the
// binding can, and where none exists the capability is honestly PARTIAL/UNPROVEN.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readStateFile, stateDirectory, StateFileError } from '../disk';
import { atomicReplaceFile } from '../safe-write';
import { join, dirname } from 'node:path';
import { gitDir } from '../git/build';
import { TW_VERSION, TW_COMMIT } from '../wiring';
import { machineOutput, type MachineSchemaVersion } from '../machine-output';
import { colourEnabled } from './render/text';
import { paint, severityColour, BOLD, DIM, type Severity } from './render/status';
import { adapterFor, labelFor } from '../adapters/registry';
import { detectRuntimes } from '../runtimes';
import { RuntimeAdapter } from '../adapters/contract';
import { matchRetainedEvidence, type EvidenceMatchKey } from '../adapters/evidence';
import { interventionWiring } from '../verification-state';
import {
  assessCapabilities,
  aggregateInLoop,
  capabilityHash,
  evidenceId,
  sha16 as sha16Local,
  qualificationStaleness,
  CAPABILITY_STATES,
  EVIDENCE_SOURCES,
  FINAL_AUTHORITY,
  RUNTIME_CAPABILITY_IDS,
  type BindingInputs,
  type CapabilityAssessment,
  type CapabilityState,
  type ExecutionMode,
  type InLoopAggregate,
  type QualificationBinding,
} from '../runtime-qualification';

export interface RuntimeOpts {
  cwd?: string;
  runtime?: string;
  mode?: ExecutionMode;
  model?: string;
  json?: boolean;
}

/** The machine-readable qualification document (`schemas/runtime-qualification-v1.schema.json`). */
export interface RuntimeQualificationReport {
  schema_version: MachineSchemaVersion;
  command: 'runtime';
  subcommand: 'verify' | 'status';
  /** status only: whether a stored qualification was found. Always true for verify. */
  recorded: boolean;
  /** Whether a load-bearing input changed since the qualification was recorded. */
  stale: boolean;
  /** "field: old → new" for every changed load-bearing input (empty unless stale). */
  changed_inputs: string[];
  runtime: { id: string; label: string; version: string | null };
  tamperward: { version: string; commit: string | null };
  adapter: { name: string; capability_hash: string };
  hook_config_hash: string | null;
  execution_mode: ExecutionMode;
  platform: string;
  model: string | null;
  tested_capabilities: string[];
  timestamp: string;
  evidence_id: string;
  capabilities: CapabilityAssessment[];
  in_loop_protection: InLoopAggregate;
  final_authority: typeof FINAL_AUTHORITY;
  note: string;
}

const HONESTY_NOTE =
  'PROVEN is reserved for a capability a retained real-runtime probe observed holding under THIS exact runtime/version/config binding; a declaration alone grades PARTIAL (declared at the contract boundary, unproven live) and an absent capability UNPROVEN/UNSUPPORTED. No live in-process probe runs here — grading is against committed, sanitized real-runtime evidence, and absent a matching record nothing is PROVEN. This reports existing facts only — no promotion, no Round 4.1 eligibility claim.';

/** The git-local qualification store (never committed; sits beside the audit ledger). */
function storePath(cwd: string): string | null {
  const dir = gitDir(cwd);
  // The state directory itself is accepted only as a directory of its own (#721).
  return dir ? join(stateDirectory(dir), 'runtime-qualification.json') : null;
}

interface QualificationStore {
  schema_version: MachineSchemaVersion;
  updated_at: string;
  records: Record<string, RuntimeQualificationReport>;
}

/** The store, or null when it is absent or not the shape this module writes. Read as a
 *  regular file or not at all (#720): a link wherever it points, a FIFO, a device or a
 *  directory at the store's path is a `StateFileError` naming it — never followed or
 *  waited on — for the caller to report rather than an absent store. */
function readStore(cwd: string): QualificationStore | null {
  const path = storePath(cwd);
  if (!path) return null;
  const raw = readStateFile(path);
  if (raw === null) return null;
  try {
    // Deserialization boundary: assert the on-disk shape then validate it before use; a store
    // that fails the guard is treated as absent (re-verify), never trusted.
    const parsed = JSON.parse(raw) as QualificationStore;
    if (parsed && typeof parsed === 'object' && parsed.records && typeof parsed.records === 'object') return parsed;
  } catch {
    return null;
  }
  return null;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const CAP_ID_SET = new Set<string>(RUNTIME_CAPABILITY_IDS);

/**
 * Validate a stored qualification record before `status` renders it as recorded/trusted. Mirrors
 * #660's `parseVerificationRecord` fail-safe: `readStore` only asserts `records` is an object, so
 * a hand-edited `.git/tamperward/runtime-qualification.json` (every capability forced `PROVEN`,
 * `in_loop_protection: "FULL"`) would otherwise render as recorded and not stale, and a non-array
 * `capabilities` would throw an internal error (exit 2) in `renderText` instead of failing safe.
 *
 * This checks the on-disk shape against the published schema AND recomputes the deterministic
 * `evidence_id` (over the stored load-bearing binding + states) and the `in_loop_protection`
 * aggregate (over the stored states) — a record whose recorded values disagree with the
 * recomputation is rejected. On any rejection the caller reports `recorded: false` with the
 * reason, never a trusted render. Returns the typed report on success, or a human reason.
 */
function asStringOrNull(v: unknown): string | null | undefined {
  return v === null || typeof v === 'string' ? v : undefined;
}

function validateStoredReport(value: unknown): { report: RuntimeQualificationReport } | { reason: string } {
  if (!isRec(value)) return { reason: 'record is not an object' };
  if (value.schema_version !== 1) return { reason: 'unrecognized schema_version' };
  if (value.command !== 'runtime') return { reason: 'command is not "runtime"' };
  const subcommand = value.subcommand;
  if (subcommand !== 'verify' && subcommand !== 'status') return { reason: 'invalid subcommand' };
  const recorded = value.recorded;
  const stale = value.stale;
  if (typeof recorded !== 'boolean' || typeof stale !== 'boolean') return { reason: 'invalid recorded/stale flags' };
  const changedInputs = value.changed_inputs;
  if (!Array.isArray(changedInputs) || !changedInputs.every((s): s is string => typeof s === 'string')) return { reason: 'invalid changed_inputs' };

  const runtime = value.runtime;
  if (!isRec(runtime)) return { reason: 'invalid runtime binding' };
  const rId = runtime.id;
  const rLabel = runtime.label;
  const rVersion = asStringOrNull(runtime.version);
  if (typeof rId !== 'string' || !rId || typeof rLabel !== 'string' || !rLabel || rVersion === undefined)
    return { reason: 'invalid runtime binding' };

  const tw = value.tamperward;
  if (!isRec(tw)) return { reason: 'invalid tamperward binding' };
  const twVersion = tw.version;
  const twCommit = asStringOrNull(tw.commit);
  if (typeof twVersion !== 'string' || !twVersion || twCommit === undefined) return { reason: 'invalid tamperward binding' };

  const adapter = value.adapter;
  if (!isRec(adapter)) return { reason: 'invalid adapter binding' };
  const adName = adapter.name;
  const adHash = adapter.capability_hash;
  if (typeof adName !== 'string' || !adName || typeof adHash !== 'string' || !adHash) return { reason: 'invalid adapter binding' };

  const hookConfigHash = asStringOrNull(value.hook_config_hash);
  if (hookConfigHash === undefined) return { reason: 'invalid hook_config_hash' };
  const executionMode = value.execution_mode;
  if (executionMode !== 'headless' && executionMode !== 'interactive') return { reason: 'invalid execution_mode' };
  const platform = value.platform;
  if (typeof platform !== 'string' || !platform) return { reason: 'invalid platform' };
  const model = asStringOrNull(value.model);
  if (model === undefined) return { reason: 'invalid model' };
  const testedCapabilities = value.tested_capabilities;
  if (!Array.isArray(testedCapabilities) || !testedCapabilities.every((c): c is string => typeof c === 'string' && CAP_ID_SET.has(c)))
    return { reason: 'invalid tested_capabilities' };
  const timestamp = value.timestamp;
  if (typeof timestamp !== 'string' || !timestamp) return { reason: 'invalid timestamp' };
  const storedEvidenceId = value.evidence_id;
  if (typeof storedEvidenceId !== 'string' || !storedEvidenceId) return { reason: 'invalid evidence_id' };

  if (!Array.isArray(value.capabilities)) return { reason: 'capabilities is not an array' };
  const capabilities: CapabilityAssessment[] = [];
  for (const c of value.capabilities) {
    if (!isRec(c)) return { reason: 'invalid capability entry' };
    // `.find` narrows to the literal union with no cast: an unknown value simply yields undefined.
    const id = RUNTIME_CAPABILITY_IDS.find((x) => x === c.id);
    const state = CAPABILITY_STATES.find((x) => x === c.state);
    if (!id || !state) return { reason: 'invalid capability entry' };
    const ev = c.evidence;
    if (!isRec(ev)) return { reason: 'invalid capability evidence' };
    const source = EVIDENCE_SOURCES.find((x) => x === ev.source);
    const detail = ev.detail;
    if (!source || typeof detail !== 'string') return { reason: 'invalid capability evidence' };
    capabilities.push({ id, state, evidence: { source, detail } });
  }
  const capabilityIds = capabilities.map((c) => c.id);
  const capabilitySet = new Set<string>(capabilityIds);
  const testedSet = new Set<string>(testedCapabilities);
  if (
    capabilityIds.length !== capabilitySet.size ||
    testedCapabilities.length !== testedSet.size ||
    capabilitySet.size !== testedSet.size ||
    capabilityIds.some((id) => !testedSet.has(id)) ||
    testedCapabilities.some((id) => !capabilitySet.has(id))
  ) {
    return { reason: 'capabilities do not exactly match tested_capabilities' };
  }

  const inLoop = value.in_loop_protection;
  if (inLoop !== 'FULL' && inLoop !== 'PARTIAL' && inLoop !== 'NONE') return { reason: 'invalid in_loop_protection' };
  if (value.final_authority !== FINAL_AUTHORITY) return { reason: 'invalid final_authority' };
  const note = value.note;
  if (typeof note !== 'string') return { reason: 'invalid note' };
  // An unrecorded persisted record must not carry any trusted capability posture. Reject the
  // contradictory shape so callers fall back to the canonical empty/unrecorded response.
  if (!recorded && (capabilities.length > 0 || inLoop !== 'NONE')) {
    return { reason: 'unrecorded report carries capability data' };
  }

  // Recompute the deterministic evidence_id from the stored binding + states, and the aggregate
  // from the states, and require both to match what was recorded. A tampered record (states edited
  // to PROVEN, or an in_loop_protection that disagrees with its capabilities) no longer reproduces
  // its own evidence_id/aggregate and is rejected — fail safe to unrecorded, never trusted.
  const base: BindingInputs = {
    runtime: { id: rId, label: rLabel, version: rVersion },
    tamperward: { version: twVersion, commit: twCommit },
    adapter: { name: adName, capability_hash: adHash },
    hook_config_hash: hookConfigHash,
    execution_mode: executionMode,
    platform,
    model,
    tested_capabilities: testedCapabilities,
  };
  const recomputedId = evidenceId(base, capabilities);
  if (recomputedId !== storedEvidenceId) return { reason: `evidence_id mismatch (recorded ${storedEvidenceId}, recomputed ${recomputedId})` };
  const recomputedAgg = aggregateInLoop(capabilities);
  if (inLoop !== recomputedAgg) return { reason: `in_loop_protection mismatch (recorded ${inLoop}, recomputed ${recomputedAgg})` };

  const report: RuntimeQualificationReport = {
    schema_version: 1,
    command: 'runtime',
    subcommand,
    recorded,
    stale,
    changed_inputs: changedInputs,
    runtime: base.runtime,
    tamperward: base.tamperward,
    adapter: base.adapter,
    hook_config_hash: hookConfigHash,
    execution_mode: executionMode,
    platform,
    model,
    tested_capabilities: testedCapabilities,
    timestamp,
    evidence_id: storedEvidenceId,
    capabilities,
    in_loop_protection: inLoop,
    final_authority: FINAL_AUTHORITY,
    note,
  };
  return { report };
}

function writeRecord(cwd: string, id: string, report: RuntimeQualificationReport): boolean {
  const path = storePath(cwd);
  if (!path) return false;
  const existing = readStore(cwd);
  const store: QualificationStore = existing ?? { schema_version: report.schema_version, updated_at: '', records: {} };
  store.records[id] = report;
  store.updated_at = report.timestamp;
  try {
    mkdirSync(dirname(path), { recursive: true });
    // A temp file and a rename (#720): never written through a link or held by a FIFO. The
    // read above already refused anything but a regular file at the path, by name.
    atomicReplaceFile(path, JSON.stringify(store, null, 2) + '\n', 0o600);
    return true;
  } catch {
    return false;
  }
}

/** Best-effort exact runtime version. An env override keeps CI/tests deterministic; otherwise a
 *  short, guarded `<bin> --version` is tried, and any failure yields null (an unbound version,
 *  recorded honestly). */
function resolveRuntimeVersion(canonicalId: string): string | null {
  const override = process.env.TAMPERWARD_RUNTIME_VERSION;
  if (override && override.trim()) return override.trim();
  const bins: Record<string, string> = {
    'claude-code': 'claude',
    codex: 'codex',
    'github-copilot-cli': 'copilot',
  };
  const bin = bins[canonicalId];
  if (!bin) return null;
  try {
    const out = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/);
    return m ? m[0] : out.trim() || null;
  } catch {
    return null;
  }
}

/** The current TamperWard build as `version+shortcommit`, matching the shape retained evidence
 *  records (`EvidenceBinding.tamperward_version`, e.g. `2.31.0+3671a5e6`). `commit` is
 *  TamperWard's OWN build commit (`TW_COMMIT`, the published package's `gitHead`), never a
 *  qualified repo's HEAD, and is `null` when unavailable — then the tag is the bare version. A
 *  different TamperWard version OR build commit yields a different tag, so retained evidence taken
 *  under one build never applies to another — the review's requirement that a TamperWard change
 *  breaks the match. */
function tamperwardBuildTag(version: string, commit: string | null): string {
  return commit ? `${version}+${commit.slice(0, 8)}` : version;
}

/** The current runtime's pinned SDK/protocol component versions, for the evidence match. No live
 *  resolver ships yet, so this is honestly the empty (unresolved) set for every shipped runtime;
 *  an unresolved set never matches a probed non-empty one, so it fails closed. We never fabricate
 *  a component version to force a match against retained evidence. */
function resolveComponentVersions(_canonicalId: string): string[] {
  return [];
}

/** Best-effort hash of the runtime's hook configuration, so a config change — including the
 *  switches that turn hooks OFF — invalidates the qualification.
 *
 *  For Claude Code this REUSES #660's `interventionWiring` (src/verification-state.ts): the
 *  EVALUATED wiring — the parsed `hooks` AND `disableAllHooks` canonicalised across every source
 *  the runtime reads hooks from (the project `.claude/settings.json` and its `.local` override,
 *  and the user-level file and its `.local` override, `$CLAUDE_CONFIG_DIR` else `~/.claude`). The
 *  old hash covered only the `hooks` block of the project file, so `disableAllHooks: true`, a
 *  `.local` override or a user-level change all left it unchanged even though the wiring that
 *  would intervene had been disabled; sharing `interventionWiring` keeps this staleness surface
 *  consistent with `status`/verification-state.
 *
 *  For the Copilot CLI the adapter wires its hooks in `.github/hooks/tamperward.json` (see
 *  docs/guide/runtime-adapters.md and `harness/adapters/copilot-probe.mjs`); the previous
 *  `.github/copilot/hooks.json` path never existed, so the hash was always null and an edited
 *  Copilot hook config never marked the qualification STALE. Codex reads project hooks from
 *  `.codex/config.toml`. */
function resolveHookConfigHash(canonicalId: string, cwd: string): string | null {
  if (canonicalId === 'claude-code') {
    return sha16Local(JSON.stringify(interventionWiring(cwd)));
  }
  const files: Record<string, string> = {
    'github-copilot-cli': join(cwd, '.github', 'hooks', 'tamperward.json'),
    codex: join(cwd, '.codex', 'config.toml'),
  };
  const file = files[canonicalId];
  if (!file || !existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf8');
    let hooks: unknown = raw;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      hooks = parsed && typeof parsed === 'object' && 'hooks' in parsed ? parsed.hooks : parsed;
    } catch {
      /* hash the raw bytes of a malformed file — still a change signal */
    }
    return sha16Local(JSON.stringify(hooks ?? null));
  } catch {
    return null;
  }
}

/** Assemble the binding + assessments for a runtime under the current inputs. */
function buildQualification(
  adapter: RuntimeAdapter,
  opts: RuntimeOpts,
  cwd: string,
): { binding: QualificationBinding; assessments: CapabilityAssessment[] } {
  const canonical = adapter.name;
  const capHash = capabilityHash(adapter.capabilities);
  const mode: ExecutionMode = opts.mode ?? 'headless';
  const version = resolveRuntimeVersion(canonical);
  const platform = `${process.platform}-${process.arch}`;
  const model = opts.model ?? null;
  const hookConfigHash = resolveHookConfigHash(canonical, cwd);
  // TamperWard's OWN build commit (the published package's `gitHead`), NOT the qualified repo's
  // HEAD. The evidence match keys on TamperWard's `version+commit` build tag, and staleness binds
  // the same identity; sourcing it from the target repo's HEAD (the previous behaviour) mis-keyed
  // the match in a consumer repo and flipped `status` STALE on every unrelated consumer commit.
  // It is `null` when not authentically available (a dev/source tree); we never substitute the
  // consumer HEAD (#599 review 5800329016).
  const commit = TW_COMMIT;
  // The current qualification always assesses the full capability list, so THAT is the tested
  // set this run reports; a probe that tested a different surface does not apply to it.
  const testedRaw = [...RUNTIME_CAPABILITY_IDS];
  // Grade against RETAINED real-runtime probe evidence, and ONLY when it matches this exact
  // binding on EVERY evidence-defining field: runtime id/version, the pinned SDK/protocol
  // component versions, the current TamperWard build (version+commit), the adapter capability
  // hash, the tested capability set, model, platform, mode and hook-config hash. No match → no
  // evidence → nothing is promoted to PROVEN; the static declaration grades PARTIAL/UNPROVEN.
  // This is what gates PROVEN on real evidence for THIS exact binding rather than a
  // contract/adapter declaration, and stops stale evidence promoting after any load-bearing
  // change (TamperWard/adapter/SDK/protocol bump, etc.) (#599).
  const matchKey: EvidenceMatchKey = {
    runtime_id: canonical,
    runtime_version: version,
    // No live resolver for a runtime's SDK/protocol component versions ships yet, so the
    // current side is honestly the empty (unresolved) set. An unresolved component set never
    // matches a probed non-empty one — it fails closed, never promotes. We do not fabricate one.
    component_versions: resolveComponentVersions(canonical),
    tamperward_version: tamperwardBuildTag(TW_VERSION, commit),
    adapter_capability_hash: capHash,
    tested_capabilities: testedRaw,
    model,
    platform,
    execution_mode: mode,
    hook_config_hash: hookConfigHash,
  };
  const evidence = matchRetainedEvidence(matchKey);
  const assessments = assessCapabilities(adapter.capabilities, evidence);
  const base: Omit<QualificationBinding, 'timestamp' | 'evidence_id'> = {
    runtime: { id: canonical, label: labelFor(canonical), version },
    tamperward: { version: TW_VERSION, commit },
    adapter: { name: canonical, capability_hash: capHash },
    hook_config_hash: hookConfigHash,
    execution_mode: mode,
    platform,
    model,
    tested_capabilities: testedRaw,
  };
  const eid = evidenceId(base, assessments);
  const binding: QualificationBinding = { ...base, timestamp: new Date().toISOString(), evidence_id: eid };
  return { binding, assessments };
}

function reportFrom(
  subcommand: 'verify' | 'status',
  binding: QualificationBinding,
  assessments: CapabilityAssessment[],
): RuntimeQualificationReport {
  return machineOutput({
    command: 'runtime' as const,
    subcommand,
    recorded: true,
    stale: false,
    changed_inputs: [],
    runtime: binding.runtime,
    tamperward: binding.tamperward,
    adapter: binding.adapter,
    hook_config_hash: binding.hook_config_hash,
    execution_mode: binding.execution_mode,
    platform: binding.platform,
    model: binding.model,
    tested_capabilities: binding.tested_capabilities,
    timestamp: binding.timestamp,
    evidence_id: binding.evidence_id,
    capabilities: assessments,
    in_loop_protection: aggregateInLoop(assessments),
    final_authority: FINAL_AUTHORITY,
    note: HONESTY_NOTE,
  });
}

/** Resolve the target adapter from --runtime or auto-detection. When nothing is detected and no
 *  `--runtime` was given, REFUSE rather than falling back to Claude Code: the old fallback
 *  persisted a Claude Code qualification (with `runtime.version: null`, `hook_config_hash: null`)
 *  in a repository that has no runtime at all, leaving the store holding qualifications for absent
 *  runtimes. An explicit `--runtime` still qualifies the named runtime (the caller asserts it). */
function resolveTarget(opts: RuntimeOpts, cwd: string): RuntimeAdapter | { error: string } {
  if (opts.runtime) {
    const a = adapterFor(opts.runtime);
    return a ?? { error: `no shipped runtime adapter for "${opts.runtime}"` };
  }
  const detected = detectRuntimes(cwd);
  for (const rt of detected) {
    const a = adapterFor(rt.id);
    if (a) return a;
  }
  // Distinguish "nothing detected" from "a runtime is present but ships no adapter" (e.g. `cursor`
  // is detected but `adapterFor` has nothing for it): the old message claimed nothing was detected
  // even in the latter case (#599 review 5800329016 item 3).
  const reason = detected.length > 0 ? 'no adapter-backed runtime detected in this repository' : 'no runtime detected in this repository';
  return { error: `${reason}; pass --runtime <id> to qualify a specific runtime` };
}

const STATE_SEVERITY: Record<CapabilityState, Severity> = {
  PROVEN: 'ok',
  PARTIAL: 'warn',
  UNPROVEN: 'warn',
  UNSUPPORTED: 'info',
  'FAIL-OPEN': 'bad',
  INCONCLUSIVE: 'bad',
};

const AGGREGATE_SEVERITY: Record<InLoopAggregate, Severity> = { FULL: 'ok', PARTIAL: 'warn', NONE: 'bad' };

function renderText(report: RuntimeQualificationReport, cwd: string): void {
  const colour = colourEnabled(process.env, process.stdout);
  const w = (s: string) => process.stdout.write(s + '\n');
  const dim = (s: string) => paint(s, DIM, colour);

  w(`${paint(report.runtime.label, BOLD, colour)} — runtime protection qualification`);
  w(dim(`  runtime ${report.runtime.version ?? '(version unresolved)'} · tamperward ${report.tamperward.version} · adapter ${report.adapter.capability_hash} · ${report.execution_mode} · ${report.platform}`));
  w(dim(`  evidence ${report.evidence_id} · ${report.timestamp}`));

  if (!report.recorded) {
    w('');
    w(`${paint('[UNQUALIFIED]', severityColour('bad') + BOLD, colour)} no qualification recorded for this runtime.`);
    // Print the reason (`note`) so a REJECTED store — a tampered record, or a pre-fix record whose
    // evidence_id no longer reproduces — explains itself on the text surface, not only in `--json`.
    // Without this the text render read "no qualification recorded" and the rejection reason (why a
    // present-but-untrusted store was discarded) was invisible where people look (#599 review
    // 5800329016 item 2).
    if (report.note) w(dim(`  ${report.note.replace(/—/g, '-')}`));
    w(`Run: ${paint('tamperward runtime verify', BOLD, colour)}`);
    return;
  }
  if (report.stale) {
    w('');
    w(`${paint('[STALE]', severityColour('bad') + BOLD, colour)} a load-bearing input changed — this qualification no longer applies:`);
    for (const c of report.changed_inputs) w(`  · ${c}`);
    w(`Run: ${paint('tamperward runtime verify', BOLD, colour)}`);
  }

  w('');
  const width = Math.max(...report.capabilities.map((c) => c.id.length));
  for (const cap of report.capabilities) {
    const sev = STATE_SEVERITY[cap.state];
    const tag = paint(cap.state.padEnd(12), (sev === 'bad' ? BOLD : '') + severityColour(sev), colour);
    w(`  ${cap.id.padEnd(width)}  ${tag}`);
  }

  w('');
  const agg = report.in_loop_protection;
  const aggTag = paint(agg, (AGGREGATE_SEVERITY[agg] === 'bad' ? BOLD : '') + severityColour(AGGREGATE_SEVERITY[agg]), colour);
  w(`  ${'In-loop protection'.padEnd(width)}  ${aggTag}`);
  w(`  ${'Final authority'.padEnd(width)}  ${paint(report.final_authority, severityColour('ok'), colour)}`);
  w('');
  w(dim('  Final authority (CI / pristine verification) is independent of the runtime hook: a weak in-loop'));
  w(dim('  capability never weakens adjudication. Steering and authority remain separate.'));
  w('');
  w(dim('  ' + report.note.replace(/—/g, '-')));

  // The full evidence per capability, so a negative/fail-open result is never hidden.
  w('');
  w(dim('  Evidence:'));
  for (const cap of report.capabilities) {
    w(dim(`    ${cap.id} [${cap.state}] (${cap.evidence.source}): ${cap.evidence.detail}`));
  }
}

function emit(report: RuntimeQualificationReport, opts: RuntimeOpts, cwd: string): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(report) + '\n');
    return;
  }
  renderText(report, cwd);
}

/**
 * What a surface that must NOT rerun a qualification (`runtime status`, `onboard`) sees in the
 * git-local store for one adapter: nothing recorded; a present record that FAILED validation
 * (rejected — never rendered as trusted, exactly as `status` treats it); or the validated record
 * with its staleness recomputed against the CURRENT load-bearing binding. One reader for both
 * surfaces, so onboarding renders the capability model through the same validation and
 * staleness path as `status` and cannot drift into a second verdict path (#599). Nothing here
 * promotes a capability or writes the store.
 */
export type StoredQualification =
  | { state: 'none' }
  | { state: 'rejected'; reason: string }
  | { state: 'recorded'; report: RuntimeQualificationReport; stale: boolean; changed_inputs: string[] };

export function storedQualification(adapter: RuntimeAdapter, cwd: string, opts: RuntimeOpts = {}): StoredQualification {
  let raw: unknown;
  try {
    raw = readStore(cwd)?.records[adapter.name];
  } catch (e) {
    // Something other than a regular file stands at the store's path (#720): not a
    // qualification, reported as rejected by name and never rendered.
    if (e instanceof StateFileError) return { state: 'rejected', reason: e.message };
    throw e;
  }
  if (raw === undefined) return { state: 'none' };
  const validated = validateStoredReport(raw);
  if ('reason' in validated) return { state: 'rejected', reason: validated.reason };
  const stored = validated.report;
  const currentQualification = buildQualification(adapter, opts, cwd);
  const current = currentQualification.binding;
  const storedBinding: QualificationBinding = {
    runtime: stored.runtime,
    tamperward: stored.tamperward,
    adapter: stored.adapter,
    hook_config_hash: stored.hook_config_hash,
    execution_mode: stored.execution_mode,
    platform: stored.platform,
    model: stored.model,
    tested_capabilities: stored.tested_capabilities,
    timestamp: stored.timestamp,
    evidence_id: stored.evidence_id,
  };
  const staleness = qualificationStaleness(storedBinding, current);
  if (
    !staleness.stale &&
    (
      stored.evidence_id !== current.evidence_id ||
      JSON.stringify(stored.capabilities) !== JSON.stringify(currentQualification.assessments)
    )
  ) {
    return {
      state: 'rejected',
      reason: 'stored qualification posture does not match retained evidence for the current binding',
    };
  }
  return { state: 'recorded', report: stored, stale: staleness.stale, changed_inputs: staleness.changed };
}

export function runRuntime(sub: string | undefined, opts: RuntimeOpts): number {
  const cwd = opts.cwd ?? process.cwd();

  if (sub === 'verify') {
    const target = resolveTarget(opts, cwd);
    if ('error' in target) {
      process.stderr.write(`tamperward: ${target.error}\n`);
      return 2;
    }
    const { binding, assessments } = buildQualification(target, opts, cwd);
    const report = reportFrom('verify', binding, assessments);
    // Persist BEFORE emitting, and gate the `recorded: true` success document on the write
    // succeeding. Emitting first would print a schema-valid stdout doc claiming `recorded: true`
    // even when nothing reached the store — a machine consumer parsing stdout would then retain
    // the OPPOSITE state from disk (stderr and a non-zero exit notwithstanding).
    let wrote = false;
    let refused: string | undefined;
    try {
      wrote = writeRecord(cwd, target.name, report);
    } catch (e) {
      // Something other than a regular file stands at the store's path, or something
      // other than a directory at the state directory's (#720/#721): nothing is written
      // through it, and the failure document below names it.
      if (!(e instanceof StateFileError)) throw e;
      refused = e.message;
    }
    if (!wrote) {
      // Persisting the record is what `verify` is FOR (so `status` can render it later). A
      // read-only `.git`, a failed `mkdir`, or running outside a repository leaves nothing on
      // disk. Report it on stderr, emit an explicit `recorded: false` failure document (shaped
      // like `status`'s unrecorded document, never a success-shaped one), and exit non-zero.
      const dir = gitDir(cwd);
      const dest = dir ? join(dir, 'tamperward', 'runtime-qualification.json') : null;
      const reason =
        `could not persist the qualification to ${dest ?? 'the git-local store (no repository found)'}` +
        `${refused ? ` (${refused})` : ''}; ` +
        'nothing was recorded, so `tamperward runtime status` will report UNQUALIFIED';
      const failure: RuntimeQualificationReport = {
        ...report,
        recorded: false,
        capabilities: [],
        in_loop_protection: 'NONE',
        note: reason,
      };
      emit(failure, opts, cwd);
      process.stderr.write(`tamperward: ${reason}\n`);
      return 1;
    }
    emit(report, opts, cwd);
    return 0;
  }

  if (sub === 'status') {
    const target = resolveTarget(opts, cwd);
    if ('error' in target) {
      process.stderr.write(`tamperward: ${target.error}\n`);
      return 2;
    }
    const stored = storedQualification(target, cwd, opts);
    if (stored.state !== 'recorded') {
      // No stored qualification, OR a stored record that failed shape/evidence_id validation:
      // report honestly as unrecorded, do not synthesize one and never render an unvalidated
      // (possibly hand-edited) record as trusted.
      const { binding, assessments } = buildQualification(target, opts, cwd);
      const note =
        stored.state === 'none'
          ? `No qualification recorded for ${binding.runtime.label}. Run: tamperward runtime verify`
          : `Stored qualification for ${binding.runtime.label} was rejected (${stored.reason}) and treated as unrecorded. Run: tamperward runtime verify`;
      const empty: RuntimeQualificationReport = {
        ...reportFrom('status', binding, assessments),
        recorded: false,
        capabilities: [],
        in_loop_protection: 'NONE',
        note,
      };
      emit(empty, opts, cwd);
      return 0;
    }
    // Render the STORED qualification (no rerun), with staleness recomputed against current inputs.
    const report: RuntimeQualificationReport = {
      ...stored.report,
      subcommand: 'status',
      stale: stored.stale,
      changed_inputs: stored.changed_inputs,
    };
    emit(report, opts, cwd);
    return 0;
  }

  process.stderr.write(`tamperward: runtime requires one of verify | status (got "${sub ?? ''}")\n`);
  return 2;
}

/** Parse `runtime` subcommand + options. */
export function parseRuntime(args: string[]): { sub: string | undefined; opts: RuntimeOpts } {
  const [sub, ...rest] = args;
  const opts: RuntimeOpts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--cwd') opts.cwd = rest[++i];
    else if (a === '--runtime') opts.runtime = rest[++i];
    else if (a === '--model') opts.model = rest[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--mode') {
      const v = rest[++i];
      if (v === 'headless' || v === 'interactive') opts.mode = v;
    }
  }
  return { sub, opts };
}

export const RUNTIME_SUBCOMMANDS = ['verify', 'status'] as const;
export { RUNTIME_CAPABILITY_IDS };
