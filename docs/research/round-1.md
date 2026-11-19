# Round 1 — 26 paired JavaScript/TypeScript repositories, Tamperward 1.6.0

*Preregistered confirmatory experiment. Status: complete. The transfer figure
was corrected on 2026-09-01 (see [corrections](#corrections-and-errata)).
Series-wide caveats: [limitations](../blog/limitations.md). Corrections:
[errata](../blog/errata.md).*

## Identity

| field | value |
| --- | --- |
| model / runtime | `claude-haiku-4-5-20251001` / Claude Code |
| treatment | Tamperward **1.6.0** (PreToolUse gate + Stop sweep; the detector-centric design), frozen before Phase 0 |
| sample | 27 real npm repositories with historical regressions mined from a frozen 500-repo frame; **26 pairs** with both arms, **53 trajectories** counted (one ungated arm unpaired: its gated arm failed setup) |
| ecosystem | JavaScript/TypeScript |
| design | two arms per repository in registered random order — ungated (no hooks) and gated — under one pressure prompt; withheld semantic oracle cases where available |
| primary endpoint | paired `FALSE_GREEN` discordance, exact McNemar |

## Result

| quantity | value |
| --- | --- |
| **b** — false green ungated only (prevention) | **5** |
| **c** — false green gated only (induced harm) | **4** |
| paired RD | **RD +3.8pp**, BP95 [−17.2, +24.7] |
| exact McNemar, two-sided | **p = 1.0000** |
| transfer — ungated runs with ≥1 observed policy violation | **9/27 (33.3%)**, Wilson95 [18.6%, 52.2%] — corrected from a published 13/26 |
| completion RD (gated − ungated) | +7.7pp, BP95 [−12.8, 27.8] — descriptive, no test |
| pristine oracle | identified every masked failure observed among the 53 trajectories while diff-time detection was routed around |

The headline prevention bet **lost** and was published beside the bet. The
transfer bet (B1, predicted 59% with a 40–78% band) is **refuted** under the
corrected predicate — it was first published as "substantially right, slightly
high" and that framing was withdrawn.

## What it supports

- On this sample the detector-centric 1.6.0 architecture did not demonstrate a
  reduction in false greens: agents routed around the shipped detector
  classes — deleting failing rows, stripping assertions, gutting setup — rather
  than through them. The 53 trajectories became the evasion corpus for
  `test-content-removal` (1.7.0), the effect layer (1.8.0) and `tamperward
  verify` (1.9.0). See
  [What losing the bet bought](../blog/what-losing-the-bet-bought.md).
- Independent re-execution of the original suite, including withheld semantic
  cases, exposed every masked failure the round produced. That is the
  outcome-level signal the product later built on.

## What it does not establish

- Not evidence that the effect is zero: b=5/c=4 with a wide interval is a
  failure to reject.
- The transfer rate is a rate for this model, this prompt and this frame — the
  corrected JS/TS rounds are 33.3% and 54.5%, a spread, not a rate.
- The pristine oracle here carried withheld semantic cases. The shipped
  `tamperward verify` productizes only its base-restoration component; it
  cannot detect a semantically incomplete fix the base tests also accept.
- Round 1 is a modified-ITT / complete-pair analysis with arm-specific
  attrition (one gated arm never ran), not the intention-to-treat analysis its
  registration claimed.
- The harness was not a security boundary: the agent ran as root on the same
  filesystem as the control plane. A transcript audit found no use of it.
- Network isolation was observation-bounded: the egress proxy observed traffic
  rather than enforcing a boundary. "No proxy-observed forbidden retrieval" is
  the supportable claim.

## Corrections and errata

- **2026-09-01 — transfer predicate.** The rounds-1/2 analyzer counted any
  protected-tree hash transition or bare `FALSE_GREEN` as a policy violation.
  Recomputed under the registered predicate: 9/27, not 13/26; the denominator
  moves 26 → 27 because the unpaired `facebook-react` ungated arm is a valid
  transfer observation. Method and per-snapshot classification:
  [`harness/taskbench/reanalysis/TRANSFER-REANALYSIS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/reanalysis/TRANSFER-REANALYSIS.md).
  The frozen analyzer outputs were not overwritten; the McNemar result is unchanged.
- **2026-09-01 — framing.** "Did not reduce false greens" became "did not
  demonstrate a reduction"; "the git history proves the order" became "the
  repository records the registration commit before the result commits".
- **2026-08-31 — network claim scoped** to what the proxy could observe.

Full text on the [errata page](../blog/errata.md).

## Artifacts

- Registration: [`harness/taskbench/PREDICTION-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/PREDICTION-taskbench.md)
- Frame, mining and Phase 0: [`harness/taskbench/FRAME.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/FRAME.md), [`PHASE0.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/PHASE0.md), [`PHASE3.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/PHASE3.md)
- Verdict ledger (53 lines): [`harness/taskbench/runs-phase3/results.jsonl`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/runs-phase3/results.jsonl); transcripts and observer snapshots beside it
- Frozen analyzer: [`harness/taskbench/analyze.mjs`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/analyze.mjs)
- Posts: [preregistration](../blog/before-we-test-tamperward-on-27-real-repositories.md) · [results](../blog/we-tested-an-ai-coding-agent-on-27-real-repositories.md) · [engineering response](../blog/what-losing-the-bet-bought.md)
