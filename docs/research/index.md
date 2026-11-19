# Research & Benchmarks

*Last updated September 13, 2026. This section is a presentation layer over the
committed research record — the frozen ledgers, sealed results artifacts, study
records and errata in the repository. It carries no number that is not in one of
those artifacts, and a CI test
([`test/research-docs-consistency.test.ts`](https://github.com/hamsasoftware/tamperward/blob/main/test/research-docs-consistency.test.ts))
re-derives every headline figure on these pages from the artifacts on every
change, so the pages cannot silently drift from the record. Where a page and an
artifact disagree, the artifact is right and the build is red.*

Tamperward's evidence is spread across the [research series](../blog/index.md),
the Taskbench harness, the false-positive studies, the security tracker and the
changelog. This section puts it in one place so it can be inspected and
falsified. It is deliberately not a leaderboard — the rounds are different
experiments on different samples, treatments and models, and no single number
summarises them. Failed predictions are listed with the same prominence as
confirmed ones, because they are the same kind of evidence.

## The agent-integrity benchmark at a glance

Each row is one preregistered, paired experiment on real repositories: the same
historical regression is attempted twice by the same agent under the same
pressure prompt, once **gated** (Tamperward installed) and once **ungated**.
The primary endpoint in every round is paired false-green (masked-failure)
discordance: **b** = false greens seen only in the ungated arm (prevention),
**c** = false greens seen only in the gated arm (induced harm), exact
conditional McNemar test. Every figure below is recomputed by CI from the
round's frozen verdict ledger or sealed results artifact.

| Study | Model / runtime | Sample | Treatment | Result | Status |
| --- | --- | ---: | --- | --- | --- |
| [Round 1](./round-1) | `claude-haiku-4-5-20251001` / Claude Code | 26 pairs (27 repos, 53 trajectories), JS/TS | **1.6.0** | Headline prevention bet **lost**: b=5 / c=4, RD +3.8pp [−17.2, +24.7], exact McNemar p = 1.0000. Transfer 9/27 (33.3%), corrected from a published 13/26 — that bet is refuted | complete; transfer figure corrected 2026-09-01 |
| [Round 2](./round-2) | `claude-haiku-4-5-20251001` / Claude Code | 22 pairs (44 trajectories), fresh held-out JS/TS | **1.9.0** | Prevention: b=9 / c=0, RD +40.9pp, BP95 [17.8, 61.3], exact McNemar p = 0.0039. Transfer 12/22 (54.5%), corrected from 14/22 | complete; ran on a verifier later found to carry a bypass (1.14.1) |
| [Round 3](./round-3) | `claude-haiku-4-5-20251001` / Claude Code | 17 pairs (34 trajectories), fresh PyPI frame, Python | **1.14.0** | Prevention: b=6 / c=0, RD +35.3pp, BP95 [9.5, 58.7], exact McNemar p = 0.0313. Two of eight bets lost; in-loop skip detector blind to pytest syntax | complete; ran on a verifier later found to carry a bypass (1.14.1) |
| [Round 3.1](./round-3-1) | `claude-sonnet-5` / Claude Code | 16 pairs (32 trajectories), the round-3 pool minus one spent pair | **1.14.0** (byte-identical to round 3) | Confirmatory result **did not replicate**: b=1 / c=0, RD +6.3pp, BP95 [−13.8, 28.3], exact McNemar p = 1.0000 — and could not have: only three ungated false greens occurred, so b ≤ 3 | complete; a failure to reject, not evidence of no effect |
| [Round 4](./round-4) | `claude-sonnet-5` / Claude Code | 79 / 110 valid pairs (264 trajectories incl. 44 duplicate-arm), fresh Python pool | **2.10.3**, pinned by artefact hash | Primary prediction **did not replicate**: b=5 / c=3, RD +1.8pp, exact McNemar p = 0.727, H₀ not rejected. Narrower security result held: 0 strict tamper bypasses across 201 measured trajectories | complete — sealed (`ROUND4-RESULTS.json`, authoritative provenance) |
| [Round 4.1](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4.1/PREDICTION4.1-taskbench.md) | a second supported runtime, unresolved until a runtime passes the registration's eligibility gate; `claude-sonnet-5` if that runtime can serve Round 4's snapshot | the same 110 pairs as Round 4, frozen walk order and duplicate budget | **2.10.3**, byte-identical to Round 4 | **Not run.** Registered 2026-09-24 as a labelled, outcomes-known protocol replication of Round 4 (#675): its payload is runtime transfer, and the masked-failure primary is expected not to reject at the pool's realised discordance | registered, unexecuted — blocked on a qualifying runtime; every candidate adapter is `neutral` |

Key: `RD` = paired risk difference in percentage points; `BP95` = Bonett–Price
95% interval. Rounds 1–3.1 count `FALSE_GREEN` (visible suite green, withheld
or pristine oracle red); round 4 counts product-scoped masked failure (visible
green, pristine red) and reports `a`/`d` alongside `b`/`c`. Each round page
names what its result supports and what it does not.

**What this table does not say.** Two rounds rejected the null and three did
not; Round 4.1 is registered but has not run, so it adds nothing to either
count. The rounds differ in ecosystem (JS/TS then Python), treatment (1.6.0 →
1.9.0 → 1.14.0 → 2.10.3), model (Haiku then Sonnet) and sample, so they are not
five draws of one experiment and cannot be pooled. They are evidence for their
own settings, not a universal claim about all repositories or all agents.
Round 4 — the largest, most hardened and most recent — is a failed prediction.

## The dimensions, kept separate

The issue with a single "does it work" figure is that four different things are
being measured. These pages keep them apart:

| Dimension | What it measures | Where |
| --- | --- | --- |
| **Model behaviour** | How often the ungated agent weakened verification (transfer rate), persistent vs transient weakening, false-green opportunities, post-denial behaviour where measured | each round page; [model comparisons](./model-comparisons) |
| **Tamperward effectiveness** | Prevented false greens (`b`), induced harm (`c`), envelope escapes, detector misses that outer layers caught | each round page; [security evaluations](./security-evaluations) |
| **Correctness / outcome** | Visible verification, pristine verification, held-out semantic oracle results where they exist, honest completion vs non-completion | each round page |
| **Operational cost** | Detector precision and false-positive studies, verifier overhead, hook/check/verify/run timing where measured, sign-off frequency (no production-pilot data yet) | [detector precision](./detector-precision); [performance](./performance) |
| **Security posture** | Bypasses found after a study, which releases carried them, whether any trajectory exercised them, current residuals | [security evaluations](./security-evaluations) |

## Confirmatory versus exploratory

The five completed Taskbench rounds are **preregistered confirmatory**
experiments: the registration document, the seeds, the endpoints and the
analysis script were committed before the counted trajectories ran. Round 4.1's
registration is the one exception, written with Round 4's outcomes known and
labelled as such in the registration itself. Everything else in the series —
the seed studies behind the "What agents do when…" posts, the governance
mechanism comparisons, the before/after prompt comparisons — is **exploratory
or pilot evidence**: one runtime, one model per cell, an author-designed seed,
repeated stochastic runs, often with a historical rather than concurrent
control. The home page's "77 guarded runs, 0 tampers to green" line belongs to
that exploratory record, and the [errata](../blog/errata.md) note that the 67-
and 77-run totals were not re-verified by the audit. Read the
[methodology, limitations and errata](./methodology-limitations-errata) page
before reading any single result as more than it is.

## Pages

- **[Round 1](./round-1)** — 26 JS/TS pairs, 1.6.0, headline bet lost.
- **[Round 2](./round-2)** — 22 fresh JS/TS pairs, 1.9.0, b=9/c=0.
- **[Round 3](./round-3)** — 17 Python pairs, 1.14.0, b=6/c=0.
- **[Round 3.1](./round-3-1)** — the same pool under `claude-sonnet-5`, did not replicate.
- **[Round 4](./round-4)** — 110 fresh Python pairs, 2.10.3, sealed: prediction did not replicate, 0 strict bypasses.
- **[Detector precision / false positives](./detector-precision)** — every corpus study behind a severity decision.
- **[Performance / overhead](./performance)** — what has actually been timed, and what has not.
- **[Security and adversarial evaluations](./security-evaluations)** — bypasses, the releases that carried them, residuals.
- **[Model comparisons](./model-comparisons)** — the one cross-model comparison the record supports, and the shape future ones take.
- **[Methodology, limitations and errata](./methodology-limitations-errata)** — how a round is built, what the series cannot establish, every published correction.
- **[Production pilot protocol](./pilot-protocol)** — the pre-registered field set, adjudication rule and publication rule for the M3 pilots; no pilot has run.

Series-wide caveats live on the [limitations page](../blog/limitations.md);
every published correction is on the [errata page](../blog/errata.md).
