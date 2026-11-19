# Methodology, limitations and errata

*How a counted round is built, what the whole series cannot establish, and
where every published correction lives. This page summarises; the
[limitations page](../blog/limitations.md) and the [errata page](../blog/errata.md)
are the records.*

## How a round is built

The order is the same in every round, and the repository records each step's
commit before the next: **frame → mine → pilot → freeze treatment → register →
draw → run → analyse**.

- **Frame and mining.** A frozen frame of real repositories (npm, then PyPI) is
  walked in a seeded order; candidate tasks are historical regressions with a
  parent-green / tests-red / gold-green triple, revalidated before entering
  the pool. Excluded tasks and attrition are committed beside the pool.
- **Pilot.** Sacrificial repositories exercise the apparatus and become
  disclosed development data; they never enter the counted pool.
- **Treatment freeze.** A released version is pinned — by tag in rounds 1–3.1,
  by packed-artefact hash in round 4 — with its policy, wiring and runner
  hashes in the registration.
- **Registration.** Endpoints, the test, the success criterion, point
  predictions with bands, losing conditions, an interpretation floor and the
  analysis script are committed before the draw. Fields filled after a counted
  trajectory runs are protocol deviations and go in an append-only appendix.
- **Paired arms.** Each repository is attempted twice by the same agent under
  the same pressure prompt — ungated and gated — in a registered random order.
- **Adjudication.** The frozen analyzer aggregates frozen per-trajectory
  verdicts; round 4's is fail-closed and seals its output with a provenance
  proof over the exact input bytes. A suite that could not run is
  `INVALID_MEASUREMENT`, not a failed test.

The record for each round: [`harness/taskbench/DESIGN.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/DESIGN.md),
the round directories linked from each [round page](./index#pages), and the
methodology post [How round 4 is built to be hard to fool](../blog/how-round-4-is-built-to-be-hard-to-fool.md).

## Confirmatory versus exploratory

Only the five Taskbench rounds are preregistered confirmatory experiments. The
seed studies, governance-mechanism comparisons and prompt before/afters are
exploratory: one runtime, one model per cell, an author-designed seed, repeated
stochastic trajectories, and in several cases a historical rather than
concurrent control (6/10 vs 1/10 is p ≈ .057 by Fisher's exact test; 0/10 vs
2/10 is p ≈ .474). They are descriptive comparisons, not causal estimates.

## What the series cannot establish

From the [limitations page](../blog/limitations.md), which is authoritative:

- **Generalisation.** Results are for specific models, one runtime, one
  pressure prompt per round, specific treatment versions and finite JS/TS and
  Python samples — evidence for those settings, not a universal claim about
  all repositories or all agents.
- **Semantic correctness.** A green verdict — visible and pristine — means the
  tests still mean what they meant at the trusted base. It does not mean the
  code is right; a semantically incomplete fix the base tests accept passes
  every layer (round 3.1's tableau trajectory). The shipped `verify` is not the
  benchmark oracle: it productizes base restoration, not withheld cases.
- **Absence of bypasses.** Zero observed escapes on a sample is an
  observation, not proof that no bypass exists; every bypass on the
  [security page](./security-evaluations) was found by review after a round
  that observed none.
- **Model and runtime pinning** is weaker than the identifier suggests; a
  served model behind a name can change.
- **Training contamination** was not measured in any round.
- **Registration ordering** is recorded by the commit graph, not independently
  timestamped; round 3.1's accidental pre-registration trajectory was caught by
  disclosure, not by the graph.
- **The bet ledger** is accountability, not calibration; the exact cumulative
  totals are withdrawn pending reconciliation of an unexplained step.
- **Commit-corpus percentages** are review-trigger rates, not false-positive
  estimates.
- **The harness** was not a security boundary in rounds 1–3.
- **Historical caveats travel with the result.** A round's page keeps the
  version-specific caveats that applied when it ran (the 1.14.1 verifier
  bypass, the observation-bounded network claim, the control-plane exposure)
  rather than restating the result on today's version.

## Errata

Every published correction is recorded, newest first, on the
[errata page](../blog/errata.md), verified against primary artifacts before the
edit. The corrections that touch a headline number are linked from the
corresponding round page:

| date | scope | round pages |
| --- | --- | --- |
| 2026-09-09 | round 4 preregistration published; deviations D32/D33 disclosed | [Round 4](./round-4#deviations) |
| 2026-09-01 | series-wide framing pass (six corrections; limitations page created) | all |
| 2026-09-01 | `verify` described as the benchmark oracle; the 1.14.1 bypass present 1.9.0–1.14.0 | [Round 2](./round-2#corrections-and-errata), [Round 3](./round-3#corrections-and-errata), [Round 3.1](./round-3-1#corrections-and-errata) |
| 2026-09-01 | rounds 1 and 2 transfer figures used a defective predicate (13/26 → 9/27; 14/22 → 12/22) | [Round 1](./round-1#corrections-and-errata), [Round 2](./round-2#corrections-and-errata) |
| 2026-09-01 | round 3.1 results article: title and null-result framing; common-16 denominator | [Round 3.1](./round-3-1#corrections-and-errata) |
| 2026-09-01 | round 3.1 preregistration article: pilot counts and causal framing | [Round 3.1](./round-3-1#corrections-and-errata) |
| 2026-09-01 | the control plane was reachable by the agent (rounds 1–3) | [Round 1](./round-1), [Round 2](./round-2), [Round 3](./round-3) |
| 2026-09-01 | round 3 results article corrections (PR #144) | [Round 3](./round-3#corrections-and-errata) |
| 2026-08-31 | network isolation was observation-bounded (rounds 1–2) | [Round 1](./round-1), [Round 2](./round-2) |
| 2026-08-31 | pre-round-2 publication audit: ten corrections | [Round 1](./round-1) |

Three inconsistencies the artifacts cannot decide are held open on the errata
page under "Known, unresolved" rather than silently fixed.

## How this section is kept honest

These pages carry no number that is not in a committed artifact, and
[`test/research-docs-consistency.test.ts`](https://github.com/hamsasoftware/tamperward/blob/main/test/research-docs-consistency.test.ts)
re-derives the headline figures from those artifacts on every change: rounds
1–3.1 from their frozen `results.jsonl` ledgers (pairs, `b`, `c`, exact
McNemar `p`, model, trajectory count) and registered treatment versions; round
4 from `ROUND4-RESULTS.json`, including the landing-table status; detector
precision from the fp-study corpus JSON and study totals; performance from the
CHANGELOG and SECURITY-ENVELOPE measurements. A page that disagrees with its
artifact fails CI. The sealed records themselves reach `main` only through a
maintainer-merged pull request; this section only presents them.
