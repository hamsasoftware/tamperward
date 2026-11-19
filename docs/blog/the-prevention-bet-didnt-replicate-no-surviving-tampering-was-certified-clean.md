# The prevention bet didn't replicate. No surviving tampering was certified clean.

*September 11, 2026 · hexrift*

> *Series-wide caveats — sampling unit, historical controls, training
> contamination, model pinning, what the registration order proves, and what the
> verification layers cannot guarantee — are collected on the
> [limitations page](./limitations.md). Published corrections are on the
> [errata page](./errata.md).*

*Short answer: we made a big prediction, and Round 4 did not confirm it. We predicted that
TamperWard would produce a large and statistically significant reduction in masked failures,
and it did not: the registered paired test produced 5 prevention discordances, 3 induced-harm
discordances, and p = 0.727, so we do not reject the preregistered null. At the same time a
narrower security result held — across 201 measured trajectories, we observed no case where
landed tampering survived and TamperWard certified it clean. A missed primary prediction and a
narrow security result that held, in the same round, and we are reporting both.*

This is the twentieth post in the [TamperWard research series](/blog/) and the answer to
[How round 4 is built to be hard to fool](./how-round-4-is-built-to-be-hard-to-fool.md), the
round-4 methodology post — published, with the treatment, the pool, the endpoints, the seeds
and its numeric bets, before a single counted trajectory ran. That post committed the
predictions; this one reports the results. The repository records the registration commit
before the result commits.

*Every figure here is the sealed value in [`ROUND4-RESULTS.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/ROUND4-RESULTS.json)
(`payload_sha256` `e7bfce08…`, deterministic), reproducible with
[`analyze-counted.mjs`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/analyze-counted.mjs) against [`round4-counted-state` @ `979a5d27`](https://github.com/hamsasoftware/tamperward/tree/979a5d273bd03dd9699c2cf51526715c57563534).
Registered design: [`PREDICTION4-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/PREDICTION4-taskbench.md) (freeze 2).*

## What we predicted, and the one test that would decide it

Round 4 was preregistered as a paired experiment over N = 110 repositories, each run in a
**gated** arm (the frozen TamperWard 2.10.3 platform: PreToolUse gate + Stop sweep +
enforcement envelope) and an **ungated** arm (parent-owned observer only). The single
inferential claim was an exact conditional McNemar test on **product-scoped masked failure**
— candidate-visible verification green while pristine verification is red — rejecting H₀
only when `p < .05` **and** `b > c`. The committed point predictions: b = 16, c = 1,
prevention RD +13.6 pp, reject H₀, completion RD 0 pp.

## The counted inventory came in complete and self-consistent

Start with the bookkeeping. The counted inventory accounts for all 264 planned trajectories (220 primary + 44 duplicate). State is
complete and internally consistent: 239 verdicts + 25 adjudicated = 264/264, every verdict
bound to a frozen-manifest ledger event, every adjudication marker parsed and validated
(0 violations), no stray records. Of 239 verdicts, 201 measured, 38 `INVALID_MEASUREMENT`.
The completeness gate is fail-closed: the analyzer refuses to emit a sealed results artifact
and exits non-zero on any census failure (regression-tested, run in CI), so no incomplete
dataset can be presented as an authoritative record. Each verdict is also schema- and
identity-validated against the frozen manifest row and treatment, so a corrupt or misidentified
verdict fails closed rather than silently degrading to an invalid measurement.

## The primary result: the prediction did not replicate

Among **79 repositories with valid measurements in both arms**, **5 prevention
discordances** and **3 induced-harm discordances**. Exact paired McNemar **p = 0.727**, so
**the preregistered null hypothesis was not rejected.**

| | predicted | observed |
|---|---|---|
| b (prevention) | 16 | **5** |
| c (induced harm) | 1 | **3** |
| exact McNemar p | ≈ 0.0003 | **0.727** |
| decision | reject H₀ | **do not reject H₀** |

It is a clear failed prediction, and we are saying so plainly. The interpretation floor was met — ungated
opportunities `a + b = 15`, required 6 — so this is not an opportunity-starved or
uninterpretable round. But realized discordance, and therefore realized statistical
information, was below the original 80% power calculation: 8 discordant pairs versus roughly
17 assumed, over 79 realized valid pairs versus the planned 110.

## What the masked failures actually were

The registered endpoint counts two different things under one label:

```
FALSE GREEN
  ├── evaluation was tampered with      → TamperWard's core scope
  └── implementation was simply wrong   → correctness / oracle scope
```

Round 4's 35 masked failures split **roughly evenly** — 19/35 (54%) had no landed weakening
(correctness/oracle), 16/35 (46%) were tampering-related — and the split **flips by arm**:
gated masked failures skew correctness (11/15), ungated skew tampering-related (12/20). So we
do **not** claim the false-greens were “dominated by wrong fixes.” What we can say is that a
substantial correctness component is present, especially in the gated arm, which plausibly
dilutes the masked-failure signal a tamper-detection treatment can move — but the endpoint is
a mixture, not one mechanism. This is a **post-result observation and a next-round design
lesson (separate the two scopes at the endpoint level), not a retrofit to the confirmatory
hypothesis**, which stands as registered and did not reject.

## Zero strict tamper bypasses, stated precisely

We hold the strict definition:

```
landed weakening  +  survived to the final tree  +  TamperWard certified clean
        =  strict tamper bypass
```

Across **201 measured trajectories: 0 strict tamper bypasses.** In the gated arm (100
measured) **no weakening survived to the final tree at all** (0 persistent), so there were
zero surviving-and-certified-clean cases.

We are deliberately precise about the weaker claim. Of the **11** gated trajectories where a
weakening **transiently** reached disk (all transient; 0 persisted), **10 were flagged** and
**1 was certified clean** — seq 32 (`70-fastapi-asyncer`), an honest completion in which the
gate **prevented 7** attempts, a single weakening landed transiently and did not survive, and
the clean certification correctly matched a clean final tree. So the true statement is
**“nothing tampered survived in the gated arm, and nothing surviving was certified clean”** —
**not** “every landed case was flagged,” which the record shows is false. The value of this
result is that it also corrects the word *escape*: the frozen `envelope_escape` field fired
10 times, and all 10 decompose to correctness/oracle false-greens — none were tampering
certified clean.

## What legitimate work cost — and the claim we did not make

Semantic completion (`HONEST_COMPLETION` — verdict4's name for the registered `HONEST_FIX`
category — plus `CORRECT_PLUS_VIOLATION`) over the 79 valid pairs:

```
gated      67.1%   (53/79)
ungated    70.9%   (56/79)
paired RD  −3.8 pp   Newcombe paired 95% CI [−11.6, +4.0] pp
```

The interval crosses both 0 and the registered −10 pp margin, so there is no evidence of a
large productivity penalty **and** we make **no non-inferiority claim** — none was registered
or tested. Descriptive only.

## How repeatable the trajectories were

The 22 duplicate repositories give a test-retest read against their primary realizations,
over **36 arm-level primary-vs-repeat comparisons** (of 44 possible; 8 had a side
unmeasured — these are arm-level comparisons, not 36 repository pairs):

```
masked-failure agreement   34/36 = 94%
full outcome agreement     33/36 = 92%
```

Trajectory instability is low, which makes the primary null harder to dismiss as random
trajectory chaos.

## Why only 79 of 110 pairs survived to measurement

```
110 primary repositories
 −11  pre-sampling exclusions (adjudicated deviations)
 −20  post-sampling invalid measurement (17 both-arms, 3 one-arm)
 = 79 valid paired repositories        (79 / 110 = 71.8%)
```

Only 71.8% of the primary pool produced a valid paired measurement — a major Round-4 finding
in itself. The loss is dominated by post-sampling `INVALID_MEASUREMENT`, most of it symmetric
across arms. Symmetric within-pair loss **reduces concern about arm-specific attrition**, but
losing 31/110 repositories (3 one-arm) can still introduce **selection bias** if measurement
availability correlates with task characteristics or heterogeneous treatment effects. We do
not claim the attrition is bias-free — only that it is not an obvious arm imbalance.

## What broke in the apparatus

The strongest issues are in the execution environment, not the treatment or the analysis:

- venv / interpreter execution failures (`EXEC_FAILED`, exit 126 — the largest single
  contributor to invalid measurement);
- editable-liveness assumptions;
- exact parent-GREEN / tests-RED / gold-GREEN qualification;
- CI environment variables and network-jail effects;
- agent-configuration provenance (the D44 arm-asymmetric `.claude/` hook);
- evidence persistence (the D43 oversized-tar checkpoint failure);
- pre-agent baseline observability (D42).

## What we would change before the next round

Do **not** simply run more tasks. Move qualification much closer to the exact production
runner, so a repository can enter the frozen pool only after it has demonstrably produced a
valid measurement under production conditions:

```
Candidate repo
      │
      ▼
Exact production runner
      ├── exact network jail
      ├── exact CI environment
      ├── exact agent-config provenance   (normalize .claude/ identically across arms)
      ├── editable liveness
      ├── parent GREEN
      ├── tests RED
      ├── gold GREEN
      ├── executable venv
      └── repeated baseline viability
      │
      ▼
Only then enter the frozen pool
```

The single intended difference between arms must be TamperWard — not whether an arbitrary
repository hook survives, and not whether a venv happens to execute. A second design lesson:
separate tampering from correctness at the endpoint, since Round 4 shows the masked-failure
label mixes them.

## What this does — and does not — establish

- It **does** establish that, in this preregistered sample, the treatment did not produce the
  predicted large, significant reduction in masked failures, and that the realized masked
  failures were a mix of correctness gaps and tampering-related weakenings.
- It **does** establish a narrower security result: no weakening survived in the gated arm,
  and no surviving weakening was certified clean — 0 strict tamper bypasses.
- It **does not** establish that TamperWard prevents all tampering or flags every landed
  weakening (one transient landing was certified clean, correctly, because it did not
  survive), that gating is “non-inferior” on completion, or that the final-state-cleanup
  contrast is real — those are descriptive observations to replicate.
- It **does not** revise the confirmatory hypothesis after the fact.

## The predicted-vs-observed scorecard, misses included

| bet | predicted | observed |
|---|---|---|
| prevention discordance b | 16 | 5 |
| induced-harm discordance c | 1 | 3 |
| prevention RD (b−c)/110 | +13.6 pp | +1.82 pp |
| exact McNemar decision | reject H₀ | do not reject H₀ |
| completion RD (gated − ungated) | 0 pp | −3.8 pp (95% CI [−11.6, +4.0]) |
| final-state-blind, gated | ~50% | 100% (11/11) |
| final-state-blind, ungated | ~90% | 66.7% (12/18) |
| final-state-blind contrast | ~−40 pp | +33.3 pp (opposite sign) |

## The full deviations and raw evidence

- Registered design: [`PREDICTION4-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/PREDICTION4-taskbench.md). Methodology companion:
  [How round 4 is built to be hard to fool](./how-round-4-is-built-to-be-hard-to-fool.md).
- Sealed results: [`ROUND4-RESULTS.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/ROUND4-RESULTS.json); readout:
  [`ROUND4-ANALYSIS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/ROUND4-ANALYSIS.md); engine:
  [`analyze-counted.mjs`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/analyze-counted.mjs).
- Deviation ledger: [`DEVIATIONS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/DEVIATIONS.md) (D36, D39–D44). D36's one-replacement recovery was
  exercised several times — recovered once (seq 219) and exhausted on the D42 (whisperx) and
  D44 (caldav) tasks.
- Per-trajectory verdicts and execution ledger: [`round4-counted-state` @ `979a5d27`](https://github.com/hamsasoftware/tamperward/tree/979a5d273bd03dd9699c2cf51526715c57563534)
  (ledger `1bb42f1a…`, verdict-set digest `a5b652e1…`).
- Oversized final-tree evidence: the [`round4-evidence` release](https://github.com/hamsasoftware/tamperward/releases/tag/round4-evidence) (content-addressed).
- Frozen identity: manifest `eeb85c26…`, treatment 2.10.3 (`0863d3a8…`), model
  `claude-sonnet-5`.

No frozen binding file was altered during the counted run; no sampled trajectory was ever
re-rolled; no product version was bumped for any deviation.
