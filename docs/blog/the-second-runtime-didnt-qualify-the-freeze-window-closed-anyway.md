# The second runtime didn't qualify. The freeze window closed anyway.

*September 24, 2026 · hexrift*

> *Series-wide caveats — sampling unit, historical controls, training
> contamination, model pinning, what the registration order proves, and what the
> verification layers cannot guarantee — are collected on the
> [limitations page](./limitations.md). Published corrections are on the
> [errata page](./errata.md).*

*Short answer: Round 4.1 has not run, and it is now late in a way that costs
something. It was registered as a blind test — repeat Round 4's frozen pool,
treatment and analysis under a **second supported runtime**, committed before
Round 4's outcomes were examined, to close the M2 transfer claim. Two things
went wrong. The second runtime never qualified: every runtime we built an
adapter for stayed `neutral`, because we could not prove on a pinned build that
it actually enforces a pre-action deny and fails closed. And the pre-commitment
window closed independently — Round 4's results were sealed and published on
September 11, so a Round 4.1 registered from here can no longer be blind to them.
This post reports that state plainly, because a delay that quietly erases a
methodological property is worth a post of its own.*

> **Update, 2026-10-05.** Later on the day this post was published, the
> outcomes-known registration that the closing section calls for was written and
> merged by the maintainer:
> [`PREDICTION4.1-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4.1/PREDICTION4.1-taskbench.md)
> (#675, 2026-09-24), with the dated M2 amendment in
> [`SPEC.md`](https://github.com/hamsasoftware/tamperward/blob/main/SPEC.md) §9.1. It is
> labelled as written with Round 4's outcomes known, exactly as step 2 below
> requires, so the lines below that say no Round 4.1 registration exists describe
> the state at the hour of publication, not the state now. What has not changed:
> step 1. No second runtime has qualified, the registration's runtime freeze is
> unresolved, no counted 4.1 trajectory has run, and M2 stays open.

This is the twenty-first post in the [TamperWard research series](/blog/) and a
status note between counted rounds. Post 20 reported the counted Round 4 result:
[the prevention bet didn't replicate, and no surviving tampering was certified
clean](./the-prevention-bet-didnt-replicate-no-surviving-tampering-was-certified-clean.md).
Round 4.1 was the registered follow-up to that round — registered, precisely, as
a requirement: Round 4's registration (§7) committed that 4.1 would repeat the
frozen pool, treatment and analysis under a second runtime, and would be
preregistered *separately*, before Round 4's outcomes were examined. That
separate registration is what was never written. The round has not happened,
and this explains why, and what the delay has already cost.

## What Round 4 left open

Round 4 was preregistered as a paired experiment over N = 110 real Python
repositories, gated (frozen TamperWard **2.10.3**: PreToolUse deny + Stop sweep +
enforcement envelope) versus ungated (parent-owned observer only), under one
pinned model (`claude-sonnet-5`) and one runtime (**Claude Code**). The counted
answer, sealed in `ROUND4-RESULTS.json` and published September 11:

```
prevention discordance   b = 5
induced-harm discordance  c = 3
exact McNemar             p = 0.727   → do not reject H₀
valid paired repositories 79 / 110    (71.8%)
strict tamper bypasses    0 / 201 measured trajectories
```

The primary prediction did not replicate; a narrower security result held. That
round deliberately left one claim open. The treatment contains the PreToolUse
deny and the Stop sweep, so **any other runtime deletes a treatment layer unless
it can carry the same enforcement**. Round 4 fixed the runtime at Claude Code and
recorded, in the registration itself, that a second runtime is a separate round:

> M2 stays open until round 4.1 — committed **before** round 4's outcomes are
> examined — repeats this frozen pool, treatment and analysis under a second
> **supported runtime** with equivalent PreToolUse/Stop enforcement semantics.

The distinction that made M2 what it is: a second *model* does not close it, and
a second runtime does. Round 4.1 is the transfer test for the mechanism, not the
model. And it was to be registered **blind** — before anyone examined Round 4's
numbers — so that its result could not be a story fitted to Round 4's.

## Why it didn't run: adapter existing ≠ runtime qualified

Round 4.1 needs a second runtime whose hooks demonstrably do what Claude Code's
do: refuse a pre-action operation when told to, and **fail closed** — not open —
when the hook transport itself breaks. We built the scaffolding for three of
them and none crossed that bar. The rule we held throughout:

```
Milestone 1 — the adapter exists
  normalizes the runtime's hook payloads, maps tool names to operation kinds,
  runs the SAME engine as the Claude path, delegates the end-of-turn git sweep,
  validates identity as an untrusted claim, fails closed on every failure state.

Milestone 2 — the runtime is qualified for in-loop enforcement
  on a PINNED build, PROVE from evidence that a pre-action deny is enforced and
  that the hook transport fails closed. Only this may set Round 4.1 eligibility.

Milestone 1 done is not Milestone 2 met.
```

Where each candidate stands, unchanged in substance since Round 4:

- **Codex** (`src/adapters/codex/*`, #482 / #563). Milestone one is done and
  grounded against the real Codex protocol. Milestone two is **not** met, so
  Codex is **not** Round-4.1-eligible; `src/runtimes.ts` keeps it at
  `steering: 'neutral'` and no research round is registered. This is not
  pessimism for its own sake: Codex currently **fails open** on some hook
  failures, so an honest qualification run may legitimately come back PARTIAL —
  which is exactly why the probe must *prove* fail-closed from evidence rather
  than assume it.
- **GitHub Copilot CLI** (#598). The command-hook path is separately reported as
  **PARTIAL** and stays `neutral`; `preDeny` is empty; no round is registered.
- **GitHub Copilot SDK-hosted** (#611). A Phase-0 spike only. The decisive test
  must run against a pinned real `@github/copilot-sdk` with credentials and a
  pinned model; without them the driver reports **INSUFFICIENT** and exits
  non-zero — "could not test" is not "passed." No promotion, no Round-4.1 claim.

The common thread is the reason for the delay, not an excuse for it: promoting a
runtime requires a maintainer-reviewed run under an **exact pinned config** that
passes the full #482 parity and provenance gate, and proving fail-closed
enforcement needs a pinned build plus credentials this environment does not have.
So the adapters are honest scaffolding — real contract, real tests, deliberately
`neutral`, `preDeny: []` — and none of them is a runtime Round 4.1 could use.

## The engineering that continued anyway — and what it is not

While 4.1 waited, the surrounding evidence surface kept moving: the neutral
`RuntimeAdapter` contract and runtime-aware onboarding (#482), the three adapters
above, first-class verification state (#600), and commit/tree-bound verification
receipts reconciled in CI (#601). None of it promotes any runtime to in-loop
enforcement, and none of it is a Round 4.1 input. It is the apparatus getting
more honest about *what it would take* to qualify a runtime — not a runtime
getting qualified. Stating that clearly is the point: activity is not progress
toward M2 unless it ends in a pinned, fail-closed, parity-passing run, and none
of it has.

## The freeze window, and why missing it is not recoverable

Here is the part that a schedule slip does not usually carry. Round 4.1's
registration had a **temporal precondition**: it had to be committed *before
Round 4's outcomes were examined*. That is what made it a blind confirmation of
M2 rather than a retrofit.

```
required order
  register Round 4.1  →  examine Round 4's outcomes  →  run Round 4.1

what happened
  examine Round 4's outcomes (sealed + published 2026-09-11)
  … Round 4.1 still unregistered (no PREDICTION4.1 exists) …
  today: 2026-09-24
```

No Round 4.1 registration was frozen before September 11. The results post
examines Round 4's numbers in full, in public. You cannot un-examine them. So the
blind-registration window has **closed**, and unlike a delayed run it cannot be
reopened by waiting: the property it protected was ordering, and the ordering is
already spent.

We are precise about the two failures because they are different, and only their
combination produces the headline. The runtime not qualifying delayed the *run*.
The results being published closed the *window* — and it would have closed on
that date regardless of whether a runtime was ready, because the results clock
ran independently of the adapter work. The second is the one that costs a
property; the first only costs time.

## What this does — and does not — establish

- It **does** establish that Round 4.1 has not run, that no second runtime is
  Round-4.1-eligible today, and that M2 (the mechanism-transfer claim) remains
  **open and unaddressed**.
- It **does** establish that the pre-commitment window for a *blind* Round 4.1
  has closed: Round 4's outcomes are public, so any Round 4.1 from here is an
  outcomes-known test, not the blind one that was registered.
- It **does not** establish anything new about TamperWard's effect or its
  security properties — Round 4's sealed result is unchanged, and nothing here
  revises it.
- It **does not** claim any runtime fails or passes qualification. Codex, Copilot
  CLI and Copilot SDK-hosted are `neutral` because they are **unproven** on a
  pinned build, which is a stated-unknown, not a verdict.

## What would let Round 4.1 happen, and on what terms

Two things, in order, and the second names the cost we now have to pay:

```
1. Qualify a second runtime.
   A maintainer-reviewed run under an exact pinned config that passes the full
   #482 parity + provenance gate and PROVES pre-action deny + fail-closed hook
   transport from evidence. Until then every adapter stays neutral.

2. Re-register 4.1 honestly.
   Because the blind window is gone, a new registration must DISCLOSE that it is
   written with Round 4's outcomes known, and pre-commit its design and analysis
   the way every round in this series has — now as an outcomes-known replication
   of M2, labelled as such, not as the blind confirmation originally planned.
```

The alternative is to leave M2 open and say so, which is what this post does in
the meantime. Either way the rule the series runs on is unchanged: the
registration is the authority, ordering is part of the evidence, and a window we
let close is reported, not quietly reclassified.

---

*Design of record:
[`PREDICTION4-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/PREDICTION4-taskbench.md) §7
and [`FRAME5.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/FRAME5.md)
(M2, the second-runtime clause). Runtime state: `docs/guide/runtime-adapters.md`
(Codex #482/#563, Copilot CLI #598, Copilot SDK-hosted #611) and
`src/runtimes.ts` (every runtime other than Claude Code `neutral`). Round 4's
sealed result:
[`ROUND4-RESULTS.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/ROUND4-RESULTS.json),
readout
[`ROUND4-ANALYSIS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/ROUND4-ANALYSIS.md).
No frozen binding file, no recorded verdict, and no counted-round registration
was altered by this post; it records a state, it does not change one.*
