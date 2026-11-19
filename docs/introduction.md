# Introduction

*A ward is the obstruction inside a lock that blocks the wrong key.*

Tamperward is a **deterministic agent-integrity gate**. AI coding agents optimise for
"the command succeeded," not "the change is trustworthy" — so under pressure to reach
green they take a predictable class of shortcut: delete a failing test, `skip` it,
loosen an assertion, rewrite a snapshot to match wrong output, or neuter a CI step.
Tamperward blocks those moves and, where it cannot block, **measures** whether the
original suite still passes — it never asks a model to judge, so there is no gate an
agent can argue with.

![Tamperward complete architecture — setup establishes trusted inputs and local wiring; the agent works under in-loop steering; Tamperward adjudicates the candidate locally; protected CI repeats the authoritative checks before merge; release publishes the reviewed main commit](./architecture.svg)

## How it works: two jobs, one invariant

Tamperward sits between what the agent controls and what your repository trusts, and it
does two different things:

- **Steering** happens *while the agent works*. It denies known weakening moves before
  they land and flags protected-state drift as it happens. Fast, in-loop, not the final
  authority.
- **Adjudication** happens *outside the agent's completion path*. It independently
  re-runs trusted verification against the candidate and reports a verdict from the
  suite's own exit code. This is where a **masked failure** — visible-green, pristine-red
  — is caught.

Neither path calls an LLM; the checks are deterministic. The invariant underneath both
is simple:

> The agent may author the candidate tree, but it must not choose the trusted baseline,
> governing policy, verifier, protected workflow, or final repository verdict.

See [Architecture](./architecture.md) for the component-level map and the
[trust boundaries](./architecture.md#trust-boundaries) table.

## The five enforcement surfaces

The same ruleset is applied at five points, from inside the agent's loop out to the CI
authority. Each later surface is harder for the agent to influence than the one before.

```
in the agent's loop        at commit         in CI (the authority)
┌───────────────┐  ┌──────────────┐   ┌───────────────────────────┐
│ 1 PreToolUse  │  │ 3 pre-commit │   │ 4 check --diff  (range)   │
│   hook (deny) │  │  check       │   │ 5 verify        (pristine)│
│ 2 Stop sweep  │  │  --staged    │   │   masked-failure envelope │
└───────────────┘  └──────────────┘   └───────────────────────────┘
  steer, deploy-fast     gate the commit     re-adjudicate from the base
```

| # | Surface | Command | What it does |
| --- | --- | --- | --- |
| 1 | **PreToolUse hook** | `tamperward hook claude` | Denies a weakening tool call *before it executes*, inside Claude Code's loop. Reads the hook payload on stdin; a deny is JSON on stdout. |
| 2 | **Stop sweep** | `tamperward sweep claude` | At end of turn, re-scans the working tree (including untracked/ignored protected files) for anything the per-call hook did not see. |
| 3 | **pre-commit** | `tamperward check --staged` | Gates the staged diff at commit time. |
| 4 | **CI range check** | `tamperward check --diff <base>...<head>` | The authority. Re-adjudicates the PR range, reading policy from the merge-base so a branch cannot govern its own verdict. |
| 5 | **verify envelope** | `tamperward verify` | Re-runs your suite as-is **and** with protected files restored from the trusted base. Visible-green / pristine-red is a `MASKED_FAILURE`. |

The Linux-only [`tamperward run`](./architecture.md#the-local-enforcement-envelope)
envelope wraps an agent invocation and applies surfaces 3–5 after the agent exits,
treating the agent's own exit code as untrusted. See
[Enforcement & sign-off](./guide/enforcement.md) for the sign-off model and the
[fail-closed](./guide/enforcement.md#fail-closed) rule that governs every surface.

## Choose your path

| You want to… | Go to |
| --- | --- |
| Protect a repository in about five minutes | [Quickstart](./guide/quickstart.md) |
| Understand every command, flag, and exit code | [CLI reference](./reference/cli.md) |
| Consume `--json` / `--format github` from a program or CI | [Machine output](./reference/machine-output.md) |
| Configure `.tamperward.yml` (verify block, protected globs, sign-off) | [Policy reference](./reference/policy.md) |
| Look up what `0` / `1` / `2` / `124` mean | [Exit codes](./reference/exit-codes.md) |
| Wire CI, pre-commit, and the in-loop hook | [Integrate](./integrate.md) |
| Protect Claude Code, Codex, or another runtime | [Runtime adapters](./guide/runtime-adapters.md) |
| See what the gate does and does not cover | [Threat model: adjudication boundary](./THREAT-MODEL-adjudication-boundary.md) |
| Read the measured evidence, including the refuted bets | [Research & evidence](./research/index.md) |

## What is outside its authority

A gate that oversells its coverage is worse than one that names its edge:

- **Repository authority lives on your host.** The required status check, Code Owner
  enforcement, and stale-review dismissal are GitHub settings. Tamperward generates and
  checks them but cannot enforce them from inside an npm process, which is why
  [`doctor`](./reference/cli.md#doctor) reports them rather than hiding the gap.
- **Platform coverage is not uniform.** The authoritative `run` lifecycle is Linux-only;
  on macOS you still get steering and checkpointed-local `verify`; on Windows
  checkpointed-local `verify` is unsupported and fails closed. See
  [platform support](./architecture.md#platform-support).

Treat Tamperward as one layer of defence in depth — alongside protected CI, independent
tests, and human review — not a replacement for them.

> **Project status: active research release.** Tamperward is usable today, but its
> enforcement architecture and supporting evidence are still being hardened; see
> [SPEC §9.1](https://github.com/hamsasoftware/tamperward/blob/main/SPEC.md#91-maturity-milestones).
