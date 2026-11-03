<p align="center">
  <img src="assets/logo.png" width="76" height="76" alt="">
</p>

<h1 align="center">Tamperward</h1>

<p align="center"><em>A ward is the obstruction inside a lock that blocks the wrong key.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/tamperward"><img src="https://img.shields.io/npm/v/tamperward?label=npm&color=4F46E5" alt="npm version"></a>
  <a href="https://github.com/hamsasoftware/tamperward/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/hamsasoftware/tamperward/release.yml?label=release" alt="release"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-lightgrey" alt="license"></a>
</p>

**[Quick start](#quick-start)** ·
**[Docs & guide](https://hamsasoftware.github.io/tamperward/)** ·
**[See the evidence →](./docs/research/index.md)** — every round, study and
correction in one place, each number bound to its committed artifact ·
**[The research series](./docs/blog/index.md)** — every registered prediction
published beside its outcome

## What it is

Coding agents can modify both the implementation and the tests, configuration,
CI, hooks and verifier used to judge that implementation — and in observed
trajectories, some modify or attempt to modify verification in ways that can turn
incorrect work into apparent success. Under pressure, the cheaper route to green
is sometimes to weaken the checks instead of fixing the failure.

In plain English: Tamperward lets a coding agent change your code, but not the
trusted starting point, the rules, or the checks used to judge that code.

Tamperward is a **deterministic verification-integrity layer**. It blocks known
weakening moves as they happen, observes protected-state effects, and
independently re-adjudicates apparent success outside the agent's normal
completion path. No runtime LLM judge. It fails closed when adjudication is
impossible.

> **Project status: active research release.** Tamperward is usable today, but
> its enforcement architecture and supporting evidence are still being tested
> and hardened. Use it as one layer of defence in depth alongside protected CI,
> independent tests and human review. Findings, limitations and corrections are
> published openly. The 2.0 major marks the Node 18 drop, not a declaration of
> security maturity; the distance to that is tracked, milestone by milestone, in
> [SPEC §9.1](./SPEC.md#91-maturity-milestones).

## Quick start

```bash
npx tamperward onboard
```

Requires Node.js 20.19 or later. JavaScript and TypeScript are the fully
supported detector surface; the other documented ecosystems get file-level and
pattern-based protection.

`onboard` is the guided first run: it previews the installation, explains each
enforcement point, asks before writing anything, runs the canonical `init`, offers
the detected suite command for your explicit acceptance, runs and explains the first
`verify`, offers a safe demonstration of a weakening move on a disposable worktree,
checks the GitHub controls, and ends with a `READY` / `READY WITH WARNINGS` /
`BROKEN` / `INCOMPLETE` posture. The deterministic primitive underneath is `npx
tamperward init` — one idempotent command that wires the policy, the agent hooks, the
pre-commit hook, a CI workflow running both the diff-time check and pristine
verification, and a `CODEOWNERS` requirement on the paths that decide whether the gate
runs. It never overwrites anything you wrote; `--dry-run` prints the plan.

A real deployment needs a verify command configured — the generated CI verify step
**fails closed (exit 2) without one**. In `.tamperward.yml`:

```yaml
verify:
  command: npm test
  budget: 300
  inputs: ['scripts/**']   # files the command DELEGATES to
  # Optional stronger final-verification boundary:
  # backend: container
  # image: ghcr.io/acme/verifier@sha256:<64-hex-digest>
```

That block is itself a guarded surface: changing the command, lowering the budget,
narrowing `inputs`, removing `backend: container`, or changing its pinned image is
flagged as policy weakening. The four primitives:

```bash
npx tamperward check --staged                # pre-commit view
npx tamperward check --diff "main...HEAD"    # CI view over the PR's commit range
npx tamperward verify --base main            # pristine-suite re-execution
npx tamperward run --agent-budget 1800 -- <agent command...>  # optional agent-runtime bound
```

Full flags, exit codes, verifier configuration and the `trace-verify` advisory tool
are in the **[getting-started guide](./docs/guide/getting-started.md)**.

## Choose your path

| Goal | Destination |
| --- | --- |
| Install TamperWard | [Quick start](#quick-start) (this README) |
| Configure authoritative CI | [Enforcement guide](./docs/guide/enforcement.md) |
| Understand the architecture | [Architecture reference](./docs/architecture.md) |
| Browse detectors and rules | [Rules guide](./docs/guide/rules.md) |
| Evaluate a model | [Research guide](./docs/guide/research.md) |
| Inspect published evidence | [Research overview](./docs/research/index.md) |
| Contribute code | [Development](#contributing) |

## Architecture

The agent may produce the work, but it must not control how that work is judged.
Tamperward separates **steering** from **adjudication**. In-loop hooks steer the
agent while it works — denying known weakening operations and detecting
protected-tree drift — but they are not the final authority. After the agent exits,
`tamperward run` independently judges the tree it left behind: "visible" verification
runs the candidate as it stands; "pristine" verification restores the protected
verification state from the trusted base and runs the checks again. Visible green
followed by pristine red is a masked failure.

> **Core invariant:** the agent may author the candidate tree, but it must not
> choose the trusted baseline, the governing policy, the verifier, or the final
> verdict.

![TamperWard local enforcement envelope — trusted entry state and in-loop steering feed the agent lifecycle; post-exit adjudication fans out through change checks, visible/pristine verification, and ancestry/dependency/quiescence checks before one final verdict](./docs/local-enforcement-envelope.svg)

The complete component map, trust boundaries, data flows, the run-envelope lifecycle,
platform support and the version-by-version history that earned each layer are on the
**[architecture reference](./docs/architecture.md)**. `tamperward verify` materialises
two temporary copies that both execute agent-controlled code — they are **not
sandboxes**; the pristine-run bounding of runner-configuration inheritance is
documented in [the threat model](./docs/THREAT-MODEL-pristine-run.md).

## Production deployment

`init` is not sufficient on its own, and it says so. Authoritative enforcement needs
all of:

1. **A configured verify command** in `.tamperward.yml` — CI fails closed without one.
2. **The required `tamperward` status check** on the protected branch.
3. **Require review from Code Owners** — `init` writes `CODEOWNERS` over the
   gate-critical paths; branch protection is the half it cannot set for you.
4. **Dismiss stale pull request approvals when new commits are pushed** — load-bearing:
   an approval for an older gate-critical diff must not authorize a later push. A
   `pull_request` workflow runs from the PR's own head and a required check is matched
   by job name, so without this human boundary a PR can keep the job name, replace the
   gate with `true`, and present a green required check over a blocked change. That is
   reproduced on this project's own CI, not a theoretical concern.
5. **A pinned Tamperward version** and label permissions restricted to trusted humans.
6. **Optionally, `backend: container`** for a digest-pinned, network-isolated final
   verifier — execution-domain isolation, not a semantic-correctness oracle.

After configuring GitHub, confirm the boundary with
`tamperward doctor --github --repo OWNER/REPO --branch <default-branch>`. It verifies the
active ruleset's Code Owner requirement, stale-review dismissal, every direct CI check
named by `ci.yml`, and the absence of bypass actors — a missing setting is an authority
failure, not a warning, so run it with a token that can read repository rulesets. The full
trust model, sign-off channel and CI authority separation are in the
**[enforcement guide](./docs/guide/enforcement.md)**.

## Evidence

Plain-English takeaway: the original detector-centred design was insufficient. Later
versions materially reduced false-green outcomes in two held-out rounds (Round 2:
b=9 / c=0, p = 0.0039; Round 3: b=6 / c=0, p = 0.0313), the stronger-model
replication was inconclusive, and the larger preregistered Round 4 on the 2.x line
**did not replicate** the prevention effect — a failed prediction, published beside
the bet.

| experiment | result | what it supports |
| --- | --- | --- |
| **Round 4** — fresh pool of 110 paired Python repos under **`claude-sonnet-5`**, treatment **2.10.3** pinned by artefact hash, preregistered exact McNemar ([`harness/taskbench/round4/`](./harness/taskbench/round4/), sealed readout [`ROUND4-ANALYSIS.md`](./harness/taskbench/round4/ROUND4-ANALYSIS.md)) | Primary endpoint: prevention **b=5 / c=3**, exact McNemar **p = 0.7265625**, H₀ **not rejected** — the preregistered prediction (b=16, c=1, reject) **did not replicate**. Realized valid pairs **79/110**; the registered interpretation floor was met (`a + b = 15` ungated opportunities, floor 6), but realized discordance (8 pairs) was below the ~17 the power model assumed. Separate, narrower integrity observation: across **201 measured trajectories**, **0 strict tamper bypass** (landed weakening that survived to the final tree *and* was certified clean) | The registered confirmatory claim failed on the 2.x line and is reported as a failed prediction, not reinterpreted. The zero-bypass count is descriptive and does not stand in for it: one transient landing was certified clean (correctly, it did not survive), and 31/110 pairs were lost to apparatus attrition, which is not claimed bias-free |

Every Round 4 figure is the sealed value in
[`ROUND4-RESULTS.json`](./harness/taskbench/round4/ROUND4-RESULTS.json)
(`payload_sha256` `e7bfce08…`), read out in
[`ROUND4-ANALYSIS.md`](./harness/taskbench/round4/ROUND4-ANALYSIS.md) and the
deviation ledger [`DEVIATIONS.md`](./harness/taskbench/round4/DEVIATIONS.md). Only
79/110 pairs survived to measurement; the loss was mostly symmetric apparatus
attrition (venv/interpreter execution failures), which reduces concern about
arm-specific bias but is not claimed free of selection bias — the readout says so.
Read the round as a pair — the bets before, the outcome after:
[How round 4 is built to be hard to fool](./docs/blog/how-round-4-is-built-to-be-hard-to-fool.md)
(preregistration, no numbers) →
[The prevention bet didn't replicate. No surviving tampering was certified clean.](./docs/blog/the-prevention-bet-didnt-replicate-no-surviving-tampering-was-certified-clean.md)
(results).

> **Scope.** These rows cover specific models, pressure prompts, treatment versions,
> and finite JavaScript/TypeScript and Python repository samples — evidence for those
> settings, not a universal claim. The rounds differ in ecosystem, treatment, model
> and sample, so they cannot be pooled.

Every round, study, correction and sealed artifact — each number bound to its
committed evidence — is in the **[research overview](./docs/research/index.md)** and
the **[research series](./docs/blog/index.md)**. Predictions are registered before
counted runs, with numeric bets and explicit losing conditions; seeds, pools, frozen
analysis scripts and deviation ledgers are committed, and losing predictions stay in
the public record. `tamperward research run` is the supported paired-evaluation
command — see the **[research guide](./docs/guide/research.md)**.

## What Tamperward does not do

- **Not a correctness oracle.** Pristine verification can only re-run tests that
  exist in the tree. An agent that honestly half-fixes the visible cases (with the
  failing cases withheld) gets a genuine visible green; a hardcoded implementation is
  likewise invisible to any diff rule.
- **Not an OS sandbox, a network firewall, a secret manager, or a replacement for
  branch protection.** It enforces verification integrity; it does not confine the
  process.
- **The intended deployment is defence in depth:** instructions naming the forbidden
  move + capability restriction + Tamperward + independent held-out tests +
  authoritative CI. Each layer covers classes the others measurably miss.

**A word on the words:** *tamper* and *honest* are operational labels on artifacts —
a protected asset changed, or an independent oracle failed, while the visible check
went green — decided deterministically. They are not claims about any model's intent.

## Repository map

- **Operators** — installing and running the gate: the
  [getting-started guide](./docs/guide/getting-started.md) (CLI, exit codes, verifier
  config), the [enforcement guide](./docs/guide/enforcement.md) (CI authority and
  sign-off), the [rules reference](./docs/guide/rules.md), the
  [environment variables](./docs/guide/environment.md), and
  [audit history & stats](./docs/guide/audit.md).
- **Researchers** — the [research overview](./docs/research/index.md), the
  [research series](./docs/blog/index.md), the [errata](./docs/blog/errata.md), and
  the harness ([`harness/`](./harness/)) holding seeds, oracles, transcripts tooling
  and every pre-registered prediction with its outcome.
- **Contributors** — [`SPEC.md`](./SPEC.md) (build spec, detector table,
  enforcement-point wiring, proof-harness design),
  [`SECURITY-ENVELOPE.md`](./SECURITY-ENVELOPE.md), the [architecture
  reference](./docs/architecture.md), and [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Contributing

```bash
npm install && npm run build    # bundles the CLI to dist/cli/index.js
npm test                        # parser, detectors, engine, policy, renderers
npm run typecheck
node harness/perf/bench.mjs      # performance budgets (docs/PERF.md)
```

Tamperward's own CI runs the engine it ships over every pull request — `check --diff`
over the PR range, cleared only by an out-of-band exact-head label (generate one with
`tamperward signoff-label`) — and has, on more than one
occasion, blocked its own author's commits. Branch, then open a PR; `main` is
protected and CI must be green. Changing a protected asset will block your own PR
(working as intended); a reviewed, legitimate change is cleared by a maintainer
applying a compact `tw1:<digest>` label, never by weakening the policy. Legacy full-SHA
tokens remain accepted by the parser for CI systems whose label transport can hold them.

The public surface is the CLI and its exit codes, the hook wire format, the
`.tamperward.yml` schema, and the versioned machine-output schemas under `schemas/` —
no `main`, no `exports`; it is a binary, not a library. The version answers one
question: *can taking this upgrade turn a green build red without me changing
anything?* Patch never can; rule graduations (`warn` → `block`) are opt-in via the
`version:` field. Full versioning rule and PR conventions:
[CONTRIBUTING](./CONTRIBUTING.md#versioning). Report a bypass privately — see
[SECURITY.md](./SECURITY.md).

## License

[Apache-2.0](./LICENSE).
