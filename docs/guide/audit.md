# Audit history and `tamperward stats`

TamperWard can keep privacy-safe integrity findings from its Claude Code hooks and
opt-in verification and bare-suite timings. This is **measurement**, not enforcement:
failing to write an audit event never changes an allow/deny decision. The audit history
is never read as an authority input by `check`, `verify`, `run`, the hook, or CI.

This is useful for dogfooding questions such as:

- which rules fire most often while agents work;
- whether findings are coming from PreToolUse or the Stop sweep;
- how the mix changes over time;
- how much enforcement activity a repository actually sees.

A finding is **not proof of intent**. Legitimate refactors can trip an integrity rule,
and a count of findings must not be described as a count of deliberate weakening
attempts.

## Enable the structured local audit

Set `TAMPERWARD_AUDIT_LOG` in the environment Claude Code inherits:

```bash
export TAMPERWARD_AUDIT_LOG=auto
```

`auto` writes to the repository's Git directory:

```text
.git/tamperward/audit.jsonl
```

For linked worktrees it uses that worktree's actual Git directory rather than assuming
`.git` is a directory. An explicit file path is also accepted.

The v1 event is intentionally small:

```json
{
  "schema_version": 1,
  "id": "sha256:…",
  "timestamp": "2026-09-14T14:52:11.000Z",
  "surface": "pretooluse",
  "agent": "claude-code",
  "rule": "test-skip",
  "severity": "block",
  "decision": "deny",
  "session": "sha256:…"
}
```

Four optional measures may ride on an event (2.40.0), the instrument SPEC §9.1 M3 asks
for: `hook_latency_ms` (whole milliseconds from the hook reading its input to the deny
being written; the PreToolUse and Stop hooks record it on every deny they log),
`verify_wall_clock_ms` and `bare_suite_wall_clock_ms` (a `verify` run and the same suite
without TamperWard, for a producer that measures both), and `oob_signoff` (whether an
out-of-band sign-off was needed to clear the finding). Absent means unmeasured. These
older finding-attached fields remain accepted; automatic verification and bare-suite
measurements use the separate sidecar described below (2.44.0).

The writer is allowlist-only. It does **not** serialise prompts, tool command bodies,
source/evidence text, filenames, absolute paths, environment values, credentials, or
the raw Claude session id. The session identifier is one-way hashed before it leaves
the hook.

The published event schema is
[`schemas/audit-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/audit-v1.schema.json).
The `stats --json` aggregate has its own
[`schemas/stats-v1.schema.json`](https://github.com/hexrift/tamperward/blob/main/schemas/stats-v1.schema.json).

### Verification and bare-suite measurements

With audit enabled, `verify` records its whole lifecycle duration and actual verdict in
`<audit-path>.measurements`, including verification nested in `run`. With `auto`, this is
`.git/tamperward/audit.jsonl.measurements` (using the actual Git directory for a worktree).
An explicitly requested bare-suite comparator writes to the same sidecar:

```bash
TAMPERWARD_AUDIT_LOG=auto tamperward measure-suite --cmd 'npm test' --budget 300
```

This runs the command in the **live checkout** and may create normal suite outputs. It
measures process supervision without verification/materialization or fingerprint-check
costs; it neither verifies nor approves the candidate. Use the same suite command,
checkout and machine as the verification sample. Pair only identical non-missing
`comparison` hashes, control dependencies and run order/cache effects, and retain the
outcomes beside the timings. Unpaired percentiles are not an overhead ratio.

The strict [measurement-v1 schema](https://github.com/hexrift/tamperward/blob/main/schemas/measurement-v1.schema.json)
records a random id, timestamp, kind, outcome and duration, with optional comparison hash
and actual sign-off use. It retains no raw command, path, machine name or approval token.
Incomplete samples are reported separately and excluded from timing percentiles; missing
sign-off data is not evidence that no sign-off was used. Local measurements are mutable,
non-authoritative evidence. Audit opt-out writes no sidecar, and a refused write does not
change the command's verdict.

For a consented deployment, follow the [production pilot protocol](../research/pilot-protocol.md)
for exposure counts, independent false-positive adjudication, controlled timing and
publication permission. The measurement producers do not supply participant consent or
constitute a production-pilot result.

### The older deny log

`TAMPERWARD_DENYLOG` remains supported for harness compatibility. It is a compact,
best-effort rule-id trace and some warning records can contain filenames or diagnostic
detail. Do **not** upload a deny log to the public GitHub audit store.

Both logs are appended only as regular files with one name. A link, a hard link, a FIFO,
a socket, a device or a directory standing at either path is refused and the line
dropped: the hook never follows the link, never writes into a file that has another
name, and never waits for a reader, and the verdict it is about to return does not
depend on the write.

`stats` reads the audit log the same way, only as a regular file: a link wherever it
points, a FIFO, a directory or any other entry standing at the path is refused by name
with one line and exit 2, never followed, waited on or summarised. Nothing at the default
path is the empty summary; a file with more than one name is read, since a read has
nothing to redirect.

Use `TAMPERWARD_AUDIT_LOG` for durable statistics.

## Read the statistics

From the repository:

```bash
npx tamperward stats
npx tamperward stats --since 30d
npx tamperward stats --since 12h
npx tamperward stats --json
```

By default `stats` reads the auto audit path and its `.measurements` sidecar. Use
`--file` for an exported or downloaded JSONL file; keep its sidecar beside it with
the same `.measurements` suffix:

```bash
npx tamperward stats --file ./events.jsonl
```

The text view reports event, block, warning and hashed-session counts, followed by
counts by rule and enforcement surface, then measured hook/verify/bare-suite durations:
nearest-rank p50, p95 and max with sample counts, plus out-of-band sign-off counts.
Completed sidecar samples join the timing histograms; incomplete samples stay out.
Sidecar invocation/incomplete/sign-off counts appear separately under `measurements`
in JSON and never increase finding or session counts. The finding-only GitHub publisher
does not automatically ingest measurement sidecars. `--json` emits the same deterministic
aggregate as one JSON document (`latency` is null per measure when nothing was measured).
The file is read in one pass, one line at a time,
so an audit log of any length costs memory only for the aggregate; a line longer
than 16 KiB is not an audit-v1 event and stops the command at exit 2.

`--since` accepts `m`, `h`, and `d` relative windows (`90m`, `12h`, `30d`)
or an ISO timestamp.

## Keep the durable history in GitHub

TamperWard itself ships
[`.github/workflows/tamperward-audit.yml`](https://github.com/hexrift/tamperward/blob/main/.github/workflows/tamperward-audit.yml).
The hook does **not** push anything to GitHub. Publishing goes through a pull
request, and GitHub Actions is the writer. The invariant is not "nothing
automatic ever writes the evidence branch" but: nothing unreviewed or
candidate-controlled may cause evidence to enter it — automation only ingests,
deterministically, what reached `main` through a PR. How strong "reviewed" is
depends on the repository's branch protection (a `CODEOWNERS` entry covers
`audit/` and the workflow, binding where "Require review from Code Owners" and a
minimum approval count are enabled); independently, committed batches are
validated pre-merge by CI and the write-capable job runs no candidate code (see
below). There are two entry points, both running only from the trusted copy on
`main`:

- an operator **dispatches** a validated batch by hand (`workflow_dispatch`), or
- a reviewed PR adds an **immutable** batch file
  `audit/pending/<batch-id>.jsonl` and, **on merge to `main`**, the workflow
  ingests any batch whose id/content hash is not already recorded.

There is deliberately no `pull_request` / `pull_request_target` trigger: an
untrusted fork PR must never run the workflow that writes the evidence branch.
The post-merge `push` fires only after a merge, is gated again by
`if: github.ref == 'refs/heads/main'`, and re-validates the schema before
touching the branch. A merge with no new batch is a clean no-op that never
touches the evidence branch and never even builds.

The workflow:

1. runs only from the copy committed on `main`, whether dispatched by hand or
   fired by a post-merge push;
2. hashes each committed batch and ingests only those whose id/content hash is
   not already in the ledger, so repeated runs are idempotent;
3. validates every new batch with TamperWard's strict audit-v1 parser, and fails
   closed if an already-ingested batch id reappears with changed content;
4. rejects unknown fields rather than trying to redact them after upload;
5. creates or updates a separate `tamperward-audit` branch;
6. deduplicates records by event id;
7. writes each new batch's events to their own immutable partition file,
   `events/<YYYY>/<MM>/<batch-id>.jsonl` (the month it was ingested), and records
   the batch in `ingested/batches.jsonl` with its source commit SHA, content hash,
   schema version, timestamp, partition path and stored-event count;
8. updates only the id and session index shards those events hash into
   (`ids/<ab>.jsonl` and `sessions/<ab>.txt`, 256 sorted shards each): an id
   already stored with identical content is skipped, one that reappears with
   different content fails the run;
9. folds the new events into `summaries/state.json` and regenerates
   `summaries/all-time.json` and a human-readable branch `README.md` from it.

The store grows by addition only. Adding one batch never reads or rewrites a
historical partition: the `prepare` job fetches the ledger alone (a blob-less
clone of the evidence branch with one file checked out), and the `publish` job
takes a sparse clone that holds the ledger, the shards and the summaries but no
partition. A store written before partitioning keeps its `events/all.jsonl`
frozen; the first ingestion after the upgrade streams it once to build the shards
and the state. Dispatching the workflow with `rebuild: true` regenerates every
derived file by streaming all partitions from a full checkout (a shard file the
partitions no longer account for is removed, so the index is exactly what the
partitions say); the publisher also rebuilds on its own whenever the derived
state disagrees with the ledger.

Hard limits, each an exit-2 refusal that names the limit: one event line is at
most 16 KiB, one batch at most 16 MiB and 50,000 events, and one month holds at
most 4,096 batch files. `tamperward stats` streams its file in one pass under the
same line bound, so its memory is set by the number of distinct rules, surfaces
and session hashes rather than by the file size.

The write credential is isolated: a read-only `prepare` job builds and computes
the append (no write token while `npm ci`/build/candidate code runs), and a
minimal `publish` job holds the write token but runs no `npm ci` and no candidate
code — only first-party actions, a dependency-free re-validation against the
committed schema, and `git`. Committed batches are additionally validated
pre-merge by the normal CI suite, so a malformed batch never reaches the
privileged job.

### On merge to `main` (the reviewed-batch path)

Add each set of events as an immutable `audit/pending/<batch-id>.jsonl` in a pull
request — review is the curation step — and merge. See
[`audit/README.md`](https://github.com/hexrift/tamperward/blob/main/audit/README.md).
Batches are immutable once merged: to correct evidence, add a new batch rather
than editing an old one. Ingestion never writes `main`; it only ever appends to
the dedicated `tamperward-audit` branch.

### By hand (the dispatch path)

A typical bounded upload is:

```bash
AUDIT="$(git rev-parse --absolute-git-dir)/tamperward/audit.jsonl"

# Validate locally first.
npx tamperward stats --file "$AUDIT" --json >/dev/null

# GitHub workflow inputs are bounded, so send a recent batch. Re-sending records is
# safe: the store deduplicates by audit event id.
gh workflow run tamperward-audit.yml --ref main \
  -f batch="$(tail -n 100 "$AUDIT")"
```

The dispatch candidate filename is `dispatch-${GITHUB_RUN_ID}.jsonl`. The run id is
unique for each logical workflow dispatch and remains stable when that same run is
retried, so two uploads at one `GITHUB_SHA` coexist while a retry remains
idempotent. The ledger records that `GITHUB_SHA` separately as `source_sha`, which
identifies the trusted repository revision that produced the upload; it is not the
batch identity.

Only submit the structured `TAMPERWARD_AUDIT_LOG`. Workflow-dispatch inputs become
GitHub data before the job can validate them, so the workflow cannot make an unsafe
input private after the fact.

The `tamperward-audit` branch is historical evidence only. It should be protected
from ordinary developer/agent pushes, but even an altered audit branch cannot clear a
finding, approve a PR, change a policy, or make an enforcement verdict green.

## Interpreting dogfooding numbers

Prefer wording such as:

> TamperWard raised 31 integrity findings in 84 recorded agent sessions.

Do not automatically rewrite that as:

> Agents tried to cheat 31 times.

To make claims about behaviour after a finding, correlate the audit events with a
separate, explicit outcome classification. The v1 audit deliberately does not infer
`honest correction`, `repeated weakening`, `abandoned`, `legitimate refactor`,
or `human sign-off` from timing alone.
