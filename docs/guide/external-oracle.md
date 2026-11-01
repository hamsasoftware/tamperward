# Independent JSON function oracle

`tamperward oracle` is an opt-in completion protocol for CommonJS `.cjs` functions
with JSON arguments/results. The trusted host compares responses against expected
values and counts completed assertions; candidate code runs in the existing isolated
Docker backend. Candidate `process.exit(0)` cannot skip the host comparisons and pass.
Expected values and the controller are never mounted into the candidate container.

This does not upgrade `verify` or arbitrary test frameworks: existing suites still
report `suite-exit-only`. Require both checks in protected CI when you need both
pristine verification and this independent oracle. A pass covers only the selected
JSON response cases, not exhaustive correctness or the candidate's internal execution.

## Plan and invocation

Create a regular JSON plan outside the repository, under operator control. Pin its
exact-byte SHA-256 in the protected launcher. Example shape:

```json
{
  "protocol": "node-json-rpc-v1",
  "image": "registry.example/node@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "budget_secs": 30,
  "cases": [
    { "module": "src/answer.cjs", "export": "answer", "args": [21], "expected": 42 }
  ]
}
```

Replace the illustrative digest with an independently trusted, locally available image
containing Node and the required dependencies. Immutable engine-client, fixed-daemon,
image-digest and resource checks are inherited from the container backend; there is
no automatic pull or host-execution fallback.

```sh
tamperward oracle --manifest /trusted/oracle.json --sha256 THE_EXACT_FILE_SHA256 --cwd /candidate
```

The controller snapshots tracked and non-ignored untracked files through the guarded
materializer, compares their content/type/mode with the source, and mounts the copy
read-only. It shares no host dependency tree, home, cache, network or Docker socket.
Dependencies belong in the pinned image. Ignored inputs are not copied; include
candidate build artifacts in the snapshot. Changed candidate head/content or
unsupported/unreadable/oversized files fail closed.
The snapshot filesystem must be case-sensitive; this profile refuses case-folded
materialization rather than silently changing module resolution.

The host, controller, kernel, engine and pinned image are trusted. Use a protected
CI host with no candidate-controlled host process still running: a container/kernel
escape or a compromised host is outside this guarantee. The external path and pin
do not secure the launcher themselves. Repository changes must not be able to replace
the plan/pin, required check or executing tool. No production assurance is inferred
from the repository tests.

## Completion and limits

Each case uses a fresh container. The worker requires the relative `.cjs` module,
selects an own named function export (or `default` for `module.exports = function`),
and calls it with the argument array; async results are supported. It emits exactly
one JSON object with `protocol`, the host's fresh `nonce`, and `value`. The nonce is
correlation, not a secret or signature. The candidate controls its response and may
interpose on the worker. A fabricated correct response is observationally correct
for this finite black-box contract, not proof of execution or freedom from hardcoding.
Withhold cases where appropriate and report this limit.

Only host comparisons complete assertions. Empty/early exit, crash, nonzero execution,
timeout, missing/malformed/extra response, duplicate JSON objects, stale nonce,
nonfinite values and truncated output fail closed. A valid wrong value is red. Zero
cases are refused; every planned case must complete and pass before VERIFIED. A
candidate-supplied `completed` field is rejected. No source-spelling blacklist is used.

Plans allow 1–64 cases and up to 300 seconds of aggregate execution budget (backend
inspection/cleanup has separate bounded costs). Arguments and expected JSON are limited
to 8 KiB each and 64 levels; the plan is limited to 256 KiB. This is not a general
pytest/Jest runner or a claim about responses outside those cases.

The command emits `oracle-v1` JSON: exit 0 VERIFIED, 1 ORACLE_RED, 2 CANNOT_VERIFY.
It reports planned/completed/passed counts and, after snapshotting, head/tree/plan/image
bindings. Arguments and expected values are not disclosed. Parse/transport failures
may have no binding and zero completed cases. Reports are unsigned evidence: require
a trusted job, and use external verdict attestation where needed. A signature alone
does not prove an oracle actually ran. The original default-verifier limitation remains
in the [pristine-run threat model](../THREAT-MODEL-pristine-run.md).

For structured failure categories, request `--schema-version 2`. The default stays
`oracle-v1` for existing consumers; v2 preserves the outcome and count fields and
adds `MANIFEST_INVALID`, `BACKEND_UNAVAILABLE`, `SNAPSHOT_CHANGED`,
`CLEANUP_FAILED` and `INFRASTRUCTURE_FAILED` reasons. Runtime errors, timeouts,
invalid responses and wrong results retain the existing `EXECUTION_FAILED`,
`BUDGET_EXCEEDED`, `INVALID_RESPONSE` and `ASSERTION_FAILED` reasons. V1 maps the
new preflight, snapshot and cleanup categories to `EXECUTION_FAILED`. Both versions
keep details of host paths, commands and exceptions out of the report. Completed
and passed counts reflect only host-validated responses even if a later integrity
or cleanup check fails; a failure never carries a verified binding.
