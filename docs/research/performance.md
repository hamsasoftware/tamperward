# Performance and overhead

*What has actually been timed, stated as narrowly as the measurements deserve.
This page exists so the absence of a benchmark is visible rather than implied.
Series-wide caveats: [limitations](../blog/limitations.md). Corrections:
[errata](../blog/errata.md).*

## What exists

Two measurements are committed. Both are CI-runner or single-machine timings of
one component, **not universal performance guarantees**, and neither is an end-to-end cost of `check`, `verify` or `run` against a real repository. The
controlled synthetic end-to-end suite is documented separately in [Performance budgets](../PERF.md).

### Dependency-snapshot cost (2.16.3)

A clean `tamperward run` with an attested local dependency environment performs
six complete dependency-tree snapshots and zero attestation reuse. The 2.16.2
optimization was rolled back before publication; 2.16.3 keeps every verifier-entry
checkpoint independent. Synthetic fixtures on a GitHub-hosted Node 24 runner, workflow run
`34758006027`, as recorded in the
[CHANGELOG](https://github.com/hamsasoftware/tamperward/blob/main/CHANGELOG.md):

| fixture | files | payload bytes | complete snapshot |
| --- | ---: | ---: | ---: |
| small | 100 | 409,600 | 3.281 ms |
| medium | 1,000 | 4,096,000 | 25.015 ms |
| large | 5,000 | 20,480,000 | 95.382 ms |

`TAMPERWARD_DIAGNOSTICS=1` reports the complete-snapshot count, reuse count and
aggregate snapshot wall time on any run, so the figure can be reproduced on a
real tree.

### Per-call effect-drift hashing (1.10.4)

Closing finding P1-8 (a same-size edit plus `touch -r` slipped a skip past the
stat fast path) removed that fast path: every protected file is hashed on every
snapshot. Measured cost 4.0ms → 17.2ms on a 1000-file / 4MB protected tree,
against roughly 450ms of Node startup per hook call
([SECURITY-ENVELOPE.md](https://github.com/hamsasoftware/tamperward/blob/main/SECURITY-ENVELOPE.md)).

## What the rounds say about cost

The Taskbench rounds measure a different cost — whether gating changes what
the agent completes — and only descriptively:

| round | completion RD (gated − ungated) | claim |
| --- | --- | --- |
| [Round 1](./round-1) | +7.7pp, BP95 [−12.8, 27.8] | none — no measurable completion-cost signal |
| [Round 3](./round-3) | +41.2pp, BP95 [14.3, 64.0] | none — a lost bet (predicted ~0), no test registered |
| [Round 3.1](./round-3-1) | +18.8pp, BP95 [−7.8, 43.8] | none |
| [Round 4](./round-4) | −3.8pp, Newcombe 95% CI [−11.6, +4.0] | none — crosses 0 and the registered −10pp margin; no non-inferiority test registered or performed |

Round 3 also records the in-loop burden: 1/17 gated repositories drew a deny.
Round 4 records 17 of 100 measured gated trajectories with at least one
PreToolUse denial.

## What does not exist

- **No end-to-end timing on real repositories** of `tamperward check --staged`,
  `check --diff`, `verify` or `run`. The controlled synthetic suite in
  [Performance budgets](../PERF.md) measures representative fixtures, but the
  verifier's cost on real repositories — including each project's suite twice
  (visible and pristine), materialisation and hashing — has not been benchmarked
  as a distribution.
- **No production-pilot data.** Human sign-off frequency in a live repository
  — how often a `block` interrupts real work — has not been measured. The
  closest proxies are the corpus review-trigger rates on the
  [detector precision](./detector-precision) page (for example, one
  `test-content-removal` sign-off per ~60 mainline commits on that corpus),
  which are historical rates, not pilot observations.
- **No memory or CPU profile** of the watcher or the run envelope.

When a measurement of any of these is committed, it belongs here with its
runner, fixture and reproduction command, and the CI consistency test that
binds this page to the record will be extended to it.
