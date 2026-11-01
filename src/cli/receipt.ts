// `tamperward receipt` — export a local verification receipt, and reconcile a
// claimed receipt against CI's own independent adjudication (#601).
//
//   receipt export     Emit the bounded, transportable receipt for the CURRENT
//                      verified state to a caller-chosen path (or stdout). This
//                      is the explicit handoff: raw evidence otherwise stays under
//                      `.git/tamperward/`, never in the candidate-controlled tree.
//
//   receipt reconcile  CI reruns the canonical TamperWard verification FIRST,
//                      then reconciles a claimed receipt against that result. The
//                      final `result` is CI's verdict — a stale/mismatched/
//                      tampered/missing/unknown-schema receipt can never promote
//                      or strengthen it. Prints a summary that separates the
//                      LOCAL claim, the CI result and their agreement/divergence,
//                      and a machine-readable reconciliation document (--json).
//
// The receipt is evidence, not authority (#495). Reconciliation NEVER derives the
// verdict from the receipt; CI recomputes it from trusted inputs.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { machineOutput, type MachineSchemaVersion, VERIFY_CANNOT_VERIFY_REASONS, VERIFY_VERDICTS, type VerifyCannotVerifyReason, type VerifyVerdict } from '../machine-output';
import { repoContext, outsideRepository } from '../repo-context';
import {
  computeBinding,
  evaluateVerificationState,
  readVerificationRecord,
  resolveConcreteCommit,
  type VerificationBinding,
  type VerificationInputs,
} from '../verification-state';
import {
  classifyReceipt,
  isOneOf,
  reconcile,
  receiptFromRecord,
  type CiAdjudication,
  type ClaimedReceipt,
  type Reconciliation,
  type VerificationReceipt,
} from '../verification-receipt';
import { runVerify, type VerifyVerdictSummary } from './verify';
import { oobToken, oobFromEnv, oobHeadFromEnv, oobHeadProblem } from '../signoff';
import { colourEnabled } from './render/text';
import { verifyWorkflowCommand, type VerifyAnnotationDetails } from './render/verify-github';
import { paint, severityColour, BOLD, type Severity } from './render/status';

export const RECEIPT_SUBCOMMANDS = ['export', 'reconcile'] as const;
export type ReceiptSubcommand = (typeof RECEIPT_SUBCOMMANDS)[number];

export interface ReceiptExportOpts {
  cwd?: string;
  out?: string;
}

export interface ReceiptReconcileOpts {
  cwd?: string;
  base?: string;
  cmd?: string;
  budget?: number;
  requireAncestor?: boolean;
  /** Path to the claimed local receipt. Absent means: reconcile with no claim
   *  (NO_CLAIM), which never fails the build on its own. */
  receipt?: string;
  /** A `tamperward verify --json` document from a preceding CI step. When given,
   *  reconcile consumes THAT verdict instead of rerunning verify itself, so a CI
   *  pipeline that already ran verify pays for the suite once. Binding identity is
   *  still recomputed independently here — the receipt never supplies it. */
  ciResult?: string;
  json?: boolean;
  /** @internal test seam: run verify through this instead of the real engine. */
  runVerifyImpl?: typeof runVerify;
}

/** Parse `receipt <sub> ...` argv into the sub and its opts. Validation of flag
 *  shapes is done in `validateCliArgs`; this only maps the already-valid argv. */
export function parseReceipt(args: string[]): {
  sub: ReceiptSubcommand | undefined;
  exportOpts: ReceiptExportOpts;
  reconcileOpts: ReceiptReconcileOpts;
} {
  const [sub, ...rest] = args;
  const exportOpts: ReceiptExportOpts = {};
  const reconcileOpts: ReceiptReconcileOpts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = (): string | undefined => rest[++i];
    switch (a) {
      case '--json':
        // `--json` is a reconcile-only flag. `receipt export`'s machine output IS
        // the receipt file it writes (a published `receipt-v1` document); it has
        // no separate JSON envelope (#601 finding 5c).
        reconcileOpts.json = true;
        break;
      case '--require-ancestor':
        reconcileOpts.requireAncestor = true;
        break;
      case '--out':
        exportOpts.out = next();
        break;
      case '--cwd': {
        const v = next();
        exportOpts.cwd = v;
        reconcileOpts.cwd = v;
        break;
      }
      case '--base':
        reconcileOpts.base = next();
        break;
      case '--cmd':
        reconcileOpts.cmd = next();
        break;
      case '--budget': {
        const v = next();
        if (v !== undefined) reconcileOpts.budget = Number(v);
        break;
      }
      case '--receipt':
        reconcileOpts.receipt = next();
        break;
      case '--ci-result':
        reconcileOpts.ciResult = next();
        break;
    }
  }
  return {
    sub: isOneOf(RECEIPT_SUBCOMMANDS, sub) ? sub : undefined,
    exportOpts,
    reconcileOpts,
  };
}

/** Dispatch a parsed `receipt` command. */
export function runReceipt(args: string[]): number {
  const { sub, exportOpts, reconcileOpts } = parseReceipt(args);
  if (sub === 'export') return runReceiptExport(exportOpts);
  if (sub === 'reconcile') return runReceiptReconcile(reconcileOpts);
  process.stderr.write(`tamperward: receipt requires a subcommand (${RECEIPT_SUBCOMMANDS.join(' | ')})\n`);
  return 2;
}

/** Inputs describing how verify resolved its state, mirroring `tamperward verify`
 *  so `computeBinding` recomputes the SAME #600 identity. */
function reconcileInputs(opts: ReceiptReconcileOpts): VerificationInputs {
  return {
    base_ref: opts.base ?? 'HEAD',
    explicit_base: opts.base !== undefined,
    command_source: opts.cmd !== undefined ? 'flag' : 'policy',
    command: opts.cmd ?? '',
    budget_source: opts.budget !== undefined ? 'flag' : 'policy',
    budget: opts.budget ?? 300,
  };
}

/** CI's verdict → the exit code `verify` itself would return, so reconcile's exit
 *  code is CI's verdict and nothing else. */
function verdictExit(verdict: VerifyVerdict, signedOff: boolean): number {
  switch (verdict) {
    case 'VERIFIED':
      return 0;
    case 'MASKED_FAILURE':
      return signedOff ? 0 : 1;
    case 'SUITE_RED':
      return 1;
    default:
      return 2; // BUDGET_EXCEEDED, CANNOT_VERIFY
  }
}

function needRepo(cwd: string, what: string): number | null {
  if (repoContext(cwd)) return null;
  const why = outsideRepository(cwd) ?? 'cwd is not inside a repository the gate can read';
  process.stderr.write(`tamperward: receipt ${what} needs a git repository (${why})\n`);
  return 2;
}

// ---------------------------------------------------------------------------
// receipt export
// ---------------------------------------------------------------------------

export function runReceiptExport(opts: ReceiptExportOpts = {}): number {
  const cwd = opts.cwd ?? process.cwd();
  const guard = needRepo(cwd, 'export');
  if (guard !== null) return guard;

  // Only export a receipt for a state that is still verified-CURRENT: the receipt
  // vouches for the exact live candidate, so a STALE/UNVERIFIED tree has nothing
  // honest to export. Reconciliation would reject a stale receipt anyway; refusing
  // here keeps a false claim from ever being written.
  const evaluation = evaluateVerificationState(cwd);
  const record = readVerificationRecord(cwd);
  if (evaluation.state !== 'CURRENT' || !record) {
    const detail =
      evaluation.state === 'CURRENT'
        ? 'no verification record is available to export'
        : `no CURRENT verification to export (state: ${evaluation.state}) — run \`tamperward verify\` first`;
    process.stderr.write(`tamperward: ${detail}\n`);
    return 2;
  }

  // The exported machine output IS the receipt file: a published `receipt-v1`
  // document written to `--out`, or to stdout when no path is given. There is no
  // separate JSON envelope (#601 finding 5c).
  const receipt = receiptFromRecord(record);
  const serialized = JSON.stringify(receipt) + '\n';
  if (opts.out) {
    try {
      writeFileSync(opts.out, serialized);
    } catch (e) {
      process.stderr.write(`tamperward: could not write receipt to ${opts.out} (${e instanceof Error ? e.message : String(e)})\n`);
      return 2;
    }
    process.stdout.write(`receipt: exported VERIFIED receipt for tree ${receipt.binding.tree.slice(0, 10)} to ${opts.out}\n`);
  } else {
    process.stdout.write(serialized);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// receipt reconcile
// ---------------------------------------------------------------------------

/** CI's own verify adjudication: rerun the suite, or consume a preceding step's
 *  `--json` document. Never reads the receipt. */
function ciAdjudicate(cwd: string, opts: ReceiptReconcileOpts): { ci: CiAdjudication; exit: number; annotation?: VerifyAnnotationDetails } {
  const inputs = reconcileInputs(opts);
  let binding: VerificationBinding | null = null;
  let bindingError: string | undefined;
  try {
    binding = computeBinding(cwd, inputs);
  } catch (e) {
    bindingError = e instanceof Error ? e.message : String(e);
  }

  if (opts.ciResult !== undefined) {
    // Consume a preceding `tamperward verify --json` document. Its verdict is
    // CI's authority; the binding is still the independently-computed one above.
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(opts.ciResult, 'utf8'));
    } catch (e) {
      // A CI verify result we cannot read is fail-closed: treat as CANNOT_VERIFY.
      return {
        ci: { verdict: 'CANNOT_VERIFY', binding, binding_error: `unreadable CI verify result: ${e instanceof Error ? e.message : String(e)}` },
        exit: 2,
        annotation: { detail: 'The CI verify result could not be read. Check the verify step output and artifact path.' },
      };
    }
    // The `--ci-result` document is the ONE place a file's `verdict` becomes CI's
    // authority, so it must be a genuine `tamperward verify --json` document, not
    // any JSON that happens to carry a `verdict` (a receipt-v1 file carries
    // `verdict: "VERIFIED"` too). Require verify-v1's shape and cross-check its
    // `base` against the trusted base CI computed; anything else is CANNOT_VERIFY
    // (#601 finding 4). Fail-closed, never a pass.
    const check = readCiVerify(doc, binding, cwd, opts);
    if (check.reason !== undefined) {
      return {
        ci: { verdict: 'CANNOT_VERIFY', binding, binding_error: check.reason },
        exit: 2,
        annotation: { detail: check.reason },
      };
    }
    // The sign-off that turns a MASKED_FAILURE into exit 0 must come from the
    // TRUSTED out-of-band channel (the CI env the workflow sets from a reviewer's
    // label), recomputed exactly the way `verify` does (`src/cli/verify.ts:1711`)
    // — NEVER from the `--ci-result` document. Deriving it from the file being
    // validated let a forged `oob_signoff` field flip a MASKED_FAILURE to exit 0
    // (#601 re-review). The document's own field is informational at most; it is
    // not consulted here.
    const oob = oobFromEnv();
    const oobHead = oobHeadFromEnv();
    const signedOff = check.verdict === 'MASKED_FAILURE' && oobToken('verify', oob, oobHead) !== null;
    // The line `verify` prints in the same situation: an approval offered under a head
    // the gate cannot identify clears nothing, and the misconfiguration is named once (#709).
    const headProblem = check.verdict === 'MASKED_FAILURE' && oob.length > 0 ? oobHeadProblem(oobHead) : null;
    if (headProblem) process.stderr.write(`tamperward: ${headProblem}\n`);
    // `adjudicated_tree` is the tree CI's verify actually ran over (may be the merge
    // result, not the receipt's tip tree). Passed through verbatim; undefined for an
    // older verify document, which reconcile degrades to NON_APPLICABLE (#601).
    return {
      ci: {
        verdict: check.verdict,
        binding,
        ...(check.adjudicated_tree !== undefined ? { adjudicated_tree: check.adjudicated_tree } : {}),
        ...(bindingError ? { binding_error: bindingError } : {}),
      },
      exit: verdictExit(check.verdict, signedOff),
      annotation: { reason: check.verifierReason, detail: check.detail },
    };
  }

  // Self-contained: rerun the canonical verification ourselves, FIRST.
  const impl = opts.runVerifyImpl ?? runVerify;
  let summary: VerifyVerdictSummary | undefined;
  const exit = impl({
    cwd,
    base: opts.base,
    cmd: opts.cmd,
    budget: opts.budget,
    requireAncestor: opts.requireAncestor,
    silent: true, // reconcile prints its own summary; suppress verify's stdout
    onVerdict: (s) => {
      summary = s;
    },
  });
  const verdict: VerifyVerdict = summary?.verdict ?? 'CANNOT_VERIFY';
  // Self-run: verify executed in THIS checkout, so the tree it adjudicated is the
  // live tree — exactly the tree `computeBinding` fingerprinted for the identity.
  // Bind them equal so the cross-check is a no-op for the same-checkout path.
  return {
    ci: {
      verdict,
      binding,
      ...(binding ? { adjudicated_tree: binding.tree } : {}),
      ...(bindingError ? { binding_error: bindingError } : {}),
    },
    exit,
    annotation: { reason: summary?.reason, detail: summary?.detail },
  };
}

/** A 40- or 64-hex object id, the shape a resolved commit takes. */
function isCommitId(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(v);
}

/**
 * Validate a `--ci-result` document as a genuine `tamperward verify --json`
 * document and extract its verdict, or explain why it cannot be trusted (#601
 * finding 4). This is the one place a file's `verdict` becomes CI's authority, so
 * it is guarded hard:
 *   - it must have the verify-v1 SHAPE: `schema_version: 1`, a resolved `base`
 *     commit id, and `visible` / `pristine` stage objects (a receipt-v1 file has
 *     `verdict: "VERIFIED"` but none of these, so it is rejected);
 *   - its `verdict` must be a known verify verdict;
 *   - its `base` must match the trusted base CI computed — either the merge-base
 *     the reconcile resolved (`ci.binding.base`) or the concrete base ref CI was
 *     told to use (the enforcement verify on a PR merge ref records the concrete
 *     base). A document describing a different base is not CI's own adjudication.
 * Any failure returns a `reason`; the caller maps that to CANNOT_VERIFY / exit 2.
 */
function readCiVerify(
  doc: unknown,
  binding: VerificationBinding | null,
  cwd: string,
  opts: ReceiptReconcileOpts,
): { verdict: VerifyVerdict; reason?: string; verifierReason?: VerifyCannotVerifyReason; detail?: string; adjudicated_tree?: string } {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { verdict: 'CANNOT_VERIFY', reason: 'CI verify result is not a JSON object' };
  }
  const d = doc as Record<string, unknown>;
  if (d.schema_version !== 1) {
    return { verdict: 'CANNOT_VERIFY', reason: `CI verify result is not a verify --json document (schema_version ${JSON.stringify(d.schema_version)})` };
  }
  if (!isCommitId(d.base)) {
    return { verdict: 'CANNOT_VERIFY', reason: 'CI verify result has no resolved base commit — not a verify --json document (a receipt is not a verify result)' };
  }
  if (!isRecordObject(d.visible) || !isRecordObject(d.pristine)) {
    return { verdict: 'CANNOT_VERIFY', reason: 'CI verify result is missing the visible/pristine stage objects — not a verify --json document' };
  }
  if (!isOneOf(VERIFY_VERDICTS, d.verdict)) {
    return { verdict: 'CANNOT_VERIFY', reason: `CI verify result has an unknown verdict ${JSON.stringify(d.verdict)}` };
  }
  // Cross-check the document's base against the trusted base CI computed. Skip
  // only when CI could not compute its own identity at all (already surfaced as a
  // binding error); the shape checks above still stand in that case.
  if (binding) {
    const concrete = resolveConcreteCommit(cwd, opts.base ?? 'HEAD');
    const accepted = new Set([binding.base, ...(concrete ? [concrete] : [])]);
    if (!accepted.has(d.base)) {
      return {
        verdict: 'CANNOT_VERIFY',
        reason: `CI verify result binds base ${d.base.slice(0, 10)} but CI computed ${binding.base.slice(0, 10)} — the document describes a different base`,
      };
    }
  }
  // `adjudicated_tree` is additive (verify-v1 is `additionalProperties: true`) and
  // optional: a genuine current verify document carries the fingerprint of the tree
  // it ran over, but an older one has none. Accept only a non-empty string; anything
  // else (absent, or a malformed value) is left undefined and reconcile degrades to
  // NON_APPLICABLE rather than assume CI ran the receipt's tree (#601 re-review).
  const adjudicated_tree = typeof d.adjudicated_tree === 'string' && d.adjudicated_tree.length > 0 ? d.adjudicated_tree : undefined;
  const verifierReason = isOneOf(VERIFY_CANNOT_VERIFY_REASONS, d.reason) ? d.reason : undefined;
  const detail = typeof d.detail === 'string' ? d.detail : undefined;
  return { verdict: d.verdict, verifierReason, detail, adjudicated_tree };
}

function isRecordObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface ReconcileDocument {
  schema_version: MachineSchemaVersion;
  command: 'reconcile';
  result: VerifyVerdict;
  ci: { verdict: VerifyVerdict };
  local: Reconciliation['local'];
  reconciliation: {
    agreement: Reconciliation['agreement'];
    applicable: boolean;
    mismatched_input?: string;
    divergence: string[];
    environment_divergence: Reconciliation['environment_divergence'];
  };
}

export function reconcileDocument(r: Reconciliation): ReconcileDocument {
  return machineOutput({
    command: 'reconcile' as const,
    result: r.result,
    ci: r.ci,
    local: r.local,
    reconciliation: {
      agreement: r.agreement,
      applicable: r.applicable,
      ...(r.mismatched_input ? { mismatched_input: r.mismatched_input } : {}),
      divergence: r.divergence,
      environment_divergence: r.environment_divergence,
    },
  });
}

const AGREEMENT_SEVERITY: Record<Reconciliation['agreement'], Severity> = {
  AGREE: 'ok',
  DIVERGENCE: 'bad',
  NON_APPLICABLE: 'warn',
  NO_CLAIM: 'info',
};

/** The human three-section report (LOCAL / CI / RESULT), matching #601. Each
 *  section's words carry the meaning so it reads correctly with colour stripped. */
export function renderReconcile(
  r: Reconciliation,
  claimedReceipt: VerificationReceipt | null,
  ciBinding: VerificationBinding | null,
  adjudicatedTree: string | undefined,
  colour: boolean,
): string {
  const tick = (s: string): string => paint(s, severityColour('ok'), colour);
  const cross = (s: string): string => paint(s, BOLD + severityColour('bad'), colour);
  // The mark is DERIVED from the stage value, never assumed green — a PASS/CLEAN
  // stage gets ✓, anything else ✗ (#601 finding 5a). classifyReceipt already
  // rejects a VERIFIED receipt with a non-pass stage as MALFORMED, so a PRESENT
  // receipt is PASS/PASS/CLEAN; deriving the mark keeps the two in lockstep.
  const stageMark = (value: string, pass: string): string => (value === pass ? tick('✓') : cross('✗'));
  const lines: string[] = [];

  lines.push('LOCAL');
  if (claimedReceipt) {
    lines.push(`  ${stageMark(claimedReceipt.stages.candidate, 'PASS')} candidate ${claimedReceipt.binding.tree.slice(0, 10)} locally verified`);
    lines.push(`  ${stageMark(claimedReceipt.stages.pristine, 'PASS')} pristine ${claimedReceipt.stages.pristine}`);
    lines.push(`  ${stageMark(claimedReceipt.stages.integrity, 'CLEAN')} integrity ${claimedReceipt.stages.integrity}`);
  } else if (r.local.disposition === 'ABSENT') {
    lines.push('  (no receipt provided)');
  } else {
    lines.push(`  ${cross('✗')} receipt ${r.local.disposition}${r.local.detail ? ` — ${r.local.detail}` : ''}`);
  }
  lines.push('');

  lines.push('CI');
  if (ciBinding) {
    const mark = r.ci.verdict === 'VERIFIED' ? tick('✓') : cross('✗');
    // Print the tree CI actually ADJUDICATED (the merge result in a `pull_request`
    // run), not the branch-tip identity tree, so the verdict is attributed to the
    // tree it was really about (#601 re-review). Falls back to the identity tree
    // for an older verify document that reported no adjudicated tree.
    const shownTree = adjudicatedTree ?? ciBinding.tree;
    lines.push(`  ${mark} independently ${r.ci.verdict} ${shownTree.slice(0, 10)}`);
  } else {
    lines.push(`  ${cross('✗')} ${r.ci.verdict} (identity not computable)`);
  }
  lines.push('');

  lines.push('RESULT');
  lines.push(`  ${paint(r.result, (r.result === 'VERIFIED' ? '' : BOLD) + severityColour(r.result === 'VERIFIED' ? 'ok' : 'bad'), colour)}`);
  const agreementLine: Record<Reconciliation['agreement'], string> = {
    AGREE: 'Local and CI evidence agree',
    DIVERGENCE: 'EVIDENCE DIVERGENCE — local claim not confirmed by CI',
    NON_APPLICABLE: 'Local receipt does not apply to the CI-adjudicated state — ignored',
    NO_CLAIM: 'No local receipt to reconcile — CI verdict stands',
  };
  lines.push(`  ${paint(agreementLine[r.agreement], severityColour(AGREEMENT_SEVERITY[r.agreement]), colour)}`);
  for (const d of r.divergence) lines.push(`  ${d}`);
  return lines.join('\n') + '\n';
}

/** The claimed receipt from an explicit `--receipt` path, classified. Absence of
 *  the flag is ABSENT (→ NO_CLAIM); an unreadable or non-JSON file is a transport
 *  problem reported as MALFORMED with a read/parse detail (#601 findings 1, 5b).
 *  Every non-PRESENT disposition fails safe and can never strengthen CI. */
function loadClaimedReceipt(path: string | undefined): ClaimedReceipt {
  if (path === undefined) {
    return { disposition: 'ABSENT', detail: 'no local verification receipt was provided (pass one with --receipt)' };
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    return { disposition: 'MALFORMED', detail: `receipt file could not be read (${e instanceof Error ? e.message : String(e)})` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { disposition: 'MALFORMED', detail: `receipt file could not be parsed as JSON (${e instanceof Error ? e.message : String(e)})` };
  }
  return classifyReceipt(parsed);
}

export function runReceiptReconcile(opts: ReceiptReconcileOpts = {}): number {
  const cwd = opts.cwd ?? process.cwd();
  const guard = needRepo(cwd, 'reconcile');
  if (guard !== null) return guard;

  const { ci, exit, annotation: annotationDetails } = ciAdjudicate(cwd, opts);

  // Load the claimed receipt. A local claim must be EXPLICIT (#601 finding 1):
  // the receipt is read ONLY from `--receipt`. There is deliberately NO fall-back
  // to the local `.git/tamperward/` store — in CI that store holds the receipt
  // this job's own preceding `verify` step just wrote, so reconciling against it
  // would manufacture a LOCAL claim bound to exactly the state CI adjudicated and
  // report AGREE on every green run without any transported receipt. With no
  // `--receipt`, the claim is ABSENT → NO_CLAIM. This is also the ONLY place the
  // receipt is read, and it can never change `exit`.
  const claimed = loadClaimedReceipt(opts.receipt);
  const r = reconcile(ci, claimed);
  const claimedReceipt = claimed.disposition === 'PRESENT' ? claimed.receipt : null;

  if (opts.json) {
    process.stdout.write(JSON.stringify(reconcileDocument(r)) + '\n');
  } else {
    process.stdout.write(renderReconcile(r, claimedReceipt, ci.binding, ci.adjudicated_tree, colourEnabled(process.env, process.stdout)));
  }

  // GitHub Actions job summary: the same separated report, in Markdown.
  writeJobSummary(r, claimedReceipt, ci.binding, ci.adjudicated_tree);

  if (!opts.json) {
    const annotation = verifyWorkflowCommand(ci.verdict, exit, annotationDetails);
    if (annotation) process.stdout.write(`${annotation}\n`);
  }

  // The exit code is CI's verdict, computed above BEFORE the receipt was read.
  return exit;
}

/** Append the reconciliation to $GITHUB_STEP_SUMMARY when running under Actions.
 *  Best-effort: a summary write never changes the exit code. */
function writeJobSummary(
  r: Reconciliation,
  receipt: VerificationReceipt | null,
  ciBinding: VerificationBinding | null,
  adjudicatedTree: string | undefined,
): void {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  const md: string[] = ['## TamperWard receipt reconciliation', ''];
  const mark = (value: string, pass: string): string => (value === pass ? '✓' : '✗');
  md.push('### LOCAL');
  if (receipt) {
    md.push(`- ${mark(receipt.stages.candidate, 'PASS')} candidate \`${receipt.binding.tree.slice(0, 10)}\` locally verified`);
    md.push(`- ${mark(receipt.stages.pristine, 'PASS')} pristine ${receipt.stages.pristine}`);
    md.push(`- ${mark(receipt.stages.integrity, 'CLEAN')} integrity ${receipt.stages.integrity}`);
  } else if (r.local.disposition === 'ABSENT') {
    md.push('- _no receipt provided_');
  } else {
    md.push(`- receipt **${r.local.disposition}**${r.local.detail ? ` — ${r.local.detail}` : ''}`);
  }
  md.push('', '### CI');
  const shownTree = adjudicatedTree ?? ciBinding?.tree;
  md.push(`- independently **${r.ci.verdict}**${shownTree ? ` \`${shownTree.slice(0, 10)}\`` : ' (identity not computable)'}`);
  md.push('', '### RESULT');
  md.push(`**${r.result}** — ${r.agreement}`);
  for (const d of r.divergence) md.push(`- ${d}`);
  md.push('');
  try {
    appendFileSync(path, md.join('\n') + '\n');
  } catch {
    /* evidence only */
  }
}
