# ADR 0003: Share candidate snapshots without command orchestration

- Date: 2026-11-01
- Status: Accepted
- Issue: [#800](https://github.com/hexrift/tamperward/issues/800)

## Decision

`src/candidate-snapshot.ts` owns working-tree enumeration, materialization, symlink
containment and the filesystem case probe. Both verification and the independent oracle
import this infrastructure directly. It imports no CLI module and makes no verdict,
policy, backend, sign-off or rendering decision. `src/cli/verify.ts` retains its existing
materialization exports as aliases for compatibility.

The pristine overlay remains verification orchestration. It imports the same
`workingTreePaths`, `safeSymlink` and `validateSymlinkGraph` primitives as candidate
materialization, so restoring a base-owned link cannot bypass the dependency-domain
check. Policy compilation, trusted Git metadata, execution backends, evidence evaluation
and presentation remain separate modules in the existing package.

This extraction changes no function body, output contract, error discriminator or
execution order. The extraction check compared the comment-free TypeScript AST of all
15 extracted declarations with their original definitions. The listing Git helper is
copied; verification retains its separate base/overlay helper. Security rationale previously
beside those definitions is retained below under named invariants.
The existing errno type assertion moves with `materializationFailureReason`; the
per-file cast-growth rule therefore reports a relocation warning, without a new
assertion or a suppression.

## Named invariants

| Name | Existing obligation and historical reason | Regression evidence |
| --- | --- | --- |
| `SNAPSHOT-LIVE-LIST` | Enumerate tracked and untracked non-ignored names for every materialization and overlay removal pass. Git supplies names, never proof of live content. Listed entries missing at the final lstat are skipped, preserving the existing deletion behavior. | `test/candidate-snapshot-boundary.test.ts`; [ADR 0002](./0002-preserve-content-based-tree-fingerprints.md) |
| `SNAPSHOT-ENTRY-SHAPE` | Copy regular bytes and mode; reproduce permitted symlink target text; reject directories and special files where Git names a file. A tracked `node_modules` path cannot replace the separately attested dependency edge. Errors retain the `MaterializationFailureReason` vocabulary. | `test/verify.test.ts`; `test/verifier-symlink-fidelity.test.ts` |
| `SNAPSHOT-TREE-CONTAINMENT` | Reject absolute and escaping relative candidate links and symlinked source parents. Windows drive-relative targets such as `C:foo` use process drive state and are also refused. Windows target parsing recognizes both separators; POSIX keeps backslash as a filename character. | `test/verifier-symlink-fidelity.test.ts`; `test/platform-support.test.ts` |
| `SNAPSHOT-DEPENDENCY-DOMAIN` | Resolve every link component in its current tree/dependency domain. A lexical `../node_modules/../secret` containment check is insufficient because the kernel enters the external dependency root before applying `..`. Chained links and dependency links cannot climb out; repeated resolution states or more than 128 symlink hops fail. Broken suffixes remain represented and their later parent traversal is still checked. | `test/verifier-symlink-fidelity.test.ts` |
| `SNAPSHOT-DELAYED-EDGE` | Validate the complete candidate link graph before installing the frozen dependency symlink. The caller supplies the entry-time absolute dependency root, avoiding both rediscovery from candidate state and the historical relative-root self-link. Overlay-introduced links receive the same graph check. | `test/verify.test.ts`; `test/verifier-symlink-fidelity.test.ts` |
| `SNAPSHOT-DESTINATION-LINK` | Remove an existing destination symlink before regular copying or link creation so writes do not follow it. Source parent links are rejected before visiting listed children because Git does not record directory objects. | `test/verifier-symlink-fidelity.test.ts` |
| `SNAPSHOT-VOLUME-CASE` | Probe the actual temporary filesystem, rather than inferring case behavior from the OS. An exclusive upper-case probe and lower-case lookup are cleaned up in `finally`. This protects the #426 case-only rename where overlay removal deleted the just-restored test. Verification retains its separate case-fold collision logic. | `test/verify.test.ts`; `test/verify-subdir-root-554.test.ts` |

## Authority-sensitive I/O inventory

This table records the current implementation, including its limits. It does not assert
that every read already shares one safe primitive.

| Component and operation | Shape and size | Deadline | Error semantics and owner |
| --- | --- | --- | --- |
| `candidate-snapshot.git` / `workingTreePaths` | Trusted `git ls-files -z --cached --others --exclude-standard`; UTF-8, 256 MiB output buffer, replace objects disabled | No subprocess timeout in the existing verification listing helper; retained by extraction | Git failures propagate; verify maps materialization failures to fail-closed output and oracle clears its success claim |
| `materialize` regular copy | lstat-gated `cpSync` with dereference enabled, then original filesystem mode; no per-file byte cap | Synchronous filesystem operations have no separate deadline | Copy/stat/write errors propagate; a failed final lstat retains the existing skip behavior |
| `materialize` and `rejectLinkedParent` shape reads | Per-component lstat, symlink target readlink; no content read for directory/FIFO/device | No separate deadline | Known invalid shapes throw named materialization errors; parent lstat failures are deferred to final inspection |
| `safeSymlink`, `dropSymlink`, `validateSymlinkGraph` | Destination metadata/removal, relative link creation and graph metadata; explicit cycle/hop bound | No separate filesystem deadline | Escape/cycle errors throw; a missing graph suffix continues lexically; destination-drop inspection/removal errors retain the existing swallowed behavior |
| `probeFilesystemCaseSensitivity` | Exclusive zero-byte file creation, existence lookup, final unlink | No separate deadline | Creation/cleanup failures propagate; a lower-case lookup chooses the case behavior |
| `disk.inspectPath` / `readStateFile` | lstat, nonfollowing/nonblocking open where supported, fstat on the descriptor, at most `READ_CAP` (64 MiB); symlinks represented as target text | No separate syscall deadline; nonblocking open avoids FIFO waits where supported | Missing state is `null`; irregular/unreadable/oversize state throws `StateFileError`; caller must not treat it as absence |
| `git/trusted.gitPathOf` | Trusted Git metadata path, UTF-8 output with Node's default buffer limit | 1 second | Path discovery failures throw; no clean rewrite-state fingerprint exists |
| `git/trusted.objectRewriteState` | `readStateFile` for graft/shallow metadata; replace refs have a 1 MiB subprocess output cap | Replace-ref enumeration: 3 seconds | Nonregular/unreadable metadata and process failure throw; no unreadable sentinel can compare equal |
| `cli/oracle` manifest and copy checks | `inspectPath` first enforces the disk cap, then a 256 KiB manifest limit and digest; `inspectRel` compares source/copy kind, mode and bytes | Its direct trusted Git commands currently have no timeout and a 256 MiB buffer | Preflight/snapshot/cleanup failure clears binding and produces `CANNOT_VERIFY`; shared materialization adds no new authority |
| `cli/verify` base/overlay Git reads | Existing trusted Git helper: 256 MiB buffer; mode/content restoration remains command-owned | No timeout in that helper or ancestry `spawnSync` | Resolution/overlay failures retain existing fail-closed handling; this extraction does not consolidate these with the bounded run helper |
| `git/process` / `cli/run` adjudication Git reads | Trusted UTF-8 subprocess, 256 MiB output cap, ignored stdin, captured stdout/stderr | 3 seconds with `SIGKILL` | Read failures throw. Ancestry returns false only for normal exit 1; timeout, signal, crash or another status throws. The preceding bounded-Git change owns this boundary |
| `cli/run.trustedLinuxPython` | Fixed-path interpreter and ancestor metadata; interpreter must be a non-writable regular file; isolated stdlib probe has ignored output | Requested 5-second probe timeout; no separate metadata deadline | Failed probes try the next fixed candidate; no trusted interpreter or a root caller leaves Linux lifecycle ownership unavailable |
| `cli/run.runAgentSupervised` launch | Trusted Linux Python or the portable Node supervisor; inherited agent stdio has no capture cap; frozen environment JSON uses mode 0600 | Optional agent budget plus a 15-second outer backstop with `SIGKILL`; no configured outer timeout when the budget is omitted | Abnormal supervisor completion rejects its result and returns unowned failure. Linux ownership requires descendant draining through `ECHILD`; the portable supervisor reports `lifecycleOwned: false` |
| `cli/run` supervisor-result read | Raw UTF-8 `readFileSync` of same-UID-writable final JSON, without a regular-file guard or byte cap; only read after normal supervisor completion | No separate read deadline | Read/JSON-syntax failures return unowned failure; required exit/timedOut fields are checked before accepting a result, while parsed `null` can throw during field inspection. This raw read is not consolidated with `readStateFile` |
| `cli/run` process observations | Uncapped kernel `/proc/uptime` and `/proc/<pid>/stat` reads; process/fd enumeration and cwd/exe/fd link targets have no per-read cap | No separate syscall or scan deadline; observer waits have caller-owned bounds | Uptime read failure returns infinity; observer ENOENT means exited while other errors retain PID-liveness fallback. Survivor enumeration failure returns no observations; individual races are skipped and restricted fd enumeration retains cwd/exe probes. These are best-effort observations, not a new ownership guarantee |
| `suite-diagnostics` / `verifier-backend` execution | Existing supervisor capture, stage budget, bounded diagnostic tails, backend-owned identity and cleanup | Stage budget and supervisor drain deadlines remain authoritative | Timeout, crash, resource exhaustion or incomplete pipes cannot establish a clean completed stage |
| `cli/doctor` pin and workflow checks | `readStateFile` regular-file checks and 64 MiB disk cap; missing input remains distinct from refused input | No separate filesystem deadline | #812 makes unreadable pins/workflows broken checks; they do not silently become absent |
| `cli/doctor` Git/API collection | Git probes retain Node's default output buffer and no deadline; GitHub API subprocess has a 15-second timeout and default buffer | As stated per transport | Git probe errors return `null`; API failures throw into broken/unknown posture. Pure GitHub evidence evaluation is transport-free |
| `verification-state.interventionWiring` | Raw unbounded `readFileSync` of four local/user settings files, without a regular-file guard | No deadline | Parse/read errors become `present: false`; this remains a separate authority-sensitive follow-up, not a guarantee supplied by snapshot extraction |
| `verification-state` Git and `git/build` reads | Trusted replace-disabled Git, 256 MiB buffers | No timeout in these existing helpers | Process errors propagate or are interpreted by the particular probe; they are not silently consolidated into the bounded run helper |

## Reviewed I/O exceptions and reusable contracts

`test/trust-io-architecture.test.ts` applies a TypeScript AST check only to
`candidate-snapshot`, `git/trusted`, `git/process`, `github-authority` and
`external-oracle`. Necessary raw I/O is admitted by a named exception matching the
function owner, canonical imported API and exact static call count. Snapshot exceptions
use the invariant names above. The Git exceptions are `GIT-METADATA-PATH` (the one-second
path probe), `GIT-REWRITE-REFS` (three-second rewrite enumeration), `GIT-BOUNDED-READ`
(three-second adjudication reads) and `GIT-ANCESTRY-RESULT` (normal exit-1 absence versus
infrastructure failure). The evaluator/controller modules admit no raw filesystem or
process I/O.

The checker guards the selected `fs`, `fs/promises`, `child_process`, `process` and
`module` families, including their `node:` spellings. It rejects unreviewed imports/calls,
namespace or default imports, re-exports, raw module loaders, extracted imported aliases
and process access other than environment inspection. Both `globalThis.process` and its
computed spelling cannot supply an indirect process alias. Import aliases are resolved
before visiting calls, including
imports appearing later in a file. Added calls or calls moved to another owner require
review; unused exceptions also fail. Worker program text and diagnostic strings are
data rather than host calls, so an AST check does not mistake them for execution.
It does not audit every Node API, network access or execution inside worker-program text.
This finite source check is a review aid, not a whole-program security analyzer or a
replacement for runtime contracts. Expanding its module list or exceptions requires
updating the inventory and the relevant focused regression.

`test/support/candidate-entry-contract.ts` supplies the same real Git-backed fixture
and behavioral contract to `readStateFile` and shared materialization. It checks current
live bytes, a replacement inode with equal size and restored timestamps, missing tracked
inputs, and directory/FIFO/external-link replacements. Refusals must name the relevant
shape rather than succeed through an unrelated error. The verification compatibility
export is checked for function identity instead of duplicating this contract suite.
The existing symlink-fidelity and external-oracle fixtures remain the independent
integration checks for domain traversal, dependency links and completed evidence.

## Limits and consequences

Source lstat and copying are separate operations. This extraction does not turn `cpSync`
into a descriptor-stable snapshot, add a new source-byte cap, or prove the absence of
concurrent path replacement. Verification retains its surrounding live-content tree,
dependency and pristine-overlay integrity checks; the external oracle additionally
compares copied entries with their sources before execution. Missing-entry semantics
differ from strict admission evidence and remain the caller's responsibility.

There is no index/stat/cache shortcut, persisted snapshot reuse or performance claim.
Full live-content identity remains required by [ADR 0002](./0002-preserve-content-based-tree-fingerprints.md),
[SECURITY-ENVELOPE.md](../SECURITY-ENVELOPE.md) and the
[pristine-run threat model](../docs/THREAT-MODEL-pristine-run.md). A later bounds or atomicity
change needs its own adversarial failure first and its own focused change review.
