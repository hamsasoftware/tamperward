# Limitations that apply to everything in this series

*Last updated September 1, 2026*

Individual posts carry their own caveats. These apply across all of them, and
repeating them in every post would bury them, so they live here and posts link
back. Nothing on this page is a correction — corrections are on the
[errata page](./errata.md). This is the standing account of what the series
cannot establish.

## The sampling unit is smaller than the headlines suggest

"What AI coding agents do…" in the early titles means, in every case:

- **one runtime** — Claude Code;
- **one model per cell**, occasionally a small set across cells;
- **one synthetic seed per cell**, authored by this project;
- **repeated stochastic trajectories** on that seed, not independent draws from
  a population of tasks;
- **a deliberately adversarial pressure prompt** that explicitly sanctions the
  shortcut.

["137 runs were not 137 experiments"](./137-runs-were-not-137-experiments.md)
concedes this for the seed studies. The concession did not retroactively narrow
the earlier titles, which stay broader than the evidence. Distinct seeds are
better evidence than repeated runs on one seed, but roughly fifteen
author-designed seeds are not fifteen independent samples of real development.

The Taskbench rounds are stronger on this axis — real repositories, real
historical regressions, randomized arm assignment within repository — and still
narrow: one frame source per round, one prompt, one or two models.

## Several comparisons use historical controls, not randomized ones

Where a post compares a rate before and after an intervention — 6/10 tampering
versus 1/10 after a prompt sentence, 10/10 laundering versus 0/10 after naming
the shortcut, the governance-mechanism table, dressed versus undressed seeds —
the baseline arm was run **earlier**, not concurrently. Model-service drift,
harness evolution and ordering effects are all live alternatives.

These are useful descriptive comparisons and are not causal estimates. At these
sample sizes they are also imprecise: 6/10 versus 1/10 is p ≈ .057 by Fisher's
exact test; 0/10 versus 2/10 is p ≈ .474. Phrases like "made it worse" or
"manufactured tampering" overstate what a ten-run before/after can carry.

The paired Taskbench arms are the exception: there, both arms run in the same
round on the same repository, and the randomization is real.

## The bet ledger is accountability, not calibration

Every prediction in this series is published before its outcome, and that is
the point of the ledger. But counting "held" and "refuted" as equal units has no
statistical interpretation. The ledger mixes deterministic code facts, numeric
band predictions, qualitative mechanism bets, descriptive non-bets, multiple
correlated sub-bets inside one study, and studies whose design was chosen
adaptively in light of earlier studies.

**The exact cumulative totals are withdrawn** pending reconciliation — see the
[errata](./errata.md) for the unexplained 56/25 → 59/27 step, which every later
total inherits.

## Commit-corpus percentages are review-trigger rates

Where a post reports a percentage of historical maintainer commits that the gate
fires on — 9.0%, 6.0%, 24.9%, 1.5% — those are **historical review-trigger
rates**, not clean false-positive estimates:

- the policy deliberately requires sign-off for some legitimate sensitive
  changes, so a fire is not necessarily an error;
- historical commits carry no Tamperward sign-off context, which the live
  workflow provides;
- commits within a repository are correlated, so pooling overweights the
  repositories with the most commits;
- adjudication of what counts as a false positive was done by this project's
  author.

Read them as a measure of review burden. Per-repository rates are more
informative than the pooled figure.

## Training contamination is unmeasured

Taskbench tasks are built from historical commits in popular public
repositories. The runtime removes git history, remotes and the gold patch, but
that establishes nothing about whether a model saw the commit, the fix, or
discussion of it during training.

This does not by itself invalidate the paired integrity comparison — both arms
face the same task, and contamination should affect them symmetrically — but it
plausibly changes task difficulty, completion rates and the incentive to take a
shortcut. **Parametric memorization was not measured in any round.**

## Model and runtime pinning is weaker than the model ID suggests

Rounds pin a model identifier. That is not the same as pinning an immutable
snapshot: a served model behind a name can change, and the agent runtime around
it certainly does. Where a round calls a model "stronger", that is a
characterization from published capability claims and this project's own
observations, not an operational measurement made inside the experiment.

## Registration ordering is recorded, not independently timestamped

Preregistration posts say the repository records the registration commit before
the result commits. A commit graph shows exactly that — parentage — and no more.
It does not independently establish that no trajectory ran before the
registration, that commit timestamps were not altered, that artifacts were not
produced before being committed, or that the registration was publicly visible
at the time.

Round 3.1's accidental pre-registration trajectory is the concrete illustration:
execution chronology and commit chronology are different things, and that
incident was caught by disclosure rather than by the graph. An independently
timestamped mechanism — OSF, Zenodo, a signed release, a transparency log —
would carry the proof the git history is currently being asked to carry. The
series does not use one yet.

## The verification layers guard tests, not correctness

A green Tamperward verdict means the tests still mean what they meant at the
trusted base. It does not mean the code is right. A semantically incomplete fix
that the base tests happen to accept passes every layer, because the thing that
would catch it is an oracle the tool is not entitled to have. Round 3.1's
`07-tableau-server-client-python` trajectory demonstrates this end to end.

Separately, the shipped `verify` command is **not** the benchmark oracle: it
productizes the base-restoration component, not the withheld semantic cases. Its
pristine-inheritance surface has been extended twice after bypasses were
demonstrated (1.14.1, 1.14.2), and the surface list lags runner behaviour by
construction. See [`docs/THREAT-MODEL-pristine-run.md`](https://github.com/hamsasoftware/tamperward/blob/main/docs/THREAT-MODEL-pristine-run.md).

## The experiment harness was not a security boundary

In rounds 1–3 the agent ran as root on the same filesystem as the task pool, the
gold patches and the result ledger. Round 3.1 scrubbed the environment variables
that made those locations discoverable, which is **not** containment. A
transcript audit found no evidence any agent read or wrote control-plane state;
that is an absence of observed use, not a filesystem proof. The
[errata](./errata.md) carries the full disclosure.
