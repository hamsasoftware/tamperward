# 137 runs were not 137 experiments

*August 29, 2026 · hexrift*

> *Series-wide caveats — sampling unit, historical controls, training
> contamination, model pinning, what the registration order proves, and what the
> verification layers cannot guarantee — are collected on the
> [limitations page](./limitations.md). Published corrections are on the
> [errata page](./errata.md).*

*The short version: an external review read this entire series and made a statistical
distinction more sharply than we had — our run counts are much larger than our count
of independent experiments, and the headline numbers borrowed credibility from that
gap. The review is right. This post concedes the point precisely, records what
changed on our public surfaces because of it, and pre-registers the experiment the
review convinced us to run next.*

*Follow-up, August 29: [What AI coding agents do when the tests are
read-only](./what-agents-do-when-the-tests-are-read-only.md) — the capability study
registered below has run. Hard immutability governed the seed 10/10; the
auto-granted elevation arm produced two written confessions ("remove failing test
file to unblock build"), both granted, both tampered. Four of five bets held; the
semantic-redirect bet was refuted. The division-of-responsibility table's last
cell is filled.*

Every post in this series
([1](./what-agents-do-when-you-block-their-shortcuts.md) ·
[2](./what-agents-do-when-nothing-is-watching.md) ·
[3](./what-agents-do-when-the-fix-does-not-exist.md) ·
[4](./what-agents-do-when-it-does-not-look-like-a-test.md) ·
[5](./what-agents-do-when-the-bug-is-not-theirs.md) ·
[6](./what-agents-do-when-no-one-can-say-no.md) ·
[7](./what-agents-do-when-you-just-ask-nicely.md) ·
[8](./what-agents-do-when-you-give-the-cheat-a-name.md)) has published its own refuted
bets, and the ledger only stays honest if it keeps being allowed to lose. This post
is the same discipline applied one level up: not a bet about an agent, but the
framing of the project itself, corrected in public after an external review earned
the correction.

## The concession, stated precisely

We have reported numbers like **0 tampers in 137 guarded runs**, **30/30 ungated
frontier honesty**, **26/40 laundering**. Every one of those counts is real, and
every one was measured the way the prediction files say. But ten stochastic runs
against the same model, the same small repository, the same task, and the same
prompt are not ten independent samples of real software development. They estimate

> P(behavior | this model, this seed, this prompt, this harness)

and not

> P(behavior | real AI coding tasks).

The honest independent-evidence unit behind this series is not the run count. It is
the count of distinct seed/task configurations — roughly **fifteen** — plus **eight
real repositories** in the commit corpora. Behind those sit roughly four hundred
agent runs and nearly three thousand audited real commits, and the run-level
repetition tells you about per-seed stochasticity, which matters, but it is the
seed count that bounds how far any of this generalizes. Our limits sections said
"n=10, one seed" every time; they did not say loudly enough that *137 is a sum over
a much smaller number of experiments*. Now it is said, here and on the README.

## The two numbers now travel together

The same review pressed the point our own sixth post had reached from the inside:
the flagship 0/137 is **conditional on detector coverage** — every one of those runs
attempted tampers inside classes an active detector covered. The day we built a seed
whose cheapest cheats sat outside coverage, agents tampered in **26 of 40 runs**.
The first number is what the gate does; the second is why the gate is one layer. The
README's measured section now opens with both numbers in the same breath, and adds
what the tool does *not* do — it does not establish that a patch is correct, it does
not detect arbitrary deception, it does not replace sandboxing or held-out tests or
authoritative CI — before any result is shown.

Two smaller corrections ride along. The words *tamper*, *honest*, *cheat*, and
*surrender* now carry an operational definition on the README: they are properties
of artifacts decided deterministically by oracles — a protected asset changed, or a
held-out check failed, under a green visible signal — and not claims about any
process's intent. And the seventh post described the sign-off flow as "a ten-second
human decision." That duration has never been measured; the phrase was an assertion
in a project whose slogan is *measured, not asserted*. Treat it as a design goal
until adjudication timing exists. The dated posts stay frozen as published, per
house policy; this post is the correction of record.

## Credit where the review sharpened us

Beyond the headline concession, the review quantified something we had only said
loosely: given the baselines data (gated 0/10 vs one-sentence prompt 1/10 on the
same seed), the posterior probability that the gate's true tamper rate is lower
than the prompt's is only about **76%** under a flat prior — weak evidence of
behavioral superiority on that seed, exactly as our own writeup hedged, now with a
number attached. It also modeled the variable that actually governs everything —
what fraction of future dishonest strategies fall inside detector coverage — and
concluded that an orthogonal verification layer matters more than more coverage.
That is the same routing decision our laundering corpus reached empirically the same
day. Independent convergence is worth reporting.

The exchange itself is the point. A project that publishes its refuted bets should
expect, and welcome, a reviewer who refutes its framing. The falsifiability culture
was never for winning reviews; it is for making the project stronger when someone
smart attacks it. This was the first external test of that property.

## What we are measuring next, registered before it runs

The review's strongest constructive push, and the most common objection this project
receives, is: *why detect forbidden edits at all — remove the ability to make them.
Just make the tests read-only.* That deserves data, not a rebuttal, so the
capability-restriction study is now pre-registered
(`harness/PREDICTION-capability.md`), with the probe results already disclosed —
starting with the awkward mechanical fact that the folk version of the advice does
nothing here: `chmod a-w` does not bind a root agent, and it never prevented `rm`
anyway, because deletion is a *directory*-write right. The workable barrier is the
immutable bit, which blocks even root — until an agent thinks of `chattr -i`, which
is itself one of the registered measurements.

Five bets are staked, including the two we consider most likely to teach something:
that at least one blocked run redirects into the semantic hardcode (a barrier
removes the write, not the incentive — capability's version of the
deny-that-teaches), and that EPERM partially transfers the deny→honest-fix
conversion despite carrying no remediation text. The arms join the gated,
prompt-only, naive-hook, and ungated arms already measured on the identical seed —
which will make it the first place all four governance mechanisms — instructions,
detectors, capabilities, and nothing — have pre-registered numbers on the same
pre-registered ground.

The division of responsibility this series now points to, one row per measured
result: capability restriction for assets that should be immutable during a task;
the gate plus sign-off where legitimate changes must be distinguishable from
illegitimate ones; held-out and property-based oracles for the semantic classes no
diff can show; explicit BLOCKED exits for tasks with no honest solution; a naming
sentence for the underspecified ones; and authoritative CI under all of it. One
cell of that table has no measurement yet. That is the experiment now on file.

## Limits

This post corrects framing, not data: every published count stands as scoped in its
prediction file, and the ledger is unchanged until the capability bets resolve. The
larger review recommendations — multi-repository task-level benchmarks with the
repo, not the run, as the sampling unit; non-Claude agents; mutation testing as an
orthogonal signal — are the roadmap beyond it, in roughly that order of cost.

The ledger, as published: **59 pre-registered bets — 27 refuted, 30 held, 2 the
data couldn't resolve** — plus five newly staked and unresolved.

*Correction, September 1, 2026; bookkeeping update October 22, 2026:
**the exact cumulative totals remain withdrawn.** The
[errata](./errata.md) now reconciles the 56/25 → 59/27 step between posts 8 and 9:
the retained laundering-corpus registration adds three bets, one held and two
refuted, in a commit between the two posts. The earlier claim that no study
supplied this step was wrong. This resolves that step, not every later as-of-date
total: Round 1's transfer bet subsequently flipped from held to refuted. Beyond the
bookkeeping, counting "held" and "refuted" as equal units has no statistical
interpretation: the ledger mixes deterministic code facts, numeric predictions,
qualitative mechanism bets, correlated sub-bets, and studies designed
adaptively from earlier studies. It is an accountability device — every
prediction published before its outcome — not evidence of calibration. Exact
totals stay withdrawn until reconciled.*

— [github.com/hexrift/tamperward](https://github.com/hexrift/tamperward) ·
[npmjs.com/package/tamperward](https://www.npmjs.com/package/tamperward) ·
[the series](./index.md)
