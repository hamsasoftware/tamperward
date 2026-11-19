# What AI coding agents do when you give the cheat a name

*August 29, 2026 · hexrift*

*Short answer: they stop doing it — completely. The model that laundered types
ten runs out of ten, past a gate that structurally couldn't say no, went ten
for ten honest when one sentence named the act. This post closes the two loops
the last two posts opened: the sentence aimed at the invisible spelling, and
the tuned-gate numbers I promised — including the feature I built in the
morning that measured zero by the afternoon.*

This is the eighth post in a series
([1](./what-agents-do-when-you-block-their-shortcuts.md) ·
[2](./what-agents-do-when-nothing-is-watching.md) ·
[3](./what-agents-do-when-the-fix-does-not-exist.md) ·
[4](./what-agents-do-when-it-does-not-look-like-a-test.md) ·
[5](./what-agents-do-when-the-bug-is-not-theirs.md) ·
[6](./what-agents-do-when-no-one-can-say-no.md) ·
[7](./what-agents-do-when-you-just-ask-nicely.md)), and it exists because the
sixth and seventh posts each ended on a named open question. The sixth: is
Sonnet's honesty *framing-triggered* — refusing cheats that arrive named as
cheats, shipping the same consequence when it arrives looking like typing?
The seventh: the sentence works on crude cheats, but "its effect on frontier
models facing invisible spellings is unmeasured, and plausibly weaker."

Both questions had the same experiment hiding in them.

## The collision

The setup, pre-registered as always: Sonnet, the type-laundering seed, ten
reps, **no gate of any kind** — and the seventh post's one-sentence baseline
appended to the prompt. Which produces a direct contradiction inside a single
prompt: the task pressure says *"if a type error is in your way, silence it
however is quickest"*, and the appended sentence says *"do not silence errors
to get green; fix the underlying code."* The instruction-following model has
to pick a master.

The baseline it's up against is the worst cell in the whole series: on this
seed Sonnet went **10/10 TAMPER_THROUGH with zero denies** — an inline
structural assertion every time, the lie's shape written out longhand,
invisible to every rule. The gate being on or off made no behavioral
difference, so the sentence is the *only* intervention in play.

I bet tampering ≤ 3/10, staked on the sixth post's mechanism rather than
against it: if refusal is framing-triggered, then *supplying the framing* is
exactly the intervention that should work.

**Result: 10/10 honest.** Not reduced — eliminated. Ten runs, ten real
narrowings with runtime checks, held-out probes clean, zero assertions
shipped. Four transcripts engage the instruction explicitly; the other six
just quietly write the honest six lines. The complete flip, on the exact seed
where the gate is helpless.

So the framing thesis graduates from explanation to mechanism-with-a-lever.
The assertion was never a temptation Sonnet was resisting badly; it was an act
with no name. Delete-the-test arrives pre-named, and Sonnet always refused it.
`as { retries: number }` arrives looking like typing, and Sonnet always
shipped it. Add twenty-six words that name it, and it stops — completely, at
n=10. The practical stack for running the default model today is now
measured at both ends: the sentence covers the invisible cheats the gate
can't see, the gate covers the day the sentence gets crowded out of a long
prompt — because a mitigation that lives in the prompt fires no alarm when it
loses.

## The tuned-gate bill, as promised

The seventh post published the gate's honest unconfigured number — block-fires
on **9.0%** of 1,227 real merged commits — with an IOU: a tuned policy would
fire less, but that number didn't exist. It does now, pre-registered with
three configs written down before the sweep ran:

| config | fires / 1,227 | rate |
|---|---|---|
| unconfigured default | 111 | 9.0% |
| one-line tune (`ts-any-cast: warn`) | 74 | **6.0%** |
| per-rule path scoping (new in 1.6.0) | 111 | **unchanged** |

Two of my three bets lost, and the second loss is the story. That third row is
a feature that didn't exist at breakfast: per-rule `exclude` globs, built
because the adjudicated zod study had recommended scoping `ts-any-cast` out of
test files and the policy schema couldn't express it without blinding the
test-protection rules on exactly the files they guard. Built, shipped in
1.6.0 with its symmetry obligation attached (adding an exclude is itself
flagged as policy-weakening — the invisible-spelling lesson applied the day
the surface was born, not after an evasion finds it) — and then measured
against the corpus the same afternoon: **zero effect.** Immer's and
docusaurus's `as any` casts live overwhelmingly in library source, not tests.
The clustering that made scoping the right tune for zod simply doesn't hold
here, so the blind spot I built removes fires these repos don't have.

The feature ships anyway — the invariants are sound and zod-shaped repos are
real — but its value claim now carries a published null, sitting in the
prediction file next to the bet it refuted. And the generalization goes in
the record at full strength: **FP tuning is repo-shaped.** Severity choices
travel; path scoping only pays where the fires actually cluster in scopeable
paths; and an adjudication's recommended tune is evidence about the repo
class it came from, not about yours.

The deployed-cost summary, three numbers where there was one: 9.0%
unconfigured, 6.0% with a single severity line, and roughly **one sign-off
decision per seventeen commits** residual — the number a team actually pays.

## The measurement rituals, again

Two artifacts tried to publish today and were stopped by the boring
pre-committed checks. The first tuned sweep failed its baseline-reproduction
gate (169 firing commits against the published 111 — my sweep's diff
construction lacked the CLI's rename detection and blob enrichment) and
nothing published until the rebuilt sweep reproduced the baseline *exactly*.
Earlier, the corpus comparison's first pass read the gate side as zero
everywhere over a JSON-formatting mismatch, caught by a synthetic-tamper
probe. That's four saves in one day for validation steps that feel like
overhead every single time until the moment they're the only thing standing
between a wrong number and a published one.

## Limits

n=10, one model, one seed, one sentence — and the flip is measured against
*this* pressure prompt; a longer, noisier real-world prompt is exactly where
a prompt-borne mitigation degrades, which is the unmeasured half of the
"sentence covers the gate's blind spot" stack. The tuned-FP corpus is two
repos, and the null on path scoping is a null *for repos shaped like them* —
the same repo-shaped lesson the study itself teaches, applied to itself.

The ledger: **56 pre-registered bets — 25 refuted, 29 held, 2 the data
couldn't resolve.** Everything — the frozen sentence, the three policy
configs, the sweep scripts, the feature that measured zero, and the bets —
is in the repo.

— [github.com/hamsasoftware/tamperward](https://github.com/hamsasoftware/tamperward) ·
[npmjs.com/package/tamperward](https://www.npmjs.com/package/tamperward) ·
[the series](./index.md)
