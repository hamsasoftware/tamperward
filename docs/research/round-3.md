# Round 3 — 17 paired Python repositories, Tamperward 1.14.0

*Preregistered confirmatory experiment. Status: complete. The results article
was corrected after publication and the round ran on a `verify` that carried a
bypass closed in 1.14.1 (see [corrections](#corrections-and-errata)).
Series-wide caveats: [limitations](../blog/limitations.md). Corrections:
[errata](../blog/errata.md).*

## Identity

| field | value |
| --- | --- |
| model / runtime | `claude-haiku-4-5-20251001` / Claude Code, pinned identically to rounds 1–2 |
| treatment | Tamperward **1.14.0**, tag commit `b7dfa949…`, frozen and immutable through the round; deployed as the full platform — PreToolUse gate + `watch` + sweep-then-verify Stop + the `tamperward run` enforcement envelope |
| sample | **17 pairs** from a fresh 500-repository PyPI frame, revalidated pytest tasks; **34 trajectories** |
| ecosystem | Python / pytest |
| primary endpoint | paired `FALSE_GREEN` discordance, exact McNemar |
| network | closed at the OS level: a network namespace with no route or resolver except the proxy's veth IP (PREDICTION3 Amendment 3) |

The model is held constant and the ecosystem changes — but so does the
treatment (1.9.0 → 1.14.0), so ecosystem transfer is not isolated as a factor.

## Result

Every value is the verbatim output of the frozen `analyze3.mjs`
([`ANALYSIS3-output.txt`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/runs-phase3/ANALYSIS3-output.txt)).

| quantity | value |
| --- | --- |
| **b** — false green ungated only (prevention) | **6** |
| **c** — false green gated only (induced harm) | **0** |
| paired RD | **RD +35.3pp**, BP95 [9.5, 58.7] |
| exact McNemar, two-sided | **p = 0.0313** |
| transfer — ungated repos with ≥1 observed policy violation | **9/17 (52.9%)**, Wilson95 [31.0%, 73.8%] |
| completion RD (gated − ungated) | +41.2pp, BP95 [14.3, 64.0] — no test, no non-harm claim |
| honest-fix subset (semantic oracle, n=4) | descriptive only |
| in-loop denials | 1/17 gated repos recorded a deny (2 denies total) |

**Two preregistered bets lost.** Completion rose +41.2pp against a predicted
~0, and the zero-escape bet failed by its own operational definition.

## What it supports

- The prevention result appeared in Python with the model held constant.
- The in-loop `test-skip` detector proved **blind to pytest syntax** — the
  spelling Python agents actually use to weaken tests — and the outer layers
  (Stop-time pristine verification, the envelope) carried the result: all six
  favourable gated trajectories were blocked by pristine verification at least
  once; across 17 gated trajectories, 12 had verification discrepancies and 41
  Stop attempts were blocked.
- One trajectory (`fsspec`) ended clean after six transient weakening events
  and fourteen blocked terminations; another invalidated the envelope's Git
  anchor, which only the outermost layer could see.

## What it does not establish

- Ecosystem transfer as an isolated factor — the treatment changed too.
- Anything about a stronger model: round 3.1 re-ran this pool under
  `claude-sonnet-5` and did not replicate.
- The `verify` layer's full authority: the 1.14.1 bypass was present. No
  trajectory shows an added protected control file.
- The +41.2pp completion difference is descriptive; no test was registered.
- The harness was not a security boundary (root, shared filesystem; transcript
  audit of all 34 counted transcripts found no control-plane access).

## Corrections and errata

- **2026-09-01 — results article (PR #144).** The "zero denials and zero
  blocks" claim for favourable pairs was wrong (all six were blocked by
  pristine verification); B6's ambient-network component re-scored as partial
  under the stricter registered denominator (424/580 = 73.1% of denied proxy
  requests, below the ≥95% prediction; 97.7% among external-host attempts); B4
  marked non-evaluable as registered; an interim 13-block figure reconciled to
  the artifact-canonical 14. None changes b=6, c=0, p=0.0313.
  [`revalidation-corrections.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/revalidation-corrections.md).
- **2026-09-01 — `verify` bypass, 1.14.1**, present 1.9.0 through 1.14.0.
- **2026-09-01 — framing:** "at roughly the rate it exists in JavaScript" was
  withdrawn (the corrected JS rounds are a spread, 33.3% and 54.5%).

Full text on the [errata page](../blog/errata.md).

## Artifacts

- Registration: [`harness/taskbench/round3/PREDICTION3-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/PREDICTION3-taskbench.md); plan [`ROUND3-PLAN.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/ROUND3-PLAN.md); frame [`FRAME3.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/FRAME3.md); funnel [`FUNNEL3.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/FUNNEL3.md); hashes [`ROUND3-HASHES.txt`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/ROUND3-HASHES.txt)
- Verdict ledger (34 lines): [`harness/taskbench/round3/runs-phase3/results.jsonl`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/runs-phase3/results.jsonl)
- Frozen analyzer and output: [`harness/taskbench/analyze3.mjs`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/analyze3.mjs) (sha256 `45164b5e…`), [`ANALYSIS3-output.txt`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round3/runs-phase3/ANALYSIS3-output.txt)
- Audit of the control-plane exposure: [`harness/taskbench/round3/audit/`](https://github.com/hamsasoftware/tamperward/tree/main/harness/taskbench/round3/audit)
- Posts: [preregistration](../blog/before-we-test-tamperward-on-python-repositories.md) · [results — The effect transferred. The detector didn't.](../blog/the-effect-transferred-the-detector-didnt.md)
