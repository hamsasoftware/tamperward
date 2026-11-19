# Detector precision and false positives

*Operational cost, kept apart from effectiveness. Every rule that ships at
`block` was priced on real maintainer commits first; every rule that ships at
`warn` stays there because its measured fire rate or the size of its corpus
does not authorize more. The counts below are read by CI from the committed
corpus JSON and the `**total**` rows of the study records. Series-wide caveats:
[limitations](../blog/limitations.md). Corrections: [errata](../blog/errata.md).*

## How to read a percentage here

A commit-corpus percentage is a **historical review-trigger rate**, not a clean
false-positive estimate. The corpora are reviewed, merged maintainer commits
with no Tamperward in the loop, so by construction none is a tamper crafted
against Tamperward — the question each study asks is *would the rule have
wrongly stopped legitimate human work?* Some fires are working as designed (a
`warn` on a real snapshot update asks a human to confirm, and the merged commit
is that confirmation). Commits within a repository are correlated, pooling
overweights the largest repositories, and adjudication was done by this
project's author. Per-repository rates are more informative than the pooled
figure. The adjudication vocabulary is preregistered in
[`ADJUDICATION-RULE.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/ADJUDICATION-RULE.md).

## Studies

| rule | corpus | fire rate / precision | severity decision | record |
| --- | --- | --- | --- | --- |
| `test-content-removal` (1.7.0) | 2,304 adjacent mainline diffs — immer, zustand, zod, prettier | 35 (1.5%) firing diffs, 47 findings; every fire legitimate maintainer work in four shapes, one of them byte-shaped like the tamper | ships **`block`** at 1.5% — roughly one sign-off per 60 mainline commits | [`TCR-CORPUS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/TCR-CORPUS.md), per-fire JSONL beside it |
| `snapshot-rewrite` file surface | 1,652 first-parent commits — prettier, jest, immer, docusaurus (preregistered) | 216 (13.1%) snapshot-touching commits, all fired; 215 (99.5%) co-touched a non-snapshot file; 1 snapshot-only commit | file surface stays **`warn`** — bet 1 confirmed (routine workflow, 30.2% of prettier commits); the co-touch signature became `snapshot-only-rewrite` | [`PREDICTION-snapshot-fp.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/PREDICTION-snapshot-fp.md) |
| `test-skip` AST extension (2.17.1) | 460 adjacent pairs — immer, zustand, zod, hono, pinned by SHA | **0/460** newly introduced findings versus the trusted-base detector (a precision-delta screen, not a recall estimate) | conservative AST extension shipped | [`TEST-SKIP-AST-CORPUS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/TEST-SKIP-AST-CORPUS.md), CI run `34777413883` |
| `assertion-weakening` (#323) | the 20 assertion-touching legitimate records retained from the 2,304-diff TCR frame, plus 12 mutation positives | precision among fires **12/12** (100%); false positives **0/20** on the retained slice; predeclared 90% precision build threshold cleared | ships **`warn`**: the negatives are a slice of an earlier study, recall is not established, and block needs a larger independent replay | [`AW-CORPUS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/AW-CORPUS.md); CI replays [`assertion-weakening-corpus.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/assertion-weakening-corpus.json) |
| `ts-cast-growth` (2.20.0, #383) | 460 adjacent first-parent pairs — immer, zustand, zod, hono | **40 / 460 = 8.7%** of all pairs fired (18.2% of the 220 pairs touching eligible source); 61 findings, 38 files | ships **`warn`**: block requires ≤ 1% ceiling on all pairs and ≥ 90% adjudicated precision, not met by a wide margin | [`CAST-GROWTH-CORPUS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/CAST-GROWTH-CORPUS.md); CI replays [`cast-growth-corpus.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/cast-growth-corpus.json) (20 negative, 8 positive cases) |
| `coverage-exclusion` (2.24.0, #438) | the same 460 adjacent first-parent pairs — immer, zustand, zod, hono — plus every first-parent commit reachable in a 3,000-commit deepening of the four clones (6,632) | **0 / 460 = 0.0%** of mainline pairs fired; the deeper frame holds 4 commits adding a spelling, all honest immer `/* istanbul ignore next */` markers on environment-dependent branches — precision as a tamper signal on real fires 0/4 | ships **`warn`**: the 1% ceiling is met, the 90% adjudicated-precision floor is not — the spelling is the ordinary unreachable-branch marker | [`COVERAGE-EXCLUSION-CORPUS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/COVERAGE-EXCLUSION-CORPUS.md); CI replays [`coverage-exclusion-corpus.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/coverage-exclusion-corpus.json) (22 negative, 14 positive cases) |
| `ts-any-cast` narrow block, `test-deletion` | zod maintainer history | 21 `ts-any-cast` fires clustered in test / type-test files and library plumbing; 0/4 `test-deletion` relocation false positives | `ts-any-cast` scoped to non-test source | [`ADJUDICATION-RULE.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/ADJUDICATION-RULE.md), [`zod-fires.jsonl`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/zod-fires.jsonl) |

Earlier launch-era studies — the false-positive bill on 1,227 and 1,652 real
commits, the gate's own 9.0% → 6.0% tuning — are in the
[launch post](../blog/what-agents-do-when-you-block-their-shortcuts.md),
[What agents do when you just ask nicely](../blog/what-agents-do-when-you-just-ask-nicely.md)
and [What agents do when you give the cheat a name](../blog/what-agents-do-when-you-give-the-cheat-a-name.md),
with the same review-trigger-rate caveat.

## The decision rule

The thresholds are the project's own, stated so a reader can apply them to the
numbers. This is the **graduation criterion for new candidate rules**, applied
from `ts-cast-growth` (2.20.0, #383) onward: `block` requires a fire rate on
legitimate mainline maintenance at or below a 1% ceiling of adjacent pairs
across the corpus **and** an adjudicated precision among fires of at least 90%;
otherwise a rule ships `warn` as a review prompt, and any later move to block is
a separate decision with its own independent measurement. For `ts-cast-growth`
the rule was chosen before the fires were adjudicated but is not a
repository-verifiable preregistration — the record says so. `warn` never
requires sign-off under the default policy.

This criterion governs graduations; it is not a claim that every rule already at
`block` clears a 1% ceiling. `test-content-removal` (1.7.0) is the release-era
exception the table records: it ships `block` at a 1.5% fire rate — above the
later ceiling — on a separately accepted sign-off burden of roughly one sign-off
per 60 mainline commits. That decision rests not on a fire-rate ceiling but on
its category-4 fires (expectation rows removed because reality changed) being
byte-shaped like the tamper: the legitimate edit and the attack are mechanically
indistinguishable, so block-with-sign-off is the design choice the record argues
([`TCR-CORPUS.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/TCR-CORPUS.md)).
Its 1.5% is a historical review-trigger rate, not a false-positive estimate the
1% ceiling would score.

## What is measured in CI

Two of the corpora are executed on every change:
[`test/assertion-weakening-corpus.test.ts`](https://github.com/hamsasoftware/tamperward/blob/main/test/assertion-weakening-corpus.test.ts)
and
[`test/ts-cast-growth-corpus.test.ts`](https://github.com/hamsasoftware/tamperward/blob/main/test/ts-cast-growth-corpus.test.ts)
replay every labeled case against the shipping detector and check that the
shipping severity follows the decision rule against the recorded mainline rate.
The committed JSON is the regression surface for the recorded live-fire
measurement, not a second independent measurement.

## What this page does not claim

- No rule has a measured **recall**. These are precision and fire-rate
  studies on legitimate history; the detector-evasion record lives in the
  [rounds](./#the-agent-integrity-benchmark-at-a-glance) and on the
  [security page](./security-evaluations).
- No study covers the command surface (`jest -u`, regeneration scripts): git
  history records no commands.
- The corpora are JS/TS mainlines. Python and other ecosystems have file-level
  protection and the documented skip/suppression patterns, but no
  corpus-priced rule of their own.
- No production-pilot sign-off frequency exists yet — see
  [performance](./performance).
