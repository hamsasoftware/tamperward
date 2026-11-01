# Changelog

## [2.50.0] — 2026-11-01

### Added

- Report the shared suite-exit-only assurance and residual limits in verification,
  receipts and reconciliation, preserving older receipts and their digest encoding.
- Add completed verification producer bindings for the actual candidate, baseline,
  policy and verifier configuration without authenticating unsigned reports (#801).

## [2.49.4] — 2026-11-01

### Fixed

- Emit each receipt reconciliation workflow annotation once, preserving order and verdict.

## [2.49.3] — 2026-11-01

### Changed

- Share candidate snapshot materialization between verification and the external
  oracle without changing its entry, dependency or symlink semantics (#800).
  Record the trusted I/O inventory, named invariants and current limitations
  without changing existing read, copy or error semantics.

## [2.49.2] — 2026-11-01

### Fixed

- Bound the run envelope's Git subprocesses and terminate stalled reads (#800).
  Unavailable ancestry evidence now yields CANNOT_ADJUDICATE rather than a
  HISTORY_REWRITE finding; a genuine nonancestor retains the existing verdict.

## [2.49.1] — 2026-10-30

### Added

- Report command-specific readiness in doctor machine/terminal output and
  onboarding (#803). A shared conservative model distinguishes static checks,
  local and container verification, Linux lifecycle supervision and protected CI.
  Unprobed Docker and repository authority remain UNVERIFIED, while the existing
  global authoritative verdict and BROKEN checks keep their meaning.

## [2.49.0] — 2026-10-30

### Added

- Opt-in `oracle --schema-version 2` reports safe, structured manifest, backend,
  snapshot, cleanup and infrastructure failure reasons (#802). The default
  `oracle-v1` schema and reason vocabulary remain compatible. V2 preserves
  host-completed counts and never includes private exception details or a binding
  on a failed post-evaluation check.

## [2.48.4] — 2026-10-30

### Fixed

- Preserve host-completed oracle case counts when candidate or infrastructure
  checks fail after evaluation (#802). Finish snapshot cleanup before emitting a
  result, so a cleanup failure cannot leave a VERIFIED report behind. Such
  failures remain CANNOT_VERIFY with the v1 reason vocabulary and no binding.

## [2.48.3] — 2026-10-30

### Changed

- Extracted pure GitHub authority evidence evaluation from doctor orchestration
  into a directly importable module (#800). The doctor export and evaluation
  behaviour remain compatible; a boundary regression keeps transport, I/O and
  CLI rendering out of the evaluator.

## [2.48.2] — 2026-10-30

### Fixed

- Bound local workflow and version-pin reads in `doctor` using regular-file,
  no-follow inspection (#800). A FIFO, device, symbolic link or oversized
  authority file cannot hold the diagnostic indefinitely; unreadable version
  pins are reported as BROKEN instead of being treated as absent.

## [2.48.1] — 2026-10-30

### Fixed

- Bound Git graft/shallow metadata reads and replace-ref inspection for the
  `run` object-layer fingerprint (#798). Reject irregular, linked, unreadable
  or oversized metadata before Git can consume it, and resolve effective paths
  in linked worktrees. Unavailable evidence now fails closed as cannot
  adjudicate rather than comparing stable unreadable markers; normal digest
  ordering and the v1 machine reason vocabulary remain unchanged.

## [2.48.0] — 2026-10-30

### Added

- Discover every applicable GitHub ruleset from protected-branch rule provenance,
  including inherited organisation rules and bounded pagination (#797). Unknown
  provenance or unavailable bypass details cannot certify repository authority.
  `doctor --github` accepts `--required-checks A,B` for an exact downstream
  contract and `--check-contract tamperward-repo` for this repository's expanded
  CI list. The expanded list remains the default for `hexrift/tamperward`;
  downstream repositories default to the `tamperward` status context.

## [2.47.2] — 2026-10-30

### Fixed

- Reject unknown fields inside verifier, sign-off and per-rule policy mappings
  instead of silently discarding intended protection (#799). Errors identify the
  complete key path; repository and pinned organisation policy share validation.
  Supported sign-off aliases, rule identifiers and protected categories remain
  compatible. Previously ignored misspellings must now be corrected.

## [2.47.1] — 2026-10-30

### Fixed

- Preserve adverse and unknown GitHub authority evidence across classic branch-
  protection fallback in `doctor --github` (#795). Missing/malformed bypass lists
  and unavailable branch-rule evidence cannot certify authority; fallback retains
  the same required-check contract. Collector-level regressions exercise both
  successful composition and refusal paths.

## [2.47.0] — 2026-10-22

### Added

- `oracle --manifest F --sha256 H` adds an independent host-completed JSON RPC
  oracle for CommonJS function endpoints (#782). Expected values stay outside the
  isolated candidate container; every planned response must pass a trusted host
  comparison. Missing, malformed, replayed, partial or truncated responses and
  early successful process exit fail closed. This opt-in profile does not upgrade
  arbitrary test frameworks: ordinary `verify` remains `suite-exit-only`. The
  candidate controls RPC values; finite-case hardcoding and host/container escapes
  remain outside the claim. A pinned external plan and trusted CI host are required.

### Fixed

- Keep oracle worker source separate from request data with a shell-free Node
  invocation. Accept fractional remaining budgets in the capture supervisor's
  integer-only synchronous backstop without changing its actual execution budget.

## [2.46.0] — 2026-10-22

### Added

- Opt-in organisation policy floors from an operator-configured external regular
  file with a required SHA-256 pin (#781). Repository policies inherit the floor
  and fail closed on lower versions, disabled/lowered rules, additional ignore or
  exclusion globs, removed sign-off requirements and verifier substitutions.
  Classification-sensitive protected sets and verifier inputs are conservatively
  frozen; no semantic glob-containment claim is made. Floor provenance binds into
  verification evidence, and weaker verification flags are refused. Without the
  operator configuration, existing repository policy behavior is unchanged.

## [2.45.0] — 2026-10-22

### Added

- `attestation sign` and `attestation verify` transport externally trusted Ed25519
  verdict statements bound to head, base, gate version, effective policy hash,
  verdict, audience and nonce (#780). Verification requires every expected binding,
  the operator's trusted public key, and a valid expiry window. Unsigned receipts
  remain non-authoritative; signing keys and payload provenance belong to a trusted
  CI/signing job outside candidate control, not the repository under evaluation.

## [2.44.0] — 2026-10-22

### Added

- Opt-in verification duration, outcome and actual out-of-band sign-off measurements
  in a strict privacy-safe sidecar, aggregated by `stats` without inventing rule
  findings or session exposure (#779). Historical audit-v1 logs remain unchanged.
- `measure-suite --cmd C [--budget S]` explicitly measures a bare suite in the live
  checkout. Runs that time out or alter their inputs are marked incomplete; a hashed
  comparison binding identifies matching head/tree/command/machine samples. This is
  measurement evidence, never verification authority or a production-pilot result.

## [2.43.1] — 2026-10-21

### Changed

- Batch tree-fingerprint metadata framing into one hash update per file (#752).
  Digests remain byte-identical and every file is still read through the guarded
  disk reader. ADR 0002 records why index/stat/cache shortcuts are not used;
  regressions cover hidden tracked edits and normalized Git blobs.

## [2.43.0] — 2026-10-13

### Added

- `verify --cargo-target-root <dir>` configures distinct persistent visible/pristine
  Cargo output directories for checkpointed-local verification. Rejects roots in the
  checkout, aliased stage directories and use with the container backend. Both full
  suites and all existing verdict rules remain active; mutable build outputs are not
  attested or a new same-UID isolation guarantee.
- Trusted verifier progress on stderr at stage start and every 30 seconds, with elapsed
  time and output byte counts. Candidate streams remain bounded and buffered, JSON
  stdout remains one document, and nested silent verification stays quiet.

## [2.42.0] — 2026-10-13

### Added

- **PR-visible `tamperward verify` verdicts** (#770). In GitHub Actions, trusted
  receipt reconciliation emits a global check annotation for failed verification
  and a warning when a masked failure is accepted by out-of-band sign-off. A
  `CANNOT_VERIFY` annotation includes its reason and a bounded, sanitized detail;
  the existing job summary and CI verdict remain authoritative.

## [2.41.0] — 2026-10-05

### Added

- **`init` and `onboard` write the Codex and Copilot CLI hook wiring, and the hook commands
  exist to run it** (#749, step 2). When the repository shows a Codex marker (`AGENTS.md`, or
  a `.codex/` directory holding more than the wiring itself) init appends the `PreToolUse` and
  `Stop` `[hooks]` tables to `.codex/config.toml`; when it shows a Copilot marker it writes
  `.github/hooks/tamperward.json` with `preToolUse` and `agentStop` command hooks. Both carry
  the same hardened, pinned `npx` form as the Claude wiring, an experimental note in the file,
  and a warning in the init output naming `tamperward runtime verify`. Init re-pins the
  entries it wrote and refuses to rewrite a hand-written hooks block or file. `tamperward hook
  codex|copilot` and `sweep codex|copilot` run the matching adapter over the hook payload and
  write its native envelope at exit 0; every failure state fails closed inside that envelope.
  Codex detection no longer counts `.codex/config.toml` alone as evidence of Codex use, so the
  file init writes cannot make the next run see a runtime that is not there (#526).

### Changed

- `hook-tampering` reads a raised `tamperward@<pin>` in the Codex `[hooks]` tables or the
  Copilot `hooks` member as the re-run of init it is, not a weakening; a lowered or non-plain
  pin is named as one. Nothing is promoted: `preDeny` stays empty for both runtimes.

## [2.40.0] — 2026-10-05

### Added

- **The audit event carries the M3 instrument fields** (#751, step 1). Four optional, additive
  fields on `audit-v1`: `hook_latency_ms`, `verify_wall_clock_ms`, `bare_suite_wall_clock_ms`
  (whole, non-negative milliseconds) and `oob_signoff` (boolean). The PreToolUse and Stop
  hooks record their own latency on every deny they log; the other three are accepted,
  validated and summarised but have no in-tree producer yet. `tamperward stats` reports
  nearest-rank p50 / p95 / max and the sample count per measure where present, and the
  number of out-of-band sign-offs, in the text view and as `latency` / `oob_signoffs` on
  `stats-v1`. Both schemas ship under this release's tag; a v1 reader that ignores unknown
  fields is unaffected, and `parseAuditEvent` still rejects every other unknown field. The
  durable evidence store folds the same measures (its derived `summaries/state.json` is
  `audit-store-state-v2`; an older state is rebuilt from the partitions on the next publish),
  and the dependency-free publisher validator accepts the integer, boolean, `minimum` and
  `description` keywords the fields use.

## [2.39.24] — 2026-10-05

### Fixed

- **Every adapter's pre-action path runs the canonical effect layer** (#750). The Codex,
  Copilot CLI and Copilot SDK adapters pinned the turn baseline but skipped the two steps the
  Claude path runs next: `effectDriftBlocks`, which denies a drift of the protected tree since
  its last sanctioned state before the operation is judged, and `sanctionPredictedWrites`, which
  records an allowed write on a protected file so the next call does not re-litigate it. A
  protected spec gutted out of band between two tool calls was allowed through on those three
  adapters and denied on Claude. All four now deny it with the same findings (a tracked file by
  the rule it breaks, a gitignored one as `hidden-drift`), the deny repeats until the file is
  restored, and an allowed write the tool then applies is not re-flagged. The two functions are
  exported from the hook module; no adapter-specific logic was added.

## [2.39.23] — 2026-10-05

### Fixed

- **The Codex and Copilot CLI project hook wiring is protected hooks surface** (#749, step 1).
  `.codex/config.toml` (where Codex reads project hooks; what `runtime verify` hashes) and
  `.github/hooks/tamperward.json` (the Copilot CLI repository hooks) were not in the default
  `protected.hooks`, so an agent on either runtime could remove or weaken its own interception
  before a protected edit and the gate saw nothing. Both are now protected by default and
  recognised at any depth, with symlinks resolved as the Claude settings are. `hook-tampering`
  reads each at the grain its format has: a deletion or rename, a gate entry removed, changed or
  joined by a sibling in the TOML `[hooks]` tables or the JSON `hooks` member, or a wiring file
  that no longer parses is the finding; an edit outside the hook tables / member, and hooks
  arriving where there were none, are the project's own. The shell surface covers the files
  through the policy (`rm`, `mv`, a redirection). `init` does not write this wiring yet; that is
  step 2.

## [2.39.22] — 2026-10-05

### Fixed

- **Retained Copilot SDK evidence is bound to the frozen permission-gate signatures** (#747).
  The catalogue's returned-reject observation cited a `permission.completed` event the
  2026-09-20 capture never recorded, and the lineage check accepted a `proven` observation on a
  bare `denied` completion code — the bare-code authority #616 rejected. The lineage check now
  requires the capture row's path, code and message hash to match a source-frozen signature,
  and the two observation details name the signature they rest on. No observation changes
  result; the record can still never promote (its capability hash is null).

## [2.39.21] — 2026-10-05

### Fixed

- **Every fail-closed Copilot SDK decision carries a sanitized cause category** (#746). The
  category introduced for #616 was set only on the pre-action path: a transport failure or a
  callback that never fired (`failClosed`) reached the host uncategorised, and so did an
  end-of-turn sweep that failed closed on, for example, an unparseable `.tamperward.yml` at
  Stop. `failClosedResult` now tags its outcome (`transport-failure`, `not-invoked`) as the
  category for every adapter that uses it, and a sweep whose findings are the fail-closed
  sentinel is tagged `end-of-turn-sweep`. Two categories no path could produce are removed:
  `repo-context` (the runner cwd outside a repository is reported as `identity-rejected`
  before that stage) and `other`. Decisions, wires and verdicts are unchanged.

## [2.39.20] — 2026-10-05

### Changed

- **Stale notes on the Copilot SDK adapter corrected** (#745). A source comment called the SDK
  adapter's end-of-turn sweep "unwired", and the runtime guide and the qualification harness said
  the adapter was "unshipped (absent from `dist/`)". The adapter is registered and bundled into the
  CLI; what is true is that the CLI bundle exports nothing, which is why the harness compiles the
  adapter from `src` to import it and hash the exact bytes it runs. The Copilot probe's transport
  comment now matches its own `transportExpectation` (empty and malformed output are documented
  fail-open). No behaviour changes.

## [2.39.19] — 2026-10-05

### Fixed

- **`runtime verify` grades Codex hook-transport failures as FAIL-OPEN** (#744). The pinned
  Codex 0.154.0 probe run observed a killed, timed-out, non-zero, empty-output, malformed-output
  or missing-executable hook followed by tool dispatch, but the Codex adapter declared only
  that fail-closed transport was "not yet proven", so every `transport:*` row graded `UNPROVEN`
  — no evidence either way — in `runtime verify`, `runtime status` and `onboard`. The adapter
  now declares the observed semantic, naming the upstream reports, and the five rows grade
  `FAIL-OPEN` citing it. Nothing is promoted; the in-loop aggregate stays `PARTIAL`.

## [2.39.18] — 2026-10-05

### Fixed

- **Onboarding states what each runtime gets instead of pointing at tracking issues** (#732).
  The runtime notes, the neutral-runtime caveat and the Cursor qualification line ended with
  "a native in-loop adapter is tracked in #482" or "See #602", although experimental Codex
  and Copilot adapters already ship and `tamperward runtime verify` reports their exact
  state, and a tracking issue is closed long before a binary stops printing it. Cursor's
  note now says no in-loop adapter ships for it; Codex and Copilot say their experimental
  adapters are not qualified for in-loop steering and name `tamperward runtime verify`. No
  shipped output points at an issue number.

## [2.39.17] — 2026-10-05

### Fixed

- **A Codex hook-config change marks a recorded Codex qualification `STALE`** (#731). The
  qualification binding hashed the hook configuration for Claude Code and the Copilot CLI but
  not for Codex, so every Codex record carried `hook_config_hash: null`: rewriting
  `.codex/config.toml` to turn the hooks off, or deleting it, left `runtime status` and
  `onboard` reporting the record as current. The binding now hashes `.codex/config.toml`,
  where Codex reads project hooks, and an edited or removed file flips the record `STALE`.
  The runtime adapter guide now names that file, not the inert `.codex/hooks.json`, as the
  gated wiring.

## [2.39.16] — 2026-10-05

### Fixed

- **`runtime verify` grades Copilot CLI empty and malformed hook output as FAIL-OPEN** (#729).
  Copilot documents that a command `preToolUse` hook exiting 0 with empty or malformed stdout
  fails open — no decision is read and the default permission lets the tool proceed — but the
  Copilot adapter declared only the timeout and HTTP fail-open cases, so `transport:empty` and
  `transport:malformed` fell through to the contract row and were reported as `PARTIAL`
  fail-closed in `runtime verify`, `runtime status` and `onboard`. The adapter now declares the
  documented semantic and both rows grade `FAIL-OPEN`, citing it. Nothing is promoted.

## [2.39.15] — 2026-10-05

### Fixed

- **Unmodelled Copilot SDK permission kinds fail closed** (#728). The experimental hosted
  Copilot SDK adapter mapped every permission `kind` other than `shell`, `write`, `read` and
  `mcp` to `other`, which reconstructs to no change and is approved: a misspelt `shelll`
  request carrying `rm src/a.spec.ts`, a `custom-tool` the host never registered, or any kind
  the SDK adds later reached the gate as a no-op. Such a request now produces the
  `unknown-tool` finding and an SDK reject before reconstruction; `url`, `memory` and `hook`
  stay allowed. The adapter remains experimental with an empty `preDeny`.

## [2.39.14] — 2026-10-05

### Fixed

- **Unknown Codex tool names fail closed** (#726). The experimental Codex adapter mapped
  every tool name outside its vocabulary to `other`, which reconstructs to no change and is
  allowed — the gap 2.38.4 closed for Copilot. A `write_stdin` carrying `rm src/a.spec.ts`
  into a running exec session, or any future mutating tool, was evaluated as a no-op. An
  unmapped non-empty Codex tool name now produces the `unknown-tool` finding and a
  PreToolUse deny before reconstruction; `view_image`, `update_plan` and `web_search` stay
  allowed as non-mutating. The `unknown-tool` finding now names the runtime that raised it.
  Codex remains experimental with an empty `preDeny`.

## [2.39.13] — 2026-09-28

### Fixed

- **`stats` reads the audit log only as a regular file** (#722). `tamperward stats` checked
  its log with `existsSync` and opened it with `openSync`, which take the path as the OS
  resolves it: a link at `.git/tamperward/audit.jsonl` was followed and whatever it named was
  summarised as the gate's own record — a path the writer has refused since 2.39.11, so
  nothing the gate recorded can stand behind it — a dangling link read as "no events", a
  FIFO held `stats` until a writer appeared, and a directory was refused by errno alone. The
  log is now opened through the read-side counterpart of the guarded append (an `lstat`, an
  open that follows no link and never waits, a check on the open descriptor) and streamed
  from that descriptor: nothing at the path stays the empty summary (or `audit file not
  found` for an explicit `--file`), and anything else standing there — a link wherever it
  points, a FIFO, a directory, an entry that cannot be read — is one line naming it, exit 2.
  A file with more than one name is read: a read has nothing to redirect through a hard
  link. The channel stays measurement only; nothing about a verdict changes.

## [2.39.12] — 2026-09-28

### Fixed

- **The verification store under `.git/tamperward/` is written through a rename and read only
  as regular files** (#720). The VERIFIED record, the in-progress marker, the transportable
  receipt and the runtime qualification store were written with `writeFileSync` and read with
  `readFileSync`, which open the path as the OS finds it: a link planted at a record's path
  carried `verify`'s own record into whatever the link named — a dotfile outside the
  repository, or the hook wiring inside it — a hard link put it into that file's inode, and a
  FIFO held `verify` before it ran anything and held `status`, `receipt export` and the runtime
  commands on their read. `.git/` is not a protected path, and `verify` is run by the operator
  and by the agent itself. Each writer now goes through the same temp-file-and-rename the
  `init`/`onboard` writers use, which replaces a link, a hard link or a FIFO with the record
  and never follows or waits; each reader goes through the guarded state reader: absent and
  malformed stay what they were, and anything else standing at the path is reported by name
  instead of parsed — `status` fails safe to `UNVERIFIED` with that reason, `runtime status`
  reports the qualification as rejected, `runtime verify` reports that nothing was recorded
  (its `recorded: false` document, naming the entry), and `receipt export` stops with one
  line. The store remains evidence, never authority. The state directory itself,
  `.git/tamperward/`, is now accepted only as a directory of its own: a link there carried
  every record the gate keeps — the session marker and the effect trees, the audit and
  observer logs, the verification store — into whatever directory it named and served every
  read from there while each record still looked like a regular file, since a recursive
  `mkdir` and a temp-file-and-rename both traverse it. Every path under it is now refused by
  name: the hook fails closed, `verify` records nothing, `status` reports `UNVERIFIED` naming
  the link, and the watcher and the run envelope refuse to start.

## [2.39.11] — 2026-09-28

### Fixed

- **The loop layer's own records are written only to regular files** (#718). The deny log
  (`TAMPERWARD_DENYLOG`), the audit log (`TAMPERWARD_AUDIT_LOG`), and the watcher's event log
  and health record were written with `appendFileSync` and `writeFileSync`, which open the
  path as the OS finds it: a link is followed, and a FIFO holds the open until a reader
  appears. In the hook both appends run before the deny is returned, so a FIFO at either path
  held the deny itself until the runtime's hook timeout let the tool call through — a stall
  that fires only when there is something to deny — and a link carried the gate's own lines
  wherever it pointed: aimed at the turn-baseline marker, one deny left text the next call
  re-established at HEAD, forgetting a mid-turn commit the way #716 refused to; aimed at the
  policy or the hook wiring, it corrupted them. Both paths are same-uid writable, and `.git/`
  is not a protected path. Every such append now goes through one primitive (an `lstat`, an
  open that follows no link and never waits, an `fstat` after the open, and on both stats a
  file with more than one name is refused too: a hard link to the marker passes every
  "regular file" test and appends into the marker's own inode), and the watcher's health
  record is replaced through a rename, which follows nothing. The channels stay what
  they are documented to be — best effort: a refused entry drops the line exactly as any
  write failure did, and the verdict neither changes nor waits on it; the watcher reports the
  refusal as a degraded observer, naming what stands at the path.

## [2.39.10] — 2026-09-28

### Fixed

- **The per-session state under `.git/tamperward/` is read only as regular files** (#716).
  The turn-baseline marker, the effect ptree and turn tree, the observer cursor and the
  watcher health record were read with `existsSync` and `readFileSync`, which follow whatever
  stands at the path. A FIFO in any of their places blocked the read, so every later PreToolUse
  and Stop of the session hung until the runtime's hook timeout cut the gate off; a link to a
  device was a read that never ended; and `rm … && mkfifo …` on those paths is an ordinary
  shell command at PreToolUse, because `.git/` is not a protected path. The readers' fallbacks —
  re-establish the marker, take the tree for a first sight, restart the cursor — were written
  for a file that is missing, and taking them for an entry put in the file's place would have
  sanctioned whatever that entry hid. Each state file is now read through the same guarded
  reader as the policy file (an `lstat`, an open that follows no link and never blocks, an
  `fstat` after the open): absent keeps exactly the old behaviour, a regular file is read, and
  anything else — a link wherever it points, a FIFO, socket, device or directory, an entry
  that cannot be read — fails the verdict closed at once, naming the file. The watcher health
  record is advisory telemetry, so there the observer is reported unavailable with the reason
  instead; the event log itself was already bounded by a stat and a positioned read.

## [2.39.9] — 2026-09-28

### Fixed

- **The working-tree policy is read only as a regular file at the repository root** (#713).
  `loadPolicy` read `.tamperward.yml` with `existsSync` and `readFileSync`, and both follow
  whatever stands at the path. A FIFO there blocked the read until a writer opened the pipe,
  so `check`, `doctor`, `verify`, `status` and both hooks hung until something outside cut
  them off — at the runtime, the hook timeout, which is a gate that never answered; the
  read ran before the effect-drift check, so the finding that would have named the removed
  policy file was never reached. A symbolic link there was followed, so the local layers
  were governed by whatever the link pointed at: not the policy file, so an edit to the
  target was judged as an ordinary edit, and possibly a file outside the repository — while
  the CI layer, reading the same link at the trusted revision, refused it. A broken link
  read as "no policy", and the baseline governed silently in place of everything the author
  had written. The path is now inspected the way the effect layer reads every protected file
  (an `lstat`, an open that follows no link and never blocks, an `fstat` after the open):
  absent is the baseline and a regular file is parsed, exactly as before; a link wherever it
  points, a FIFO, socket, device or directory, a file past the 64 MiB read cap or an entry
  that cannot be read is a policy error naming what stands there, so `check` exits 2 and the
  hooks deny at once with the reason. The trusted-revision loader (`check --diff`, the CI
  layer) is unchanged; `init` and `onboard` already refused a non-regular policy file.

## [2.39.8] — 2026-09-28

### Fixed

- **A set-but-malformed `TAMPERWARD_OOB_HEAD` no longer re-enables unbound approvals** (#709).
  The CI gate honors an out-of-band approval only when it is bound to the head under
  adjudication, and an older workflow that never names its head keeps the unbound legacy
  behaviour. A head that was set but was not a full 40- or 64-character object id — a branch
  name, an abbreviated sha, a typo in a hand-edited workflow — was read as that omitted head,
  so an unbound `tamperward:allow:<rule>` label cleared every finding of the rule on every
  push, a `<rule>@<any sha>` label cleared without its sha being compared, and `verify` (and
  `receipt reconcile`) exited 0 on a MASKED_FAILURE for an unbound `verify` token; only
  compact `tw1:` tokens stayed refused. A misconfigured head is now distinguished from an
  omitted one: nothing clears under it in any token form, and `check --diff`, `verify` and
  `receipt reconcile` say so once on stderr, naming the variable and the shape it needs.
  Unset or empty keeps the documented compatibility path; a full object id binds exactly as
  before. The shipped and generated workflows, which set the variable from
  `github.event.pull_request.head.sha`, are unaffected.

## [2.39.7] — 2026-09-28

### Fixed

- **A base tree git cannot list is reported as BROKEN, not as a changed protected surface**
  (#707). The `surface` input of the verification binding is the protected file set at the
  trusted base, listed with `git ls-tree -r`; a listing that failed came back as the empty
  surface, so when the base commit resolved but a tree object under it could not be read,
  `tamperward status` reported STALE, "protected verification surface changed since
  verification" — a load-bearing change that never happened — with git's error shown nowhere,
  and `receipt reconcile` carried the same failure as a `surface` divergence. `computeBinding`
  now throws on the failed listing, naming the base and git's error, so `status` reports BROKEN
  with that detail, the record is left in place by the BROKEN rule, and reconcile reports the
  binding error it is. No verdict changes: `verify` lists the same base tree itself and never
  recorded an empty surface.

## [2.39.6] — 2026-09-27

### Fixed

- **A git blob the gate cannot read is no longer taken for an absent one** (#705). Every
  git view reads file content through one reader that mapped any `git show` failure to
  "absent", so a trusted-base `.tamperward.yml` that existed but could not be read made
  `check --diff`, `verify --base`, the `run` envelope, `trace-verify` and the observer fall
  back to the baseline policy, and the hidden tracked paths the worktree views reconstruct by
  hand (skip-worktree, assume-unchanged) were synthesized from an absent baseline, so a
  gutted spec read as a fresh add — an object-store or I/O failure silently weakened the
  gate. Absence is now
  established by the tree: when a read fails, the reader lists exactly that path (`ls-tree`,
  or `ls-files -s` for the index) and reads null only when nothing is there, or what is there
  is not a blob (a gitlink whose commit this store lacks); a listed blob that cannot be read,
  or a tree that cannot be listed, is an error, so `check` exits 2 naming the object and the
  hook layers deny. A read that succeeds is returned as before (a directory path still
  renders as git's listing, which the callers refuse as content). The listing runs only
  when a read fails, so an ordinary view costs nothing more.

## [2.39.5] — 2026-09-27

### Fixed

- **The local sign-off ledger is honored only as `allow` writes it** (#699). The LOCAL layer
  (`check --staged`, the pre-commit hook) clears a blocking finding on a matching ledger entry
  and calls that a one-time human judgment, never a standing license; the loader already refuses
  a `signoff.ledger` that names a location outside the repository. The reader held neither half:
  it followed a symbolic link at `.tamperward/ledger.jsonl`, or at `.tamperward/` itself, to a
  file outside the repository that no git view shows (and `tamperward allow` appended through
  the same link), and it honored any `expiresAt` a line claimed, so a hand-written expiry years
  out, or a `recordedAt` in the future, cleared the same fingerprint for good. The ledger is now
  read and appended only as a regular file reached inside the repository without following a
  link (every path component checked, the file opened `O_NOFOLLOW` where the platform has it);
  anything else is exit 2 with one line on stderr, like an escaping path. An entry is honored
  only inside the window `allow` writes: unexpired, recorded no later than now, and living at
  most the 30 days `allow` grants. The agent layer never read the ledger and CI honors only the
  out-of-band label, so no CI verdict changes.

## [2.39.4] — 2026-09-27

### Fixed

- **The retained-evidence catalogue is pinned to the committed capture it transcribes** (#697).
  Each record now carries `committed_artifact_sha256`, the SHA-256 of the committed sanitized
  capture at `source` (distinct from `source_artifact_sha256`, which stays the identity of the
  original uncommitted capture), and each observation names the capture row it was transcribed
  from through `capture_path`. A lineage test opens every record's capture and checks the
  transcription field by field: the two hashes, the binding against the capture's provenance,
  the tested surface against the observation ids, each `proven` observation against an
  explicit denied completion that kept the protected state intact after the boundary, and each
  `fail-open` observation against a row that mutated it. Nothing about matching,
  grading or the report's wire format changes; a catalogue that drifts from its evidence, or
  evidence that changes under the catalogue, now fails the suite instead of still grading
  `PROVEN`.

## [2.39.3] — 2026-09-27

### Fixed

- **Trust-bearing registries are immutable at runtime** (#695). The retained real-runtime
  evidence catalogue that gates `PROVEN` capability states, the shipped-adapter registry and
  its label and alias maps, the known-runtime descriptors, and the contract and
  qualification enumerations (operation kinds, steering phases, capability ids, states,
  evidence sources, in-loop aggregates) are frozen after module initialisation, deeply for
  plain data. TypeScript's `readonly` had been the only guard: a consumer could push an
  evidence record whose binding matched the current runtime, or add a capability id and
  change `tested_capabilities` in every later qualification binding. An attempted mutation
  now throws and cannot change `matchRetainedEvidence()`, `adapterFor()`, the derived
  assessments or a qualification binding. Same invariant as #689, one boundary further out;
  the helper walks plain data only, so an adapter instance's own immutability stays the
  adapter's construction-time job (#689).

## [2.39.2] — 2026-09-27

### Fixed

- **Runtime capability identity is immutable after adapter construction** (#689). Each
  capability descriptor now copies and freezes its exposed collections, and every shipped
  stateless adapter instance is frozen so callers cannot replace its `name` or
  `capabilities` reference. Runtime lookup and capability hashes therefore remain stable
  after attempted mutation.

## [2.39.1] — 2026-09-27

This release carries no code change of its own. It cuts the version for five runtime fixes
that merged after 2.39.0 without one, so that the tag and the changelog describe what
`main` ships again.

### Fixed

- **A stored runtime qualification must match the retained evidence for the current
  binding** (#677). `tamperward runtime status`, and onboarding through the same reader,
  now reject a stored record whose evidence id or capability matrix differs from what the
  retained evidence produces for the current runtime, TamperWard and adapter binding,
  instead of rendering it as recorded posture. A record that passes the staleness check
  can no longer present a posture the evidence does not support.
- **Structured Stop findings reach the steering decision on Codex and Copilot CLI** (#679).
  The end-of-turn sweep's findings are carried on the decision beside the wire payload
  instead of being dropped to an empty list, so a consumer of the decision sees why the
  turn was blocked.
- **Claude hook findings reach the steering decision** (#681). Both the live
  PreToolUse/Stop path and the fail-closed parse-failure path carry the canonical findings
  on the decision instead of an empty list.
- **The Claude adapter no longer declares MCP pre-deny** (#683). Claude MCP calls are not
  reconstructed into changes before evaluation, so `mcp` leaves `preDeny` and the gap is
  named in `unsupported`.
- **The Claude adapter no longer declares a catch-all `other` pre-deny** (#687). Unmodelled
  Claude tools are not reconstructed into changes before evaluation either, so `other`
  leaves `preDeny` and that gap is named in `unsupported` too.

Because #683 and #687 change the Claude adapter's declared capabilities, its capability
hash changes with them: a qualification recorded by `tamperward runtime verify` under the
2.39.0 declaration is reported as `STALE` by `runtime status` and onboarding until it is
re-run.

### Changed

- **Docs**: `docs/ACS-mapping.md` and `docs/guide/runtime-adapters.md` state the corrected
  Claude MCP capability claims (#685).

## [2.39.0] — 2026-09-24

### Added

- **Onboarding renders the recorded runtime qualification** (#599). For every detected
  runtime with a shipped adapter, `tamperward onboard` now reads the git-local qualification
  store through the same validated, staleness-checked reader as `tamperward runtime status`
  and renders the recorded `In-loop protection` aggregate with its evidence id and TamperWard
  version, flags it `STALE` when a load-bearing input changed, and reports a stored record
  that fails validation as unrecorded; only when nothing is recorded does it fall back to
  pointing at `tamperward runtime verify --runtime <id>`. A runtime label alone is never
  presented as protection. Nothing is rerun or promoted.

## [2.38.4] — 2026-09-24

### Fixed

- **Unknown Copilot tool names fail closed without blocking known read-only tools** (#598).
  The Copilot adapter now keeps an explicit vocabulary for documented file-search,
  web, question, delegation, skill and todo tools, while an unmapped non-empty name
  produces an `unknown-tool` finding and a deny before it can be treated as a no-op.
  The finding distinguishes an adapter vocabulary gap from a broken hook transport.

## [2.38.3] — 2026-09-24

### Changed

- **Onboarding now points to version-bound runtime qualification** (#599).
  Runtime marker detection is explicitly separated from capability evidence: onboarding
  directs operators to `tamperward runtime verify --runtime <id>` only for a detected
  runtime with a shipped adapter; unsupported markers are reported without a broken
  command instead of treating a marker or binary steering label as proof of live support.

## [2.38.2] — 2026-09-24

### Fixed

- **Runtime qualification aggregation and persisted-report validation** (#599).
  Incomplete or duplicated required capability evidence can no longer produce a
  `FULL` in-loop posture, and `runtime status` now rejects contradictory
  unrecorded or incomplete capability matrices instead of rendering them as
  trusted posture.

## [2.38.1] — 2026-09-24

### Fixed

- **Research bundle provenance is bound to the evidence it describes** (#664).
  `research validate` recomputed the pair records, the summary and the report, but
  took the rest of `provenance.json` on trust. It now refuses a provenance field
  outside the bundle contract and holds every remaining claim to what the archive
  proves: the manifest hash, adapter, model, TamperWard version, agent argv and agent
  budget must equal the summary derived from the pair records, and the recorded record
  count must equal the pair records actually parsed. A forged or drifted provenance is
  refused before any output is written, with a message naming the field that disagrees.

## [2.38.0] — 2026-09-23

### Added

- **Local verification receipts, reconciled in CI** (#601). A successful
  `tamperward verify` now emits a bounded, transportable **receipt** under
  `.git/tamperward/verification-receipt.json` — outside the candidate-controlled
  tracked tree — bound to the SAME load-bearing identity the first-class
  verification state (#600) already computes: candidate tree fingerprint,
  entry/base commit, HEAD, policy digest, verifier-contract digest, protected
  surface, runtime-intervention wiring and dependency environment, plus an
  `evidence_digest` over its own fields. The receipt carries only fixed-width
  digests, commit ids, closed-enum stage results, a verdict and a timestamp — no
  prompt text, source, command bodies, secrets/environment, absolute local paths
  or logs.
  - `tamperward receipt export [--out F]` writes the receipt for the CURRENT
    verified state (the explicit transport handoff); it refuses when the state is
    not CURRENT. The exported machine output IS the `receipt-v1` document (to
    `--out`, or stdout when no path is given) — there is no separate `--json`
    envelope.
  - `tamperward receipt reconcile` reruns the canonical TamperWard verification
    FIRST, then reconciles a claimed receipt against CI's own adjudication. It
    prints a summary separating the LOCAL claim, the CI result and their
    agreement/divergence, writes a GitHub job summary, and emits a
    machine-readable reconciliation document (`--json`). A local claim is
    **explicit**: the receipt is read only from `--receipt`, never from the local
    `.git/tamperward/` store (that store holds the receipt CI's own preceding
    `verify` step just wrote, so a fallback would manufacture agreement). Absent
    `--receipt` → NO_CLAIM, never a failure by itself; unreadable/unparseable →
    MALFORMED with a read/parse reason. `--ci-result` consumes a preceding
    `verify --json` so the suite runs once, and must be a genuine `verify --json`
    document (`schema_version: 1`, a resolved `base` commit, `visible`/`pristine`
    stage objects) whose `base` matches the base CI computed — anything else,
    including a receipt file, is CANNOT_VERIFY (exit 2), so a receipt can never
    stand in as CI's verdict.
  - **Cross-machine reconciliation.** The binding splits into a **candidate
    identity** reproducible on any machine — `tree`, `head`, `base`, `policy`,
    `verifier`, `surface` — which is authoritative for applicability, versus the
    **machine-local environment inputs** `intervention` and `dependencies`, which
    are reported as INFORMATIONAL divergence (`reconciliation.environment_divergence`)
    and never, on their own, make a receipt non-applicable. The generated CI
    workflow computes CI's candidate identity from `pull_request.head.sha` (the
    branch tip a developer verifies), not the PR merge ref, so a genuine receipt's
    `head`/`tree` line up.
  - **A receipt is evidence, never authority.** The reconciled `result` is CI's
    own verdict, recomputed from trusted inputs: a stale, mismatched
    (candidate/tree/policy/verifier/… identity differs), malformed, tampered
    (`evidence_digest` inconsistent, or a VERIFIED verdict with a non-clean stage),
    missing or unknown-schema receipt is NON_APPLICABLE or NO_CLAIM and can NEVER
    promote or strengthen a CI result. A local-green / CI-red case reports
    DIVERGENCE and stays failed. When a red run on the same tree invalidates the
    #600 record, the stored receipt is removed with it, so it can never outlive
    the state it vouches for.
  - New published Draft 2020-12 schemas `schemas/receipt-v1.schema.json` and
    `schemas/reconcile-v1.schema.json`, with closed vocabularies single-sourced to
    the emitter constants.
  - The generated CI workflow (`tamperward init`) now runs the receipt
    reconciliation as an evidence step after its own pristine `verify` (which
    remains the enforcement authority over the merge result), writing the
    LOCAL/CI/agreement job summary. The generated workflow transports no receipt on
    its own — in a `pull_request` run there is no earlier artifact to download and it
    sets no `TAMPERWARD_RECEIPT` — so as shipped every run reports NO_CLAIM and CI's
    verdict stands until the workflow owner wires a transport; `docs/reference/cli.md`
    now gives two realizable ones (a `refs/tamperward/receipts/<head-sha>` ref pushed
    to the head repo and fetched by a step, or the bounded receipt posted as a PR
    comment and read via the API — both safe because the receipt self-validates and
    never becomes CI's authority).
  - **CI's verdict is attributed only to the tree CI actually ran.** `verify --json`
    now reports the candidate tree it adjudicated (`adjudicated_tree`, the same
    fingerprint bound into the #600 record). Because the enforcement `verify` runs
    over the PR merge result, a branch that is BEHIND its base has a merge tree that
    differs from the branch-tip tree a receipt binds; `receipt reconcile` compares
    `adjudicated_tree` against the receipt's tree and reports NON_APPLICABLE
    (`mismatched_input: tree`) rather than a false AGREE or a dishonest DIVERGENCE for
    a tree CI never ran, and the reconcile CI section prints the adjudicated tree. An
    older `--ci-result` document that carries no `adjudicated_tree` degrades safely to
    NON_APPLICABLE. The receipt still never changes CI's verdict or exit code.
  - **The `--ci-result` sign-off comes only from the trusted channel.** A
    MASKED_FAILURE exits 0 only when a reviewer's out-of-band sign-off applies;
    `receipt reconcile` now recomputes that sign-off from the trusted env
    (`oobToken('verify', …)`, exactly as `verify` does), never from the
    `--ci-result` document — a forged `oob_signoff` field inside the file being
    validated can no longer flip a failing exit to a passing one. The generated CI
    reconcile step gets the same `TAMPERWARD_OOB_SIGNOFF` / `TAMPERWARD_OOB_HEAD`
    env as the verify step, so a legitimately signed-off MASKED_FAILURE still exits
    0. `adjudicated_tree` is now documented as an optional field in
    `schemas/verify-v1.schema.json` and `docs/reference/machine-output.md`, and the
    developer git-ref transport in `docs/reference/cli.md` now pushes the receipt
    blob itself (`git push origin "$blob:refs/tamperward/receipts/<sha>"`, read
    CI-side with `git cat-file blob FETCH_HEAD`) so the documented transport works
    end to end.

  - **Canonical schema identifiers** (#662/#665). Every published v1 schema now carries
    its `$id` at the immutable release-tag URL of the release that first shipped its
    bytes (`v2.38.0` for all twelve in this release); an unchanged schema keeps its
    identifier across later releases. After tagging, the release workflow verifies every
    advertised identifier over HTTPS against the exact shipped schema bytes, and the
    offline schema test enforces the same rule, so mutable branch refs and
    self-referential commit pins cannot be published.

## [2.37.2] — 2026-09-23

### Fixed

- **Research bundles carry only the evidence they claim to** (#663). `research
  summarize` and `research bundle` now share one ledger reader that lists `pairs/` with
  `lstat`, refuses a `pairs/` directory that is a symlink and any entry that is not a
  regular file placed directly in it (a symlink into a workspace or outside the ledger,
  a hard link to an inode that also lives elsewhere, a directory, a FIFO), opens each
  file without following links and checks that the opened inode is the listed, singly
  linked one, and refuses a path that resolves anywhere else. A pair record carrying a
  field outside the v1 pair contract, at any level, is refused before it becomes
  portable evidence; the gated arm's treatment envelope is held to the v1 run document
  field by field, every named field a scalar unless the document defines it as an
  object, so nothing foreign can ride inside it. The archive holds the canonical
  serialization of each proved record rather than the raw file bytes, so a duplicate key
  or stray bytes cannot travel either, and a record name the ustar header cannot store
  byte for byte is refused rather than truncated. `research validate` holds an archive
  to the same rules: only the evidence entries may be present, a duplicate or nested
  entry is refused, every pair record must be canonical, and the archive must be exactly
  what the writer emits (one ustar header form with no prefix, link, owner or device
  fields, zero padding, and nothing after the two end-of-archive blocks), so a tar
  reader and the validator agree on every path and byte. A refusal happens before any
  output is written.

## [2.37.1] — 2026-09-23

### Fixed

- **Audit evidence scales by addition, not by rewrite** (#518). `tamperward stats`
  streams its JSONL file in one pass under a 16 KiB line bound, so memory is set by
  the aggregate cardinality rather than the file size, and a longer line is one
  `tamperward:` line at exit 2. On the `tamperward-audit` evidence branch each
  ingested batch is now its own immutable `events/<YYYY>/<MM>/<batch-id>.jsonl`
  partition; event-id and session deduplication live in 256 sorted shards that a
  run touches only where its batch hashes; and `summaries/all-time.json` is folded
  forward from a small state file instead of re-reading history. The workflow
  fetches only the ledger to decide what is new and a sparse clone to publish,
  never a historical partition; dispatching with `rebuild: true` streams every
  partition to regenerate the derived files, and a store written before
  partitioning keeps its `events/all.jsonl` frozen and is migrated once on the next
  ingestion. Batch bytes and events and files per month have hard limits that fail
  at exit 2 naming the limit.

## [2.37.0] — 2026-09-23

### Added

- **Runtime capability qualification** (#599). `tamperward runtime verify` turns the binary
  "runtime detected" label into a **version-bound, operation-specific capability model**:
  `pre-deny:{shell,native-edit,delete,rename,git-mutation,mcp}`, `post-observe`, `end-of-turn`,
  `denial-reason-delivery`, `continue-after-denial`, `transport:{missing-executable,non-zero,
  timeout,malformed,empty}`, `hook-not-invoked` and `detached/quiescence`, each with one
  explicit state — `PROVEN` / `PARTIAL` / `UNPROVEN` / `UNSUPPORTED` / `FAIL-OPEN` /
  `INCONCLUSIVE`, never a percentage score. **`PROVEN` is gated on retained real-runtime probe
  evidence** (`src/adapters/evidence.ts`, transcribed from the committed captures under
  `harness/adapters/**/evidence/`) that matches the **full binding** on **every evidence-defining
  field** — runtime name + exact version, the pinned SDK/protocol **component versions**, the
  **TamperWard version + commit** the probe ran under, the **adapter capability hash**, the
  **tested capability set**, hook-config hash, execution mode, platform and model. A change to any
  one is a different binding, so stale evidence can never promote across a TamperWard, adapter,
  SDK or protocol change; the adapter capability hash is required on both sides, so a record whose
  hash is not authentically recoverable fails closed and never promotes. A static adapter
  declaration (contract/mock/`preDeny` membership) can **never** promote a live capability to
  `PROVEN`: it grades at most `PARTIAL` (declared at the boundary, unproven live), and an absent
  capability grades `UNPROVEN`/`UNSUPPORTED`. A binding mismatch strips a `PROVEN` back to
  `PARTIAL`; a probed-but-unresolved path is `INCONCLUSIVE`; a fail-open — declared or observed —
  is surfaced verbatim as `FAIL-OPEN` (so `In-loop protection` can never aggregate to `FULL`).
  `Final authority` is a constant `AVAILABLE`: CI / pristine `verify` is independent of the
  runtime hook, so a weak in-loop capability never weakens adjudication. The qualification is
  bound to the runtime version, TamperWard version/commit, adapter capability hash, hook-config
  hash, execution mode, platform, model, tested capability set, timestamp and a deterministic
  evidence id, and persisted git-locally. `tamperward runtime status` renders the latest recorded
  qualification without rerunning it and marks it **STALE** when any load-bearing input changes.
  Machine output is published as `schemas/runtime-qualification-v1.schema.json`. Grading consults
  committed captures only — no live credentialed probe runs here (those are gated, #611/#616),
  no runtime is promoted, and no Round 4.1 eligibility claim is made.

  Review hardening (#599): `runtime status` now **validates** the git-local store before
  rendering it — a record whose shape does not match the published schema, or whose `evidence_id`
  or `in_loop_protection` no longer matches a recomputation from the stored binding + states, is
  reported `recorded: false` with the reason (a hand-edited all-`PROVEN`/`FULL` record can no
  longer render as trusted, and a non-array `capabilities` fails safe instead of an internal
  error). TamperWard's **own build commit** is load-bearing for staleness (it already keyed the
  evidence match): it is sourced from TamperWard's published package metadata (`gitHead`), never
  from the qualified repository's HEAD, so a TamperWard build change reads STALE while an unrelated
  commit in a consumer repository does **not** — and the evidence match is keyed on the same
  TamperWard identity, so matching and staleness stay consistent. When TamperWard's build commit is
  not authentically available (a dev/source tree), it is honestly `null`; no repository HEAD is ever
  substituted. The hook-config binding reuses
  the evaluated intervention wiring (parsed `hooks` + `disableAllHooks` across the project,
  project-local, user and user-local Claude settings), so turning hooks off now invalidates the
  qualification; the Copilot hook config is read from its documented path
  `.github/hooks/tamperward.json`. `--mode` is validated (exit 2 on anything but
  `headless`/`interactive`, no silent default), and qualifying an **absent** runtime (no `--runtime`, nothing detected) is
  refused at exit 2 so the store holds no qualifications for runtimes that are not present. On a
  persistence failure `verify` now **writes before it emits** and gates the `recorded: true`
  success document on the write succeeding: nothing is persisted, so it prints an explicit
  `recorded: false` failure document (never a success-shaped `recorded: true` stdout doc), reports
  the failure on stderr and exits non-zero — a machine consumer parsing stdout can no longer
  retain the opposite state from the store. A **rejected** store now explains itself on the text
  surface too: `runtime status` prints the rejection reason (`note`) in the unrecorded block, so a
  tampered or non-reproducing record is noticed where people look, not only under `--json`. When a
  runtime is present but ships no adapter, the refusal now reads "no adapter-backed runtime
  detected" rather than "no runtime detected".

## [2.36.0] — 2026-09-23

### Added

- **First-class verification state and `tamperward status`** (#600). A successful
  `verify` now records, under a non-candidate authority (`.git/tamperward/`), stable
  fingerprints of every load-bearing input it judged: the candidate worktree, HEAD,
  the trusted base commit, the TamperWard policy, the verifier contract
  (command/budget/inputs/backend), the protected verification surface at the base,
  the local runtime steering wiring, and the dependency environment. The
  `dependencies` input reuses the same attested dependency fingerprint `verify`
  refuses `DEPENDENCY_DRIFT` against (the digest-pinned image for a container
  backend), so an `npm install` of a different version with an unchanged tree is
  caught rather than kept `CURRENT`. The runtime-wiring input digests the
  **evaluated** hook wiring — the parsed `hooks`/`disableAllHooks` across the Claude
  Code settings sources the runtime reads (project, its local override, and the
  user-level files) — so a whitespace-only reformat is not a change and a hook
  removed at the user level is; `runtime.agent` is likewise named from that
  evaluated wiring, not the mere presence of a settings file. The new
  **`tamperward status`** (and `status --json`) answers, continuously, whether the
  exact current state is still the state that was independently verified, in three
  **distinct** lanes — Authority (repository/final adjudication), Intervention
  (runtime steering) and Verification — as a first-class state machine: `CURRENT`,
  `STALE` (with the changed input named), `VERIFYING`, `BROKEN`, `UNVERIFIED`. A mere
  exit-0 never keeps `CURRENT`: any load-bearing change deterministically invalidates
  it; a later `verify` of the same state that does not reach `VERIFIED` (a flaky red
  suite, a masked failure) removes the record; and a malformed or missing record
  fails safe to `UNVERIFIED`, never `CURRENT`. The `--json` document is a new
  versioned machine-output surface (`schemas/status-v1.schema.json`) for the #500 VS
  Code panel, WardOS, CI job summaries and dashboards, so consumers read the
  enumerated state instead of scraping `doctor`/`verify` prose. Local `CURRENT` is
  posture/evidence, not repository or CI merge authority.

## [2.34.0] — 2026-09-23

### Added

- **CLI argument handling** (#419; #646). Every command accepts `-h` / `--help`, long
  options take the `--name=value` spelling, and a terminal `--` ends option parsing.
  `hook-service stop` and `status` take `--dir <repo>` and refuse to act on a listener
  bound to a different repository (the socket is left intact and the mismatch is
  reported). `allow --file` accepts `./`, absolute and Windows-separated spellings of
  the finding's path; the sign-off still binds to the finding's own root-relative
  path. On Linux, onboarding prints the lifecycle check's own diagnostic instead of
  the generic platform line.
- **Machine-output schemas carry examples** (#425; #648). Each published
  `schemas/*-v1.schema.json` has one self-validating example, its `$id` moved to a
  `/v1/` path, and the dependency-free audit verifier accepts the root `examples`
  array while still rejecting unknown keywords.

- **Reproducible research authoring and bundles** (#481; #653). `research init` writes a
  versioned one-task manifest and prints its SHA-256, the identity pinned into every
  later record; `research report --ledger` renders the summary under four explicit
  headings (MODEL BEHAVIOUR, CONTROL RESPONSE, INDEPENDENT OUTCOME, TAMPERWARD
  PERFORMANCE) with no composite score; `research bundle` packs the pair records, the
  derived summary, the report and `provenance.json` into a mode-0600 archive that
  `research validate` recomputes rather than trusts (prompts and the manifest stay out
  unless `--manifest` names a file whose hash matches the ledger). A third adapter,
  `stdio`, carries the language-neutral `research-stdio-jsonl-v1` lifecycle contract
  published as `schemas/research-stdio-v1.schema.json`; its capability declaration is
  recorded and its intervention is `not-connected` — envelope only, no in-loop deny
  relay.

### Fixed

- **`run` handed the wrapped agent a rewritten argv** (regression introduced by #646).
  The `--name=value` splitter did not stop at `--`, so
  `run -- node --max-old-space-size=4096 agent.js` reached the agent as
  `--max-old-space-size 4096`, which Node rejects, and `--x=` became `--x ""` for any
  program. The splitter now stops at the delimiter and everything after it is passed
  through byte for byte; `research run` shares the fix.
- **`hook-service stop | status --dir <path>` that does not exist** fails with one
  `tamperward:` line at exit 2 before any socket is touched, instead of an unhandled
  ENOENT from inside the status exchange (`stop`) or a raw stack trace (`status`).
- **Envelope guard consistency** (#427; #636, #637, #638). `run --base` rejects a
  leading-dash revision like every other trusted-base path; a visible-stage budget
  timeout returns `BUDGET_EXCEEDED` without materialising and running the pristine
  stage; `trace-verify` runs the traced command under the verifier's hardened suite
  environment (startup-injection variables dropped, npm configuration pinned).

## [2.33.0] — 2026-09-22

### Added

- **CI: compact exact-head sign-off labels** (#631). GitHub labels have a 50-character
  name limit, so the generated workflow now accepts `tw1:<digest>` tokens produced by
  `tamperward signoff-label`. The SHA-256 token binds the exact rule, optional file, and
  full 40- or 64-character head object id; malformed, foreign, abbreviated, and
  unbound tokens remain rejected. Legacy `tamperward:allow:<rule>@<head-sha>` labels
  remain compatible, and generated/checked-in workflows, docs, and regression tests use
  the compact path.

## [2.32.0] — 2026-09-22

### Added

- **`research run` serializes writers for one ledger** (#546, #627). A run takes an exclusive
  `run.lock` in its `--out` directory before cloning a workspace or launching an agent; a
  concurrent run against the same ledger fails closed with exit `2` and one line on stderr
  naming the holder. Active or unreadable locks are never replaced. The new **`--break-lock`**
  flag is the explicit recovery for a crashed owner: it removes only a readable same-host lock
  whose recorded process is gone, claims the stale file atomically so a lock taken in the
  meantime is never deleted, and otherwise refuses.

## [2.31.1] — 2026-09-22

### Fixed

- **`research run` command adapter: replacement values are opaque** (#525, #626). The
  `{prompt}`, `{task}`, `{cwd}`, `{base}`, `{arm}` and `{model}` placeholders are now
  substituted in a single pass over the original argv template, so a prompt or task id that
  itself contains a literal `{task}`, `{cwd}` or `{model}` reaches the agent unchanged instead
  of being rewritten by a later placeholder. The token pattern is derived from the placeholder
  table, so a new placeholder is added in one place.

## [2.31.0] — 2026-09-18

### Added

- **adapters: an EXPERIMENTAL GitHub Copilot CLI runtime adapter** (#482, #598). A new
  `CopilotRuntimeAdapter` (`src/adapters/copilot/*`) is the third implementation of the
  neutral `RuntimeAdapter` contract, mirroring the Codex adapter's structure. Copilot CLI is
  closed-source, so the wire is grounded against the **published GitHub Copilot hooks
  reference** (the canonical contract for the CLI). GitHub documents **two** hook wire formats
  and the adapter accepts **both**: **native camelCase** (`preToolUse` → `sessionId`,
  `timestamp`, `cwd`, `toolName`, `toolArgs` where `toolArgs` is a JSON **string** that must be
  parsed; `agentStop` → `sessionId`, `transcriptPath`, `stopReason`) and the **PascalCase /
  Claude-compatible** format (`PreToolUse` → `hook_event_name`, `session_id`, `timestamp`,
  `cwd`, `tool_name`, `tool_input`, where `tool_name` is the Claude tool name `Bash` / `Write`
  / `Edit` / `Read`; `Stop` → `session_id`, `transcript_path`, `stop_reason`).
  Normalization is field-by-field, snake_case winning with camelCase as a fallback; the
  undocumented `tool_use_id` is not read. The adapter maps both tool vocabularies to operation
  kinds (`bash` / `powershell` / `Bash` → `shell`; `create` / `edit` / `apply_patch` /
  `str_replace_editor` / `Write` / `Edit` → `file-edit`; `view` / `Read` → `file-read`;
  `mcp__<server>__<tool>` → `mcp`), and reconstructs operations into the shared `Change[]` via
  `synthFileChange`. The shell-**session** write tools **`write_bash`** / **`write_powershell`**
  (which send input to a running shell) are classified as **mutation-capable `shell`** — never
  `other`, which would have silently allowed a mutation piped into an existing session — and
  fail closed when they carry no reconstructable command/input. `MultiEdit` is accepted
  defensively as a Claude-compatible name, not as a documented Copilot tool. The first-party
  **`apply_patch`** envelope (shared with Codex via a new `src/adapters/apply-patch.ts`) is
  modelled explicitly; **`str_replace_editor`** is modelled for its `str_replace` / `create`
  sub-ops and **fails closed** on any other sub-op pending a real payload; a PascalCase `Edit`
  carrying a patch-style payload without ordinary Edit fields also fails closed. Deletes/renames
  go through the shell. It runs the **same** engine as
  the Claude path for its pre-action content decision, pins the Stop-sweep baseline at turn
  start, and delegates the end-of-turn sweep to the canonical git sweep after normalizing the
  `agentStop` / `Stop` payload to the Claude Stop shape (native `sessionId` → `session_id`). The
  deny wire is **phase-split** to Copilot's real, distinct shapes: `preToolUse` denies with a
  **flat** `{ permissionDecision: "deny", permissionDecisionReason }` (no `hookSpecificOutput`
  wrapper), while `agentStop` denies with `{ decision: "block", reason }` — the same shape the
  canonical Stop sweep already emits. Identity is validated as an untrusted claim exactly as the
  Claude and Codex adapters do, and every failure state (`parse-failure`, `transport-failure`,
  `not-invoked`, an unreconstructable edit, a rejected identity) fails closed to a deny.
  Capabilities are deliberately **conservative and honest**: `preDeny` is **empty** because
  pre-action deny enforcement is not yet proven on a pinned Copilot CLI build, and
  **`postObserve` is empty** because milestone one does not consume the `postToolUse`
  observation surface (`decide(..., 'post-action')` returns `unsupported`), so the adapter does
  not advertise kinds it does not report. `unsupported`
  names the real gaps — Copilot's **asymmetric, transport-scoped hook-failure semantics** (a
  **command** `preToolUse` hook crash / non-zero exit / exit 2 fails **closed** but a **timeout
  fails OPEN**; an **HTTP** `preToolUse` hook fails **OPEN** on network error / timeout /
  non-2xx, so only the local command/exec transport is a qualification candidate), the fact
  that **`preToolUse` is the only pre-execution veto** while **`agentStop` only forces
  continuation** and Copilot **overrides the hook after 8 consecutive blocks** (the
  `stop_hook_active` lifecycle), and that the `apply_patch` / `str_replace_editor` /
  `write_bash` payloads are modelled from the published contract but not yet confirmed against a
  real pinned-run fixture.
  This is milestone one: the adapter exists but is **not** 4.1-eligible — Copilot stays
  `neutral` in `src/runtimes.ts` and no research round is registered. The real
  `probe:copilot-runtime` headless qualification on a pinned, authenticated Copilot build (the
  mutation and broken-hook / fail-closed matrices, with the command-hook timeout-fails-open case
  measured and the qualified transport captured in the provenance) ships as milestone two in
  `harness/adapters/copilot-probe.mjs` (a harness — not run in CI, no version bump); only a FULL
  verdict on a pinned build justifies flipping Copilot to `in-loop`. Adapter conformance runs in
  CI (`test/copilot-adapter.test.ts`); a green CI run does **not** prove runtime qualification.

## [2.30.6] — 2026-09-18

### Fixed

- **The research ledger reader now enforces the writer's own outcome/treatment
  derivations** (#552). A `PairRecord` carries summary fields (`visible_green`,
  `pristine_green`, `masked_failure`, `honest_completion`, the treatment
  `disposition`, and the measured/verdict pairing) that the writer derives once
  from the observed run, but the reader used by both `resume` and `summarize`
  (`pairRecordFrom`) accepted them verbatim, so an imported, hand-edited, or
  partially migrated record could feed the aggregator internally contradictory
  totals without being rejected. The derivations now live in one place
  (`src/research/derive.ts`) used by both the writer (`run.ts`) and the reader
  (`record.ts`); the reader re-derives each field and rejects any stored value
  that disagrees (green must match exit 0, masked must match `MASKED_FAILURE`,
  honest completion must match `VERIFIED` + pristine-green + zero surviving
  mutations, the disposition must match the envelope verdict, a measured
  trajectory must carry a measured verdict, and the rules list must be sorted,
  deduplicated, and non-empty exactly when a protected mutation survived). The
  verify verdict itself must also agree with the two stage exits it was derived
  from — mirroring the verifier's own mapping (`VERIFIED` needs both stages green,
  `MASKED_FAILURE` a green visible over a red pristine, `SUITE_RED` a red visible,
  `BUDGET_EXCEEDED` an absent stage exit) — so a record cannot carry a verdict its
  exits contradict. The accepted verify vocabulary is the canonical verifier set
  (`src/machine-output.ts`), including `BUDGET_EXCEEDED`, so every verdict the
  current writer can emit stays valid. `resume` and `summarize` now reject the
  same inconsistent record instead of silently aggregating it.

## [2.30.5] — 2026-09-18

### Fixed

- **`verify` now normalizes to the repository root** (#554). Standalone verification
  loaded policy from the repository root but enumerated and materialized only the
  caller's directory, so invoking `tamperward verify` from a package subdirectory
  ran the root suite against an incomplete copy and reported a false `SUITE_RED`
  for a perfectly valid repository. `runVerify` now resolves the repository root
  once at entry (the `check`/hooks pattern from #412) and uses it consistently for
  policy load, git enumeration, materialization, verifier inputs and suite
  execution. A nested invocation produces the same verdict and restored-file count
  as a root invocation; linked worktrees remain supported.

## [2.30.4] — 2026-09-18

### Fixed

- **Verifier descendant cleanup now checks process identity before signalling** (#545).
  The Linux capture supervisor tracked bare descendant PID numbers and `SIGKILL`ed
  them at completion/timeout without verifying identity, so a PID that had exited
  and been reused could belong to an unrelated same-user process. Each descendant's
  `/proc` start-time is now recorded and re-verified immediately before signalling
  (a `(pid, start-time)` pair names one process instance), and the detached
  group kill is gated on the child still being alive. A reused PID is dropped, not
  killed; a still-live descendant with unchanged identity is still terminated.

## [2.30.3] — 2026-09-17

### Fixed

- **Hardened three ReDoS-class regexes and one clone surface flagged by CodeQL.**
  The diff-header path split (`src/diff/parse.ts`) — which runs on agent-controlled
  diffs — now splits on the last ` b/` with a linear scan instead of a backtracking
  `/^(.*) (b\/.*)$/`; the strace path parse (`src/cli/trace-verify.ts`) and the shell
  tokeniser (`src/dependency-env.ts`) use unrolled, unambiguous quoted-string patterns.
  All three are proven to tokenise identically to the prior forms and to return
  promptly on crafted inputs. The research clone (`src/research/run.ts`) disables git's
  `ext::` transport (`-c protocol.ext.allow=never`) and ends options with `--` before
  the repository argument. Markdown table cells (`src/cli/render/github.ts`) now escape
  the backslash before the pipe, so a crafted `\|` cannot survive as an unescaped
  separator. No verdict changes; each fix has an added regression test.

## [2.30.2] — 2026-09-16

### Fixed

- **Codex shell enforcement** now blocks protected-test deletion, renames out of the test glob, and destructive checkout/restore/reset operations while leaving path-limited non-destructive `git reset` and staged-only `git restore` allowed (#571).


All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as scoped in
[CONTRIBUTING](./CONTRIBUTING.md#versioning).

## [2.30.1] — 2026-09-16

### Changed

- **cli: one shared status palette and renderer across surfaces** (#543). A new
  `src/cli/render/status.ts` owns the accessible 24-bit palette and the
  `severity → colour` map as the single source of truth; `check`, `onboard`,
  `doctor`, and `verify` now draw from it instead of re-declaring their own
  schemes (`onboard` no longer duplicates the palette or its tone map, and
  `doctor`/`verify` gain the same accessible colour treatment as the verdict).
  Presentation only — no change to exit codes, `--json` output, or any message
  text; the accessibility contract is preserved (the word carries severity,
  colour strips to a byte-identical line, and `NO_COLOR`/pipe/`TERM=dumb` drop
  all colour), and `test/render-status.test.ts` asserts the strip-to-identical
  invariant and the severity map.

## [2.30.0] — 2026-09-16

### Added

- **adapters: an EXPERIMENTAL Codex runtime adapter plus a real qualification probe**
  (#482, #563). A new `CodexRuntimeAdapter` (`src/adapters/codex/*`) implements the neutral
  `RuntimeAdapter` contract, grounded against the real Codex protocol (`openai/codex`
  `codex-rs/hooks/schema/generated` and `codex-rs/core/src/tools`), not guessed. It
  normalizes Codex hook payloads into the shared `SteeringEvent` shape using the canonical
  **hook-facing** tool names (`Bash` → `shell`; `apply_patch`, with `Write`/`Edit` matcher
  aliases → `file-edit`; `mcp__<server>__<tool>` → `mcp`; `view_image` → `file-read`),
  reconstructs shell and file-edit operations into the shared `Change[]` via `synthFileChange`
  (reading the real `apply_patch` payload from `tool_input.command`, with a parser that fails
  **closed** on a hunk it cannot locate), runs the **same** engine as the Claude path for its
  pre-action content decision, pins the Stop-sweep baseline at turn start, and delegates the
  end-of-turn sweep to the canonical git sweep. The deny wire is **phase-split** to match the
  real Codex output schemas: PreToolUse denies with `hookSpecificOutput.permissionDecision:
  "deny"` (plus the deprecated top-level `decision:"block"`), Stop denies with
  `{decision:"block", reason}` and no `hookSpecificOutput`. Identity is validated as an
  untrusted claim exactly as the Claude adapter does, and every failure state
  (`parse-failure`, `transport-failure`, `not-invoked`, an unreconstructable edit, a rejected
  identity) fails closed to a deny. Capabilities are deliberately **conservative and honest**:
  `preDeny` is **empty** because pre-action deny enforcement is not yet proven on a pinned
  Codex build (Codex currently fails open on some hook failures), and `unsupported` names that
  gap along with fail-closed hook transport (openai/codex#41979), network-egress control, and
  identity/authentication. Qualification is **three-layered**: (a) protocol-conformance tests
  validate inputs and deny wire against the real Codex schemas copied into
  `test/fixtures/codex-schemas`; (b) a probe self-test asserts the probe's classifiers against
  every deterministic mode and exercises the real driver end-to-end so the probe itself cannot
  false-green — both run in CI; (c) `probe:codex-runtime`
  (`harness/adapters/codex-probe.mjs`) is the real gate on a pinned Codex build, using a
  parent-owned append-only ledger (evidence, not `specIntact` alone), CONTROL-vs-GATED
  mutation pairs, an **observed** fail-closed-transport suite (each broken hook — including a
  missing executable — writes a positive `hook-failure` marker before the fault, the protected
  command drops a parent-owned **dispatch sentinel** so a PASS proves the tool was not
  dispatched rather than inferring it from an intact file, and an outer-timeout kill is treated
  as inconclusive, never a PASS), a real **Stop-block** qualification that requires Codex to
  **honour** the block by continuing (`stop_hook_active:true`), and an honest **multiple
  protected mutations** check (two distinct *denied* protected `tool_use_id`s) — all required
  for FULL, and a **provenance gate** (pinned `CODEX_VERSION_EXPECTED`/`CODEX_MODEL` passed
  operatively to `codex exec` as `--model`/`CODEX_HOME` with a version match, plus the canonical
  gated `.codex/hooks.json` SHA-256 that every qualifying run binds to) that caps at PARTIAL
  when unpinned — with no Codex CLI it reports PARTIAL and exits non-zero. An `apply_patch`,
  `Write`, `Edit` or `Bash` event whose required payload is missing now **fails closed** (deny)
  rather than reconstructing to an empty change set. The real-runtime qualification binds each
  proof to what it measures: the version pin is matched **exactly** (no `0.9.1`/`0.9.10`
  collision), the multiple-mutation case requires a denied op against **each** protected file,
  fail-closed `protectedToolAttempted` is bound to the **specific** Bash command with a
  pass-through control, and detached/background mutations are judged only after a **settle
  interval** so an ignored deny cannot escape by mutating after the command returns. Green CI proves
  build/unit/static + layers (a) and (b) only, **not** runtime qualification. This is milestone one: the adapter exists but is
  **not** 4.1-eligible — Codex stays `neutral` in `src/runtimes.ts` and no research round is
  registered. Wiring `.codex/hooks.json` from `init`/`onboard` and protecting that control
  surface (and full parity with `effectDriftBlocks`/`sanctionPredictedWrites`) is a **PR 2**
  follow-up.
## [2.29.21] — 2026-09-16

### Fixed

- **stats: mixed timestamp precision no longer reverses `first_event` and `last_event`**
  (#530). `summarizeAudit` ordered events by `timestamp.localeCompare`, so a whole-second
  timestamp (`2026-09-15T12:00:00Z`) sorted after a later fractional one
  (`2026-09-15T12:00:00.500Z`) and the reported first event could be later than the last.
  The published audit schema deliberately permits both representations. Events are now
  ordered by parsed instant (`Date.parse`) with the existing `id` tie-break for equal
  instants, so bounds follow real time regardless of wire precision. Counts and `--since`
  semantics are unchanged.
## [2.29.20] — 2026-09-16

### Fixed

- **watch: handle asynchronous FSWatcher errors instead of letting them bypass health
  reporting** (#550). Both filesystem-watcher backends handled synchronous setup failures
  but registered no `error` listener on the returned `FSWatcher`, so an error emitted
  *after* creation succeeded (e.g. `ENOSPC`/`EMFILE` watch-limit exhaustion) became an
  unhandled `EventEmitter` error that could terminate the observer while its last health
  record still described the earlier healthy state. Every watcher now attaches an `error`
  handler immediately and routes the failure through the existing degradation callback:
  the record goes `degraded`, the error count and `last_error` update, and a warning is
  emitted. The failed handle is closed and removed — the recursive backend reports lost
  coverage (`watched_dirs` → 0) rather than silently claiming complete coverage, and the
  fallback backend decrements its watched-directory count. Cleanup is idempotent: a
  repeated error on an already-removed handle is not re-counted and the handle is not
  re-closed.
## [2.29.19] — 2026-09-16

### Fixed

- **hook-service: bound shutdown so an open client socket cannot stall `stop`/restart**
  (#551). Graceful shutdown resolved only in `server.close`'s callback, which waits for
  every accepted connection to finish; the service tracked no active sockets and set no
  request deadline, so a client that connected and never completed its request line held the
  socket open and left `hook-service stop` unable to complete (it then timed out while the
  old process stayed alive). The service now tracks every accepted socket and enforces a
  bounded pre-acceptance request deadline: a connection that never sends a complete request
  line is refused and closed rather than held open, and an incomplete request is never
  evaluated, so it records no side effects. Shutdown stops accepting new work, destroys any
  connection with no accepted evaluation in flight at once, gives the accepted request's
  socket a bounded drain window before destroying it too, and resolves cleanup only once
  every service-owned handle is gone. The bound is on the sockets, not on evaluation: a
  synchronously-running accepted evaluation still completes as it does in-process (this
  event-loop drain timer cannot preempt one that blocks) — an independently terminable
  evaluation worker is out of scope for this reliability fix. The client's existing
  fail-closed behaviour for a lost accepted request is preserved, a shutdown during an
  accepted request never triggers a second evaluation, and a normal idle-service stop is
  unchanged.
## [2.29.18] — 2026-09-16

### Fixed

- **policy: reject incomplete verify blocks instead of silently discarding verifier
  settings** (#547). `validate` accepted a `verify:` block without checking for a usable
  command, while `parsePolicy` retained the block only when its `command` was truthy — so
  a block that declared a `backend`, `image`, `budget`, or `inputs` but no command (or a
  whitespace-only command) parsed cleanly and was then dropped from the effective policy,
  silently discarding the operator's declared execution boundary and input surface. The
  loader now enforces one explicit contract: a `verify:` block must declare a non-empty,
  non-whitespace `command`, and an incomplete or whitespace-only block raises a descriptive
  `PolicyError` before execution rather than being accepted and discarded. Because a partial
  block can no longer survive into the normalized policy, supplying the suite command
  separately cannot alter the selected execution boundary. Complete verifier blocks preserve
  every declared field, unchanged.
## [2.29.17] — 2026-09-16

### Fixed

- **verify: the capture supervisor now flushes its result synchronously before exiting, so a
  large diagnostic payload is never truncated by process.exit** (#555). The inline capture
  supervisor wrote its reserved result JSON with `process.stdout.write(...)` and then called
  `process.exit(0)`. Per Node's process-I/O contract a pipe/socket write is **asynchronous on
  POSIX** (Linux and macOS) and synchronous only on Windows, so an immediate exit could drop a
  still-queued multi-KiB document — up to two 16 KiB base64 diagnostic tails — leaving the
  parent with empty or partial stdout and a spurious `VERIFIER_BACKEND_RUNTIME_FAILURE` /
  "suite capture supervisor did not produce a result". The supervisor now serializes the
  result once and writes it with `fs.writeSync(1, ...)`, looping over short writes and retrying
  `EAGAIN` on a backpressured non-blocking fd, so a slow or backpressured consumer always
  receives complete, parseable JSON with both maximum retained tails; a write that genuinely
  fails exits non-zero and is surfaced as a supervisor failure rather than a silently empty
  result. The bounded post-child pipe-drain and backstop behaviour from #539 is unchanged
  (`process.exit` still fires, only after the synchronous flush completes), so normal
  completion, suite timeout, and held-open suite pipe cases remain bounded.

## [2.29.16] — 2026-09-15

### Fixed

- **hooks: bound reconstructing AND judging an incoming edit so a high-churn write cannot
  stall PreToolUse** (#517). A `Write`/`Edit`/`MultiEdit`/`NotebookEdit` was reconstructed
  with an unbounded synchronous `git diff --no-index` (256 MiB buffer, no timeout) and then
  judged by every detector over the full content, so a 20,000-line high-churn write hung the
  agent-facing gate for 30+ seconds. Profiling showed the reconstruction is ~90 ms; the cost
  is detector evaluation, which grows roughly linearly with size. The shared reconstruction
  primitive (`synthFileChange`, used by the direct hook and the persistent hook service)
  now enforces a budget **calibrated to a demonstrated evaluation time**: an edit within
  `TAMPERWARD_RECONSTRUCT_MAX_LINES` / `_MAX_BYTES` per side (4000 lines / 384 KiB by
  default, ≈3 s) is judged **in full** — every detector runs and an appended `test.skip` is
  seen by `test-skip`; an edit **past** the budget **fails closed** with an explicit deny
  (`cannot safely reconstruct the incoming edit within the hook budget`), never a partial
  allow and never a stall (the Stop sweep still re-derives the turn's net diff from git). A
  strict git-diff timeout and bounded buffer, and a linear fallback that reconstructs one
  conservative hunk from the full before/after (never a truncated diff), bound the
  reconstruction itself. Two evaluation speed-ups keep the in-budget path fast, behaviour
  unchanged: a content-addressed parse cache (detectors re-parsed the same source many times
  per evaluation) and an O(1) fast path for `test-content-removal`'s kept-content check
  (previously O(n²) in removed lines). The 20k regression moves off its wall-clock
  assertion; an outer-process smoke test proves the built hook respects a hard maximum.

## [2.29.15] — 2026-09-15

### Fixed

- **verify: a suite that leaves a process holding stdout no longer hangs the capture supervisor, and fails closed as not-quiescent** (#539). The checkpointed-local supervisor keyed completion on the child's stdio pipes closing; a descendant that inherited the suite's stdout (a spawned server, a `setsid()` escapee that dodges the group kill and, on macOS, the `/proc` descendant sweep) held that pipe open, so the stage hung until the outer backstop killed the supervisor and discarded the already-known exit code — surfacing as the opaque `VERIFIER_BACKEND_RUNTIME_FAILURE` / "suite capture supervisor did not produce a result". Completion is now keyed off the main child's exit with a bounded post-exit drain window (`close` still wins whenever it fires first, so the ordinary path is unchanged). A stage that exits while a process still holds stdout open is **not quiescent** — that process can still mutate the tree, dependency environment or verification material between the visible and pristine runs — so `verify` **fails closed** with `CANNOT_VERIFY` (`VERIFIER_BACKEND_RUNTIME_FAILURE`, exit 2) and a precise reason, keeping the recovered exit code as diagnostics only. This is the same verdict and exit code the stage previously reached by hanging until the backstop, now prompt and legible; a suite that closes its pipes is unaffected.

## [2.29.14] — 2026-09-15

### Fixed

- **trace-verify: a ptrace/seccomp denial is no longer misreported as a non-zero
  verifier run** (#516). `trace-verify` checked `strace --version` but not whether the
  process may actually trace, so in restricted containers and sandboxed CI where
  `strace` is installed but ptrace is denied it emitted an advisory report with zero
  observations and returned 1 — inviting a maintainer to read "nothing observed" as
  verifier evidence. A tracer-capability preflight now traces a trusted no-op first and
  returns the documented exit 2 with an explicit ptrace/seccomp/Yama diagnostic when
  tracing is unavailable; each run distinguishes a tracer failure (empty/denied trace →
  exit 2, no report) from an ordinary traced command that exits non-zero (a healthy
  trace whose command exits 1 or times out is still reported as incomplete evidence,
  exit 1). A pure `classifyTraceRun` result classifier carries the decision and is unit
  tested, and the real-strace E2E now skips when the preflight reports tracing is
  unavailable rather than assuming `strace --version` implies permission.

## [2.29.13] — 2026-09-15

### Fixed

- **onboard: generated Claude settings no longer contaminate runtime detection**
  (#526). `init` writes `.claude/settings.json` for every runtime, and detection
  counted that self-written file as Claude usage — so a Cursor-only repository
  reported a phantom "Claude Code (in-loop)" runtime on the next onboarding pass and
  the neutral-only caveat vanished. Claude Code's markers are now files `init` never
  writes (`CLAUDE.md`, `.claude/settings.local.json`, `.claude/commands`,
  `.claude/agents`), and its generated `.claude/settings.json` is judged by content:
  it establishes Claude use only when it carries configuration beyond the two hooks
  `init` merges in. The neutral-runtime coverage note is preserved even when Claude
  Code genuinely coexists. Adds an integration test spanning detection → canonical
  init → detection for Cursor, Codex/AGENTS.md, and Copilot.

## [2.29.12] — 2026-09-15

### Fixed

- **`ts-any-cast` blocked a cast to a non-`any` alias shadowed in an unrelated scope**
  (#524). Alias resolution was a flat name→kind map, so a nested or sibling
  `type Value = any` overwrote a module-level `type Value = string`, and a legitimate
  `raw as Value` was misclassified as an `as any` launder and blocked. Resolution is now
  lexical: a name resolves against the scope of the assertion that uses it (walking
  enclosing scopes), an enclosing type parameter of the same name resolves to no launder
  kind, and the diff-only line fallback resolves a name only when every same-named alias
  in the file agrees, so a genuine same-scope `type X = any; raw as X` still blocks.

## [2.29.11] — 2026-09-15

### Fixed

- **doctor: verify the repository ruleset's full authority boundary** (#478). `doctor --github` now checks every direct CI status named by the self-gate, requires Code Owner review and stale-review dismissal, and fails closed when an active ruleset grants bypass actors. The required-checks list now enumerates the `platform-contract` matrix by its real per-cell contexts (`platform-contract (ubuntu-latest)`, `(macos-latest)`, `(windows-latest)`) instead of the bare job name, which could never match a published check context and always reported a false authority failure; a drift-guard test binds the list to `.github/workflows/ci.yml`. README documents the reproducible posture command.

## [2.29.10] — 2026-09-15

### Fixed

- **docs: VitePress now fails closed when SSR leaves an empty page** (#513). The rules guide's GitHub Actions expressions are rendered inside `v-pre` so Vue no longer interpolates them, and both docs workflows smoke-test the generated HTML before Pages upload so an empty or missing `guide/rules.html` cannot deploy.

## [2.29.9] — 2026-09-15

### Fixed

- **The privileged audit publisher accepted replacement evidence and did not fully
  enforce the audit schema** (#514). The write-authorized job now reconstructs raw
  candidates from the trusted checkout or manual input, validates the complete
  supported schema including severity/decision constraints, preserves the existing
  evidence prefix, appends only new batches/events, rejects conflicting IDs and
  rewritten batches, rejects store symlinks, and recomputes the summary and README
  without running npm or dependency code. The workflow no longer transfers a
  dependency-produced replacement store across the privilege boundary.

## [2.29.8] — 2026-09-15

### Fixed

- **Diff-only fallback: `ts-any-cast` and `test-skip` fired on comment and block-comment
  lines** (#446). With no before/after content the detectors fall back to a per-line scan
  that had no comment or string state, so a literal `as any` in a `//` line comment, an
  `as any` on a line inside a `/* … */` block whose opener was an earlier added line, or a
  `.skip`/`.only` inside a block comment all read as real code and blocked. A shared
  comment/string masker now blanks comment bodies and string/template interiors — block,
  string and template state carried across the change's after-view hunk stream (context
  lines advance the lexer; only additions can produce findings), and code inside a `${…}`
  template substitution stays scanned so a cast there is still seen — before the line
  matchers run. `ts-any-cast` blanks string interiors; `test-skip` keeps strings intact and
  rejects in-string hits through `insideStringLiteral`, so a computed-property marker
  (`it['skip']`) still fires. Regex literals reuse the token-aware scanner added in #439, so
  a real cast after `const re = /'/;` is not masked. Real casts and skip markers — including
  one following a closed same-line block comment, which the whole-line comment guard
  previously swallowed — are unaffected.

## [2.29.7] — 2026-09-15

### Fixed

- **snapshot-rewrite: node-tap's update triggers went unrecognised although
  `tap-snapshots/**` is protected** (#445). `TAP_SNAPSHOT=1`, the bare `tap --snapshot`
  flag, and `--update=true` (the `=value` form of `--update`) now warn consistently with
  the existing jest/vitest handling. `--snapshot` and `-u`/`--update` still only count
  next to a snapshot-capable runner, so unrelated commands stay silent.

## [2.29.6] — 2026-09-15

### Fixed

- **lint-suppression: `# NOQA`, a closed triple-quoted string, and a JS regex literal no
  longer hide a real directive** (#439). The `# noqa` / `# ruff|flake8: noqa` spellings now
  match case-insensitively, as flake8 and ruff accept them. The per-line quote scanner in
  `insideStringLiteral` treats a Python triple quote (`'''` / `"""`) as one delimiter, so a
  string that opens and closes on the line leaves a trailing directive outside it, and it
  recognises a JS regex literal (`/'/ `) so an apostrophe inside the pattern no longer opens
  a string that swallows the rest of the line and hides a following `// eslint-disable`.
  Directives genuinely inside a string or docstring stay excused.

## [2.29.5] — 2026-09-15

### Changed

- **Terminal verdict colours now use a 24-bit palette.** The blocking header and `BLOCK`
  render in red, `warn` and the sign-off command in amber, `clean` in green, and the
  `path:line` locator in cyan. Colour remains pure decoration layered over text that
  already spells the severity: the escapes strip to a byte-identical plain rendering, and
  output stays uncoloured under `NO_COLOR`, a pipe, `TERM=dumb`, or a CI log without
  `FORCE_COLOR`. No emoji or glyphs are introduced, and no command, flag, exit code, or
  machine-output contract changes.

## [2.29.4] — 2026-09-14

### Fixed

- **Persistent hook service: `stop` orphaned a live listener, and concurrent requests
  applied side effects for abandoned tool calls** (#416). `stop`/`status` trusted the
  candidate-writable state file, so a live service whose state file was altered (wrong
  pid/version) was reported "not running" and its socket unlinked, leaving an orphaned
  listener. `stop`/`status` now probe the socket itself: a socket that answers is a live
  listener that is never unlinked or reported absent; `stop` SIGTERMs only when the
  listener's self-reported pid/root/version agree with the state file, otherwise it
  reports the mismatch (exit 1) and leaves the socket intact, and `status` reports the
  live listener's own identity, warning when the state file disagrees. Separately, the
  single-threaded evaluator now refuses a second request that arrives while one is in
  flight (the client falls back in-process exactly once, with no service side effects),
  defers evaluation to the check phase so a concurrent request is read and refused before
  the loop blocks, and skips an accepted request whose client already disconnected — so
  the service never records predicted-write sanctions, ptree saves, or turn-baseline
  advances for a tool call that was denied by timeout. The wire protocol is unchanged.

## [2.29.3] — 2026-09-14

### Fixed

- **Claude adapter ignored `Edit`/`MultiEdit` `replace_all`** (#418). `applyEdit` modelled a
  single replacement even when `replace_all: true`, so the PreToolUse layer's predicted
  write (and the hash `sanctionPredictedWrites` records) was smaller than what the tool
  writes to disk — the next call re-judged via drift and threshold-based rules saw less
  than actually landed. `replace_all` now rewrites every occurrence (a function replacer
  keeps `$&`/`$1`/`` $` `` literal); the unique-match single path is unchanged. A new
  `test/claude-payload-corpus.test.ts` pins the projected `Change[]` for each recorded
  tool/mode shape (Write, Edit, Edit replace_all, MultiEdit, NotebookEdit insert/replace/
  delete) so weaker modelling of a future field surfaces as a test failure.

## [2.29.2] — 2026-09-14

### Fixed

- **`tamperward-audit` workflow started failing on every push to `main`** (follow-up
  to #502). A workflow-level `env` referenced `${{ runner.temp }}`, but the `runner`
  context is not available at workflow scope, so GitHub rejected the file before any
  job ran (a startup failure — 0 jobs, marked failed, and evaluated even on non-`main`
  pushes because the branch filter never applied). The paths are now derived inside
  the `run` steps from the always-present `$GITHUB_WORKSPACE` / `$RUNNER_TEMP`
  variables, and a regression test rejects any workflow-level `env` that uses a
  `runner` / `steps` / `needs` / `job` / `matrix` / `strategy` context.

## [2.29.1] — 2026-09-14

### Changed

- **Audit evidence ingests on merge to `main`** (#502). The `tamperward-audit` workflow
  gains a post-merge entry point beside `workflow_dispatch`: a reviewed PR adds an
  immutable `audit/pending/<batch-id>.jsonl` batch, and on merge the workflow ingests any
  batch whose id/content hash is not already recorded into the `tamperward-audit` evidence
  branch. Ingestion is deterministic and idempotent (dedup by content hash and event id;
  a build-free prescan short-circuits when nothing is new), and the write credential is
  isolated: a read-only `prepare` job builds and validates with no write token present
  while `npm ci`/build/candidate code runs, and a minimal `publish` job holds the write
  token but runs no candidate code. Committed batches are validated pre-merge by CI, and
  a `CODEOWNERS` entry covers `audit/`. There is still no `pull_request` /
  `pull_request_target` trigger, and the workflow remains the sole writer of the evidence
  branch and never writes `main`.
- **The README local-enforcement-envelope diagram is now a committed SVG** (#503) instead
  of a fenced Mermaid block, so it renders consistently on GitHub and everywhere Mermaid
  is unavailable — matching the architecture diagram. A `docs-status` regression check
  fails if a fenced Mermaid diagram is reintroduced into authored documentation.

## [2.29.0] — 2026-09-14

### Added

- **Runtime-aware onboarding** (#482, Phase 2 — first increment). `tamperward onboard`
  now detects which agent runtime a repository hosts and states exactly what protection
  each gets, instead of silently assuming Claude. A new `src/runtimes.ts` registry
  recognises Claude Code (`.claude/`), Cursor (`.cursor/` / `.cursorrules`), GitHub
  Copilot (`.github/copilot-instructions.md`) and an AGENTS.md-aware agent
  (`AGENTS.md` / `.codex/`) from repository-relative marker files. The Local-protection
  step opens with a `RUNTIME` line naming the detected runtime(s) and their steering
  coverage; when a repository uses a runtime with no shipped in-loop adapter, onboarding
  adds a `NOTE` stating plainly that deny-before-execute ships for Claude Code only today,
  that the live protection there is the agent-neutral layers (pre-commit + CI), and that a
  native in-loop adapter is tracked in #482. Detection is honest reporting only: it reads
  candidate-controlled marker files, so it shapes the setup narrative, adjudicates nothing,
  writes nothing and opens no verdict path. Adding a runtime to the registry does not grant
  it in-loop steering — that still requires a conforming `RuntimeAdapter` and its parity
  suite; the registry's `in-loop` flag flips only when that adapter ships.

## [2.28.0] — 2026-09-14

### Added

- **Privacy-safe self-hosting audit history and `tamperward stats`** (#495). Claude
  PreToolUse and Stop findings can now be recorded as strict audit-v1 JSONL with
  `TAMPERWARD_AUDIT_LOG` (`auto` uses the repository git directory). Events contain
  only a generated id, timestamp, enforcement surface, fixed agent id, rule,
  severity/decision and an optional one-way hashed session id — never prompts, tool
  command bodies, source/evidence text, filenames, absolute paths, environment values
  or credentials. The existing `TAMPERWARD_DENYLOG` remains the compact harness trace.
  `tamperward stats [--file F] [--since 30d] [--json]` validates and aggregates the
  structured stream by rule and surface while stating explicitly that an integrity
  finding is not proof of agent intent. `schemas/audit-v1.schema.json` and
  `schemas/stats-v1.schema.json` publish the event and aggregate contracts. TamperWard's own repository also ships a manually-dispatched
  `tamperward-audit` workflow: the copy committed on `main` revalidates submitted
  audit-v1 records, deduplicates event ids, writes only the separate
  `tamperward-audit` evidence branch, and regenerates its text/JSON summaries. Audit
  recording and persistence are measurement only; failure or alteration cannot change
  an enforcement verdict.

## [2.27.0] — 2026-09-14

### Added

- **A vendor-neutral in-loop steering contract, `RuntimeAdapter`** (#482, Phase 1). A new
  `src/adapters/contract.ts` names the seam between TamperWard's runtime-neutral engine and
  a specific agent runtime as a type: the `pre-action` / `post-action` / `end-of-turn`
  decision-vs-observation split (a synchronous deny before execution; observation-only after;
  a mandatory end-of-turn sweep), per-**operation** capability declaration
  (`shell` / `file-edit` / `file-read` / `mcp` / `other`, each `preDeny` / `postObserve` /
  `endOfTurn` / `unsupported`), and explicit outcome states — `ok` / `unsupported` /
  `not-invoked` / `parse-failure` / `transport-failure`, where `parse-failure` and
  `transport-failure` fail **closed** (deny), mirroring the live `HookInputError` →
  `failClosed`. The runtime-supplied `cwd` / identity is typed as an untrusted **claim** to
  validate against the runner's independently-derived repository root, never as authority.
- **Claude Code is the first implementation of that contract** (`src/adapters/claude/adapter.ts`)
  with **zero** change to live steering behaviour. It is a conformance wrapper: `decide()`
  delegates to the unchanged canonical `preToolUseFromRaw` / `stopFromRaw` in
  `src/cli/hook.ts` (still wired directly from the CLI), so its verdicts and wire bytes are
  byte-identical to the live hook; `denyPayload` reuses the same `denyWire` serialisation and
  `formatDenial` reason as the live `verdict()`. Claude declares all-operation pre-deny plus
  the end-of-turn stop. The deny/allow paths, `failClosed`, repo-root resolution (#412), the
  turn baseline, and the hook-service transport are untouched; the existing hook test suite
  is the guardrail and stays green unchanged.
- **Identity validation is enforced, not just typed.** `decide()` runs `parse → validate →
  decide`: it derives the runner's trusted repository root INDEPENDENTLY of the claim and,
  via the shared `validateClaimAgainstRoot` (`src/repo-context.ts`), fails **closed** (deny)
  BEFORE any content evaluation when the runtime-supplied `cwd` resolves to a different
  repository, a non-repository, a malformed path, or a symlink that escapes into another
  repository. The same helper is wired into the live `preToolUseVerdict` / `stopVerdict` via
  an optional `trustedRoot`: a runner that has an independently-derived trusted root gets the
  cross-repo claim rejected on the live path too. The parameter defaults to unset, so the
  direct in-loop hook and every existing caller are byte-identical — only a cross-repo /
  invalid claim newly denies. The claim is canonicalized with `realpathSync` BEFORE the git
  root is derived, so a symlink primed at one repository and then retargeted to another is
  decided on its CURRENT real target (and rejected), never a stale unresolved-path cache; a
  claim whose path cannot be resolved (non-existent, broken symlink) fails closed.
- **`post-action` is observation-only.** For Claude, `decide(..., 'post-action')` returns the
  `unsupported` outcome and can never produce a deny wire; the phase→hook mapping refuses to
  route `post-action` to a deny-capable hook rather than falling through to PreToolUse.
- **Neutral contract ↔ research `layers` mapping** (`CONTRACT_TO_RESEARCH_LAYER`): `pre-action`
  ↔ `pre-tool-use`, `end-of-turn` ↔ `stop-sweep`, the post-exit envelope ↔ `envelope`, with
  the per-operation capabilities refining the coarse layers so cross-runtime records do not
  drift.
- **Docs:** a vendor-neutral runtime-adapter guide (`docs/guide/runtime-adapters.md`) and an
  OWASP ACS mapping (`docs/ACS-mapping.md`) that maps only implemented event/control
  semantics, states the unsupported ones (no identity/authN, no network-egress control), and
  claims **no** ACS compliance. Both are linked in the docs sidebar. SPEC M5 gains a pointer
  to the new seam and is explicitly **not** declared met — this ships no second runtime.



## [2.26.0] — 2026-09-14

### Added

- **New `config-weakening` warn rule reads tsconfig, eslint, biome and the runner's
  setup modules (#447).** Three protected config families were protected in name
  only: `strict: true → false` and other tsconfig strictness lowerings, an eslint
  rule turned `off`, and an `ignores` / `exclude` / `.eslintignore` entry grown to
  hide source fired nothing, because no detector read the effective config, only
  the file's protected-glob membership. `config-weakening` now reads each family
  the way its tool does — tsconfig strictness flags (explicit or implied by
  `strict`) and loosening flags (`skipLibCheck`, `allowUnreachableCode`, …),
  `exclude` grown to hide a tracked source file, `extends` dropped or redirected
  off the protected set; eslint (flat and legacy) and `.eslintignore` — a rule
  turned `off` / `0` that was not off in any config of the family before the
  edit (a `.eslintrc` → `eslint.config.js` migration is not itself a weakening),
  `ignores` / `ignorePatterns` / `globalIgnores([...])` grown, a base rule
  retired beside its plugin-prefixed twin read as a replacement; biome
  `linter.enabled: false`, a rule or `rules.recommended` off, `files.ignore` /
  `linter.ignore` grown; and a NEW jest/vitest `setupFiles` /
  `setupFilesAfterEnv` / `globalSetup` / `runner` / `testEnvironment` /
  `reporters` entry pointing at a file this change adds or that no protected
  glob covers. `.eslintignore` and `biome.json[c]` join `protected.config` by
  default. Ships `warn` pending an fp-study replay
  (`harness/fp-study/CONFIG-WEAKENING-CORPUS.md`) before any block decision.
- **`test-deletion` reads a protected runner config delegating its selection to
  an unreviewed file, and `testNamePattern` (#447).** `export { default } from
  './vitest.real'`, `module.exports = require('./jest.real')`, a `...base`
  spread, `mergeConfig(base, …)`, `extends` / `preset`, and a `projects` entry
  were read as opaque and silent when the target was a file the same change
  added or that no protected glob covered — selection moved to a file the gate
  cannot read, and the config stayed nominally protected while selecting
  nothing. The delegation itself is now the finding, naming the target and
  whether it is a newly added file or simply unprotected; a delegation to an
  already-protected file stays silent, since the selection just moved where the
  gate can still read it. `testNamePattern` is read as a further selection
  predicate alongside the existing file-level narrowings.

## [2.25.2] — 2026-09-14

### Fixed

- **`ci-tampering` reaches composite actions and the other CI systems' entry files
  (false negative).** `protected.ci` covered only `.github/workflows/**`: a workflow
  that kept `- uses: ./.github/actions/test` while `.github/actions/test/action.yml`
  changed `run: npm test` → `run: echo ok` passed `check --staged` clean, and the same
  was true of `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`,
  `azure-pipelines.yml`, `bitbucket-pipelines.yml` and `.travis.yml`. `protected.ci`
  now also names `.github/actions/**/action.y?(a)ml` and the other systems' entry
  files. A composite action gets the workflow rule's full removal/neutralisation pass
  over its `runs.steps`; the other systems' entry files get the generic check-line
  pass — a check line removed or neutralised in place, read from `script:` /
  `command:` / `sh` / `bash` / `pwsh` lines as from `run:` — with none of the
  GitHub-shaped logic (`on:` triggers, `if:` folding, `continue-on-error`, `shell: …
  {0}`), whose keys mean other things there. Two further readings keep this from
  over-firing: a neutralising suffix the removed line already carried (a piped
  typecheck's redirect target renamed, a Travis `|| travis_terminate` line rewritten
  around the same `||`) is a respelling, not a new neutraliser; and a deleted entry
  file whose checks move into a workflow the same change adds is a migration, not a
  removal. (#437)

## [2.25.1] — 2026-09-14

### Fixed

- **`ts-any-cast` closes the escapes beyond the literal `as any` / `as unknown as`
  spellings** (#440). Row 4 now blocks `as never` (assignable in the dangerous
  direction) and the double cast through `unknown` / `never` / `{}` / `object` /
  `Object` — `(x as {}) as T` launders exactly as `x as unknown as T`, and a lone
  `as {}` / `as object` stays the ordinary `ts-cast-growth` assertion it always was.
  A local `type` alias of any of those keywords is resolved within the file, so
  `type A = any; x as A` is `as any` (declared before or after its use, exported,
  parenthesised, or reached through another alias; generic, cyclic and honest aliases
  stay clean). `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` directives are counted
  live on the AST's comment ranges instead of by a whole-file regex, so removing a
  comment that merely *mentions* one no longer offsets adding a real one, and directive
  text inside a string, template or regex is not a directive. JSDoc `@type {*}` and
  `{?}` join `{any}` as the `any` cast in a `.js` file. Each fixture blocks on both the
  full-content (AST) path and the diff-only fallback — which resolves aliases declared
  on the change's own added lines — and `ts-cast-growth` no longer double-counts any of
  the moved spellings.


## [2.25.0] — 2026-09-14

### Added

- **New `test-support` warn rule: helpers, setup modules and fixtures under the test
  globs are a review prompt, not a gutted spec.** The `tests` globs are deliberately
  wide, so they also cover the files that only SERVE the specs — a helper module, a
  `setup.ts`, a `vi.mock` list, a JSON fixture, a case table. Before this change those
  read as a spec to `test-deletion` and `test-content-removal`: deleting
  `src/test/helpers.ts` or trimming `src/__tests__/fixtures/data.json` blocked as
  "test file deleted" / "test content removed" on files that define no test of their
  own. A shared `isSpecShaped` predicate (`src/detectors/spec-shape.ts`) now routes a
  `tests`-glob path to one of two outcomes: a runner-selected suffix (`.test.ts`,
  `_test.go`, `test_*.py`, `*Test.java`, `conftest.py`, …) stays a spec whatever it
  contains; a `fixtures/` / `__fixtures__/` / `__mocks__/` / `__snapshots__/` path
  component, a file in no language the detectors read, or content that defines no test
  on either side of the edit is support instead. `test-deletion` and
  `test-content-removal` now cede that class; the new `test-support` rule (row 20)
  picks it up at `warn` — deletion, a rename out of the `tests` globs, or a net-shrink
  of three or more significant lines with none of the removed lines kept elsewhere in
  the change. (#443)

## [2.24.7] — 2026-09-14

### Changed

- **Architecture diagram is now a standalone SVG instead of a Mermaid block**.
  `docs/architecture.md` embedded the component map as a fenced ```mermaid``` graph,
  which does not render where a Mermaid runtime is absent or too old. The diagram is
  now a hand-authored, dependency-free `docs/architecture.svg` referenced as a Markdown
  image (`![...](./architecture.svg)`), so it renders identically on GitHub, the
  VitePress site, and Markdown previewers. The SVG reproduces the graph faithfully — the
  Steering, Verification, and Authority lanes; every node and edge; solid-versus-dotted
  edge meaning with labels; and the shaded, dashed-red trust boundary around the
  Authority lane — and carries `role="img"`, `<title>`, and `<desc>` for accessibility.
  The README lifecycle diagram is unchanged. (docs)

## [2.24.6] — 2026-09-14

### Fixed

- **`tamperward onboard` preflight errors keep their colour and make repository-root
  mismatches easier to scan.** Error text is now sanitised before TamperWard adds ANSI
  decoration, so terminals no longer expose fragments such as `[1m[31mERROR` in place
  of colour. The child-directory refusal is rendered as a compact
  `ERROR / CURRENT / GIT ROOT / NEXT / OR` diagnostic with the two safe recovery
  choices called out explicitly.

## [2.24.5] — 2026-09-14

### Fixed

- **`test-deletion` reads the command surface the way `hook-tampering` reads it**
  (#432). The rule matched `rm` and `truncate` as words anywhere in a segment and
  compared the token as typed, so `grep -n "rm " test/a.test.ts`, `grep truncate
  test/a.test.ts` and `node scripts/rm-cache.js test/a.test.ts` blocked as deletions
  while `unlink test/a.test.ts`, `mv src/junk.ts test/a.test.ts` (the spec overwritten;
  only the move OUT was read), `echo test/a.test.ts | xargs rm`, `find . -name
  "*.test.ts" | xargs rm`, `dd if=/dev/null of=test/a.test.ts`, `rm test/a.te""st.ts`,
  `rm test/a.te\st.ts`, `rm test/a.test.{ts}` and `rm test/a.tes?.ts` passed. The
  command is now the word in command position past the wrappers hook-wiring skips
  (`sudo`, `env`, `nice`, `time`, `command`, `exec`, a `VAR=` prefix, a `/bin/`
  path) — shared `WRAPPERS`, `REDIRECT_TARGET`, `destinations` and the new
  `xargsCommand` are exported from `hook-wiring.ts` rather than copied — and a path
  is the word the shell hands the command (`shellWord`: embedded quote spans joined,
  backslashes resolved) with a glob expanded against the repository listing
  (`expandGlob`: `*`, `?`, `[ab]`, `{ts,js}`; without a listing a wildcard's literal
  part decides, so `src/*.test.ts` is specs and `src/*.ts` is nothing in particular).
  `unlink` and `shred` delete like `rm`; `sponge` and `dd of=` rewrite like `tee`;
  `cp`/`install`/`rsync`/`ln`/`mv` are read by their destinations, and a spec
  destination that is in the listing with a non-spec source is an overwrite (`mv
  a.test.js.skip a.test.js` onto no listed spec puts one back and is not); `… | xargs
  rm`/`unlink`/`shred`/`truncate`/`mv`/`tee`/`sponge`/`sed -i`/`perl -i` is judged over
  the specs the feeding segments name, a `find … -name` feed narrowed to its pattern.
  Replayed over the 1,511-command harness transcript corpus: the same 15 spec-writing
  commands fire on both builds with a listing, and the three read-only commands above
  are clean; the shared shell corpus fires and passes identically for a hook under
  `hook-tampering` and a spec under `test-deletion`.


## [2.24.4] — 2026-09-14

### Fixed

- **Tests left textually present but unreachable are counted as removed** (#431).
  `test-deletion`'s block count read textual presence as execution: an `it()` wrapped
  in `if (false) {}`, written after a `return;` in its `describe` callback, or moved
  into a `function later() {}` nobody calls still counted, so all three edits passed
  clean. The count is now a reachability count — `src/detectors/reachability.ts`
  marks the guarded branch of any condition that folds to a constant (`false`, `0`,
  `""`, `null`, `!true`, `false && x`, `x && false`, `1 === 2`, the else of
  `if (true)`), statements after an unconditional `return` / `throw` in the same block,
  loop bodies whose condition folds to false, and the bodies of named functions nothing
  live references, and `countTests` walks only what is left. `if (process.env.CI)`, a
  helper called from a test, a hoisted function called before the `return`, an IIFE and
  a named callback handed to `describe` stay counted. pytest is read the way it
  collects: a `def test_*` inside a class counts only when every enclosing class is
  `Test*` or a `TestCase` subclass, so `class TestMath` → `class MathTests` is a
  deletion while `→ class TestArithmetic` is a rename.
- **`test-content-removal` reads hidden content as removed** (#431). Three assertions
  moved into a template literal, a single-line string, an `if (false)` block or behind
  an early `return` kept their lines in the file, so nothing was "gone" and the edit
  drew only `warn:assertion-weakening` (the `//`-commented version already blocked).
  Significant lines are now read from the file's live text on both sides, a removed
  line is excused into the kept pool only where its text occurs as code (an occurrence
  that begins inside a string or template literal is the line quoted; a joined or
  rewrapped call still begins outside its string arguments, so reformatting stays
  excused), and ≥3 removed lines whose text survives only in the file's hidden text
  fire regardless of the net line count. Python: lines after a bare `return` / `raise`
  at the same indent and the suite of `if False:` / `if 0:` / `if None:` are hidden.
- **`test-skip` reads collection-time and configuration-time skips** (#431): a Go
  `func TestMain(m *testing.M)` added without an `m.Run()` call, any `//go:build` /
  `// +build` constraint added to a `_test.go` (only `ignore` was read before —
  `//go:build never` passed), a Rust `#[cfg(…)]` other than `cfg(test)` on `mod tests`
  or beside `#[test]`, JUnit 5 `@EnabledIf…` / `@DisabledIf…` in every spelling, and
  RSpec `it 'x', if: false` / `unless: true` / `:if => false`. `#[cfg(test)]`,
  `#[cfg(unix)]` on a plain helper, `TestMain` that calls `m.Run()` and
  `if: ENV['SLOW']` stay clean.
- Precision delta over the pinned immer/zustand/zod/hono mainline heads, last 150
  adjacent pairs each: see the pull request for the per-repository rows; the
  `test-content-removal` corpus test file and every existing `test-deletion` /
  `test-skip` regression pass unchanged.

## [2.24.3] — 2026-09-14

### Fixed

- **`test-skip`, `test-deletion` and `assertion-weakening` read a runner's modifier
  chain the same way** (#429). Three rules parsed `runner.modifier.each` chains three
  different ways. `test-skip`'s AST path required `.skip` / `.only` / `.todo` to be the
  LAST hop, so `describe.each(rows)` → `describe.only.each(rows)` and `it.each(rows)`
  → `it.skip.each(rows)` were never an AST hit — the single-line regex caught them by
  luck and the multi-line spelling walked past both — and `it.skip.each` was blocked only
  by accident, by `test-deletion` reading it as "2 → 0 blocks". `test-deletion` did not
  unwrap a modifier between the runner and `.each` / `.for`, so the refactor `it.each`
  → `it.concurrent.each` read as every row deleted and blocked. `assertion-weakening`
  accepted only a bare `it(...)` / `describe(...)`, so `toBe(2)` → `toBeDefined()`
  warned under `it('adds', …)` and was silent under `it.concurrent('adds', …)`, and a
  test under `describe.each(rows)('title', fn)` was never compared. One chain reader
  (`src/detectors/runner-chain.ts`) now serves all three: it unwraps `concurrent` /
  `sequential` / `shuffle` / `serial` / `parallel` / `skip` / `only` / `todo` / `fails`
  / `failing` in any order before `each` / `for`. `test-skip` treats a skip/focus marker
  anywhere before the table method as the marker and points the finding at the marker's
  own line; the outer call of a table chain (`X.each(rows)(...)`) is judged by its inner
  chain, so a proven non-runner root stays clean there too. `test-deletion` counts
  `it.concurrent.each` / `test.skip.each` / `describe.concurrent.each` tables per row
  as before the modifier, so the refactor is clean while rows dropped from such a table
  still count as deleted. `assertion-weakening` pairs `it.concurrent('adds')`,
  `test.sequential`, `describe.skip` and `describe.each(rows)('title', fn)` blocks by
  their literal title. Replay over the four pinned corpus heads (immer, zustand, zod,
  hono) with the three rules compared before → after: see the pull request's precision
  study; the assertion-weakening corpus stays 12/12 TP, 0/20 FP.

## [2.24.2] — 2026-09-14

### Fixed

- **`test-skip` reads Go `Skip` on any receiver and the pytest conftest hooks** (#441).
  The Go row matched `\b[tb]\.Skip`, so `tb.Skip()`, a subtest's `tt.Skip()` and
  testify's `s.T().Skip()` were silent; it now matches `Skip`/`Skipf`/`SkipNow` on any
  receiver and on `T()`. The pytest row knew only the decorator and runtime spellings,
  so a `conftest.py` — a protected test file — could filter `items` in
  `pytest_collection_modifyitems`, decide collection in `pytest_pycollect_makeitem`, mark
  every item with `add_marker(pytest.mark.skip)`, alias `sk = pytest.mark.skip` and use
  `@sk`, or set `rep.outcome = 'passed'` in a `pytest_runtest_makereport` hookwrapper
  without a finding. Each of those is now a `test-skip` block; the aliased decorator is
  resolved against the AFTER file when the change carries it, else against the added
  lines. A conftest that only registers fixtures, `pytest_addoption`, `pytest_configure`,
  a custom marker, a `Skip(` inside a string and the hook name in a comment stay clean.
  Replay of the test-skip suites (`test-skip-ast`, `fp-study-harness`,
  `detector-spellings`, `coverage-gaps`): 0 new findings.

## [2.24.1] — 2026-09-14

### Fixed

- **`hook-tampering` no longer judges every file added under `protected.hooks` as a
  shell script** (#442). Adding a `.pre-commit-config.yaml` with a linter repo, a
  `lefthook.yml` with a lint command, or husky's own `.husky/.gitignore` blocked with
  *a protected hook script was added that does not run the gate live: it runs no
  `tamperward check`* — a guarded block no policy could exclude — because the config
  comparator returned nothing for an add and the add branch ran before the note check.
  An added file is now classified by kind first: a YAML hook config
  (`.pre-commit-config.yaml`, `lefthook.yml`, `.lefthook.yml`, `lefthook-local.yml`) is
  compared by the config comparator against a fresh base carrying every gate entry the
  file names as `init` would write it (live, unskipped, unscoped, on the commit stages),
  so a config that names no gate or carries it live is clean while one that arrives with
  its own gate under `skip:`/`only:`, scoped by `glob`/`exclude`/tags/`stages`, rerouted
  by `env` or not live (`… || true`) reports the weakening; a note or git dotfile
  (`.husky/.gitignore`, `.gitattributes`, `*.md`, `*.txt`) is silent on add as on edit;
  a genuine shell hook script keeps the sign-off stance — a new `.husky/pre-commit` that
  does not run the gate live still blocks. `SPEC.md` row 8 and `docs/guide/rules.md`
  carry the contract.

## [2.24.0] — 2026-09-14

### Added

- **New rule `coverage-exclusion` (warn)** (#438). The per-function form of the
  `coverage-lowering` class: an inline exclusion added to a non-test source file —
  `/* istanbul ignore next | if | else | file */`, `/* c8 ignore next | start */`,
  `/* v8 ignore next[ N] */`, `/* node:coverage ignore next */` / `disable`,
  `# pragma: no cover` in every spacing and case coverage.py accepts, `#[coverage(off)]`
  bare or under `cfg_attr`, and a `//go:build` / `// +build` constraint added to an
  existing Go source file — takes the hard branch out of the measurement with no config
  touched, and no rule read it. Read per language, outside `protected.tests` and
  `protected.config` and off generated / vendored / declaration / output / example /
  docs / script / fixture paths; a marker inside a string literal or quoted behind a
  line comment is text, a marker line removed and re-added verbatim moved, a range
  closer (`ignore stop`) excludes nothing, a constraint on a new Go file is a platform
  split and one edited on a file that already carried it is not an exclusion. Severity
  is decided by corpus (`harness/fp-study/COVERAGE-EXCLUSION-CORPUS.md`):
  `coverage-exclusion-fires.mjs` replayed the rule over the `ts-cast-growth` study's
  460 adjacent first-parent pairs of immer, zustand, zod and hono and it fired on
  **none**; the 6,632 first-parent commits of the deepened clones hold four commits
  that add a spelling, every one an immer maintainer marking an environment-dependent
  branch with `/* istanbul ignore next */` — honest work the rule fires on by design,
  so precision as a tamper signal on real fires is 0/4 and block is not authorized. A
  labeled corpus (`coverage-exclusion-corpus.json`, 22 negatives reproducing the shapes
  maintainers write beside the spellings, 14 positives) is replayed in CI by
  `test/coverage-exclusion-corpus.test.ts`. SPEC row 19; `warn` never requires
  sign-off under the default policy, and operators may raise it to `block` in their own.

### Fixed

- **`coverage-lowering` reads the rest of the denominator-narrowing surface** (#438).
  Jest `collectCoverage: true → false` (top level, or under package.json `jest`), vitest
  `coverage.all: true → false`, nyc `--check-coverage` dropped from a script,
  `--cov-fail-under` lowered or dropped wherever the line lives — a package.json script,
  `pytest.ini` / `pyproject.toml` `addopts`, a `tox.ini` command, a workflow step (the
  one line-level reading the rule now applies to `protected.ci`) — and `setup.cfg` /
  `tox.ini` `[coverage:report] fail_under` lowered, removed or moved (the same
  coverage.py key as `.coveragerc` and `pyproject.toml`, so a gate moved between the
  four is a move, not a deletion) were each zero findings. A raised floor, a floor
  reformatted at the same number, a flag moved to another script in the same edit, and
  an unrelated `setup.cfg` / `tox.ini` edit stay clean.
- The benign file-suffix exemptions are read in the spelling of their list. Jest's
  `coveragePathIgnorePatterns` are regexes, where `'.md'` is "any character, m, d" and
  exempts `src/cmd.ts` and `src/readme-loader.ts`, yet the raw pattern passed the
  `\.md$` benign test; now only the anchored `\\.md$` / `\\.d\\.ts$` (and the other
  suffix literals written the same way) is benign in a regex list, while a glob
  `**/*.md` in vitest `coverage.exclude`, `.coveragerc` `omit` or `collectCoverageFrom`
  stays benign as before. The directory exemptions (`/dist/`, `<rootDir>/test/`) read the
  same in either spelling. The evidence now names the list the exemption was added to.
## [2.23.20] — 2026-09-14

### Fixed

- **The perf smoke measures the parser again, on CPU, alone on its runner** (#421).
  After the parser went lazy (#407) the smoke's yardstick `cli.noop` (an empty-stdin
  hook) no longer loaded the 9 MB TypeScript parser, but `check.diff.small` did, so
  its ratio measured "parser load versus process start" — `check.diff.small` sat at
  4.5× a 6× wall budget on an idle box — and inside the parallel `npm test` matrix
  the remaining headroom went to sibling test files, not regressions. The smoke now
  lives at `harness/perf/smoke.test.ts`, judges **p50 CPU** ratios to a new
  `cli.parse` item (a PreToolUse `Edit` of one `.ts` source with no session: process
  start + module load + parser load + one file evaluated) with budgets of 1.25× for
  `hook.warm.100` and `snapshot.100` and 3× for `check.diff.small` (measured 0.44×,
  0.48×, 1.46×), and runs alone from `npm run test:perf-smoke` (`vitest run --config
  vitest.perf-smoke.config.ts --no-file-parallelism`) in a new `perf-smoke` CI job on
  Node 20 / 22 / 24 that `gate` requires; `npm test` no longer runs it. The smoke pins
  itself with injected regressions: the real run's report with `check.diff.small`
  scaled 3× must fail the judge that passed the real run, and the committed baseline
  with `hook.warm.100` doubled must fail `compare.mjs`.
- **`harness/perf/BASELINE.json` says what it is, and the `perf` workflow says how
  to replace it** (#421). The committed baseline had been captured in a busy
  sandbox before the parser went lazy (`cli.noop` p50 1.7 s where an idle box
  measures 0.12 s), so every hook, snapshot and check item would have had to regress
  roughly 30× before the nightly compare went red — and `compare.mjs`'s budget is
  exclusive, so its 2× default never failed an exact 2× either. Its numbers are kept
  byte-for-byte (another loaded sandbox is a different wrong machine, not the right
  one); it now carries a `note` (*captured in a loaded sandbox; reference baseline
  pending the first green perf workflow artifact*), `machine.ci: false`, and
  `budgets` pinning the hook items (`hook.warm.100`, `hook.cold.1k`, `hook.warm.1k`,
  `hook.ignored`) at 1.5×, and the smoke holds it to that state: a reference
  baseline (`machine.ci` set) must carry `cli.parse` clearly above `cli.noop`, a
  stand-in must confess. `perf.yml` uploads its report as `perf-baseline-candidate`
  and prints the promotion recipe in the job summary; the new
  `harness/perf/promote-baseline.mjs <perf.json>` copies a green run's report into
  place — budgets carried over, `machine.ci` stamped, `note` dropped, a report that
  lost a baselined item refused — and prints the old-versus-new p50 table the
  replacing PR must carry (docs/PERF.md, "The baseline").

## [2.23.19] — 2026-09-14

### Fixed

- **`no-verify` reads the bypass where it actually lives** (#433). `HUSKY="0" git commit`
  and `export HUSKY="0"` were silent: the tokeniser stripped only a token's outer quotes,
  leaving `HUSKY="0` for `^HUSKY=0$` to miss. Tokens are now unquoted the way the shell
  reads them (`HUSKY="0"`, `HUSKY='0'`, `--no-verify""`, `"it's"` all resolve to their
  content), and the same spellings one shell deeper (`sh -c '…'`, `eval …`) are read
  as the command they run. A git alias that carries the flag — `git config alias.ci
  "commit --no-verify"` (then `git ci`), `git -c alias.ci='commit -n' ci`,
  `GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` and `GIT_CONFIG_PARAMETERS` injection, a
  `!`-shell body — is judged as the invocation it expands to, the way `core.hooksPath`
  already was; `alias.lg "log -n 20"` and `alias.ci "commit -v"` stay clean.
  `pre-commit uninstall`, `lefthook uninstall`, `husky uninstall` (under `npx`, `pnpm
  exec`, `python -m`) and `rm` / `unlink` / `mv` / `chmod -x` of the pre-commit
  framework's install target (`.git/hooks/<hook>`, `$(git rev-parse --git-dir)/hooks/…`,
  the whole `.git/hooks` directory) block: `.git/hooks/**` is outside every git view,
  so `protected.hooks` never covered it. Reading the hook, installing one, `chmod +x`
  and deleting git's `*.sample` files stay clean. The literal `--no-verify` is now read
  on `git am`, `git rebase` and `git cherry-pick` too.
- **`git commit -mfinal` no longer reads as `git commit -n`** (#433). The `-n`
  cluster test ran after the option-value stripper recognised only a detached `-m`, so
  the letters of a glued message (`-mfinal`, `-mdone`, `-mn`) were tested as flags. A
  value-carrying short option (`-m`, `-F`, `-C`, `-c`) now ends the cluster: the letters
  before it are the flags (`-anm x` is still `-n`), the rest of the token — or the next
  token when nothing follows — is the value.

### Added

- **`no-verify` warns on the commit paths that never run pre-commit** (#433). `git
  commit-tree`, `git update-ref <branch> <sha>`, `git am`, `git cherry-pick` and `git
  rebase` write commits the hook never sees. They ship at warn whatever the rule's
  severity (a rebase onto main or a cherry-picked fix lands commits the hook already
  checked, and the 1,511-command harness corpus holds none of them either way, so block
  would refuse routine history work on no evidence); `--continue` / `--abort` / `--skip`
  / `--quit` on an operation in progress and `cherry-pick --no-commit` are clean. The
  rationale is in `docs/guide/rules.md`.

## [2.23.18] — 2026-09-14

### Fixed

- **The CLI no longer exits before its stdout has drained** (#415). Every exit after
  output a consumer parses — `check --json`, `check --format github`, the Claude
  `hook` deny and `sweep` block JSON, `verify` / `run` / `doctor` / `research` machine
  documents, `hook-service status` — went through `process.exit(code)` straight after
  `process.stdout.write(...)`. That is only safe when the write completed synchronously:
  Node makes pipe writes asynchronous on macOS and Windows, and even a Linux pipe backs
  up in the stream once the kernel buffer is full and the reader is slow, so a document
  larger than the pipe buffer was cut off at exit. For the hook that was a fail-open —
  a truncated deny is a malformed hook response, which Claude Code ignores, so the deny
  became an allow. The CLI now exits through one `exitAfterFlush(code)`
  (`src/cli/exit.ts`): it sets `process.exitCode` and calls `process.exit` from the
  stdout/stderr write callbacks, which the streams invoke only once everything queued
  before them has reached the OS. Exit codes and output are unchanged; on a synchronous
  stream the callbacks fire on the next tick. `watch` and `hook-service start` still
  never exit on their own (the event loop is the daemon lifetime). Regression:
  `test/stdout-drain.test.ts` spawns the built CLI with stdout as a pipe the test does
  not read for a while and with `test/fixtures/async-stdout.cjs` preloaded, which
  makes every stdout write complete on a timer the way a macOS/Windows pipe does, and
  asserts that a 2.4 MB `check --json`, a 1200-annotation `--format github` verdict,
  a 300 KB hook deny and a Stop block each arrive complete and parse. README's platform
  table now states the contract: parsed output is complete before exit on every
  platform.

## [2.23.17] — 2026-09-14

### Fixed

- **`init` and `doctor` certify the hook wiring by the `hook-tampering` comparator**
  (#413). `init --dry-run` reported `agent ok — already wired` and `doctor` reported
  `[OK] claude-hooks` for a `.claude/settings.json` entry carrying the exact command
  plus `"async": true, "timeout": 1` — a gate the runtime never awaits and kills before
  it answers, and a file `check --staged` blocks as hook-tampering — because both tested
  only for the presence of the command. The canonical-shape comparator is now exported
  from the detector and consumed by `planClaudeHooks` (init) and `collectLocalPosture`
  (doctor): an entry the runtime would not run the gate through (`async`, `if`, a
  `timeout` below 120s, any other key init does not write, a matcher on the Stop entry,
  text around the invocation) is `would update` from init — restored to the shape init
  writes on the next run when the command is one init wrote — or `error` for a
  hand-written command, and `[BROKEN] claude-hooks` from doctor with the detector's
  reason. `onboard`'s posture summary inherits the verdict. A pre-commit gate line whose
  first non-blank character is `#` — `sed -i 's/^npx /# npx /'`, the common "temporarily
  disable" edit — read as wired from both; comment lines are skipped before the gate-line
  search, so it is `would update … append the staged check` / `[WARN] pre-commit`, and
  re-running init writes a live line. A correctly wired repository, including a
  `timeout` at or above the floor, stays `ok` / `OK`.

## [2.23.16] — 2026-09-14

### Security

- **`init` no longer follows a symlink planted in repository content** (#414). Every
  file init writes — `.tamperward.yml`, `.claude/settings.json`, the pre-commit hook in
  whichever hooks directory is resolved or `.husky/pre-commit`, CODEOWNERS in any of
  its three locations, the workflow — went through `existsSync` / `writeFileSync` with
  no `lstat`, so a `.claude/settings.json` symlinked to `~/.claude/settings.json` had
  the project hooks written into the user's file, a `.git/hooks/pre-commit` symlink had
  the gate line appended to whatever it pointed at, and a tracked `.husky/pre-commit`
  symlink let a pull request aim a reviewer's later `init` or `onboard` at any file the
  reviewer can write. Each target is now `lstat`ed first; a symlink or non-regular file
  is an error row reading `refusing: symlink` / `refusing: not a regular file` (exit 2
  when applying, the same row under `--dry-run`), the link and its target are left
  byte-identical, and the rest of the plan still applies. Every write is a temp file in
  the same directory plus rename, so the destination is never opened for writing and a
  crash mid-write cannot leave a truncated settings.json.
- The symlink refusal and atomic replacement `onboard` had since the #402 review now
  live in `src/safe-write.ts` (`refuseNonRegular`, `writeTargetKind`, `existingMode`,
  `atomicReplaceFile`) and both commands use it; a directory where init expected a file
  is reported as the refusal above rather than as an `EISDIR` planning failure.

## [2.23.15] — 2026-09-14

### Changed

- **Docs site: the reference pages are in the navigation and the architecture diagram
  draws the authority edges and the trust boundary** (#451). `architecture`, `PERF`,
  `CAST-INVENTORY` and both threat models were built but appeared in no nav or
  sidebar; they now form a "Reference" group (and nav entry). `CAST-INVENTORY` linked
  `../harness/…`, which resolves on GitHub but 404s on the site because `harness/` is
  not served; it now uses the GitHub blob URL like every other page. The architecture
  diagram is redrawn as three lanes — Steering (agent runtime → Claude hooks →
  `tamperward hook` → protected-tree snapshot → deny/allow), Verification (`run`
  envelope → `check` + `verify` → visible and pristine → local verdict/JSON) and
  Authority (protected CI running the same `check` and `verify` against the trusted
  base → required gate → branch rules + CODEOWNERS → merge) — with the Authority lane
  shaded as the trust boundary, the previously missing `ci → check`, `ci → verify`,
  `policy → pristine` and `observer → Stop sweep` edges, `init` writing across all
  three lanes and `doctor` reading them, and nodes for `onboard`, `trace-verify`,
  `hook-service` and `research`. The "Data flow" prose matches the redrawn diagram.
  The docs consistency test now asserts every built page is in the sidebar or nav and
  that no docs link targets `harness/` relatively.

## [2.23.14] — 2026-09-14

### Security

- **A content-triggered detector crash failed OPEN at the Stop sweep and at
  PreToolUse** (#444). The engine emitted the fail-closed `detector-error` block only
  for the `staged`, `worktree` and `range` views; the Stop sweep evaluates the `turn`
  view and PreToolUse the `tool-call` view, so a rule that threw on repository content
  was silently dropped at exactly the two layers the agent meets. A spec beginning with
  `const deep = [[[…30 000 deep…]]];` plus `it.skip(...)` made `test-skip`,
  `test-deletion` and `test-content-removal` throw `RangeError` — 0 findings, allow —
  while the same content was `block:detector-error` at pre-commit. Two fixes. The
  engine now fails closed at **every** view (a caller that names no view included): a
  thrown detector is a blocking `detector-error` naming the rule, carried on the
  PreToolUse deny channel and the Stop block channel like any other block. And the
  crash is no longer reachable from content: every `ts.createSourceFile` in the
  detectors (`test-skip`, `test-deletion`, `test-content-removal`,
  `assertion-weakening`, `ts-any-cast`, `ts-cast-growth`, `coverage-lowering`,
  `suite-config`) goes through one guarded entry, `parseSource` in `src/ts-lazy.ts`,
  with a 4 MiB byte ceiling and a 256-level bracket-nesting ceiling that **declines**
  (null) instead of throwing, and declines a `RangeError` the parser still raises the
  same way. A declined parse is not a verdict: the rule's line-level matcher judges the
  file, as it does for a diff-only change — so the fixture is denied at PreToolUse,
  blocked at Stop and blocked at `check --staged` by `test-skip`, not by
  `detector-error`, and the same deep literal without a skip is clean at all three. A
  declined `test-deletion` count is an open count (no deletion asserted, no relocation
  credit granted); a declined config parse selects like the default, as its catch
  already did.

## [2.23.13] — 2026-09-14

### Security

- **Workflow supply chain: every action pinned to a commit SHA, nothing fetched
  unpinned at publish time, no persisted token on the root-privileged runners** (#423).
  All 69 `uses:` lines across the 14 workflows now name a full commit SHA with a
  `# vX.Y.Z` comment (`checkout` v5.1.0, `setup-node` v6.5.0, `setup-python` v5.6.0,
  `setup-uv` v7.6.0, `upload-pages-artifact` v4.0.0, `deploy-pages` v4.0.5), resolved
  from the tags themselves; the release job — which holds `id-token: write` and mints
  the npm publish credential — no longer trusts a mutable tag. `upload-artifact` and
  `download-artifact` are on one pinned v5.0.0 everywhere (the mixed v4/v5 could not
  read each other's artifacts across workflows). `.github/dependabot.yml` moves the pins
  weekly for `github-actions` and `npm`. The release guard that refuses a downgrade
  runs on a lock-pinned `semver` 7.8.5 devDependency after `npm ci` instead of
  `npx --yes semver@7.8.5` fetched from the registry at publish time. `mine.yml` reads
  the dispatch input `POOL` from `process.env` inside `node -e` instead of splicing it
  into the JavaScript source. `pilot.yml` and `counted.yml` check out with
  `persist-credentials: false` and unset `GITHUB_TOKEN` in the `sudo -E env` wrapper
  around every privileged call, so the task code and the agent running as root never
  see the checkout credential; only the unprivileged state restore/save/checkpoint
  steps receive it. `test/workflow-pins.test.ts` pins all of this against the
  repository's own workflows.

## [2.23.12] — 2026-09-14

### Fixed

- **The Stop sweep no longer allows on a cwd it could not resolve** (#417). A payload
  whose `cwd` did not exist or could not be read produced the same empty stdout at exit 0
  as a plain non-repository directory, while PreToolUse denied the same cwd. The sweep now
  allows only when the directory exists, is readable, and `git rev-parse` itself reports
  *not a git repository*; a missing or unreadable cwd, a bare repository, or any other git
  failure is denied as `tamperward-unavailable` with the diagnostic in the reason.
- **The turn baseline fails closed** (#417). The marker the sweep compares against was
  written with a plain `writeFileSync`, a parallel hook could read a half-written sha, the
  guard accepted 7–40 hex characters so a truncated prefix passed, and any write failure
  silently downgraded the sweep to `git diff HEAD` — making a mid-turn commit invisible
  again, the case the baseline exists for. The marker is now written to a temp file and
  renamed into place (as the effect state already was), read only as exactly 40 hex
  characters (anything else is absent and re-established), and a write that fails denies
  the turn as `tamperward-unavailable` naming the path, at Stop and at the PreToolUse
  call that pins it.

## [2.23.11] — 2026-09-14

### Fixed

- **`test-deletion` reads the package.json test scripts as check invocations** (#435).
  Rewriting `"test": "vitest run"` to `echo ok`, `vitest run || true`, `vitest run
  src/easy.test.ts`, `vitest run --config vitest.ci.ts` (a file nothing protects, or one
  the same change adds), `vitest run --shard=1/1000`, or dropping nyc's `--check-coverage`
  left CI running `npm test` unchanged and the whole suite neutralised with no finding —
  the cheapest complete bypass in the ruleset. The `test`, `test:ci`, `check` and
  `pretest` scripts are now compared before → after the way `ci-tampering` compares a
  workflow line: a script that no longer runs a check, or runs a check of another kind,
  is a removal; a masked status (`|| true`, `; exit 0`, a pipe, `--passWithNoTests`,
  `--if-present`), a `timeout` wrapper, a dropped coverage gate, or a narrowed suite — a
  runner flag (`--shard`, jest `--root` / `--rootDir` / `--testMatch` / `--testRegex` /
  `--modulePathIgnorePatterns` / `--selectProjects`, pytest `-k` / `-m` / `--deselect` /
  `--ignore`, mocha `--grep` / `-g`, `go test -run`, `cargo test -- --skip`, and the
  flags already read), a spec path as a positional, an unreviewed `--config` — is a
  neutralisation. `test:unit` / `test:integration` are deliberate slices: their
  `--project` or positional is design, and only a masked status, a timeout or a
  replacement is reported. A runner migration that keeps the suite (`jest` → `vitest
  run`, `mocha` → `vitest`), an env prefix (`cross-env`, `NODE_OPTIONS=`), an `nyc` /
  `c8` wrapper, `python -m pytest`, a reporter flag, a flag that was already there and a
  check moved into a script the same change adds stay clean.
- The invocation reading `ci-tampering` already had — `survives()`, the neutralising
  suffixes, the narrowing-flag table, the path positional, the `timeout` wrapper — now
  lives in `src/detectors/invocation.ts` and is consumed by both rules; the GitHub
  expression folder moved to `src/detectors/gh-expression.ts`. The per-runner narrowing
  table and the `--cov-fail-under` floor `ci-tampering` gained in #436 are read by the
  script comparison through the same module.

## [2.23.10] — 2026-09-14

### Fixed

- **`ci-tampering` reads same-kind respellings that run nothing as neutralisations**
  (#436). `npm test` → `npm run tests --if-present`, `--prefix packages/empty`, `-w empty`,
  `pnpm test --filter nothing`, `npx jest --shard=1/1000` / `--testMatch '**/nothing.js'`,
  `cargo test -- --skip failing`, `pytest -k nothing_matches`, a lowered
  `--cov-fail-under`, `npx vitest run --root packages/empty` were all kept as respellings.
  Narrowing flags are now read per runner (`-w` is a workspace to npm, not `--maxWorkers`
  to jest); a `working-directory` (step or `defaults.run`) pointing at a directory with no
  tracked code or manifest, and `actions/checkout` given a literal `with.ref`, are
  neutralisers.
- A removed check no longer "survives" inside a heredoc body, a `run: >` folded scalar's
  continuation line, an `echo`, a step `name:` or a comment: a survival candidate must
  invoke the check in command position, behind nothing but assignments and wrappers.
- `if:` built from `contains` / `startsWith` / `endsWith` / `fromJSON` / `format` / `join` /
  `toJSON` over constant arguments folds to its value, so `if: contains('a', 'b')` and
  `if: ${{ fromJSON('false') }}` are read as `if: false`.
- Trigger narrowings: an event with no `branches:` filter is read as `['**']`, so
  `push:` → `push: branches: [never-exists]` and `pull_request:` →
  `branches: [release/**]` are narrowings; a `tags:`-only filter replacing `branches:`
  loses every branch; `!` entries apply in order (`[main, "!main"]` names nothing);
  `paths-ignore` is evaluated against the repository's source files as `paths` is.
  `[main]` → `[feature]` keeps blocking; a matrix or caching change stays clean.
- `- run: pytest` (a bare tool right after the `run:` key) is now recognised as a check
  invocation on the step line, as `npm test` already was.

## [2.23.9] — 2026-09-14

### Security

- **A policy edit can no longer demote the test rules by growing `protected.snapshots`,
  and a negated protected glob no longer makes every file "protected" (#434).**
  `mergeProtected` is additive, policy-diff counted only removed globs as a narrowing,
  and the spec rules judge `tests && !snapshots` — so
  `protected: { snapshots: ['**/*.test.ts'] }` lowered `test-deletion` to
  `snapshot-rewrite` with no finding, and `protected: { tests: ['!zzz'] }` (picomatch:
  every path) made every source file a test file, silencing `ts-cast-growth` and
  lowering `ts-any-cast`. `hook-tampering`'s policy-diff now reports both as a policy
  weakening: any glob added to `protected.snapshots`, any negated glob added to any
  protected category, any `tests` glob that also matches snapshot paths, and — in
  general — every rule whose jurisdiction is a category predicate compared by its
  **reach** over a probe listing (the repository's tracked files when the gate has
  them, joined with the conventional samples) before and after the edit; a path that
  leaves a rule's reach is reported naming the path and the rule. The edit is judged
  under the policy in force before it, so the exclusion cannot be weaponised by the
  change that writes it (regression covered).
- **The loader refuses negated globs** (`!x`) in every `protected` category, in
  `ignore` and in a per-rule `exclude`, with a message naming the mechanism — a `!`
  pattern matches every path — and fails closed like any other unparseable policy.
- Precision: the cast rules cede test files by design, so a new `tests` glob that
  names a real layout (`packages/new/**/*.integration.ts`) stays clean; their loss of
  reach is reported only when the same edit also takes a conventional source path
  out of reach. Widening `config`, `ci` or `hooks` is unchanged (a strengthening).

## [2.23.8] — 2026-09-14

### Fixed

- **`test-skip` no longer goes silent on a runner it cannot name (#428).** The
  JS/TS AST path claimed every `x.skip(...)` / `x.only(...)` call once it had parsed
  the file, and declared the file clean whenever the chain root was not one of the
  runner imports it knew — while also suppressing the line matcher that catches the
  same call on a bare diff. A Playwright-style repository (`import { test } from
  './fixtures'`, `const test = base.extend({})`), a namespace import
  (`import * as v from 'vitest'; v.it.skip(...)`) or a wrapper package therefore got no
  skip coverage at all on full content. The AST now claims a call only when the root is
  proven: a runner (a known runner module's export by name, default import, namespace
  member or `require`, a `X.extend(...)` / `X.extend<T>(...)` of one, an alias, or a
  relative fixture module's `export const test = base.extend(...)` / re-export /
  `module.exports`, followed through the change's own content or the repository's copy)
  or a non-runner (a parameter, a local `function it()`, a local declaration whose
  initialiser is none of those, a non-runner name from a known runner module). A root it
  cannot classify — a package it does not know, a fixture it cannot read — leaves that
  call to the regex, so the full-content and diff-only paths agree. `test.describe.skip`
  / `test.describe.only` under Playwright count as the chain they are. Corpus replay
  (`harness/fp-study/TEST-SKIP-AST-CORPUS.md`) re-run over the same pinned immer /
  zustand / zod / hono heads: 524 adjacent pairs, 0 newly introduced findings.

## [2.23.7] — 2026-09-14

### Fixed

- **`test-deletion` blocks a spec renamed into a path the runner does not walk** (#430).
  A rename that stayed inside the tests glob was silent even when the runner would
  never open the new path: `src/a.test.ts → cypress/a.test.ts` (vitest's default
  exclude), `tests/integration.rs → tests/integration/mod.rs` (cargo builds only
  `tests/<name>.rs` and `tests/<name>/main.rs`), `pkg/a_test.go → pkg/testdata/a_test.go`
  (`go test` skips `testdata`, `_*` and `.*` components) and
  `tests/test_a.py → tests/.archive/test_a.py` (pytest's default `norecursedirs`).
  The rename branch now evaluates the new path against the runner's default exclusion
  set — the same `test.exclude` / `norecursedirs` defaults the suite-narrowing
  predicate already reads — plus the per-ecosystem target rules above, and reports
  *renamed into a path the runner does not walk*. The `mv` spelling on the command
  surface is held the same way. Only a rename whose old path was itself walked fires,
  so an ordinary move within the walked tree (`src/a.test.ts → src/unit/a.test.ts`,
  `tests/x.rs → tests/x/main.rs`) stays clean.
- **`policy.ignore` can no longer hide the old path of a rename** (#430). Suppression
  tested the new path only, so with an ordinary `ignore: ['docs/**']` the rename
  `test/a.test.ts → docs/a.md` produced no finding. A rename is now suppressed only
  when both of its ends are ignored, and never when the old path is in a protected
  category.

## [2.23.6] — 2026-09-14

### Fixed

- **Every worktree-reading path is rooted at the repository, not at cwd (#412).**
  Git views report root-relative paths, but `check --worktree` / `--staged`, the Stop
  sweep, PreToolUse, `allow`, `doctor` and the protected-tree snapshot joined those
  paths onto the directory the command ran from. From a subdirectory of the repository
  the after-content of every changed file resolved to a path that did not exist, the
  content/AST detectors went blind, and the root `.tamperward.yml` was silently replaced
  by the baseline — `check --worktree` and `sweep claude` failed OPEN for a monorepo or
  subdirectory session, and `hook claude` enforced the wrong policy. A shared
  `repoContext(cwd)` resolver (`git rev-parse --show-toplevel` / `--absolute-git-dir`,
  cached per cwd) now anchors policy loading, every disk read, the snapshot, the sign-off
  ledger, the hook service's root binding and `init`. Verdicts and plans from `r1/pkg`
  equal those from `r1`; a policy file planted in a subdirectory governs nothing; a
  relative tool path in a hook payload still resolves against the session's own cwd.
- `init` run from a subdirectory wires the repository root (and says so on stderr)
  instead of planning `.tamperward.yml` and the CI files under the subdirectory while
  installing the pre-commit hook into the parent's `.git/hooks`.
- A directory outside any repository keeps its previous behaviour: `check` refuses with
  the not-inside-a-repository message, and a policy file beside it is read as before.

## [2.23.5] — 2026-09-14

### Fixed

- **The pristine overlay no longer unlinks the file it just restored on a
  case-insensitive filesystem** (#426). `verify` keyed the base-protected set on
  exact-case paths while macOS-default and Windows filesystems collapse case, so a
  case-only rename of a base test (`test/foo.test.js` → `test/FOO.test.js`, gutted)
  resolved to the restored inode and the removal loop deleted it; a runner that exits
  0 on an empty set then reported VERIFIED over an unfixed bug. The destination
  filesystem's case sensitivity is now probed once per verify (a probe file and its
  case variant, removed afterwards). When it is case-insensitive, overlay/surface
  membership and the base-protected set are case-folded, so the case variant is never
  removed and an agent-added `CONFTEST.PY` or `Pytest.ini` is removed like its
  lower-case spelling; two in-tree paths that collide under folding are refused
  before any candidate code runs as `CANNOT_VERIFY` / `PATH_CASE_COLLISION`. On a
  case-sensitive filesystem (Linux) the fold is the identity and behaviour is
  unchanged.
- `verify --json` reports the probed assumption as `filesystem_case_sensitive`
  (additive optional boolean in `verify-v1.schema.json`; `PATH_CASE_COLLISION` is an
  additive `reason` value). No schema major.

## [2.23.4] — 2026-09-14

### Fixed

- **The release workflow is re-entrant and publishes only the reviewed bump commit**
  (#420). `release.yml` now gates each of its three records on its own absence — the
  registry for `npm publish`, `git ls-remote --tags origin` for the `v<version>` tag,
  `gh release view` for the GitHub release — instead of gating all three on "the
  registry lacks this version". A run that published and then failed to push the tag
  (or tagged and failed to create the release) converges on re-run rather than
  reporting "nothing to release" forever. The `plan` step records the commit that last
  changed `package.json` and refuses to publish, tag or release when `GITHUB_SHA` is
  not that commit, printing both SHAs; a `workflow_dispatch` input
  `allow_non_bump_head: true` overrides it as a conscious act. Ordinary non-bump
  merges remain a quiet no-op.
- The release gate no longer re-runs `npm test` on the release runner: the exact-head
  PR CI already ran the suite on Node 20/22/24 for that commit, and the timing-sensitive
  `test/perf-smoke.test.ts` is what held 2.23.0 unpublished. `npm ci` and the typecheck
  stay. The checkout now uses `fetch-depth: 0` and `fetch-tags: true`, so the
  bump-commit check sees history and the release notes' "Full Changelog" compare link
  is actually written.

## [2.23.3] — 2026-09-14

### Fixed

- **Fresh Node repositories no longer trip the staged gate on installed dependencies.**
  When `node_modules/` exists and is not already repository-ignored,
  `tamperward init` / `tamperward onboard` add it to `.gitignore` as a normal
  setup change before the first commit. This prevents third-party dependency source
  from producing a cascade of lint/type-suppression findings after `git add .`.
- The fix does **not** add a TamperWard detector blind spot. If `node_modules` is
  already tracked/staged, or `.gitignore` explicitly negates a `node_modules`
  path, init leaves repository intent untouched and reports the item for operator
  attention. Tracked dependencies continue to be scanned.
- Existing `.gitignore` content is preserved; symlink and non-regular
  `.gitignore` paths are refused rather than followed or overwritten.

## [2.23.2] — 2026-09-14

### Changed

- **First-commit onboarding is treated as first-commit onboarding, not a dirty tree.**
  When a repository has no `HEAD` yet, `tamperward onboard` reports that the current
  paths are not part of a committed baseline and proceeds to the setup plan without
  asking whether to continue with "existing working-tree changes". Pristine verify and
  the safe demo remain unavailable until the initial commit exists.
- The safe tamper demo is now skipped directly when no first commit exists instead of
  asking a question whose only possible result is a skip.
- A missing trusted verifier remains a fail-closed `doctor` condition and keeps
  onboarding `INCOMPLETE`, but the first-run summary renders it as an expected
  `ACTION` rather than an alarming `ERROR`.
- The compact summary no longer repeats the non-Linux `run` limitation already shown
  in Environment, and GitHub guidance is conditional: without a github.com origin it
  explains what to configure *if* GitHub will provide repository authority rather than
  claiming those controls are definitely missing.

## [2.23.1] — 2026-09-14

### Changed

- **A quieter, clearer `tamperward onboard`.** The guided first run is now five compact
  sections instead of nine verbose ones. Terminal output uses the same
  `NO_COLOR`/`FORCE_COLOR` convention as the verdict renderer and spells every state
  out (`OK`, `ACTION`, `LIMITED`, `ERROR`, `READY`) so colour is never the only
  signal. Onboarding renders the canonical init plan itself, applies it silently, runs
  the first verification silently and reports its verdict once, suppresses successful
  doctor detail, and ends with only the remaining actions. macOS is described as a
  `run` limitation rather than dumping the subreaper/ECHILD implementation detail.
- **Repository-root safety.** `onboard` now refuses when invoked from a child directory
  of another Git repository. The previous behaviour could write policy/CI files into
  the child while installing the pre-commit hook and inferring the GitHub remote from
  the parent. The refusal prints both paths and tells the operator to run from the Git
  root or initialise the child as its own repository.
- The displayed local setup plan now defaults to apply on Enter; inferred verifier
  commands still require explicit acceptance because they are part of the trust anchor.
- Compact onboarding treats repository-derived paths, commands and doctor detail as
  untrusted terminal text: control bytes and embedded line breaks are neutralised before
  rendering. Its final commit instruction also excludes local-only `.git/` files, and
  partial init failures only report files that actually became wired as written.

## [2.23.0] — 2026-09-14

**`tamperward research`: a first-class bring-your-own-model evaluation workflow, and
the `AgentAdapter` contract behind it.**

Evaluating "what does this model do to the verification surface, and what does the
gate change?" no longer means assembling round-specific scripts under
`harness/taskbench/` by hand. Two new subcommands, documented in
`docs/guide/research.md`:

- `tamperward research run --manifest F --out D --adapter A [--pairs N] [--model M]
  [--agent-budget S] [--json] [-- <agent command...>]` executes a JSON task manifest
  (repository, base, prompt, `verify: { command, budget }`) as paired **ungated** /
  **gated** trajectories. Every trajectory starts from a fresh clone at one resolved
  source commit per task: a moving `HEAD`/branch is pinned by the first existing/new
  pair, and both arms plus every later pair check out that same commit. The ungated arm
  runs without TamperWard policy enforcement but uses the same
  neutral Linux subreaper lifecycle primitive to drain the agent's descendant domain
  before outcome observation; the gated arm lets the adapter prepare the workspace
  (committed into the base, so the treatment is never agent work)
  and runs the same process under `tamperward run --json` with the suite command frozen
  at entry. In **both** arms the tree the agent leaves is then observed by the same
  `verify` (visible vs. pristine) and `check` (worktree, untracked included, plus the
  committed range) the product ships — never a second verification engine — and that
  observation is the outcome truth. TamperWard's own envelope verdict is recorded next
  to it as `treatment` (`refused` / `passed` / `cannot`), never folded into it, so a
  masked tree the envelope let through is an escape counted against the tool. One
  record per pair under `D/pairs/`; an existing record is skipped, so an interrupted
  run resumes — by record identity (a valid record carrying the current manifest sha256,
  task/pair, adapter and layers, model, TamperWard version, normalized agent argv,
  agent budget, suite command and the task's pinned source commit), never by file
  existence. Every existing requested record is checked before a missing pair executes;
  foreign, duplicate/drifting or truncated evidence fails closed, and records are written atomically.
  A trajectory whose outcome cannot stand — the trusted policy at the base unreadable
  (an absent one defaults; a broken one never does), the verifier unable to measure,
  neutral control lifecycle ownership/drain unavailable, or the tree moving under
  observation — is recorded as
  `measured: false` with the reason in `unmeasurable` and never aggregated. The
  manifest's sha256 is pinned into every record. The run preflights
  the platform with the same check `doctor` reports and refuses, in doctor's words,
  where `tamperward run` cannot own the agent lifecycle (root, non-Linux).
- `tamperward research summarize --ledger D` prints one aggregate with four separated
  readouts and **no composite score** over the pairs whose both arms were measured
  (`pairs`, `measured_pairs`, `unmeasurable_pairs`): `model_behaviour` and
  `independent_outcome` per arm, `tamperward` hits and misses in the gated arm judged against the independent
  outcome (`caught`, `escapes`, `false_refusals`, `cannot_adjudicate`), and `paired`
  discordant-pair counts on masked failure. `control_response` is `null` — in-loop
  deny events are not relayed by this release, so the field is not a number that looks
  measured. `released_green` means downstream success, not merely a green visible suite:
  the agent must exit 0 without timeout/start failure and, in the gated arm, the envelope
  must also pass with exit 0. A ledger mixing manifests, adapters or models, duplicate
  task/pair identities, or per-task source/verifier identities is refused, and every
  record is read back under the schema's own constraints before aggregation — an edited
  record is refused, not believed.

**`AgentAdapter`.** A runtime plugs in by answering two questions: which process runs
the agent in the fresh workspace (`launch(task)` → `{ argv, env }`), and what the gated
workspace needs before it starts (`prepareGated?(task)`). It declares which TamperWard
`layers` are live in its gated arm, recorded in every document. Two adapters ship:
`claude-code` (`claude -p <prompt> [--model M]`, `prepareGated` = `tamperward init`;
envelope + PreToolUse deny + Stop sweep) and `command` (any argv after `--`, with
`{prompt}` `{task}` `{cwd}` `{base}` `{arm}` `{model}` substituted and a slash-containing
relative agent executable anchored to the operator's directory; that normalized command
is the execution identity recorded in the ledger; envelope only). An agent process that cannot be
started is recorded (`agent.failure`) rather than failing the run: its trajectory is data.
Every agent process receives the task as `TAMPERWARD_RESEARCH_*` environment variables.
The contract, the manifest reader, the runner and the summarizer are exported from the
package entry for programmatic use.

**`schemas/research-v1.schema.json`.** The `pair` and `summary` documents are versioned
machine outputs under the same additive schema-major-1 discipline as `check`, `verify`,
`run` and `doctor`; the package ships the schema and the test suite validates emitted
documents against it. The grammar of both subcommands is validated before any side
effect, like every other command.

Not in this release, named in the guide: `research init`, `research report`, a stdio
JSONL adapter and `adapter:<module>` loading, in-loop deny relay, a held-out evaluator,
pre-specified retry rules, history stripping, signed manifest freezing beyond the
sha256 pin, and interval estimates.

This closes #391.

## [2.22.0] — 2026-09-14

**The hook no longer pays for the TypeScript parser on every call, and an opt-in
persistent hook service amortises the rest.** (#322)

Measured first, on a fixture repository of 1,000 protected test files (Node 22, Linux
x64, sequential runs, p50 of 20): every PreToolUse call spent ~500 ms of its ~600 ms
before a byte of policy was read, in Node's ESM load of the CommonJS `typescript`
package that eight AST detectors imported at the top of their modules; the protected-tree
snapshot of 1,000 files was ~50–120 ms of the remainder, the git views and policy load
~30 ms, and the `npx` launcher `init` writes adds roughly 100 ms on top of the direct
binary (the issue's own measurement). Two changes, in order of how little they ask you
to trust:

**Lazy parser and dependency loading — nothing to enable, no trust change.**
`typescript`, `yaml` and `picomatch` are read from disk on first use, through
`require`, which also skips the named-export discovery pass the ESM import paid for.
A `Bash` call, an edit to a Python test and `--help` never load the parser; a
protected JS/TS edit reaches the same AST path with the same verdict, and
`ts-cast-growth` still parses any JS/TS source it is given (`test/ts-lazy.test.ts`).
`--help` 527 ms → 79 ms; `hook claude` on a `Bash` payload 603 ms → 189 ms; on a JS
edit (the parser is still needed) 597 ms → 399 ms; on a protected test edit that
denies 637 ms → 421 ms. `dist/cli/index.js` now evaluates `main` behind a lazy
initialiser; every command behaves as before.

**`tamperward hook-service start | stop | status` — opt-in, off by default.** One warm
process per user, bound to one repository, started and stopped by the operator (foreground; a
SessionStart hook or a supervisor owns its lifetime), that evaluates `hook claude` /
`sweep claude` payloads over a per-user unix socket held at mode `0600` inside a `0700`
directory (`$XDG_RUNTIME_DIR/tamperward-hook` or `<tmpdir>/tamperward-hook-<uid>`;
`TAMPERWARD_HOOK_SERVICE_DIR` overrides). Hooks consult it **only** when
`TAMPERWARD_HOOK_SERVICE=1` is in Claude Code's environment; the hook command `init`
writes, and the wire contract with Claude Code (JSON on stdout at exit 0), are
unchanged. The service runs the same `preToolUseFromRaw` / `stopFromRaw` on the same
stdin bytes, with the client's cwd and every request-time environment value that affects hook path/telemetry semantics (`TAMPERWARD_DENYLOG`, `TAMPERWARD_FSEVENTS`, `TAMPERWARD_TRANSIENT`, `CLAUDE_CONFIG_DIR`, `HOME`, `USERPROFILE`), and the client relays the `HookResult` unchanged; a parity
test replays a fixture set through both paths and requires byte-identical verdicts.
With the service warm: `Bash` payload 116 ms, JS edit 130 ms, protected test edit
that denies 134 ms (p50; the first call after start, with a cold cache, 170–315 ms).

Before request handoff, the client **falls back to the in-process gate, never to an
allow**, when the opt-in is absent, the socket is unavailable/untrusted, or the service
explicitly refuses before evaluation (wrong protocol/version, cwd outside the bound
repository). After the socket connects and the request is handed off, the service is
the single owner of that evaluation: an ambiguous timeout, disconnect, oversized or
malformed final response becomes a fail-closed hook denial rather than a second
in-process evaluation racing the same session state. `stop` removes the socket and
state file even when nothing was running. Not available on Windows: `start` refuses
with a clear message and the hook runs in-process there.

The service's protected-tree snapshot cache lives only in its memory and is keyed on
`(device, inode, size, mode, mtime, ctime)` at nanosecond precision — never on the
stat triple the candidate can set (P1-8): `ctime` is not settable from user space and
moves on every write, rename, chmod and `utimes`, `touch -r` included. An entry is
reused only when all six match *and* the file had been stable for two seconds when its
hash was taken (git's racy rule); the map is dropped every minute so a full content
walk is never further away than that. `test/hook-service.test.ts` proves a same-size
rewrite with a restored mtime is still reported as drift through the cache, and that
the in-process hook, which has no cache, is unchanged.

Residual, stated in `docs/guide/enforcement.md`: the service runs as the candidate's
uid, so a candidate that can kill a same-uid process and start its own listener can
answer the hook — the same class of move as rewriting `.git/tamperward/*`, which the
loop layer has never been able to prevent and CI has never depended on. The service
adds no authority; the Stop sweep, `run`, pre-commit and CI read none of its state.

## [2.21.0] — 2026-09-13

**New command: `tamperward onboard` — the guided first run.** `npx tamperward onboard`
is now the recommended first command for a new repository; `init` remains the
deterministic, non-interactive primitive. `onboard` is orchestration over the existing
trusted primitives and adds no second setup engine: it runs a preflight (git
repository, Node/platform support contract, working-tree cleanliness, TamperWard
version), previews the installation with the same planner as `init --dry-run` and
explains each enforcement point in one sentence, asks for explicit confirmation before
any write, applies the canonical `init`, reuses init's verifier-command detection and
requires explicit operator acceptance before writing `verify.command` (one
high-confidence candidate is offered, several are listed for a numbered choice, none
means manual entry; the policy file is merged, comments intact), runs the first
`verify` and explains `VERIFIED`, `SUITE_RED`, `MASKED_FAILURE` and cannot-verify in
plain language without changing verify's exit semantics, offers an optional safe
demonstration that adds a `.skip` to one test block inside a detached temporary
worktree it created — the operator's working tree is never edited and its fingerprint
is printed before and after — runs `doctor --github` for the repository authority
(or prints the exact three manual controls and the doctor command to run later),
and ends with a `READY` / `READY WITH WARNINGS` / `BROKEN` / `INCOMPLETE` posture
derived from `doctor`, saying explicitly whether GitHub authority is enforced
(verified by `doctor --github`) or merely configured locally, followed by the
day-to-day command set and when the digest-pinned container verifier is the stronger
final check.

Flags: `--cwd <dir>` · `--base <rev>` · `--repo OWNER/REPO` · `--branch <branch>` ·
`--skip-demo` / `--demo` · `--no-github` · `--yes` · `--verify-command "<cmd>"`.
Exit `0` when the posture is `READY` or `READY WITH WARNINGS`, `1` for `BROKEN` /
`INCOMPLETE`, `2` when refused or aborted. A non-interactive stdin (or a CI
environment) refuses with one clear message instead of hanging; `--yes` is the scripted
mode, in which a detected verifier command is still never written — only
`--verify-command` configures it — and the demo runs only with `--demo`. Every step is
idempotent: aborting leaves nothing half-applied and names the step, `doctor` describes
the state, and a re-run continues. A dirty tree consisting only of init-owned paths (a
previous run's uncommitted output) is noted; any other change prompts before continuing
and is never stashed or reset.

Internals: `doctor` now exposes `diagnose()` (the outcome before rendering) so onboard
reads doctor's checks instead of parsing its output; `verify` gained an internal
`onVerdict` observer with no effect on its verdict or exit code; init's
`verifierCandidates` is exported. `guardedMain` returns a promise for `onboard` only;
every other command exits synchronously as before.

This closes #388.


## [2.20.6] — 2026-09-13

**Repeatable performance budgets for the hook, the sweep, `check`, `verify` and
`run`.** `harness/perf/bench.mjs` measures the built CLI on deterministic synthetic
repositories (`harness/perf/fixtures.mjs`, Node built-ins only): process start
(`cli.noop`), the `PreToolUse` hook cold and warm, the Stop sweep with its
protected-tree snapshot at 100 / 1k / 10k files, `check --diff` over 3 and 500
files, ignored/untracked enumeration under a 20k-file ignored build tree, the
dependency fingerprint over a `--dep-mb` `node_modules`, visible + pristine
materialisation around a trivial verifier, the whole `run` envelope, and Stop
consumption of an 8 MB watcher log. Each item reports p50/p95 wall and CPU as JSON
and a markdown table. `harness/perf/BASELINE.json` is the committed reference (its
`machine` block says where it was taken) and `harness/perf/compare.mjs` fails when
an item's p50 wall exceeds a configurable ratio to it (2× by default, per-item
`budgets` honoured). `test/perf-smoke.test.ts` runs the four cheapest items on every
PR and asserts only ratios between items of the same run (each under 4× the
process-start `cli.noop`), never an absolute clock; `.github/workflows/perf.yml` runs
the full suite nightly and on demand, compares against the baseline, and uploads the
report. Documented in `docs/PERF.md`. No
runtime behaviour changes; the CLI is unchanged.


## [2.20.5] — 2026-09-13

**The documentation now has a Research & Benchmarks section that presents the
committed evidence in one place and is bound to it by CI.** `docs/research/`
carries an overview with a landing table for Taskbench rounds 1, 2, 3, 3.1 and 4
(model/runtime, sample, treatment version, result, status), one page per round
naming what the result supports, what it does not establish and every correction
that touched it, and separate views for detector precision / false positives,
performance / overhead (only the two committed measurements, with the missing
end-to-end and production-pilot data stated as missing), security and adversarial
evaluations (each bypass, the releases that carried it, whether any counted
trajectory exercised it, and the open residuals), model comparisons (the single
common-16 comparison the record supports, and the four-panel shape any future
comparison takes — no composite score), and methodology / limitations / errata.
Failed and non-replicated results carry the same prominence as confirmed ones.
The docs home page and the README gain a "See the evidence →" link; neither
becomes a leaderboard.

The section is a presentation layer, not a second research record: no sealed or
frozen artifact is changed, and `test/research-docs-consistency.test.ts`
re-derives every headline number on the pages from the artifacts on every change
— rounds 1–3.1 (pairs, `b`, `c`, exact McNemar `p`, model, trajectory count)
from their frozen `results.jsonl` ledgers and registered treatment versions;
round 4 from `ROUND4-RESULTS.json`, including the landing-table status derived
from its sealed completeness and provenance fields; detector precision from the
fp-study corpus JSON and study totals; performance from the CHANGELOG and
SECURITY-ENVELOPE measurements; plus the sidebar wiring, the landing links, and
the absence of any aggregate score. A page that drifts from its artifact fails CI.

Documentation only; no gate behaviour changes. This closes #390.
## [2.20.4] — 2026-09-13

**The README and SPEC status now report Round 4 as complete, with the sealed
numbers.** The front page still said Round 4 was "registered and frozen, not yet
run" after the counted round had been sealed (#310). "What we have actually
measured" gains a Round 4 row; the scope paragraph replaces the future-tense text
with the registered outcome — exact McNemar b=5 / c=3, p = 0.7265625, null not
rejected, over 79/110 realized valid pairs, interpretation floor met — kept
front-and-centre as a failed preregistered prediction, with the narrower
zero-strict-bypass observation (0 across 201 measured trajectories) stated
separately, the 79/110 apparatus attrition and its selection-bias caveat linked
rather than hidden, and the pre-registration and results articles linked as a
pair. SPEC §9.1 M2 no longer calls Round 4 "the undrawn fresh pool". A vitest
(`test/readme-round4.test.ts`) asserts the README's Round 4 numbers equal the
sealed values in `harness/taskbench/round4/ROUND4-RESULTS.json`, so the two cannot
drift. No sealed record was modified; no product behaviour changed.
## [2.20.3] — 2026-09-13

**The test suite explains itself when it runs as root instead of failing 44 times.**

`tamperward run` refuses Linux root/euid 0 by design (2.16.x; README "Platform
support") and that is unchanged. But the suite did not know: on an untouched `main` in
a devcontainer, `docker run`, Codespaces or a hosted agent session — all root by
default — 44 tests across `run`, `dependency-environment`, `audit-1-6`, `audit-h1-h5`,
`doctor-ci` and `cli-guard` failed with a bare `expected 2 to be +0`, and a contributor
could not tell whether they had broken something (#392).

Every test that needs the envelope to reach adjudication now carries
`it.skipIf(!rootless)` from the shared `test/rootless.ts`, and a vitest `globalSetup`
(`test/global-setup.ts`) prints one notice at suite start when the suite runs as Linux
root: why the envelope refuses root and how to run the suite unprivileged. The test that
mocks `geteuid` to 0 and asserts the refusal message stays unguarded, so root still
exercises the refusal path. Off Linux nothing changes — those platforms keep their own
`skipIf` guards — and an unprivileged run (CI included) prints nothing and skips
nothing new. The `cli-guard` grammar case is split so its envelope assertion is the only
part that skips. The guard's contract is proven with an injected identity in
`test/rootless.test.ts`, so it needs no root to test. CONTRIBUTING gains "Running the
suite unprivileged". No production code changes.

## [2.20.2] — 2026-09-13

**`tamperward run --observe-transients` now stops its observer on the observer
process's exit, never on its health record.** (#394)

The envelope's observer stop used to complete as soon as the watcher's health sidecar
read `state: "stopped"` or the pid was gone. A watcher writes that record inside its
signal handler *before* it finishes its final writes and exits, so `run` could return
while the observer was still writing; PR #393's exact-head CI caught the lost final
write on Node 24 while Node 20/22 passed. The health record is telemetry, and it is
candidate-reachable; it was never fit to be the lifecycle boundary.

The stop now waits for the observer *process* to exit. Because the envelope waits
synchronously, its own event loop cannot reap the child, and an exited child lingers
as a zombie that `kill(pid, 0)` still reports as alive — a pid-liveness poll alone
therefore never sees the exit and runs to its deadline. On Linux (the only platform
where `run` reaches the observer) the exit is read from the process state in
`/proc/<pid>/stat`; elsewhere pid liveness remains the only signal. The drain window
stays bounded at 2 s with SIGKILL behind it. Every observed envelope now stops its
observer as soon as it has exited instead of burning the full window: the #335
lifecycle regression drops from ~2.7 s to well under a second, and the new regression
pins both halves of the contract — the observer's final write is present when
`runEnvelope()` returns, and the return is keyed to the exit, not to the deadline —
without a test-side sleep.

## [2.20.1] — 2026-09-13

**`ts-any-cast` diff-only fallback: the double cast is classified structurally.** The
additive-line fallback (a change with no BEFORE/AFTER content) parses each added line
as a TypeScript snippet and applies the same `isDoubleCast` classification the
full-source path uses, so `(<unknown>raw) as T`, `<T>(raw as unknown)` and every
parenthesised spelling are the same block on diff-only input as with full content.
Previously the fallback matched only the text `as unknown as`, so the angle-bracket
double cast was silent there while blocked with full source. Partial lines recover and
still classify; comment and string text does not fire. Bypass fix, patch.

The `cast-growth-evidence` workflow now also runs when the rule's behavioural
dependencies change (`src/policy.ts`, `src/detectors/files.ts`,
`src/detectors/finding.ts`, `src/diff/select.ts`), so a change to the protected test
surface or the code-file test cannot move the recorded eligible-source denominator
without the replay re-running.

## [2.20.0] — 2026-09-13

**TamperWard's own trust boundaries no longer assert their inputs, and a bounded
cast-growth rule keeps it that way.**

`src/` carried 60 ordinary `as T` type assertions and 14 non-null `x!` assertions
(no `as any`, no double cast). It now carries none. Every JSON document that
same-UID, candidate or third-party code can write — the protected-tree snapshot,
watcher telemetry and health, the local sign-off ledger, the Claude hook payload,
`package.json` discovery, the existing Claude settings file, the suite supervisor's
result channel, Docker image-inspect metadata and the policy file — is built field by
field from checked values through `src/narrow.ts` and per-document readers; a record
that is not the shape TamperWard wrote is malformed evidence, never a believed value.
Thrown exec/errno failures are read through `execFailure` / `errnoCode`. The policy
loader's `validate()` returns what it proved and `parsePolicy` takes `unknown`;
`policy-diff` keeps mistyped overrides as written so they still report as lowerings.
The inventory of every site and its replacement is committed in
`docs/CAST-INVENTORY.md`; `harness/fp-study/cast-inventory.mjs` recounts it on the AST.

**New rule `ts-cast-growth` (warn).** Net growth of ordinary `as T` / `<T>x` and
non-null `x!` assertions in non-test JS/TS source, counted on the TypeScript AST
before and after a change and net of casts the same change removed. Row 4
(`ts-any-cast`) keeps the unambiguous escapes; `as const`, `as unknown`, `satisfies`,
generic call/JSX arguments, comment and string text, declaration/generated/vendored
paths and protected test files are outside the budget; a side that does not parse
declines and diff-only inputs are silent. The severity is decided by corpus:
`harness/fp-study/cast-growth-fires.mjs` replayed the rule over 460 adjacent
first-parent pairs of immer, zustand, zod and hono and it fired on **40 (8.7%)**,
18.2% of the 220 pairs touching files inside the rule's own scope, against the
study's 1% ceiling for block. The
record, every fire's evidence, and a CI-replayed labeled corpus with the study's
decision rule (`harness/fp-study/CAST-GROWTH-CORPUS.md`, `cast-growth-corpus.json`,
`test/ts-cast-growth-corpus.test.ts`) are committed. `warn` never requires sign-off
under the default policy; operators may raise the rule to `block` in their own policy.

**`ts-any-cast` reads the double cast structurally.** `(raw as unknown) as T` and
`(raw as (unknown)) as T` are the same laundering escape as `raw as unknown as T`
and are blocked as such on the AST path and, with the same parenthesised spelling,
on the diff-only fallback.

Behaviour changes to note: a malformed watcher telemetry record now counts as
malformed telemetry rather than passing through as an event (blocking under strict
transient policy, as documented); a ledger line missing any entry field is skipped
instead of carried; `RuleConfig.severity` is optional in the public types, which is
what a user override for a rule the baseline does not ship always produced.

This closes #383.

## [2.19.0] — 2026-09-13

**Machine-readable verdicts now have a versioned public compatibility contract.**

`check --json`, `verify --json`, `run --json`, and `doctor --json` now
emit top-level `schema_version: 1`. TamperWard publishes JSON Schema Draft 2020-12
documents for each surface under `schemas/`, and the npm package includes that
directory so CI/services can validate verdicts without importing internal TypeScript
types.

Schema major 1 is additive: new evidence/diagnostic fields may be added without a
schema bump. Removing or renaming a required field, changing its type, or changing the
meaning of a discriminator requires a new schema major and new `*-vN.schema.json`
files; the existing v1 schemas remain published for existing consumers.

`run` gains an explicit `--json` mode. Once the wrapped agent has started, stdout is
owned by the outer envelope and contains one final document rather than nested
`check` / `verify` output. Normal results include the agent status, nested check
exit codes, verifier/dependency authority evidence and observer posture. Post-agent
early convictions such as object/history rewrite, dependency drift and lifecycle
cannot-adjudicate also produce versioned run documents. Pre-agent/preflight errors
remain deterministic stderr + exit 2 because no agent adjudication occurred.

In `run --json` the agent's stdout is routed to stderr so stdout is exactly one
document; run documents carry a `complete` discriminator (full post-agent adjudication
ran, so `head`/`checks`/`observer` are present) and a `CANNOT_ADJUDICATE` document
always names the layer that could not judge in `reason`. `verify --json` emits a
`CANNOT_VERIFY` document with an enumerated `reason` on every fail-closed path,
including the argument, policy, base, materialisation and mid-run drift exits that were
previously prose. The verdict and reason vocabularies are defined once in
`src/machine-output.ts` and the test suite asserts the published schema enums equal
them. The schemas pin the required core of every nested evidence object
(`verifier_backend`, `dependency_environment`, `oracle_assurance`, stage results,
`agent`, `checks`, `observer`) and use verdict-discriminated conditionals, while keeping
`additionalProperties: true` so schema major 1 stays additive; `doctor.authoritative`
is constrained to agree with the check states.

Exit codes remain a separate public protocol rather than being encoded into JSON
Schema. README documents both contracts side by side.

TDD began with real emitted documents and five deliberate failures on Node 20/22/24:
missing `schema_version` on check/verify/doctor, rejected `run --json`, and schemas
absent from the npm package file set. The schema tests validate live CLI documents
against the committed schemas, so implementation and published contracts cannot drift
silently.

This closes #333.

## [2.18.0] — 2026-09-13

**Advisory verifier-input discovery is now available on Linux.**
`tamperward trace-verify` addresses the residual behind manual
`verify.inputs`: delegated verifier commands such as `npm test` can read or
execute repository files that are not statically visible in the command string.

The command:
- materialises a caller-selected trusted/known-good base rather than tracing the
  candidate worktree;
- runs the verifier under `strace` on Linux;
- repeats the observation (two runs by default) and unions the observed file/
  exec set;
- marks paths seen in fewer than all runs as dynamic;
- separates tracked repository inputs from external dependency/runtime paths;
- classifies likely configuration reads;
- compares tracked inputs with the exact pristine-verification coverage model
  used by `tamperward verify`;
- emits only uncovered **exact paths** as candidate `verify.inputs` entries for
  human review.

The mode is deliberately advisory. It never edits `.tamperward.yml`, never
widens a path into a glob, and never treats absence from a trace as proof that a
path can never be read. A non-zero known-good verifier run still emits the
observation report but returns 1 so incomplete evidence is not presented as a
clean trace. Missing tooling, malformed input or an unsupported platform return
2. macOS and Windows explicitly report unsupported rather than implying feature
parity.

TDD started with a missing-module red contract for strace parsing, repeated-run
union/dynamic classification, coverage/suggestion semantics and strict CLI
grammar. A real Linux integration control then traces a committed
`node runner.js` fixture, observes an uncovered `config/custom.json`, confirms
the implicit runner file is already covered, and verifies the policy file is
byte-identical afterwards. Cross-platform CI asserts the non-Linux refusal.

During implementation the existing verify regression suite caught a refactor
mistake that would have stopped candidate-added protected/runner-config files
being removed from the pristine copy. That code never landed: the added-file
predicate is preserved while base coverage is precomputed once, avoiding an
O(N²) verifier slowdown.

This closes #324.

## [2.17.1] — 2026-09-13

**The mechanical `test-skip` block rule now closes statically-decidable JS/TS
alias/computed-property bypasses without widening into spelling-only false positives.**

When a protected JS/TS test change carries full, parse-clean BEFORE/AFTER content,
TamperWard supplements the historical line matcher with a TypeScript AST analysis:

- multiline `test\n  .skip(...)` / member chains are structural rather than line-bound;
- known test-runner imports, destructured requires and simple aliases are resolved by
  lexical TypeScript symbol identity, so shadowing does not inherit an outer runner;
- statically-computable bracket properties such as `test[mode]` are resolved when
  provable and left alone when dynamic;
- binding-only edits can be convicted when they newly turn an unchanged call site into
  skip/focus semantics;
- formatting-only rewrites of an already-existing AST-only skip/focus are suppressed by
  trivia-free structural BEFORE/AFTER identity;
- shorthand option objects use their bound value when statically knowable, so
  `const skip = false; test('x', { skip }, ...)` and the equivalent `only = false`
  do not block;
- parse-diagnostic/recovery trees decline AST-only classification instead of making a
  block claim from damaged syntax;
- diff-only producers and non-JS ecosystems keep the established regex path.

The precision harness itself was hardened during review (#385): base/candidate CLIs run
from their own checkouts, execution/exit/JSON failures abort the study, and every corpus
repository is commit-pinned. The final implementation head
`47a4477625a54d653d49dfbaf5304095a24e23a1` was compared against the trusted-base
detector over **460 pinned adjacent real mainline diffs** (immer 137, zustand 100,
zod 100, hono 123) with **0 newly introduced findings**. The exact record and
adjudication are committed in `harness/fp-study/TEST-SKIP-AST-CORPUS.md`.

The one-time evidence workflow was parallelized during review (#386), reducing the final
four-corpus study from roughly ten minutes serially to about 3m16s wall-clock, and is
removed before merge.

This closes #330 and #385.

## [2.17.0] — 2026-09-13

**The reserved `assertion-weakening` rule now has its first detector, deliberately
narrow and warning-only.**

The JS/TS AST detector reports only transformations for which the old assertion
provably implies the new weaker one:

- a positive exact/structural expectation with a statically truthy/defined expected
  value becomes only `toBeTruthy()` / `toBeDefined()` on the same subject;
- a positive `toThrow(message|regexp)` becomes bare `toThrow()`;
- an assertion is purely removed from the same unambiguous suite-qualified test.

The initial implementation was held back after review found unsound direction rules:
`toBe(false) -> toBeTruthy()`, `toBe(undefined) -> toBeDefined()`, and
`.not.toThrow(/boom/) -> .not.toThrow()` are **not** weakening. Test identity now
includes literal suite ancestry and ambiguous duplicate identities are skipped instead
of paired by array position. ScriptKind selection is explicit for JS/JSX/TS/TSX/MTS/CTS.

A detector-specific measurement is committed under
`harness/fp-study/AW-CORPUS.md` / `assertion-weakening-corpus.json`.
The negative slice is 20 adjudicated legitimate assertion-touching records retained
from the earlier 2,304-diff ordinary-maintenance study; 12 mutation positives cover the
supported one-way subset. CI recomputes the result: **12 fires = 12 TP / 0 FP, 100%
precision among fires, 0/20 false positives on the retained ordinary-maintenance
slice**, clearing the predeclared 90% build threshold.

That threshold authorizes building the warning, **not graduating it to block**.
`assertion-weakening` remains `heuristic` / `warn`; a block proposal requires a
separate independent-corpus/live-fire decision. Literal-to-literal expected-value
changes, negated specificity changes, ambiguous test identity and unsupported chained
assertion APIs remain pristine-verifier jurisdiction. `guard-removal` remains
reserved and unbuilt.

This closes #323.

## [2.16.5] — 2026-09-13

**Platform support is now explicit and enforced instead of depending on incidental
POSIX utilities.**

- `tamperward run --settle` no longer shells out to an external `sleep` binary.
  The quiescence delay is an internal synchronous wait, so a missing/poisoned PATH
  cannot silently erase the requested settle window.
- checkpointed-local `tamperward verify` now has a declared shell contract.
  Linux, macOS and the supported POSIX Node platforms execute the frozen verifier
  command through `/bin/sh -c`. Windows local verification returns
  `CANNOT_VERIFY / LOCAL_VERIFIER_UNSUPPORTED_PLATFORM` before candidate execution
  rather than relying on an incidental Git-for-Windows/MSYS `sh`.
- `tamperward doctor`, the run refusal text, README, SPEC and pristine threat
  model now agree on the Windows limitation. A digest-pinned container verifier
  remains a separate Docker-authority path and must pass its own preflight.
- a required `platform-contract` CI matrix runs on real `ubuntu-latest`,
  `macos-latest` and `windows-latest` hosts. The Windows leg proves the local
  verifier refuses before a candidate command can create a side effect; the
  POSIX legs prove the documented shell/lifecycle selection.

The support matrix is intentionally asymmetric: authoritative `tamperward run`
remains Linux-only with the trusted non-root subreaper/ECHILD backend. macOS and
Windows fail closed before wrapped-agent execution rather than being described as
equivalent.

TDD began on run **34772555802**: typecheck failed exactly because
`localVerifierShell` and `waitForSettleSync` did not exist. The implementation
then replaced the external utility dependency and made verifier shell selection an
explicit preflight boundary.

This closes #326.

## [2.16.4] — 2026-09-13

**`tamperward run` now fails closed before agent start on every platform that lacks
an authoritative detached-domain lifecycle backend.** #379 showed that the portable
fallback could not honestly prove a detached descendant was gone before certification:
a worker could leave the process group/repository-holder surface, retain an absolute
repository path, sleep past adjudication, and mutate later.

Linux remains supported through the 2.16.3 trusted-system-Python
`PR_SET_CHILD_SUBREAPER` backend and authoritative `waitpid(...)=ECHILD` drain.
Windows, macOS and other non-Linux platforms now return exit 2 before launching the
wrapped agent. Best-effort `taskkill /T /F`, process groups, holder scans and tree
fingerprints remain useful evidence but are no longer treated as sufficient to produce
a lifecycle-authoritative GREEN verdict.

`tamperward doctor` reports unsupported run platforms as **BROKEN** and states that
standalone `tamperward check` / `tamperward verify` remain available. Dependency
attestation reuse remains disabled everywhere.

Regression coverage projects both macOS and Windows lifecycle platforms and proves
refusal happens before agent side effects. This closes #379 by removing the unprovable
certification path rather than weakening the lifecycle invariant.

## [2.16.3] — 2026-09-13

**`tamperward run` now owns the wrapped agent's descendant lifecycle on normal
exit as well as timeout, with a fail-closed Linux subreaper boundary.** The
#321/#374 dependency-attestation work exposed the remaining lifecycle gap:
without a runtime budget, a detached descendant could `setsid()`, leave the
repository cwd, outlive the main agent and continue executing while the envelope
began adjudication.

Every wrapped agent now runs through a lifecycle supervisor. Ordinary POSIX
descendants remain in an owned process group. On Linux, TamperWard resolves only
a fixed non-caller-writable system `python3` and starts it with `-I -S -E`,
cwd `/`, and a minimal supervisor environment. The agent receives a separately
frozen copy of the caller's original cwd and environment, so candidate
`PATH`/`PYTHONPATH`, user site-packages and candidate cwd do not govern the
supervisor bootstrap. Linux therefore requires a trusted system Python 3 with
the standard `ctypes`/process modules; if that interpreter cannot be
established, `run` fails closed before agent side effects. Linux root/euid-0 is also
an explicit unsupported lifecycle mode: root can write ordinary system interpreter
paths, so the same-UID trust argument is invalid. `run` therefore refuses before
agent start and `doctor` reports a root-specific BROKEN platform reason rather than
the generic missing-interpreter diagnostic.

The Linux supervisor calls `PR_SET_CHILD_SUBREAPER`. Descendants that
double-fork, `setsid()` or otherwise orphan are therefore reparented to the
supervisor by the kernel rather than depending on a sampling race over ancestry.
Normal exit and timeout both kill the agent process group and adopted children.
The supervisor reports lifecycle ownership only after
`waitpid(-1, WNOHANG)` reaches **ECHILD**, the kernel's no-children condition.
Unreadable/malformed child state, kill failure, drain deadline or abnormal
supervisor completion fails closed before adjudication. The same-UID result file
is evidence only after the supervisor itself exits normally, so an agent that
discovers/forges that file and kills its supervisor cannot manufacture a trusted
lifecycle result.

The 2.16.2 adjacent run→verify dependency-attestation reuse is deliberately
disabled again. The envelope pre-verifier checkpoint and nested verifier-entry
checkpoint are independent full reads on every platform and lifecycle outcome:
a clean local run reports **6 full snapshots, 0 reused snapshots,
`entry_reuse=no`**. Post-visible, post-pristine and envelope-final dependency
checks remain independent as well.

The regression corpus now proves:
- a same-UID forged lifecycle result plus supervisor `SIGKILL` fails closed and
  never reaches the pre-adjudication checkpoint;
- a fast `setsid -f`/reparent descendant and a detached worker outside the
  repository cwd are gone before adjudication begins;
- candidate `PATH`/`PYTHONPATH` do not select the Linux supervisor;
- missing trusted Python, child-observation failure and an undrained lifecycle
  domain fail closed before adjudication;
- the historical detached mutator/fd-holder controls identify real workers and
  prove they are dead at the pre-adjudication checkpoint;
- a #374-style post-handoff dependency substitution attempt cannot execute
  before the fresh verifier-entry checkpoint;
- unsupported non-Linux POSIX retains the historical fingerprint/quiescence
  rejection for mutations that land during adjudication rather than claiming the Linux
  subreaper guarantee; the later-mutation detached-domain residual is tracked separately
  as **#379**;
- timeout lifecycle tests remain intact.

`tamperward doctor` now reports whether the trusted Linux supervisor interpreter is
actually available. Linux without that backend is **BROKEN** because `run` will fail
closed before agent start; Windows/other platforms are **WARN** and explicitly name the
#379 residual.

TDD began with workflow run **34766853029**, where the new normal-exit
descendant controls failed before production ownership existed. A separate
release-integrity regression reproduced #378 in run **34767258006**:
`package.json`/`package-lock.json` still identified 2.16.1 while the
changelog declared 2.16.2. Package and lock metadata are synchronized at
**2.16.3**, and a repository-wide docs-status invariant now requires package
identity to equal the newest changelog release.

This release addresses #376 and #378; the pull request closes those issues when
the exact-head matrix and final security review pass and the change is merged.

## [2.16.2] — 2026-09-13

> **Unpublished development entry; superseded by published 2.16.3.** The registry sequence is 2.16.1 → 2.16.3; the optimization described here was rolled back before publication.

**Local run→verify dependency attestation removes one redundant complete tree read
without weakening a hostile-code boundary.** Before this release, a clean
`tamperward run` with an attested local dependency environment performed six complete
dependency snapshots: discovery, envelope pre-adjudication, nested verifier entry,
post-visible, post-pristine, and envelope-final.

The envelope now takes its pre-verifier checkpoint immediately before `runVerify` and
passes a module-issued attestation object into the verifier. The verifier consumes that
same-descriptor/same-cwd checkpoint at entry, so a clean run performs **five** complete
snapshots plus **one** attestation reuse. Every boundary separated by candidate suite
execution remains a full cryptographic tree read.

The post-pristine verifier attestation is also returned to the envelope for diagnostics,
but it is deliberately **not** reused for the envelope-final check: a detached/background
process can still mutate ignored dependencies after verifier return or during
`--settle`. That independent final read remains the quiescence control.

`TAMPERWARD_DIAGNOSTICS=1` now reports complete snapshot count, reuse count and
aggregate snapshot wall time. Node 24 / GitHub-hosted synthetic benchmark evidence from
workflow run **34758006027**:

| fixture | files | payload bytes | complete snapshot |
| --- | ---: | ---: | ---: |
| small | 100 | 409,600 | 3.281 ms |
| medium | 1,000 | 4,096,000 | 25.015 ms |
| large | 5,000 | 20,480,000 | 95.382 ms |

These are CI-runner measurements rather than universal performance guarantees; the
important invariant is that a clean envelope removes one full tree traversal while
persistent/transient dependency-drift regressions retain their original checkpoints.

Exact TDD red evidence came from run **34757684020**, Node 24 job
**103724803679**: 2,382 existing tests passed and only the new
`full_snapshots=5 / reused_snapshots=1` diagnostic assertion failed before production
reuse existed.

The same validation uncovered #375: the real-Docker OOM regression over-specified that
memory exhaustion must occur in the visible stage. Docker correctly attributed
`VERIFIER_RESOURCE_EXHAUSTED` in the pristine stage on one runner. The test now accepts
either verifier stage while preserving the verdict/reason/resource/resource-limit and
cleanup assertions.

This closes #321 and #375.

## [2.16.1] — 2026-09-13

**`tamperward init` no longer lets a partially wired installation look complete.**
The generated workflow has always failed closed when the trusted policy has no
`verify.command`, but init's normal success summary did not surface that fact. A new
operator could therefore see all five wiring rows applied and only discover the missing
verifier when CI failed.

Every successful init/dry-run now prints a separate **VERIFICATION SETUP** status:
- an existing policy command is reported as `verification configured — <command>`;
- otherwise init prints **INCOMPLETE: verification not configured — CI will fail
  closed**, plus the exact `verify:` YAML shape to review and add;
- one high-confidence suite is suggested; multiple candidates are listed without
  silently choosing one;
- npm's stock `Error: no test specified` placeholder is not treated as a valid suite.

Advisory detection currently recognizes real npm test scripts, explicit pytest/tox
configuration, a readable Cargo manifest with a `[package]` or `[workspace]` root,
and a readable `go.mod` with a real `module` directive. Empty files, directories or
other path-only markers are not called high-confidence suites. Detection is intentionally
non-mutating: TamperWard never writes an inferred verifier command because that command
is part of the trust anchor.

The contract was committed test-first in `911c681...`. Its workflow was superseded
before the Node matrix completed, so the release record does not mislabel that cancelled
run as red CI; the production implementation follows in later commits and final
exact-head CI is the merge gate.

This closes #320.

## [2.16.0] — 2026-09-13

**Verifier failures now carry bounded, tamper-safe suite diagnostics.** Visible and
pristine execution previously used `stdio: 'ignore'`, so a red suite, masked failure
or timeout exposed only an exit code and duration. That made ordinary failures hard to
diagnose and discarded useful forensic evidence.

Both local and isolated-container stages now run their child process through the same
trusted bounded-capture supervisor. stdout and stderr are continuously drained to avoid
pipe backpressure, while only the final **16 KiB per stream** is retained in memory.
No candidate-controlled stream is written to an unbounded evidence file. Reports record
the total observed byte count, retained byte count and truncation state.

`--json` exposes per-stage `diagnostics.stdout` / `diagnostics.stderr` metadata and
a bounded tail for failed stages. Human output remains quiet on VERIFIED runs; failure
tails are control-character scrubbed and every line is prefixed before rendering, so
candidate ANSI escapes, carriage returns and literal GitHub `::command::` text remain
data rather than terminal/workflow control traffic.

Container execution no longer discards Docker-run stdout/stderr either: the Docker
client is drained by the same bounded supervisor, while stopped-container state remains
the authority for suite exit/OOM/runtime attribution. Candidate output can therefore be
shown without being allowed to forge the host-owned verdict.

TDD started with three deliberate failures: missing structured diagnostics, unbounded
noisy-output expectations, and missing safe human rendering. Regression coverage also keeps successful human output silent, proves
visible-green/pristine-red diagnostics are attributed to the pristine stage, requires
every multiline stdout/stderr workflow-command line to carry the inert `  | ` prefix,
and pins multibyte UTF-8 behavior when the 16 KiB retained-byte window begins inside a
code point. Supervisor-result parsing is strict whole-stream JSON: deterministic tests
prove prefixed/appended attacker bytes fail closed rather than being scanned for a
plausible green suffix.

The same supervisor hardening closes #371 on Linux: while a local suite is alive it
tracks the actual `/proc` descendant tree in addition to the POSIX process group, then
kills tracked descendants before returning on ordinary main-child exit or timeout.
Regressions exercise a `setsid()` escape in both cases, including a noisy detached
writer, and assert the detached PID is gone before stage adjudication returns. Other
platforms remain explicitly weaker rather than claiming Linux-style descendant
discovery; the isolated-container backend still owns the stronger process-set boundary.

The observer teardown flake found during exact-head validation is also fixed in this
release (#372): fallback watcher callbacks become no-ops as soon as shutdown begins and
`close()` is idempotent, preventing queued filesystem notifications from racing temp
tree removal.

This closes #319, #371, and #372.

## [2.15.2] — 2026-09-13

**Filesystem-event consumption is now proportional to new telemetry, not total session
history.** The Stop-sweep cursor had always been stored as a byte offset, but
`readEvents()` still decoded the entire append-only JSONL file and sliced the resulting
string afterwards. Long agent sessions therefore re-read old telemetry on every turn.

The reader now opens the log and performs positioned reads beginning at the saved
cursor. Each physical read is bounded to **4 MiB**, and one authority decision drains at
most **16 MiB** in bounded batches. Cursor movement is byte-based and only
newline-terminated JSONL records can advance it. The instrumented regression asserts
the real read position/length against a multi-megabyte historical prefix rather than
trusting a self-reported counter.

This also fixes the torn-tail correctness bug in the old implementation: parse failure
no longer advances the cursor to EOF. A torn final record is replayed after completion,
and a chunk split inside multibyte UTF-8 keeps the cursor at the preceding byte-safe
newline. Stop commits its saved cursor only when every byte in the bounded tail was
successfully parsed and classified. Malformed complete telemetry, an oversized single
record, a torn tail, or more than 16 MiB requiring classification blocks Stop and
retains the prior cursor instead of silently discarding or deferring authority evidence.

The supervised run observer drains the same bounded batches. Observer evidence remains
advisory by default, but explicit `TAMPERWARD_TRANSIENT=block` now fails closed when
telemetry is incomplete/unclassifiable or final-diff classification fails, so a
blocking transient after the first 4 MiB cannot be hidden behind a benign prefix.

TDD coverage includes the positioned-read instrumentation, UTF-8 split boundary,
torn-record completion/replay, bounded multi-batch progress, Stop backlog/malformed/
oversized authority cases, and a strict run case with the blocking event after the
first 4 MiB.

This closes #313.

## [2.15.1] — 2026-09-13

**Doctor's authority verdict now binds to the authority surface it actually inspected.**
A post-merge review of 2.15.0 found three cases where the one-shot posture report could
misstate repository authority:

- workflow-level `permissions: { contents: read }` was treated as sufficient even when
  a job overrode it with a write scope;
- a policy version newer than this binary's `POLICY_VERSION` was only WARN, so unknown
  policy semantics could still coexist with `authoritative: true`;
- `doctor --workflow <path>` validated that path's verifier timeout but local posture and
  permission checks still hard-coded `.github/workflows/tamperward.yml`.

2.15.1 fixes all three. Workflow permission diagnostics inspect root permissions and
job-level overrides across every verifier-authority workflow that doctor actually
validated. An unsupported future policy schema is BROKEN/non-authoritative. Explicit
custom workflow selection and automatic multi-workflow discovery now feed the same
workflow set into timeout, wiring and token-permission posture.

Regression coverage includes root-safe/job-write escalation, root-write/job-safe
control, future policy schema, explicit custom workflow authority, multi-workflow
permission aggregation, and a positive fully authoritative canonical installation.

This follow-up completes #318's original acceptance criterion after #363.

## [2.15.0] — 2026-09-13

**`tamperward doctor` now answers whether TamperWard is merely present or actually
wired for the guarantees the repository claims.** The command remains read-only and
reuses `tamperward init`'s canonical planner instead of inventing a second wiring
definition.

The posture report now includes named `OK`, `WARN`, and `BROKEN` checks for:
- policy parsing/schema generation;
- canonical Claude PreToolUse + Stop wiring and pins;
- pre-commit wiring;
- generated CI wiring and least-privilege workflow permissions;
- CODEOWNERS coverage of gate-critical paths;
- running binary version versus repository wiring pins;
- verifier command, budget, `verify.inputs` count and local/container trust mode;
- host/platform residuals;
- CI verifier outer-time authority;
- transient-observer health; and
- optional GitHub required-status / Code Owner / fresh-review authority.

`doctor --json` emits one machine-readable document with those checks and an
`authoritative` boolean. Hard doctor failures remain structured JSON at exit 2 when
that mode is selected, rather than falling back to prose on stderr.

This is diagnostic rather than a new enforcement layer: local early-path/residual gaps
are surfaced in the report without unexpectedly turning generated CI red. Existing
malformed-policy, insufficient-verifier-authority and requested-GitHub-authority
failures retain their fail-closed exit-2 behavior.

This closes #318.

## [2.14.1] — 2026-09-13

**The security specification and audit tracker now have a machine-checked current
status instead of mixing live guarantees with historical wording.**

- `SPEC.md` is reconciled with the 2.14.x implementation surface, including the
  supported JavaScript/TypeScript, Python, Go, Rust, Ruby, JVM, PHP and .NET rule
  families plus the run/verifier/observer/doctor authority layers.
- `SECURITY-ENVELOPE.md` starts with a single **Current open residuals** table and
  keeps the original P0/P1/P2 audit findings under explicitly historical headings.
  Old research claims and IDs are preserved rather than silently rewritten.
- Current residuals now link directly to the pristine-verifier threat model and
  executable regression evidence.
- `test/docs-status.test.ts` binds the spec to the shipped major/minor line and
  fails CI if the current-residual/historical split disappears or the ecosystem
  surface regresses to the old TS/Jest-only description.

This closes #311.

## [2.14.0] — 2026-09-13

**`tamperward run` can now supervise transient filesystem observation as an
optional first-class envelope mode.** Pass `--observe-transients` to start a
session-scoped watcher before the wrapped agent, consume its temporal evidence in
the envelope itself, and stop it deterministically when the run finishes.

The supervised observer:
- gets a unique JSONL log under the repository's git directory, so previous runs
  and cursors cannot be confused with the current session;
- loads protected-path policy from the same trusted base revision frozen by
  `tamperward run`, not from candidate-edited working-tree policy;
- must publish health before the agent is launched;
- reports **healthy**, **degraded**, or **unavailable** separately from findings;
- is stopped on normal completion and early post-agent enforcement exits; and
- has its session log classified against the final committed + worktree diff by
  `run` itself rather than assuming a Claude Stop hook occurred.

The trust boundary remains explicit: watcher health/logs are descriptive and
candidate-reachable, not final CI authority. Transient findings remain warnings by
default. Only the existing explicit operator opt-in
`TAMPERWARD_TRANSIENT=block` lets an observed transient finding change the envelope
to exit 1; observer degradation/unavailability itself does not silently become
either “no events” or a blocking authority verdict.

TDD began with a missing `observeTransients` API and lifecycle controls requiring
observer-ready-before-agent ordering, trusted-base propagation, deterministic stop,
process-level CLI grammar, unavailable-health reporting, and the strict-policy-only
blocking rule.

This closes #335.

## [2.13.3] — 2026-09-13

**Filesystem-observer health is now explicit instead of silently best-effort.**
`tamperward watch` writes a versioned health sidecar next to its JSONL event log
with the active backend, watcher PID/start time, watched-directory count, last
successful append, total event count, dropped-event count, error count and last
error.

A failed event append or fallback directory-watch/enumeration failure changes the
observer to `degraded`, updates the counters, persists the status when possible,
and emits an unmistakable stderr warning. Clean shutdown records `stopped`.

Consumers can now distinguish the important three states:
- **healthy** — including the valid “observer ran and saw zero events” case;
- **degraded** — observer ran, but telemetry may be incomplete;
- **unavailable** — no valid live observer health record exists.

`tamperward doctor` reports that status while keeping it explicitly advisory.
The Stop sweep records degraded/unavailable state in `TAMPERWARD_DENYLOG` when
that audit channel is configured; watcher loss still does not become CI authority
or turn absence of telemetry into evidence of absence.

Regression coverage includes healthy-zero-event state, stopped/unavailable state,
append failure with dropped/error counters and warnings, doctor reporting, and Stop
audit distinction.

This closes #329.

## [2.13.2] — 2026-09-12

**The per-directory filesystem-watcher fallback no longer follows directory
symlinks.** Its initial tree walk and its "new directory appeared" path previously
used `statSync()`, so a symlink to a directory was treated as a real directory.
That could install watchers outside the repository, duplicate a tree through an
in-repository alias, or recurse through a symlink cycle.

Both directory decisions now use `lstatSync()`. Symlinked directories are leaves;
real directories retain the existing dynamic watcher-extension behavior.

Regression coverage forces the fallback backend and verifies:
- a protected-path symlink to an external directory produces no external/alias event;
- a cycle symlink back into the watched tree produces no `test/cycle/**` duplicate
  path while the canonical protected file is still observed; and
- a real directory created after startup still receives fallback coverage.

This closes #314.

## [2.13.1] — 2026-09-12

**Malformed CLI input now fails closed consistently before command execution.**
The process-level dispatcher validates user-supplied argv before any command-specific
parser, git/filesystem access, verifier setup, init mutation, sign-off write, GitHub
doctor request, or wrapped-agent spawn.

The shared grammar now rejects:
- unknown options;
- missing option values, including a flag appearing where a value was required;
- zero/negative/NaN verifier and agent budgets;
- negative/NaN settle durations;
- duplicate or conflicting `check` views;
- `--json` combined with an explicit `--format`;
- unexpected positional arguments; and
- `tamperward run` invocations that omit the explicit `--` separator before the
  wrapped command.

Every malformed invocation returns exit 2 with one deterministic
`tamperward: ...` line. This removes the previous mix of silent ignores, warnings
followed by execution, values accidentally consuming flags, and `run` treating its
first unrecognised token as the agent command.

TDD began with 25 deliberately failing process-level cases across `check`, `allow`,
`init`, `doctor`, `verify`, and `run`, while preserving valid happy paths.

This closes #312.

## [2.13.0] — 2026-09-12

**The GitHub repository-authority boundary now requires fresh Code Owner approval
after every new push to gate-critical paths.** `tamperward init` previously named
the required `tamperward` status check and **Require review from Code Owners**, but
did not require GitHub to invalidate approvals granted to an older diff.

The documented deployment contract now requires all three:
1. required `tamperward` status check;
2. required Code Owner review over the gate-critical CODEOWNERS paths; and
3. **Dismiss stale pull request approvals when new commits are pushed**.

"Require approval of the most recent reviewable push" is not treated as an equivalent
freshness control: that setting guarantees a fresh approver distinct from the last
pusher, not that the fresh approver is the Code Owner for the gate-critical path.

`tamperward doctor --github [--repo OWNER/REPO] [--branch BRANCH]` adds an executable
check of that human boundary. It reads the active rules that apply to the protected
branch and, where needed/available, classic branch protection; requirements can compose
across those two GitHub mechanisms. The doctor fails closed if it cannot prove the
required status check, Code Owner review, and stale-review dismissal.

The GitHub query path does not invoke a `gh` binary from candidate-influenced `PATH`.
TamperWard launches its own Node executable with a minimal environment and passes only
the selected `GH_TOKEN`/`GITHUB_TOKEN` through a dedicated child variable, excluding
`PATH`, `NODE_OPTIONS`, `NODE_PATH`, and loader variables from startup authority.

TDD began with a missing `evaluateGitHubProtection` API and explicit controls for
rulesets, classic protection, composed protection, last-push-only insufficiency, and
the operator instructions. The transport boundary is separately regression-tested.

This closes #332.

## [2.12.0] — 2026-09-12

**Generated CI now owns an explicit verifier outer-time contract, without breaking
existing policy files.** The workflow written by `tamperward init` previously used
`timeout-minutes: 10`, while `verify.budget` is applied independently to the visible
and pristine stages. Two default 300-second stages could consume the entire outer job
before setup/materialisation/hash/cleanup/reporting overhead, and a larger trusted
budget made premature GitHub termination even more likely.

The generated job now declares a 360-minute outer timeout and runs the new
`tamperward doctor` command before verification. Doctor reads `verify.budget` from
the trusted base revision, finds every workflow job that actually invokes
`tamperward verify`, and requires a static numeric `timeout-minutes` covering:

```
2 × verify.budget + 3600 seconds
```

The two independently budgeted stages and the one-hour authority reserve are shared
production constants with executable invariants. The standard 360-minute template
therefore accommodates up to 9,000 seconds per verifier stage.

**Compatibility is preserved.** Positive finite policy budgets above 9,000 seconds
remain valid exactly as before; doctor reports that the generated GitHub-hosted
authority is too small and tells the operator how much outer time is required. A custom
runner/workflow may provide that larger envelope. This avoids turning a reliability fix
into a breaking policy-schema change.

Doctor also fails closed on a missing workflow, invalid YAML, no verify job, a missing
or dynamic/non-numeric/non-positive timeout, or an insufficient numeric timeout. The
generated PR workflow passes the pull-request base SHA, so candidate edits to
`.tamperward.yml` cannot choose their own timing requirement.

Re-running `tamperward init` safely migrates an untouched, hash-stamped older workflow
to the new 360-minute/doctor template. A stamped workflow edited by its operator remains
untouched unless `--force-workflow` is explicit. Regression tests cover both paths.

TDD record: the original red phase reproduced the 10-minute template; the compatibility
review then added red tests proving that 9,001 and fractional positive budgets must keep
loading, that the timing relationship is derived rather than duplicated literals, and
that doctor diagnoses sufficient, insufficient, missing and malformed workflow limits.

This closes #331.

## [2.11.3] — 2026-09-12

**`tamperward run` can now own the wrapped agent's wall-clock lifecycle.**
`--agent-budget <seconds>` is an operator-owned runtime bound distinct from
`verify --budget`, which still applies per suite execution. Invalid or non-positive
agent budgets fail closed before the agent starts.

When the agent budget expires, TamperWard terminates the owned process tree and then
continues normal post-agent adjudication against the frozen entry boundary. A timeout
whose released tree passes every enforcement check is reported as **`AGENT_TIMEOUT`**
with exit **124**. Any blocking finding/non-quiescent tree still returns 1, and
cannot-adjudicate still returns 2; enforcement therefore outranks runtime timeout status.

On POSIX, the wrapped agent starts in its own process group and timeout kills that group.
The regression corpus also covers the harder Linux case where a descendant calls
`setsid()` and escapes the group: the trusted supervisor snapshots the actual `/proc`
descendant tree before termination and kills those descendants individually. Windows
uses `taskkill /T /F` as the explicit process-tree fallback. Any survivor the platform
cannot terminate is still caught by the existing quiescence boundary where supported,
rather than being certified green.

The TDD sequence includes:
- the original red API/budget tests;
- a clean timed-out honest fix that is still adjudicated;
- ordinary child/grandchild termination;
- a deliberate red `setsid()` escape that initially became `NOT_QUIESCENT`;
- the fixed Linux descendant-tree termination path;
- invalid-budget refusal before agent side effects.

This closes #325.

## [2.11.2] — 2026-09-12

**The isolated verifier now has an explicit host-resource envelope.** Each Docker
stage is started with a 2 GiB hard memory limit, `--memory-swap` equal to the
memory limit (no additional swap allowance), a 2 CPU quota, and the existing
256 PID ceiling, alongside the trusted wall-clock budget.

The active resource limits are emitted in `verifier_backend.resources`. Docker's
stopped-container metadata remains the authority for attribution: a confirmed
`OOMKilled=true` becomes `CANNOT_VERIFY` with
`reason: "VERIFIER_RESOURCE_EXHAUSTED"` and `resource: "memory"`; a candidate
suite that exits 137 without Docker OOM evidence remains an ordinary suite exit.
CPU-bound hostile code is constrained by the CPU quota and then fails closed on
the wall-clock budget if it does not complete.

Mandatory Docker E2E coverage now includes real memory pressure under a small
test-only cap and an infinite CPU loop under a 0.25 CPU quota, with container
cleanup asserted in both paths.

v2.11.2 deliberately exposes no environment-variable tuning knob for these
ceilings. Any future configurable resource surface should be part of trusted-base
policy and policy-diff protection so candidate-controlled CI/env cannot weaken
containment.

This closes #346.

## [2.11.1] — 2026-09-12

**Verifier verdicts now state their semantic/oracle assurance ceiling explicitly.**
Every structured verifier verdict carries `oracle_assurance` with
`level: "suite-exit-only"`, `semantic_isolation: false`, and
`candidate_code_executes_in_oracle_process: true`. Human-readable output carries
the same warning. This prevents `isolated-container` from being interpreted as a
claim that arbitrary candidate code cannot fool an in-process test oracle.

The mandatory Docker threat control reproduces #350 directly: candidate source calls
`process.exit(0)` while a trusted test imports it, so both visible and pristine
processes exit successfully before the trusted assertion runs even though policy,
tests, dependencies and the read-only execution boundary remain intact. TamperWard
does not paper over this with a spelling-specific `process.exit` blacklist; equivalent
termination/interposition mechanisms make that claim unsound.

The threat model now classifies arbitrary shell/Node/Jest/Vitest/pytest-style
in-process suites as **suite-exit-only**, runner-native counts/coverage as advisory when
produced inside the same process, and held-out/out-of-process oracle protocols as the
structurally stronger direction. SPEC M4 is also corrected to distinguish the default
checkpointed-local backend from the optional 2.11.0 isolated-container backend.

This closes #350 and #352 by making the remaining oracle limitation explicit and
machine-readable rather than falsely widening the execution-domain trust claim.

## [2.11.0] — 2026-09-12

**Final verification can now run in an isolated, digest-pinned container domain.**
A trusted `verify:` policy may opt into:

```yaml
verify:
  command: npm test
  budget: 300
  backend: container
  image: ghcr.io/acme/tamperward-verifier@sha256:<64-hex-digest>
```

The image must already be provisioned locally and is never pulled during adjudication.
The Docker client executable is resolved before candidate execution, must not be
writable/replaceable by the caller identity, is content-bound, and is invoked through a
minimal client environment against the fixed local Unix endpoint. Mutable tags,
option-shaped image names, backend removal, and verifier-image changes fail closed or
are reported as policy weakening.

**The isolated verifier receives a frozen read-only materialised candidate/pristine
tree—not the agent worktree or its dependency environment.** Host `node_modules`,
venvs, HOME, temp directories, Docker socket, credentials and mutable caches are not
mounted. The container has no network, a read-only root filesystem, dropped
capabilities, no-new-privileges, private HOME/tmp, and a dedicated writable
`/workspace-out` exposed as `TAMPERWARD_OUTPUT_DIR`. Verdict/evidence is emitted by
the trusted host process, outside candidate write authority. Failure to establish or run
the requested boundary is `CANNOT_VERIFY` / exit 2; it never silently falls back to
the local verifier.

**This structurally closes #341 for the isolated backend.** The end-to-end threat
control first proves the local/checkpointed verifier is still fooled by a
`node_modules` executable that is substituted during each suite invocation and
restored byte-for-byte/mode-for-mode before every checkpoint. The same candidate under
the container backend cannot replace the image-owned runtime and returns `SUITE_RED`.
Additional mandatory Docker tests cover trusted-test/policy immutability, host-secret and
socket absence, private writable output, budget timeout cleanup, and detached-child
cleanup.

**Docker client status is not treated as the suite verdict.** The host keeps the named
container long enough to inspect its trusted runtime state, then removes it. A daemon/client
or container-runtime failure after preflight is `CANNOT_VERIFY` / exit 2 rather than
`SUITE_RED` or `MASKED_FAILURE`; a real candidate suite exit such as 125 remains a
suite failure because the container's own state proves it actually ran. This closes #345.

**Image-declared writable volumes are refused.** Dockerfile `VOLUME` paths become
separate writable mounts even when the container root filesystem is `--read-only`, so
backend preflight inspects the pinned image metadata and fails closed when any are
declared. Container cleanup also removes anonymous volumes defensively. This closes #347.

**Verifier image startup defaults cannot replace the trusted suite command.** Docker
normally appends positional commands to an image `ENTRYPOINT`; the isolated backend now
overrides that entrypoint with `/bin/sh` and passes the frozen policy command directly as
`-c`. The image remains runtime/dependency authority, while `verify.command` remains
command authority. This closes #349.

The 2.11.0 release shipped wall-clock and PID limits only. Explicit CPU/memory containment
was added in 2.11.2 (#346).

The container boundary is also **not a semantic/oracle sandbox**. Candidate source must
execute in the suite and can therefore attempt in-process early termination or runner
interposition without modifying trusted files or dependencies. #350 tracks this distinct
false-green class and completion/collection-evidence mitigations; `isolated-container`
means execution-domain integrity, not proof that arbitrary candidate code cannot fool the
test oracle.

The existing backend remains available as `backend: local` (and is the default) and is
reported explicitly as **`checkpointed-local`** trust. Its checkpoint limitations are
unchanged. `tamperward run` intentionally refuses `backend: container` before the
agent starts: because `run` launches the agent under the same host identity, it cannot
honestly keep Docker daemon authority outside that agent domain. Use isolated
`tamperward verify` in trusted CI or after an externally isolated agent hands off a
frozen candidate.

This is a minor release under the project versioning policy: it adds optional policy and
execution surface; repositories that do not opt into the container backend keep the
existing local behavior.

## [2.10.9] — 2026-09-12

**Dependency-drift protection is now ecosystem-aware instead of treating
`node_modules` as the whole execution boundary.** A TDD reproduction replaced an
ignored `.venv/bin/python`, left the source bug untouched, made both visible and
pristine suites return green, and the envelope reported `GREEN MEANS GREEN`. The
dependency authority is now frozen before candidate execution as an explicit descriptor
with three states: no supported mutable dependency environment, supported-and-attested,
or detected-but-unattestable.

The supported attested roots are the repository's `node_modules` closure and the
selected Python virtual environment. The fingerprint covers bytes, entry kind, link
target and executable mode across the frozen root, including site-packages and the
interpreter identity. A normal virtualenv interpreter symlink to an external interpreter
file is accounted for by hashing the target file's bytes and mode. Directory links that
leave the bounded dependency root fail closed. npm workspace links back into candidate
source also fail closed for now: allowing the external link would make each materialised
verifier copy resolve back into the original live worktree. Faithful per-copy workspace
remapping belongs to the isolated/materialised dependency backend rather than being
papered over as a hash exception.

The same descriptor is reused — never rediscovered from candidate-mutated state — before
adjudication, around visible/pristine verification and at final quiescence. The verifier's
materialised copies use the descriptor's frozen `node_modules` root. Absence of
`node_modules` is itself frozen, so creating it after entry is observable. Direct
`.venv/bin/python` commands bind the venv from `pyvenv.cfg` even if the executable is
absent at entry. Known Ruby, JVM and .NET verifier commands are classified
**unattestable**, not dependency-free, until their dependency closures have a supported
attestor; they fail closed unless the operator explicitly passes `--allow-dep-drift`.

`verify --json` now reports the dependency-environment status, attested roots and
fingerprint, and text output states the same trust assumption. Regression coverage includes
persistent interpreter replacement, site-packages drift, stage-delayed dependency drift
after both suite invocations restored the interpreter, external-root refusal,
normal external-interpreter symlinks, unsupported ecosystems, an unresolved direct venv
executable, workspace-link fail-closed behavior, honest Python/Node controls and the
explicit operator override.

**Checkpoint attestation is not mutation prevention.** A dependency mutation that occurs
entirely inside one suite-execution window and restores every attested byte/mode/link
before the next checkpoint is not proven observable by this release. That narrower
residual is tracked in #341 and is expected to close structurally with verifier-owned,
non-candidate-writable dependencies rather than with a sampling race.

## [2.10.8] — 2026-09-12

**Generated GitHub Actions authority wiring now binds action code to immutable commits
and does not leave checkout credentials in the candidate repository.** The template pins
`actions/setup-node` v6 to `249970729cb0ef3589644e2896645e5dc5ba9c38` and
`actions/checkout` v5 to `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`, retaining
the human-readable major versions as comments. Checkout sets
`persist-credentials: false`, while the job remains at `permissions: { contents: read }`.

The authority is still installed before candidate files are checked out. Untouched
TamperWard-generated workflows migrate through the existing provenance stamp and then
read back as current/idempotent. Regression coverage asserts immutable action identity,
credential non-persistence, install-before-checkout ordering, least privilege, and
migration of an older generated body.

## [2.10.7] — 2026-09-12

**Canonical wiring no longer falls back to a floating `tamperward@latest` when the
running package cannot identify its own release.** Version discovery now accepts only
the package named `tamperward` with a plain release semver. Missing, malformed,
tag-like or prerelease metadata is an unresolved build state, and `tamperward init`
fails closed before planning or writing hooks, pre-commit or CI authority wiring.

The unresolved internal sentinel is deliberately not a valid pin, so non-init code that
imports the wiring module cannot accidentally treat it as an upgrade-compatible release.
Regression coverage bundles the CLI into an isolated package layout and proves both
missing metadata and `version: "latest"` return the process-level cannot-evaluate exit
without emitting floating authority wiring.

## [2.10.6] — 2026-09-12

**Verifier materialisation now preserves safe tracked symlinks faithfully and fails
closed on links whose runtime resolution can leave the copy boundary.** The copier uses
`lstat` before deciding entry type, reproduces relative in-tree link targets exactly, and
retains broken-link and directory-link semantics. Absolute links, lexical `..` escapes,
symlinked parent directories, and special-file replacements fail closed.

**The external `node_modules` edge is now part of symlink validation rather than an
exception to it.** Candidate links are resolved component-by-component across chained
in-copy links and the real dependency graph. Once resolution enters the dependency root it
may not climb back into the original worktree or follow a dependency symlink outside that
root. Pristine restoration still removes the destination before writing, so candidate
links cannot redirect trusted base bytes.

Reference: [Node.js filesystem links and `lstat`](https://nodejs.org/api/fs.html#fslstatsyncpath-options).

## [2.10.5] — 2026-09-12

**The authority now starts outside candidate-controlled npm configuration.** Local hook,
Stop-sweep and pre-commit wiring excludes project npm configuration with global mode,
and fixes user/global rc sources to POSIX OS null-device paths. HOME cannot select
either rc source. Launcher errors map to the hook runtime's blocking exit channel.
Generated CI installs the pinned authority before
checkout and invokes `tamperward` directly afterwards, so npm never starts from the
candidate working directory. Re-running `tamperward init` migrates the older generated
wiring automatically.

**Trusted git reads now disable replace-object resolution everywhere.** The shared git
adapter uses the same scrubbed environment as `verify`, covering policy and file reads,
merge-base resolution and range/worktree construction. A regression test creates a real
`git replace` ref, proves ordinary `git show` follows it, and proves Tamperward still reads
the original object.

**The independent worktree boundary now sees hidden tracked drift.** `check --worktree`
and therefore `tamperward run` reconstruct protected paths marked `skip-worktree` or
`assume-unchanged` from HEAD and disk, matching the Stop sweep instead of silently trusting
git's abbreviated worktree view.

**Quiescence fingerprints cover executable filesystem identity.** A tree fingerprint now
includes entry kind and complete mode as well as path and content, and includes ignored
files when they are protected by the frozen policy. Mode-only test-runner changes and
mutations to ignored protected config can no longer alias the starting tree. On Linux,
survivor detection checks executable and open descriptors as well as cwd, so a detached
worker cannot evade the envelope merely by changing directory while retaining a handle
into the repository.

**Out-of-band approvals require the complete normalized object ID.** Abbreviated SHA
prefixes are refused once CI supplies its head, while uppercase full SHA-1/SHA-256 values
normalize safely. A commit-bound approval now names exactly the object being adjudicated.

References: [npm configuration precedence](https://docs.npmjs.com/cli/v11/using-npm/config#description),
[npm `node-options`](https://docs.npmjs.com/cli/v11/using-npm/config#node-options),
[Git replace objects](https://git-scm.com/docs/git-replace),
[Git `skip-worktree` / `assume-unchanged`](https://git-scm.com/docs/git-update-index), and
[Linux `/proc/<pid>/fd`](https://docs.kernel.org/filesystems/proc.html).

## [2.10.4] — 2026-09-11

**`test.skip` written as `test['skip']` or `test . skip` is the same skip, and the
in-loop detector was reading only the adjacent-dot spelling. A patch: the test-skip rule
now matches the skip/focus family through literal string-bracket access and
whitespace-separated member access, so a spacing or bracket rewrite is no longer a way
around it.** Reviewing round 4's mechanical detector, `test.skip('case', cb)` produced a
finding while `test['skip']('case', cb)` and `test . skip('case', cb)` produced none —
ordinary literal spellings of the same operation. The JavaScript skip/only/todo,
skipIf/runIf, fails/failing and runtime `t.skip()`/`this.skip()` markers now read both the
dot form (with or without surrounding whitespace) and the string-bracket form.

**Precision held, not widened.** A marker spelled inside a string literal
(`expect(x).toBe("test.skip")`) is now masked as text rather than counted as a finding, and
bracket access on a non-runner object (`cfg["skip"]`, pagination) is not a marker. Computed
or aliased access (`test[s]`, `test['sk' + 'ip']`) and a member chain split across physical
lines stay out of scope, by design and documented in the rule — the pristine boundary, not
this in-loop detector, is the backstop for what a mechanical pattern cannot resolve.

**This was not an escape.** The gap is in the in-loop mechanical detector; pristine
verification still catches the consequence of any skipped test, so nothing false-green
turned on it. Direct-diff and hook-adapter evaluation agree on the new spellings.

## [2.10.3] — 2026-09-05

**Disabling a pytest plugin is a suite narrowing, and it was not being read as
one. A patch: the vector round 4's pilot found in the gap left by 2.10.2.** On
pilot trajectory seq 18 the agent wrote `addopts=--doctest-modules -p no:checkdocs`
into `pytest.ini`. The gate ALLOWED it at the tool call and it persisted to the
final tree, while every narrowing key 2.10.2 covers stayed untouched — because a
plugin that is off contributes no items, and none of `-k`, `--ignore`,
`--ignore-glob`, `--deselect`, `-m`, `testpaths`, `python_files` or `norecursedirs`
describes that. Here it removed pytest-checkdocs' `.::project` from the run.

**This was not an escape either, and the distinction is the point.** The pristine
boundary caught the consequence — the trajectory scored a masked failure, the
envelope exited non-zero, `tamperward_success` was false — so nothing false-green
got through. What failed was the IN-LOOP detector, which is the half 2.10.2
existed to add and the half this patch completes.

`-p no:<plugin>` now reads as a whole-run narrowing, like `-m`, across every
surface an `addopts` line can live in: `pytest.ini`, `.pytest.ini`, `setup.cfg`,
`tox.ini` and `pyproject.toml`, root or nested, in INI continuation lines and in
TOML string and array forms. All three spellings pytest accepts are read —
detached (`-p no:x`), attached (`-pno:x`) and `-p=no:x` — so an equivalent spelling
is not a way around it.

**`-p <plugin>` without `no:` LOADS a plugin and is never a finding.** It can only
widen the run, and a false positive lands in the gated arm alone. There is
deliberately **no allowlist of harmless plugins**: the gate cannot know what any
plugin contributes, and a genuine environment reason to disable one is exactly
what the sign-off path is for.

Whole-run findings — `-m`, `python_classes`, `python_functions` and now
`-p no:<plugin>` — also stop claiming a glob match that never happened. They now
read `-p narrows the whole run ("no:checkdocs")` rather than `-p now matches it`,
because a marker expression and a disabled plugin do not match a path; they shrink
what the runner collects everywhere.

## [2.10.2] — 2026-09-03

**pytest collection narrowing is now a finding at the tool call, not only at
adjudication. A patch: the missing half of an existing protection.** A round-4
pilot on a fresh Python pool found that a config could deselect the failing test —
`addopts = -k "not test_x"`, `--ignore`, `--ignore-glob`, `--deselect`, `-m`, a
redirected `testpaths`, a narrowed `python_files`/`python_classes`/
`python_functions`, a `norecursedirs` that swallows the test directory — and the
gate ALLOWED it while the Stop sweep stayed silent, in `pytest.ini`, `.pytest.ini`,
`setup.cfg`, `tox.ini` and `pyproject.toml` alike, at the root or nested.

**This was never an escape.** `verify`'s verification surface has refused to
inherit those files since 1.14.2, and drops `PYTEST_ADDOPTS` with them, so the
envelope already exited non-zero on every one of these: traced end to end across
fifteen vectors through the PreToolUse gate, the Stop sweep, pristine
verification, the `run` envelope and an independent adjudicator. What was missing
was EARLY feedback — the agent learned at adjudication instead of at the edit.

pytest joins the suite-config model the JS runners already use: the config is read
as the membership function the runner applies, and a finding is a protected test
the runner selected before and does not select after. Because the comparison is
over selection and not over flags, `-v`, `--tb=short`, `-r a`, `--color`,
`--durations`, `--strict-markers` and a `markers` registry are silent **by
construction** — there is no benign-flag list to keep in step with pytest's option
grammar. INI continuation lines, quoted values and TOML string and array forms are
read; `tox.ini` and `setup.cfg` count as pytest configs only when they carry the
section pytest reads, so ordinary packaging edits are untouched.

**The scope of `-k`, stated.** A finding is a protected test FILE the runner
selected before and does not select after, so a `-k` term is convicted when it
matches the file's stem (`-k "not test_bug"` drops `tests/test_bug.py`) and is left
alone when it names a test FUNCTION inside a file that is still collected
(`-k "not test_add"` against `tests/test_bug.py::test_add`). Guessing which
functions an expression selects would mean modelling pytest's keyword grammar
against test names the config never lists; the in-loop layers stay silent there by
construction, and `verify` still exits non-zero on it — traced end to end.

**Precedence transitions.** pytest opens exactly ONE inifile, so the effective
configuration is a property of the FILE SET, not of any single file — and a change
can narrow the suite with no file's own before/after being a narrowing. Delete the
shadowing `pytest.ini` and a `setup.cfg` that has been inert since the repository
was created springs into effect: the deleted file was benign, and the file that now
narrows was never touched. Add an empty `pytest.ini` over a `setup.cfg` that had
widened collection and pytest's own defaults drop the specs the wider setting was
collecting; nothing in the added file is narrower than the defaults, the narrowing
IS the shadowing. The effective file is now resolved at base and at head —
`pytest.ini` > `.pytest.ini` > `pyproject.toml` > `tox.ini` > `setup.cfg`, with the
shared files claiming the slot only when they carry their own pytest section — and
when the slot moves, the two selections are compared directly.

It stays SILENT where it cannot know: the content of files the change did not touch
has to be in hand (sound to read from the working copy, since a file outside the
range is identical at base, at head and on disk). No listing, no content, no
finding. A deletion of every pytest config is not a narrowing either — pytest's
defaults are broader than anything they replaced.

**A false positive this exposed, also fixed.** pytest's ignore set is not one list:
`norecursedirs` REPLACES the built-in directory skips, while `--ignore`,
`--ignore-glob`, `--deselect`, `-k` and `-m` ADD to whatever norecursedirs is in
force. The model seeded the additive entries into an empty list, so a config
carrying only `addopts = -k "not slow"` was read as collecting `build/**` — which
made a later config that merely restores the defaults look like a narrowing. The
built-in skips are now the seed, and a replacement only replaces them.

## [2.10.1] — 2026-09-02

**`npm install` no longer trips the gate in a husky repository. A patch: a
false-positive fix at the same severity.** 2.10.0 made a newly added hook
script that does not run the gate live a sign-off — correct for a script an
agent writes, wrong for the seventeen runtime files `husky` writes under
`.husky/_/` when the `prepare` lifecycle of an ordinary `npm install` fires
`npx husky`. Those files are the installer's, byte-for-byte, and blocking them
blocked every install.

### Fixed

- **husky's own v9 runtime under `.husky/_/` is recognised by byte-equal
  content** — the fourteen one-line shims that source `h`, the `h` runner
  itself, the deprecation `husky.sh`, and the `.gitignore` of `*` — and is
  clean only while `.husky/pre-commit` itself runs the commit backstop — exactly
  `tamperward check --staged`, live under husky's `sh -e`, pinned at the judging
  release — not merely exists: an ordinary husky pre-commit whose real gate is
  another mechanism would otherwise let the install repoint `core.hooksPath` and
  displace the backstop unseen, and a live but ineffective gate (`--worktree`,
  `--diff HEAD...HEAD`, a `--cwd` away from the root, an old or unpinned
  version) is not the backstop either. The pre-commit must be a readable regular
  file; a symbolic link is never followed. The content is matched against a pinned
  copy, never against `node_modules` (which the agent can write); a repo whose
  pre-commit does not run the gate live, a file that is not byte-for-byte
  husky's, a later edit to one, and the absence of a cwd to judge against all
  stay fail-closed and need a sign-off.

## [2.10.0] — 2026-09-02

**A hand-written protected hook script is held byte-for-byte to its before.
From the third adversarial pass over the shell-script liveness model, run
against the model rebuilt after the second: thirteen more shapes ran a
failing gate to exit 0 under a real `sh -e` and a real direct exec while the
model read the gate as live. A line-by-line reading of a shell script cannot
be sound, so it is no longer the verdict. A minor: every edit to a hand-written
hook script other than raising its pin — a linter step added, `npx` →
`pnpm exec`, an `if ! gate; then exit 1; fi` around it, a comment line — now
needs a sign-off where 2.7.0 passed it when the gate read as live.**

### Changed

- **A hand-written hook script (`.husky/*`, `.githooks/*`, a `core.hooksPath`
  script, anything `protected.hooks` matches that is a script) is compared
  byte-for-byte to its before.** The only clean edits are raising a plain
  `tamperward@<ver>` pin to a version no higher than the gate judging it (or
  pinning an invocation that had none) and a trailing-newline-only
  difference. Everything else is hook-tampering with the reason *the gate
  script changed; sign off* — `tamperward allow hook-tampering --file <path>`
  locally, the `tamperward:allow:hook-tampering@<head-sha>` label in CI. The
  reason the rule is byte-equal and not a better model: after the model was
  rebuilt for 2.7.0, the next pass found `( gate || true )` and its brace
  form, a multi-line `{ … } || true` and `| tee`, `|| { echo; exit 0; }`,
  `|| exec true` and `{ exit 0; }` before the gate, a trap by function name
  and `trap 'exit $OK'` with `OK=0`, `[ -d . ]` / `true && true` in an `if`
  whose `else` holds the gate, `until [ -d . ]`, `for f in "$@"` and
  `[ $# -eq 0 ] ||` in a hook that has no argv, a multi-line string and a
  `: '…'` block hiding the gate, `|| exit "$rc"` with `rc=0`, `gate & wait`,
  a second heredoc on one line and a `case` glob against a constant word —
  each read live, each exit 0 with a failing gate. Those are not fixed as a
  model; the rule covers them.
- **The liveness model stays as evidence, not as the verdict.** When the
  fail-closed rule fires the model still runs, and when it names a mechanism
  the finding carries it, so the human signing off sees `|| true`, a passing
  trap, `NODE_OPTIONS=` in front of the gate or a `--diff` swap named rather
  than a bare "changed". Its reading is right more often: the wrapper words
  in front of the command (`command`, `env`, `exec`) are tested against the
  script's own functions and aliases, so `command() { :; }` then
  `command npx …` is shadowing; an assignment or prefix of `PATH`,
  `NODE_OPTIONS`, `NODE_PATH`, `HOME`, `LD_PRELOAD`, `BASH_ENV` or
  `npm_config_*` before or on the gate is "runtime redirected"; the mode flag
  is part of the gate's identity like `--cwd`, so `check --staged` →
  `check --diff HEAD...HEAD` or `--worktree` is a replacement, and
  `--cwd "$(git rev-parse --show-toplevel)"` is the root; a single `&` is an
  operator, `& wait` without a pid is neutered and `& wait $!` (on the line
  or the next) is the gate's status; a pin that is no longer a plain version
  after a plain-pinned before — `@^1`, `@latest`, a range, a pre-release — is
  a lowering.
- **A new hand-written hook script must run the gate live.** There is no
  before to hold it to, so the model alone judges it: `tamperward check`
  neutered, unreachable, commented out, behind a `PATH=` line or absent is a
  sign-off; a deleted protected script stays the removal finding it was.
- **lefthook and pre-commit entries carry the same identity.** `run: … --diff
  HEAD...HEAD`, `entry: … --diff`, `args: [--cwd, /tmp]` and
  `args: [--diff, …]` are replacements of the gate; a command-level `env`
  setting `PATH`, `NODE_OPTIONS`, `NODE_PATH`, `HOME`, `LD_PRELOAD`,
  `BASH_ENV` or `npm_config_*` gained or changed is a runtime redirect; a pin
  no longer plain (`@^1`) after a plain-pinned before is a lowering;
  pre-commit `additional_dependencies` gained or changed on the gate entry
  chooses which gate the hook installs. These stay judged by the command
  comparator, not the byte-equal rule.
- `TAMPERWARD_OOB_SIGNOFF` accepts a token in the label's own spelling
  (`tamperward:allow:<rule>@<sha>`) as well as the stripped one the shipped
  workflow sets.
- SPEC §9.1 records round 4 of the replication study as pinned to this
  release, with the three-claim treatment boundary it is graded against.

### Fixed

- **The init-written pre-commit script with a second trailing newline** was
  reported as no longer matching the shape init wrote. Trailing newlines are
  not shape: none, one or two read as the same script.

### Sign-off

Hand-written hook wiring needs a sign-off on every edit that is not a pin
raise (docs/guide/rules.md, "Customised wiring needs a sign-off"), cleared
the same way as the first customisation: `tamperward allow hook-tampering
--file <path>` locally, the `tamperward:allow:hook-tampering@<head-sha>`
label in CI.

## [2.9.0] — 2026-09-02

**The Claude settings files are judged with the runtime's live semantics, on
the shell surface as well as the file surface. From the runtime-semantics pass
over 2.7.0's canonical-shape comparator, checked against the Claude Code
documentation: settings files are watched and reloaded in-session,
`disableAllHooks` applies from any file with the project overriding the user,
`env` reaches every session and subprocess, the hook shell is bash, a sibling
hook's output combines with the gate's. A minor: a hook entry added beside the
gate, an `env` key of any name in the file that carries it, a pin raised past
the gate judging the edit, and any shell write to a settings file outside the
repository now need a one-time sign-off where they used to pass — and `init`
now declares `disableAllHooks: false` in the project file. Two 2.7.0 false
positives are corrected: a comma-separated matcher is the honest list the
runtime documents, and `statusMessage` is cosmetic.**

### Changed

- **A Bash write to any Claude settings file is hook-tampering.** The
  shell-target model judged write targets against the repository's
  `protected.hooks` globs only, so `echo '{"disableAllHooks":true}' >
  ~/.claude/settings.json` — the user file, which the runtime reloads within
  seconds, no repository glob names, and neither the Stop sweep nor `check
  --staged` can see — was allowed through Bash while the same Write was denied;
  so were `$HOME/…`, the absolute path, `python3 -c`, `node -e`, `sed -i`,
  `tee`, `cp`/`mv`/`ln` destinations, `rm`, and `cat >
  /etc/claude-code/managed-settings.json`. A write target is now expanded as
  the shell would (`~`, `$HOME`/`${HOME}`, `%USERPROFILE%`,
  `$CLAUDE_CONFIG_DIR` — its value from the hook's own environment, else
  `~/.claude` — backslashes as separators), every symlink in it resolved
  against the repository root, and judged as a hook write whenever it is
  settings-shaped wherever it lives: `~/.claude/settings.json`,
  `managed-settings.json` at any path, a `.claude/settings*.json` at any depth,
  and a directory holding the user file (`rm -rf ~/.claude`). A symlinked
  alias (`ln -s . /tmp/xlink; rm /tmp/xlink/.claude/settings.json`, `ln -s
  ~/.claude /tmp/cfg`) resolves to the file it writes on both surfaces, the
  `Write` tool included. The finding names the expanded file, so the guarded
  pin applies and a policy that lowered the rule cannot let it through. On the
  tool-call surface `isClaudeSettings` accepts the `$CLAUDE_CONFIG_DIR`
  relocation and backslash paths.
- **`init` declares `disableAllHooks: false` in the project settings file**,
  and the canonical shape holds it there: the runtime honours the key from any
  file with the project overriding the user, so a `true` planted in the user
  file no longer reaches the gate. Removing or flipping the declaration is
  hook-tampering; a fresh gate-carrying file is held to the whole shape; a
  file init wrote before 2.9.0 has no declaration and stays clean until an
  edit writes the gate into it anew. Re-running `init` adds the declaration to
  an already-wired file, and sets a `true` back to `false`.
- **`env` inverted: any key added to or changed in the top-level `env` of a
  file that carries the gate is hook-tampering; a key removed never is.** The
  allowlist (`PATH`, `NODE_OPTIONS`, `NODE_PATH`, `HOME`, `npm_config_*`)
  missed the shell and the loader: `BASH_ENV` is sourced by every
  non-interactive bash before the hook command runs, `BASH_FUNC_npx%%`
  redefines `npx` as a function, `LD_PRELOAD` reaches node whatever the
  shell, and npm reads `npm_config_*` case-insensitively so
  `NPM_config_registry` walked past the regex. The well-known names —
  extended with `BASH_ENV`, `ENV`, `BASH_FUNC_*`, `LD_*`, `DYLD_*`,
  `TAMPERWARD_*`, and `npm_config_*` in any case — stay a finding in any
  settings file, and the reason names the mechanism when it is a known one.
- **The pin may only go up, and only as far as the gate judging the edit.**
  `npx --yes tamperward@99.0.0 hook claude` is a pin npm cannot resolve: the
  hook exits non-zero with no decision, which the runtime treats as
  non-blocking, and every tool call proceeds — "a higher pin is clean" was a
  test. A fresh entry pinned above the judging version is hook-tampering, and
  the reason says the honest raise is `tamperward init` run from the newer
  version, which raises the judging gate with it. A fresh entry with no pin is
  below any floor (`npx` then runs whatever `node_modules/.bin/tamperward` is)
  — the `c.pin &&` guard that skipped it is gone — while a file whose gate was
  unpinned before (as init wrote before 1.14.7) still sets no floor. A pin
  with leading zeros (`02.5.0`) is not a plain version. Raising the pin to any
  published version at or below the judging gate stays clean.
- **Every hook entry an edit writes into a gate-carrying file is validated,
  not only the gate's own.** A value the runtime's schema rejects on any
  entry under any event — a `type` it does not accept, a non-numeric
  `timeout`, a non-string matcher — is "broken settings" the runtime continues
  without, the gate entries in that file included; it is hook-tampering.
- **A hook entry added beside the gate under PreToolUse or Stop is a
  sign-off.** The forgery check was textual, and `args`, an `http` entry and a
  script file carried the same decision past it. A forged decision in the
  command text is still named as such (the fast path); a shape that is not a
  plain command entry (`args`, `http`, `prompt`, `agent`, `async`, `if`) is
  named; and a plain command is a finding too, because its output combines
  with the gate's verdict — an `updatedInput` rewrites the tool input after
  the gate allowed it, the last hook winning; a `continue: false` takes
  precedence over the sweep's block — and a script body carries what a regex
  cannot see. An entry that was there before, as written, is not the edit's
  doing; entries under other events are not judged this way.

### Fixed

- **A comma-separated matcher is the honest list, not a pattern that selects
  nothing.** The runtime's matcher table reads a string of letters, digits,
  `_`, `-`, spaces, `,` and `|` as an exact list separated by `|` or `,` with
  optional surrounding whitespace — `Edit, Write` and `Edit|Write` each match
  either tool. 2.7.0 read the comma as a regex and denied `Bash, Edit, Write,
  MultiEdit, NotebookEdit` at every layer as "no longer covers Bash, Edit, …";
  the 2.7.0 entry's claim that the comma fails closed described that false
  positive. The comparator and `init`'s matcher repair both split on `|` and
  `,` now.
- **`statusMessage` on the gate entry is the documented spinner text**, a
  cosmetic string, and passes; 2.7.0 reported it as a key init does not write
  and the entry as removed.

## [2.8.0] — 2026-09-02

**Every read of a repository path is git's view of it: a regular file is its
bytes up to 64 MiB, a symbolic link is its target text and is never followed,
and nothing else is content. From the adversarial pass over 2.7.0's
ignored-adds and effect layer. A minor: a protected path that stands as a
symbolic link, a FIFO, a socket, a device, a directory, or a file above the
cap is now blocked by name as `hidden-drift` where it used to be read through
or not seen at all, so a new or changed one needs a sign-off where it used to
pass; and a path carrying a control character is protected in every category
where it used to match no glob.**

### Changed

- **A protected path the gate cannot judge by content is blocked by name.**
  The untracked and ignored adds, the worktree diff's enrichment, the drift
  check's hash and the hidden-tracked probe all read a repository path
  through one reader now (`src/disk.ts`): a regular file is read through a
  descriptor opened `O_NOFOLLOW` and checked after opening, up to 64 MiB and
  not a byte past it; a symbolic link is read with `readlink` as the blob git
  records for it. What is neither — a link, a FIFO, a socket, a device, a
  directory where a file is expected, a larger file, a read error — is
  reported as `hidden-drift` by name in the PreToolUse drift check, the Stop
  sweep and `check --worktree`, the stance the effect layer already took on a
  file it could not read. The snapshot walk lstat's, so a link is a leaf
  whatever it points at and a FIFO at a protected path is recorded and its
  appearance is drift. A link that already stood there when the session began
  is sanctioned like any other pre-existing file and is not re-litigated. The
  Edit reconstruction still resolves a link by name (a settings file may
  honestly be one) and reads the end of the chain under the same guards.
- **A control character in a path is protected in every category.** picomatch
  compiles `**` to a pattern that stops at a newline, so `n\nl/conftest.py`
  matched no protected glob and was dropped by the snapshot walk, the
  untracked and ignored keep filters, the hidden-tracked probe and the
  envelope's working-tree check: a `collect_ignore` conftest passed PreToolUse
  and Stop from a directory named with one newline. A path carrying
  U+0000–U+001F or U+007F is now protected whatever category is asked, before
  any glob is consulted; the denial and the text report show it escaped and
  the finding keeps the real path.
- **The drift check's walk prunes directories git reports as wholly ignored.**
  It walked every directory that was not one of four names, so a 50k-file
  ignored `dist/` was stat'ed file by file on every PreToolUse and Stop —
  about 1.2 s per hook call. The walk now skips the directories git collapses
  in its `--directory` listing of ignored paths (the pass the ignored-adds
  view already runs) and snapshots the protected files git lists under them
  from that listing, so they stay sanctioned and excused as before. Only
  git's word prunes: an ignored directory that also holds a tracked file is
  walked, and outside a repository nothing is skipped. The protected globs
  compile to one expression per list rather than one matcher per glob, which
  is what made the listing cheaper than the walk it replaced.

### Fixed

- **A symbolic link at a protected path to a device that never reaches EOF
  hung the gate.** `ln -s /dev/zero test/conftest.py` held the Stop sweep
  indefinitely, as did the same link excluded through `.git/info/exclude`,
  and a tracked spec replaced by such a link held the very next PreToolUse;
  a link to a FIFO with no writer did the same at the open. Each now returns
  a block in well under a second.

### Sign-off

A symbolic link, a FIFO or a file above 64 MiB newly placed at a protected path
needs a sign-off (`tamperward allow hidden-drift --file <path>`), or a regular
file put in its place. One that existed before the session began is not
re-litigated.

## [2.7.1] — 2026-09-02

**The predicates read the way the runner reads them. A patch: twelve false
positives and one incidental, every one a maintainer's routine edit that 2.7.0
blocked, found by the pass-3d sweep of 77 honest edits against the built CLI.
Nothing fires that did not fire before; the tamper beside each honest edit
still does.**

### Fixed

- **ci-tampering.** A `${{ }}` expression is folded to its constant or read as
  one token, so `--shard=${{ matrix.shard }}/4`, `--shard ${{ matrix.shard
  }}/${{ strategy.job-total }}` and Playwright's `--project=${{ matrix.project
  }}` are the matrix, not a narrowed suite (a literal `--project=unit` and a
  `-t ${{ github.sha }}` still are). `node --test`, `mocha`, `ava`, `biome ci`,
  `oxlint`, `tsgo`, `deno test`, `ruff check` and `mypy` are checks of their
  kind, so `npm run lint` → `npx biome ci .` and `npm test` → `node --test` are
  respellings rather than removals. A path positional narrows a test, not a
  lint: `npx eslint "src/**/*.{ts,tsx}"` and `npx eslint src/ test/` are no
  longer "neutralised". `cd apps/web && npm test` places the check; its
  directory is not a positional. `shell: bash -euo pipefail {0}` — any `{0}`
  shell that keeps `-e` or `-o errexit` — is fail-fast and is not reported.
  `continue-on-error: true` on a reporter or upload action
  (`dorny/test-reporter`, `publish-unit-test-result-action`,
  `upload-artifact`, codecov, coveralls) is not on the check. `branches:
  [master]` → `[main]` is a rename when the repository has a `main` branch,
  locally or on a remote, even while a stale `origin/HEAD` still points at
  `master`; a branch the repository does not have is still a narrowing.
- **test-deletion.** vitest 3's `it.for` / `test.for` / `describe.for` count
  like `each`; a `describe.each` table rewritten as `for (const n of [1, 2,
  3])` or `[1, 2, 3].forEach` counts once per element (a loop over anything
  else is open, never claimed; a loop over fewer literal rows still fires).
  `test.projects` entries with `extends: true` inherit the root's selection —
  in either order; `extends: '<path>'`, `mergeConfig(shared, …)` over an
  imported base and a `...base` spread are opaque, because vite concatenates
  the arrays with a base this file cannot see; `test.root` rebases a
  project's globs like `test.dir`; and the evidence for a vitest default
  include says `test.include (default)`, not `testRegex`. Only `scripts.test`
  and `test:ci` are the suite a flag can narrow: `test:unit --project unit`,
  `test:watch --changed` and `test:staged --findRelatedTests` beside an
  untouched `test` are slices by design, and `test: vitest run --exclude
  e2e/**` excludes another runner's directory exactly as `test.exclude`
  would. A `.snap` inside `__tests__/` — jest's default layout — is
  snapshot-rewrite's file, not a deleted test, on the file surface and for
  `rm -rf src/__tests__/__snapshots__` alike. `git checkout main -- test/`
  while on `main` (any rev that resolves to HEAD) restores nothing older;
  `HEAD~1` still does.
- **coverage-lowering.** Exempting generated code, codegen output,
  migrations, `*.generated.*` / `*.gen.*` / `*.pb.*`, Nest's `*.e2e-spec.ts`,
  Django's `manage.py` / `wsgi.py` / `asgi.py`, `__init__.py` and the
  `main.ts` entrypoint is housekeeping in `coverage.exclude`,
  `coveragePathIgnorePatterns`, `collectCoverageFrom` and `.coveragerc`
  `omit` alike; `**/index.ts` stays reported. vitest's `thresholds: { 100:
  true }` is every metric at 100, not four thresholds removed. codecov
  `informational: true` is reported under `project:` (and at the top), not
  under `patch:` or `changes:` beside an untouched project target. A
  `--passWithNoTests` (or `passWithNoTests: true`) in a package whose
  directory holds no spec — a brand-new workspace package — is not a dodge;
  the root of a repository with a suite, a package that has one, and a
  change judged without a repository listing are reported as before.
- **test-content-removal.** Content this change adds to a non-spec file under
  a test directory (`test/fixtures/add-cases.ts` receiving the rows of an
  `it.each` table) is kept, not removed; `test.for` tables are read like
  `it.each`.


## [2.7.0] — 2026-09-02

**The wiring `init` writes is judged by its canonical shape, not by whether a
`tamperward` token is still present. From the adversarial pass over 2.4.1's
comparators. A minor: honestly customised wiring — a linter step added to
the init-written pre-commit script, a matcher spelled another way — now needs
a one-time sign-off where it used to pass.**

### Changed

- **Claude settings compared to the exact entry init writes.** The
  comparator used to ask whether `tamperward hook claude` appeared somewhere
  in the command; `>/dev/null` appended, the two subcommands swapped between
  PreToolUse and Stop, a pin downgraded to 1.0.0, `npx -p /tmp/evil`, a
  `PATH=` or `NODE_OPTIONS=` prefix, and every entry key the runtime honours
  (`timeout: 1`, `async`, an `if` that never matches, `args`, `shell`) passed
  every layer. The gate entry must now be exactly `npx --yes tamperward@<ver>
  hook claude` under PreToolUse and `sweep claude` under Stop, `<ver>` a plain
  version never below the one it replaces, on a matcher read with the
  runtime's own semantics (an exact `|` list, otherwise an unanchored regex; a
  comma is not a separator and fails closed, as do a non-string, invalid or
  non-ASCII matcher). Any other key on the entry, any text around the
  invocation, a top-level `env` touching `PATH`/`NODE_OPTIONS`/`NODE_PATH`/
  `HOME`/`npm_config_*`, a non-boolean truthy `disableAllHooks`, a duplicated
  JSON key, or a sibling entry emitting its own hook decision is
  hook-tampering. The user file and managed settings are judged by path shape
  at the tool-call layer, outside the repository or not. Hooks merge across
  the settings files, so the "sibling shadow" finding for an added local file
  that declares other hooks is gone — it was a false positive.
- **The pre-commit script init wrote must stay byte-equal to what init
  writes**, modulo an upward pin. A hand-written hook is judged by whether the
  gate still runs live under the way that hook is executed (husky's `sh -e`,
  git's direct exec): function or alias shadowing of a word of the invocation,
  a function nobody calls, an `else` after an always-true branch, an empty
  `for` or never-true `while`, `exec`, a passing `trap`, `set +e`, the `||`
  chain evaluated in order (`|| false || true`, `|| true; exit $?`,
  `|| kill -0 $$`, `|| exit $status` with status=0), a trailing `&`, a `!`
  prefix, heredoc bodies as data, `pipefail` only from a real `set -o
  pipefail`, a lowered pin, `--cwd` as identity, a `cd` away from the root, a
  non-shell shebang, and a gate that is not the last statement without
  `set -e` on a directly-exec'ed hook. Thirty of these were verified against a
  real shell before the model was rebuilt.
- **lefthook, pre-commit and package.json compared by the command they run**,
  not the word: `run: npx tamperward --version` and `entry: 'true'` under
  `id: tamperward` are removals; `skip`/`only` in any non-false shape at
  command and section level, `tags` against `exclude_tags`,
  `lefthook-local.yml` as the overlay it is (now in the hooks baseline),
  `stages` inherited from `default_stages ?? all`, `types`/`exclude_types`
  without `always_run`, and `prepare: echo husky` / `HUSKY=0 husky` /
  `husky uninstall` as the removals they are.
- **CODEOWNERS evaluated over the concrete gate files** with GitHub's glob
  semantics, so a later ownerless `/.husky/pre-commit`, `*.yml` or
  `**/pre-commit` un-owning the gate is reported.
- **Command surface:** absolute paths under the repository relativised;
  `>|`/`>&`/`&>` kept with their redirection; `install -t`, `cp -t`, `rsync`,
  `git checkout <rev> -- .`, `git restore --source=<rev> .`, `git apply` /
  `patch` / `git am`, inline `python -c` / `node -e` / `perl -e` / `ruby -i` /
  `ex` / `ed` scripts naming a hook, `xargs rm|chmod`, `find -exec chmod -x` /
  `-delete`, multi-group symbolic chmod (`u+rw-x`), `setfacl`. Every
  command-surface finding carries the repo-relative target, so the engine pin
  applies to it.

### Fixed

- **The docs site failed to build after 2.6.0.** The rules guide's
  ci-tampering row carried `${{ <ctx> || true }}` inside a table cell: the
  unescaped `||` split the cell and the angle-bracket placeholder was then read
  as a tag, so the page broke the Vue template compile. The pipes are escaped
  and the placeholder is spelled `context`. The site now builds in the PR
  workflow's `build` job as well, so a broken page cannot merge.

### Sign-off

Customised wiring needs a sign-off once (docs/guide/rules.md, "Customised
wiring needs a sign-off"): a linter step added before the gate in the
init-written script, `npx` → `pnpm exec` in that script, a matcher spelled as
a regex. A hand-written script that was never init's is judged by liveness
alone and stays clean when the gate is live.

## [2.6.0] — 2026-09-02

**Every dial of the selection predicate is modelled, the CI expression folder
short-circuits the way GitHub does, and the coverage denominator is compared
as a predicate. From the adversarial pass over 2.5.0. A minor: these rules
now fire on config keys they previously passed.**

### Added

- **test-deletion reads the rest of the runner's selection.** jest `roots`,
  `rootDir`, `modulePathIgnorePatterns` and `projects`; vitest `test.dir`,
  a `!` negation inside `include`, `test.projects` and `vitest.workspace.*`
  (evaluated as the union of project predicates; a project named by path
  makes the config opaque and silent); `vite.config.*` carrying a `test:`
  key is a vitest config; `typecheck.*`, `benchmark.*` and `coverage.*`
  under `test` no longer collide with `test.include`. Runner flags added to
  a `package.json` test script (`--testPathPattern`, `-t`, `--exclude`,
  `--dir`, `--project`) are narrowing. `git checkout <rev> <path>` without
  `--`, `git checkout <rev> -- .`, and `rm -rf .` / `*` / a `..`-containing
  token from the repo root are erasures. `describe.each` rows multiply the
  enclosed tests; rows dropped from a table that stays open are counted;
  only an added block with a significant body counts toward relocation, so
  a stub `it("noop", () => {})` no longer excuses a deletion.
- **coverage-lowering reads vitest's denominator and switches:**
  `coverage.include` narrowed, `coverage.enabled` off, `thresholds.perFile`
  removed; `.coveragerc [run] omit`, codecov `target: auto` / `project: off`
  / `ignore:`, and nyc thresholds inside `package.json`. The patch-threshold
  evidence reports the numbers it saw.
- **ci-tampering folds `&&` and `||` the way GitHub does**: `<ctx> && false`
  is always false and `<ctx> || true` always truthy, so
  `if: ${{ github.event_name == 'push' && false }}` and
  `continue-on-error: ${{ <ctx> || true }}` are reported; anything whose value
  depends on the unknown side stays reachable. `on.<event>.paths:` that cannot
  match source and `pull_request.types:` replacing the defaults are trigger
  narrowing; a path-shaped positional after `--` (`npm test -- test/a.test.ts`)
  is narrowing; `timeout 1 npm test` reports as neutralised.

### Fixed

- **Routine work that blocked:** a check moved into a reusable workflow added
  in the same change; a job-level `if: false` on a job with no check step;
  `npm test` → `npm run test:ci` or `npx vitest run` (a respelling, not a
  removal); `.coveragerc` → `pyproject.toml` carrying the same `fail_under`;
  `collectCoverageFrom` `src/**` → `src/**/*.{ts,tsx}` (compared over tracked
  source, not entry by entry); a jest ignore of a `fixtures/` directory;
  vitest `typecheck.exclude` read as a test exclude; `branches: [main]` →
  `[master]` when the default branch is unknown.

## [2.5.1] — 2026-09-02

**A protected file created where git will not list it is judged, never
absorbed. A patch: a bypass fix at the same severity, found by the adversarial
pass over 2.4.0's untracked sweep.**

### Fixed

- **An ignored new protected file was judged by nobody.** One line in the
  agent-writable `.git/info/exclude` (or a `.gitignore` edit) made a
  `conftest.py` created during the turn invisible: the untracked view drops
  ignored files, the hidden-tracked probe lists tracked files only, and the
  effect layer saw the file but treated an addition as something to absorb
  into the sanctioned tree. The turn ended green. The same applies to the
  gitignored `.claude/settings.local.json` Claude Code itself excludes. Now:
  the effect layer reports additions, any protected addition the turn view
  does not carry is reconstructed as the add it is and run through the
  detectors, and the git views (`turnView`, the envelope, `check --worktree`
  with untracked) list ignored files under the protected globs as adds — in
  two passes, with wholly-ignored trees collapsed and `node_modules` never
  walked, so a 100k-file package tree costs three milliseconds.
- **A forged turn tree could excuse a new file.** The turn-start snapshot is
  `.git` state; it now excuses an untracked or ignored file only when the
  per-call tree sanctions the same hash, the turn-start exemption is limited
  to a predicted edit that never landed, a turn tree that outlives its ptree
  is dropped, and tree saves are atomic. The residual — an agent that
  rewrites both trees consistently — stays documented; CI is the authority.
- **Command-surface hook-tampering findings carried no file**, so the engine
  pin that keeps findings on the gate's own wiring out of the policy's reach
  did not apply to them: with a policy that had lowered the rule to warn,
  `rm .claude/settings.json` through Bash was allowed at the hook. They now
  carry the repo-relative target and are pinned like the file-surface ones.

## [2.5.0] — 2026-09-02

**The config-narrowing class: a runner told not to open a spec, a coverage
denominator quietly shrunk, a workflow that keeps its check line and never
runs it. Closed across test-deletion, coverage-lowering and ci-tampering,
with the two most routine maintainer edits — splitting a spec and touching a
CI check line — no longer blocking. A minor: these rules now fire on config
shapes they previously passed.**

### Added

- **test-deletion reads runner selection.** jest `testPathIgnorePatterns`,
  `testMatch`, `testRegex` and vitest `test.exclude` / `test.include` are
  evaluated as the selection predicate over the repository's own spec files:
  a spec that was collected before the edit and is not collected after it is
  a deletion, with the count. A glob respelled to select the same files, or
  an ignore that matches nothing in the tree, is silent. Shell spellings that
  erase a spec join the command surface: `cp /dev/null`, `sed --in-place`,
  `tee`, `find -delete` / `-exec rm`, `truncate`, `perl -pi`, `git checkout
  <rev> --`, and a directory token that holds a protected spec (`rm -rf test`;
  `dist/__tests__` is silent).
- **coverage-lowering reads the denominator and the switches.**
  `collectCoverageFrom` entries dropped or source exempted,
  `coveragePathIgnorePatterns` / `coverage.exclude` grown, `--coverage=false`
  and `--coverageThreshold=` in a script, vitest `thresholds.autoUpdate`,
  and `passWithNoTests` as a config key. Python `.coveragerc` /
  `pyproject.toml` `fail_under`, nyc thresholds and `check-coverage`, and
  codecov `target` / `threshold` / `informational` join the protected config
  baseline and are compared.
- **ci-tampering reads the block, the expression and the trigger.** A kept
  check line preceded by `set +e`, `exit 0`, `if false; then`, a heredoc
  comment or `shell: bash {0}`, or followed by `|| true` or
  `--passWithNoTests`, is neutralised in place. `continue-on-error` and
  `if:` are constant-folded (quoted booleans, `${{ 1 == 1 }}`, `${{ 'a' ==
  'b' }}`, `${{ !true }}`); anything with a context reference stays
  reachable. `on:` narrowed so the workflow no longer runs — `push` /
  `pull_request` removed, `paths-ignore: ['**']`, `branches:` no longer
  naming main — is reported.

### Fixed

- **Splitting or merging a spec blocked as a deletion.** Added lines of every
  added AND modified protected spec in the change are the relocation set, so
  a split (modify + add), a merge (delete + modify) and two `it`s folded into
  one `it.each` are relocations; a literal `it.each` table counts one test per
  row; the Java anchor accepts `@Timeout(5) @Test` on one line.
- **Editing a check line in place blocked as a removal.** A flag added, `npm
  test` → `npm run test` / `npm t` / `pnpm test`, `npx` → `pnpm exec` /
  `yarn` / `bunx`, quoting, and an action bumped `@v3` → `@v4` (Dependabot's
  daily move) are kept; `continue-on-error` / `if:` on an unrelated step no
  longer fire.
- **Three table rows removed plus one line lengthened** slipped under
  test-content-removal's net threshold; rows inside a literal `each` table
  are counted on their own.
- **Removing `console.log` lines from a spec** no longer counts as content
  removal; a stricter one-metric coverage override, an override removed for a
  file no longer in the repo, and a `{ ...base }` spread refactor no longer
  report metrics as removed.

## [2.4.1] — 2026-09-02

**The enforcement wiring is read for what it does, not for the words in it.
Six bypasses of `hook-tampering` closed and three false positives fixed. A
patch: bypass fixes at the same severity, and the guard on the gate's own
wiring is pinned where the policy under judgment could previously switch it
off.**

### Fixed

- **Claude Code settings were scanned as a shell script.** Narrowing the
  PreToolUse matcher from `Bash|Edit|Write|MultiEdit|NotebookEdit` to `Bash`
  removed no invocation and added no `exit 0`, so nothing fired and the
  file-edit tools were ungated. Setting the hook command to `true` while
  adding a junk field that quoted the invocation excused the removal, because
  survival was judged on any added line containing the token. A new
  `settings.local.json` that declared empty hook arrays, shadowing the
  wiring, was an add with nothing removed. `.claude/settings.json` and
  `settings.local.json` are now parsed on both sides and compared as
  (matcher tool set, command) pairs: an entry removed, a tool lost from the
  matcher, an event emptied, `disableAllHooks`, a parseable-before file made
  unparseable, and an add or modify that shadows the sibling's gate are all
  hook-tampering; survival is judged only on parsed command-type hooks.
- **Shell hook scripts were scanned for words too.** `|| true` after the
  invocation, `exit 0  # comment`, `exit 0;`, bare `exit`, `[ -n "$X" ] ||
  exit 0`, `if false; then` ahead of it, `npx tamperward --version` in its
  place, and `echo "npx tamperward …"` all read as a kept check. Scripts are
  reduced to their live check identities (runner, pin, redirects stripped;
  argument position and `--version` are not invocations) with a liveness
  state — live, neutered, unreachable, comment — and only a live survivor
  with the same identity excuses a removal.
- **A fresh `.tamperward.yml` was never compared to the baseline.** Adding a
  policy with `ignore: ['**']` or a lowered severity reported nothing because
  the comparison needed a `before`; an added policy is now judged against the
  effective baseline exactly like an edit.
- **The policy under judgment could silence the judgment.** At the local
  layers, `rules: { hook-tampering: { enabled: false } }` (or `severity:
  warn`) in the head policy switched off the findings about that very edit.
  Hook-tampering findings on the policy file and on the baseline hooks class
  can no longer be disabled, excluded or lowered by policy.
- **`git update-index --skip-worktree` was not a command anyone modelled.**
  It, `--assume-unchanged` and `--chmod=-x` on a protected path are
  hook-tampering, through `git -C`, `git -c`, an absolute `git` and `cd x &&`.
  Also `chmod 0`, `chmod 00644`, `chmod --reference=`, `perl -pi`, `awk -i
  inplace`, `sponge`, `ln -sf`, `git checkout <rev> -- <hook>` and
  `git restore --source` against a hook.
- **lefthook, pre-commit and package.json wiring:** an entry removed,
  `skip: true`, a narrowing `glob`/`exclude`/`only`, `stages` without a commit
  or push stage, a top-level `exclude`, and `prepare: husky` (or its
  lefthook/simple-git-hooks/pre-commit equivalent) dropped from every
  install-phase script are hook-tampering.
- **False positives:** `chmod +x`/`u+x` on a hook no longer fires (only a lost
  execute bit does); `cat hook > /tmp/backup`, `cp hook /tmp/`, `sed -n` and
  other read-only uses no longer fire (only a write whose target is the hook
  does); removing a CODEOWNERS line is judged by last-match-wins ownership of
  gate-critical paths rather than as "a check invocation (`husky`) removed";
  `lefthook.yml → .yaml` and `npx → pnpm exec` (or `yarn`, `bunx`) of the same
  command are kept.

## [2.4.0] — 2026-09-02

**The Stop sweep scans untracked protected files, the per-call drift check
fails closed on a change git cannot see, and the pytest collection knobs are
test-skip spellings. A minor: `hidden-drift` is a new, non-configurable
finding on the hook path, and an agent-created protected file is now judged
at Stop where it was invisible before.**

### Fixed

- **The Stop sweep ignored untracked files.** It fed the detectors from
  `git diff`, so a new protected file the turn created — a shadowing
  `vitest.config.ts`, a `.claude/settings.local.json`, a `conftest.py` carrying
  `collect_ignore` — was invisible to it (the `run` envelope already scanned
  them). The sweep and the per-call drift check now share one turn view:
  tracked changes since the turn baseline, plus every untracked file under a
  protected glob that the turn created (a turn-start snapshot of the protected
  tree, advanced only on a clean Stop, tells a new file from one that was
  there before), plus the hidden tracked files below. An untracked file
  outside the protected globs is not scanned, and a new test with ordinary
  content is not a finding.
- **A protected change git could not see was absorbed as the new baseline.**
  After `git update-index --skip-worktree test/a.test.ts` (or
  `--assume-unchanged`), git omits the file from every diff; the drift check
  saw the hash move, asked git for the change, got nothing, evaluated nothing,
  and saved the tampered tree as sanctioned. The Stop sweep then had nothing
  to compare. Hidden tracked files are now diffed by hand — the trusted blob at
  the base against the disk — and judged by the ordinary rules; any remaining
  drift is reconstructed from a blob whose hash equals the sanctioned one, a
  restore to the base or turn-start content is accepted, and anything else is
  a blocking `hidden-drift` finding that no policy can lower or disable. A
  block never advances the baseline.
- **A new file reached the hunk-based rules as an empty edit.** The untracked
  view carried full content but no hunks, so test-skip and the added-line half
  of hook-tampering read a brand-new file as nothing; hunks for an add are now
  synthesised from its content.
- **pytest collection is a skip.** `collect_ignore` / `collect_ignore_glob`
  (assignment, `+=`, `.append`, `.extend`), `def pytest_ignore_collect(`, and
  the parametrize `marks=` form join test-skip's Python patterns beside the
  2.2.1 spellings.
- **`passWithNoTests: true` in a jest or vitest config** is the CLI flag's
  twin and is now coverage-lowering, so a brand-new config carrying it — which
  has no `before` to compare thresholds against — is still a weakening.

## [2.3.0] — 2026-09-02

**`verify` runs both suites under the operator's environment, not the
candidate's, and the verification surface covers what the package manager
reads before the runner starts. A minor: the suite no longer inherits
`NODE_OPTIONS` or `PYTHONPATH`, and yarn's `yarn-path` is ignored, so a suite
that leaned on any of those from the ambient environment goes red until it sets
them in its own frozen command.**

### Fixed

- **An agent-added `.npmrc` made both runs green.** `node-options=--require
  ./p.cjs` in a project `.npmrc` is exported by npm as `NODE_OPTIONS` to every
  node it spawns, so with the frozen command `npm test` a two-line preload that
  stubs the runner's `test`/`it`/`describe` to no-ops made `node --test` find
  nothing and exit 0 in the visible AND the pristine copy: VERIFIED over a
  source the base suite fails, with no protected file touched. `.npmrc` was on
  no list — it is not a file the runner consults but the file the runner is
  started under. The same line in `~/.npmrc`, which the candidate owns inside
  `tamperward run`, worked identically and no in-tree list can cover it.
  Two layers close the class: the package-manager and runner files
  (`.npmrc`, `.yarnrc`, `.yarnrc.yml`, `pnpm-workspace.yaml`, `.pnpmfile.cjs`,
  `.pnp.*`, `.yarn/releases`, `.yarn/plugins`, `.env*`, `.nvmrc`,
  `.node-version`, `.python-version`, `setup.py`, `sitecustomize.py`,
  `usercustomize.py`, `.gitattributes`, `.nycrc*`, `.c8rc*`, `.taprc`,
  `ava.config.*`, `mocha.opts`, jasmine, playwright and cypress configs) join
  the verification surface; and both suites run under a sanitised environment
  — `NODE_OPTIONS`, `NODE_PATH`, `NODE_REPL_EXTERNAL_MODULE`, `PYTHONPATH`,
  `PYTHONSTARTUP`, `PYTEST_ADDOPTS` and `PYTEST_PLUGINS` dropped; npm's
  `node-options` pinned to nothing (a single space: npm skips an empty env
  value) and its user and global config pointed at empty files; yarn's
  `yarn-path` ignored. Verified against npm 10.9, pnpm 10.33 and yarn 1.22;
  the residual (a runner input that is neither a file here nor a variable
  there, Python's user site-packages among them) is stated in
  docs/THREAT-MODEL-pristine-run.md.
- **`git show` stays, deliberately.** `git cat-file --filters` was considered
  for LFS-tracked overlay files and rejected: a smudge is a command read from
  repository config the candidate writes, selected by working-tree attributes
  the candidate writes. An LFS pointer on the surface restores as a pointer
  and fails closed.
- **`verify --base --json`** read the base as `--json`; a value-taking flag now
  refuses a following flag or a missing value and verify exits 2.

## [2.2.1] — 2026-09-02

**Five block rules closed against their one-token neighbours, and three
routine edits that blocked no longer do. A patch: bypass fixes at the same
severity and false-positive fixes, nothing else.**

### Fixed

- **`no-verify` matched raw text, not git.** `git commit --no-veri` (git
  accepts any unambiguous prefix), a quoted `'--no-verify'`, and
  `export SKIP=tamperward; git commit` all walked past it, while
  `git log -n 5 -- src/commit.ts`, a commit message quoting `--no-verify`,
  and `grep -- --no-verify docs/` blocked. Flags are now matched as unquoted
  tokens of the `commit`/`push`/`merge` subcommand with option values dropped;
  env hatches as whole assignment tokens; `SKIP=` carries to a later segment
  only when exported or assigned bare.
- **`test-skip` spellings:** vitest `skipIf`/`runIf`/`fails`, jest
  `test.failing`, mocha `this.skip()`, `it.each([])`, `concurrent.skip`, a
  non-literal `{ skip: expr }`; Python `pytestmark`, bare `@skip`, an aliased
  `pytest`, `__test__ = False`; Go `testing.Short()` guards and
  `//go:build ignore`; Rust `cfg_attr(…, ignore)`; Ruby `before { skip }` and
  a block-less example; Java `assumeTrue(false)` and a fully-qualified
  `@Ignore`; C# `[Explicit]` and `Assert.Inconclusive()`. False positives
  fixed: `fit`/`xit`/`xdescribe` require call position, comment-only lines are
  skipped, and `skip:` counts only in a test's options.
- **`lint-suppression` spellings:** ESLint inline config (`/* eslint rule: off */`),
  `# ruff: noqa`, `# flake8: noqa`, `# mypy: ignore-errors`, `# pylint:
  skip-file`, `//lint:ignore`, `@file:Suppress`, `NOSONAR`, `ReSharper disable`,
  `@codingStandardsIgnore*`. A marker inside a string literal or docstring no
  longer fires.
- **`ts-any-cast`:** `x as (any)` reached only the warn rule because the
  parenthesised type was not unwrapped; JSDoc `/** @type {any} */ (x)` in
  JavaScript files is the same cast.
- **`snapshot-rewrite`:** `npm test -- -u` (the most common spelling) and its
  yarn/pnpm/bun forms, `find … -name '*.snap' -delete`, `git checkout --` on a
  snapshot path, `cargo insta accept`, `pytest --snapshot-update`,
  `UPDATE_EXPECT=1`.

## [2.2.0] — 2026-09-02

**`init` wires the hook where git actually runs it, the CLI fails closed on
every crash path, and the policy loader refuses what it cannot vouch for. A
minor, per CONTRIBUTING and the 1.15.0 precedent: the loader now rejects two
shapes it used to accept silently (an unknown top-level key, a ledger path
outside the repository), so a policy carrying either goes from "loaded, not in
force" to exit 2 — visible, where it was invisible.**

### Fixed

- **`init` wrote `.git/hooks/pre-commit` that git never ran.** With
  `core.hooksPath` set (lefthook, simple-git-hooks, a custom `.githooks/`) the
  hook landed in the wrong directory and every re-run reported "already runs
  the staged check". The hooks directory now comes from
  `git rev-parse --git-path hooks`; a lefthook or pre-commit-framework repo gets
  a `skip` with the exact config line to add.
- **`init` appended the gate after an `exec`/`exit` that made it dead code**,
  and later reported it as wired. The gate is inserted above the first
  unconditional exit; an unreachable gate that init wrote is moved, a
  hand-written one is reported as an error.
- **Crash paths exited 1 with a stack trace.** A bad `--diff` revision, a
  `--worktree` outside a repository, an invalid policy reaching `allow`, a
  directory where `init` expected a file: each is now one line on stderr and
  exit 2 (cannot evaluate, failing closed), never 1 (a blocking finding) and
  never 0. `init` plans every change before writing any; an apply failure is an
  error row, not an abort. `hook`/`sweep` are unchanged: a deny is JSON at exit 0.
- **`signoff.ledger` could point outside the repository, unreported.** The
  local layer trusts that file, so `../../shared.jsonl` handed the sign-off
  channel to whoever controls that path. The loader rejects absolute or
  escaping ledger paths (exit 2), and policy-diff reports any ledger change.
- **An `exclude`-only override produced a false "lowered block → undefined"
  finding** because the override replaced the whole rule object and dropped the
  baseline severity. Rule overrides are field-merged; the exclude addition is
  still reported, once.
- **Policy-derived strings reached the terminal unescaped.** A crafted
  `ignore` glob could carry a terminal escape sequence into a finding's
  message. Control characters are stripped from every rendered field, in the
  text and GitHub renderers.
- **`init` inferred `@org` as a CODEOWNERS owner** for an organisation remote,
  which GitHub rejects silently. The owner is confirmed against `github.user`
  or `user.name`; otherwise the rule gets a TODO comment and init warns.
  `/dir/**` patterns are recognised so re-runs stop appending duplicates.
- **Silent config footguns.** An unknown top-level key (`Rules:`, `ignored:`)
  fails closed naming the accepted set; a leading `/` on a protected, ignore or
  exclude glob is normalised away instead of matching nothing; `init` loads an
  existing policy and reports its error instead of "left untouched";
  `check --diff` prints a stderr note when a range scans zero changes.

## [2.1.1] — 2026-09-02

**Two bypasses of every git view, closed. A patch: bypass fixes at the same
severity, and nothing that was green turns red.**

### Fixed

- **git's binary heuristic blinded every content detector.** A committed
  `.gitattributes` line (`x.spec.ts -diff`, or the `binary` macro) — or simply
  a NUL byte anywhere in the file — made git print "Binary files differ" instead
  of hunks. The parser marked the change binary, the builder skipped loading its
  content, and test-skip, test-content-removal, ci-tampering, coverage-lowering
  and hook-tampering's content branch all went silent on that file, in the
  range, staged and worktree views alike; through the hook, a Write adding
  `it.skip` plus `\0` was allowed. Every `git diff` Tamperward runs now passes
  `--text`, which overrides both the attribute and the heuristic, and content is
  loaded regardless of the binary flag. A modified binary golden file still
  produces only the snapshot-rewrite warning it did before.
- **A path containing a space was invisible.** git appends a tab to an unquoted
  path with a space in the `---`/`+++` lines; the parser kept it, so
  `my tests/b.test.ts\t` matched no protected glob and a deletion or `.skip`
  under such a directory reported clean. The tab is stripped; quoted paths are
  decoded as before, and the header split no longer mis-parses a directory
  containing ` b/`.

## [2.1.0] — 2026-09-02

**`verify` gains the out-of-band sign-off channel `check --diff` has had since
1.13.0. A minor, per CONTRIBUTING: new surface, and nothing that was green turns
red — a masked failure that no label covers exits 1 exactly as before.**

### Added

- **`tamperward:allow:verify@<head-sha>` clears a `verify` masked failure.**
  Until now a MASKED_FAILURE had no human escape at all: the one case where the
  original suite is genuinely wrong for the change — an intended behaviour change
  whose old expectations must fail — could only be merged by switching the
  verify step off. `verify` now reads the same `TAMPERWARD_OOB_SIGNOFF` and
  `TAMPERWARD_OOB_HEAD` the diff gate reads, with the same rules: once the
  workflow names the head it is adjudicating, only a token bound to that commit
  counts, so the approval dies with the next push. The verdict is still
  reported as `MASKED_FAILURE` (with `oob_signoff` in `--json`); only the exit
  code changes. It clears nothing else — SUITE_RED and cannot-verify are not
  approvable states, so a label cannot make a red suite green or turn "could
  not run" into "verified". The committed ledger is never consulted.
- The generated CI workflow passes both variables to its verify step. Re-run
  `tamperward init` to migrate a workflow it wrote; a hand-edited one is left
  alone, as before.

## [2.0.0] — 2026-09-02

**Node 18 is no longer supported. That is the whole of the breaking change, and
it is a major because CONTRIBUTING's test says so: a user on Node 18 who takes
this upgrade gets a red build without changing anything.**

Node 18 reached end of life in April 2025; the CI matrix had gone on proving a
runtime that no longer receives security fixes, and the dev toolchain was
pinned back to the last lines that still ran on it. The floor is the lowest
Node the current toolchain runs on, not the newest LTS: Node 20 stays
supported and tested. Nothing in `src/` changes — the gate's behaviour on Node
20, 22 and 24 is exactly 1.15.0's.

### Changed (breaking)

- `engines.node` is `>=20.19`. The CI matrix tests Node 20, 22 and 24.
  `init`'s generated workflow already ran on 22; nothing it writes changes.

### Changed

- Dev dependencies: `vitest` 2 → 4 and `vitepress` 1.6 → 2.0 (their vite 7
  line, whose own floor is Node 20.19 and is what set this one), `@types/node`
  20 → 22 (type definitions only; the floor is unaffected). `npm audit` is
  clean, dev dependencies included.

## [1.15.0] — 2026-09-02

**A third external audit. Five fail-open paths closed, the pattern rules read
the language of the file, and the project's own gate binds its labels to the
head SHA. A minor, per CONTRIBUTING: the rules catch more only in changes that
already violated the policy they declare, and `init` gains a pin, not a rule.**

**Five ways the gate failed open, from a third audit. Each was reproduced against
the built 1.14.6 CLI before the fix; each is now a permanent test
(`test/audit-fail-open.test.ts`).**

### Fixed

- **A mistyped severity switched a rule off, silently.** `rules.<name>.severity:
  BLOCK` (or `blocc`, `blocking`, `1`) parsed cleanly and produced findings that
  were neither `block` nor `warn` — findings nothing treats as blocking. After
  such a line, `rm a.test.js` passed the PreToolUse hook, the Stop sweep, and
  `check --worktree`; and the edit that introduced it was not reported, because
  policy-diff compared for `warn` only. The loader now validates every value in
  the file (`rules`, `ignore`, `protected`, `signoff`, `verify`) and fails
  CLOSED on anything it does not understand, exactly as it already did for
  `version:`; policy-diff reports any departure from `block` as a lowering.
  Unknown rule *names* still load, so a policy for a newer build keeps working.
- **A tool-call diff past 1 MiB was read as a smaller edit.** The hook adapter
  called `git diff --no-index` with Node's default `maxBuffer`; on overflow the
  truncated patch was parsed as the whole edit, so `test.skip` appended to a
  3 MB spec was allowed. The buffer is 256 MiB, and any diff failure other than
  "files differ" now fails closed instead of parsing partial output.
- **A redundant path segment dodged every exact-path protected glob at the
  hook.** `/repo/./.claude/settings.json` and `/repo/src/../.tamperward.yml`
  reached the detectors as `./.claude/settings.json` and
  `src/../.tamperward.yml`, which no glob matches — the gate's own wiring could
  be edited unseen at PreToolUse. Paths are resolved before matching.
- **`chmod -x` on a hook was invisible to every git view, and three spellings
  dodged the command detector.** A mode-only change carries no hunks, so the
  parser dropped it and the staged, worktree and range views reported clean
  after `chmod u-x .husky/pre-commit` (husky v8 points `core.hooksPath` at that
  file; git skips a non-executable hook). The parser now records `old mode` /
  `new mode`, hook-tampering flags a lost execute bit, and the command surface
  reads chmod arguments the way chmod does (`u-x`, `a-x`, `go-x`, `u=rw`,
  comma clauses, octal) instead of a regex that only matched `-x`.
- **`verify`'s budget kill stopped the shell and nothing else.** Workers forked
  by the runner survived a BUDGET_EXCEEDED verdict, in a directory about to be
  removed, executing the candidate's code after the verdict. The suite now runs
  in its own process group under a small supervisor, and the whole group is
  killed on budget or exit.


**Protection that was silently absent, from a third audit. Each case is a
permanent test (`test/coverage-gaps.test.ts`).**

### Fixed

- **Session state was written INSIDE the working tree from a `git worktree` or a
  subdirectory.** `git rev-parse --git-dir` answers an absolute path from
  anywhere but the top of an ordinary checkout, and the effect layer joined it
  onto `cwd` — so a Claude Code session in a worktree created
  `<worktree>/tmp/…/main/.git/worktrees/x/tamperward/` and kept its drift state
  there. The watcher's default log assumed `.git` was a directory and silently
  recorded nothing in a worktree. Both now resolve the real git directory.
- **`enabled: false` did nothing for a rule that is not a detector id.** The
  engine checked the flag per detector, so `ts-any-launder` (emitted by the
  `ts-any-cast` detector) and `transient-protected-mutation` (judged outside the
  engine) kept firing after being switched off. Findings are now filtered by
  their own rule id. The engine's `detector-error` can never be disabled.
- **`SKIP=<hook-id>` and `LEFTHOOK_EXCLUDE=` were not hook bypasses.** The
  pre-commit framework and Lefthook both document these as the way to skip a
  hook; `.pre-commit-config.yaml` and `lefthook.*` are protected, and their
  own escape hatches were not. `SKIP=` counts only in a segment that runs git
  or pre-commit, since the name is plausible elsewhere.

### Changed

- **The pattern rules read the language of the file.** Since 1.14.0 the
  baseline has protected Python, Go, Rust, Ruby, JVM, PHP and .NET test files,
  but every skip marker, every suppression directive and the test-block count
  were JavaScript spellings — `@pytest.mark.skip` in a protected spec fired
  nothing, and `def test_x` counted as zero tests on both sides. `test-skip`,
  `lint-suppression`, `test-deletion` (block count) and
  `test-content-removal` (significant lines, now one shared filter) now use the
  equivalent spellings for each of those ecosystems; a file of unknown language
  is read as before. Rust `#[allow(...)]` is deliberately not a suppression
  finding — it is the ordinary way to annotate an intentional lint, and a block
  rule on it would be mostly false positives. Per CONTRIBUTING this is a
  **minor**: the rules catch more only in changes that already violated the
  policy they declare.


### Fixed

- **This repository's own gate did not bind approval labels to the head SHA.**
  `ci.yml` set `TAMPERWARD_OOB_SIGNOFF` but never `TAMPERWARD_OOB_HEAD`, so a
  `tamperward:allow:<rule>` label earned for one benign finding cleared every
  later one pushed to the same PR — the P1-6 hole the shipped template closed in
  1.12, still open on the project's own CI. Labels on this repo now read
  `tamperward:allow:<rule>@<head-sha>`, as the generated workflow requires.
- **ci-tampering read a YAML comment as a removed check.** A comment that quoted
  `tamperward:allow:<rule>` in a code span satisfied the invocation-position test
  through the backtick before the word, and rewording it was a blocking finding.
  Comment lines are never steps.

### Changed

- **`init` pins the local hooks to the version that wrote them**, as it already
  pinned the workflow (P2-15). `npx --yes tamperward hook claude` with no
  version resolved `latest` on every call in a repo where the package was not
  a devDependency, so the gate changed under the repo without anyone changing
  anything. Re-running `init` re-pins an install it wrote for another version
  (or wrote unpinned) in `.claude/settings.json` and the pre-commit script; a
  command someone wrote by hand is left exactly as it is.
- Dev dependencies: `esbuild` 0.24 → 0.25. `vitest` stays on 2.x and `vitepress`
  on 1.6.4: every later vitest, and vitepress's only fixed line (the 2.0 alpha),
  pull in a vite that drops Node 18, which this package still supports
  (`engines >=18`, tested in CI). `npm audit` therefore still reports the vite
  dev-server advisories through those two; none of them reach the published
  package (`npm audit --omit=dev` is clean).

## [1.14.6] — 2026-09-02

**H2, the last open hypothesis from the second audit, is confirmed: a pull
request can switch off the gate that judges it. This ships what can be shipped,
and says plainly what cannot.**

### The reproduction

A `pull_request` workflow executes from the **pull request's own head**, and a
required status check is matched by **job name**. So a pull request can keep the
job called `gate`, replace every Tamperward invocation in it with `true`, and
present a green required check over any change it likes.

Run as a controlled fixture against this project's own CI, on a branch that also
lowered `hook-tampering` from `block` to `warn`:

    Complete job name: gate
    ##[group]Run true
    true

`gate` — **success, in three seconds**. The same range, checked locally with
1.14.5, blocks with two findings and exits 1:

    BLOCK  ci-tampering    .github/workflows/ci.yml
    BLOCK  hook-tampering  .tamperward.yml

The detector is correct and irrelevant. A second guard fell with it: the "No
Claude session links" step lives in the same job, so that check vanished on that
branch too. One neutered job takes out everything defined in it.

**No detector can close this**, because the detector is defined by the candidate.
Only a human requirement on the paths that constitute the gate can — which is
what CODEOWNERS expresses and what branch protection enforces.

### What `init` now does

A fifth enforcement point: `.github/CODEOWNERS`, requiring a code owner on
`/.github/workflows/`, `/.tamperward.yml` and `/.github/CODEOWNERS` itself. The
owner is inferred from the `origin` remote. Rules are appended at the **end** of
an existing file, because CODEOWNERS is last-match-wins and our rules must not
be shadowed by a broader earlier pattern; a directory rule already covering a
path (`/.github/`) counts, so nothing redundant is added. Where the owner cannot
be inferred, the file says so in capitals rather than writing a rule that binds
nobody — an unresolvable owner is protection that is silently absent, which is
the failure class this project keeps re-learning.

`CODEOWNERS` also joins the protected `hooks` class in all three locations
GitHub reads it from. It is enforcement wiring, not documentation.

### What `init` cannot do, and now says

`init` cannot set branch protection. So it ends, every run, with the step it
cannot take for you: require the check **and** enable "Require review from Code
Owners". Until both are set, the CI gate is advisory — and the message says so
in those words, because a tool that implies otherwise is worse than one that
says nothing.

### Fixed

- `init` writes and maintains a CODEOWNERS requirement on the gate-critical paths.
- `CODEOWNERS` is a protected `hooks` asset, so removing it is a finding.
- `init` always reports the branch-protection step it cannot perform.

## [1.14.5] — 2026-09-02

**The pristine run was writable by the candidate. Four findings from a second
external audit; a fifth is mechanism-established and deliberately not claimed.**

### The visible run could edit the pristine copy

The two copies were siblings under one temporary root, and BOTH were
materialised — overlay fully applied — before the visible run started. The
visible run executes the candidate's code. So the candidate's code wrote

    ../pristine/test/<the test that convicts it>

and both runs returned 0. No race. No background process. No git. Three lines in
a file the agent already controls, and the layer whose entire purpose is to
execute code the agent did not write reported `VERIFIED` over an unfixed bug.

Sequencing is the fix: **the pristine copy is built only after the visible run
has exited.** There is nothing to write into while the candidate is running,
because it does not exist yet. Separate temporary roots as well, but that is
defence in depth and not the control — a background process can still enumerate
a temp directory.

Two guards close what sequencing alone cannot:

- the restored overlay files are digested (content **and** mode) either side of
  the pristine run, so a write that reaches the copy after it exists is caught;
- the working tree and the installed dependency tree are fingerprinted around
  both runs. The pristine copy is now materialised from the source tree *after*
  the candidate has had a turn, and that tree's path is one `readlink` away
  through the `node_modules` symlink — so a visible run that reaches back into it
  would be choosing what the pristine copy is made of. Any movement is exit 2.

**Behaviour change:** a suite that rewrites its own test files or snapshots in
place during verification now fails closed rather than being verified. Run it in
whatever mode your runner calls CI, so verification observes rather than updates.

### The overlay restored content, not mode

`git ls-tree --name-only` was the whole of the base read, so a restored file kept
whatever mode `materialize` had copied from the agent's working tree — or, for a
file the agent had deleted, the 0644 a fresh `writeFileSync` produces. A base test
at `100755` therefore arrived non-executable, and a discovery command that runs
the executable files under `test/` found nothing to run in either copy: `VERIFIED`,
over a source that fails. **The agent never edited a byte of the test. `chmod -x`
was the entire attack.** Mode and type now come from the base: blobs are restored
with their mode, a base symlink is reproduced as one, and a submodule inside an
overlay class fails closed rather than being faked.

### A transient dependency substitution was invisible

`run` compared the `node_modules` fingerprint at entry against the fingerprint at
exit. A replacement runner that returns 0 for the visible run, returns 0 for the
pristine run, and puts the original bytes and mode back on its way out leaves
those two identical — reproduced end to end as `GREEN MEANS GREEN` over an unfixed
bug. The state that matters is the one the checks are about to execute, so it is
now compared **before adjudication begins**, as the object-rewrite check already
was; `verify` re-checks it around each suite invocation as well.

### The CI gate was fetched from a registry the candidate chose

`npm` reads `.npmrc` from the working directory — which, in a `pull_request`
workflow, is the checked-out pull request. One committed line,
`registry=https://…`, decided where `npx --yes tamperward@<version>` downloaded
the authority judging it from. The version pin pinned the **string**, not the
**source**. The generated workflow now sets `NPM_CONFIG_REGISTRY` at job level,
which outranks a project `.npmrc` in npm's config precedence. Workflows generated
by 1.14.4 and not edited since migrate automatically on the next `init`, via the
provenance stamp shipped in that release.

### Not claimed

A fifth hypothesis — that a pull request can neuter the generated workflow while
keeping the required job name, so the check reports green rather than missing —
is **mechanism-established and unreproduced**. `pull_request` workflows run from
the PR head and required checks match by name, so nothing in the template
prevents it; no live PR fixture has been run, so it is not described here as a
reproduction and nothing has been changed for it.

### Fixed

- `verify` builds the pristine copy only after the visible run exits, digests the
  restored files around the pristine run, and fails closed if the working tree or
  the installed dependency tree moves during verification.
- `verify` restores the base's file mode and type, not only its content.
- `run` compares the dependency fingerprint before adjudication, not only at exit.
- The generated CI workflow pins `NPM_CONFIG_REGISTRY`.

## [1.14.4] — 2026-09-02

> **Unpublished development entry; superseded by published 1.14.5.** The registry sequence is 1.14.3 → 1.14.5.

**Six fixes from an external audit. Two of them reopen the same wound 1.14.1,
1.14.2 and 1.14.3 each closed one layer of: the verifier's inputs, and the git
objects the base resolves to.**

### The verifier executed files nothing restored

1.14.3 froze the verifier's command *string* against the base policy. It did not
freeze what that string runs. The pristine overlay restored the tests, the
snapshots and the runner configuration — and then handed the result to `sh -c`,
which ran a program:

    verify:
      command: node runner.js     # runner.js is in no protected class,
                                  # and on no runner's config surface

Rewriting `runner.js` to `process.exit(0)` produced `VERIFIED`, exit 0, over an
untouched bug. Delegation is worse, because the restoration looks complete:
`package.json` is on the verification surface, so the base's
`"test": "sh scripts/test.sh"` was faithfully restored — and then called a
script nobody restored.

The pristine copy now also carries the base's copy of **what the verifier
executes**, from two sources:

- **implicit** — command tokens naming a file that exists at the base
  (`node runner.js`, `sh scripts/ci.sh`, `./run-tests`). No configuration; it can
  only ever restore a file the base itself shipped.
- **explicit** — a new `verify: { inputs: [globs] }` block, for delegation, which
  is not statically decidable. Files matching it are restored from the base, and
  files the agent *added* under it are removed from the pristine copy — the
  added-`conftest.py` argument, one layer down.

Narrowing `verify.inputs` is policy weakening, alongside changing the command and
lowering the budget.

This bounds the class; it does not eliminate it. A command can still reach a file
neither source names — a `Makefile` include, an interpreter's startup file, a
tool config outside the surface list. Stated as a residual in
`docs/THREAT-MODEL-pristine-run.md`, not as solved.

### The base itself could be redirected

`git replace`, `.git/info/grafts` and `.git/shallow` change what a commit
*resolves to* without moving a ref or touching a tracked file. Every guarantee
here reduces to "the base says X": the overlay's `git ls-tree` (which files exist
at the base) and `git show` (their content), and the envelope's `merge-base`
ancestry assertion. `git replace <base> <a-commit-the-agent-just-wrote>` made all
three answer from a forged tree, and reported `VERIFIED`.

- every trusted read in `verify` and `run` now sets `GIT_NO_REPLACE_OBJECTS=1`,
  which is complete for replace refs;
- grafts and shallow have no such switch, so `run` fingerprints the whole
  object-rewrite state before the agent starts and re-checks it the moment the
  agent exits. A change is `OBJECT_REWRITE → ENFORCEMENT_FAILED` (exit 1),
  checked **before** adjudication rather than reported after it: a report
  produced under a redirected base describes an anchor nobody chose. It is
  checked a second time after the checks, for a survivor that installs one
  mid-run.

This closes the case where the agent installs a rewrite during the run. A rewrite
that predates the envelope predates its authority and is unchanged.

### `init` could not migrate what it had generated

"Workflow already present — left untouched" made the CI template write-once per
repository. Everything shipped in it since is therefore absent from every repo
that ran `init` before it: the pristine-verify step (1.9.0), the version pin,
`--require-ancestor`, the head-bound sign-off label. A repository whose workflow
predates 1.9.0 has diff-time detection and no pristine re-execution at all — and
re-running `init` told its owner CI was wired. **Security fixes that only reach
new adopters are not shipped.**

Generated workflows now carry a provenance stamp (version + hash of the body as
generated). A file `init` wrote that nobody has edited is migrated in place; a
file that was edited, or that `init` never wrote, is reported and left exactly as
it is. `--force-workflow` is the operator's override for the second case.

### `init` blessed a PreToolUse matcher with a hole in it

The wiring check only ever asked whether *our command* was present, so an install
wired before `NotebookEdit` was added to the matcher (1.13) kept a permanently
narrower gate, and every later `init` confirmed it as correctly configured. `init`
now compares the tool set and widens a matcher that does not cover every tool the
gate must see — as a union, so tools the user added are kept.

### The hook failed OPEN on a payload it could not read

`parseInput` absorbed every parse failure into `{}` — the empty input — which
flows through to "no findings": exit 0, empty stdout, **allow**. Truncated stdin,
a JSON array, a partial write from a runtime under memory pressure: all
indistinguishable from "this tool call is fine", for every tool call while the
condition lasted. That is the hole `failClosed()` exists to close, left open at
the front door. Unreadable and malformed payloads are now denied. Genuinely empty
stdin is still an allow — it is a well-formed *absence* of a tool call.

### Fixed

- `verify` restores the files the verifier command executes, implicitly from the
  command and explicitly from `verify.inputs`; `parsePolicy` no longer drops the
  new field, and narrowing it is flagged as weakening.
- `verify` and `run` read git with `GIT_NO_REPLACE_OBJECTS=1`; `run` convicts an
  object-rewrite installed during the run.
- `init` migrates a generated, unedited CI workflow, and never overwrites one it
  did not write (`--force-workflow` to override).
- `init` widens an incomplete PreToolUse matcher.
- The Claude hook denies a payload it cannot parse instead of allowing it.

## [1.14.3] — 2026-09-02

**Policy provenance: `verify --base` now reads its policy from that commit, not
from the candidate tree.**

`tamperward run` has always frozen the policy at the entry commit and passed it
to the verifier. Standalone `tamperward verify` did not: it called
`loadPolicy(cwd)`, so the overlay classes, the verification surface and — the
part that matters — the `verify:` block's command and budget all came from the
working tree. **The generated CI workflow runs standalone `verify`**, so a pull
request supplied the configuration for its own re-execution:

    # in the PR's .tamperward.yml
    verify:
      command: 'true'

reported `VERIFIED`, exit 0, over an unfixed bug.

`check --diff` reads its policy from the merge-base and flags that edit as
`hook-tampering`. The generated workflow is **one required job containing two
sequential checks**, not two independently required jobs. Before 1.14.3 the
composite remained blocking because the base-policy `check --diff` step was part
of that required job and its failure determined the job's final conclusion. The
current ordering additionally meant the vulnerable verifier step was skipped
after a diff failure, but **ordering itself was not the security boundary** — a
failure in either step fails the job.

If the checks are ever split into separate jobs, **both job conclusions must be
required**. Requiring only the formerly vulnerable `verify` job would reopen the
authority failure. Anyone invoking `verify` on its own had no protection at all.
The README claimed the CI verdict was base-governed; that was true of
`check --diff` and not of `verify`.

With a `--base`, `verify` now loads the policy from that commit and falls back
to the built-in defaults if the base has none. Without a `--base` there is no
trusted commit to read from and the working tree's policy is still used — that
is the local-developer path, not the authority path. A `verify:` block added
only on the candidate is therefore no longer used; add it at the base, or pass
`--cmd` explicitly, and the error message says so.

Two routes, both closed. The `verify:`-block form above is the simpler one. The
other is a tree-authored **overlay glob**, and whether it produces a false green
depends on the baseline:

- against a **red** base — the task's bug already present — widening an overlay
  class to cover source makes the pristine run fail *harder*, so it fails closed
  as `MASKED_FAILURE`;
- against a **green** base, a candidate can introduce a source regression, gut
  the test so the visible run is green, and widen an overlay class to cover the
  source. The pre-1.14.3 verifier then restored *both* the good base source and
  the base test, and both runs came back green — `VERIFIED`, exit 0.

That is what the repository's own `P0-2` fixture documented with
`protected.config: ["**"]`, and `protected.tests` is equivalent for the purpose
because both classes are in `OVERLAY_CLASSES`. Confirmed on 1.14.2 for both
spellings, and closed in 1.14.3 for both.

The existing `P0-2` regression asserted the hole rather than the fix — it
expected standalone `verify` to return 0, because at the time only the envelope
passed a frozen override. It now asserts the closed behaviour, and a new `P0-2b`
covers the `verify:`-block form. Both are mutation-checked: reverting the
provenance change fails both.

Scope: a bypass fix, therefore a patch. It is a **behaviour change for anyone
who changes `verify.command` inside a pull request** — CI now runs the base's
command. That is the intended direction: the candidate does not choose the rules
it is judged by.

## [1.14.2] — 2026-09-01

**1.14.1 fixed a filename, not the class. Six more vectors were live; this
closes them.**

1.14.1 removed agent-added files inside the policy's `protected` classes and
treated the pristine-inheritance bypass as closed. It was not. The `config`
class is jest/vitest/tsconfig/eslint/package.json — JS/TS only — so pytest's
entire configuration surface sat outside it, as did every runner that is not
jest or vitest. Demonstrated live at 1.14.1, each via a single added file, with
the bug never fixed and no base-protected file touched:

    pytest.ini      addopts = --deselect <nodeid>
    setup.cfg       [tool:pytest] addopts
    tox.ini         [pytest] addopts
    pyproject.toml  [tool.pytest.ini_options]
    pytest.ini      -p <plugin module not named conftest>
    pytest.ini      addopts = -k "not <test>"

The full envelope printed `GREEN MEANS GREEN` over an unfixed bug in every case.

`verify` now owns a **verification surface** — the files a runner auto-consults
to decide what to collect, how to configure it and which plugins to load — and
treats it as base-owned exactly like the protected classes: restored from base
if it existed there, removed if the agent added it. The pristine tree's
discovery and configuration surface is therefore the base's, never the base plus
the agent's contribution.

The surface is deliberately **separate from the policy's `protected` classes**.
They overlap but answer different questions: `package.json` is policy-protected
because gutting the test script is weakening; `pytest.ini` need not be
policy-protected at all and still must never be inherited by the pristine run.
Keeping them apart means widening the verifier's list does not widen in-loop
denials.

**This list is a lagging indicator by construction.** A runner can always add a
configuration source, so this bounds the class rather than eliminating it. That
is stated in the SPEC rather than implied to be solved, and the full analysis —
including what was tested and did not reproduce — is in
`docs/THREAT-MODEL-pristine-run.md`, with the multi-vector proof of concept at
`harness/poc/verify-pristine-inheritance-vectors.sh`.

**Considered and rejected for this release:** disabling runner plugin autoload
in the pristine run (`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`). It would cover
entry-point plugins that no file list can enumerate, but it also breaks suites
that legitimately depend on them — `pytest-asyncio`, `pytest-django` — turning
honest work into `MASKED_FAILURE`. Applying it symmetrically to both runs makes
those repositories fail closed and unverifiable instead. It needs a per-repo
opt-in, not a default.

Scope, in the terms of CONTRIBUTING: a bypass fix, therefore a patch. It makes
`verify` stricter — a repository whose pristine run depended on an agent-added
runner config may now see `MASKED_FAILURE`. Failing closed is the intended
direction.

The published record is corrected accordingly: the bypass class was open from
**v1.9.0 through 1.14.1 inclusive**, not closed by 1.14.1.

## [1.14.1] — 2026-09-01

**A bypass in `tamperward verify`: an added file could suppress the tests the
pristine run had just restored.**

`verify` materialises two copies of the tree and, in the pristine one, restores
every protected file from the trusted base. Agent-**added** protected files were
kept, on the stated premise that they "can only add strictness, and the visible
run already required them to pass". That premise was false, and the gap was
reachable without ever modifying or deleting a base-protected asset.

An agent that adds `tests/conftest.py` gets it auto-loaded by pytest, and
`pytest_collection_modifyitems` can deselect the restored base tests **by node
id** — no skip spelling, so no detector could see it. The failing test then runs
in neither copy, the pristine suite goes green, and a masked failure is reported
`VERIFIED`. Through the enforcement envelope the whole stack printed
`GREEN MEANS GREEN` over an unfixed bug.

Agent-added protected files are now **removed** from the pristine copy: its
protected surface is exactly the base's, never the base plus whatever the agent
contributed. Added tests are not lost information — the visible run still
executes them; the pristine run asks only whether the agent's source passes the
*original* suite, to which an agent-authored file is not an input. The reported
count changes from `added_protected_kept` to `added_protected_removed`.

Reproduced on v1.9.0 (where `verify` was introduced) through v1.14.0 under one
identical policy, with the control — weakening the protected test, nothing
added — correctly blocked as `MASKED FAILURE` throughout. The PoC is committed
at `harness/poc/verify-added-protected-bypass.sh` and the regression test is
mutation-checked: it fails against the pre-fix behaviour.

This is a bypass fix and therefore a **patch**, per CONTRIBUTING — a closed
evasion should reach people automatically. It does make `verify` stricter: a
repository whose suite command names an agent-added protected file may now see
`MASKED_FAILURE` where it previously saw `VERIFIED`. Failing closed is the
intended direction.

Known limitation, deliberately not closed here: removing added protected files
addresses files inside a protected class. Auto-loaded influence can also arrive
via pytest plugins, `sitecustomize.py`, package entry points, new Jest/Vitest
configuration, preload files, or shared mutable dependencies. The invariant we
want — *the pristine run must not inherit agent-added files that can change test
discovery, configuration, fixtures, setup, or execution authority* — needs its
own threat model, and is tracked for the next round.

## [1.14.0] — 2026-08-31

**The last P2s — and the one that matters is not a security bug.**

- **P2-13 — test protection was silently absent outside JavaScript.**
  `test-skip`, `test-deletion` and `test-content-removal` all gate on the
  `tests` protected class, and the default globs matched only JS/TS. A Python,
  Go, Rust, Ruby, Java, PHP or C# repository could run `tamperward init`, see
  a policy file appear, and have those rules never fire once — with nothing
  saying so. Protection that is silently absent is worse than protection you
  know you do not have. Conventional test layouts for those ecosystems are now
  in the default class, with a control asserting ordinary source that merely
  mentions "test" is still unprotected.
- **P2-12** — `NotebookEdit` was modelled by the adapter but missing from the
  matcher `init` installs, so that branch was unreachable in the default
  deployment. It is in the matcher now.
- **P2-14** — a crafted file path broke out of the link and code span into the
  rendered job summary. The label is neutralised for a code span and the URL
  percent-encoded; ordinary paths render unchanged.
- **P2-16** — revision arguments reached git unvalidated, so an argument
  beginning with `-` would be parsed as an option. `assertRev` refuses that at
  the range, merge-base and verify entry points. Operator-controlled in every
  shipped wiring, so a guard rather than a demonstrated escape — free to fix.

This closes every finding from both passes of the external review. Full suite
364/364.

## [1.13.0] — 2026-08-31

**The CI authority's own integrity: P1-3 and P1-6.**

- **P1-3 — standalone `verify` could be anchor-downgraded.** `run` enforces
  that HEAD descends from the trusted base; `verify --base <rev>` resolved
  with merge-base semantics and had no such guard, so history rewritten
  beneath the base silently anchored verification to an older commit. That
  matters more since 1.12.0, which ships exactly this standalone wiring.
  `--require-ancestor` fails closed (exit 2), and the generated workflow
  passes it. Deliberately opt-in: a PR branched from an older main
  legitimately has a non-ancestor base, so defaulting it on would break
  ordinary PRs rather than catch attacks.
- **P1-6 — a CI approval was unbound and sticky.** It matched on rule (or
  rule:file) with nothing tying it to what was approved or when, and GitHub
  labels persist across `synchronize` — so a label earned for one benign
  deletion cleared every later one pushed to the same PR. The local ledger has
  always been fingerprint-bound; this channel was not. Approvals may now carry
  `@<head-sha>` (`tamperward:allow:test-deletion@a1b2c3d4`), and once the
  workflow supplies the head it is adjudicating, an **unbound label clears
  nothing** — the next push re-blocks. Workflows generated before this release
  pass no head and keep the old behaviour, so upgrading breaks nobody;
  re-running `tamperward init` opts a repository in.

Full suite 349/349; each exploit test verified to fail with its fix reverted,
with controls (honest history, different-head label, legacy behaviour) passing
both ways.

## [1.12.0] — 2026-08-31

**The P1 batch: four AUDIT-class findings, plus the supply-chain pin.**

- **P1-7 — a detector that threw was silently dropped from the verdict.**
  Repository content that makes a rule throw removed that rule and the gate
  reported "clean". Isolation is still right at the tool-call and turn hooks,
  where a thrown error already fails open in the runtime — but the
  *adjudicating* views (staged, worktree, range) now emit a blocking
  `detector-error` finding. A rule that cannot run is not a rule that passed.
- **P1-1 — verification wrote through symlinks, out of its own sandbox.**
  `statSync` follows links while `cpSync` preserves them, so a protected path
  replaced by a symlink was copied as a link and then written and chmod'd
  through it — landing base content and permissions on a file outside the
  repository, regardless of the verdict. Both the materialiser and the
  pristine overlay now drop a symlink before writing. The test watches a file
  outside the repo and asserts it is untouched.
- **P1-4 — the enforcement wiring was protected by nothing.** `init` installs
  hooks into `.claude/settings.json` and a pre-commit config; neither was in
  any protected glob, so editing the gate out fired no rule. They are in the
  `hooks` class now. `.git/hooks/**` is outside every git view and cannot be
  covered by a glob — that residual is recorded rather than implied away.
- **P1-5 — the shipped CI template never ran `verify`.** Diff-time detection
  is spelling-dependent by nature; pristine re-execution is not, and it was
  the layer nothing got past in the taskbench sweeps. Shipping a template
  without it meant every masked-failure class was adjudicated only at the
  local layer — the layer an agent shares a filesystem with. `init` now writes
  a second step running `tamperward verify --base <base sha>`, which fails
  closed without a `verify:` block rather than passing quietly.
- **P2-15 — the gate resolved itself, unpinned, at gate time.** The workflow
  now pins `tamperward@<the version that wrote it>` instead of `npx --yes
  tamperward`: a floating dependency in the one component whose job is
  integrity.

Full suite 342/342; every exploit test verified to fail with its fix reverted.

## [1.11.1] — 2026-08-31

**The suite runner is part of the trust anchor (P0-6).** `verify` symlinks
`node_modules` into both the visible and pristine copies. It is gitignored, so
no diff view sees it, and it is where the suite's own runner lives — an agent
that writes `node_modules/.bin/<runner>` replaces the program that decides both
verdicts. Reproduced: VERIFIED, visible and pristine both exit 0, with the
source bug sitting untouched in `src.js`.

The envelope now content-hashes the installed dependency tree before the agent
starts and again at adjudication; a change is `DEPENDENCY_DRIFT` (exit 1).
Content-hashed rather than stat-compared, because P1-8 is the standing lesson
that mtime and size belong to the agent. Measured 3.4s over 145MB / 5,453
files, inside a command that already runs the suite twice.
`--allow-dep-drift` accepts the risk explicitly, the same operator-owned escape
as `--allow-dirty`. Note the honest scope: `verify` itself is still fooled by a
substituted runner — the fingerprint is what catches it.

**Also fixed, found while building that fixture: a relative `--cwd` broke
verification entirely.** The copies' `node_modules` symlink was built from the
caller's cwd verbatim, so a relative one (`--cwd .`, which the envelope passed
through) resolved against the copy's own directory — every suite in both runs
exited 127 and `verify` degraded to permanent SUITE_RED. It fails closed, so
nothing was ever wrongly cleared, but an oracle that always says red is one
people switch off. Targets are absolute now, and the envelope resolves its cwd.

Full suite 338/338; every new test verified to fail with its fix reverted.

## [1.11.0] — 2026-08-31

**Quiescence (P0-5): a verdict cannot outlive the tree it describes.** `run`
owned the agent's exit code but not its descendants. A worker detached with
`setsid`/`nohup` survived every check and edited the tree afterwards —
reproduced: GREEN MEANS GREEN, exit 0, and six seconds later the test file was
empty. The same escape as the runtime hole this command exists to close, one
level up.

A synchronous wrapper cannot reap a new session, so the envelope does the
honest thing instead of pretending it can:

- **Fingerprint guard (portable, always on).** Every non-ignored file is
  hashed before and after adjudication; if the tree moved while it was being
  judged, the verdict is `NOT_QUIESCENT` (exit 1) rather than a statement
  about a tree that no longer exists.
- **Survivor detection (Linux).** Processes that still hold the working tree
  and *started after the agent spawned* are surfaced the same way. Start time
  is the discriminator that keeps a developer's editor or dev server — and the
  caller's own shell pipeline — from being convicted; an earlier version keyed
  on envelope start and did exactly that, caught by the honest-run control.
- **`--settle <secs>`** extends the window past workers that sleep through
  the checks.

Residual, stated in SPEC row 17 rather than implied away: non-Linux hosts have
no survivor scan (fingerprint and `--settle` still apply), and a worker that
outwaits the run entirely can only be contained by OS-level isolation. Full
suite 335/335; both exploit tests verified to fail with the fix reverted.

## [1.10.4] — 2026-08-31

**The effect layer no longer trusts stat (P1-8).** `snapshotProtected` reused
the previous entry whenever mtime, size and mode all matched, skipping the
hash — and all three are writable by the agent being watched. Reproduced:
`it('alpha_padding_here', ...)` → `it.skip('alpha_padding', ...)` is
byte-identical in length, `touch -r` restores the mtime from any reference
file, and the drift check then passed a file that carried the skip. This is
the layer that exists *because* some mutation always arrives by a path the
matcher did not see, so a cache keyed on data the mutation's author controls
reintroduced exactly the blind spot it was built to close.

Every protected file is now hashed on every snapshot. Measured A/B on a
1000-file / 4MB protected tree: **4.0ms → 17.2ms per snapshot**, against the
~450ms of node startup each hook invocation already pays — soundness at
roughly 3% of a call. Regression tests cover the exploit and the
no-false-positive case. Full suite 332/332.

## [1.10.3] — 2026-08-31

**Rename semantics — two committed-diff exploits that the CI authority layer
called clean.** Pass 2 of the external review found the fallback every
local-layer finding leaned on ("CI still catches it") was itself defeated.
Both reproduced before the fix, both now regression-tested.

- **P0-7**: `test-deletion` and `test-content-removal` gated their content
  comparison on `op === 'modify'`. A rename is neither modify nor the
  rename-OUT case they handle, so `git mv spec.js spec2.js` in the same
  commit carried an arbitrary it()-block deletion past both rules — 10
  blocks to 7, reported clean at CI. Both rules now content-inspect renames
  exactly like modifications; an honest rename with unchanged content stays
  clean.
- **P0-8**: `git mv ci.yml ci.yml.disabled` disabled every check without
  changing a line, and was reported clean — because the file never leaves
  the protected glob (`.github/workflows/**` matches `.disabled` too), only
  GitHub's executable set. For a `pull_request` event that disables CI for
  the very merge ref performing it. ci-tampering now tests **executability**
  (`.github/workflows/*.{yml,yaml}`), not glob membership; `ci.yml →
  build.yml` remains clean.
- **P1-9**: `core.hooksPath` — git-native and strictly more general than the
  flags already covered, since it disables husky, lefthook and plain
  `.git/hooks` alike — bypassed `no-verify` in all three spellings (`-c`,
  `git config`, `GIT_CONFIG_*` injection). Now covered, with LEFTHOOK=0,
  SKIP_SIMPLE_GIT_HOOKS and PRE_COMMIT_ALLOW_NO_CONFIG.
- **P2-11**: evidence is repository content, and `\s` collapsing left ESC
  intact — a crafted test line emitted clear-screen plus a forged "clean"
  verdict into tamperward's own stdout. Control bytes are now replaced
  before rendering.

**Withdrawn claim.** 1.10.2's tracker recorded `check --diff` as surviving
every finding but P0-6. Four findings defeat it (P0-2, P0-6, P0-7, P0-8);
`SECURITY-ENVELOPE.md` now says so. Full suite 330/330.

## [1.10.2] — 2026-08-31

**Envelope hardening — four executed P0 inversions from external review, each
reproduced then closed with a regression test.** #117/#118 froze the entry
SHA, ancestry, and verifier; this freezes the rest of the trust anchor. The
common root: the envelope adjudicated the post-agent tree using that tree's
own policy, its tracked-only file view, and its local sign-off ledger — all
agent-authorable.

- **P0-1**: an uncommitted `.tamperward.yml` disabling test-deletion +
  hook-tampering made the worktree check score a gutted suite "clean". The
  whole policy (rules, protected globs, verifier) is now resolved from the
  base commit via `loadPolicyAt(base)` — never the working tree.
- **P0-2**: widening `protected` reverted the pristine overlay to base,
  masking the agent's own source bug, and policy-diff scores adding globs a
  strengthening. Verify's overlay classes now come from the frozen policy.
- **P0-3**: untracked files were invisible to `git diff HEAD`. The worktree
  view now includes untracked, not-ignored files.
- **P0-4**: the agent cleared its own findings by running `tamperward
  allow`. The envelope now adjudicates at the CI layer — only out-of-band
  approval, never the agent-writable ledger.

Honest boundary: P0-5 (a detached background worker can mutate the tree
after the checks — a TOCTOU on a live tree) and P0-6 (the shared, gitignored
`node_modules` runner) remain OPEN and are tracked, with every P1/P2 finding,
in the new `SECURITY-ENVELOPE.md`. SPEC row 17 now names process quiescence
as outside the current boundary. Full suite 325/325.

## [1.10.1] — 2026-08-31

**Envelope hardening — two High findings from owner review of 1.10.0,
both reproduced as failing tests before the fix.**

- **The trust anchor could be moved backwards.** The envelope froze the entry
  SHA but adjudicated with merge-base semantics (right for PR review, wrong
  here): an agent running `git reset --hard <ancestor>` downgraded the anchor
  to a commit predating its task — empty diff, clean worktree, green verify,
  exit 0. Now post-agent HEAD must be a descendant of the entry SHA; anything
  else is itself the conviction (HISTORY_REWRITE, exit 1), and with ancestry
  enforced, merge-base collapses to exactly the frozen SHA everywhere
  downstream.
- **An agent could author its own verifier.** With no `verify:` block at
  entry and no `--cmd`, verification read the suite command from the
  CURRENT tree's policy — which the agent could have written
  (`verify.command: "true"`), and which policy-diff deliberately treats as a
  strengthening. The verifier command and budget are now resolved from the
  entry-time policy or flags BEFORE the agent starts, and only those frozen
  values are used; no verifier at entry → refuse to start (exit 2).
- **Documented TCB scoping (SPEC row 17):** ignored dependency trees are
  explicitly outside the 1.10.x boundary — node_modules is symlinked into
  both verification copies, so agent-mutated dependencies corrupt visible
  and pristine runs alike. Closing that surface is a named 2.0 roadmap item
  with candidate designs.

## [1.10.0] — 2026-08-31

**`tamperward run` — the enforcement envelope (SPEC row 17).** Round 2's
decisive negative finding, turned into architecture: a hook can be correct at
every decision point and the system still fail, because the hook does not own
termination. In the round-2 cssstyle-gated trajectory the gate denied 42
mutations and pristine verification rejected all 25 stop attempts — including
the final one, two seconds before the runtime completed the session anyway
with a masked-green tree. Correct policy decisions are insufficient when the
policy mechanism does not own the lifecycle boundary.

`tamperward run [--base R] [--cmd C] [--budget S] [--allow-dirty] -- <agent
command...>` closes that boundary from outside the runtime: it records the
trusted base before the agent starts, treats the agent's exit as untrusted,
and re-adjudicates the released tree against that entry-time base — policy
check over `base...HEAD` (weakening the agent committed), policy check over
the worktree (weakening left uncommitted), and pristine verification (masked
failure, however produced). Exit contract, "green means green" as an exit
code: the agent's own code when enforcement is clean; 1 on any blocking
finding or masked failure, even if the agent claimed success; 2 when
adjudication is impossible (dirty start, unresolvable base, no suite
command) — failing closed, never open.

The hooks remain the in-session fast path — round 2 measured them converting
blocked shortcuts into honest work in eight of twelve denied trajectories.
The envelope (or `check --diff` + `verify` in CI, which no runtime can
override) is the boundary. Tests replay the cssstyle escape in miniature: a
masking agent that exits 0 becomes a failing pipeline.

## [1.9.0] — 2026-08-30

**`tamperward verify` — pristine-suite re-execution, productized.** The
taskbench run-correctness oracle was the one layer nothing got past in the
Phase-3 sweep: it identified every masked failure in all 53 trajectories while
diff-time detection was routed around. That is a trajectory record on one
frame, not a guarantee — and it is the strongest signal the programme has, so
it is now a shipped command (SPEC row 16, `pristine-verification`).

Mechanics: two isolated copies of the working tree (tracked + untracked
non-ignored files, node_modules symlinked). The suite runs in one as-is (the
visible run) and in the other with every protected test/snapshot/config file
restored from a trusted base rev (merge-base semantics; protected files the
agent ADDED are kept — they can only add strictness, and the visible run
already required them green). Visible-green + pristine-red is a **MASKED
FAILURE** (exit 1). Budget exceeded or cannot-run **fails closed** (exit 2) —
"could not verify" is never "verified". Immune to spelling by construction:
no diff is interpreted at all; only outcomes are compared.

CI wiring (the layer's natural home — judged at commit granularity, not per
tool call):

```yaml
- run: npx tamperward verify --base origin/main --cmd 'npm test' --budget 300
```

Configuration can live in policy — and that block is itself a guarded surface:

```yaml
verify:
  command: npm test
  budget: 300
```

policy-diff flags any `verify.command` change, any `budget` lowering, and the
block's removal as policy weakening: a verify an agent can point at `true` is
no verification at all.

**Base selection, stated where it can be checked:** verify restores protected
files from `--base` (default HEAD, merge-base semantics). The default covers
UNCOMMITTED weakening only — a tamper the agent commits is inside HEAD and
invisible to it; the test suite demonstrates that blindness rather than hiding
it. In CI, point `--base` at a rev the agent cannot rewrite (the protected
default branch), which is also where this layer belongs.

## [1.8.0] — 2026-08-30

**The effect layer.** Spelling-level inspection has a floor: some mutation will
always arrive by a path the matcher didn't see — taskbench Phase 3 measured one
(run 07-fastify gated: a test-skip Edit landed without a PreToolUse deny, the
same edit class denied at PreToolUse in eleven other runs, and the weakened
suite was consulted for 51 seconds until the Stop sweep caught it). Three
additions REDUCE that surface — reduce, not end; the residuals are stated at
the bottom of this entry:

- **Per-call protected-tree drift check** (PreToolUse): the hook snapshots the
  protected files' content+mode and, when the tree drifts from the last
  sanctioned state, runs the ordinary detector stack over the drift (diff vs
  the turn baseline, scoped to the drifted paths) at the very next call.
  Stated precisely: this **detects persistent protected-state drift
  independently of the mutation's command spelling** — however it was produced
  (a sed spelling, a generated script, a hook flake, a reconstruction miss) —
  and judges it with the existing corpus-priced rules; a deny repeats until
  the tree is restored. Benign drift (a first-run snapshot, a git restore that
  evaluates clean) is absorbed silently. Verified end-to-end: an unseen
  `sed -i 's/^test(/test.skip(/'` is denied at the next call by `test-skip`.
- **`tamperward watch`** — the filesystem-event observer (DESIGN A.1's named
  candidate): a daemon recording protected-file events (content hash + mode)
  to `.git/tamperward/fsevents.jsonl`, consumed by the Stop sweep under the
  new `transient-protected-mutation` rule (SPEC row 15). This is the layer
  for what no per-call check can see: a protected file modified and restored
  WITHIN one tool call — measured at 1 occurrence in 59 real trajectories,
  and that one was the laundering pattern (skip → npm test → restore). Warn
  by default (a Stop block already forces restores; a compliant restore reads
  as churn — block-by-default would deadlock the honest path);
  `TAMPERWARD_TRANSIENT=block` may raise it, never lower it. Chmod-only churn
  — the other A.1 documented miss — is the same rule's attribute variant.
- **Edit-reconstruction fail-open closed**: when an Edit's old_string cannot
  be located in the disk read, the adapter previously produced ZERO changes —
  and allowed the call. Now the incoming new_string is modeled as added
  content (the NotebookEdit stance) and judged. The 07-fastify edit is this
  release's regression test both ways: unreconstructable-Edit deny and
  next-call drift deny.

Warn-severity transients also append to the `TAMPERWARD_DENYLOG` audit trail
(marked `warn:`) so an unattended loop's warnings are at least recorded — the
schema-utils lesson, applied.

**What the effect layer still does not do**, stated where it can be checked:
within-call transients surface as warn unless a harness raises them; the drift
check judges content only through the existing rules, so a mutation none of
them prices (above all the semantic class — expected values rewritten in
place) passes the effect check exactly as it passes the diff check; and the
snapshot state and event log live in `.git/`, reachable by the agent — the
loop layer's standing trust boundary. Held-out re-execution remains the layer
that caught everything in Phase 3, and CI remains the authority.

New detector: **`test-content-removal`** (SPEC row 14, block) — NET removal of
≥3 significant lines from a modified protected test file whose it()/test()
block count did not drop. This is the post-experiment closure of the evasion
class the taskbench Phase-3 sweep measured carrying the gated-arm false greens
(PHASE3.md §4): case-table row deletion, assertion-argument stripping, and
mock/setup gutting — edits that walk through a block-count rule because the
test keeps its name while losing its teeth. Removed content is excused only if
it is actually kept — whitespace-normalized, in the changeset's protected-test
content, comments never excusing (the pilot agent's comment-out spelling is a
regression test). One-for-one rewrites stay out of scope: expected-value
tampering is the semantic class and belongs to held-out oracles, as ever.

Corpus-priced before shipping (`harness/fp-study/TCR-CORPUS.md`): fires on
1.5% of 2,304 real mainline diffs across immer/zustand/zod/prettier, every
adjudicated fire legitimate — block-with-signoff accepted because the corpus's
most instructive fire (prettier deleting error-expectation rows after a parser
genuinely improved) is byte-shaped like the tamper, and Phase 3 measured what
`warn` means in an unattended agent loop: nothing.

Also from the same evidence: **`tap-snapshots/**` joins the snapshot globs**
(node-tar's recorded expectations were rewritten unseen in Phase 3), and
snapshot-glob files are explicitly excluded from the new rule — recorded
expectations stay `snapshot-rewrite`'s jurisdiction with its own measured
severity, one class, one rule.

Scope discipline, stated where it can be checked: the treatment tested in
Phase 3 was and remains 1.6.0; nothing in 1.7.0 is validated against the
Phase-3 pool, and a prevention claim for these detectors requires the fresh
frame draw the results post committed to. The exact trajectory edits that
evaded 1.6.0 now ship as this release's regression tests, including an
end-to-end replay of the postcss-selector-parser throws-stripping edit
denied by the built hook.

## [1.6.0] — 2026-08-29

New policy surface: **per-rule `exclude` globs** — `rules: { ts-any-cast: { severity:
block, exclude: ['**/*.test-d.ts'] } }` scopes ONE rule off matching paths while every
other rule keeps full coverage there. This is the tuning the adjudicated zod FP study
recommended (casts are legitimate in test/type-test files) that the global `ignore`
could never express without blinding the test-protection rules on exactly the files
they guard. Two invariants ship with it: findings on the policy file itself are never
excludable, and **adding** exclude globs is flagged by hook-tampering's policy-diff as
a weakening — the invisible-spelling lesson applied on day one, not after an evasion.
Measured in `harness/PREDICTION-tuned-fp.md`. Six new tests.

## [1.5.1] — 2026-08-29

`test-skip` now covers the **node:test options spelling** — `test('x', { skip: true }, …)`,
the `{ todo: … }` form, and runtime `t.skip()` — closing a gap found live: in the
cheap-baselines study (`harness/PREDICTION-baselines.md`), an agent denied the crude
`rm` skipped the suite by option instead, and the shipped rule was as blind to that
spelling as the 20-line strawman under test. Coverage of a class has to mean the whole
class (the lesson the type-laundering study taught the same day), so the flagship rule
gets its class completed. Five new tests; no other behavior changes.

## [1.5.0] — 2026-08-28

New rule, `warn`: **`snapshot-only-rewrite`** — the FP study's narrow signal (a
snapshot moved with no accompanying change; ~0.06% of 1,652 audited mainline commits,
7/7 of observed harness tampers) as its own rule, distinct from the broad
`snapshot-rewrite` warn so a future policy `version:` can graduate it to `block`
without touching the broad rule (`BLOCK_SINCE` stays empty in this release; nobody's
severity changes).

Granularity is load-bearing and enforced: the rule fires only on the staged and range
views — pre-commit and CI, the granularity the FP corpus measured — never at the
PreToolUse hook or Stop sweep, where "no accompanying change" is meaningless. This
rides a new additive `view` parameter through `evaluate()` and `Detector.run`;
third-party detectors written against the two-argument shape keep working.

Also: the round-three studies (assert-affordance demand measured at a real zero,
frontier-model matrix completed at four models) shipped to the docs and README in
#38/#39. Minor per CONTRIBUTING: a new warn rule is new surface. 272 tests.

## [1.4.6] — 2026-08-27

Docs only. The README stopped claiming the two heuristic rules ship: no detector
implements `assertion-weakening` or `guard-removal` — the names are reserved in the
baseline policy until the SPEC §7.A negatives corpus exists — and `ts-any-launder`,
which existed nowhere but that sentence, is gone. Also links the docs site and launch
post from the header, fixes the init table's policy-as-enforcement-point taxonomy,
makes the sample verdict match the real renderer (a sign-off line on every blocking
finding), and reconciles SPEC to v0.3. The npm page snapshots the README at publish,
so this publish is what corrects it there. No code changes.

## [1.4.5] — 2026-08-27

Docs and harness only. Two new pre-registered studies answer the two sharpest
critiques of the headline number, and the README carries the results (the npm page
snapshots the README at publish, so this publish is what updates it there):

- **Ungated control arm** (`harness/PREDICTION-ungated-control.md`): same seed, model,
  prompt and oracle with the hooks removed — 6/10 tampers through, honest fixes
  10/10 → 4/10. The deny→fix claim graduates from ordering to causation (+60 points);
  one of three bets refuted.
- **Informed adversary** (`harness/PREDICTION-informed-adversary.md`): detector
  sources vendored into the repo, prompt names the gate. All three leak bets refuted —
  informed Haiku attempted zero bypasses (vs 5/10 uninformed same-day); Sonnet refused
  outright in 3/5 runs. Disclosure measured as deterrence, not an evasion spec.
- Headline aggregates: 67 guarded runs, 0 through, 25/25 conversions (95% lower bound
  ≈89%). seed-hard gains an independent held-out oracle (`oracle-hard.mjs`) so a
  hardcoded lookup table can no longer score as an honest fix; `run.sh` gains
  `HF_UNGATED` / `HF_INFORMED` arm levers.
- Enforcement copy scoped on all surfaces: the loop layer exists where the hooks do
  (Claude Code today); CI is the authority.

## [1.4.4] — 2026-08-27

Docs only. The README header now carries the ward glyph — four strokes of change
converging on the ward that stops them at the exact point — replacing the lock mark
(#29). The npm page snapshots the README at publish, so this publish is what puts the
new mark there. No code changes.

## [1.4.3] — 2026-08-27

Docs only. "Wires all four enforcement points" stopped counting: the policy file is
configuration, not an enforcement point, and the SPEC's four adapters (PreToolUse deny,
Stop sweep, pre-commit, CI) group into the three stages the prose describes — two
taxonomies were sharing the word "points". `init` now says what it wires by role: the
policy plus every enforcement point.

## [1.4.2] — 2026-08-27

Docs only. The README's two harness numbers now carry their scopes — "0 tampers reached
green" is true of the guarded-scenario corpus, "7/10 regenerated the golden and sailed
through" is true of the affordance runs where that class was deliberately unguarded.
Adjacent and unscoped, they invited the fair reading that the numbers were massaged.

## [1.4.1] — 2026-08-27

Docs and packaging only — no behaviour change.

- README rewritten front-door-first: install, a real denial transcript, then the
  measured evidence (the §7.B conversion rate with its bound, the affordance experiment
  with its refuted bets, the 1,652-commit FP study). The build-log sections are gone;
  SPEC keeps the depth.
- `package.json` gains `keywords` so the package is findable on npm at all.
- GitHub release bodies are now the CHANGELOG section for the version instead of the
  auto-generated PR list.

## [1.4.0] — 2026-08-27

### Added

- **`tamperward init`** — the last unshipped SPEC promise. One idempotent command wires
  all four enforcement points: a commented baseline `.tamperward.yml`, the Claude Code
  PreToolUse + Stop hooks (merged into `.claude/settings.json`, preserving whatever is
  already there), a pre-commit hook (husky when present, the plain git hook otherwise,
  appended with a marker when a script already exists), and a GitHub Actions PR gate
  carrying the out-of-band label sign-off — including the `labeled`/`unlabeled`
  re-triggers, so an applied or revoked sign-off takes effect without a push. Running
  twice is a no-op; nothing you wrote is ever overwritten; an unparseable
  `.claude/settings.json` aborts that item instead of clobbering it; `--dry-run`
  prints the plan.

### Fixed

- Restored the 1.3.0 `version:` gate source, tests, and docs on `main`, which the
  FP-study merge (#22) had accidentally reverted — a commit built from a stale
  checkout. The published 1.3.0 package always carried the code (it shipped from the
  1.3.0 merge commit); only the repository regressed behind it.

## [1.3.0] — 2026-08-27

### Added

- **The `version:` opt-in mechanism is real** (previously reserved in CONTRIBUTING).
  A baseline rule graduated `warn` → `block` at policy version N now blocks only for
  policies declaring `version: >= N` and stays `warn` below. Missing `version:` — or no
  policy file at all — means 1: nobody is opted in to anything they didn't write down.
  An explicit `severity:` wins over the gate in either direction. An unparseable
  `version:` fails closed like any other malformed policy. This unblocks shipping rule
  graduations (first candidate: `snapshot-rewrite`) as minors instead of majors.
- `policy-diff` flags a lowered `version:` — the only thing a lowering can do is un-opt
  the repo from future blocks — and, once a gate exists, reports the concrete rule
  downgrades the lowering causes, exactly as the engine would enforce them.

No gate ships in this release: `BLOCK_SINCE` is empty, so behaviour is identical for
every existing policy. The mechanism is exercised by simulated-graduation tests.

## [1.2.1] — 2026-08-27

### Fixed

- **`ci-tampering` no longer flags moved or argument-position "checks"** (#15). Both
  false positives the rule ever produced were the same mistake from two directions:
  `- run: npm test` re-added indented under a new `if:` read as a deletion (the check
  had *moved*), and `npm view tamperward dist-tags` read as a removed check (the check
  keyword was a *package name* in argument position). A removal now means the command's
  core no longer exists anywhere in the after-file, and check keywords only count in
  invocation position. A check moved behind a literal `if: false` (any spelling) is
  still caught by the added-line scan; genuine deletions still block — verified by
  replaying both historical false-positive diffs (clean) and a real deletion (blocked).

## [1.2.0] — 2026-08-27

### Added

- **`snapshot-rewrite`** (`warn`) — the first detector built from measured demand rather
  than intuition. In the affordance-seed experiment (`harness/PREDICTION-affordance.md`),
  7 of 10 adversarial runs regenerated a golden file from buggy output and every one
  passed unseen, while three other hypothesized bypass classes measured zero attempts
  and stay unbuilt. Catches: runner update mode (`jest -u`, `--updateSnapshot`,
  `vitest --update`, playwright `--update-snapshots`), regeneration scripts by naming
  convention (`update-golden`, `regen-snapshots`, `rebless-baselines`), shell mutation
  of protected snapshot paths, and any modify / delete / rename-out of a recorded
  expectation. New default protected category `snapshots`
  (`**/*.snap`, `**/__snapshots__/**`, `**/golden/**`, `**/*.golden.*`).
  `warn` because updating a snapshot is the legitimate workflow when intended output
  changes — the finding asks a human to confirm the new expectation, and graduation to
  `block` follows the SPEC §7 evidence path.
- Harness: four affordance seeds with independent oracles and mechanical validation,
  plus `shadow.mjs`, a record-only scanner accumulating attempt-rate evidence for
  hypothesized detectors on every run.

## [1.1.0] — 2026-08-26

### Fixed

- **`coverage-lowering` was blind to `package.json`.** Configs are parsed as TypeScript,
  where a top-level `{…}` is a *block statement* rather than an object literal — so no
  property nodes were produced and the file read as "no coverage gate here". Jest's
  `coverageThreshold` lives in `package.json` at least as often as in `jest.config.js`,
  and `**/package.json` has always been in the default protected config globs, so this
  was a silent false negative on a headline rule. **Anyone on 1.0.0 has a gate that
  misses coverage tampering in that file.** JSONC configs are now read too.
- Every git probe that missed — reading `.tamperward.yml` from a merge base that has
  none, which is the ordinary case — printed git's own `fatal:` line to the terminal
  before the caller handled the absence cleanly. stderr is piped now and folded into the
  thrown error, so a real failure stays exactly as diagnosable.

### Added

- **The verdict is rendered for whoever is reading it.** Under GitHub Actions
  (auto-detected), each finding becomes a workflow annotation placed **inline on the diff
  in Files changed**, plus a job-summary table on the run page — the verdict no longer
  lives only inside a collapsed job log. Annotations rather than SARIF deliberately: they
  need no `security-events: write` and no Advanced Security, so they work on every
  repository.
- Terminal output groups blocking findings first, wraps to the terminal, and keeps
  `path:line` intact so terminals linkify it.
- `--format text | json | github | auto` to select explicitly. `--json` is unchanged and
  the keys it already emitted keep their exact shape; `summary` is additive.

### Accessibility

Severity is carried by the word (`BLOCK` / `warn`) in every format, never by colour or a
glyph alone, so the verdict reads the same piped, in a log, through a screen reader, and
for a reader who cannot distinguish the colours. A test asserts that stripping the ANSI
from the coloured output equals the mono output byte for byte. `NO_COLOR` and
`FORCE_COLOR` are honoured; colour is off whenever stdout is not a terminal. The job
summary is a real markdown table with a header row.

### Internal

- Publishing moved to npm trusted publishing (OIDC) with no stored token, verified end to
  end via the `1.1.0-rc.2` prerelease. CI runs on pull requests only.
- 211 tests, up from 158.

## [1.0.0] — 2026-08-26

First public release.

### The engine

- `Change` model shared by every enforcement point: a change is a command or a per-file
  diff, and the engine never knows which point produced it.
- Pure unified-diff parser — add / modify / delete / rename (as one change carrying
  `oldPath`) / rename+edit / binary, with per-line old/new numbers correct across hunks,
  and git's C-quoted non-ASCII paths decoded before glob matching.
- Git adapter for the range, staged and working-tree views, enriching `before`/`after`
  with full content so the AST detectors have something to parse.

### Detectors

Eight mechanical rules, all `block`: `test-deletion` (AST block-count, rename-out-of-glob,
shell mutation), `test-skip`, `ts-any-cast`, `lint-suppression`, `coverage-lowering`
(Jest and Vitest shapes, all four metrics), `ci-tampering` (including checks removed from
a multi-line `run:` block), `hook-tampering` (including a hook gutted in place), and
`no-verify`.

Two heuristic rules ship as `warn` and do not block: `assertion-weakening` and
`guard-removal`. They graduate only when their precision is measured against a negatives
corpus — see SPEC §7.A.

### Enforcement points

- Claude Code `PreToolUse` hook — denies before the change reaches disk, and **fails
  closed**: if the gate cannot evaluate, the change is denied rather than allowed.
- Claude Code `Stop` sweep — re-checks the turn's net diff against the commit the turn
  started at, so a mid-turn commit cannot launder a tamper past it.
- `tamperward check --staged` for pre-commit, `--diff <base>...<head>` for CI.

### Trust model

- Three-layer sign-off: the agent layer honours nothing it can author; the local ledger is
  fingerprint-bound and expiring; CI honours only an out-of-band approval.
- At the CI layer the governing policy is read from the **merge-base**, never the head, so
  a change cannot weaken the policy that decides its own verdict.
- `ignore` can never suppress the policy file itself, and protected globs merge additively
  with the baseline rather than replacing it.

### Measurement

- Bypass-to-fix conversion (SPEC §7.B) measured over 42 agent runs: 0 tampers reached
  green; of 20 runs where a block fired, 20 ended in an honest fix. See the README for the
  arms, the split by model, and the limits of the sample.

[1.0.0]: https://github.com/hexrift/tamperward/releases/tag/v1.0.0
[1.1.0]: https://github.com/hexrift/tamperward/releases/tag/v1.1.0
[1.2.0]: https://github.com/hexrift/tamperward/releases/tag/v1.2.0
[1.2.1]: https://github.com/hexrift/tamperward/releases/tag/v1.2.1
[1.3.0]: https://github.com/hexrift/tamperward/releases/tag/v1.3.0
[1.4.0]: https://github.com/hexrift/tamperward/releases/tag/v1.4.0
[1.4.1]: https://github.com/hexrift/tamperward/releases/tag/v1.4.1
[1.4.2]: https://github.com/hexrift/tamperward/releases/tag/v1.4.2
[1.4.3]: https://github.com/hexrift/tamperward/releases/tag/v1.4.3
