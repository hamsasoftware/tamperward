# CLI reference

Every command Tamperward ships, grouped by the enforcement surface it serves, with the
exact flags its parser reads. This page is the reference; the
[Quickstart](../guide/quickstart.md) and [Getting started](../guide/getting-started.md)
pages are the tutorial.

Since **2.13.1** malformed argv is rejected *before* the selected command touches git,
files, the verifier, or an agent: unknown options, missing values, invalid numeric
budgets, conflicting `check` views, duplicate flags, and stray positionals all return
**exit 2** with one `tamperward: …` diagnostic on stderr. Run `tamperward --help` for the
built-in summary.

Invocation is `npx tamperward <command>` (or `tamperward <command>` once installed). All
commands accept `--cwd <dir>`; every command that reads the working tree operates on the
**repository root** from any subdirectory — see
[the enforcement guide](../guide/enforcement.md#the-repository-root-from-any-subdirectory).

[[toc]]

## The gate: `check`

The core adjudicator over a diff. Choose **exactly one** view.

```bash
tamperward check --staged                  # pre-commit view (staged diff)
tamperward check --worktree                # working-tree view (Stop sweep)
tamperward check --diff "main...HEAD"      # commit-range view (CI authority)
```

| flag | meaning |
| --- | --- |
| `--staged` | Judge the staged diff. The pre-commit surface. |
| `--worktree` | Judge working-tree changes (untracked protected files included). |
| `--diff <base>...<head>` | Judge a commit range. The CI authority; reads policy from the base. |
| `--format <fmt>` | `text` · `json` · `github` · `auto` (default). See [Machine output](./machine-output.md). |
| `--json` | Alias for `--format json`. Cannot be combined with `--format`. |
| `--cwd <dir>` | Run as if from `<dir>`; the repository root is still used. |

Exactly one of `--staged` / `--worktree` / `--diff` is required; naming two is rejected.
Exit codes: **0** clean · **1** a blocking finding · **2** cannot evaluate (fails closed).

## The in-loop hooks: `hook`, `sweep`

The two Claude Code surfaces. They read the runtime's JSON payload on **stdin** and take
no flags; the agent name (`claude`) is the only argument.

```bash
tamperward hook claude     # PreToolUse: deny a weakening tool call before it runs
tamperward sweep claude    # Stop: re-scan the turn's working tree at end of turn
```

A deny is emitted as JSON on **stdout at exit 0** — exit 2 would make Claude Code ignore
the JSON and proceed, so these surfaces never exit non-zero for a finding. Exit 2 is
reserved for an unsupported agent name. `tamperward init` wires both into
`.claude/settings.json`. See [Runtime adapters](../guide/runtime-adapters.md) for the
vendor-neutral steering contract.

## The pristine-suite adjudicator: `verify`

Runs the suite twice in two separate copies of the working tree: as-is (the **visible**
run) and with every protected test, snapshot and config file restored from the trusted
base (the **pristine** run). Visible-green / pristine-red is a **masked failure** — the
move this tool exists to catch.

```bash
tamperward verify --base main
```

| flag | meaning |
| --- | --- |
| `--base <rev>` | Trusted base the agent cannot rewrite (default `HEAD`). Policy, verification surface and suite command are read from it. |
| `--cmd <command>` | Override the suite command for this run. |
| `--budget <seconds>` | Per-stage time budget (positive number). |
| `--json` | Emit one versioned `verify` verdict document; never falls back to prose. |
| `--keep` | Keep the two materialised copies and report their paths. |
| `--cargo-target-root <dir>` | Opt-in local-backend Cargo output cache outside the checkout. Sets distinct `<dir>/visible` and `<dir>/pristine` targets; never copies visible build output into pristine. Refused for isolated-container. |
| `--require-ancestor` | Refuse a `--base` that is not an ancestor of `HEAD` (fail closed rather than silently anchoring older). |
| `--cwd <dir>` | Run as if from `<dir>`. |

Verification reports the active stage on stderr immediately and every 30 seconds,
including elapsed time and captured output byte counts. Candidate output remains bounded
and buffered; it is never forwarded as live terminal or GitHub workflow syntax. JSON
stdout stays one verdict document. Nested silent verification emits no progress.

The Cargo cache option is operator configuration, not policy in the candidate tree.
Restore and save both stage directories separately in CI, retain dependency crates only,
and avoid caching workspace binaries or saving failed runs. The first run remains cold;
new lockfiles or toolchains can miss the cache. This is build-output reuse, not dependency
attestation or an artifact-integrity claim. It does not shorten or skip either suite.
Checkpointed-local candidate code runs with the caller's UID: separate paths prevent
accidental cross-stage reuse, but do not create an adversarial filesystem boundary.
Use fresh targets (omit this option and any inherited `CARGO_TARGET_DIR`) when persistent
build outputs are outside the operator's trust model. Container mode accepts no host
Cargo cache through this flag.

Verdicts: `VERIFIED`, `MASKED_FAILURE`, `SUITE_RED`, `BUDGET_EXCEEDED`, `CANNOT_VERIFY`.
Exit: **0** `VERIFIED` (or a `MASKED_FAILURE` cleared by an out-of-band
compact `tw1:<digest>` or legacy `verify@<full-sha>` approval) · **1** `MASKED_FAILURE` / `SUITE_RED` · **2**
`CANNOT_VERIFY`. Full envelope and reason enums: [Machine output](./machine-output.md).
Background: [Pristine verification](../guide/getting-started.md#pristine-verification-tamperward-verify).

## The enforcement envelope: `run` (Linux)

Wraps an agent invocation so its exit is untrusted: records the trusted base, runs the
agent, then re-adjudicates the tree it left — `check` over `base...HEAD`, `check` over the
worktree, and `verify` — with policy and verifier taken from the base. Requires an
explicit `--` before the wrapped command.

```bash
tamperward run --base main -- claude -p "fix the failing test"
```

| flag | meaning |
| --- | --- |
| `--base <rev>` | Trusted base recorded before the agent starts. |
| `--cmd <command>` | Suite command for the verify stage. |
| `--budget <seconds>` | Per verifier suite budget. |
| `--agent-budget <seconds>` | Bound the wrapped agent's wall-clock; still adjudicates after a timeout. |
| `--observe-transients` | Start a session-scoped transient observer and report temporal evidence/health. |
| `--allow-dirty` | Permit a dirty start tree (otherwise fails closed). |
| `--allow-dep-drift` | Explicitly accept an agent that rewrote the installed dependency tree. |
| `--settle <seconds>` | Wait before the final quiescence check to catch a background worker. |
| `--json` | Emit one final versioned `run` verdict document after adjudication. |
| `--cwd <dir>` | Run as if from `<dir>`. |

Exit: the **agent's own code** when enforcement is clean (a non-zero agent exit is passed
through) · **1** any blocking finding or masked failure · **2** cannot adjudicate (dirty
start, policy error, verify cannot run) · **124** `AGENT_TIMEOUT` — `--agent-budget`
expired and post-timeout enforcement was clean. The container verifier is intentionally
**not** available through `run`. Verdicts: [Machine output](./machine-output.md#run-json).

## Setup: `onboard`, `init`, `doctor`

### `onboard`

The guided first run: preflight, an init plan with confirmation before any write, verifier
acceptance, the first `verify` explained, an optional demo on a disposable worktree, and a
`doctor` posture at the end.

```bash
tamperward onboard
```

| flag | meaning |
| --- | --- |
| `--cwd <dir>` | Repository directory (must be the git root). |
| `--base <rev>` | Trusted base for the first verify / demo. |
| `--repo <owner/repo>` | Repository slug for the GitHub-authority check. |
| `--branch <name>` | Protected branch to inspect. |
| `--verify-command "<cmd>"` | Configure the trusted suite command (the only way to set it in scripted mode). |
| `--demo` / `--skip-demo` | Force or skip the disposable-worktree demonstration (mutually exclusive). |
| `--no-github` | Skip the GitHub-authority section. |
| `--yes` | Apply the local setup without prompts (non-interactive). |

Exit: **0** `READY` / `READY WITH WARNINGS` · **1** `BROKEN` / `INCOMPLETE` · **2** refused
or aborted.

### `init`

The deterministic, idempotent primitive `onboard` drives: wires the policy file, Claude
Code hooks, pre-commit, CI, and CODEOWNERS. Never overwrites files you wrote.

```bash
tamperward init --dry-run     # print the plan and exit
```

| flag | meaning |
| --- | --- |
| `--dry-run` | Print the plan without writing. |
| `--force-workflow` | Replace a workflow `init` did not write, or one you edited. |
| `--cwd <dir>` | Repository directory. |

Exit: **0** wired (or already wired) · **2** an item needs attention (e.g. a symlink where
a file was expected). What each item wires is detailed in
[Getting started](../guide/getting-started.md).

### `doctor`

Read-only installation + authority posture, and validation of the CI verifier's
outer-time envelope against the trusted policy.

```bash
tamperward doctor
tamperward doctor --github --repo owner/repo --branch main
```

| flag | meaning |
| --- | --- |
| `--base <rev>` | Trusted policy revision to validate against. |
| `--workflow <path>` | Validate a custom workflow's time envelope. |
| `--github` | Also validate live repository authority (required check, Code Owner review, stale-review dismissal). |
| `--repo <owner/repo>` | Repository slug for `--github`. |
| `--branch <name>` | Protected branch for `--github`. |
| `--json` | Emit the `doctor` document. |
| `--cwd <dir>` | Repository directory. |

Postures: `READY`, `READY WITH WARNINGS`, `INCOMPLETE`, `BROKEN`. Set `GH_TOKEN` /
`GITHUB_TOKEN` when GitHub requires authentication.
Doctor and onboard also show readiness for static checking, local verification,
container verification, Linux run lifecycle and protected CI. In `doctor --json`,
the additive `capabilities` array uses `AVAILABLE`, `BLOCKED` or `UNVERIFIED` and
provides a next action for each. `UNVERIFIED` means doctor did not perform that
command's authority preflight: a configured container image is not proof that
Docker and its pinned image are available, and local CI wiring without `--github`
does not certify branch protection. The global `authoritative` value keeps its
existing meaning: any BROKEN check leaves it false even when a narrower command
such as static `check` remains usable. Each command still enforces its own
preflight at execution time.

## Verification posture: `status`

One continuous answer to the question no exit code alone answers: **is the exact
candidate state I am looking at still the state that was independently verified?**
`status` reports three **distinct lanes**, never collapsed into one number:

- **Authority** — repository/final-adjudication posture (the same posture `doctor`
  derives): `ACTIVE` / `PARTIAL` / `BROKEN` / `UNKNOWN`.
- **Intervention** — runtime steering capability, i.e. whether the in-loop
  PreToolUse hook is wired: `ACTIVE` / `PARTIAL` / `INACTIVE` / `UNKNOWN`.
- **Verification** — whether the last successful `verify` still applies to the
  exact current state, as a first-class state machine.

```bash
tamperward status
tamperward status --json
```

```text
TamperWard

Authority     ACTIVE
Intervention  PARTIAL
Verification  CURRENT

Verified tree  8ef12c1...
Base           HEAD@8ef12c1a...
Verifier       npm test
Runtime        claude-code
```

After a change, the state names *why* it is no longer current:

```text
Verification  STALE

Reason  candidate tree changed since verification
```

**Verification states:**

| state | meaning |
| --- | --- |
| `CURRENT` | Every load-bearing input still matches the last successful verification. |
| `STALE` | A load-bearing input changed since that verification; `changed_input` names the first one. |
| `VERIFYING` | A verification is in progress (a live process holds the marker). |
| `BROKEN` | The recorded authority wiring can no longer be evaluated (e.g. an invalid policy). |
| `UNVERIFIED` | No applicable successful verification exists. |

`CURRENT` is bound to stable fingerprints of the inputs that actually matter: the
candidate worktree (`tree`), HEAD (`head`), the trusted base commit (`base`), the
TamperWard policy (`policy`), the verifier contract — command, budget, inputs and
backend (`verifier`), the protected verification surface at the base (`surface`),
the local runtime steering wiring (`intervention`), and the dependency environment
(`dependencies`) — the attested dependency fingerprint `verify` refuses
`DEPENDENCY_DRIFT` against, or the digest-pinned image for a container backend, so
an `npm install` of a different version with an unchanged tree is caught. A mere
exit-0 never keeps `CURRENT`: change any bound input and the state becomes `STALE`.
A later `verify` of the same state that does not reach `VERIFIED` (a flaky red
suite, a masked failure) invalidates the record, so `status` reports `UNVERIFIED`
rather than a stale `CURRENT`.

State is persisted under `.git/tamperward/` — a **non-candidate authority**, never
the tracked, candidate-writable tree — and bound to hashes rather than mutable path
names. A malformed or missing record fails safe to `UNVERIFIED`, never `CURRENT`.
The store is written through a temp file and a rename and read only as regular files:
a link, a hard link, a FIFO, a device or a directory standing at a record's path is never
followed, written through or waited on — `verify` replaces a link, a hard link or a FIFO
with the record itself (a directory fails the write, as any write failure does), and
`status` reports `UNVERIFIED` naming the entry. The directory itself, `.git/tamperward/`,
is accepted only as a directory of its own: a link there is refused by name by every
command that keeps state under it.
Local `CURRENT` is **posture/evidence, not repository or CI merge authority**.

| flag | meaning |
| --- | --- |
| `--json` | Emit the versioned `status` document (for editors, CI job summaries and dashboards). |
| `--cwd <dir>` | Repository directory. |

The `--json` form is the stable consumer contract — see
[Machine output](./machine-output.md#status-json). Consumers read the enumerated
state; they never reconstruct security posture by scraping `doctor` / `verify` prose.

## Verification receipts: `receipt export`, `receipt reconcile`

A **local verification receipt** is a bounded, transportable projection of the
verification state (above): a successful `verify` writes one to
`.git/tamperward/verification-receipt.json`, bound to the *same* load-bearing
identity — candidate `tree`, `head`, `base`, `policy`, `verifier`, `surface`,
`intervention` and `dependencies` — plus per-stage results and an `evidence_digest`
over its own fields. It carries only fixed-width digests, commit ids, closed-enum
stage results, a verdict and a timestamp: **no** prompt text, source, command
bodies, secrets/environment, absolute local paths or logs.

The receipt is **evidence, not authority.** CI reruns the canonical TamperWard
verification itself and computes its own verdict; the receipt only makes the
agreement or divergence between the local claim and CI explicit. A stale,
mismatched, malformed, tampered, missing or unknown-schema receipt can **never**
promote or strengthen a CI result.

```bash
tamperward receipt export --out receipt.json      # explicit transport handoff
tamperward receipt reconcile --base main --json    # CI: rerun verify, then reconcile
```

`receipt export` writes the receipt for the **CURRENT** verified state (it refuses
when the state is not `CURRENT`, so it never vouches for a state that is not still
verified). The exported machine output **is** the `receipt-v1` document — written
to `--out`, or to stdout when no path is given; there is no separate `--json`
envelope. Raw evidence otherwise stays under `.git/tamperward/`, never in the
tracked tree — transport it explicitly.

### What matches across machines, and what does not

A receipt is produced on one machine (a developer's checkout) and reconciled on
another (a CI runner). The binding splits into two parts:

- the **candidate identity** — `tree`, `head`, `base`, `policy`, `verifier`,
  `surface` — is reproducible from the same commit and the same trusted base on
  any machine. It is **authoritative for applicability**: if any of these differs
  from the identity CI recomputes, the receipt describes another state and is
  `NON_APPLICABLE`.
- the **environment inputs** — `intervention` (the local agent-hook wiring, e.g.
  `~/.claude/settings.json`) and `dependencies` (the local backend's discovered
  dependency environment) — are irreducibly machine-local and are **expected** to
  differ between a developer and a runner. They are reported as **informational**
  divergence (`reconciliation.environment_divergence`) and never, on their own,
  make a receipt non-applicable.

So a genuine receipt applies in CI when its candidate identity matches. To produce
one CI can apply:

```bash
# On the branch tip you are proposing (the commit the PR's head points at):
tamperward verify --base "$PR_BASE"          # reach VERIFIED, recording the state
tamperward receipt export --out receipt.json  # bounded receipt for that exact tip
```

The generated CI workflow computes CI's candidate identity from
`pull_request.head.sha` (the branch tip), **not** the PR merge ref, so `head` and
`tree` line up with a receipt bound to that tip. (The enforcement `verify` step
still runs over the merge result — the receipt only reports agreement; it never
changes CI's verdict or exit code.)

**When the branch is behind its base**, the merge result differs from the tip, so
CI's verdict is about a tree the receipt does not describe. The reconcile detects
this — `verify --json` reports the tree it `adjudicated`, and reconcile compares it
to the receipt's tree — and reports `NON_APPLICABLE` (`mismatched_input: tree`)
rather than attributing CI's verdict to the tip. Bring the branch up to date to
reconcile.

**Transporting the receipt is the workflow owner's job — the generated workflow
does not do it.** In a `pull_request` run there is no earlier artifact to download
(artifacts are uploaded by jobs of the *same* run), and the generated workflow sets
no `TAMPERWARD_RECEIPT` and adds no fetch step. So **as shipped, every run reports
`NO_CLAIM`** and CI's own verdict stands — until you wire a transport that carries
the developer's receipt to the reconcile step. Two realizable transports, both safe
because the receipt self-validates and never becomes CI's authority:

- **A git ref on the head repository.** From the developer's tip, push the receipt's
  bytes to a ref keyed by the head sha, then fetch and read it in CI. A ref outside
  `refs/heads` may point directly at a blob, so push the blob itself — `FETCH_HEAD`
  is then that blob and CI reads it with `git cat-file blob FETCH_HEAD`:

  ```bash
  # developer, after `receipt export --out receipt.json`:
  blob=$(git hash-object -w receipt.json)
  git push origin "$blob:refs/tamperward/receipts/$(git rev-parse HEAD)"
  ```

  ```yaml
  # CI, before the reconcile step:
  - run: |
      sha="${{ github.event.pull_request.head.sha }}"
      git fetch origin "refs/tamperward/receipts/$sha" && \
        git cat-file blob FETCH_HEAD > "$RUNNER_TEMP/receipt.json" && \
        echo "TAMPERWARD_RECEIPT=$RUNNER_TEMP/receipt.json" >> "$GITHUB_ENV"
  ```

  (If you prefer a commit-wrapped ref, build a one-file tree so the blob is inside it —
  `tree=$(printf '100644 blob %s\treceipt.json\n' "$blob" | git mktree)`,
  `git push origin "$(git commit-tree "$tree" -m receipt):refs/tamperward/receipts/$(git rev-parse HEAD)"` —
  and read it CI-side with `git cat-file blob FETCH_HEAD:receipt.json`.)

- **A PR comment read via the API.** Post the bounded receipt as a PR comment (it is
  small and non-sensitive) and have a CI step read it back with `gh api` / the REST
  API, writing it to a file and exporting `TAMPERWARD_RECEIPT`.

Either way the reconcile step picks the receipt up through `TAMPERWARD_RECEIPT` /
`--receipt`; a run with no receipt still reports `NO_CLAIM` and never fails on that
alone.

`receipt reconcile` reruns verification **first** (or consumes a preceding
`verify --json` via `--ci-result`), then reconciles a claimed receipt against CI's
own adjudication and prints three sections:

```text
LOCAL
  ✓ candidate 8ef12c1aaa locally verified
  ✓ pristine PASS
CI
  ✓ independently VERIFIED 8ef12c1aaa
RESULT
  VERIFIED
  Local and CI evidence agree
```

A divergence is first-class — a local `VERIFIED` claim over a red CI run reports
`DIVERGENCE` and **stays failed**:

```text
RESULT
  SUITE_RED
  EVIDENCE DIVERGENCE — local claim not confirmed by CI
```

| flag | meaning |
| --- | --- |
| `--receipt <file>` | The claimed local receipt. A local claim must be **explicit**: the receipt is read only from this flag, never from the local `.git/tamperward/` store (in CI that store holds the receipt this job's own `verify` just wrote). Absent → `NO_CLAIM` (never a failure by itself); unreadable/unparseable → `MALFORMED` (ignored as evidence). |
| `--ci-result <file>` | Consume a preceding `verify --json` document so the suite runs once, instead of rerunning verify. The file must be a genuine `verify --json` document (`schema_version: 1`, a resolved `base` commit, `visible`/`pristine` stage objects) whose `base` matches the base CI computed — anything else (including a receipt) is `CANNOT_VERIFY`, exit 2. |
| `--base <rev>` / `--cmd <c>` / `--budget <s>` / `--require-ancestor` | As for `verify` — how CI recomputes its own verdict and identity. |
| `--json` | Emit the versioned reconciliation document; see [Machine output](./machine-output.md#other-json-surfaces). |
| `--cwd <dir>` | Repository directory. |

Under GitHub Actions the same LOCAL / CI / RESULT report is written to the job
summary. The reconciled verdict — and the exit code — is **CI's own**, computed
from trusted inputs before the receipt is read; the receipt is only evidence.
The generated CI workflow (`tamperward init`) runs this as an evidence step after
its pristine `verify`; it transports no receipt on its own (see the transports
above), so set `TAMPERWARD_RECEIPT` from a fetch step you add to reconcile a
transported receipt. With none set the step reports `NO_CLAIM`.

## Runtime qualification: `runtime verify`, `runtime status`

Turn the binary "runtime detected" label into a **version-bound, operation-specific
capability model**. `runtime verify` reports what is *proven on this runtime/version/config*
today; `runtime status` renders the latest recorded qualification without rerunning it and
marks it **STALE** when a load-bearing input has changed.

```bash
tamperward runtime verify                       # qualify the detected in-loop runtime
tamperward runtime verify --runtime claude-code --json
tamperward runtime status                        # render the latest qualification (no rerun)
```

| flag | meaning |
| --- | --- |
| `--runtime <id>` | Adapter to qualify (`claude-code`, `codex`, `github-copilot-cli`, `github-copilot-sdk-hosted`; aliases `claude`, `copilot`, `copilot-sdk`). Defaults to the detected in-loop runtime, else `claude-code`. |
| `--mode headless\|interactive` | Execution mode the qualification is bound to (default `headless`). |
| `--model <id>` | Model/config relevant to tool routing, recorded in the binding. |
| `--json` | Emit the `runtime-qualification` document (`schemas/runtime-qualification-v1.schema.json`). |
| `--cwd <dir>` | Repository directory. |

### The capability model

Each capability carries **one explicit state** — never a percentage score:

| state | meaning |
| --- | --- |
| `PROVEN` | A **retained real-runtime probe** observed this capability holding under the reported binding (evidence source `committed-evidence`). A static adapter declaration alone **never** earns `PROVEN`. |
| `PARTIAL` | Declared/guaranteed at the adapter/contract boundary, but **no retained real-runtime probe** proves it holds live for this runtime/version/config. A full static `preDeny` declaration lands here. |
| `UNPROVEN` | No evidence either way — the conservative default. **Never read as "unsupported-safe".** |
| `UNSUPPORTED` | The adapter declares it does not provide this capability. |
| `FAIL-OPEN` | A declared failure mode lets the operation proceed. Surfaced verbatim; can never count toward FULL support. |
| `INCONCLUSIVE` | Evidence exists but does not resolve the state. |

Capabilities reported: `pre-deny:{shell,native-edit,delete,rename,git-mutation,mcp}`,
`post-observe`, `end-of-turn`, `denial-reason-delivery`, `continue-after-denial`,
`transport:{missing-executable,non-zero,timeout,malformed,empty}`, `hook-not-invoked`,
`detached/quiescence`. Every state cites its evidence source (`adapter-declaration`,
`adapter-unsupported`, `contract`, `committed-evidence`, `not-declared`), so a negative or
fail-open result is preserved, never hidden.

`In-loop protection` aggregates to `FULL` **only** when every required capability is `PROVEN`
with no `FAIL-OPEN`/`INCONCLUSIVE`; otherwise `PARTIAL` or `NONE`. `Final authority`
(CI / pristine `verify`) is a constant **AVAILABLE**: it is independent of the runtime hook,
so a weak in-loop capability never weakens adjudication. Steering and authority stay separate.

`PROVEN` is gated on retained real-runtime evidence matching the **full binding** (runtime name
+ exact version, hook-config hash, execution mode, platform, model, tested set); a mismatch on
any of those strips a capability back to its declaration's `PARTIAL`. The retained captures live
under `harness/adapters/**/evidence/` (see `src/adapters/evidence.ts`); absent a matching record,
a capability is honestly `PARTIAL`/`UNPROVEN` — **never** a fabricated `PROVEN`. This surface
grades against those committed captures rather than running a live credentialed probe here (those
are gated, #611/#616, under `npm run probe:*` / `spike:*`); it promotes no runtime and makes no
Round 4.1 eligibility claim.

### Binding and staleness

A qualification is bound to the inputs that make it interpretable: runtime name + exact
version, TamperWard version/commit, adapter capability hash, hook-config hash, execution mode,
platform, model, tested capability set, timestamp and a deterministic evidence id. The record
is stored git-locally (`.git/tamperward/runtime-qualification.json`, uncommitted; written
through a rename and read only as a regular file — anything else standing at that path is
reported as a rejected qualification, never rendered). If any
load-bearing input changes — a new runtime version, an edited hook config, a changed adapter,
a different platform or execution mode — `runtime status` reports the previous qualification as
**STALE** and points at `tamperward runtime verify`.
`tamperward onboard` reads the same record for every detected runtime that has a shipped
adapter and renders its aggregate, evidence id and staleness on its `QUALIFY` line without
rerunning anything; a record that fails validation is reported as unrecorded there too.

## Observation & audit: `watch`, `stats`

### `watch`

A filesystem-event observer daemon that records protected-file events so the Stop sweep
can observe supported transient effects. Runs until signalled.

```bash
tamperward watch --dir . --log .git/tamperward/fsevents.jsonl
```

| flag | meaning |
| --- | --- |
| `--dir <dir>` | Directory to observe. |
| `--log <file>` | Event-log path (also read via `TAMPERWARD_FSEVENTS`). |
| `--base <rev>` | Freeze observer policy to a trusted revision. |

### `stats`

Aggregate the privacy-safe hook/sweep audit events by rule and enforcement surface.

```bash
tamperward stats --since 30d --json
```

| flag | meaning |
| --- | --- |
| `--file <audit.jsonl>` | Explicit audit log (default: `.git/tamperward/audit.jsonl` or `TAMPERWARD_AUDIT_LOG`). |
| `--since <window>` | `30d` / `12h` / `90m` / an ISO time. |
| `--json` | Emit the aggregate `stats` document. |
| `--cwd <dir>` | Repository directory. |

The log is read only as a regular file: a link wherever it points, a FIFO, a directory or
any other entry standing at the path is refused by name with one line and exit 2, never
followed, waited on or summarised. Nothing at the default path is the empty summary, and
nothing at an explicit `--file` is `audit file not found`.

A finding is an integrity signal, not proof of intent. See
[Audit history & stats](../guide/audit.md).

## Sign-off: `allow`

Record a human sign-off in the local audit ledger, clearing a current blocking finding.

```bash
tamperward allow test-deletion --file test/calc.test.js --reason "intentional: moved to e2e"
```

| flag | meaning |
| --- | --- |
| `<rule>` | The rule id to sign off (positional, required). |
| `--reason "<why>"` | Required justification. |
| `--file <path>` | Scope the sign-off to a file. |
| `--cwd <dir>` | Repository directory. |

Exit **2** when there is no rule, no `--reason`, it is not a git repo, or there is no
current blocking finding to sign off. In CI the sign-off is **out-of-band** — a PR label
applied by a reviewer, never a file committed on the branch under review. See
[the sign-off model](../guide/enforcement.md#the-sign-off-model).

## Sign-off labels: `signoff-label`

Print a compact GitHub label bound to the exact rule, optional file, and full PR head SHA:

```bash
tamperward signoff-label --rule test-deletion --file test/calc.test.js --head "<pull-request-head-sha>"
```

The output is a `tw1:<digest>` label that fits GitHub's label-name limit. Use the PR's
head SHA (for example, `gh pr view <number> --json headRefOid -q .headRefOid`), not the
`GITHUB_SHA` merge commit from a pull-request workflow. It is valid only for the supplied
full head SHA and exact rule/file; regenerate it after every push. Existing
`tamperward:allow:<rule>@<head-sha>` labels remain compatible where the label transport can hold them.

## The persistent hook service: `hook-service` (opt-in)

One warm process per user and repository that evaluates hook/sweep requests over a private
unix socket, so each tool call skips Node + bundle startup. Hooks consult it **only** with
`TAMPERWARD_HOOK_SERVICE=1` in the runtime's environment, and fall back to in-process
evaluation (the same verdict) when it is absent, stale, another version, or its socket
fails the ownership/mode checks. Not available on Windows.

```bash
tamperward hook-service start --dir .    # foreground; runs until signalled
tamperward hook-service status
tamperward hook-service stop
```

| subcommand | flag | meaning |
| --- | --- | --- |
| `start` | `--dir <repo>` | Serve requests for this repository. |
| `status` | — | Report whether a service is listening. |
| `stop` | — | Stop the service (or report nothing to stop). |

See [the persistent hook service](../guide/enforcement.md#the-persistent-hook-service-opt-in-off-by-default).

## Advisory verifier-input discovery: `trace-verify` (Linux)

An **advisory**, non-mutating discovery tool for verifier inputs a command delegates to
that Tamperward cannot infer statically. It traces a trusted, known-good base with
`strace`, unions repeated runs, and suggests uncovered exact paths for a human to review
as `verify.inputs`. It never edits policy.

```bash
tamperward trace-verify --base main --cmd "npm test" --runs 3
```

| flag | meaning |
| --- | --- |
| `--base <rev>` | Trusted base to trace. |
| `--cmd <command>` | Suite command to observe. |
| `--budget <seconds>` | Per-run budget. |
| `--runs <N>` | Number of trace runs to union (positive integer, default 2). |
| `--json` | Emit the trace report as JSON. |
| `--cwd <dir>` | Repository directory. |

macOS and Windows report this mode unsupported and fail closed. Background:
[Discovering delegated verifier inputs](../guide/getting-started.md#discovering-delegated-verifier-inputs-tamperward-trace-verify).

## Model evaluation: `research`

Bring-your-own-model evaluation that runs each task ungated and under the `run` envelope
and observes both with `verify` + `check`. Two subcommands; the `run` subcommand takes an
explicit `--` before the agent command, like the top-level `run`.

```bash
tamperward research run --manifest tasks.yml --out ledger/ --adapter command -- ./my-agent.sh
tamperward research summarize --ledger ledger/
```

| subcommand | flags |
| --- | --- |
| `research run` | `--manifest <file>` · `--out <dir>` · `--adapter <name>` (all three required) · `--pairs <N>` · `--model <M>` · `--agent-budget <seconds>` · `--break-lock` · `--json` · then `-- <agent command…>` |
| `research summarize` | `--ledger <dir>` (required) |

Records are resumable by full experiment identity. A run exclusively locks its
`--out` directory; after verifying a crashed owner is gone, `--break-lock` is the
explicit stale-lock recovery. Active or unreadable locks fail closed. Flags and record schema:
[Research: evaluate a model](../guide/research.md#flags).

## See also

- [Machine output](./machine-output.md) — the `--json` envelopes, verdict/reason enums, and schemas.
- [Policy reference](./policy.md) — the full `.tamperward.yml` contract.
- [Exit codes](./exit-codes.md) — the single table for `0` / `1` / `2` / `124`.
- [Environment variables](../guide/environment.md) — every variable the gate reads.


## Completed suite admission: `attestation admit`

`attestation sign --schema-version 2 --payload F --evidence F --sha256 H --key K --out F`
accepts a protected-producer completed `verify --json` report and its trusted SHA-256.
It checks the actual candidate, policy, verifier, suite completion and explicit
exception before signing a bounded v2 statement. `attestation admit --statement F
--key K --expect F` requires a trusted Ed25519 public key and independently current
request scope. Exit 0 admits the exact `VERIFIED` outcome or explicitly expected
`MASKED_FAILURE` exception; exit 2 rejects incomplete, stale, mismatched or
unsupported evidence. The supported assurance is only `suite-exit-only`, with
candidate code executing inside the suite process. A fresh request nonce prevents
cross-request replay; atomic one-use consumption belongs to the protected admission
transaction. V1 signing and verification remain the default. See the
[admission consumer contract](../guide/admission-consumer.md).
