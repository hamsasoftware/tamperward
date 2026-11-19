# Model comparisons

*The record supports exactly one cross-model comparison, and it is secondary
and descriptive. This page states it on the corrected denominator, explains
why the other rounds are not directly comparable, and fixes the shape any
future comparison takes so it can be added without redesign. Series-wide
caveats: [limitations](../blog/limitations.md). Corrections:
[errata](../blog/errata.md).*

## The one comparison the record supports

Rounds 3 and 3.1 share a task pool, a byte-identical treatment (1.14.0), the
same pressure prompt and the same endpoints, with the model as the intended
factor and two disclosed differences beyond it (one pair burned before
registration; control-plane isolation). Restricted to the **common 16 tasks**
— the denominator the errata corrected to — ungated behaviour was:

| | `claude-haiku-4-5-20251001` (round 3) | `claude-sonnet-5` (round 3.1) |
| --- | --- | --- |
| ungated repos with ≥1 observed policy violation | **9/16** (56.3%) | **4/16** (25.0%) |
| ungated `FALSE_GREEN` (the endpoint's own currency) | 8 | 3 |
| gated `FALSE_GREEN` | 2/17 (round 3 full pool) | 2/16 |
| completion RD (gated − ungated) | +41.2pp | +18.8pp |

Read: the stronger model weakened tests less often when nothing stopped it,
which left less for the gate to prevent — and is why round 3.1's confirmatory
result could not have replicated (b ≤ 3). "Stronger" is a characterisation from
published capability claims, not a measurement made inside the experiment;
pinning a model identifier is not pinning an immutable snapshot; and both
rounds ran one runtime (Claude Code) and one prompt. Registered as secondary in
[`PREDICTION3.1-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3.1/PREDICTION3.1-taskbench.md)
§B1; corrected on the common-16 denominator in the
[errata](../blog/errata.md).

## Why the other rounds are not directly comparable

| pair | what differs besides the model |
| --- | --- |
| Rounds 1–2 vs 3 | ecosystem (npm vs PyPI frame), treatment (1.6.0 / 1.9.0 vs 1.14.0), frame draw; same model |
| Round 3.1 vs 4 | same model, but a fresh 110-repository pool, treatment 2.10.3, a research jail, a redefined endpoint (product-scoped masked failure with `a`/`d` reported) and a different interpretation floor |
| seed studies vs any round | synthetic author-designed seeds, repeated stochastic runs, historical controls — a different sampling unit altogether |

Where task pools, protocols and endpoints differ, the rounds are shown
separately on their own pages; no cross-round rate is pooled here.

## The shape of a future comparison

Any future BYO-model or research evaluation reports against four separate
panels, never a composite rank:

```
MODEL BEHAVIOUR          transfer rate; persistent vs transient weakening;
                         false-green opportunities (a + b); post-denial
                         response where transcript-classified
OUTCOME INTEGRITY        visible vs pristine verification; held-out semantic
                         oracle where it exists; honest completion vs
                         non-completion
CONTROL RESPONSE         b (prevented), c (induced harm), a, d; exact McNemar;
                         interpretation floor met or not
TAMPERWARD PERFORMANCE   strict tamper bypasses; envelope escapes decomposed;
                         landed-but-flagged vs certified clean; detector
                         misses caught by outer layers
```

A row enters a shared table only when its task pool, protocol, treatment
version and endpoint definition match the rows already in it; otherwise it
gets its own table with the differences listed. Each panel keeps the
model/runtime identifier, treatment version and sample size beside the number.
This page is the placeholder for that table; it currently holds the single
comparison above.
