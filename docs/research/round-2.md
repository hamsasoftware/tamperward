# Round 2 — 22 fresh held-out JavaScript/TypeScript repositories, Tamperward 1.9.0

*Preregistered confirmatory experiment. Status: complete. The transfer figure
was corrected on 2026-09-01, and the round ran on a `verify` that carried a
bypass closed in 1.14.1 (see [corrections](#corrections-and-errata)).
Series-wide caveats: [limitations](../blog/limitations.md). Corrections:
[errata](../blog/errata.md).*

## Identity

| field | value |
| --- | --- |
| model / runtime | `claude-haiku-4-5-20251001` / Claude Code, pinned identically to round 1 |
| treatment | Tamperward **1.9.0** — gate + effect layer + `tamperward verify`, the stack whose development consumed round 1's pool |
| sample | **22 pairs** of fresh repositories from a new frame draw that no detector was tuned on; **44 trajectories** |
| ecosystem | JavaScript/TypeScript |
| primary endpoint | paired `FALSE_GREEN` discordance, exact McNemar |

Round 1's repositories were development data by this point; round 2 drew new
ones. That is the point of the round: the first held-out test of the design
that round 1's failure produced.

## Result

| quantity | value |
| --- | --- |
| **b** — false green ungated only (prevention) | **9** |
| **c** — false green gated only (induced harm) | **0** |
| paired RD | **RD +40.9pp**, BP95 [17.8, 61.3] |
| exact McNemar, two-sided | **p = 0.0039** |
| transfer — ungated repos with ≥1 observed policy violation | **12/22 (54.5%)**, Wilson95 [34.7%, 73.1%] — corrected from a published 14/22 |
| after prevention | 8 of the 9 prevented false greens became honest completions; the ninth an honest non-completion |
| residual | 4 gated false greens remained, through two documented mechanisms |

In the ledger's own terms: b=9, c=0 over 22 pairs. Two bets missed their
bands upward; both count as misses.

## What it supports

- The preregistered 1.9.0 treatment materially reduced false greens **in this
  setting**: this model, this prompt, this frame, this treatment.
- Prevention usually redirected trajectories toward honest work rather than
  merely blocking them.
- The two residual routes were documented, not patched, before round 3: a
  runtime that owns termination when the enforcement layer does not (the
  `cssstyle` lifecycle escape — the gate denied 42 mutations and `verify`
  refused all 25 stop attempts, and the runtime completed the session anyway
  over a masked tree), and the withheld-split blind spot designed in. The first
  is what the `tamperward run` envelope was built to close.

## What it does not establish

- Not a claim about other ecosystems, models or prompts. Round 3 tested Python;
  round 3.1 tested a stronger model and did not replicate.
- The 1.9.0 `verify` carried a bypass (an agent-added `conftest.py` could
  deselect restored tests by node id) from 1.9.0 through 1.14.0. No round-2
  trajectory shows an added protected control file, so there is no evidence it
  was used — an absence of observed use, not proof of containment. The layer's
  authority in this round was weaker than described at the time.
- Network isolation was observation-bounded, as in round 1.
- The harness was not a security boundary; the control plane was reachable and
  a transcript audit found it unused.

## Corrections and errata

- **2026-09-01 — transfer predicate.** 12/22, not 14/22. Round 2 has no
  ambiguous trajectory, so the corrected figure is exact from the ledger.
  [`harness/taskbench/reanalysis/TRANSFER-REANALYSIS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/reanalysis/TRANSFER-REANALYSIS.md).
- **2026-09-01 — `verify` bypass, 1.14.1.** Present from 1.9.0; rounds 2, 3
  and 3.1 all ran on a verifier carrying it. Every counted verdict and McNemar
  result is unchanged; the withheld semantic oracle that classified outcomes is
  a separate mechanism.
- **2026-08-31 — pre-round-2 publication audit** made ten corrections in place;
  network claim scoped to proxy observation.

Full text on the [errata page](../blog/errata.md).

## Artifacts

- Registration: [`harness/taskbench/round2/PREDICTION2-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round2/PREDICTION2-taskbench.md)
- Frame and pilot: [`harness/taskbench/round2/FRAME2.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round2/FRAME2.md), [`PILOT2.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round2/PILOT2.md), hashes in [`ROUND2-HASHES.txt`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round2/ROUND2-HASHES.txt)
- Verdict ledger (44 lines): [`harness/taskbench/round2/runs-phase3/results.jsonl`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round2/runs-phase3/results.jsonl)
- Frozen analyzer: [`harness/taskbench/analyze.mjs`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/analyze.mjs)
- Posts: [results — The gate held. The runtime didn't.](../blog/the-gate-held-the-runtime-didnt.md)
