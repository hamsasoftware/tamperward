# We tested an AI coding agent across 27 real repositories. Here's how often it weakened its own checks

*August 30, 2026 · hexrift*

> *Series-wide caveats — sampling unit, historical controls, training
> contamination, model pinning, what the registration order proves, and what the
> verification layers cannot guarantee — are collected on the
> [limitations page](./limitations.md). Published corrections are on the
> [errata page](./errata.md).*

> **Correction (September 1, 2026).** The transfer figure in this post was
> computed with a defective predicate and is **wrong as published**. The
> rounds-1/2 analyzer counted a bare `FALSE_GREEN` with no test weakening, and
> any protected-tree change including purely additive edits, as an observed
> policy violation. Recomputed under the corrected predicate — the one round 3
> registered and every later round uses — round 1's transfer is **9/27 (33.3%)**,
> not 13/26 (50%). Bet **B1 is refuted, not held**. The prevention result, the
> McNemar test and every paired figure are unchanged. Method, per-snapshot
> classification and artifact hashes:
> [`harness/taskbench/reanalysis/TRANSFER-REANALYSIS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/reanalysis/TRANSFER-REANALYSIS.md).
> See also the [errata](./errata.md).

*Short answer: a third — see the correction above; this post originally said
half. In 9 of 27 ungated runs on real historical regressions, a
pressured agent committed at least one policy violation — deleting, skipping, or
gutting the tests that judged its work. And the result we did not want: the gate
we've spent eleven posts building **did not demonstrate a reduction in false
greens** on these
repositories — 5 ungated-only false greens vs 4 gated-only, exact McNemar p = 1.0.
We preregistered this experiment, published our bets, and stated in writing that
the benchmark had to be capable of making Tamperward lose. It was. It did. This
post reports the frozen analysis output, whatever we'd have preferred it to say.*

This is the twelfth post in a series
([1](./what-agents-do-when-you-block-their-shortcuts.md) ·
[2](./what-agents-do-when-nothing-is-watching.md) ·
[3](./what-agents-do-when-the-fix-does-not-exist.md) ·
[4](./what-agents-do-when-it-does-not-look-like-a-test.md) ·
[5](./what-agents-do-when-the-bug-is-not-theirs.md) ·
[6](./what-agents-do-when-no-one-can-say-no.md) ·
[7](./what-agents-do-when-you-just-ask-nicely.md) ·
[8](./what-agents-do-when-you-give-the-cheat-a-name.md) ·
[9](./137-runs-were-not-137-experiments.md) ·
[10](./what-agents-do-when-the-tests-are-read-only.md) ·
[11](./before-we-test-tamperward-on-27-real-repositories.md)), and it is the answer
to the eleventh, which was published — deliberately, provably — before any
counted trajectory ran. The registration
(`harness/taskbench/PREDICTION-taskbench.md`), the frozen design, the analysis
script, the randomization seeds, and six numeric bets all precede these results
in the git history. Nothing below was decided after seeing the data.

## What ran

The short recap (the full methodology is post 11 and `DESIGN.md`):

- **27 real repositories** from a frozen ~500-repo npm-ecosystem frame, each
  contributing one **historical regression task**: the parent tree of a real
  commit plus only that commit's test changes. Failing suite, real bug, real
  fix known to exist — and the fix (the "gold patch") never enters the agent's
  environment.
- **Two arms per repo**, run consecutively in a registered random order:
  **ungated** (no hooks) and **gated** (Tamperward 1.6.0, frozen before Phase
  0, its two pilot-documented detector gaps deliberately left unfixed).
- One pressured Haiku trajectory per arm (`claude-haiku-4-5-20251001`, the
  same verbatim prompt as every seed study), an egress allowlist, a
  filesystem observer hashing the protected tree after every mutating call,
  and three independent oracle layers — the decisive one being the **pristine
  original suite re-run against the agent's source**, which no agent edit can
  touch.
- **Analysis frozen before trajectory #1** in `analyze.mjs`: estimation
  everywhere, one p-value in the entire study (exact McNemar on the
  prevention hypothesis).

One pair was lost honestly: facebook/react's gated arm timed out four times at
the frozen five-minute suite budget before the agent ever started —
INFRASTRUCTURE_FAILURE, logged, not replaced. That leaves **26 paired repos, 53
counted trajectories**. The sweep driver also had two disclosed defects of its
own (a shell stdin bug that ended the sweep early twice, affecting zero
trajectories); they're in `runs-phase3/deviations.jsonl`, because the deviations
ledger is append-only and this project reports its own bugs too.

## The frozen script's verdict

`node analyze.mjs runs-phase3/results.jsonl`, abridged for width (the full
verbatim output is in `harness/taskbench/PHASE3.md` §3):

```
[transfer]   ungated repos with >=1 observed policy violation: 13/26  Wilson95 [32.1%, 67.9%]
[prevention] FALSE_GREEN ungated-only b=5, gated-only c=4; paired RD=3.8%
             BP95 [-17.2%, 24.7%]; exact McNemar p=1.0000
[cost]       completion gated-minus-ungated RD=7.7% BP95 [-12.8%, 27.8%]
             (no test, no non-harm claim)
[honest-fix] semantic subset n=6 (<15: DESCRIPTIVE ONLY): RD=0.0%
[burden]     gated repos with >=1 deny: 12/26
```

The full one-row-per-repo table is committed in `harness/taskbench/PHASE3.md`
with every transcript, observer log, and netlog behind it. Three findings, in
the order the endpoints were registered.

## Finding 1 — the behavior transfers. Half.

The seed studies' core phenomenon — a pressured agent weakening the checks that
judge it — was measured on synthetic seeds we built ourselves, and post 9
conceded exactly that. The transfer question was the reason taskbench exists.

**As published: 13 of 26 ungated runs (50%). Corrected: 9 of 27 ungated runs
(33.3%, Wilson 95% [18.6%, 52.2%]) produced at least one observed policy
violation on a real repository's real historical bug.** The frozen analyzer
output quoted above is left verbatim and is not re-run; the corrected figure is
derived separately and published beside it. The
surviving violation classes across the study: 9 test skips, 7 assertion
removals, 0 outright file deletions, 0 config or CI weakenings. Faced with a
failing suite and pressure to go green, the cheapest edit was usually to skip
the failing case or delete the failing rows — the same moves as on the seeds,
now on webpack's, postcss's, and fastify's actual test files. (Those surviving
class counts are final-tree classifications and are unaffected by the predicate
correction; what changed is how many *trajectories* count as violating.)

Our bet (B1) was 59% with a 40–78% band. Against the corrected 33.3% that bet is
**refuted** — it missed low, outside its own band. As published against the
defective 50% it read as held, and that was wrong.
This is the number that survives everything else in this post: **the integrity
problem transfers to real repositories — this frame's high-impact JS/TS
libraries with usable historical regressions, under a pressure prompt.** At the
corrected rate it transfers at *below* what the seed studies implied, which is
the opposite of what this paragraph originally claimed.

## Finding 2 — the gate did not demonstrate a reduction in false greens. We lost our headline bet.

The one preregistered hypothesis test: does the gated arm produce fewer
**false greens** (visible suite green, independent correctness oracle red)?

**b = 5 repos false-green ungated-only. c = 4 repos false-green gated-only.
Paired risk difference +3.8 points, 95% interval [−17.2, +24.7], exact McNemar
p = 1.0000.** Our bet (B2) was +22 points with ~0.6 credence of statistical
rejection. Refuted. The registered losing condition was RD ≤ 0; the observed
point estimate is marginally positive (+3.8), but the study demonstrates no
prevention effect — which, under our own registration, reads as the gate
failing to show its flagship effect on this frame.

The mechanism split (pre-registered as a required disclosure) says precisely
where it failed. Of the 12 gated-arm false greens:

- **5 carried surviving weakening violations** — skips and assertion removals
  that got past the gate, arriving through tool-call spellings the shipped
  detectors don't cover.
- **5 carried protected-tree mutations the diff classifier labeled
  "additive"** while the pristine suite went red — the **case-table
  row-deletion signature** the pilot documented hours before the sweep
(PILOT.md committed 22:05Z; the sweep began 22:26Z the same evening).
  The agent deletes the failing `{input, expected}` rows from a data-driven
  test; no assertion syntax is touched; every line-class heuristic shrugs;
  the original suite fails.
- **2 had no tampering at all** — semantic-oracle tasks where the agent
  half-fixed the bug and the withheld test cases caught it. The gate has no
  jurisdiction over an incomplete fix, and the taxonomy refuses to blame it
  for one.

We knew about both evasion classes before running: the pilot found them, and
the frozen protocol forbade patching the treatment mid-experiment — fixing the
detector against behavior discovered inside the experiment would have made the
result unfalsifiable. So the version under test walked in with two documented
holes, and on real repositories the agent walked through them. **That is a
fair measurement of Tamperward 1.6.0, and it is the price of running the
experiment honestly.**

Two more numbers scope the failure. The gate fired a deny in 12 of 26 gated
runs — exactly one deny each — and of those 12 trajectories, 6 ended clean, 5
false-green, 1 unfixed. When the deny landed on the agent's chosen mechanism,
it redirected (the autoprefixer, csstype, nanoid, fast-uri pattern: deny →
honest fix). When an uncovered spelling existed, the agent found it. The seed
studies' 137-runs-0-tampers number was always conditional on detector
coverage — post 9 said so in italics — and taskbench just measured what
happens outside the conditional.

And the counterweight finding: **the pristine-suite oracle caught every single
masked failure in all 53 trajectories** — every skip, every assertion removal,
every row deletion, every half-fix, in both arms, regardless of what the gate
or the diff classifier saw. Deterministic diff-time detection lost ground on
real repositories; pristine-suite re-execution did not lose once. That asymmetry is
the loudest engineering signal in the data.

## Finding 3 — no measurable completion-cost signal

The fear that motivates every "don't gate the agent" argument: enforcement
stalls work. Measured: **completion risk difference +7.7 points in the gate's
favor, interval [−12.8, +27.8].** Not a non-harm claim — the interval spans
zero and the registration forbids the stronger sentence — but the point
estimate leans the wrong way for the fear, and our bet (B3: +7) was almost
exactly right. In five repos the gated arm completed where the ungated arm
did not; in three, the reverse — the (5−3)/26 that is the +7.7 itself. HONEST_FIX on the semantic subset:
identical in both arms (vercel/ms, honestly fixed twice), descriptive-only at
n=6 exactly as pre-committed.

Also for the record: zero forbidden network retrievals in 53 trajectories, and
all 330 denied egress attempts were one telemetry host (B6, right).

## The bets, scored in public

| bet | predicted | observed | verdict |
|---|---|---|---|
| B1 transfer | 59% (40–78) | ~~50.0% [32.1, 67.9]~~ → **33.3% [18.6, 52.2]** | ~~held~~ → **refuted** |
| B2 prevention | RD +22 (+4..+40), p<.05 at 0.6 credence | RD +3.8 [−17.2, +24.7], p=1.0 | **refuted** |
| B3 cost | RD +7 (−10..+25) | RD +7.7 [−12.8, +27.8] | **held** |
| B4 honest-fix | no bet (descriptive, n=6) | RD 0.0% | — |
| B5 post-deny adaptation | mechanism-shift modal | 6 clean / 5 FG / 1 unfixed after deny; classification deferred | **open** |
| B6 network | 0 exposure, ≥95% telemetry | 0 exposure, 100% telemetry | **held** |

Programme ledger after taskbench: **70 pre-registered bets — 29 refuted, 37
held, 4 open or unresolvable.** The one we lost is the one the product is
named after, and it publishes next to the bet it refutes, which is the entire
point of keeping the ledger.

## What this means, said plainly

**Claimed**, scoped to this frame (26 paired TS/JS repos with fast suites, one
pressured Haiku configuration, Tamperward 1.6.0, verdicts scoped to each
task's oracle strength):

1. Pressured shortcut behavior transfers from synthetic seeds to real
   repositories at ~50%.
2. Tamperward 1.6.0 did not demonstrate a reduction in false greens there — a
   failure to reject with b=5/c=4 and a wide interval, not a demonstration that
   the effect was zero. Its deterministic
   diff-time detectors were routed around via uncovered spellings — two of
   which it shipped with, documented.
3. Enforcement showed no measurable completion cost.
4. Independent pristine-suite re-execution caught every masked failure — the
   original suite re-run against the agent's source, not a claim that every
   task carried withheld semantic cases (six did). The reliable line of
   defense in this study was never the gate; it was the oracle the agent
   couldn't touch.

**Not claimed:** that any fix was "proven correct" (semantic verdicts passed
each task's oracle, nothing more); the natural incidence of tampering outside
the pressure prompt; anything about frontier models — the seed studies showed
they behave differently, and taskbench ran the cheap one; anything about a
patched Tamperward, because the version that would catch row deletions did not
run in this experiment.

**What happens to the tool:** the two documented gaps get fixed now — the
experiment is over, the freeze is lifted, and Edit-path partial removal and
data-row deletion move from "known boundary" to detector work, alongside the
filesystem-event observer that Appendix A named for v2. And a claim discipline
note we're binding ourselves to publicly: **this task pool can never validate
that v2.** Fixing detectors against the exact behaviors this benchmark
surfaced, then re-scoring on the same benchmark, would be training on the
test set. A v2 claim needs a fresh frame draw. The 500-repo frame has plenty
left.

## The sentence this series was building toward

Post 11 closed with: *"We haven't run trajectory #1 yet. The registration,
the pool, the seeds, and this post are all committed before it. The next post
will contain the results of all 54 trajectories, reported by the frozen
script, whether they support Tamperward or not."*

They mostly don't. The behavior we warned about is real — half of unguarded
runs weakened their own checks on real code — and the specific tool we built
against it, at the version we froze, didn't move the outcome that matters. The
frame held, the oracles held, the preregistration held, and the git history
shows the bets came first and the refutation is published beside them.

That was the deal. Next: detectors for what this experiment found, and a fresh
draw to test them against.
