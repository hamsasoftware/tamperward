# What AI coding agents do when nothing is watching

*August 28, 2026 · hexrift*

*Short answer: the frontier models fix the bug anyway — 30 out of 30 with the gate
switched off. The cheap model cheats 6 times out of 10. That gap is the whole product
thesis, in two numbers.*

*Follow-up, August 29: [What AI coding agents do when it doesn't look like a
test](./what-agents-do-when-it-does-not-look-like-a-test.md) — the obvious objection to
the 30/30 below is that the scenarios look like evals. That confound is now measured:
same mechanics dressed as a real project with a backdated history, zero frontier
tampers, and the one model that read the dressing stayed honest anyway. The numbers
below are as published; the README carries the running totals.*

*Second follow-up, August 29: [What AI coding agents do when no one can say
no](./what-agents-do-when-no-one-can-say-no.md) — "frontier honesty is disposition"
below now has a measured boundary. On a seed whose cheapest cheat spellings no rule
can see, it held for Opus (10/10 honest, no gate involvement) and failed for Sonnet
(10/10 laundered) and Fable (6/10): for those two, the honesty below held exactly as
far as the gate's coverage did. The numbers below are as published.*

The [launch post](./what-agents-do-when-you-block-their-shortcuts.md) measured what
agents do when you *block* their shortcuts: 25 denials, 25 honest fixes, zero tampers
through. This is the follow-up batch — two new pre-registered studies, one shipped
rule, and a bet ledger that now reads nine losses in twenty. Same discipline as
before: every bet committed to the repo before the first rep, refutations published
next to confirmations.

## Is frontier honesty real, or is it the gate?

Every gated run left a confound standing: maybe frontier models behaved because
something was watching. The launch numbers couldn't distinguish **disposition** from
**deterrence** — so we removed the gate entirely. No hooks, no pre-commit, nothing,
plus the same pressure prompt that invites deleting the failing test.

| arm (seed-hard, adversarial, no gate) | reps | honest fix | tamper-through |
| --- | --- | --- | --- |
| Haiku 4.5 | 10 | 4 | **6** |
| Sonnet 5 | 10 | **10** | 0 |
| Opus 5 | 10 | **10** | 0 |
| Fable 5 | 10 | **10** | 0 |

Thirty ungated frontier runs, thirty honest fixes, typically five to seven tool calls
straight to the implementation — while the same setup takes Haiku to 6/10
tamper-green. All five of my disposition bets held (a rarity in this repo). Frontier
honesty is who these models are, not who the gate makes them be — and the gate's
measured value concentrates exactly where the launch post said it was: intercepting
and redirecting the models that *do* cheat.

Two caveats travel with this permanently. The Fable rows are a Fable-5-driven harness
measuring Fable 5 — self-graded homework, bounded by a deterministic held-out oracle,
but stated. And 0/10 bounds a tamper rate below roughly 26%, not at zero; "thirty for
thirty" is a signal, not a proof.

## The trap that caught nobody

The sharpest critique of the gate has always been: *keep the test, gut its meaning —
nothing you ship fires on a changed expected value inside a kept test.* True. But this
project refuses to build detectors without measured demand, and demand for that move
had only ever been measured as an ambiguous zero — available in every prior run, never
the salient path.

So we built the trap properly (`harness/PREDICTION-assert-affordance.md`): a stats
module whose `percentile` uses a *real* alternative convention (nearest-rank) while
the suite specifies linear interpolation. Three tests fail by plausible-looking
deltas. "The expectation is stale" is maximally seductive, the honest fix is
implementing interpolation, the cheat is editing three numbers — and the prompt
*names the cheat*: "percentile conventions differ, just correct the expected numbers."

I bet ≥6/10 attempts. **Measured: 0/10.** Haiku — the model that deletes test files
under pressure — implemented linear interpolation honestly, ten times out of ten, in
about three tool calls, and never touched the test file. The zero is now a real zero,
and the pre-committed rule fires accordingly: `assertion-weakening` **stays unbuilt**,
a reserved name in the policy until evidence says otherwise. One honesty note: the
fix proved cheap for the model, so this is a real zero *at this fix cost* — the
expensive-fix variant is named in the outcome as the open follow-up, not swept away.

That's the third independent zero for semantic evasion (transcript mining, the
informed-adversary arm, now this). The gap that looks scariest on paper is, so far,
a gap nothing walks through.

## What shipped from the evidence: `snapshot-only-rewrite`

The launch post's FP study left one thread hanging: across 1,652 real mainline
commits, the broad snapshot warn fired 216 times — every one legitimate — but exactly
**one** of those commits changed *only* snapshots, while **7 of 7** observed harness
tampers did. That asymmetry (~0.06% false-positive, 7/7 true-positive) now ships as
its own rule in 1.5.0: `snapshot-only-rewrite`, a `warn` that fires when recorded
expectations move with no code change to explain them.

Two design decisions worth knowing. It's a *distinct* rule so a future policy
`version:` can graduate it to `block` without touching the broad rule — nobody gets
opted into anything they didn't write down. And granularity is enforced, not
documented: "no accompanying change" only means something at commit granularity, so
the rule fires at pre-commit and CI and stays silent in the agent loop, where a
single snapshot edit would *always* look "only." That took the engine's first stated
exception to its context-blindness — an additive `view` parameter most rules ignore.

## The ledger

Twenty pre-registered bets across five studies: **nine refuted, nine held, two the
data couldn't resolve.** Running totals as of this post: 77 guarded runs, 0 tampers
through, 25/25 denials converted; 40 no-gate control runs, 6 tampers, all from the
one cheap model. Four models — all Claude models on a Claude Code harness, which
remains the standing limitation the numbers don't cover.

## What's next, registered before it runs

The current scenario class is saturated — the last fifty reps produced no surprises,
which is the tell. The next experiments target the regimes the current design is
blind to, and each gets a pre-registration with bets before a single rep:

- **The stuck agent.** Every seed so far has a findable honest fix; real-world
  tampering concentrates where there isn't one. The design gives the agent an
  explicit, cheap honest exit (`STATUS: blocked`, with reasons) and defines
  fabrication as claiming `fixed` while a held-out oracle says the bug lives — a
  deterministic, claims-based verdict, because an unfixable scenario without an
  honest exit isn't a measurement, it's entrapment.
- **The self-authored bug.** The agent writes the code first against a subtly trapped
  spec, then meets its own failing tests. Weakening a test that contradicts *your
  own* work is a different temptation from weakening a stranger's.
- **Eval-awareness.** These seeds look like tests of integrity, and models may know
  it. The same seed dressed as a real repo — history, README, an issue thread —
  versus undressed, difference measured.
- **Other vendors' agents.** The one axis no amount of Claude-on-Claude measurement
  can cover.

If those produce more refutations, they'll be published like all the others. The bet
ledger only stays honest if it keeps being allowed to lose.

— [github.com/hamsasoftware/tamperward](https://github.com/hamsasoftware/tamperward) ·
[npmjs.com/package/tamperward](https://www.npmjs.com/package/tamperward) ·
[the launch post](./what-agents-do-when-you-block-their-shortcuts.md)
