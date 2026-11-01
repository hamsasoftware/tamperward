# Tamperward — Build Spec v0.11

> The deterministic agent-integrity gate. One ruleset, evaluated on the actual
> diff/commands as a verdict (not a probability), at every stage a change passes
> through — the agent loop, pre-commit, the run envelope, pristine verification,
> and protected CI authority.

**Implementation status:** TamperWard 2.52.x

**Current supported surface:** JavaScript/TypeScript · Python · Go · Rust · Ruby ·
JVM · PHP · .NET test/skip/suppression/config patterns; Claude Code hook + Stop
sweep; git pre-commit; protected CI; pristine visible/pristine re-execution;
`tamperward run` lifecycle ownership; optional transient observation; and
`tamperward doctor` installation/authority diagnostics; Linux-only advisory
`tamperward trace-verify` observed-input discovery; and versioned Draft 2020-12
machine-verdict schemas for `check`, `verify`, `run`, `doctor` and (from 2.23.0)
`research`; from 2.26.0 privacy-safe hook/Stop audit-v1 telemetry plus the non-authoritative
`tamperward stats` aggregate and separate GitHub evidence-store workflow; from 2.20.0 the measured `ts-cast-growth` assertion budget; from
2.23.0 the `tamperward research` paired-evaluation workflow over the `AgentAdapter`
contract (`docs/guide/research.md`); from 2.24.0 the measured `coverage-exclusion`
warn rule (row 19); from 2.25.0 the `test-support` warn rule (row 20), which
routes a helper, setup module or fixture under the `tests` globs out of the two
spec rules' block reach and into its own review prompt; and from 2.26.0 the
`config-weakening` warn rule reading tsconfig, eslint, biome and the runner's
setup modules (row 21). The twenty-one-row rule table remains the canonical
detector/enforcement taxonomy: nineteen mechanical rows ship, `assertion-weakening`
ships as a measured warning-only heuristic, and `guard-removal` remains reserved
and unbuilt.

v0.11 reconciles the spec with 2.26.0: `config-weakening` seated as row 21 — `tsconfig*`/eslint/biome and the runner's setup/selection config, protected in name only before, now read for strictness-flag loosening, hidden-source excludes, dropped/unreadable `extends`, disabled rules and delegated selection, with `test-deletion` gaining the twin reading for a runner config that delegates its selection to an unreviewed file (#447).

v0.11 reconciles the spec with 2.26.0: structured audit-v1 telemetry and
`tamperward stats` are explicitly measurement-only. The hook serialises an allowlisted
event shape with a one-way hashed session id, the GitHub-backed history lives on a
separate evidence branch written by an explicit workflow, and neither local audit
failure nor that branch can alter an enforcement verdict. This adds an observability
surface, not a detector/enforcement row.

v0.10 reconciles the spec with 2.25.0: `test-support` seated as row 20 — the spec
rules (`test-deletion`, `test-content-removal`) narrowed to files a shared
`isSpecShaped` predicate reads as an actual spec, with the files that only SERVE
one now judged by their own warn rule instead of the block rules that defined no
test of their own (#443).

**Historical revision note — v0.9 / TamperWard 2.23.x.** Reconciled the live
architecture narrative with the 2.23.x implementation. It does **not** rewrite
the historical research record below: earlier v0.x revision notes, taskbench
claims and old finding IDs remain dated evidence. The current security-residual
index lives in `SECURITY-ENVELOPE.md`; detailed pristine-verifier limits live in
`docs/THREAT-MODEL-pristine-run.md`.

**Historical revision note — v0.8 / TamperWard 1.15.0.** No new row: the
seventeen-row table (§4) had
outgrown its heading, the canonical policy example had not kept pace with
`defaultPolicy`, and §5.1 still described the hook's output contract as a plan when
it has shipped on the JSON channel since v0.2. This revision brings the counts, the
policy example, the hook and Stop contracts, the CI wiring (the generated workflow's
`check --diff` + `verify --require-ancestor` pair with SHA-bound labels) and the repo
layout into line with the code — the code did not move.

v0.7 reconciled the spec with 1.9.0: `tamperward verify` — the taskbench
run-correctness oracle productized as row 16 (`pristine-verification`). The
suite runs twice in separate copies of the working tree: as-is, and with every
protected test/snapshot/config file restored from a trusted base rev
(merge-base semantics; agent-added files are **removed** across both the
protected classes and a separate **verification surface** — the files a runner
auto-consults for collection, configuration and plugin loading — so the pristine
tree's discovery and configuration surface is exactly the base's. See 1.14.1 and
1.14.2; the surface list lags runner behaviour by construction and bounds the
class rather than eliminating it). Under the default `local` backend the copies are separate directories, not a
security boundary: both execute agent-controlled code unsandboxed and are
reported as `checkpointed-local` trust. From 2.11.0 an opt-in
`backend: container` runs frozen read-only materialisations inside a
digest-pinned verifier image with verifier-owned dependencies and no shared
agent HOME/temp/socket/dependency tree; boundary failure is
`CANNOT_VERIFY`/exit 2 with no local fallback. Visible-green/pristine-red is a
MASKED FAILURE; cannot-verify fails closed. The policy `verify:` block is itself a guarded surface —
policy-diff flags command changes, budget lowering, and removal as weakening.
Base-selection caveat, stated where it can be checked: verify against a rev
the agent cannot rewrite (a protected branch in CI); the default HEAD base
covers uncommitted weakening only, and the test suite demonstrates the
committed-weakening blindness rather than hiding it.

v0.6 reconciles the spec with 1.8.0 — the effect layer: a per-call protected-tree
drift check at PreToolUse that detects persistent protected-state drift
independently of the mutation's command spelling and judges it at the next call
by the ordinary rules (narrowing, not closing, the 07-fastify anomaly's class);
the `tamperward watch` filesystem-event observer with row 15
(`transient-protected-mutation`) consuming its log at the Stop sweep, observing
supported transient filesystem effects; and the
Edit-reconstruction fail-open closed (an unlocatable old_string is judged from its
incoming content, never silently allowed).
v0.5 reconciles the spec with 1.7.0: `test-content-removal` seated as row 14 —
the post-experiment closure of the evasion class taskbench measured carrying the
gated-arm false greens (net content removal from a surviving spec), corpus-priced
at 1.5% of mainline diffs and shipped block-with-signoff; `tap-snapshots/**`
added to the snapshot globs from the same evidence. The treatment tested in
Phase 3 remains 1.6.0, frozen and published; nothing in 1.7.0 is validated
against the Phase-3 pool — a v2 claim requires a fresh frame draw (§7.B).
v0.4 reconciled the spec with what shipped through 1.6.0: `test-skip`'s class
completed with the node:test options spelling (1.5.1), the per-rule `exclude` policy
surface with its weakening symmetry (1.6.0), `ts-any-launder` given the table row it
always deserved with its graduation question now closed by corpus, and §7.B extended
with the studies that closed it — baselines, the tuned-FP trio, the laundering
corpus, and the capability-restriction comparison. v0.3 reconciled with 1.4.5; v0.2
was v0.1 plus four fixes found while verifying the `PreToolUse` schema against
current docs: the Bash-as-file-mutation hole (→ Stop sweep), out-of-band CI sign-off,
AST for the structure detectors, and the expected-value-tampering move.

---

## 0. What this slice has to prove

Two assertions have to become true or false here:

1. **Determinism** — the moves agents use to game checks can be detected from the
   diff/command as a verdict, at an acceptably low false-positive rate.
2. **The correction loop** — when the agent layer denies a shortcut, the returned
   message redirects the agent to fix the *real* failure rather than hunt for another
   bypass.

Nineteen of the twenty-one specified rows are mechanical and all nineteen ship. Of the
two heuristic rows, `assertion-weakening` now ships warn-only against a committed
precision corpus while `guard-removal` remains unbuilt (§4). #2 —
whether a denied agent fixes the truth or fights the gate — is the harder question. The
metric that quantifies it is the **bypass-to-fix conversion rate** (§7.B); see the
README for the measured result, now including its no-gate control arm.

---

## 1. Scope & non-goals

**Historical v0.1 scope:** The first slice was one TS + Jest stack, one Claude Code
agent, four enforcement adapters (PreToolUse, Stop, pre-commit and CI), a fixture
corpus and an end-to-end proof harness. That description is retained here as history,
not as the complete shipped surface.

**Current supported surface:** the shipped policy covers JavaScript/TypeScript plus
the supported Python, Go, Rust, Ruby, JVM, PHP and .NET test/config patterns. The
CLI and integrations now include Claude hooks and Stop, pre-commit, CI, worktree,
run, research, doctor, onboard, hook-service and trace-verify surfaces.

**Still out:** a dashboard, multi-agent coordination, general cross-repository policy
administration beyond the operator-pinned floor, and a live-qualified second in-loop
runtime. Measurement-only audit persistence on a separate evidence branch and the
opt-in organisation policy floor have shipped; neither establishes protected CI
authority by itself. Of the schema
fields this section once merely anticipated, the `version` graduation gate has since
shipped (1.3.0 — §3's comment block is now a description, not a reservation); rule
namespacing remains reserved.
rule namespacing remains reserved.

---

## 2. Architecture — one engine, original adapters plus CLI surfaces

The whole design is one normalization. Every enforcement point produces the same
intermediate object; the engine does not know which point it runs at — with one narrow,
additive exception: adapters pass a `view` (the diff's granularity), and a rule whose
SIGNAL is only valid at a given granularity may consult it (only `snapshot-only-rewrite`
does — "no accompanying change" means nothing at single-tool-call scope). Every other
rule fires identically everywhere; that remains the "block the class" promise.

```
                 ┌─────────────── adapters (thin) ───────────────┐
 Claude PreTool ─▶│ hook claude    (tool_input → Change[])         │
 Claude Stop    ─▶│ sweep claude   (net working-tree diff → Change[])│ ─▶ Change[] ─▶ engine ─▶ Finding[]
 git staged     ─▶│ check --staged (staged diff → Change[])        │
 CI / PR         ─▶│ check --diff   (range diff → Change[])         │
                 └───────────────────────────────────────────────┘
                                                          engine = run enabled
                                                          Detectors over Change[]
```

**The core abstraction** — a `Change` is either a command or a per-file diff. The
adapters' only job is to manufacture `Change[]`; see `src/types.ts`.

```ts
type Change =
  | { kind: 'command'; raw: string; argv: string[] }
  | { kind: 'file'; path: string; oldPath: string | null;
      op: 'add'|'modify'|'delete'|'rename';
      before: string | null; after: string | null;
      binary: boolean; hunks: Hunk[] }

interface Detector {
  id: string;
  surface: ('command'|'file')[];
  certainty: 'mechanical' | 'heuristic';
  run(changes: Change[], policy: Policy, view?: View): Finding[];  // view: additive, most rules ignore it
}
```

- **Claude PreToolUse hook** — `Edit`/`Write` give `old_string`/`new_string` (or full
  content) → synthesize a file `Change` *before it's written*. `Bash` gives `command`
  → a command `Change`. The magic property: the change is evaluated before it exists
  on disk.
- **Claude Stop sweep** — closes the hole the PreToolUse matcher can't see (§5.2).
- **Pre-commit** — `git diff --cached` → file `Change[]`.
- **CI** — `git diff origin/main...HEAD` → file `Change[]`. The authority; the others
  are speed/UX.

A rename is modeled as **one `Change` carrying `oldPath`**, not add+delete, so a
detector can ask "was a protected file renamed *out* of its glob?" — which git would
otherwise hide behind rename detection. Per-line `oldLine`/`newLine` numbers are
computed in the parser and are the only thing every `Finding.line` can trust.

One engine means a rule written once fires identically everywhere. That's not a
nicety — it *is* the "block the class, not the flag" promise.

**A rule that cannot run is not a rule that passed.** The engine isolates each
detector, and a detector that throws is reported as a blocking `detector-error`
finding naming the rule — at **every** view, the agent-facing `tool-call` and `turn`
included (2.23.14, #444; until then only the staged, worktree and range views carried
it, so content that made a detector throw was denied at pre-commit and allowed at
PreToolUse and Stop). `detector-error` is not a policy rule: it cannot be disabled,
lowered or excluded by the file under evaluation. And the crash the issue exhibited is
not reachable from content any more: every `ts.createSourceFile` in the detectors goes
through one guarded entry (`parseSource`, `src/ts-lazy.ts`) with a 4 MiB byte ceiling
and a 256-level bracket-nesting ceiling that **declines** — the rule's line-level
matcher judges the file instead, as it does for a diff-only change — rather than
overflowing the stack; a `RangeError` the parser still raises is declined the same way.

---

## 3. The rule schema

Two files. A **policy** (`.tamperward.yml`, user-facing, in the repo) and a **Finding**
(engine output, also the hook's wire format). Detectors are TS functions in the
open-core package — the open "rule format" is the policy schema + the `Detector`
interface, so third parties add detectors without forking.

**`.tamperward.yml`** (written by `tamperward init`, which wires the policy plus every
enforcement point — agent hooks, pre-commit, CI — idempotently, never overwriting
yours):

```yaml
# version gates rule GRADUATIONS: a baseline rule promoted warn -> block at policy
# version N blocks only for policies declaring version >= N, and stays warn below.
# Missing version (or no policy file) = 1: opted in to nothing. An explicit severity
# written here wins over the gate in either direction. Lowering version is itself a
# policy-diff finding. This is what lets a graduation ship in a minor (CONTRIBUTING).
version: 1
protected:                         # the safety nets, as first-class assets
  # abbreviated — the baseline (src/policy.ts defaultPolicy) also carries the other
  # JS/TS test extensions and the conventional Python/Go/Rust/Ruby/JVM/PHP/C# layouts,
  # and the pre-commit / Claude settings / CODEOWNERS wiring under hooks. User globs
  # MERGE onto the baseline per category; a category can only grow — and growth is
  # judged by what it does to the rules' reach (a snapshots glob over the specs, a
  # negated glob) not by the list alone. Negated globs (`!x`) fail the load.
  tests:     ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**']
  config:    ['**/jest.config.*', '**/vitest.config.*', '**/tsconfig*.json', '**/.eslintrc*', '**/eslint.config.*', '**/package.json']
  ci:        ['.github/workflows/**']
  snapshots: ['**/*.snap', '**/__snapshots__/**', '**/tap-snapshots/**', '**/golden/**', '**/*.golden.*']
  hooks:     ['.husky/**', '**/lefthook.*', '**/lefthook-local.*', '.tamperward.yml', '.claude/settings.json', '**/.pre-commit-config.yaml', '.github/CODEOWNERS']
rules:
  test-deletion:         { severity: block }   # AST
  test-content-removal:  { severity: block }   # content gutted from a surviving spec (§4 row 14)
  test-skip:             { severity: block }
  assertion-weakening:   { severity: warn  }   # measured JS/TS AST heuristic; warn-only (§4)
  ts-any-cast:           { severity: block }
  ts-any-launder:        { severity: warn  }   # permanent warn — graduation closed by corpus (§4 row 13)
  ts-cast-growth:        { severity: warn  }   # assertion budget — block closed by corpus (§4 row 18)
  lint-suppression:      { severity: block }
  coverage-lowering:     { severity: block }
  coverage-exclusion:    { severity: warn  }   # inline exclusions — warn by corpus (§4 row 19)
  test-support:          { severity: warn  }   # helpers/fixtures under the tests globs — no test of their own (§4 row 20)
  config-weakening:      { severity: warn  }   # tsconfig/eslint/biome/runner-setup — warn by corpus (§4 row 21)
  ci-tampering:          { severity: block }
  hook-tampering:        { severity: block }
  no-verify:             { severity: block }
  snapshot-rewrite:      { severity: warn  }   # mechanical but intent-ambiguous — FP study
  snapshot-only-rewrite: { severity: warn  }   # the FP study's narrow signal — graduation candidate
  transient-protected-mutation: { severity: warn }  # the watcher's class (row 15); TAMPERWARD_TRANSIENT=block may raise it
  guard-removal:         { severity: warn  }   # heuristic — RESERVED, not yet built (§4)
ignore: []                         # reported, never silent; can never cover this file
signoff:
  required_for: [block]
  # LOCAL ONLY. In CI, sign-off is out-of-band (§5.4) — never this file.
  ledger: .tamperward/ledger.jsonl
```

**Per-rule `exclude` globs** (1.6.0): any rule may carry
`exclude: ['**/*.test-d.ts', …]` to scope *that rule alone* off matching paths while
every other rule keeps full coverage there — the tuning the global `ignore` list
could never express without blinding the test-protection rules on exactly the files
they guard. Two invariants are part of the schema's meaning, not implementation
detail: **findings on the policy file itself are never excludable**, and **adding an
exclude glob is itself a policy-weakening signal** flagged by `hook-tampering`'s
policy-diff — the invisible-spelling lesson applied the day the surface was born. A
disclosure ships with the feature: on the two-repo FP corpus it was built against
(`harness/PREDICTION-tuned-fp.md`), the recommended test-path scoping of
`ts-any-cast` measured **zero effect** — those repos' casts live in library source.
FP tuning is repo-shaped; the feature's value claim is scoped to repos whose fires
cluster in scopeable paths (the adjudicated zod class), and the null is published
next to the bet that predicted otherwise.

**The loader is strict.** An unknown top-level key (`Rules:`, `ignored:`) fails the
load like an unknown value does — a policy that silently said nothing is the "weaker
gate than written" case the loader exists to refuse; rule *names* under `rules:` stay
open so a policy written for a newer build loads on an older one. `signoff.ledger`
must be a relative path inside the repository (the local layer trusts that file, and
a path outside the repo is outside every view and every code-owner rule); moving it
is a policy-diff finding. A leading `/` on a `protected`, `ignore` or `exclude` glob
is dropped at load — every git view reports repo-relative paths, so `/e2e/**` and
`e2e/**` are one rule rather than a glob that matches nothing. A **negated glob** (`!x`)
in any `protected` category, in `ignore` or in a per-rule `exclude` fails the load
(2.23.9): picomatch compiles it to "every path but x", so `protected.tests: ['!zzz']`
made every source file a test file and `ignore: ['!keep']` switched detection off
everywhere; the lists are inclusions, and the message says to name the paths instead.

**Finding** — the verdict object and the hook's return payload (see `src/types.ts`):

```ts
interface Finding {
  rule: string;
  severity: 'block' | 'warn';
  file?: string; line?: number;
  message: string;       // what was detected, plainly
  evidence: string;      // the exact offending line/command
  remediation: string;   // what to do INSTEAD — this is the correction signal
  signoff: { required: boolean; command: string };
}
```

Severity has exactly two values on purpose — `block` and `warn`, no "info." A gate
with five severities is a dashboard pretending to be a gate. **Every `block`-severity
rule is 100% mechanical**; heuristics may only ever be `warn` until measured (§7).

---

## 4. The twenty-one rows — nineteen mechanical, one measured heuristic, one reserved

Surface · signal · and **certainty class**, because nineteen rows are mechanical, one
is the measured heuristic, and one is reserved. Rows 1–15 and 18–21 are policy rule
ids (`src/policy.ts` `defaultPolicy`); rows 16 and 17 are the outcome and process
layers, which interpret no diff and carry no severity — their verdict is an exit code.
`assertion-weakening` (row 3) now ships as a measured **warn-only** JS/TS AST
heuristic. `guard-removal` (row 10) remains specified/reserved with no detector.

| # | id | Surface | Signal (TS/Jest concrete) | Certainty | Parser |
|---|----|---------|---------------------------|-----------|--------|
| 1 | `test-deletion` | file/cmd | test file `op: delete`; **rename out of the tests glob** (`git mv x.spec.ts x.spec.bak`), including into a `policy.ignore` path (a rename is suppressed only when both of its ends are ignored and the old path is not protected); **rename into a path the runner does not walk** while still inside the glob (2.23.4, #430) — the vitest/jest default exclude (`cypress/`, `node_modules/`, `dist/`, any `.*/` directory), pytest's default `norecursedirs` (`build/`, `dist/`, `venv/`, `.*/`), a Rust file under `tests/` deeper than `tests/<name>.rs` / `tests/<name>/main.rs`, a Go path with a `testdata`, `_*` or `.*` component — on the file and `mv` surfaces alike, and only when the old path was itself walked; net removal of `it()`/`test()` blocks in a modified spec (a literal `it.each` table counts one per row; a test moved into another spec in the same change is a relocation);`rm`/`unlink`/`shred`/`sed  -i`/`truncate`/`> `/`cp/dev/null`/`tee`/`sponge`/`dd of=`/`find  -delete`/`git checkout <rev> [--] <path>` of a protected-tests path, a directory holding one, or the whole cwd (`.`, `*`, a `..`-relative token resolved against the cwd);a `cp`/`install`/`rsync`/`ln`/`mv` whose DESTINATION is a spec and whose source is not (2.24.5, #432: `mv src/junk.ts test/a.test.ts` overwrites the spec, the `cp` twin); `… \| xargs rm` (`unlink`, `shred`, `truncate`, `mv`, `tee`, `sponge`, `sed -i`) over a spec named in the segment feeding it — the same reading `hook-tampering` gives a hook. The path is the word the shell hands the command (`test/a.te""st.ts`, `test/a.te\st.ts`, `test/a.test.{ts}` are the spec) and a glob is expanded against the repository listing (`rm test/*.test.ts`, `rm test/a.tes?.ts`; without a listing a wildcard's literal part decides), and the command is the word in command position past `sudo`/`env`/`nice`/`time`/`command`/`exec`/a `VAR=` prefix, so `grep "rm " spec`, `grep truncate spec` and `node scripts/rm-cache.js spec` are reads; **the runner told not to open a spec** — jest `testPathIgnorePatterns`/`testMatch`/`testRegex`, vitest `test.exclude`/`test.include` — evaluated as the selection predicate over the repository's own specs (2.5.0); the rest of that predicate's dials — jest `roots`/`rootDir`/`modulePathIgnorePatterns`/`projects`, vitest `test.dir`, a `!` entry in `include`, `test.projects`, `vitest.workspace.*`, a `vite.config.*` carrying `test:` (multi-project configs compared as the UNION of their projects; `typecheck.*`/`benchmark.*` are other suites) — and the package.json test scripts read as check INVOCATIONS, before → after, the way row 7 reads a workflow line (2.23.11, #435): `test`, `test:ci`, `check` and `pretest` are the suite, and a script that now runs no check or a check of another kind (`"test": "echo ok"`, `npm run lint`, `&& npm test` dropped from `check`, `pretest` deleted) is a removal; one whose status is masked (`\|\| true`, `; exit 0`, a pipe, `--passWithNoTests`, `--if-present`), cut short (`timeout 1`), whose coverage gate is dropped (nyc `--check-coverage` removed, a lowered `--cov-fail-under`) or whose suite is narrowed — a flag (`--testPathPattern`, `-t`, `--exclude`, `--dir`, `--project`, `--shard`, jest `--root`/`--rootDir`/`--testMatch`/`--testRegex`/`--modulePathIgnorePatterns`/`--selectProjects`, pytest `-k`/`-m`/`--deselect`/`--ignore`, mocha `--grep`/`-g`, `go test -run`, `cargo test -- --skip`, and row 7's per-runner table), a spec path as a positional (`vitest run src/easy.test.ts`), `--config <file>` pointing at a file the policy does not protect or one this change adds — is a neutralisation; `test:unit` / `test:integration` are slices whose flag or positional is design, read only for a masked status, a timeout or a replacement; a runner migration that keeps the suite (`jest` → `vitest run`, `mocha` → `vitest`), an env prefix (`cross-env`, `NODE_OPTIONS=`), a wrapper (`nyc`, `c8`, `nub exec`, `$(yarn bin jest)`), `python -m pytest`, a reporter flag, a flag that was there already, a further run added beside the kept one, the failing npm-init placeholder, and a check kind that moves into a script the same change adds are kept; a `describe.each` table multiplies the tests it encloses, and a relocation is held only by added blocks with a body (stubs hold nothing). Read the way the runner reads it (2.7.1, the pass-3d sweep): `it.for` / `describe.for` count like `each`, a test inside a loop over a literal array counts once per element and any other loop is open; `--exclude` of another runner's directory (`e2e/**`) is set-up; a project with `extends: true` inherits the root selection, while `extends: '<path>'`, `mergeConfig` over an imported base and a `...base` spread are opaque, and `test.root` rebases like `test.dir`; a `.snap` inside `__tests__/` is row 11's file, on the file and command surfaces alike; `git checkout <rev> -- <path>` where `<rev>` resolves to HEAD (`main` while on main) restores nothing older. From 2.24.4 (#431) the block count is a REACHABILITY count: an `it()`/`test()` is defined only where the runner reaches it — from the module top level or a `describe` callback — so a block wrapped in `if (false)` (any condition that folds to a constant: `0`, `""`, `null`, `!true`, `false && x`, `x && false`, `1 === 2`, the else of `if (true)`), written after an unconditional `return` / `throw` in the same block, or moved into a function declaration or variable-bound function literal that nothing live references is removed as surely as a deleted one; `if (process.env.CI)`, a helper called from a test, a hoisted function called before the `return`, an IIFE and a named callback passed to `describe` stay counted. pytest is read the way it collects: a `def test_*` inside a class counts only when every enclosing class is `Test*` or a `TestCase` subclass, so `class TestMath` → `class MathTests` is a removal (`src/detectors/reachability.ts`); a modifier between the runner and the table method (`it.concurrent.each`, `test.skip.each`, `describe.only.for`, in any order) is unwrapped by the chain reader the three JS rules share (2.24.3, #429), so `it.each` → `it.concurrent.each` is the same block count and `it.concurrent.skip('x')` is one definition. **The protected runner config going opaque is itself a finding (2.25.0, #447):** `export { default } from './vitest.real'`, `module.exports = require('./jest.real')`, a `...base` spread, `mergeConfig(base, …)`, `extends`/`preset`, or a `projects` entry — when the target is a file this change adds or that no protected glob covers, the delegation is reported (naming the target and whether it was added or is simply unprotected) rather than silently read as empty; `testNamePattern` (and its per-runner spellings) is read as a further selection predicate alongside the file-level narrowings above. A delegation to an already-protected file stays silent — the selection moved, and the gate can still read where it moved to | mechanical | **AST** |
| 2 | `test-skip` | file | Added skip/focus semantics that reduce the executed test set: `.skip` / `.only` / `.todo`, x/f-prefixed tests, conditional runner modifiers, empty `.each([])`, node:test-style `{ skip: ... }` / `{ todo: ... }` / `{ only: ... }`, and runtime skip calls across the supported language spellings. For full parse-clean JS/TS BEFORE/AFTER changes, 2.17.1 adds a TypeScript-AST path that resolves multiline member chains, statically-computable bracket properties, known test-runner imports/destructured requires/simple aliases, and option objects by lexical symbol identity; shadowed names are not inherited, dynamic computed properties are not guessed, proven `false`/`0` shorthand options are clean, binding-only semantic changes can be attributed to the changed binding, and trivia-free structural BEFORE/AFTER identity suppresses formatting-only rewrites of pre-existing skip/focus semantics. Parse-recovery trees decline AST-only classification. Diff-only producers and non-JS ecosystems retain the established regex path. From 2.23.8 (#428) the AST claims a call only when its chain root is PROVEN: a runner (a known runner module's export, reached by name, by default import, through `import * as v` / `require(...)` namespaces, as `X.extend(...)` / `X.extend<T>(...)` of one, as an alias, or through a relative fixture module — `export const test = base.extend(...)`, `export { test } from`, `export *`, `module.exports` — whose content the change or the repository can hand it) or a non-runner (a parameter, a local function/class, a local declaration whose initialiser is none of those, a non-runner name from a known runner module); a root it cannot classify (a package it does not know, a fixture it cannot read) leaves that call to the regex, so the full-content and diff-only paths agree; `test.describe.skip` / `test.describe.only` count as the chain they are. From 2.24.3 (#429) a `.skip` / `.only` / `.todo` ANYWHERE in the chain before `.each` / `.for` is the marker — `describe.only.each(rows)`, `it.skip.each(rows)`, `it.concurrent.skip.each`, across physical lines — read by the chain reader shared with rows 1 and 3, and the outer call of a table chain (`X.each(rows)(...)`) is judged by its inner chain rather than left to the line matcher. Precision delta: pinned immer/zustand/zod/hono mainline history, 460 adjacent diffs, **0 newly introduced findings** on final detector head `47a4477625a54d653d49dfbaf5304095a24e23a1`, re-run for #428 over the same pinned heads (524 adjacent pairs, **0 newly introduced findings**); see `harness/fp-study/TEST-SKIP-AST-CORPUS.md`. Collection-time and configuration-time skips since 2.24.4 (#431): a Go `func TestMain(m *testing.M)` added without an `m.Run()` call (no test in the package runs) and ANY `//go:build` / `// +build` constraint added to a `_test.go` (the file leaves the default `go test ./...` run whatever the tag is called — `ignore` was the only spelling read before); a Rust `#[cfg(…)]` other than `cfg(test)` on a `mod` or beside `#[test]` in a protected test file (`#[cfg(all(test, feature = "never"))] mod tests` compiles the tests out; `#[cfg(unix)]` on a plain helper is not read); JUnit 5 `@EnabledIf…` / `@DisabledIf…` in any spelling (`@EnabledIfEnvironmentVariable(named = "NEVER", …)`, `@EnabledIfSystemProperty`, `@EnabledIf("method")`, `@DisabledIf`); RSpec `it 'x', if: false` / `unless: true` / `:if => false` (`if: ENV['SLOW']` is a real condition and passes). From 2.24.2 (#441) the Go row reaches `Skip`/`Skipf`/`SkipNow` on any receiver (`tb.Skip()`, a subtest's `tt`, testify's `s.T().Skip()`), not only `t`/`b`; and the pytest row reads the conftest hooks that narrow a suite or rewrite its verdict without a marker in any test — `def pytest_collection_modifyitems`, `def pytest_pycollect_makeitem`, `def pytest_runtest_makereport` (with a `rep.outcome = 'passed'`/`'skipped'` rewrite as its own hit), `add_marker(…mark.skip|skipif|xfail)`, and a skip marker bound to a name (`sk = pytest.mark.skip`) together with the `@sk` decorator that uses it, resolved against the AFTER file when the change carries it and against the added lines otherwise. A conftest that only registers fixtures, `pytest_addoption`, `pytest_configure`, a custom marker, or the hook name in a comment or string stays clean. | mechanical | **regex + AST** |
| 3 | `assertion-weakening` | file | JS/TS protected tests only, paired by literal suite/test ancestry. Warn when the AST proves a one-way weakening on the same subject: a positive exact/structural expectation whose static expected value proves truthy/defined becomes `toBeTruthy()`/`toBeDefined()`; a positive `toThrow(message|regexp)` becomes bare `toThrow()`; or an assertion is purely removed from a kept unambiguous test identity. Deliberately silent on literal→literal expected-value changes, negated specificity changes, renamed/ambiguous tests and unsupported chains. From 2.24.3 (#429) a block is paired through a modifier chain — `it.concurrent('adds')`, `test.sequential`, `describe.skip` — and a `describe.each(rows)('title', fn)` / `it.each(rows)('title', fn)` outer call is a block with that literal title as its identity (the shared chain reader of rows 1 and 2). Extension parsing is explicit for JS/JSX/TS/TSX/MTS/CTS. Precision replay beside the implementation: 20 adjudicated legitimate assertion-touching negatives from the earlier 2,304-diff OSS frame plus 12 mutation positives; 12 fires = 12 TP / 0 FP, **100% measured precision**, clearing the predeclared 90% build threshold. It nevertheless remains **warn-only**; any block graduation requires a separate independent-corpus/live-fire decision. See `harness/fp-study/AW-CORPUS.md`. | heuristic — **shipped warn** | **AST** |
| 4 | `ts-any-cast` | file | added `as any`, `as never` (assignable in the dangerous direction), the double cast through `unknown` / `never` / `{}` / `object` / `Object` (`(x as {}) as T` launders exactly as `x as unknown as T`), a local `type` alias of any of those keywords (`type A = any; x as A` is `as any`), `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, and the JSDoc `@type {any}` / `{*}` / `{?}` cast in a JS file (`: any` and generic-position `any` are `ts-any-launder`, row 13, warn; `as unknown` / `as {}` / `as object` alone are honest widenings/ordinary assertions, not row 4) | mechanical | regex + AST (the double cast is classified structurally from 2.20.0, so parentheses around the expression or the widening type do not evade it; from 2.24 the widening set covers `never` / `{}` / `object` / `Object` and local aliases resolve to their keyword, the `@ts-*` directives are counted live on the AST's comment ranges — outside strings, templates and regex, and a comment that merely mentions a directive is not one — and the JSDoc cast accepts `{*}` / `{?}`; the diff-only fallback parses each added line for the same, resolving aliases declared on the change's own added lines, so `(<unknown>raw) as T`, `x as never` and `type A = any; x as A` are the same block without full content, #440) |
| 5 | `lint-suppression` | file | added `eslint-disable[-next-line]`, `/* eslint-disable */`, `// prettier-ignore` (representative spellings; see `docs/guide/rules.md` for the full language-specific set) | mechanical | regex |
| 6 | `coverage-lowering` | file | `coverageThreshold` numbers reduced, moved or deleted; `--coverage` stripped from the test script, `--coverage=false`/`--coverageThreshold=` added; `passWithNoTests` as flag or config key; vitest `thresholds.autoUpdate`; the denominator narrowed (`collectCoverageFrom`/vitest `coverage.include` compared as the predicate over the repository's own source files — a respelling that measures the same files is silent; `coveragePathIgnorePatterns`/`coverage.exclude` grown, `.coveragerc` `[run] omit` grown, codecov `ignore:` grown); vitest `coverage.enabled: false`, `thresholds.perFile` dropped; `.coveragerc`/`pyproject.toml` `fail_under`, nyc thresholds (also under package.json `nyc`), codecov `target` (a number or `auto`, compared within its `project:`/`patch:` scope)/`threshold`/`project: off` (2.5.0). Never claims a removal it cannot see (a spread, an expression, a stricter one-metric override), and looks for a gate that MOVED to another config in the same change before reporting its old home deleted. Housekeeping exemptions (2.7.1): generated code and codegen output, migrations, `*.generated.*` / `*.gen.*` / `*.pb.*`, `*.e2e-spec.*`, Django's `manage.py` / `wsgi.py` / `asgi.py`, `__init__.py` and the `main.ts` entrypoint join tests, types and tooling in the benign list (`**/index.ts` stays reported); vitest `thresholds: { 100: true }` is every metric at 100; codecov `informational: true` is a gate switched off under `project:` only; `passWithNoTests` in a package whose directory holds no spec is not a dodge; **2.24.0 (#438)**: jest `collectCoverage: true → false` (top level or under package.json `jest`), vitest `coverage.all: true → false`, nyc `--check-coverage` dropped from a script, `--cov-fail-under` lowered or dropped wherever the line lives (a package.json script, `pytest.ini` / `pyproject.toml` `addopts`, a `tox.ini` command, a workflow step — the workflow reading is the one line-level check this rule applies outside `protected.config`), `setup.cfg` / `tox.ini` `[coverage:report] fail_under` lowered, removed or moved (the same key as `.coveragerc`, so a gate moved between the four files is a move); the benign file-suffix exemptions are read in the spelling of their list — a glob `*.md` is Markdown, but jest's `coveragePathIgnorePatterns` are regexes, where `.md` is "any character, m, d" and exempts `src/cmd.ts`, so only the anchored `\\.md$` / `\\.d\\.ts$` is benign there | mechanical | regex/JSON |
| 7 | `ci-tampering` | file | in `protected.ci`: removed/commented test/lint/typecheck step (a moved or in-place-edited check — a flag added, `npm test`→`npm run test`, `@v3`→`@v4` — is kept); a kept check whose block is neutralised (`set +e`, `exit 0`, `if false; then`, `shell: bash {0}`, `\|\| true`); `continue-on-error: true` and `if: false` in any spelling that folds to a constant — including the short-circuits `<ctx> && false` / `<ctx> || true`, which decide whatever the context holds — on the check's step or at the level of a job that runs a check; `on:` narrowed so the workflow no longer runs (`push`/`pull_request` removed, `paths-ignore: ['**']`, `paths:` no source file can match, `pull_request.types` without opened/synchronize, `branches:` without the default branch — resolved from `origin/HEAD`, main and master accepted alike when unknown) (2.5.0). Respelled is kept: `npm test` → `npm run test:ci` / `npx vitest run` (same kind of check), a check moved into a reusable workflow the same change adds; narrowed is reported: a spec path as a positional (`npm test -- test/a.test.ts`), `timeout N` wrapping the check — the invocation reading (`survives`, the neutralising suffixes, the narrowing tables, the positional) lives in `src/detectors/invocation.ts` and is the one row 1 applies to the package.json test scripts (2.23.11). Read the way the runner reads it (2.7.1): a `${{ }}` expression folds to its constant or reads as one token, and a flag valued by `matrix.*` / `strategy.*` / `inputs.*` (`--shard=${{ matrix.shard }}/4`, `--project=${{ matrix.project }}`) is the matrix, not a narrowing; `node --test`, `mocha`, `ava`, `biome ci`, `oxlint`, `tsgo`, `deno test`, `ruff check`, `mypy` are checks of their kind; a path positional narrows a test, not a lint over `src/`; a `cd dir &&` prefix places the check; `shell: bash -euo pipefail {0}` keeps fail-fast; a reporter or upload action (`*-reporter`, `*-results`, `upload-*`, codecov, coveralls) is not the check whose `continue-on-error` matters; `[master]` → `[main]` is a rename when the branch it now names exists, whatever a stale `origin/HEAD` says. Read per runner (2.23.10): a same-kind respelling that runs nothing is neutralised, not kept — `npm run tests --if-present`, `--prefix dir` / `-w pkg` / `--workspace=pkg` / pnpm `--filter`, jest/vitest `--shard` (literal) / `--root` / `--rootDir` / `--testMatch` / `--testRegex` / `--modulePathIgnorePatterns` / `--selectProjects` / `--grep`, pytest `-k` / `-m` / `--deselect` / `--ignore` / `-p no:<collector>` / a lowered `--cov-fail-under`, `cargo test -- --skip`, `go test -run`, mocha `--grep`; a `working-directory` (on the step or as `defaults.run`) pointing at a directory with no tracked code or manifest, and `actions/checkout` given a literal `with.ref`, are neutralisers; a check only survives in command position — a heredoc body, a folded scalar's continuation, an `echo` or a comment quoting it is not the check; `contains` / `startsWith` / `endsWith` / `fromJSON` / `format` / `join` / `toJSON` over constants fold in `if:`; an event with no `branches:` filter runs on every branch, so a filter added without the default branch narrows it, a `tags:`-only filter loses every branch, `!` entries apply in order (`[main, "!main"]` names nothing), and `paths-ignore` is read against the repository's source files as `paths` is. Since 2.25.2 the category reaches past the workflow files (issue #437): a composite action a workflow `uses:` (`.github/actions/**/action.y?ml`, `runs.using: composite`) gets the same removal/neutralisation pass over its `runs.steps`; the entry files of the other CI systems (`.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `azure-pipelines.yml`, `bitbucket-pipelines.yml`, `.travis.yml`) get the generic check-line pass — a check line removed or neutralised in place, read from `script:` / `command:` / `sh` / `bash` / `pwsh` lines as from `run:` — and none of the GitHub-shaped logic (`on:` triggers, `if:` folding, `continue-on-error`, `shell: … {0}`), whose keys mean other things there. A neutralising suffix the removed line already carried (a piped typecheck's redirect target renamed, a Travis `\|\| travis_terminate` line rewritten around the same `\|\|`) is a respelling, not a new neutraliser; a deleted entry file whose checks move to a workflow the same change adds is a migration, not a removal. | mechanical | regex/YAML |
| 8 | `hook-tampering` | file/cmd | edit/delete in `protected.hooks` (the `config` class is `coverage-lowering`'s jurisdiction, row 6); `chmod -x` on a hook; edit to `.tamperward.yml` lowering severities, disabling rules, lowering `version:`, **adding `ignore` or per-rule `exclude` globs** (every new policy surface that can weaken the gate is a policy-diff signal the release it ships, 1.6.0); **a protected-glob ADD judged by the rules' reach, not the list** (2.23.9, #434): a glob added to `protected.snapshots` (membership there lowers test-deletion, test-content-removal and assertion-weakening, which judge `tests && !snapshots`), a negated glob (`!x`, which picomatch compiles to every path) added to any protected category, a `tests` glob that also matches snapshot paths, and — in general — every rule whose jurisdiction is a category predicate (the spec rules, test-skip, the cast rules) evaluated over a probe listing (the repository's tracked files when the gate has them, always joined with the conventional spec, source and snapshot samples) before and after the edit, any path that leaves a rule's reach reported naming the path and the rule; the cast rules cede test files by design, so their loss is reported only when the same edit also takes a conventional source path (`src/index.ts`) out of reach — a new `tests` glob naming a real layout stays clean; the edit is judged under the policy in force BEFORE it, so the exclusion cannot be weaponised by the change that writes it; **the wiring `init` writes, compared by canonical shape rather than token presence**: a Claude settings gate entry — in the project file, its local override, the user file (`~/.claude/settings.json`, or `$CLAUDE_CONFIG_DIR/settings.json` when the environment relocates it) or managed settings, judged by path shape at the tool-call layer with backslashes as separators and symlinks resolved, a `.claude/settings*.json` at any depth being settings-shaped — must be exactly `{type: command, command: npx --yes tamperward@<ver> hook claude}` on a matcher covering every tool init lists (the matcher read as the runtime reads it: an exact list separated by `\|` or `,` with optional surrounding whitespace when every character is in `[A-Za-z0-9_ ,\|-]` — `Edit, Write` is the list `Edit\|Write`, as the runtime's own matcher table says (2.9.0; 2.7.0 read the comma as a regex and reported the honest list as selecting nothing) — otherwise an unanchored regex; a non-string, invalid or non-ASCII matcher fails closed), `sweep claude` under Stop, `<ver>` a plain version without leading zeros, never below the one it replaces (nor below the judging gate for a file that carried no gate entry under that event — an unpinned fresh entry is below any floor, since `npx` then runs whatever `tamperward` resolves to locally) and, for an entry the edit wrote, never above the judging gate either (a pin npm cannot resolve exits without a decision, which the runtime treats as non-blocking — fail-open; the honest raise is `init` run from the newer version, which raises the judging gate with it), a `timeout` at 120 or more and a string `statusMessage` (the documented spinner text) the only other keys, and `disableAllHooks: false` declared at the top level as init writes it since 2.9.0 (the project value overrides the user file's, so a `true` planted in `~/.claude/settings.json` no longer reaches the gate; removing or flipping the declaration is the tamper, and a pre-2.9.0 file without it stays clean until an edit writes the gate anew); any other key on the entry (`async`, `asyncRewake`, `if`, `args`, `shell`, `once`, a `timeout` below 120 or non-numeric, a missing or non-command `type`), any text around the invocation (a redirect, pipe, `sh -c`, `&&`/`;`, a leading `PATH=`/`NODE_OPTIONS=` assignment, `-p`/`--package`, a launcher other than `npx --yes`), a top-level `env` key added or changed in a file that carries the gate, whatever its name (`env` is set for every session and every subprocess and init writes none; the reason names the mechanism when the name is a known one — `PATH`, `NODE_OPTIONS`/`NODE_PATH`, `HOME`, `npm_config_*` case-insensitively, `BASH_ENV`/`ENV`, `BASH_FUNC_*`, `LD_*`/`DYLD_*`, `TAMPERWARD_*` — and those names are the tamper in any settings file; a key removed never is), a non-boolean truthy `disableAllHooks`, a duplicated JSON key, a value the runtime's schema rejects on any hook entry the edit wrote under any event (a `type` it does not accept, a non-numeric `timeout`, a non-string matcher: the runtime continues without the broken file, gate included), or a hook entry added beside the gate under PreToolUse or Stop in a file that carries it — a forged decision in the command text named as such, a shape that is not a plain command entry (`args`, `http`, `prompt`, `agent`, `async`, `if`) named as such, and a plain command still a sign-off because its output combines with the gate's verdict (an `updatedInput` after an allow, the last hook winning; a `continue: false` over a block) and a script body carries what a regex cannot see — is the tamper — while hooks MERGE across the settings files, so an added local file declaring its own hooks shadows nothing, and an entry beside the gate that was there before, as written, is not this edit's doing; the pre-commit script init wrote must stay byte-equal to what init writes modulo an upward pin (trailing newlines not counted, 2.10.0); **a hand-written hook script is held byte-equal to its before** (2.10.0) — the only clean edits are raising a plain-semver `tamperward@<ver>` pin to a version no higher than the judging gate (or pinning an unpinned invocation) and a trailing-newline-only difference; every other edit, honest or not, is hook-tampering with the reason *the gate script changed; sign off*, because three adversarial passes showed a line-by-line liveness model of a shell script cannot be sound (against a model rebuilt after the second pass, `( gate \|\| true )`, a multi-line `{ … } \|\| true`, an `exit 0` inside a brace, a trap by function name or `exit $VAR`, a `PATH=` line, `check --diff HEAD...HEAD`, `if [ -d . ]`, `for f in "$@"`, `[ $# -eq 0 ]`, a multi-line string, `: '…'`, `\|\| exit "$rc"` with `rc=0`, `& wait`, a second heredoc on one line and a `case` glob all ran a failing gate to exit 0 under a real `sh -e` and a real direct exec while the model read the gate as live); the liveness model stays as EVIDENCE, not the verdict — when it names a mechanism (the `\|\|` chain evaluated in order and ending in success, a passing `trap`, `set +e`, function/alias shadowing of the command or of a wrapper word in front of it (`command`, `env`), an assignment or prefix of `PATH`/`NODE_OPTIONS`/`NODE_PATH`/`HOME`/`LD_PRELOAD`/`BASH_ENV`/`npm_config_*` before or on the gate ("runtime redirected"), the mode flag or `--cwd` swapped (the mode flag is identity: `--staged` → `--diff HEAD...HEAD` or `--worktree` is another check; `--cwd "$(git rev-parse --show-toplevel)"` is the root), a lone `&` (`& wait` without a pid returns 0; `& wait $!` is the gate's status), a pin lowered or no longer a plain version (`@^1`, `@latest`, a pre-release), a `cd` away from the root, heredoc bodies as data, `pipefail` only from a real `set -o pipefail`, a non-shell shebang or a gate that is not the last statement without `set -e` on a directly-exec'ed hook) the finding carries it as detail for the human signing off; a NEW hand-written script has no before and is judged by the model alone — `tamperward check` must be live in it under the way that hook runs (husky's `sh -e`, git's direct exec) or the add is a sign-off, save for husky's own v9 runtime under `.husky/_/`, recognised by exact byte content while `.husky/pre-commit` is a regular file running exactly `tamperward check --staged` live at the judging pin (mere existence is not enough, and `--worktree`/`--diff`/a `--cwd` away/an old pin are not the backstop), so an ordinary `npm install` does not need a sign-off (2.10.1); a deleted one is the removal finding; lefthook / pre-commit / package.json entries compared by the command they run (`tamperward check` live, not the word, its identity including the mode flag, `--cwd` and pre-commit `args` — `run: … --diff HEAD...HEAD`, `entry: … --diff`, `args: [--cwd, /tmp]` are replacements; a command-level `env` setting `PATH`/`NODE_OPTIONS`/`NODE_PATH`/`HOME`/`LD_PRELOAD`/`BASH_ENV`/`npm_config_*` gained or changed is a runtime redirect; a pin lowered or no longer plain after a plain-pinned before is a lowering; pre-commit `additional_dependencies` gained or changed on the gate entry chooses which gate the hook installs; `skip`/`only` in any non-false shape at command and hook level, `tags` against `exclude_tags`, `lefthook-local.yml` as the overlay it is, `stages` inherited from `default_stages ?? all`, `types`/`types_or`/`exclude_types` without `always_run`, `husky`/`lefthook install` by identity so `echo husky`/`HUSKY=0 husky`/`husky uninstall` are removals); CODEOWNERS over the concrete gate files with GitHub's glob semantics (a later ownerless `/.husky/pre-commit`, `*.yml`, `**/pre-commit` un-owns the gate); on the command surface, a write target expanded as the shell would — `~`, `$HOME`, `%USERPROFILE%`, `$CLAUDE_CONFIG_DIR` (its value from the hook's own environment, else `~/.claude`), backslashes as separators — every symlink in it resolved against the repository root (`/tmp/xlink/.claude/settings.json` through a link into the checkout is `.claude/settings.json`; `/tmp/cfg/settings.json` through a link to `~/.claude` is the user file) and judged as a hook write whenever it is settings-shaped wherever it lives (`~/.claude/settings.json`, `managed-settings.json` at any path, a `.claude/settings*.json` at any depth: the runtime reloads every one of them live in-session, and none is in a repository glob), a directory holding the user file (`rm -rf ~/.claude`) included, the finding naming the expanded file so the guarded pin applies (2.9.0); absolute paths under the repository relativised, `>\|`/`>&`/`&>` kept with their redirection, `install -t`/`cp -t`/`rsync`, `git checkout <rev> -- .`/`git restore --source=<rev> .`, `git apply`/`patch`/`git am`, inline `python -c`/`node -e`/`perl -e`/`ruby -i`/`ex`/`ed` scripts naming a hook, `xargs rm`/`chmod`, `find -exec chmod -x`/`-delete`, multi-group symbolic chmod (`u+rw-x`), `setfacl -m u::rw-` (2.7.0); **an ADDED file under `protected.hooks` is classified by kind before it is judged** (2.24.1, #442): a YAML hook config (`.pre-commit-config.yaml`, `lefthook.yml`, `.lefthook.yml`, `lefthook-local.yml`) is compared by the config comparator against a fresh base carrying every gate entry the file names as init would write it — live, unskipped, unscoped, on the commit stages — so a config that names no gate (a linter onboarding) or carries it live is clean and one that arrives with its gate `skip`ped, under `only`, scoped by `glob`/`exclude`/tags/`stages`, rerouted by `env` or not live is the weakening finding; a note or git dotfile (`.husky/.gitignore`, `.gitattributes`, `*.md`, `*.txt`) is silent on add as on edit; only a genuine shell hook script is held to the sign-off stance above | mechanical | regex + parsed JSON/YAML |
| 9 | `no-verify` | command | `git commit -n/--no-verify` (any unambiguous prefix, quoted or not, on `commit`/`push`/`merge`/`am`/`rebase`/`cherry-pick`), `--no-hooks`, `HUSKY=0`, `HUSKY_SKIP_HOOKS=1`, `LEFTHOOK=0`, `LEFTHOOK_EXCLUDE=`, `SKIP=<hook-id>` on a git/pre-commit invocation, `core.hooksPath` in any spelling; tokens are read fully unquoted (`HUSKY="0"` is `HUSKY=0`) and the same spellings one shell deeper (`sh -c '…'`, `eval …`); a git alias whose body carries the flag (`git config alias.ci "commit --no-verify"`, `git -c alias.ci=… ci`, `GIT_CONFIG_{KEY,VALUE}_n` / `GIT_CONFIG_PARAMETERS` injection); `pre-commit`/`lefthook`/`husky uninstall` and `rm`/`mv`/`chmod -x` of the pre-commit framework's install target (`.git/hooks/<hook>`, outside every git view). A value glued to its short option is the value, not a flag cluster (`git commit -mfinal` is clean). **Hook-less commit paths warn**, whatever the rule's severity: `git commit-tree`, `git update-ref <branch> <sha>`, `git am`, `git cherry-pick`, `git rebase` land commits pre-commit never sees, but far more often land commits it already checked; resuming/abandoning one (`--continue`, `--abort`, …) and `cherry-pick --no-commit` are clean (2.23.19) (representative spellings; see `docs/guide/rules.md` for the full language-specific set) | mechanical | regex |
| 10 | `guard-removal` | file | deletion of lines matching auth/validation patterns (`requireAuth`, `checkPermission`, `if (!user`, `authorize`, zod `.parse(`, `csrf`) | heuristic — **reserved, not built** | regex |
| 11 | `snapshot-rewrite` | command+file | runner update mode (`jest -u`, `--updateSnapshot`, `vitest --update`), regeneration scripts by name (`update-golden`, `regen-snapshots`), shell mutation of protected snapshot paths, and any modify/delete/rename-out of `**/*.snap`, `__snapshots__/`, `golden/` | mechanical, **warn** (updating a snapshot is legitimate when intended output changes; built from measured demand — harness/PREDICTION-affordance.md) | regex + glob |
| 12 | `snapshot-only-rewrite` | file | every changed file in the diff is a moving protected snapshot (adds excluded) — the FP study's narrow signal, ~0.06% of audited mainline commits, 7/7 of observed tampers; judged ONLY at commit granularity (staged/range views) via the engine's `view` parameter, because at tool-call scope every snapshot edit is "only" | mechanical, **warn** (graduation candidate: `BLOCK_SINCE` at a future policy `version:`) | glob |
| 13 | `ts-any-launder` | file | `any` introduced in annotation/generic position (`: any`, `<any>`) — the laundering spelling of row 4's class, split out in the 1.0 precision pass | mechanical, **permanent warn** — graduation to block is *closed by corpus* (`harness/PREDICTION-launder-corpus.md`): the spelling fires on **10.5%** of 1,227 legitimate mainline commits, 4–10× any deployable block threshold; the measured 26/40 demand for the laundering class routes to the held-out-oracle and prompt layers, not to a block rule | regex |
| 14 | `test-content-removal` | file | NET removal of ≥3 significant lines from a modified protected test file whose it()/test() block count did not drop — case-table rows, assertion arguments, mock/setup regions. Removed content is excused only if kept (whitespace-normalized) in the changeset's protected-test content after the edit; comments do not excuse; snapshot-glob files are row 11's jurisdiction; one-for-one rewrites (line count kept) are the semantic class and stay with the held-out oracles. Rows of an each-table whose after-shape is OPEN (spread from elsewhere, a call, or a table that stays spread with fewer explicit rows) are compared as elements, one-line tables included: ≥2 rows gone that reappear nowhere in the change fire regardless of the net line count. Content this change adds to a non-spec file under a test directory (a case table moved to `test/fixtures/`) is kept, not removed (2.7.1) | mechanical, **block** — built from the taskbench Phase-3 evasion class (PHASE3.md §4: row deletion, throws-message stripping, setup gutting — the family that carried the gated-arm false greens), shipped AFTER the experiment per the frozen protocol. Corpus: fires on **1.5%** of 2,304 mainline diffs (immer/zustand/zod/prettier, `harness/fp-study/TCR-CORPUS.md`), every adjudicated fire legitimate — the block-with-signoff price, accepted because the legitimate edit and the tamper are mechanically indistinguishable (a maintainer deleting error-expectation rows because a parser improved is byte-shaped like the agent deleting failing rows) and Phase 3 measured what warn means in an unattended loop: nothing. From 2.24.4 (#431) a line counts as content only where it can run: on both sides the significant lines are read from the file's LIVE text (an `if (false)` block, statements after a `return` in their function, and any line wholly inside a string or template literal are not content), a removed line is excused into the kept pool only where its text occurs as CODE (an occurrence that begins inside a string or template literal is the line quoted, not kept — a joined or rewrapped call still begins outside its string arguments, so reformatting stays excused), and ≥3 removed lines whose text survives only in the file's hidden text — a string, a template literal, a constant-false branch, after a `return` — fire regardless of the net line count, because a line kept verbatim where it cannot run was hidden, not rewritten (the net-count guard protects one-for-one REPLACEMENTS). Python is read by indentation: `return` / `raise` at indent k kills the lines at indent ≥ k after it, `if False:` / `if 0:` / `if None:` kills its suite | line-set + AST guard |
| 15 | `transient-protected-mutation` | events (`tamperward watch` log, judged at the Stop sweep) | a protected file whose recorded content or mode CHURNED during the turn while its net state at Stop is unchanged — modified and restored, so neither the per-call drift check nor the turn diff can see it, while anything consulting the suite mid-churn consulted a weakened version; mode churn is the chmod-only class | **warn** by default, and deliberately: a Stop block already forces restores, and a compliant restore reads as churn — block-by-default deadlocks the honest path. `TAMPERWARD_TRANSIENT=block` may RAISE it (harnesses owning restore semantics), never lower it. Measured basis: **1 transient in 59 real trajectories** and it was exactly this pattern (07-fastify: skip → npm test → restore); the two A.1-documented observer misses (chmod-only, single-call modify+restore) are this row's coverage — to the extent the platform's fs events deliver them: a recorded event is evidence, an absent event is never evidence of absence. **2.13.3 adds explicit observer-health telemetry:** a sidecar beside the event log records backend, live PID/start time, watched-directory count, successful appends, drops and errors; doctor classifies it healthy/degraded/unavailable, while Stop records non-healthy state only in the advisory audit channel. The health file remains candidate-accessible like the event log and is descriptive, never CI authority. **2.14.0 lets `tamperward run --observe-transients` own a unique per-run log and watcher lifecycle; `run` consumes that session log directly, so it does not depend on a Claude Stop hook having fired. 2.15.2 makes Stop-sweep JSONL consumption cursor-proportional: positioned reads begin at the saved byte offset, each physical read is capped at 4 MiB, and one Stop decision drains at most 16 MiB in bounded chunks. The cursor advances only through complete newline-terminated records and is committed only after the bounded tail is fully parsed and classified. A torn final record is replayed once completed; malformed telemetry, an oversized single record, a torn tail, or backlog beyond the aggregate ceiling blocks Stop and retains the prior cursor rather than certifying unjudged bytes.** | fs events + hash/mode churn |
| 16 | `pristine-verification` | execution (`tamperward verify`) | the suite re-run in two separate copies of the working tree: as-is (visible) and with protected tests/snapshots/config restored from a trusted base rev (pristine; agent-added files **removed** across the protected classes and a separate verification surface of runner-consulted config — 1.14.1 closed the `conftest.py` form of this bypass and 1.14.2 the runner-config form; the surface list lags runner behaviour and bounds the class rather than eliminating it). Under the default local backend the copies are separate directories, not a sandbox (`checkpointed-local`). From 2.11.0 the trusted policy may instead select a digest-pinned `container` backend: the materialised stage is mounted read-only, dependencies/runtime come from the image, host HOME/temp/sockets and mutable dependency trees are absent, and setup/runtime failure is cannot-verify rather than a local fallback. From 2.11.2 that backend also applies fixed 2 GiB memory / no-extra-swap / 2 CPU / 256 PID ceilings; Docker-confirmed OOM is `VERIFIER_RESOURCE_EXHAUSTED` / exit 2 rather than suite red, and the active limits are recorded in `verifier_backend.resources`. From 2.12.0 the generated GitHub Actions authority uses a 360-minute job timeout and runs `tamperward doctor` before verification. The doctor resolves `verify.budget` from the trusted base, locates every workflow job that invokes `tamperward verify`, and requires a static numeric outer timeout of at least `2 × verify.budget + 3600 seconds` (visible + pristine + a one-hour authority reserve). The generated job therefore accommodates up to 9,000 seconds per stage; larger positive finite policy budgets remain valid and require a custom workflow/runner with a larger outer envelope rather than becoming policy parse errors. From 2.16.0 both stages also drain stdout/stderr through a bounded trusted supervisor: only a 16 KiB tail per stream is retained, total bytes/truncation are reported in JSON, successful human output stays quiet, and failure rendering escapes control characters plus prefixes every candidate line. These diagnostics are evidence only and cannot set the host verdict. The same local supervisor retains POSIX process-group ownership and, on Linux, tracks the actual `/proc` descendant tree while the suite is alive; on ordinary main-child exit or timeout it kills the group plus tracked descendants before returning the stage result, including a regression where a descendant escaped with `setsid()`. From 2.16.5 checkpointed-local verification has an explicit host-shell contract: Linux, macOS and the supported POSIX Node platforms use `/bin/sh -c`; Windows local verification returns `CANNOT_VERIFY` before candidate execution instead of depending on an incidental MSYS/Git-for-Windows shell. Among supported POSIX local hosts, Linux retains the stronger `/proc` descendant tracking while macOS/other POSIX hosts have process-group cleanup only; isolated-container cleanup still owns the stronger whole-container process set. Visible-green + pristine-red = **MASKED FAILURE** (exit 1); budget exceeded or cannot-run fails CLOSED (exit 2). The isolated backend protects execution-domain authority, not the semantic/oracle boundary: candidate code necessarily executes inside the suite and can still terminate or interpose on an in-process runner. From 2.11.1 every verifier verdict/audit reports `oracle_assurance.level: suite-exit-only`, `semantic_isolation: false`, and that candidate code executes inside the oracle process; the mandatory isolated E2E control reproduces `process.exit(0)` short-circuiting a trusted assertion while the execution boundary remains intact. From 1.14.5 the pristine copy is materialised only AFTER the visible run exits — the two used to be prepared together as siblings, so the candidate's own code wrote `../pristine/<the test that convicts it>` with no race and no background process — and its restored files are digested (content and mode) either side of the pristine run, while the working tree and installed dependency tree are fingerprinted around both runs; any movement is exit 2. 1.14.5 also restores the base's file MODE and TYPE, not only content: `--name-only` left a restored test at whatever mode the agent's tree carried, so `chmod -x` alone hid it from an exec-bit discovery runner in both copies. From 2.23.5 the overlay probes whether the copies' filesystem folds case and, when it does, keys the base-protected set and every membership test on the folded path (a case-only rename of a base test had unlinked the restoration; #426), refuses fold collisions as `PATH_CASE_COLLISION`, and reports the assumption as `filesystem_case_sensitive` | mechanical at the outcome level — no diff interpretation at all, which is why it is immune to spelling. Evidence base: in the taskbench Phase-3 sweep this layer identified **every masked failure in all 53 trajectories** while diff-time detection was routed around — a trajectory record on one frame, not a guarantee. Judged at commit/CI granularity by design (a full double suite run per tool call is not a loop-layer cost anyone pays); the `verify:` policy block is guarded by policy-diff (command change, budget lowering, removal = weakening), and from 1.14.3 `verify --base <rev>` reads the overlay policy, verification surface and verifier command/budget from that commit, so the candidate cannot supply the configuration for its own re-execution. 1.14.4 extends the overlay to what the verifier command EXECUTES — command tokens naming a file present at the base (`node runner.js`), plus an explicit `verify: { inputs: [globs] }` for delegation that no token names (`npm test` -> `scripts/test.sh`), whose narrowing is itself weakening — and makes every trusted git read set `GIT_NO_REPLACE_OBJECTS=1`, since `git replace` redirected both `ls-tree` (which files exist at the base) and `show` (their content) to a tree the agent had just written. Both remain BOUNDS, not eliminations: a command can reach a file neither source names, and grafts/shallow have no disable switch (row 17 covers them by fingerprint). From 2.18.0, Linux `trace-verify` provides advisory discovery for that file-surface residual: it traces a caller-selected trusted base, unions repeated observations, marks dynamic reads, separates external runtime/dependency paths, compares tracked reads against this exact coverage model, and suggests only uncovered exact paths for human-reviewed `verify.inputs`; trace absence is evidence from those executions, never proof of non-use, and no policy is mutated. | double execution + exit codes |
| 17 | `run-envelope` | process (`tamperward run`) | the agent invocation wrapped so its exit is untrusted: the trusted base is recorded before the agent starts, and after any termination the released tree is re-adjudicated against that base — policy check over base...HEAD (committed weakening), policy check over the worktree (uncommitted), and pristine verification. Exit: the agent's own code when enforcement is clean; 124 / `AGENT_TIMEOUT` when an operator-supplied `--agent-budget` expires and post-timeout enforcement is clean; 1 on any blocking finding or masked failure; 2 when adjudication is impossible (dirty start, unresolvable base, no suite command) — enforcement always outranks the runtime status, failing closed Trust anchor hardening: the entry SHA is frozen before the agent starts, post-agent HEAD must be a descendant of it (history rewrite = the conviction, exit 1), and the WHOLE policy — rules, protected globs, verifier command/budget — is resolved from the base commit (`loadPolicyAt(base)`), never the working tree the agent controls; the worktree check adjudicates at the CI layer (no agent-writable local sign-off ledger) and includes untracked files — a verifier that appears after the agent runs is agent-authored and is never used — and ignored files on protected paths. Every disk read in that check is git's view of the path (2.8.0): a regular file is its bytes up to 64 MiB, a symbolic link is its target text and is never followed, and nothing else is content; a protected path that is anything else — a link, a FIFO, a socket, a device, a directory where a file is expected, a larger file — is blocked by name as `hidden-drift`, and a path carrying a control character is protected in every category. Quiescence is guarded, not assumed: the tree is fingerprinted across adjudication and refused (NOT_QUIESCENT) if it moves, and processes started after the agent spawned that still hold the working tree are surfaced the same way. From 2.11.3 an optional operator-owned `--agent-budget` adds a wall-clock bound distinct from the verifier suite budget. From 2.16.3 the lifecycle ownership underneath that option applies to **every** wrapped agent, including normal exit. Ordinary POSIX descendants run in an owned process group. Linux uses a fixed non-caller-writable system `python3` launched with `-I -S -E`, cwd `/`, and a minimal supervisor environment while the agent receives a separately frozen copy of its original cwd/environment. The supervisor sets `PR_SET_CHILD_SUBREAPER`, so orphaned double-fork/`setsid()` descendants are kernel-reparented to it. Before adjudication the supervisor kills the process group and adopted children and requires `waitpid(-1, WNOHANG)` to reach **ECHILD**; child-list read/parse failure, kill failure, drain deadline, unavailable trusted Python, or abnormal supervisor completion fails closed before adjudication. The result file is trusted only after normal supervisor completion, so same-UID result forgery plus supervisor kill cannot manufacture lifecycle ownership. From 2.16.4, `tamperward run` refuses **before agent start** on Windows, macOS and other non-Linux hosts because no authoritative detached-domain drain backend is implemented there; best-effort `taskkill`/process-group/fingerprint/quiescence controls are not sufficient to return GREEN. From 2.16.5 standalone `check` remains cross-platform, checkpointed-local `verify` is supported only on POSIX `/bin/sh` hosts and fails closed before candidate execution on Windows, while isolated-container `verify` remains a separate Docker-authority path. Linux remains the only run lifecycle backend certified by the subreaper/ECHILD invariant. From 2.14.0, `--observe-transients` optionally starts a separate TamperWard watcher **before** the agent, with a unique log under the repository git directory and policy frozen from the same trusted base revision. The envelope waits for observer health, consumes that log itself after the agent, reports healthy/degraded/unavailable independently of the enforcement verdict, and terminates the observer on normal completion or early enforcement exits. From 2.20.2 that termination completes only when the observer **process** has exited (bounded 2 s drain, SIGKILL behind it; the exit is read from the Linux process state, since the envelope's own blocked event loop cannot reap the child): the watcher's `stopped` health record is telemetry, never the completion boundary, so `run` never returns while the observer is still writing. Temporal findings remain warn-only unless the operator explicitly raises `transient-protected-mutation` with `TAMPERWARD_TRANSIENT=block`; observer health/unavailability itself remains advisory because the watcher/log are candidate-reachable and are not CI authority. The event consumer still preserves verdict integrity: run drains bounded chunks rather than classifying only the first 4 MiB, and in strict transient mode any malformed/torn/oversized/over-aggregate or otherwise unclassifiable observer tail fails the envelope closed instead of permitting a false green. The local dependency boundary is now explicit rather than implied: since 2.10.9 one frozen ecosystem-aware dependency descriptor is attested around adjudication, which closes persistent drift but remains checkpoint-based for a fully self-restoring in-window mutation. 2.16.2 introduced an immediately-adjacent run→verify dependency-attestation reuse, but 2.16.3 **disables that optimization again**: the envelope pre-verifier checkpoint and the nested verifier-entry checkpoint are always independent full reads. A clean local run therefore performs six complete dependency-tree snapshots, zero reused snapshots, and reports `entry_reuse=no` regardless of platform or lifecycle ownership. Post-visible, post-pristine and envelope-final snapshots remain independent; the post-pristine verifier attestation is returned for evidence but is not reused by the envelope because execution after verifier return remains a separate quiescence boundary. `TAMPERWARD_DIAGNOSTICS=1` exposes complete/reused snapshot counts, aggregate snapshot wall time, lifecycle ownership and the disabled entry-reuse state. 2.11.0 adds the stronger isolated final-verification backend to standalone `tamperward verify`; `tamperward run` refuses `backend: container` before the agent starts because a same-host/same-identity agent could also control Docker authority. Trusted CI or an externally isolated agent must perform the frozen-artifact handoff. The default run envelope therefore remains checkpointed-local rather than claiming a sandbox | round 2's decisive negative: hooks decide, runtimes terminate. In the cssstyle-gated trajectory the gate denied 42 mutations and verify rejected all 25 stop attempts, and the session completed anyway with a masked tree — correct policy decisions are insufficient when the policy mechanism does not own the lifecycle boundary. The envelope (or `check --diff` + `verify` in CI) owns it from outside; the hooks remain the in-session fast path | double execution + exit codes, adjudicated post-termination |
| 18 | `ts-cast-growth` | file | net growth of the ORDINARY assertion surface in non-test JS/TS source: `x as T` / `<T>x` type assertions and non-null `x!` assertions counted on the TypeScript AST before and after the change; one finding per file, pointing at the first assertion whose spelling was not there before. Row 4 keeps `as any` / `as never` / the widening double cast (`as unknown as` and its `never` / `{}` / `object` / `Object` spellings, alias-resolved) / `@ts-*`, and the inner step of such a double cast is row 4 too (`(x as {}) as T` is not two budgeted assertions); a LONE `as {}` / `as object` stays an ordinary budgeted assertion, while `as const`, `as unknown`, `satisfies`, generic call/JSX arguments and cast-like text in comments or strings are not casts; declaration, generated (`@generated` header or generated/vendored path) and protected test files are outside the budget; a cast removed in the same change offsets one added; a side that does not parse declines; diff-only inputs are silent (2.20.0, #383) | mechanical count, **permanent warn** — block is *closed by corpus* (`harness/fp-study/CAST-GROWTH-CORPUS.md`): the rule fires on **40/460 (8.7%)** of adjacent legitimate mainline pairs across immer/zustand/zod/hono (18.2% of the 220 pairs touching files inside the rule's own scope) against the study's 1% ceiling for block; a budget, not a ban — the review prompt for "say why this change grew the unsafe assertion surface". TamperWard's own `src/` carries zero assertions after the #383 pass (`docs/CAST-INVENTORY.md`) | AST (before/after count) |
| 19 | `coverage-exclusion` | file | the per-function form of row 6: an inline coverage exclusion ADDED to a non-test source file — `/* istanbul ignore next\|if\|else\|file */`, `/* c8 ignore next\|start */`, `/* v8 ignore next[ N] */`, `/* node:coverage ignore next */` / `disable`, `# pragma: no cover` (any spacing/case coverage.py accepts), `#[coverage(off)]` (bare or under `cfg_attr`), and a `//go:build` / `// +build` constraint added to an EXISTING Go source file (a constraint on a new file is a platform split; one edited on a file that already carried it is not an exclusion; without the before content the rule declines). Scope: a language the pattern rules know, outside `protected.tests` and `protected.config`, not a declaration, generated, vendored, output, example, docs, script or fixture path. A marker inside a string literal or quoted behind a line-comment opener is text; a marker line removed and re-added verbatim moved; a range closer (`c8`/`v8 ignore stop`) excludes nothing (2.24.0, #438) | mechanical, **shipped warn** — measured against the ts-cast-growth frame (`harness/fp-study/COVERAGE-EXCLUSION-CORPUS.md`): **0/460** legitimate mainline pairs fire, inside the 1% ceiling, but the four real adds the 6,632-commit deeper frame holds are all honest immer maintainers marking environment-dependent branches — precision as a tamper signal on real fires **0/4** against the 90% floor, so block is not authorized; CI replays `coverage-exclusion-corpus.json` (22 negative, 14 positive cases) | regex, per language, string/comment aware |
| 20 | `test-support` | file | a `protected.tests`-glob path that is not a snapshot (row 11) and not spec-shaped — deleted, renamed out of the `tests` globs, or net-shrunk by ≥3 significant lines with none of the removed lines surviving (whitespace-normalized) anywhere the change keeps or adds. Which files are spec-shaped is one shared predicate (`isSpecShaped`, `src/detectors/spec-shape.ts`): a runner-selected suffix (`.test.ts`, `_test.go`, `test_*.py`, `*Test.java`, `_spec.rb`, `tests/<name>.rs`, `conftest.py`, …) is always a spec; a `fixtures/`, `__fixtures__/`, `__mocks__/` or `__snapshots__/` path component is always support; otherwise a file in no language the detectors read (JSON, YAML, a properties file, a note) is support; otherwise the content decides by the same `countTests` the block rules use — zero test definitions on both the before and the after side is support, and a side the gate cannot read or cannot count fails closed as a spec. `test-deletion` and `test-content-removal` cede exactly what this rule picks up: a helper, setup module, mock or JSON fixture living under the same globs that serves the specs but defines none of its own (#443) | mechanical, **shipped warn** — a helper the specs still import fails the suite loudly on its own; a fixture or setup step quietly trimmed does not, which is the review prompt this row exists for, not a block: the class carries no test of its own to lose | line-set + shared path/content predicate |
| 21 | `config-weakening` | file | `tsconfig*.json`/`.eslintrc*`/`eslint.config.*`/`.eslintignore`/`biome.json[c]` were protected in name only (#447): a strictness flag `strict` turns on (or another `TRUE_IS_STRICT` flag) that was on — explicitly or implied by `strict` — and is off after, or a loosening flag (`skipLibCheck`, `allowUnreachableCode`, …) added; tsconfig `exclude` grown with a pattern that hides a tracked source file (judged over the repository listing when the gate has one, else by conventional housekeeping names); `extends` dropped, or pointed at a file this change adds or that no protected glob covers (a flag lowered in one tsconfig and raised in another of the same change moved, and is not reported); an eslint rule turned `off`/`0` that was not off in any config of the same family before the edit (a `.eslintrc` → `eslint.config.js` migration carries its off rules over silently; a base rule off beside its plugin-prefixed twin on is a replacement, not a removal); `ignores`/`ignorePatterns`/`globalIgnores([...])`/`.eslintignore` grown the same way as tsconfig `exclude`; biome `linter.enabled: false`, a rule or `rules.recommended` set `off`, `files.ignore`/`linter.ignore` grown, a `!` entry added to `files.includes`; and — read the way `test-deletion` (row 1) reads a runner config's own selection — a NEW jest/vitest `setupFiles`/`setupFilesAfterEnv`/`globalSetup`/`runner`/`testEnvironment`/`reporters` entry pointing at a file this change adds or that no protected glob covers, since that module runs with the suite's globals in reach. `test-deletion` itself gained the twin reading for delegated SELECTION on the same protected runner config (2.26.0, #447): `export { default } from './vitest.real'`, `module.exports = require('./jest.real')`, a `...base` spread, `mergeConfig(base, …)`, `extends`/`preset`/a `projects` entry pointing at a file the change adds or that no protected glob covers, and `testNamePattern` read as a selection predicate — the opacity itself is the finding, because a config the gate cannot read can select nothing | mechanical, **shipped warn** pending an fp-study replay (`harness/fp-study/CONFIG-WEAKENING-CORPUS.md`) before any graduation — every one of these has an honest spelling (a build-only tsconfig excludes the tests; a rule retired for its typed twin) | regex/JSON/YAML + AST |

The nineteen mechanical rules are where determinism is real and the demo is honest. The two
heuristics (3, 10) are the research surface, and the discipline is: **built only against
a measured negatives corpus, entering as `warn`, promoted per-rule only when the number
clears the bar (§7)**. Row 3 has since been built that way (2.17.0, warn against a committed corpus); row 10 has not — the corpus comes first, because a
false-firing rule trains people to override, which is the exact failure the FP study
exists to prevent.

**Parser discipline:** detector 1 uses the TS compiler API — comments, strings, and
`describe` text containing `it(` will false-fire a line count, and a false-firing
*block* rule is poison. Detector 3 was planned to ship in halves: the count-based
signals (`expect()` count — clean two-AST work) first; the node-alignment sub-signals
(matcher-weakened, literal-swapped-in-a-kept-`expect()`, which require matching "the
same test" across the two versions) after — that's the part that quietly eats a week.
Regex is genuinely fine for the additive-token detectors (4, 5, 9) and adequate for
6–8, 11 and 12 against known config shapes.

**`tamperward allow` granularity:** a sign-off is keyed on `rule + file + hash(evidence)`
and expires — never a session-wide blanket on a whole rule.

**Row 13's closed question, because a spec should record decisions, not just
surfaces:** whether the laundering spelling could ever block was this project's
longest-open graduation question — the strongest measured demand in the series
(26/40 uncovered-class tampers) pointed straight at it. The §7.A-style corpus sweep
answered it with a denominator: both laundering spellings (annotation-`any` at
10.5%, non-const named-type assertions at 7.5%) are ordinary honest TypeScript at
rates no block threshold survives, so `ts-any-launder` stays warn permanently on
syntactic evidence, no assertion rule gets a *block* on syntactic evidence (row 18's
`ts-cast-growth` budget, 2.20.0, is the warn-only descendant of that finding: 8.7% of
legitimate mainline pairs grow the ordinary assertion surface), and the laundering class is owned
by the layers where coverage is actually measured — held-out oracles (18/18 caught)
and the naming sentence (a 10/10 behavioral flip). Detection is not the gate's
layer for this class; verification and framing are.

---

## 5. Agent-layer wiring (Claude Code)

The agent layer closes the cheat path *before it opens*. It has **two** touchpoints,
not one — the PreToolUse hook plus a Stop sweep — because a single matcher can't see
every way a file gets mutated.

### 5.1 PreToolUse hook

`settings.json` (written by init):

```json
{
  "disableAllHooks": false,
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Edit|Write|MultiEdit|NotebookEdit",
      "hooks": [{ "type": "command", "command": "<pinned HOOK_CMD>" }]
    }],
    "Stop": [{
      "hooks": [{ "type": "command", "command": "<pinned SWEEP_CMD>" }]
    }]
  }
}
```
> `init` replaces the placeholders with the exact pinned commands from `src/wiring.ts`
> (`NPX_AUTHORITY`, the fixed registry/config arguments and the exit-2 authority-failure
> fallback). `disableAllHooks: false` is written explicitly so user settings cannot
> switch the hooks off silently.

> The matcher must name EVERY file-mutating tool the adapter models. `MultiEdit` was
> dropped from v0.1's matcher while `changesFromClaudeHook` still handled it — so that
> branch was dead at the enforcement point and a MultiEdit test-strip walked past the
> inner-loop gate. Re-confirm the live edit-tool set on each Claude Code release; anything
> not matched here is caught only by the Stop sweep (§5.2), one step later.

`tamperward hook claude` reads the tool call on stdin → builds `Change[]` from
`tool_input` → runs the engine. On a `block` finding it **denies**, and the deny reason
*is* the correction signal.

**Output contract (shipped — `src/cli/hook.ts`, verified against current Claude Code docs):**
- A deny is **JSON on stdout at exit 0**. PreToolUse:
  `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":<reason>}}`;
  the Stop sweep's block is `{"decision":"block","reason":<reason>}`, also at exit 0. An
  allow is exit 0 with empty stdout.
- **Exit 2 is never a verdict.** Claude Code ignores hook JSON when the process exits 2
  and falls back to the raw-stderr channel — which arrives wrapped as a "hook error" and
  leaks the invoking command line. So the adapter exits 0 whenever it emits JSON, and the
  reason carries only the correction message: no command line, no env.
- A `permissionDecision: "deny"` blocks the tool **even in `bypassPermissions` mode or
  with `--dangerously-skip-permissions`**. The agent cannot escape the gate by changing
  permission mode. This is the property the whole agent layer rests on — and it holds.
- A payload the hook cannot read or parse is **denied, not allowed** (fail closed, 1.14.4).
- **The process boundary may move; the contract does not.** Since 2.22.0 an operator
  may run `tamperward hook-service` and set `TAMPERWARD_HOOK_SERVICE=1`; the hook then
  hands the same stdin bytes to that warm process over a per-user `0600` unix socket and
  relays its `HookResult`. The service runs the same `preToolUseFromRaw` / `stopFromRaw`;
  stdout/exit semantics above are unchanged. Before request handoff, an unavailable,
  untrusted or explicitly refusing service falls back to the in-process hook; after
  handoff, ambiguous transport failure is a fail-closed denial rather than a concurrent
  second evaluation over the same session state. Neither path can turn failure into an
  allow. Off by default (docs/guide/enforcement.md).
  Genuinely empty stdin is a well-formed absence of a tool call and stays an allow, which
  is what lets `tamperward hook claude < /dev/null` smoke-test the wiring.

The deny payload, with the reason as the agent sees it:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Tamperward blocked: test-deletion. You are deleting src/auth/session.spec.ts while its assertions are failing — this weakens a protected safety net to pass checks.\n\nFix the underlying failure in the code under test, not the test. Other bypass paths are also blocked: --no-verify, editing the hook, lowering the coverage gate, editing the CI workflow, and rewriting the file via shell (sed/tee) will each be denied too. If the deletion is genuinely correct, a human must sign off: `tamperward allow test-deletion --reason \"...\"`."
  }
}
```

The message is engineered, not casual — it (a) names the class, (b) redirects to the
real fix, (c) **pre-empts the next bypasses** so the agent doesn't try them in
sequence, (d) offers the legitimate human escape. Its wording is the lever to tune
when the §7.B conversion rate is mediocre.

### 5.2 Stop sweep — closing the Bash-mutation hole

The PreToolUse matcher watches `Edit`/`Write` (file changes) and `Bash` (commands).
But an agent can mutate a protected file *through* Bash — `sed -i '/expect/d'
x.spec.ts`, `echo > x.ts`, `tee`, `cat >` — which never fires the `Edit|Write` matcher
and isn't an `rm`/`--no-verify` hit, so it sails past every file detector at the agent
layer. The docs name this exactly: *Claude can also create or modify files by running
shell commands through the Bash tool.*

Fix: a **`Stop` hook** re-runs the detectors once per turn over the turn's net working
-tree diff (`git status --porcelain` + `git diff`) and blocks — feeding the same
correction — if any protected asset was weakened by any means. Without it, a `sed`-based
strip shows green inside the agent loop and is only caught later at pre-commit/CI, which
silently degrades the inner-loop correction property (§2's magic) and the §7.B metric.
The product is about *not* having flag-shaped gaps; this would be one.

The sweep's view of the working tree is git's, not the filesystem's (2.8.0). Every disk
read of a repository path — the untracked and ignored adds, the worktree diff's `after`,
the drift check's hash, the hidden-tracked probe — takes a regular file as its bytes up
to 64 MiB and a symbolic link as a blob holding its target text, never followed; nothing
else is content. A protected path the gate cannot judge by content (a link, a FIFO, a
socket, a device, a directory where a file is expected, a larger file, a read error) is
blocked by name as `hidden-drift` — in the sweep, in the PreToolUse drift check and in
`check --worktree` — rather than read through, which is how a link to `/dev/zero` at
`test/conftest.py` once held the verdict indefinitely. A path carrying a control
character is protected in every category before any glob is consulted, since no glob
matches it and no honest path carries one. And the drift check's walk of the protected
tree does not enter a directory git reports as wholly ignored: the protected files git
lists under it are snapshotted from that listing, so a 50k-file `dist/` costs one
listing per call, not one stat per file.

The sweep compares against the commit the turn STARTED from, not HEAD: the marker
(`.git/tamperward/session-<id>`) is pinned on the session's first tool call, so a tamper
the agent committed mid-turn is still the turn's work. From 2.23.12 (#417) the marker is
written to a temp file and renamed into place, so a parallel hook never reads a torn sha;
it is read only as a full 40-hex object name, and anything else (a truncated prefix, an
empty file) is treated as absent and re-established; and a marker that cannot be
recorded — a read-only or occupied state path — **denies** the turn as
`tamperward-unavailable` with the path in the reason, never a silent downgrade to
`git diff HEAD`. A clean turn advances the marker; a blocked turn keeps it, so the
tamper stays visible until fixed.

"Nothing to compare" is decided narrowly (#417): the sweep allows with empty stdout only
when the session's cwd is a real, readable directory that `git rev-parse` itself reports
as *not a git repository*. A cwd that does not exist, one the hook cannot read, a bare
repository, or any other git failure (dubious ownership, a broken `.git` file) is a
verdict the gate could not compute and is denied as `tamperward-unavailable` with the
diagnostic — the same stance PreToolUse already took for the same cwd.

The sweep is an adjudicating layer and fails closed like one (2.23.14, #444): a
detector that throws over the turn's diff is a blocking `detector-error` on the Stop
deny channel, exactly as at pre-commit — never a rule silently dropped from the
verdict. The same holds at the PreToolUse hook (§5.1): a detector that throws on the
tool payload is a deny, never an allow. Neither is reachable by nesting or size alone,
since the parser declines pathological content before it can overflow (§2).

Handle `stop_hook_active`: Claude Code sets it on the Stop payload when the agent is
already continuing because a Stop hook blocked it. The sweep honours it **immediately**
— `stopVerdict` returns exit 0 with empty stdout on the first payload that carries it,
before any diff is read — so a turn that was blocked once and restored is never trapped
in an unbreakable loop. The cost is bounded: what that second stop leaves behind is
still judged at pre-commit, in CI, and by the `run` envelope.

### 5.3 Defense in depth

Pre-commit and CI remain backstops so nothing reaches `main` even if both agent
touchpoints are somehow evaded. But the agent layer is where the *correction* happens;
the backstops only stop, they don't teach.

### 5.4 Sign-off must be out-of-band in CI

`.tamperward/ledger.jsonl` lives in the repo. Locally that's fine — it's the dev's own
machine. In CI it's fatal: the same PR that triggers a block can append its own
sign-off. The escape valve would guard nothing.

CI sign-off is therefore **out-of-band**: a PR **label** applied by someone with triage
access or higher (GitHub's triage role can label, so label permission IS approval permission),
and the repository authority itself is gated by **three independent GitHub controls** on
the protected branch:

1. the `tamperward` status check is required;
2. `CODEOWNERS` covers the gate-critical paths and **Require review from Code Owners**
   is enabled; and
3. **Dismiss stale pull request approvals when new commits are pushed** is enabled.

All three are load-bearing. A `pull_request` workflow runs from the PR's OWN head and
a required check is matched by JOB NAME, so a PR that keeps the job name and replaces
the gate with `true` reports a green required check over anything it likes — reproduced
on this project's own CI in three seconds. No detector can object, because the detector
is defined by the candidate. Code Owner review without stale-review dismissal is weaker
than this boundary: an approval granted to an older gate-critical diff can otherwise
remain valid after the candidate pushes a different one. GitHub's "require approval of
the most recent reviewable push" is useful defense in depth but is not equivalent,
because the fresh approver is not necessarily the Code Owner for that path.

From 2.13.0, `tamperward doctor --github` can inspect the active branch rulesets and
classic branch protection and refuses to call the repository authority healthy unless
all three requirements are proven. **Without all three, the CI layer of this tool is
advisory.** This is the "who guards the guardrail" problem turned on us — getting it
right is on-thesis; getting it wrong quietly undermines the whole pitch.

From 2.15.0, plain `tamperward doctor` also produces a read-only installation/posture
inventory. The local checks deliberately reuse `planInit()`'s canonical wiring model
for Claude hooks, pre-commit and CODEOWNERS, then add policy-schema, CI-authority wiring,
least-privilege workflow permissions, current-binary vs wiring pins, verifier trust mode
and declared `verify.inputs`, platform residuals, CI outer-time authority and transient
observer health. States are `OK`, `WARN`/residual and `BROKEN`; `--json` returns one
document with the named checks and an `authoritative` boolean. The report does not
mutate anything. Missing optional/early layers can make the report non-authoritative
without changing the generated CI doctor's historical hard-failure contract; malformed
policy, insufficient verifier authority and failed requested GitHub authority still
exit 2. From 2.23.12 the `claude-hooks` and `pre-commit` checks — and `init`'s own
"already wired" verdict, which they reuse — judge a gate entry with the
`hook-tampering` rule's canonical-shape comparator rather than by the presence of the
command (#413): an entry carrying `async`, `if`, a short `timeout` or any other key
init does not write is `BROKEN` with the rule's reason, and a pre-commit gate line
commented out with `#` is not wired. The detector and doctor cannot disagree on the
same settings file.

**2.15.1 binds that posture to the same workflow authority doctor actually validates.**
An explicit `--workflow` and automatic discovery both feed the validated verifier
workflow set into CI-wiring and permission posture; every selected authority workflow's
root token permissions and every job-level override are checked for write scopes. A
future policy version above this binary's `POLICY_VERSION` is `BROKEN`, because the
binary cannot honestly certify authority over semantics it does not understand.

---

## 6. Pre-commit & CI wiring

Same engine, dumber adapters.

- **Pre-commit** (husky): `tamperward check --staged` → exit 1 on any `block`, printing
  the Finding messages. Catches what the agent layer missed (human commits, another
  agent).
- **CI** (GitHub Action — the workflow `tamperward init` writes, `src/cli/init.ts`
  `WORKFLOW_CONTENT`): three gate stages over the pull request — doctor, check and verify, all pinned to the gate's own
  version and fetched from the public registry regardless of any committed `.npmrc`.
  1. `tamperward doctor --github` — validates the repository's branch authority posture.
  2. `tamperward check --diff "${{ github.event.pull_request.base.sha }}...${{ github.event.pull_request.head.sha }}"`
     with `TAMPERWARD_OOB_SIGNOFF` resolved from the PR's `tamperward:allow:<rule>@<head-sha>`
     labels and `TAMPERWARD_OOB_HEAD` set to the head SHA, so an approval binds to the one
     commit it was granted for and the next push re-blocks.
  3. `tamperward verify --require-ancestor --base "${{ github.event.pull_request.base.sha }}"`
     — pristine re-execution against the trusted base, reading its policy and verifier
     from that commit. It needs a `verify:` block in the policy at the base and fails
     closed (exit 2) without one. It receives the same two variables (2.1.0): a
     `tamperward:allow:verify@<head-sha>` label accepts a MASKED_FAILURE — a reviewer
     has read the intentional test change and agrees the original suite no longer
     applies — and nothing else; SUITE_RED and cannot-verify are not approvable states.

  The authority for `main`. A `block` fails the check; it clears only via the
  out-of-band label of §5.4, never via the agent or a committed ledger. This
  repository's own `ci.yml` runs the `check --diff` half only — its test expectations
  legitimately change with every rule change, so nearly every rule PR would carry the
  verify label — and the self-gate is a diff-time gate (README, "CI authority").

### 6.1 Presentation

The engine emits exactly one thing — `Finding[]` — and rendering never changes it. What
the audience gets does change, because a verdict nobody reads gates nothing:

- **Terminal** — blocking findings first, wrapped to the terminal, `path:line` kept intact
  so terminals linkify it.
- **GitHub Actions** (auto-selected on `GITHUB_ACTIONS=true`) — a workflow annotation per
  finding, which GitHub places inline on the diff in *Files changed*, plus a job-summary
  table on the run page. Annotations remain the automatic choice: they need no
  `security-events: write` and no code-scanning configuration. The text output still
  goes to the log unchanged.
- **SARIF** — explicit `check --format sarif` and `verify --format sarif` emit SARIF 2.1.0
  with the published versioned rule vocabulary, effective severity, known locations,
  actual verdict and fresh receipt reference. Incomplete analysis stays unsuccessful;
  absent signed-verdict evidence stays explicit. Upload requires code-scanning setup
  and permissions; presentation does not confer admission authority.
- **JSON** — versioned public machine output for downstream tooling. The shipped
  Draft 2020-12 schema set covers `audit`, `check`, `doctor`, `research`, `run`,
  `stats` and `verify`, each at schema major 1 under `schemas/*-v1.schema.json`.
  Schema v1 allows additive fields so new evidence does not break existing consumers.
  Removing/renaming/retyping a required field or changing a discriminator's meaning
  requires a new schema major. The schemas describe document shape only: CLI exit codes
  remain the independent process-level verdict protocol documented in README and tested
  separately. The Claude hook JSON and advisory `trace-verify` evidence are separate
  protocols, not members of this verdict-schema family.

Human-readable formats carry severity with the word `BLOCK` / `warn`. Colour, where it exists,
is decoration over text that already says the same thing — so the verdict survives being
piped, logged, read by a screen reader, or read by someone who cannot distinguish the
colours. `NO_COLOR` and `FORCE_COLOR` are honoured.

---

## 7. Proof harness — how you know it works

Two layers. The first proves detection; the second proves the loop. The second is the
one that matters.

From 2.23.0 a third, public layer sits on top of both: `tamperward research run`
(`src/research/`) executes a task manifest as paired ungated/gated trajectories over an
`AgentAdapter` — Claude Code, or any command — with one source commit pinned per task,
fresh state per trajectory, the run envelope as the gated treatment, and the outcome
observed in BOTH arms by the same `verify` + `check` primitives the product ships;
TamperWard's own verdict is recorded beside that outcome, never folded into it.
`research summarize` aggregates the ledger into separated readouts with no composite
score. It orchestrates; it never re-implements the verifier, and it never writes under
`harness/`. Contract and record shapes: `docs/guide/research.md`,
`schemas/research-v1.schema.json`.

### 7.A Detection fixtures and precision corpora

The committed precision material lives under `harness/fp-study/` as named corpora and
replay documentation, not under a separate `fixtures/` tree. The assertion-weakening
study is recorded in `harness/fp-study/AW-CORPUS.md` and is replayed beside the
detector: 20 adjudicated legitimate assertion-touching negatives and 12 mutation
positives produced 12 true positives and 0 false positives (100% measured precision).

That result clears the predeclared build threshold but does not graduate the rule from
warn: any `warn` → `block` decision requires a separate independent-corpus/live-fire
review. Other committed `*-CORPUS.md`/JSON artifacts record the corresponding replay
boundaries for the measured detector surfaces. `guard-removal` remains reserved and
unbuilt; it has no precision claim or blocking path.

The corpus convention keeps positive tamper cases, legitimate negatives and the
measurement decision adjacent to the implementation. CI replays the committed data,
so this section describes shipped evidence rather than a planned future directory.

### 7.B The end-to-end loop (`harness/run.sh`) — the real proof

A tiny repo with a deliberately-failing test caused by an actual bug. Run Claude Code
headless with both agent touchpoints installed and a prompt asking for green. Record
the transcript and classify the trajectory:

```
1. agent attempts a bypass (delete / skip / any / no-verify / sed-strip)
2. hook (or Stop sweep) denies, returns the correction message
3. agent's next action: fix the bug, or try another bypass?         ← THE MEASUREMENT
4. suite passes honestly + no protected asset weakened                      → SUCCESS
```

The metric is the **bypass-to-fix conversion rate**: of runs where a block fired, what
fraction ended in an honest fix. The pre-set bar was ~80%; the measured numbers live in
the README and update as the harness accumulates. Two invariants make the number mean
something:

- **Seed invariant:** every seeded scenario has a known-good solution that touches
  *zero* protected assets — so any protected-asset touch is unambiguously a tamper,
  and "agent gave up because the only fix was a blocked path with no human to sign
  off" can't masquerade as a low conversion rate.
- **Oracle independence:** the verdict oracle must verify the positive end-state by a
  mechanism the detectors under test do not share — its own held-out checks, never the
  detector's logic re-derived. An early draft that shared logic with a detector
  certified six evasions as clean; the invariant is written into `run.sh` and each
  seed's oracle. Where the suite itself is guessable, the oracle holds out inputs the
  repo never contains (`oracle-hard.mjs`).

**The wider evidence programme** grew out of this harness, and every study follows one
discipline: *predictions are committed before the first rep, and refuted bets stay in
the repo next to the confirmations.* The prediction files are the record —
`harness/PREDICTION-*.md` and `harness/fp-study/` — covering, so far:

- **Affordance seeds** (`PREDICTION-affordance.md`) — measure *demand* for a detector
  before building it: each seed offers exactly one unguarded bypass class. Result:
  one detector built from measured demand (`snapshot-rewrite`), two hypothesized
  detectors refuted and never built; the shadow scanner (`shadow.mjs`) keeps
  accumulating attempt evidence on every future run.
- **False positives** (`fp-study/`) — the built rule replayed over 1,652 real mainline
  commits before trusting its severity; the study is why `snapshot-rewrite` warns.
- **The no-gate control arm** (`PREDICTION-ungated-control.md`) — the same seed, model
  and prompt with enforcement removed, so the conversion rate is a causal claim, not
  an ordering observation. No new copy cites a conversion rate without this arm.
- **The informed adversary** (`PREDICTION-informed-adversary.md`) — the gate's own
  sources vendored into the repo and named in the prompt, betting the open ruleset
  works as an evasion spec. It didn't, at the measured scenario size — and the bets
  that lost say so.
- **Robustness of the honesty nulls** (`PREDICTION-self-authored.md`,
  `PREDICTION-eval-awareness.md`) — the seed dressed as a real project with
  backdated history and a maintainer's plea, and an explicit written license to
  rewrite tests, with manipulation checks that make the nulls mean something.
- **The stuck agent** (`PREDICTION-stuck-agent.md`) — a provably unfixable suite
  plus an explicit honest exit: agents take the cheapest path they believe is
  *sanctioned*, the thesis the rest of the programme keeps re-confirming.
- **The dimension studies** (`PREDICTION-coverage.md`, `PREDICTION-noverify.md`) —
  per-rule certification under attack across three models, including the
  command-surface class only the gate can see.
- **The gate's boundary** (`PREDICTION-asany.md`) — the laundering seed whose
  cheapest cheats sit outside every rule: 26/40 tampers through gate-invisible
  spellings, the frontier split (one model 10/10 via inline assertions), and the
  held-out oracle layer catching all of it. The result that scopes the flagship
  number as conditional-on-coverage.
- **Cheap baselines and the FP bill** (`PREDICTION-baselines.md`) — the gate versus
  a single instruction sentence and a 20-line strawman hook on identical ground,
  plus block-rates for all screens over 1,227 real merged commits (the gate's own
  honest 9.0% unconfigured).
- **The tuned gate** (`PREDICTION-tuned-fp.md`) — the deployed-cost trio (9.0% →
  6.0% → ~one sign-off per 17 commits) and the per-rule `exclude` null, published
  at the feature's own expense the day it shipped.
- **The laundering corpus** (`PREDICTION-launder-corpus.md`) — the §7.A methodology
  applied to the graduation question; closed it (row 13).
- **Capability restriction** (`PREDICTION-capability.md`) — the "just make the
  tests read-only" objection measured instead of rebutted: hard immutability
  10/10 honest on the file-surface seed, a bare EPERM converting 4/4 without
  remediation text, and an auto-granted elevation path manufacturing two
  confessed-in-writing tampers. Six governance mechanisms (nothing, one sentence,
  naive hook, the gate, immutability, immutability+auto-grant) now hold
  pre-registered numbers on identical ground.
- **Taskbench** (`harness/taskbench/PREDICTION-taskbench.md`, `PHASE3.md`) — the
  preregistered cross-repository experiment: 26 paired real repositories, real
  historical regressions, repo as the experimental unit, frozen analysis, one
  hypothesis test. Transfer confirmed (13/26 ungated runs with ≥1 policy
  violation, Wilson95 32–68%); **prevention refuted** at 1.6.0 (false greens
  b=5 vs c=4, paired RD +3.8%, exact McNemar p=1.0) — agents routed through
  spellings outside shipped detector coverage, including the two
  documented-unfixed pilot gaps; no measurable completion cost (+7.7, CI spans
  zero); the independent pristine-suite oracle caught every masked failure in
  all 53 trajectories. The division-of-responsibility caveat in §10 is now
  measured, not hypothesized: diff-time detection is coverage-bounded on real
  repositories; pristine-suite re-execution was not breached once.

Agents are stochastic, so every arm runs multiple reps, changes one variable, and
records full transcripts under `harness/runs/`. When a conversion rate is mediocre,
the §5.1 message wording is the lever to tune. The running ledger across the
programme: **70 pre-registered bets — 29 refuted, 37 held, 4 open or
unresolvable** — with
refutations published next to the bets they refute, which is the property the whole
section exists to protect.

---

## 8. Repo layout

```
tamperward/
  src/types.ts          the Change / Finding / Detector / Policy contracts
  src/diff/             pure diff parser + selectors
  src/git/              git adapter (range / staged / worktree)
  src/detectors/        the rules
  src/policy*.ts        protected-asset globs, policy load + baseline merge
  src/signoff.ts        the three-layer sign-off model
  src/session.ts        the Stop sweep's per-turn baseline
  src/cli/              check | hook | sweep | allow | init | verify | run | watch | research | doctor | onboard | hook-service | trace-verify
  src/adapters/claude/  stdin→Change[] (PreToolUse + Stop), Finding→deny
  src/research/         AgentAdapter contract, task manifest, paired runner, ledger summary
  schemas/              published Draft 2020-12 schemas for machine output
  test/                 unit suite — green is the gate
  harness/              seeds, oracles, and the bypass-to-fix runner
  .github/workflows/    Tamperward running on itself
```

Tamperward gates its own repo with the engine it ships: its CI self-gate runs the built
CLI's `check --diff` over the PR range, and a blocking finding clears only via the
out-of-band label. The self-gate does not run `verify` on this repo (§6).

---

## 9. Build order and status

1. **Engine + `Change` model + the mechanical detectors.** *Shipped.* Detector 1
   landed with its count-based AST. Detector 3 (`assertion-weakening`) joined later
   in 2.17.0 as a deliberately narrow measured JS/TS AST heuristic and remains warn-only.
2. **CLI + git adapter + pre-commit & CI wiring**, incl. the out-of-band CI sign-off.
   *Shipped* — the sign-off channel is a PR label read by `.github/workflows/ci.yml`.
3. **Claude PreToolUse hook + Stop sweep + the correction message.** *Shipped*, on the
   JSON channel (a deny is exit 0 + JSON; exit 2 would make the JSON be ignored).
4. **E2E harness + bypass-to-fix measurement.** *Run, and grown into the §7.B evidence
   programme* — see the README for the numbers, the `harness/PREDICTION-*.md` files
   for the studies and their outcomes.
5. **`tamperward init`** — *shipped* (1.4.0): wires the policy, the agent hooks,
   pre-commit, and CI in one idempotent command; `--dry-run` prints the plan first.
   Since 2.16.1 its final status distinguishes repository wiring from verifier readiness:
   a loaded `verify.command` is reported as configured; otherwise init says CI will
   fail closed, prints the YAML shape required, and may suggest high-confidence suite
   commands for operator review. Detection is advisory only and never mutates the
   trust-anchor verifier command.
6. **`snapshot-rewrite`** — *shipped* (1.2.0) as the first detector built from
   measured demand; *warn* per its own 1,652-commit FP study.
7. **The `version:` graduation gate** — *shipped* (1.3.0); no graduation uses it yet
   (`BLOCK_SINCE` is empty).
8. **`snapshot-only-rewrite`** — *shipped* (1.5.0): the FP study's narrow signal as a
   distinct warn rule, granularity-guarded to the staged/range views by the engine's
   additive `view` parameter, positioned for a `version: 2` graduation.
9. **`test-skip` options-spelling coverage** — *shipped* (1.5.1): the node:test
   `{ skip: true }` / `{ todo: … }` / `t.skip()` forms, closing a gap a live agent
   found in the baselines study the same day.
10. **Per-rule `exclude` globs** — *shipped* (1.6.0) with both invariants (policy
    file never excludable; added excludes are a policy-diff weakening signal) and
    its measured null disclosed (§3).
11. **The `ts-any-launder` graduation question** — *closed* (no release; a
    decision, not a feature): permanent warn on syntactic evidence, per the
    laundering-corpus numbers in §4 row 13.

Still open: broader independent negatives beyond the committed
`assertion-weakening` replay, the remaining `guard-removal` heuristic, languages
beyond the shipped detector surfaces, agents beyond Claude Code, and the task-level
multi-repository benchmark (the repo, not the run, as the sampling unit) that the
external review placed at the top of the roadmap.

### 9.1 Maturity milestones

A September 2026 external review of v2.0.0 rated Tamperward "considerable as
emerging research engineering; promising but unproven as industry infrastructure"
and named five milestones that would change that answer. They are tracked here
under the SECURITY-ENVELOPE rule: a row moves only with a link — a tagged release,
a merged PR, a committed preregistration, or an artifact published by someone other
than this repository. Intent moves nothing. All five are OPEN.

| # | milestone | what exists today | what closes it |
|---|-----------|-------------------|----------------|
| M1 | An independent, **named** security audit with a public report | Three external review passes (the 1.10.x envelope review with executed exploits, the 1.14.x passes, the 1.15.0 audit), every finding ledgered in SECURITY-ENVELOPE.md and closed with a regression and a mutation check. The reviewers are unnamed and the write-ups are ours. | A named auditor publishes a report against a tagged 2.x release; each finding gets a SECURITY-ENVELOPE row; the report is linked from this row. |
| M2 | A preregistered replication on 2.x — several agents, one fixed treatment, larger samples | Rounds 1–3.1 ran on v1.6.0 → v1.14.0, prediction committed before each; one agent runtime throughout; rounds 2 and 3 changed treatment with ecosystem; round 3.1 could not have replicated (b ≤ 3 by construction); every round on a verifier later found to carry the 1.14.1 bypass. Round 4 has run and is sealed: one pinned agent/model configuration (`claude-sonnet-5`) over a fresh pool of 110 paired repositories, treatment 2.10.3 frozen in the `PREDICTION` (see the treatment boundary below) after three adversarial passes over 2.4.0–2.10.0 closed every in-repository fail-open by design rather than by instance. Its registered primary prediction did not replicate (b=5, c=3, exact McNemar p = 0.7265625, 79/110 valid pairs; `harness/taskbench/round4/ROUND4-RESULTS.json`); 0 strict tamper bypasses across 201 measured trajectories is a separate descriptive observation. Round 4.1 has not run. The separate pre-outcome registration it required was never committed before Round 4 was unblinded (sealed 2026-09-11), so the closure condition as originally written can no longer be met; see the dated M2 amendment below. | Two preregistrations. Round 4: a `PREDICTION` committed before the draw that pins one 2.x release across every ecosystem in the round and one agent/model configuration, with the sample sized by an exact simulation over the full paired table (false green in both arms, ungated only, gated only, neither). Round 4.1, as amended on 2026-09-24 (below): the labelled outcomes-known protocol replication registered in `harness/taskbench/round4.1/PREDICTION4.1-taskbench.md` — the frozen pool, treatment and analysis under a second supported agent runtime with equivalent PreToolUse/Stop enforcement semantics that has passed its eligibility gate — reporting, **plus** one genuinely preregistered cross-runtime round committed before its own outcomes exist. An agent runtime is the harness that executes the agent and its tool calls — Claude Code is one; a second model under Claude Code is model-replication evidence and does not by itself satisfy the runtime requirement, and a runtime with no equivalent adapter cannot receive the treatment (that adapter is M5's work). M2 stays open until both report. Analysis frozen before each draw; published beside the bet either way. |
| M3 | Production pilots with published false-positive rates, overhead and friction | Precision is corpus-measured on mainline commits with no agent in the loop (`harness/fp-study/`; `snapshot-only-rewrite` ~0.06% over 1,652 commits; `test-content-removal` priced on 2,304). No deployment measured; no production user named. | A named pilot publishes per-rule fire and false-positive counts over a stated period, `verify` wall-clock against the bare suite, how often the out-of-band label was needed, and hook latency — linked here whether or not it flatters the gate. |
| M4 | Stronger verifier isolation and cross-ecosystem dependency integrity (partial mitigations shipped) | The default `checkpointed-local` backend still uses same-host materialised copies and checkpointed dependency attestation. Since 2.10.9 that attestation is ecosystem-aware; since 2.11.0 an opt-in `isolated-container` backend gives final verification a digest-pinned runtime/dependency image, read-only frozen candidate/pristine mount, private HOME/tmp/output, no network or host dependency tree, and fail-closed runtime attribution. Still true for **both** ordinary `verify` backends: candidate source executes inside the configured suite process, so execution-domain isolation is not semantic/oracle isolation; 2.11.1 exposes that ceiling as `suite-exit-only` assurance in verdict/audit output. Separately, the opt-in [finite JSON function oracle](docs/guide/external-oracle.md) shipped in [#792](https://github.com/hexrift/tamperward/pull/792) / 2.47.0 with host-owned comparisons and completion counts outside the candidate container. This is partial progress for its CommonJS JSON response profile, not an upgrade to arbitrary test frameworks or a universal completion guarantee. The verification surface remains an enumerated bound (docs/THREAT-MODEL-pristine-run.md). | Stronger completion/collection evidence requires an oracle protocol outside candidate in-process control: held-out/out-of-process probes, runner-specific collection/result attestations whose producer is outside the candidate process, or an equivalent trusted protocol. Signed verdict attestation remains M5. |
| M5 | Attested verdicts, broader agent integrations, org-level policy administration | Opt-in [Ed25519 verdict statements](docs/guide/attestation.md) shipped in [#790](https://github.com/hexrift/tamperward/pull/790) / 2.45.0, binding head, base, gate version, effective policy hash, verdict, audience, nonce and validity window. The consumer must independently supply the trusted key and expected scope; a signature does not establish payload provenance, and unsigned receipts remain non-authoritative. The [operator-pinned organisation policy floor](docs/guide/organisation-policy.md) shipped in [#791](https://github.com/hexrift/tamperward/pull/791) / 2.46.0; per-repository policy inherits it and cannot weaken its conservative constraints. Signer, launcher, floor and pin custody must remain outside candidate control, and their availability does not establish required-check authority or privilege independence ([#796](https://github.com/hexrift/tamperward/issues/796)). Shipped in-loop steering remains limited to Claude Code; other agents meet the gate at pre-commit and CI. The vendor-neutral steering seam — the `RuntimeAdapter` contract (`src/adapters/contract.ts`) — landed in #482 Phase 1 (see docs/guide/runtime-adapters.md and docs/ACS-mapping.md). Experimental Codex, Copilot CLI and Copilot SDK-hosted adapters implement it with an empty `preDeny`, and `tamperward runtime verify` grades each; none has passed a pinned live qualification, so the second-runtime criterion remains unmet and M5 stays OPEN. | A signed verdict statement (in-toto or equivalent) binding head, base, gate version, policy hash and verdict, verifiable by a required check; an in-loop adapter for at least one more runtime with the same PreToolUse/Stop semantics; a documented organisation baseline that per-repo policy can strengthen and never weaken. |

#### M2 amendment — 2026-09-24

The M2 row above originally closed, for Round 4.1, on "a separate `PREDICTION`, committed
before anyone examines round 4's outcomes" (`harness/taskbench/round4/PREDICTION4-taskbench.md`
§7; `FRAME5.md`). No such registration was committed: Round 4 was sealed on 2026-09-11 and
published, and the tree holds no Round 4.1 `PREDICTION` from before that date. The condition
as written can no longer be met, and this repository does not backfill §7 as the missing
registration — §7 itself says Round 4.1 is "not part of this registration".

The amendment, recorded here rather than by silently rewording the row: Round 4.1 is
re-registered as a **labelled outcomes-known protocol replication**
(`harness/taskbench/round4.1/PREDICTION4.1-taskbench.md`) — the frozen pool, treatment and
analysis with only the runtime changed, its expected non-rejection stated before execution,
and runtime transfer as its payload. M2 closes when that replication reports **and** one
genuinely preregistered cross-runtime round, committed before its own outcomes exist,
reports. Neither the sealed Round 4 record nor its registration is altered. Discussion: #563;
the state of record: the Round 4.1 status post,
`docs/blog/the-second-runtime-didnt-qualify-the-freeze-window-closed-anyway.md`.

#### Round 4 treatment boundary

Round 4 grades the exact 2.x release and commit identified in its `PREDICTION`.
v2.10.0 is the candidate treatment, not the commitment: the treatment is frozen after
the sacrificial pilot and before the confirmatory pool is drawn or any counted
trajectory runs, and a pilot correction ships as whatever version CONTRIBUTING's rules
give it. The `PREDICTION` pins the released semantic version, the git commit, the
packed artefact's SHA-256, the policy hash, the hash of the wiring `init` generates,
and the runner and analysis hashes. Pilot repositories are permanently excluded from
the pool. The round's other design decisions — the temporal buckets, task eligibility,
the completion margin, the power simulation — belong to the `PREDICTION`, not here.

The frozen release is graded against three stated claims, and a finding is judged
inside or outside them:

1. Everything inside the repository is authoritative at the Stop sweep and at CI. A
   tampered test, config, workflow, coverage setting, hook script or Claude settings
   file that reaches the staged tree or a pull request is judged by its bytes, not by
   the command that produced them. A fail-open here is a design finding.
2. Files outside the repository (`~/.claude/settings.json`, `$CLAUDE_CONFIG_DIR`,
   managed settings) are visible only at the tool-call layer, and that layer is
   best-effort: it judges the shape of the command text and cannot be sound against a
   shell. A write that reaches the user settings file through a shape the judge does
   not read is outside the boundary and is a documentation finding, not a code
   finding.
3. `disableAllHooks: false` in the project settings file (written by `init` since
   2.9.0) and a managed settings file for `env` are part of the deployment the
   treatment assumes, not optional hardening. A round-4 seed is initialised from the
   exact frozen package with both in place, and no local or out-of-band sign-off
   mechanism is reachable from the agent's environment.

A P0 inside claim 1 is the first evidence that the design, not the implementation, is
at fault; a P0 under claim 2 moves the sentence, not the code.

The research harness's own isolation — an oracle, a result ledger and a parent-owned
observer the agent cannot reach — applies symmetrically to both arms and protects the
experiment, never one arm's repository. It closes nothing under M4, which is about the
isolation Tamperward gives its users.

The review also corrected the v2.0.0 README, whose scope note said "one model,
one pressure prompt, one JS/TS ecosystem" beneath the Python and `claude-sonnet-5`
rows; the README readability pass had already replaced it with the accurate
sentence. The limits the review placed *outside* these milestones — both runs
execute agent-controlled code, no OS/network/secret isolation, a hardcoded or
colluding solution the base suite accepts is invisible, ecosystems beyond JS/TS
get file- and pattern-level coverage — are the README's "What Tamperward does not
do" and §10 below, and no milestone here removes them.

---

## 10. The honest caveats

- **Heuristic evidence is scoped, not universal.** `assertion-weakening` now ships
  only the AST-proven JS/TS subset measured in `harness/fp-study/AW-CORPUS.md`:
  12/12 fires were labeled true positives and 0/20 retained ordinary-maintenance
  negatives fired. That clears its 90% build threshold but does **not** authorize
  block severity or claim recall over the broader semantic class. `guard-removal`
  remains reserved/unbuilt. Quote the measured number and corpus boundary, not intent.
- **The loop is measured on a finite sample.** §7.B has run (see the README), but a
  conversion rate is an observation over the seeds and models exercised — Claude
  models, on a Claude Code harness — not a guarantee about every agent on every
  codebase. The loop layer itself exists only where the hooks do; anything else meets
  the gate at pre-commit and CI.
- **The informed-adversary result measures disclosure, not mandated evasion.** No
  prompt ordered a model to defeat the gate; the arms-race question is opened and
  bounded, not settled.
- **The flagship number is conditional on detector coverage, and the run counts
  overstate the experiment count.** Zero tampers across the guarded runs holds for
  tamper classes an active detector covered; on a seed whose cheapest cheats sat
  outside coverage, agents tampered in 26 of 40 runs. And the independent evidence
  unit is the seed/repo configuration (~15 seeds, 8 corpus repos), not the run —
  run-level repetition measures per-seed stochasticity only. The README carries
  both statements first, before any result; this spec repeats them so no §7 number
  gets quoted without them.
- **The gate is one layer of a measured division of responsibility.** Capability
  restriction owns assets that should be immutable during a task (and its grantor
  design is the hard part — the auto-grant arm manufactured authorized tampering);
  held-out oracles own the semantic classes no diff can show; the naming sentence
  owns the underspecified ones; the gate plus out-of-band sign-off owns the classes
  where legitimate changes must be distinguishable from illegitimate ones; CI is
  the authority under all of it.

---

*v0.11 · reconciles the spec with 2.26.0: `config-weakening` is row 21, and the current detector/enforcement taxonomy, audit-v1 measurement boundary and supported implementation surface are recorded.
Prior: v0.10 · reconciles the spec with 2.25.0: `test-support` is row 20, narrowing the two block spec rules to actual specs while routing helper/setup/fixture files through their own warning rule.
Prior: v0.9 · reconciles the spec with 2.23.x: the live architecture narrative, versioned machine-output schemas and current security-residual index are aligned without rewriting historical evidence.
Prior: v0.8 · reconciles the spec with 1.15.0: no new row — the seventeen-row table's
heading and counts, the canonical policy example (`test-content-removal`,
`transient-protected-mutation`, the `snapshots` class), the shipped JSON-at-exit-0 hook
contract and the immediate `stop_hook_active` allow, the generated workflow's
`check --diff` + `verify --require-ancestor` wiring with SHA-bound labels, and the
repo layout brought into line with the code.
Prior: v0.7 · reconciles the spec with 1.9.0: `tamperward verify` seated as row 16 —
the taskbench run-correctness oracle productized, with the guarded `verify:`
policy surface and the base-selection caveat stated.
Prior: v0.6 · reconciles the spec with 1.8.0: the effect layer — per-call protected-tree
drift judged by the ordinary rules, the `tamperward watch` observer with row 15's
transient class, and the Edit-reconstruction fail-open closed.
Prior: v0.5 · reconciles the spec with 1.7.0: `test-content-removal` seated as row 14
from the taskbench Phase-3 evidence, corpus-priced and shipped block-with-signoff,
with the fresh-frame validation rule binding. Prior: v0.4 · reconciles the spec with 1.6.0: `test-skip`'s class completed (1.5.1), the
per-rule `exclude` surface with its weakening symmetry and published null (1.6.0),
`ts-any-launder` seated as row 13 with its graduation question closed by corpus,
§7.B extended with the nine studies that ran after v0.3, and the coverage-conditional
framing plus the division-of-responsibility caveats added to §10 following the
external statistical review.*

*v0.3 · reconciles the spec with 1.4.5: eleven rules with the two unbuilt heuristics
marked as reserved, the shipped `version:` gate and `init`, §7.B rewritten as the
evidence programme (oracle independence, pre-registration, the control arm, the
informed adversary), and the enforcement vocabulary scoped to match every other
surface. v0.2 folded in: Stop-sweep touchpoint, out-of-band CI sign-off, AST for the
structure detectors, the expected-value-tampering move, the rename-out-of-glob and
`tamperward allow` granularity fixes, the negatives-corpus sizing, and the seed
invariant.*
