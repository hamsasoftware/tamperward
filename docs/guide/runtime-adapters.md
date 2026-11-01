# Runtime adapters: the vendor-neutral steering contract

TamperWard's detectors and engine are runtime-neutral. Every enforcement point —
the Claude Code PreToolUse hook, the Stop sweep, pre-commit, and CI — manufactures a
`Change[]`, and the engine judges that list without knowing which agent produced it.
The only Claude-specific code is a thin seam: the hook I/O (`src/cli/hook.ts`) and the
Claude adapter (`src/adapters/claude/*`).

Phase 1 of [#482](https://github.com/hexrift/tamperward/issues/482) names that seam as a
**type** — the `RuntimeAdapter` contract in `src/adapters/contract.ts` — so a second
in-loop runtime can implement it without a rewrite, and so the semantics a runtime does
and does **not** provide are recorded explicitly rather than assumed.

This page documents the contract. Claude Code is its reference implementation and the only
runtime with in-loop steering. Experimental Codex, GitHub Copilot CLI and Copilot
SDK-hosted adapters implement the same contract with an empty `preDeny`; none has passed a
pinned live qualification, and `tamperward runtime verify` reports what each has and has not
proven. Anything a partial adapter cannot do is stated as an explicit gap, never silently
degraded.

## The three phases: decision vs. observation

A runtime can hand TamperWard control at three distinct points. They are kept separate on
purpose, so that a hook which only *observes* an operation is never mistaken for one that
can *veto* it.

| Phase | When | What it carries | Claude Code |
| --- | --- | --- | --- |
| `pre-action` | **before** the operation runs | a **synchronous decision** — a `deny` blocks the operation | `PreToolUse` (holds even under `--dangerously-skip-permissions`) |
| `post-action` | **after** the operation ran | the outcome, **observation only** — never a veto | *(none live; see below)* |
| `end-of-turn` | the turn is ending | lifecycle status **plus a mandatory final sweep** of the turn's net effect | `Stop` |

The end-of-turn sweep is the safety net for anything the pre-action layer could not veto.
If a runtime can only *observe* native file edits (they land before the hook sees them),
the mandatory Stop sweep is what still catches a protected-file deletion made that way —
which is exactly why `post-action` never carries a decision and `end-of-turn` is not
optional.

## Per-operation capabilities

Capabilities are declared **per operation**, not per layer. The operation kinds are:

```
shell | file-edit | file-read | mcp | other
```

`unknown` is deliberately not in this declarable list. It is the Codex, Copilot and Copilot
SDK classification outcome for an unmapped non-empty tool name; the adapter denies it with the
`unknown-tool` finding before reconstruction, so it cannot be treated as a no-op.

A runtime's `RuntimeCapabilities` records, for each phase, which operation kinds it
covers:

- `preDeny` — operation kinds it can **synchronously deny** before execution;
- `postObserve` — operation kinds it reports **after** execution (observation only);
- `endOfTurn` — whether it delivers a stop event that can run the mandatory sweep;
- `unsupported` — semantics it explicitly does **not** provide, as prose tags.

**Claude Code declares `preDeny` for `shell`, `file-edit`, and `file-read`, plus
`endOfTurn`. MCP and catch-all `other` are deliberately absent from `preDeny`: although Claude Code delivers those calls through PreToolUse, TamperWard does not currently reconstruct them into the shared `Change[]` model, so content-aware pre-deny for those operation classes is **unproven** rather than implied.
It has no live per-tool `post-action` veto, so `postObserve` is empty and `unsupported`
names those MCP/catch-all gaps along with the boundaries TamperWard does not police at all
(network-egress control, identity/authentication).

Because `post-action` is observation-only, `decide(..., 'post-action')` for Claude returns
the `unsupported` outcome — **no decision, no deny wire**. The phase→hook mapping refuses to
route `post-action` to any deny-capable hook rather than silently falling through to
PreToolUse: a post-edit observation must never be treated as a pre-execution veto.

## Qualifying a runtime: `runtime verify`

The `RuntimeCapabilities` declaration and the **retained real-runtime evidence** together drive
an **honest, version-bound qualification**. `tamperward runtime verify` grades a runtime's
capabilities against the retained probe captures (`src/adapters/evidence.ts`,
`harness/adapters/**/evidence/`) and its declaration, and reports a **capability matrix** at a
finer granularity than the operation kinds — one explicit state per capability:

| state | derived when |
| --- | --- |
| `PROVEN` | a **retained real-runtime probe** observed the capability holding under the reported binding (`committed-evidence`). A static declaration alone never reaches here. |
| `PARTIAL` | declared at the adapter/contract boundary (a kind in `preDeny`, a declared `postObserve`/`endOfTurn`, or a transport the contract fails closed), but **no retained probe** proves it holds live for this runtime/version/config |
| `UNPROVEN` | absent from the declaration with no evidence either way — **never** read as safe |
| `UNSUPPORTED` | the adapter declares it does not provide the capability |
| `FAIL-OPEN` | an `unsupported` entry — or a retained probe — names/observes a failure mode that lets the operation proceed, surfaced verbatim |
| `INCONCLUSIVE` | a retained probe reached the path but observed no authoritative resolution |

So a runtime whose `preDeny` is empty reports `pre-deny:*` as `UNPROVEN`, and a runtime with a
**full** `preDeny` declaration but no retained probe reports `pre-deny:*` as `PARTIAL` — never a
fabricated `PROVEN`. `PROVEN` appears only when a retained probe matches the **full binding**
(runtime name + exact version, hook-config hash, execution mode, platform, model, tested set); a
mismatch on any field strips it back to `PARTIAL`. A runtime whose `unsupported` says a hook
timeout *fails open* reports `transport:timeout` as `FAIL-OPEN`, which can then never aggregate
to `FULL` in-loop protection. `Final authority` (CI / pristine `verify`) is reported as a
constant `AVAILABLE`: it is independent of the runtime hook, so a weak in-loop capability never
weakens adjudication.

This surface **grades against committed captures**, not a live credentialed probe run here
(those are gated, #611/#616) — it promotes no runtime and makes no qualification claim of its
own; absent a matching capture, nothing is `PROVEN`. The result is bound to the runtime version,
TamperWard version/commit, adapter capability hash, hook-config hash, execution mode, platform,
model and tested capability set; `runtime status` renders the stored qualification and marks it
**STALE** when any of those load-bearing inputs changes. See the
[CLI reference](../reference/cli.md#runtime-qualification-runtime-verify-runtime-status).

## Mapping to the research adapter layers

The research runner (`src/research/adapter.ts`) records, per gated run, a coarse `layers`
list — `envelope` / `pre-tool-use` / `stop-sweep` — so a cross-runtime comparison never
silently compares different treatments. The neutral contract maps onto it directly
(`CONTRACT_TO_RESEARCH_LAYER` in `src/adapters/contract.ts`):

| Neutral contract | Research `layer` |
| --- | --- |
| `pre-action` (synchronous pre-execution deny) | `pre-tool-use` |
| `end-of-turn` (mandatory reconciliation sweep) | `stop-sweep` |
| the post-exit run envelope around the agent process | `envelope` |

The per-**operation** capabilities refine this coarse mapping: a runtime records the
`pre-tool-use` layer only for the operation kinds it can actually pre-deny. Claude's own
current declaration is intentionally partial with respect to MCP and catch-all `other`, so neither is recorded
as equivalent to its declared shell/file-edit surface. (This is a doc/type mapping; it
changes no research-runtime behaviour.)

### Partial adapters are scoped, not equivalent

A runtime that supplies only a **subset** — for example shell pre-deny but not native
file-edit pre-deny — is a **scoped partial adapter**. It records the gap in `unsupported`
and does not inherit capabilities it has not established. A cross-runtime study reads the
capability descriptor precisely so it never presents a narrower interception surface as
equivalent to a broader one. For operation kinds an adapter cannot pre-deny — including
Claude MCP and catch-all unmodelled tools today — the run envelope and CI remain the security boundary, and the mandatory
end-of-turn sweep still catches a mutation the pre-action layer could not veto.

## Explicit failure states, and the fail-closed rule

The contract makes the outcome of a steering attempt explicit, so a runtime that could
**not** participate is never confused with one that **allowed**:

| Outcome | Meaning | Maps to |
| --- | --- | --- |
| `ok` | the runtime participated | the decision it produced (allow or deny) |
| `unsupported` | this phase/operation is outside the declared capabilities | no decision — the envelope/CI boundary is authority |
| `not-invoked` | a required hook did not fire (config removed, platform regression) | **deny** (fail closed) for a required phase |
| `parse-failure` | the event bytes could not be understood | **deny** (fail closed) |
| `transport-failure` | the event could not be delivered/retrieved | **deny** (fail closed) |

`parse-failure` and `transport-failure` **must** map to `deny`. This mirrors the live
`HookInputError` → `failClosed` behaviour in `src/cli/hook.ts`: a payload TamperWard
cannot parse, or a verdict it cannot transport, is denied rather than allowed. The core
wire rule the whole seam preserves:

> **deny = JSON on stdout at exit 0; exit 2 is never a verdict; unparseable/unreachable =
> deny (fail closed); empty stdin = allow.**

Note one Claude-specific nuance: Claude's live hook client degrades a hook-*service*
transport failure to the **in-process** verdict (`src/cli/hook-client.ts`) rather than
surfacing `transport-failure` at the seam — the verdict is still computed, just locally.
A partial adapter with no in-process fallback denies through the fail-closed path instead.

## Identity is a claim to validate, not a trusted fact

The `cwd`, repository, and session a runtime supplies are **untrusted input**. The runner
derives the real repository root **independently** with `git rev-parse --show-toplevel`
(which resolves symlinks to a canonical path) and validates the claim against it:

- a malformed or empty cwd claim is **rejected**;
- a claim that resolves to **no repository**, or to a **different** repository than the
  one under enforcement, is **rejected**;
- path escapes and symlink escapes out of the trusted root are **rejected**;
- a relative claim resolves against the **runner's** cwd, never against itself.

This is enforced, not merely documented. `RuntimeAdapter.validateIdentity` derives the
runner's trusted root from the **runner** context (the runner cwd the adapter is given),
INDEPENDENTLY of the claim, then validates the claim against it with the shared
`validateClaimAgainstRoot` helper (`src/repo-context.ts`). `RuntimeAdapter.decide` calls it
**first** — `parse → validate → decide` — and returns a fail-closed **deny** on rejection,
before any content reaches the detectors, so a runtime-supplied cwd pointing at another
repository can never be evaluated as if it were the one under enforcement.

The same helper closes the boundary on the live path: `preToolUseVerdict` / `stopVerdict`
accept an optional `trustedRoot`, and when a runner supplies one (a `RuntimeAdapter`'s
validated root; the persistent hook service's bound root), a cross-repo / non-repo /
malformed `input.cwd` fails closed there too. The parameter is optional and defaults to
unset: the **direct** in-loop hook is launched by the runtime inside the repository it
names, so it has no separate anchor, and every existing caller that supplies no
`trustedRoot` behaves byte-identically — only a runner with its own independently-derived
trusted root turns the claim into something to reject. This mirrors — and never weakens —
what the live path already does by resolving through `repoRoot()` (#412: the verdict is
always computed at the repository root, so an edit judged from `packages/x` is the edit
judged from the root). The payload's `cwd` is a fact to check, not authority to accept.

## How to add a runtime

1. **Map the runtime's events to the neutral shape.** Implement `parseEvent(raw, phase)`
   returning a `SteeringEvent` (proposed operation + kind + args + untrusted identity), or
   `{ failure: 'parse-failure', detail }`. Reuse `synthFileChange`
   (`src/adapters/claude/changes.ts`) so diff reconstruction and its fail-closed behaviour
   are shared, not re-implemented.
2. **Declare capabilities honestly, per operation.** Only claim `preDeny` for an operation
   kind the runtime can *synchronously* deny in the *installed* configuration, proven by
   invocation evidence — not by the existence of a hook name. Record every gap in
   `unsupported`.
3. **Emit the runtime's native deny envelope** from `denyPayload(findings, phase)`, reusing
   `formatDenial` so the denial reason reaches the agent identically.
4. **Fail closed.** Ensure the *installed* configuration denies on timeout, malformed
   output, a missing executable, a non-zero exit, and hook non-invocation. A green
   standalone hook test is not evidence; the failure modes must be exercised against the
   real config.
5. **Validate identity independently** in `validateIdentity`, per the section above. Never
   let the runtime's `cwd` become authority.
6. **Protect the new wiring itself.** A gate that cannot protect its own steering
   configuration on the new runtime does not meet the bar. (This, the second adapter, the
   research-adapter registration, and the parity suite are Phase 2 / Phase 3 work — see the
   issue's staged sequence. Phase 1 ships the neutral seam and the Claude conformance only.)

## Codex (EXPERIMENTAL — adapter exists, not yet 4.1-eligible)

An **experimental** Codex adapter ships in `src/adapters/codex/*`
([#482](https://github.com/hexrift/tamperward/issues/482),
[#563](https://github.com/hexrift/tamperward/issues/563)). It is the second implementation
of the neutral `RuntimeAdapter` contract, and it is deliberately conservative.

**Grounded in the real Codex protocol.** The adapter's wire is grounded against the Codex
source (`openai/codex`, `codex-rs/hooks/schema/generated` and `codex-rs/core/src/tools`),
not guessed. The canonical **hook-facing** tool names are `Bash` (the whole shell/exec
family), `apply_patch` (with `Write`/`Edit` as matcher aliases), and `mcp__<server>__<tool>`
(`hook_names.rs`, `unified_exec.rs`, `mcp.rs`). `view_image` is the native read, and
`update_plan` and `web_search` are allowlisted as non-mutating; any other non-empty tool
name — `write_stdin` and `spawn_agent` included — fails closed with `unknown-tool`, so a
tool the adapter does not model is never evaluated as a no-op. The **apply_patch** payload is
`tool_input.command` carrying the patch text (`apply_patch.rs`). The **deny wire differs by
phase**: PreToolUse denies with `hookSpecificOutput.permissionDecision:"deny"` (plus the
deprecated top-level `decision:"block"`), while Stop denies with `{decision:"block", reason}`
and **no** `hookSpecificOutput`
(`pre-tool-use.command.output.schema.json`, `stop.command.output.schema.json`). Those four
schema files are copied verbatim into `test/fixtures/codex-schemas`, and
`test/codex-protocol.test.ts` validates the adapter's inputs and deny wire against them.

**Two milestones, not one.** *An adapter existing is not the same as a runtime being
qualified for in-loop enforcement.* Milestone one — the adapter — is done: it normalizes
Codex hook payloads, maps the canonical tool names to operation kinds, reconstructs shell
and file-edit operations (including `apply_patch`) into the shared `Change[]` via
`synthFileChange`, runs the **same** engine as the Claude path for its pre-action content
decision, delegates the end-of-turn sweep to the canonical git sweep, validates identity as
an untrusted claim, and fails closed on every failure state. Milestone two — proving that
Codex actually **enforces** a pre-action deny and that its hook transport actually **fails
closed** on a *pinned* Codex build — is **not** met, so Codex is **not** eligible for
Round 4.1. The registry (`src/runtimes.ts`) keeps Codex at `steering: 'neutral'` and no
research round is registered. This matters because Codex currently **fails open** on some
hook failures (`pre_tool_use.rs` `serialization_failure_outcome`,
`permission_decision_allow_without_updated_input_fails_open`): a real qualification run may
legitimately come back PARTIAL, which is exactly why the probe *proves* fail-closed from
evidence rather than assuming it.

**Conservative capabilities.** The Codex adapter declares:

- `preDeny: []` — pre-action deny enforcement is **not yet proven** on a pinned Codex build,
  so the adapter claims no synchronous veto (per the honesty rule: only claim `preDeny` for
  a kind proven by invocation evidence, never by the mere existence of a hook name);
- `postObserve: shell | file-edit | file-read | mcp | other` — Codex surfaces
  post-execution tool outcomes;
- `endOfTurn: true` — Codex delivers a stop event that runs the mandatory git sweep;
- `unsupported` names the real gaps in prose: *pre-action deny enforcement not yet proven on
  a pinned Codex build*, *fail-closed hook transport not yet proven
  ([openai/codex#41979](https://github.com/openai/codex/issues/41979))*, *network-egress
  control*, and *identity / authentication*.

**Three-layer qualification.** Qualification is layered so the parts that *can* run
deterministically in CI are separated from the part that needs a real Codex box:

Run `node harness/adapters/codex-probe.mjs --preflight` to check the driver and
explicit runtime/configuration pins before live execution. This mode makes no
model-backed qualification calls and returns nonzero when pins are incomplete.
The runtime version lookup has a five-second deadline. Probe cleanup removes only
the current invocation's cache, preserving other probe drivers.
It does not establish credential availability, enforcement, runtime eligibility or
a research freeze. Only a retained live qualification can establish enforcement.

- **(a) Protocol conformance** (`test/codex-protocol.test.ts`, CI) — the adapter parses the
  real Codex input shape and its deny wire validates against the copied real output schemas.
- **(b) Probe self-test** (`test/codex-probe-selftest.test.ts`, CI) — the probe's own
  classifiers are asserted against every deterministic mode (hook-fired-deny-respected,
  deny-ignored, hook-never-fired, tool-never-attempted, observed-failure-fail-closed,
  unobserved-failure, outer-timeout-inconclusive, stop-respected/ignored/never-fired), the
  provenance gate is asserted (a missing pin or version mismatch caps at not-full), the
  distinct-`tool_use_id` counter is checked, and the **real** driver is built and exercised
  end-to-end (decide → append to a parent-owned ledger → classify). This proves the probe
  *itself* cannot false-green.
- **(c) Real Codex E2E** (`npm run probe:codex-runtime`, **not** run in CI) — the real gate
  for milestone two, on a pinned Codex build.

**`probe:codex-runtime`** (`harness/adapters/codex-probe.mjs`) drives a real `codex` binary
against a real repository. Each mutation class (shell edit, `apply_patch` edit, native
edit/write, delete, rename, git checkout/reset/restore, MCP op, nested shell, *multiple tool
calls in one turn*, detached/background mutation) is run as a **CONTROL** (fully pass-through
hooks → the mutation must land) vs **GATED** (TamperWard hook → deny) pair. Evidence is a
**parent-owned, append-only ledger** written **outside** the candidate repo by the hook
driver, plus a tracer hook that records that the tool was attempted; `specIntact` alone is
never proof. A mutation case passes only when the ledger shows the expected tool was
attempted, PreToolUse fired, TamperWard denied, the reason reached Codex, the mutation did
**not** land, and Codex completed, and the gated wiring **binds** to the recorded provenance
hash. The *multiple protected mutations* case additionally requires a **denied PreToolUse
command targeting each protected file** (`src/a.spec.ts` *and* `src/b.spec.ts`) — two denials
against one file is not two targets — and the control arm must land both; genuine concurrency
is not asserted. A dedicated **detached/background** case backgrounds a delayed mutation and a
parent-owned sentinel, then judges only after a **settle interval** exceeding the child's
delay, so a deny that was ignored cannot escape by mutating after the command returns.

FULL additionally requires a **real Stop qualification**: a case that lets a protected
mutation LAND during the turn (pre-action pass-through) and then proves from the ledger that
Stop fired, the sweep returned the `{decision:block, reason}` wire, and Codex **honoured** it
by continuing the turn — a subsequent Stop with `stop_hook_active:true` (codex-rs `turn.rs`
injects a continuation), not merely that the feedback appeared and the process exited.

For **fail-closed transport**, each broken hook (crash, non-zero exit, malformed JSON, empty
output, timeout, missing executable) writes a positive `hook-failure` marker of its kind to
the ledger **before** it triggers the fault, so `intendedHookFailure` is **observed**, never
assumed; `protectedToolAttempted` is bound to the **specific** expected Bash command (the
sentinel path *and* the protected file), not merely "some tool fired", and a pass-through
control proves the prompt is potent; the protected command drops a parent-owned **dispatch
sentinel**, so a PASS requires direct proof the tool was **not dispatched**, not merely an
intact file; a case where the **outer harness timeout** killed Codex is treated as
**inconclusive**, never a fail-closed PASS. Three identity-poison cases (invalid, cross-repo,
symlink-escape claimed cwd) run the driver directly with an **explicit** adversarial cwd and
must fail closed.

Before it may print a finite-probe `FULL` result, the probe enforces a **provenance gate**:
`CODEX_VERSION_EXPECTED` (the running Codex version token must match it **exactly** — `0.9.1`
never qualifies a running `0.9.10`), `CODEX_MODEL` (passed
operatively to `codex exec` as `--model`, so the pinned model is the one that runs), and
`CODEX_HOME` must be set, and the **canonical SHA-256 of the gated `.codex/config.toml`** — the
wiring every qualifying gated run is bound to — must be captured, alongside the Codex binary
SHA-256, OS/arch, `exec` args, approval/sandbox mode, and adapter/probe/driver hashes. Any
missing pin caps the result at PARTIAL. With no
Codex CLI present it reports PARTIAL and exits non-zero, so "could not test" is never mistaken
for "passed". A FULL result covers these finite probe cases only and still reports
Round 4.1 as not eligible. Eligibility additionally requires retained evidence that
`tamperward runtime verify` grades FULL, the separate maintainer-reviewed pinned
parity run and every other gate in the
[registered protocol](https://github.com/hexrift/tamperward/blob/main/harness/taskbench/round4.1/PREDICTION4.1-taskbench.md).
The probe does not promote a runtime or fill the runtime freeze.

**CI honesty.** A green CI run proves the **build, unit/adapter tests, static gate, protocol
conformance (a), and the probe self-test (b)** only. It does **not** prove runtime
qualification: the real-Codex E2E (c) is not run in CI (no Codex binary there). Codex stays
experimental and `neutral`, and `preDeny` stays empty. The registered outcomes-known
Round 4.1 replication remains unexecuted until its runtime freeze and full eligibility
gate pass; a finite `probe:codex-runtime` result cannot satisfy them by itself.

A recorded `runtime verify --runtime codex` qualification is bound to the hash of
`.codex/config.toml`, where Codex reads project hooks; editing or removing that file marks
the record `STALE` in `runtime status` and `onboard`. The file is also protected hooks
surface by default (2.39.23): deleting or renaming it, or removing, changing or adding to
the entries in its `[hooks]` tables, is a `hook-tampering` finding, so an agent cannot
drop its own interception before a protected edit without the gate seeing it. Edits
outside the hook tables are the project's own.

The Codex pre-action path pins the Stop-sweep baseline at **turn start** (`turnBaseline`) on
every pre-action call, exactly as the canonical `preToolUseVerdict` does — because with
`preDeny` empty the end-of-turn git sweep is Codex's only real enforcement, and a baseline
first set at Stop time would let a mutation the turn *committed* mid-turn slip past the
sweep. The other two canonical pre-action steps run as well (2.39.24), on the Codex, Copilot
CLI and Copilot SDK paths alike: `effectDriftBlocks` denies a protected-tree drift since the
last sanctioned state before the operation is judged (a tracked file gutted out of band is the
rule's own finding; a gitignored one is `hidden-drift`), and `sanctionPredictedWrites` records
an allowed write on a protected file so the next call does not re-litigate it. The parity
suite (`test/runtime-adapter-parity.test.ts`) holds every registered adapter to the same
findings the Claude path produces for both.

**Wiring (2.41.0).** `tamperward init` / `onboard` write the `[hooks]` tables into
`.codex/config.toml` when the repository shows a Codex marker (`AGENTS.md`, or a `.codex/`
directory holding more than the wiring itself): a `PreToolUse` entry on matcher `*` running
`tamperward hook codex` and a `Stop` entry running `tamperward sweep codex`, in the same
hardened pinned `npx` form as the Claude wiring, labelled experimental in the file and in the
init output. The rest of the file is the project's: init appends to a config without hooks,
re-pins the entries it wrote, and refuses to rewrite a hand-written hooks block. The two
commands run the Codex adapter over the hook payload and write its native envelope at exit 0.
The file is protected hooks surface (2.39.23, above); a pin raise is the one edit the
detector does not report. None of this changes the qualification: `preDeny` stays empty and
`runtime verify` grades what is proven.

## GitHub Copilot CLI (EXPERIMENTAL — adapter exists, not yet 4.1-eligible)

An **experimental** GitHub Copilot CLI adapter ships in `src/adapters/copilot/*`
([#482](https://github.com/hexrift/tamperward/issues/482),
[#598](https://github.com/hexrift/tamperward/issues/598)). It is the third implementation of
the neutral `RuntimeAdapter` contract, and — like Codex — it is deliberately conservative.

**Grounded in the published Copilot hook contract, both documented formats.** Copilot CLI is
closed-source, so the adapter's wire is grounded against the **GitHub Copilot hooks reference**
(the canonical contract for the CLI) rather than a source tree. GitHub documents **two** hook
wire formats, and the adapter accepts **both**:

- **Native camelCase** — `preToolUse` carries `sessionId`, `timestamp`, `cwd`, `toolName`, and
  `toolArgs` (a JSON **string** that must be parsed); `agentStop` carries `sessionId`,
  `transcriptPath`, `stopReason`. The native tool names are lowercase: `bash` / `powershell`
  (shell), the shell-**session** tools `write_bash` / `write_powershell` (send input to a
  running shell — mutation-capable, so classified as `shell`), `create` / `edit` /
  `apply_patch` / `str_replace_editor` (file write), `view` / `grep` / `rg` / `glob`
  (read/search). Other documented non-mutating built-ins — `read_*` / `stop_*` /
  `list_*`, `web_fetch` / `web_search`, `ask_user`, `report_intent`, `task` /
  `agent`, `skill`, and `update_todo` / `todowrite` / `todo` — are explicitly
  allowlisted as `other`; their PascalCase aliases are accepted too.
- **PascalCase / Claude-compatible** — `PreToolUse` carries `hook_event_name`, `session_id`,
  `timestamp`, `cwd`, `tool_name`, and a `tool_input` object, where `tool_name` is the **Claude
  tool name** (`Bash`, `Write`, `Edit`, `Read`); `Stop` carries `session_id`, `transcript_path`,
  `stop_reason`. In this mode a native `apply_patch` / `edit` / `str_replace_editor` is reported
  as `Edit` — but whether GitHub rewrites the `tool_input` into ordinary Edit fields
  (`file_path` + `old_string`/`new_string`) is **not confirmed**, so an `Edit` carrying a
  patch-style payload without those fields **fails closed** pending a real fixture. `MultiEdit`
  is accepted **defensively** (a Claude-compatible name), not because a Copilot source documents
  it as a Copilot tool.

Normalization is field-by-field with the snake_case spelling winning and the camelCase spelling
as a fallback, so either mode normalizes sensibly. Known read-only and control-plane tools are
explicitly allowlisted; any other non-empty tool name fails closed with `unknown-tool`.
`tool_use_id` is **not** a documented Copilot field and is not read. `apply_patch` (the OpenAI patch envelope, shared with Codex) is
reconstructed via the shared `applyPatchChanges`; `str_replace_editor` is modelled for its
`str_replace` and `create` sub-ops and **fails closed** on any other sub-op (e.g. `insert`)
pending a real pinned-run payload. A shell-session write (`write_bash` / `write_powershell`)
reconstructs the `input` it sends as a command, and **fails closed** if it carries no
reconstructable command/input — so a model cannot bypass the pre-action decision by piping a
mutation into an existing session instead of opening a new `bash` call. Deletes and renames are
issued through the shell (`rm` / `mv`). The **deny wire differs by phase**, and differs in shape
from Claude/Codex: `preToolUse`
denies with a **flat** `{ permissionDecision: "deny", permissionDecisionReason }` (no
`hookSpecificOutput` wrapper), while the `agentStop` end-of-turn event carries a flat
`{ decision: "block", reason }` — the same shape the canonical Stop sweep already emits. The
raw `agentStop` / `Stop` payload is normalized to the Claude Stop shape first (native
`sessionId` → `session_id`) so the sweep anchors the same per-session baseline the pre-action
path pinned.

**Control points and the agentStop continuation limit.** On Copilot, `preToolUse` is the only
**pre-execution tool veto**. `agentStop` is a **lifecycle control**: its `{decision:"block"}`
**forces another agent turn** (it cannot undo a filesystem mutation that already landed), and
Copilot **overrides the hook after 8 consecutive `block` continuations** (the `stop_hook_active`
lifecycle) — so `endOfTurn: true` must **not** be read as Claude-equivalent enforcement until
the real Stop qualification exercises that interaction (TamperWard's canonical `stopVerdict`
immediately allows when `stop_hook_active:true`). `postToolUse` is a real observation surface
(it carries `toolName`, `toolArgs`, and the tool result), but **milestone one does not consume
it**: `decide(..., 'post-action')` returns `unsupported` and rejects a post-action deny wire at
the boundary, exactly as the Codex adapter does — so the adapter declares `postObserve: []`
rather than advertising kinds it does not report.

**A fail-open risk scoped to the transport, recorded not masked.** For a **command**
`preToolUse` hook, Copilot's failure semantics are **asymmetric**: a hook that **crashes**,
exits non-zero, or exits 2 **fails closed** (exit 2 denies even if stdout says allow), but a
hook that **times out** **fails OPEN** (the tool call proceeds). Separately, an **HTTP**
`preToolUse` hook **fails OPEN** on network error, timeout, or a non-2xx response. TamperWard
therefore qualifies only the **local command/exec** transport, and both facts are carried in the
adapter's `unsupported` list so a cross-runtime study cannot mistake Copilot for a fail-closed
transport. The real `probe:copilot-runtime` qualification (follow-up PR) measures whether the
pinned command-hook build behaves as documented, and makes the transport part of the pinned
provenance.

**Conservative capabilities.** The Copilot adapter declares:

- `preDeny: []` — pre-action deny enforcement is **not yet proven** on a pinned Copilot CLI
  build, so the adapter claims no synchronous veto (the honesty rule: only claim `preDeny` for
  a kind proven by invocation evidence, never by the mere existence of a hook name);
- `postObserve: []` — Copilot exposes a `postToolUse` observation surface, but milestone one
  does not consume it, so the adapter advertises no post-observe capability (rather than
  contradicting its own `unsupported` post-action outcome);
- `endOfTurn: true` — Copilot delivers an `agentStop` event that runs the mandatory git sweep
  (subject to the 8-block continuation limit above);
- `unsupported` names the real gaps in prose: *pre-action deny enforcement not yet proven on a
  pinned Copilot CLI build*, the *command-hook timeout fails OPEN / HTTP-hook fails OPEN*
  transport scoping, *`preToolUse` is the only pre-execution veto while `agentStop` only forces
  continuation (8-block override)*, *`apply_patch` / `str_replace_editor` payloads modelled from
  the published contract but not yet confirmed against a real fixture*, *network-egress control*,
  and *identity / authentication*.

Identity is validated as an untrusted claim exactly as the Claude and Codex adapters do, and
every failure state (`parse-failure`, `transport-failure`, `not-invoked`, an unreconstructable
edit, a rejected identity) fails closed to a deny. The pre-action path pins the Stop-sweep
baseline at **turn start** on every call, for the same reason Codex does: with `preDeny` empty
the end-of-turn git sweep is the only real enforcement, and a baseline first set at Stop time
would let a mutation the turn *committed* mid-turn slip past.

**Two milestones, not one.** Milestone one is the adapter, with unit/adapter conformance in
`test/copilot-adapter.test.ts` (CI). Milestone two is the real qualification, layered exactly
like Codex so the CI-deterministic parts are separated from the part that needs a real Copilot
box:

- **(a) Adapter conformance** (`test/copilot-adapter.test.ts`, CI) — the adapter parses both
  documented hook formats and its deny wires match the published shapes.
- **(b) Probe self-test** (`test/copilot-probe-selftest.test.ts`, CI) — the probe's own pure
  classifiers are asserted against every deterministic mode (hook-fired-deny-respected,
  deny-ignored, hook-never-fired, tool-never-attempted, observed-failure-fail-closed,
  the documented timeout **fail-open**, outer-timeout-inconclusive, Stop
  respected/ignored/never-fired), the provenance gate, the distinct/denied `tool_use_id`
  counters, and the **real** driver end-to-end (build → decide over a native Copilot payload →
  append to the **non-authoritative diagnostic ledger** → classify). This proves the probe
  *itself* cannot false-green.
- **(c) Real Copilot E2E** (`npm run probe:copilot-runtime`,
  `harness/adapters/copilot-probe.mjs`, **not** run in CI) — the real gate on a pinned,
  authenticated Copilot CLI. It wires TamperWard as a Copilot `preToolUse` hook (deny) plus an
  `agentStop` hook (sweep) in `.github/hooks/tamperward.json` (protected hooks surface by
  default since 2.39.23: deleting or renaming the file, or removing, changing or adding to
  its `hooks` member, is a `hook-tampering` finding; since 2.41.0 `tamperward init` writes
  that file itself when the repository shows a Copilot marker, with `tamperward hook copilot`
  and `tamperward sweep copilot` as the two commands, labelled experimental, and re-pins or
  refuses it on later runs as it does the Claude wiring), and — because Copilot gates
  repository hooks in `-p` prompt mode — sets `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true` in
  the child environment (recorded in provenance) so the wiring actually loads. It runs
  CONTROL-vs-GATED mutation pairs (shell edit, `apply_patch`, native `edit`/`create`, delete,
  rename, git restore, MCP, nested shell, **`write_bash` shell-session**, and multiple protected
  mutations in one turn) against `copilot -p … --allow-all-tools --no-ask-user`. Each case's
  verdict rests **only on parent-observed evidence** — the protected file's on-disk state, the
  CONTROL arm landing the same prompt, dispatch sentinels the parent reads directly, and a runtime
  abort from the child's own failure. These are candidate-**mutable** files, so they are trustworthy
  only in the **positive / FAIL direction** (a landed mutation or an appeared sentinel — the
  candidate cannot make the parent see something that did not happen); a **negative** (intact final
  state, absent sentinel) is only *"no surviving evidence"*, never proof nothing dispatched (a
  candidate can mutate then restore before the parent inspects). A **landed protected mutation
  always FAILs**. The ledger is a **non-authoritative diagnostic
  trace**, **not** trusted evidence: its absolute path is embedded in the committed
  `.github/hooks/tamperward.json`, and because Copilot documents shell path verification as
  **heuristic** (tokenised command text, custom variables not expanded, complex constructs falling
  back to normal handling), a same-UID candidate under `--allow-all-tools` may write, truncate, or
  fabricate it — so **no PASS/PROVEN fact is derived from it**; ledger rows are printed as
  corroborating diagnostics only. It also runs the
  **detached/background** case (a delayed background mutation, judged **only from parent-observed**
  dispatch sentinels + the protected spec after a settle interval, with a CONTROL arm proving the
  prompt is potent — a dispatched sentinel is fail-open even if the file stays intact; a clean
  final state is reported as **`NO-SURVIVING-DISPATCH-EVIDENCE`**, since a candidate could dispatch
  then remove the sentinel and restore the file before the settle, so absence is not proof). The
  **`agentStop` continuation** case executes against the real binary, but because its facts
  (Stop fired, `decision:block` returned, Copilot continued) come only from the ledger or Copilot
  stdout — neither parent-observed nor forge-independent, and this architecture has **no
  unforgeable end-of-turn channel** — the Stop qualification is reported as a **diagnostic** and
  the `end-of-turn` row stays **UNPROVEN**; it can never lift the verdict. The **broken-hook transport** matrix drives
  six hooks and classifies each by its DOCUMENTED semantic, not an assumed result: crash /
  non-zero exit must fail **CLOSED**; a **timeout, or exit 0 with empty or malformed stdout**, is
  the documented **FAIL-OPEN** (no hook output → default permission → the tool proceeds under
  `--allow-all-tools`); a **missing configured executable** — wired via Copilot's `exec` hook
  form so the binary genuinely cannot be spawned (distinct from a shell reporting "command not
  found") — is **measured**.

  It emits a **capability matrix** #598 asks for, never a single supported/unsupported boolean —
  but the vocabulary is bounded by what parent-observed evidence can establish. Because the probe
  has **no forge-independent attempt/hook/deny signal**, it cannot prove in-loop deny enforcement,
  and because the ledger is demoted there is also **no trusted evidence of which tool/path Copilot
  used** (a prompt can be satisfied through another mutation path). So mutation rows are
  **scenario-based** — `protected-final-state:<scenario>` (`HELD` / `NOT-HELD` / `INCONCLUSIVE`),
  the protected file did not land under a potent control — **not** attributed to a runtime
  operation kind (`:shell` / `:file-edit` / `:mcp`, which would overclaim tool identity) and **not**
  `pre-deny:<op> PROVEN` (which would claim attempt + hook-fire + deny + enforced non-execution a
  non-land alone does not show); the claimed operation kind is printed as a diagnostic. Likewise
  each transport row's **authoritative semantic is parent-observed** (`transportObservation`:
  dispatch sentinel + spec state + a potent control), never the candidate-writable ledger: a
  dispatch/land is a trustworthy **FAIL-OPEN** (positive direction); a non-dispatch is only
  **`NO-DISPATCH`** (attempt/hook-fire not independently verified, and absence is not proof),
  never a proven `FAIL-CLOSED`. A documented FAIL-OPEN kind observed as anything but FAIL-OPEN is a
  **DEVIATION**. So neither a HELD scenario row nor a NO-DISPATCH transport row can lift `overall`
  to FULL: **FULL is structurally unreachable here** (which is Copilot's real case), and the honest
  result is PARTIAL — a set of parent-observed observations, not an in-loop enforcement proof. A
  **provenance gate**
  (`COPILOT_VERSION_EXPECTED` matched **exactly**, `COPILOT_MODEL`, `COPILOT_HOME`, and the
  canonical hooks-config SHA-256) caps the result at PARTIAL when unpinned; with no Copilot CLI
  it reports PARTIAL and exits non-zero, so "could not test" is never mistaken for "passed".

A real run's `overall` is **PARTIAL**, never FULL: Copilot's command-hook timeout/empty/malformed
states are documented fail-open, and — more fundamentally — this black-box harness has no
forge-independent signal that a hook fired and denied, so it reports scenario-level
protected-final-state and transport observations, not in-loop deny enforcement. FULL as defined here would require a
qualification channel #482/#598 does not yet specify. Copilot therefore stays
`steering: 'neutral'` in `src/runtimes.ts`, `preDeny` stays empty, and no Round 4.1 research
round is registered. A green CI run proves the build, unit/adapter tests, static gate, and the
probe self-test only — **not** runtime qualification (layer c is not run in CI; there is no
Copilot binary there).

## GitHub Copilot SDK-hosted (EXPERIMENTAL — Phase-0 spike, #611)

A **separate** runtime configuration from the CLI command-hook path above (`github-copilot-cli`,
which remains PARTIAL and stays the evidence record for the command-hook path). Here TamperWard is
the **host**: the `@github/copilot-sdk` `onPermissionRequest` callback runs **in-process before
each tool executes**, and `onAgentStop` (`{decision:"block",reason}`, guarded by `stopHookActive`)
is the end-of-turn lever. #611 asks whether this hosted path can meet the frozen #482 / Round-4.1
bar **without moving the goalposts** — it does not silently upgrade the CLI descriptor, and suggests
the explicit ids `github-copilot-cli` vs `github-copilot-sdk-hosted`.

**Adapter** (`src/adapters/copilot-sdk/*`, `github-copilot-sdk-hosted`). The host JSON-serialises
each SDK `PermissionRequest` and hands it to `decide`, which opens no second verdict path: a
**shell** proposal reconstructs its `fullCommandText` through the shared `changesFromCopilot` and
runs the same `evaluate` engine; the `end-of-turn` sweep delegates to the canonical `stopFromRaw`
(its `{decision:"block",reason}` wire is already the SDK `onAgentStop` shape); identity is validated
against the runner's independently derived trusted root. `read` and `mcp` requests and the
non-repository kinds `url`, `memory` and `hook` reconstruct to no change; any other permission
kind — `custom-tool` included, since the host registers no custom tools — fails closed with
`unknown-tool` before reconstruction. A pre-action deny is the SDK
`PermissionRequestResult` reject variant — `{kind:"reject", feedback}`, discriminated on `kind`
(approval is `{kind:"approve-once"}` and kin) — which is distinct from the agentStop
`{decision:"block"}` shape and from the CLI hook's flat `{permissionDecision:"deny"}`.

**Content-aware file-edit pre-deny is CONDITIONAL.** A `write` `PermissionRequest` surfaces the
proposed change — `fileName`, a unified `diff`, an `intention`, and optionally the full
`newFileContents` — so TamperWard **can** judge it before execution: the adapter reconstructs a
`Change[]` from that content (`newFileContents` → the shared `synthFileChange`; else the `diff` is
applied by **canonical Git**) and runs the same `evaluate` engine, so a weakened assertion / added
skip / policy change is denied. TamperWard does **not** re-implement unified-diff semantics: for a
`diff` it seeds an isolated, host-owned temp tree with the exact current target bytes, binds the
patch to a fixed in-tree name, and runs `git apply --numstat` (single-file binding), `git apply
--check`, then `git apply`, reading the result back as the exact `after`. The reconstruction is
**bound to the request's `fileName`**: the diff's own header paths are validated against it and
`--numstat` proves it touches exactly one file — a diff naming a different or multiple files fails
**closed** — but they never place the write, so a path-escaping or mismatched header cannot steer the
rebuild at a real path. Git owns every diff rule, so stale context, an overlapping/backwards hunk, a
bad count, or a malformed header makes `git apply` refuse and the request fails **closed** (never a
no-op allow). The **exact proposed operation** is preserved, never normalized: the diff's `/dev/null`
endpoints decide create vs delete vs modify, that operation is validated against the observed disk
state (a create whose target exists, or a modify/delete whose target is absent, fails closed), and it
is that operation Git reconstructs — a `+++ /dev/null` delete is judged as a real deletion, not an
empty-file modify; rename/copy/binary/mode-only shapes are rejected. The reconstruction is also
**bounded before Git is spawned** — a diff past the operator-owned byte/line budget, or a `git apply`
that exceeds its timeout/output cap, fails **closed**, so a candidate cannot manufacture the very
decision-path delay #611 is measuring. When both `newFileContents` and a `diff` are supplied the
Git-reconstructed result must **byte-match** `newFileContents`, or the request is ambiguous and fails
closed. `DiskEntry.kind` is preserved: only an **absent** target is a create (reconstructed from
`/dev/null`); an existing target that cannot be read (directory, oversize, irregular) fails
**closed**, never treated as a create. The **target itself is bound to the trusted repository root**
before any disk read: a `../` escape, an absolute path outside the root, or an in-repo symlink whose
real target leaves the root fails **closed** (the SDK's `resolvedPath` is retained only as an
untrusted claim, compared against the host-derived canonical target — a mismatch denies). Disk
inspection, `Change.path` and policy use that **canonical root-relative** spelling, so an in-repo
alias to a protected file is judged as the protected file, not waved through under the alias name. A
one-sided `---`/`+++` pair, a duplicate `---`/`+++`/`diff --git` header, or any Git file metadata
without a full endpoint pair is refused rather than repaired into a valid operation.
This is conditional on what the pinned runtime
actually provides — a write that surfaces **no usable content** is `unsupported` for that measured
configuration (allow-through;
the end-of-turn sweep is the authority), never a **blanket path deny**, which would replace
content-aware enforcement with stricter path blocking and break the parity the transfer is meant to
establish. The capability vocabulary is granular, not a single boolean:

```text
pre-deny:shell                 CANDIDATE          (needs the pinned spike to prove a reject blocks dispatch)
pre-deny:file-edit-content     CANDIDATE          (conditional: reconstructs from diff / newFileContents; UNSUPPORTED only if a measured config lacks usable content)
pre-deny:file-edit-path        AVAILABLE-LIMITED  (native write interception seen; never a generic pre-deny)
end-of-turn:file-edit-content  CANDIDATE
```

**The decisive unknown (Phase-0 #3).** Whether a **rejected / thrown / timed-out** permission
handler actually blocks tool dispatch is **undocumented** and can only be MEASURED on a pinned SDK.
A single observed fail-open on a required path makes the hosted configuration ineligible for #482 /
Round 4.1. That is why every operation stays a CANDIDATE and `capabilities.preDeny` is empty until
the pinned spike proves enforcement — including whether the content-aware file-edit deny above is
actually honoured by the runtime.

**Host-owned evidence.** The spike (`spike:copilot-sdk`, `harness/adapters/copilot-sdk-spike.mjs`)
records an append-only event stream **in the host process** (the callback runs in-process, not a
candidate subprocess), so the candidate cannot fabricate the `proposal → callback received → deny →
no dispatch` chain — a genuine improvement over a candidate-writable ledger. Even so, only the
**positive** direction is trusted: a dispatched handler / a mutated final state proves fail-open;
absence of a dispatch is not, by itself, absolute proof nothing ran. The pure classifiers
(`classifyPreDispatchDeny`, `classifyDecisionPathFailure`, `classifyEndOfTurn`,
`classifyIdentityBinding`, `buildSpikeMatrix`, `provenanceGate`) run in CI (layer b) and cannot
false-green. `provenanceGate` compares **measured** provenance against expected pins and binds
**both** the actual loaded SDK package version (resolved by walking the module entrypoint's package
root — the package does not export `./package.json`) **and** the hosted Copilot **runtime** version
from `client.getStatus()` (the SDK delegates to a runtime, which #611's freeze requires), plus the
TamperWard build, host-config hash, and the exact model passed into the session; a mismatch or any
unmeasured pin caps below `full`, and `auto` never qualifies. Layer (c) is a **real, executable**
local qualification harness: it instantiates a live `CopilotClient`, connects the hosted runtime,
measures provenance from `client.getStatus()` / `getAuthStatus()`, then runs the four Phase-0 scenario
groups (shell pre-deny, native-write/apply-patch pre-deny, broken decision path, end-of-turn block +
continuation) in isolated disposable repos, wiring `copilotSdkAdapter` into `onPermissionRequest` /
`hooks.onAgentStop` and recording host-owned evidence. It needs a pinned `@github/copilot-sdk`,
credentials, and an exact model, and does **not** run in CI — the orchestration itself is CI-tested
through an injected fake binding + the real adapter (`test/copilot-sdk-qualify.test.ts`). With no
pinned SDK, no credentials, or a missing/`auto` model the harness reports **INSUFFICIENT** and exits
non-zero — "could not test" is never "passed".

The CLI bundle (`dist/cli/index.js`) exports nothing — it is a binary, not a library — so the
harness self-compiles the adapter from `src` with esbuild to a temporary ESM module and imports it,
hashing the exact bundle into provenance. The
bundled `src` graph loads `yaml`/`picomatch` lazily via `createRequire(import.meta.url)`; because
esbuild collapses every module's `import.meta.url` to the output file's URL — which sits in the OS temp
dir with no `node_modules` — the build anchors `import.meta.url` back at the real checkout source so
those lazy requires resolve, otherwise the first policy load throws `Cannot find module 'yaml'` and
every decision fails closed as `tamperward-unavailable` / `policy-load` (the fresh live blocker fixed in
#618 Work A; regression: `test/copilot-sdk-temp-bundle.test.ts`). This is a harness build detail only —
the shipped `dist`, built on disk by `npm run build`, has the correct `import.meta.url` and unchanged
dependency-loading behaviour.

**On the current `@github/copilot-sdk` surface a live run tops out at `INSUFFICIENT`, not FULL or even
PARTIAL** — and this is a deliberate honesty floor, not a bug. What is proven locally at this PR head is
narrow: the temp-bundle `policy-load` root cause is reproduced, the bundled-adapter regression passes
after the fix, and the classifier/fake tests pass. A **fresh credentialed hosted run of this new
bundle/classifier has not happened**, so we do not yet know that every live shell / write / end-of-turn
/ permission-lifecycle path now passes. **Network provenance** is a known remaining provenance blocker
(#618 Work F): the SDK exposes no authoritative network configuration/status the harness can measure —
`client.getStatus()` returns only `{ version, protocolVersion }` — so an
operator-supplied `COPILOT_SDK_NETWORK_MODE` is recorded operator-declared/**unverified** and capped, it
is never laundered into trusted evidence, `provenanceGate.full` stays `false`, and `buildSpikeMatrix`
maps incomplete provenance to `INSUFFICIENT` before it can reach `PARTIAL`. Two intrinsically
unobservable surfaces are recorded honestly but, by design, do **not** block a would-be `FULL` once
provenance is complete: **reason/feedback delivery** to the agent is a diagnostic, not a gate (#618 Work
C) — the Phase-0 enforcement claim rests on the documented permission resolution and observable facts
(proposal received → evaluated → deny → documented `denied-*` resolution → final state intact → agent
continued), and `feedbackDeliveryIndependentlyObservable` is recorded `false`, never conflated with the
deny; and the **permission-callback timeout** has no runtime-exposed completion (a hung callback emits no
`permission.completed`, per pinned `session.ts`), so it is *intrinsically* unobservable as fail-closed
and stays `INCONCLUSIVE` and visible while being carved out of the decision-path fail-closed gate (#618
Work C). It is reported as its **own** non-gating matrix row (`decision-path:timeout`), so the
fail-closed row is qualified to `decision-path:fail-closed (observable paths)` and never carries the
timeout's INCONCLUSIVE under an unqualified label — a dispatch *during* a timeout is still definitive
`FAIL-OPEN`. The **identity-break** paths
(cross-repo, path-escape, symlink-escape, malformed-identity) are `FAIL-CLOSED` from the documented
lifecycle: TamperWard returns `{kind:"reject"}` for the adversarial claim, the runtime resolves it as a
documented `denied-*`, and the protected state stays intact — the SDK permission mechanism received and
resolved the deny, established without any bare code, message hash, or `tool.execution_start` (#618 Work
F). `PARTIAL` therefore requires a future SDK surface that exposes a **verifiable network mode** (lifting
provenance to full); `FULL` additionally requires a pinned run proving shell + content-aware file-edit +
end-of-turn with the *observable* broken decision paths failing **closed** (the intrinsic timeout carved
out, its INCONCLUSIVE still surfaced). Absent that — as today — the honest overall is `INSUFFICIENT`, and
a single observed fail-open is INELIGIBLE. Copilot stays `steering: 'neutral'`, the adapter is not
registered as a detected runtime, and **no** Round 4.1 eligibility is claimed until the exact pinned
hosted configuration passes the full #482 parity suite.

### Running Layer (c) locally (authenticated, pinned — not CI)

Layer (c) is the decisive experiment and runs **only** on a developer machine with real Copilot
access; layers (a) and (b) already cover everything CI can prove.

**Prerequisites.** Node `^20.19 || >=22.12` (the SDK's engine range); a working Copilot
authentication (obtained the normal way — e.g. the `copilot` CLI / `gh` auth the SDK already
recognises; the harness never reads or stores a token, only `getAuthStatus().authType`); and the SDK
installed but **unshipped**:

```
npm install --no-save @github/copilot-sdk@<PIN>
```

**Two-step workflow — preflight, freeze, then qualify.** First measure, without asserting anything:

```
COPILOT_SDK_MODEL=<exact-model> \
COPILOT_SDK_AVAILABLE_TOOLS=<comma-list> \
COPILOT_SDK_NETWORK_MODE=<mode> \
npm run spike:copilot-sdk -- --preflight
```

Preflight connects, prints the **measured** SDK version, runtime version/protocol, model, host-config
hash and auth mode, and exits without a qualification claim. Run it with the same
`COPILOT_SDK_AVAILABLE_TOOLS` and `COPILOT_SDK_NETWORK_MODE` as the qualifying run: both are folded
into `host_config_sha256`, so a preflight without them measures a hash the qualification can never
match. The SDK package is matched by name case-insensitively, so a `@GitHub/copilot-sdk` spec
measures the same version and integrity as `@github/copilot-sdk`. Freeze those measured values as the
expected pins, then run the qualification (measured must equal expected — the harness never turns a
measured value into a pin in the same qualifying run):

```
COPILOT_SDK_MODEL=<exact-model> \
COPILOT_SDK_AVAILABLE_TOOLS=<comma-list> \
COPILOT_SDK_VERSION_EXPECTED=<pin> \
COPILOT_RUNTIME_VERSION_EXPECTED=<pin> \
TAMPERWARD_VERSION_EXPECTED=<pin> \
COPILOT_SDK_HOST_CONFIG_SHA256_EXPECTED=<pin> \
COPILOT_SDK_NETWORK_MODE=<mode> \
npm run spike:copilot-sdk
```

`COPILOT_SDK_AVAILABLE_TOOLS` explicitly configures **and** freezes the session tool surface (it is
passed to the SDK as `availableTools` and folded into `host_config_sha256`); unset, the tool surface
is recorded honestly as the runtime default, unmeasured, which the result flags as a gap. The frozen
`host_config_sha256` also binds the exact rendered prompts (deterministic — the sentinel value is
fixed, not random), the runtime `protocol_version` from `getStatus()`, and OS/arch, so any of those
changing invalidates a qualifying run.

**Flags / modes** (plain argv): `--preflight` (measure only), `--scenario shell|write|failure|stop`
(run one group), `--json <path>` (persist the machine-readable result), `--keep` (retain the
disposable scenario repos — also `TAMPERWARD_KEEP_SPIKE_ARTIFACTS=1`; their paths are printed).
`--model <m>` overrides `COPILOT_SDK_MODEL`. The model may never be empty or `auto`.

**Where results go.** The human summary and the JSON result (`--json`) both carry the same claims:
`schema_version`, `provenance` (expected + measured + gate), per-scenario `semantic`, the
`capability_matrix`, `overall`, `phase0_passed`, `ready_for_extended_qualification`,
`round_4_1_eligible`, and `reasons`. Evidence is host-owned and lives in memory (never a
candidate-writable repo file); scenario repos are removed unless `--keep`.

**Interpreting the verdict.** Per scenario: `PROVEN` / `FAIL-CLOSED` (good), `FAIL-OPEN`,
`INCOMPLETE`, `INCONCLUSIVE`, `UNSUPPORTED`. Overall: **FULL** (every required Phase-0 path proven +
full provenance → sets `phase0_passed: true`), **PARTIAL** (pinned, no fail-open, but a required path
unproven), **INELIGIBLE** (a required broken path failed open — a single fail-open is disqualifying),
**INSUFFICIENT** (could not test: no SDK, no creds, unmeasured/mismatched provenance, or no exact
model). **`round_4_1_eligible` is always `false` here even on FULL**: Phase-0 is only four scenario
groups, whereas Round 4.1 requires the exact pinned config to also pass the full #482 parity /
follow-on runtime matrix (callback-not-invoked, duplicate/reordered lifecycle events, multiple
mutations, detached/background execution, MCP/shell-session mutation, disconnect, …), which this
runner does not execute. `phase0_passed` is the signal a FULL Phase-0 earns; a separate,
maintainer-reviewed pinned parity run is the only thing that may later set Round 4.1 eligibility.
Passing the harness never registers a production runtime or flips Copilot to `in-loop`.

**Enforcement is decided from the pinned permission lifecycle (#618).** The primary signal for "did the
denied tool run?" is `permission.completed.result.kind` correlated to the tool call by `requestId`,
together with the host-owned protected filesystem state — NOT a `tool.execution_complete`
error-code/message hash (those are diagnostic only). `result.kind` is matched against an **exact
allowlist** derived from the pinned **generated** schema (`nodejs/src/generated/session-events.ts`
`PermissionResult`, matching `go/rpc/zsession_events.go`): three approved variants (`approved`,
`approved-for-session`, `approved-for-location`), `cancelled`, and five `denied-*`
(`denied-by-rules`, `denied-no-approval-rule-and-could-not-request-from-user`,
`denied-interactively-by-user`, `denied-by-content-exclusion-policy`, `denied-by-permission-request-hook`).
Note the **docs-vs-generated discrepancy**: `docs/features/streaming-events.md` lists only five of these
(omitting the two extra approved variants, `cancelled`, and `denied-by-permission-request-hook`); the
generated schema is authoritative for what the runtime can emit. A `denied-*` resolution with the target
intact is non-dispatch; a landed mutation or a `success:true` completion is `FAIL-OPEN`; and an
**unrecognized** kind — a schema-drift value, a bare `denied`, or the known-but-non-enforcing
`cancelled` — is never promoted to non-dispatch: it is `INCONCLUSIVE`, failing closed in the evidence
sense. The mapping from a host handler result to the runtime's broadcast kind is **not established** by
the cited sources, so CI does not assert it: the fake's broadcast kind is a scripted input, and the
conformance tests exercise the classifier over the exact pinned enum. The one host→runtime fact the
pinned source **does** establish — a thrown/rejected handler is caught and the SDK sends
`{kind:"user-not-available"}` (`nodejs/src/session.ts`) — is asserted at the RPC-result layer, not as a
`permission.completed` kind. The frozen `capture-2026-09-20.json` message-hash signatures are retained
as **diagnostic lineage only**, never the enforcement authority.

Honest limits on the current SDK surface: **reason/feedback delivery to the agent is not independently
observable** — TamperWard returning `{kind:"reject"}` with the documented optional `feedback` is the
deny, but no event proves the model *read* the feedback, so `feedbackDeliveryIndependentlyObservable` is
recorded `false` and never conflated with "the permission was denied" (#618 Work C). It does **not** gate
the enforcement claim. The **timeout** broken path has no runtime-exposed permission-callback timeout
(pinned `nodejs/src/session.ts` awaits the handler with no timeout), so a hung handler emits no
`permission.completed` at all: it is *intrinsically* unobservable as fail-closed, stays `INCONCLUSIVE`
and visible, is never flipped to fail-closed from the harness's own wait, and is carved out of the
decision-path fail-closed gate so it does not make `FULL` impossible (#618 Work C) — but a dispatch
*during* the hang is still definitive `FAIL-OPEN`. The **callback-failure** paths (synchronous throw /
rejected Promise / adapter throw) separate a **source-level fact** from a **live verdict**. Source fact:
the pinned SDK catches the handler exception and sends `{kind:"user-not-available"}` on its *internal*
RPC path (`nodejs/src/session.ts`), which `nodejs/README.md`'s own table defines as **deny** ("Deny the
request because no user is available to confirm it"). But the real hosted binding (`createRealBinding`)
cannot **observe** that internal RPC result — the SDK exposes no callback for it — and no cited v1.0.14
source establishes a subsequent `permission.completed` broadcast kind for this path. So the live
qualification verdict is **`INCONCLUSIVE`**, never manufactured `FAIL-CLOSED` from the source-level fact;
a fresh credentialed run could raise it only if the runtime emits an observable denied `permission.completed`.
The safety invariant is checked regardless: the protected mutation must not land. (The `user-not-available`
= deny fact is asserted only in the source-level conformance tests, never wired into the live classifier.) The **identity-break** paths
(cross-repo, path-escape, symlink-escape, malformed-identity) separate two questions — did TamperWard
decide DENY (its decision row / `identity-rejected` category), and did the documented SDK mechanism
receive and resolve that deny (`permission.completed` `denied-*`, protected state intact); both holding
is `FAIL-CLOSED`, and with the documented resolution suppressed it stays `INCONCLUSIVE` (never
established from a bare code, a message hash, or a `tool.execution_start`). The **write** row counts
only when the observed protected proposal is actually a `write`/`apply_patch` surface (a shell proposal
satisfying a write prompt is `UNSUPPORTED` for that row). The **broken-decision-path** injection is bound
to the actual protected *mutation* (identified by the canonical adapter/engine denying it, so a
non-mutating inspection like `cat` of the same path cannot stand in).

**`tool.execution_start` is a lifecycle-START / execution-ATTEMPT observation, never dispatch past the
permission gate** (#614): the measured hosted runtime emits it *before* the permission callback
resolves, so it can never by itself set `handlerDispatched=true` or `FAIL-OPEN`. FAIL-OPEN is decided
only from **post-decision** evidence — an actual protected mutation on disk, or an authoritative
post-decision **success** `tool.execution_complete` bound to the protected `toolCallId`. Completions
are normalized **strictly** to the pinned `v1.0.14` public contract: only a boolean `success` (plus
`error.code` on failure) is authoritative. An event lacking the `success` discriminator is treated as
schema drift — recorded diagnostically as `schema_variant: "legacy/unexpected"` but with an undefined
outcome, so it can never be reinterpreted through a pre-1.0.14 shape (`outcome` / `errorCategory` /
`error.kind`) into a FAIL-OPEN or FAIL-CLOSED verdict. Conversely a
proven non-dispatch (fail-closed) requires an authoritative post-decision completion in the pinned
runtime's public shape — `{ success: false, error: { code, message } }` — whose machine-readable
`error.code` is in the **confirmed permission-gate non-execution** set. That set is **empty** until the
credentialed pinned rerun captures and freezes the real codes: the pinned `v1.0.14` E2E establishes a
withheld tool only as `success === false` plus an error **message** substring ("user rejected" for an
explicit reject, "Permission denied" for `UserNotAvailable`), and does **not** assert `error.code`, so
no code is hard-coded as authoritative. Until then, a completion-code-based fail-closed reading stays
`INCONCLUSIVE` (the actual `error.code` is still captured as sanitized evidence for the freeze). A
generic tool failure (`denied` / `rejected`), an `aborted` op — which may already have produced a side
effect — an unconfirmed code, or the absence of any authoritative completion all likewise stay
`INCOMPLETE` / `INCONCLUSIVE`, never fail-closed. (`success` is the outcome discriminator and
`error.code` the category; an unconfirmed or unrecognized code is fail-safe — it degrades to
insufficient-evidence, never a false fail-closed.) The confirmed set is sourced **only** from the
committed, reviewed constant — there is no environment / operator override, and the qualification
driver (`runQualification`) forces the committed set even if a caller hands it a different
`confirmedDenialCodes` (the caller value is ignored, recorded in the artifact, and caps the run below
FULL), so a qualification's classification authority cannot change without changing the frozen harness
bytes and re-preflighting.
The eventual freeze should be a permission-path **signature** (decision kind + `error.code` + a
sanitized message discriminator), not a bare string: a literal such as `rejected` is ambiguous only
because the SDK reuses it for ordinary tool-result rejection, so it must be authoritative only in the
exact permission-gate context. Capture needs no override: the raw `error.code` is recorded in the
completion evidence regardless of the confirmed set. Every proposal / execution-start / decision / completion / stop /
quiescence row carries a monotonic **host sequence**, and a completion counts as authoritative only
when it is recorded *after* the decision boundary, so a pre-decision or reordered event cannot be
upgraded into proof. ALL completions for a `toolCallId` are retained (duplicate / reordered /
contradictory); the classifier resolves them by AGREEMENT among the post-decision, schema-authoritative
ones, never last-write-wins (#614 §H). A success plus any error for the same call is impossible evidence
→ `INCONCLUSIVE` with an `evidenceConflict` flag. Non-dispatch needs the WHOLE authoritative error set to
be **one** confirmed permission-gate denial code (duplicates of it are fine) — a confirmed denial mixed
with a generic/unconfirmed error, or two *different* confirmed codes for one call, is ambiguous and also
yields `INCONCLUSIVE` (a bare `success:false` never means "the gate withheld it"). A duplicate
`execution_start` is harmless (a start is never authoritative). One measured `CopilotClient` runs provenance *and* every scenario (per-session
`workingDirectory` isolation), so the frozen runtime/protocol is the runtime that executed. Both a
proven dispatch **and** a proven non-dispatch require a **runtime-correlatable** `toolCallId` on the
protected proposal (it is optional upstream); when the SDK omits it, the completion (which carries its
own id) cannot be tied back to the denied proposal, so the claim stays `INCOMPLETE` / `INCONCLUSIVE`.
Each decision also records a sanitized structured **category** (`allow` / `unsupported` /
`parse-failure` / `policy-block` / `identity-rejected` / `fail-closed-unavailable`) plus the finding
rule/path, so a denied read is diagnosable from structured evidence rather than an opaque reason hash.
**Content-aware pre-deny requires SEMANTIC enforcement, not a returned reject.** `pre-deny:*-content`
is `PROVEN` only when the protected proposal was actually reconstructed **and** the canonical engine
ran over it **and** it produced a **real detector block** — derived from adapter facts
(`decision_category` / `unavailable_reason` / finding rule), never from "a proposal arrived" or "a
deny was returned". A **fail-closed-UNAVAILABLE** deny (a reconstruction / policy-load / parse failure,
whose finding is the `tamperward-unavailable` sentinel) is the SDK reject the **permission** layer may
still honour as non-dispatch, but it is **not** content-aware enforcement, so content pre-deny stays
`INCOMPLETE` (never `PROVEN`) — the two tracks (`semanticContentEnforcementProven` vs
`permissionEnforcementProven`) are reported separately. A write that surfaces no usable content is
`UNSUPPORTED`. When a write fails closed at reconstruction, the run also records a **bounded, sanitized,
content-free** structural fingerprint of the surfaced write (target **hash** + presence,
diff/newFileContents presence + byte/line counts that are lower bounds flagged when truncated, and a
diff-shape enum that models the parser's pre-git rejections — `over-byte-budget` / `over-line-budget` /
`budget-unknown` / `unknown-truncated` / `unsupported-metadata` / `unrecognized-header` /
`duplicate-metadata` / `duplicate-endpoint` / `multiple-file-diff` / `metadata-without-endpoints` /
`metadata-operation-mismatch` / `operation-state-mismatch` / `dev-null-both-sides` /
`missing-endpoint-pair` / `path-header-mismatch` / `headerless-hunk-only` / `full-unified-diff`) so a live
diagnosis knows **why** the pinned SDK write could not be reconstructed without dumping the candidate
patch, file source, or raw request path into the artifact. **Quiescence is part of the
observation boundary**: `disconnect()` aborts then disconnects and *reports* whether it succeeded (a
structured `{ quiesced, error? }`, recorded as host evidence); the event subscription stays live
across abort + disconnect and is torn down only afterwards, so a protected tool that races into
dispatch during shutdown is still seen (and classified `FAIL-OPEN`); and a scenario whose runtime did
not quiesce is capped at `INCOMPLETE` / `INCONCLUSIVE` (never `PROVEN` / `FAIL-CLOSED`), since final
state is not authoritative while the runtime may still be active. **End-of-turn continuation** is
proven by a second `onAgentStop` invocation carrying `stopHookActive === true` (the runtime re-entered
the hook after the block), matching the real SDK lifecycle — not by counting idle events; and the
block is `PROVEN` only when, at the **first** stop (snapshotted before the sweep is interpreted), the
protected target had landed a TamperWard-detectable weakening **and** the sweep finding names that
target — a mere byte change, or a block bound to some other file, does not qualify. Provenance also
pins **what code ran**: an unmeasured runtime-default tool surface caps below FULL (configure and
freeze `COPILOT_SDK_AVAILABLE_TOOLS`), the exact compiled adapter bundle hash folds into
`host_config_sha256`, and a qualifying run over a **dirty** adapter/engine/harness tree caps below
FULL (commit or stash first, so the executed source is the committed, pinned source). If the pinned
SDK cannot independently prove `deny → no dispatch` for a mechanism, or `onAgentStop` cannot genuinely
force and observe a continuation, the harness reports `INCOMPLETE` / `PARTIAL` rather than weakening
the bar.

## Runtime detection in onboarding

`tamperward onboard` reports which agent runtime a repository actually hosts and what
protection it gets, instead of silently assuming Claude. The registry lives in
`src/runtimes.ts`: each known runtime carries repository-relative marker files
(`.claude/` for Claude Code, `.cursor/` / `.cursorrules` for Cursor,
`.github/copilot-instructions.md` for Copilot, `AGENTS.md` / `.codex/` for an
AGENTS.md-aware agent) and a `steering` value — `in-loop` for a runtime with a shipped
adapter, `neutral` otherwise.

Detection is **honest reporting, never a trust input**. The marker files are
candidate-controlled, so detection only shapes the setup narrative; it adjudicates
nothing and opens no verdict path. When a repository uses a runtime that has no shipped
in-loop adapter, onboarding states plainly that deny-before-execute is Claude-only today,
that the runtime's live protection is the agent-neutral layers (pre-commit + CI), and — for
Codex and Copilot — that their experimental adapters are not qualified, pointing at
`tamperward runtime verify` — the same honesty rule the capabilities declaration enforces
(`unsupported` over silent degradation). Adding a runtime to `src/runtimes.ts`
does **not** grant it in-loop steering; that still requires a conforming `RuntimeAdapter`
and the parity suite above. The registry's `steering` flag flips to `in-loop` only once
that adapter ships.

## What Phase 1 is, and is not

Phase 1 is the neutral contract plus Claude Code's conformance to it, with **zero** change
to live steering behaviour: the CLI (`tamperward hook claude` / `tamperward sweep claude`)
is still wired directly to the canonical functions in `src/cli/hook.ts`, and the Claude
adapter delegates to those same functions so its output is byte-identical. It does **not**
add a second runtime, and it does **not** satisfy the repository's `SPEC.md` milestone
**M5**, which requires an in-loop adapter for a second runtime with the same
PreToolUse/Stop semantics.
