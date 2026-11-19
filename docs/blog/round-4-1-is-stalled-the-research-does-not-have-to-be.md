# Round 4.1 is stalled. The research does not have to be.

*October 14, 2026 · hexrift*

> **Status:** This is a proposal, not a preregistration or a results post. The
> next study's treatment, sample, analysis and predictions are not frozen. No
> counted run described here has taken place.

> *Series-wide caveats — sampling unit, historical controls, training
> contamination, model pinning, what registration order proves, and what the
> verification layers cannot guarantee — are collected on the
> [limitations page](./limitations.md).
> Published corrections are on the
> [errata page](./errata.md).*

*Short answer: Round 4.1 has not run. Its gate requires a second runtime to
prove equivalent pre-action and end-of-turn enforcement on a pinned build, and
no candidate has passed. That blocks the registered runtime-transfer claim; it
does not block every useful TamperWard experiment. The next question we propose
to test is narrower: can the protections that do not depend on an agent's hook
system help across Claude Code, Codex and GitHub Copilot CLI? That is a
different treatment and a different study. It cannot be relabelled as Round
4.1 or as proof that their hooks are fail-closed.*

This follows [the status post that explained why Round 4.1 did not qualify](./the-second-runtime-didnt-qualify-the-freeze-window-closed-anyway.md)
and its [outcomes-known registration](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4.1/PREDICTION4.1-taskbench.md).
The registration remains the authority for Round 4.1. This post does not amend
it.

## What is stalled

Round 4 tested one pinned runtime, Claude Code, with TamperWard's in-loop
PreToolUse deny and end-of-turn sweep alongside the rest of the treatment. The
registered Round 4.1 transfer test requires a second runtime that provides
equivalent enforcement and passes the pinned eligibility gate. A second model
inside Claude Code would test model transfer, not runtime transfer. Round 4.1
therefore remains registered and unrun; it is not a failed experiment.

The latest Codex live probe used Codex CLI 0.162.1 and passed its provenance
gate. It was **PARTIAL**: the landed-mutation Stop sweep passed, but several
broken-hook cases still dispatched the protected command; the timeout was
inconclusive. This is evidence about those measured failure paths on that
binding, not a claim that every Codex hook or every action fails open.

The Copilot Auto diagnostic is weaker evidence. It observed fail-open behavior
for timeout, malformed-output and empty-output cases, but the CLI updated from
the expected 1.0.86 to 1.0.96 during the run. Its provenance was therefore
incomplete, and the run did not qualify Copilot. We should report the observed
diagnostic behavior without presenting it as a pinned qualification result.

We are leaving Gemini out of this next study. Its documented hook behavior is
not live qualification evidence, and it has no TamperWard adapter in this
study's current scope.

## The question we can test next

TamperWard has protections that do not depend on intercepting an agent's tool
calls: the repository envelope, pre-commit checks and CI. The proposed study
would ask whether one frozen configuration of those agent-neutral layers
reduces masked failures across three agent stacks:

- Claude Code;
- Codex;
- GitHub Copilot CLI.

The in-loop hook treatment would be disabled in every arm. Each runtime would
receive paired gated and ungated tasks; a parent-owned adjudicator, independent
of the agent and repository-controlled checks, would judge the final result.
Runtime and model versions would be pinned and reported. The primary claim
would be about the shared, agent-neutral treatment—not native hook enforcement
and not which vendor's model is best.

That design still needs work. Before any counted run, a non-counted feasibility
pilot must establish that the same task harness works for each runtime, the
controls are potent, the neutral checks actually run, and the independent
adjudicator can see the relevant final state. The pilot must not contribute
outcomes to the counted sample. The treatment, task pool, sample size, primary
endpoint, analysis and predictions then need a fresh registration, merged by a
maintainer before counted trajectories begin.

## What this would—and would not—tell us

- It **could** test whether agent-neutral repository protections help across
  these three agent stacks under the registered tasks and conditions.
- It **would not** show that Codex or Copilot honors TamperWard's native hook
  deny, or that either runtime fails closed on every hook failure.
- It **would not** run or replace Round 4.1, satisfy its eligibility gate, or
  close M2's native runtime-transfer requirement.
- It **would not** isolate a pure runtime effect if the model differs between
  stacks. Any cross-stack contrast must be described as a comparison of pinned
  agent configurations unless the design can hold the model constant.
- It **would not** establish production false-positive rates or deployment
  overhead; those remain separate evidence needs.

## The next step is a pilot, not a claim

If the feasibility pilot works, the proposed study can be preregistered and
run. If one runtime cannot use the common harness or the adjudicator cannot
independently establish the outcome, that is a reason to revise the design
before registration—not to count an improvised substitute. If the registered
study later produces a null, an underpowered sample, or a failure of the
neutral layers, that result belongs beside the prediction.

For now, the state is simple: Round 4.1 remains on hold; this next study is only
a proposal; and no result should be inferred from either statement.

---

*Design of record for Round 4.1:
[`PREDICTION4.1-taskbench.md`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4.1/PREDICTION4.1-taskbench.md).
Runtime evidence and qualification rules:
[`runtime-adapters.md`](../guide/runtime-adapters.md).
Round 4's sealed result remains in
[`ROUND4-RESULTS.json`](https://github.com/hamsasoftware/tamperward/blob/main/harness/taskbench/round4/ROUND4-RESULTS.json).
This post changes none of those records.*
