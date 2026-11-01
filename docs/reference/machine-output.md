# Machine output

Tamperward's machine surfaces are the integration contract for CI and other tools: the
`--json` verdict envelopes, the `--format github` annotations, the verdict and reason
enums, and the published JSON Schemas. This page is the reference; to wire it into a
pipeline see [Integrate](../integrate.md).

From **2.19.0** the public JSON verdict surfaces are **versioned independently of the npm
package version**. Every document carries a top-level `"schema_version": 1`. Schema major
**1** is deliberately additive: **consumers must ignore fields they do not understand**,
and new evidence/diagnostic fields ship without a bump. Removing or renaming a required
field, changing its type, or changing a discriminator's meaning requires
`schema_version: 2` and new `*-v2.schema.json` files; the v1 files stay published.

The JSON schemas describe **data shape**, not process status — exit codes are a separate
public protocol, documented on [Exit codes](./exit-codes.md).

Every published v1 schema carries a canonical `$id` at an immutable release-tag URL,
`https://raw.githubusercontent.com/hexrift/tamperward/<tag>/schemas/<schema>-v1.schema.json`,
where `<tag>` is the release that first shipped those exact bytes. A schema keeps its
identifier across later releases until its bytes change, and then it ships under the
next release tag. The release workflow creates each tag only after publishing the exact
commit, then fetches every advertised URL over HTTPS and compares the returned bytes
with the shipped schema files; the offline schema test enforces the same rule against
the local tags. Mutable branch refs and self-referential commit pins are not canonical
identifiers.

[[toc]]

## Choosing a format: `--format` / `--json`

`check` renders in one of four formats; `--json` is an alias for `--format json`.

| format | where it goes |
| --- | --- |
| `text` | The terminal. Blocking findings first, then by file and line. Severity is always spelled out (`BLOCK` / `warn`), never carried by colour alone; honours `NO_COLOR` / `FORCE_COLOR`. |
| `github` | One inline annotation per finding — on the line in *Files changed* — plus a job-summary table on the run page. The full text output still goes to the log. |
| `json` | The versioned machine document (below). |
| `auto` | `github` when `GITHUB_ACTIONS=true`, otherwise `text` — so CI wiring stays one line. |

`--json` cannot be combined with `--format`. `verify`, `run`, `doctor`, `stats`,
`status` and `research` accept `--json` and emit their own documents.

## `check --json`

A findings document plus a scan summary.

```json
{
  "schema_version": 1,
  "findings": [
    {
      "rule": "test-deletion",
      "severity": "block",
      "file": "test/calc.test.js",
      "line": 12,
      "message": "Test blocks removed: 3 → 1 it()/test() in this spec.",
      "evidence": "2 test block(s) removed from test/calc.test.js",
      "remediation": "Keep the assertions and fix the code.",
      "signoff": { "required": true, "command": "tamperward allow test-deletion --file test/calc.test.js --reason \"...\"" }
    }
  ],
  "scanned": ["test/calc.test.js"],
  "ignoredFiles": [],
  "summary": { "block": 1, "warn": 0 }
}
```

| field | type | notes |
| --- | --- | --- |
| `findings[]` | array | Each finding requires `rule`, `severity`, `message`, `evidence`, `remediation`, `signoff`. `file` and `line` are present when the finding is located. |
| `severity` | enum | `block` \| `warn`. Only `block` affects the exit code. |
| `signoff` | object | `required` (boolean) and `command` (the `tamperward allow …` line that clears it). |
| `scanned` | array | Files the gate read. |
| `ignoredFiles` | array | Files excluded by `ignore` globs. |
| `summary` | object | Counts by severity. |

Full contract: [`schemas/check-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/check-v1.schema.json).

## `verify --json`

`verify --json` never falls back to prose: it emits a document with an enumerated verdict
on every path, including a `CANNOT_VERIFY` document with a machine `reason` on every
fail-closed exit before a verdict exists.

**Verdicts** (`verdict`):

| verdict | meaning | exit |
| --- | --- | --- |
| `VERIFIED` | Visible green **and** pristine green. | 0 |
| `MASKED_FAILURE` | Visible green, pristine red — the masked failure. | 1 (0 under a compact `tw1:<digest>` or legacy `verify@<full-sha>` approval) |
| `SUITE_RED` | The visible suite itself failed. | 1 |
| `BUDGET_EXCEEDED` | A stage ran out of time budget. | 2 |
| `CANNOT_VERIFY` | Could not reach a verdict; `reason` says why. | 2 |

**`CANNOT_VERIFY` reasons** (`reason`), with `stage` (`visible` \| `pristine`) naming the
suite execution in flight where one was:

`INVALID_ARGUMENTS`, `POLICY_ERROR`, `BASE_NOT_ANCESTOR`, `NO_SUITE_COMMAND`,
`VERIFIER_BACKEND_UNAVAILABLE`, `LOCAL_VERIFIER_UNSUPPORTED_PLATFORM`,
`DEPENDENCY_ENVIRONMENT_UNATTESTABLE`, `BASE_UNRESOLVABLE`, `DEPENDENCY_DRIFT`,
`MATERIALIZATION_FAILED`, `VERIFIER_BACKEND_RUNTIME_FAILURE`, `VERIFIER_RESOURCE_EXHAUSTED`,
`WORKTREE_CHANGED`, `PRISTINE_INTEGRITY_CHANGED`, `PATH_CASE_COLLISION`.

When `reason` is `MATERIALIZATION_FAILED`, the additive `materialization_reason` field
identifies the confirmed failure class: `TRACKED_NODE_MODULES_CONFLICT`,
`SYMLINK_ESCAPE`, `SPECIAL_FILE`, `RACING_DELETION`, or `UNKNOWN`. It is omitted for
other reasons and does not change the top-level fail-closed reason or exit code.

A resolved (non-`CANNOT_VERIFY`) document also carries `base`, `command`, `budget_secs`,
the `visible` and `pristine` stage records (`exit`, `secs`), `protected_restored`,
`added_protected_removed`, the `verifier_backend` (`kind` local \| container, `trust`,
`available`, digest-pinned `image` for a container), the `dependency_environment` status,
and an `oracle_assurance` block (level `suite-exit-only`). It also carries the optional
`adjudicated_tree` — the fingerprint of the candidate tree this run actually adjudicated
(the same identity bound into the local record). In a `pull_request` run the enforcement
verify runs over the merge result, so `adjudicated_tree` can differ from the branch-tip
tree a receipt binds; `receipt reconcile` compares the two and reports `NON_APPLICABLE`
when they differ rather than attribute CI's verdict to a tree it never ran. It is absent
on documents produced before the field existed. Full contract:
[`schemas/verify-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/verify-v1.schema.json).

## `run --json`

`run --json` owns stdout after the wrapped agent starts and emits **one** final envelope
document after adjudication.

**Verdicts** (`verdict`): `VERIFIED`, `AGENT_TIMEOUT`, `AGENT_FAILED`,
`ENFORCEMENT_FAILED`, `CANNOT_ADJUDICATE`, `OBJECT_REWRITE`, `HISTORY_REWRITE`,
`DEPENDENCY_DRIFT`, `NOT_QUIESCENT`, `TRANSIENT_OBSERVER_BLOCK`.

**`CANNOT_ADJUDICATE` reasons**: `AGENT_LIFECYCLE_NOT_OWNED`, `VERIFY_CANNOT_VERIFY`,
`CHECK_DIFF_UNJUDGEABLE`, `CHECK_WORKTREE_UNJUDGEABLE`.

Full contract:
[`schemas/run-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/run-v1.schema.json).

## `status --json`

The stable consumer contract for verification posture (#600): the #500 VS Code
status bar/panel, WardOS, CI job summaries and future dashboards read the
enumerated state instead of scraping `doctor` / `verify` prose. Three distinct
lanes are always present.

```json
{
  "schema_version": 1,
  "command": "status",
  "authority": { "state": "ACTIVE" },
  "intervention": { "state": "PARTIAL", "detail": "PreToolUse hook wired" },
  "verification": {
    "state": "CURRENT",
    "verified_at": "2026-09-23T12:00:00.000Z",
    "base": "8ef12c1a...",
    "head": "8ef12c1a...",
    "verifier_command": "npm test",
    "tree": "0123abcd...",
    "binding": {
      "tree": "0123abcd...", "head": "8ef12c1a...", "base": "8ef12c1a...",
      "policy": "…", "verifier": "…", "surface": "…", "intervention": "…"
    }
  },
  "runtime": { "agent": "claude-code" }
}
```

| lane | states | meaning |
| --- | --- | --- |
| `authority.state` | `ACTIVE` \| `PARTIAL` \| `BROKEN` \| `UNKNOWN` | Repository/final-adjudication posture (from `doctor`). |
| `intervention.state` | `ACTIVE` \| `PARTIAL` \| `INACTIVE` \| `UNKNOWN` | Runtime steering capability (is the in-loop hook wired?). |
| `verification.state` | `CURRENT` \| `STALE` \| `VERIFYING` \| `BROKEN` \| `UNVERIFIED` | Whether the last successful verify still applies to the exact current state. |

A `STALE` verification carries `changed_input` — the first load-bearing input that
changed — one of `tree`, `head`, `base`, `policy`, `verifier`, `surface`,
`intervention`. When a record exists the document also carries `verified_at`, the
recorded `binding` fingerprints, the live `base`/`head`, and the `verifier_command`.
Local `CURRENT` is posture/evidence, **not** repository or CI merge authority. Full
contract:
[`schemas/status-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/status-v1.schema.json).

## Other JSON surfaces

| command | document | schema |
| --- | --- | --- |
| `doctor --json` | Installation + authority posture. | [`schemas/doctor-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/doctor-v1.schema.json) |
| `research run --json` / `research summarize` | Paired records and the aggregate summary (from **2.23.0**). | [`schemas/research-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/research-v1.schema.json) |
| `stats --json` | Aggregate audit document. | [`schemas/stats-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/stats-v1.schema.json) |
| `runtime verify --json` / `runtime status --json` | Version-bound, operation-specific runtime capability qualification (from **2.37.0**). | [`schemas/runtime-qualification-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/runtime-qualification-v1.schema.json) |
| `verify` (on VERIFIED) / `receipt export` | Bounded, transportable **local verification receipt** bound to #600's identity (from **2.38.0**). Evidence, not authority. | [`schemas/receipt-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/receipt-v1.schema.json) |
| `receipt reconcile --json` | CI reconciliation of a claimed receipt against CI's own rerun of verification; the `result` is always CI's verdict — a receipt can never promote it (from **2.38.0**). | [`schemas/reconcile-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/reconcile-v1.schema.json) |

The `runtime-qualification` document reports **one explicit state per capability**
(`PROVEN` \| `PARTIAL` \| `UNPROVEN` \| `UNSUPPORTED` \| `FAIL-OPEN` \| `INCONCLUSIVE`) with
its evidence source — never a percentage score. `in_loop_protection` is `FULL` only when every
required capability is `PROVEN` with no `FAIL-OPEN`/`INCONCLUSIVE`; `final_authority` is a
constant `AVAILABLE` (CI / pristine `verify` is independent of the runtime hook). The result is
bound to the runtime version, TamperWard version/commit, adapter capability hash, hook-config
hash, execution mode, platform, model, tested capability set and a deterministic evidence id;
`status` marks a stored qualification `stale` when any load-bearing input changed. See
[Runtime qualification](cli.md#runtime-qualification-runtime-verify-runtime-status).

## The audit event

The privacy-safe structured event written under `TAMPERWARD_AUDIT_LOG` (JSONL, one event
per line, from **2.26.0**). Only allowlisted metadata is serialised — prompts, command
bodies, source, evidence, filenames, absolute paths and environment values are **never**
recorded.

| field | type | notes |
| --- | --- | --- |
| `schema_version` | `1` | |
| `id` | string | `sha256:` + 32 hex — the event id (dedup key). |
| `timestamp` | string | ISO-8601 UTC. |
| `surface` | enum | `pretooluse` \| `stop`. |
| `agent` | string | Lowercase agent id. |
| `rule` | string | The rule id. |
| `severity` | enum | `block` \| `warn`. |
| `decision` | enum | `deny` \| `warn` (a `block` severity always pairs with `deny`). |
| `session` | string | Optional `sha256:` + 24 hex hashed session id. |

Full contract:
[`schemas/audit-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/audit-v1.schema.json).
See [Audit history & stats](../guide/audit.md) for how to enable and read it.

## Consuming machine output

A program should key on **`verdict`** (or, for `check`, the presence of a `block` finding)
and treat the **exit code** as the authoritative pass/fail — the two agree, and the exit
code is the contract even when a document is truncated. Because major 1 is additive, parse
defensively and ignore unknown fields. A worked CI example is on
[Integrate](../integrate.md#consuming-machine-output).


Completed `verify-v1` adjudications may include `evidence_binding`, containing the
actual `head`, `base`, `tree`, `gate_version`, `policy_hash`, `verifier_hash`,
`completed: true` and `integrity: "CLEAN"`. The field is absent for incomplete
verification and does not authenticate an unsigned producer. `receipt-v1` and
`reconcile-v1` add `oracle_assurance` with the same `suite-exit-only` report and
residual as `verify-v1`; older receipts remain readable. The receipt's existing
evidence digest retains its original identity/stage encoding.
