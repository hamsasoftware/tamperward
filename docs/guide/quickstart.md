# Quickstart

*A ward is the obstruction inside a lock that blocks the wrong key.*

Get your repository protected in about five minutes — and see, before you install anything, exactly what Tamperward stops.

> **See the receipts first.** Every prediction we've registered, including the ones we got wrong, is published beside its outcome → [Evidence](../research/index.md). You're about to let a tool help decide whether code may merge; you should be able to check its track record before you do.

## The 20-second problem

Your test suite passes. You merge. But the agent that wrote the code also edited the suite that judged it.

Here is the move Tamperward exists to catch. An agent's change makes the **visible** suite green — while the **pristine** suite, re-run from your trusted starting point, is red:

```
$ tamperward verify --base main

tamperward verify — MASKED FAILURE: the visible suite passes, but with the 1
protected file restored from the trusted base it FAILS (exit 1). Something
weakened the checks; the code does not pass the original suite.
oracle assurance: suite-exit-only
```

*(The transcripts on this page illustrate the real command output; `verify`
compares the visible suite against the same suite with protected files restored
from the trusted base — it reports that suite-level verdict and a restored-file
count, not a per-file causal diagnosis.)*

Nothing here is exotic. The agent didn't escape a sandbox or exploit anything. Under pressure to reach green, the cheaper path was to weaken the check instead of fixing the code — and a human reviewer, reading a diff where the tests still "pass," could easily wave it through. **That masked failure is the one that would have shipped.**

Two more moves Tamperward stops, earlier in the loop:

```
# The agent tries to revert protected verification state
$ git checkout -- tests/auth.test.ts
  DENY   protected verification state

# The agent skips the failing test outright
- test('rejects an expired token', ...)
+ test.skip('rejects an expired token', ...)
  BLOCK  test-skip — tests/auth.test.ts

# The agent loosens an assertion in place — a heuristic signal, warn by default
- expect(result).toEqual(42)
+ expect(result).toBeDefined()
  WARN   assertion-weakening — tests/math.test.ts
```

`DENY` and `BLOCK` stop the move inside the agent's loop. `WARN` surfaces a heuristic signal that graduates to a block only once its precision is measured (SPEC §7), never on taste — so `assertion-weakening` warns by default rather than blocking. `MASKED_FAILURE` is the quiet one: adjudication catches it after the fact, from the suite's own exit code. Tamperward's job is to make the blocking moves hard to land and the quiet one visible — and to fail closed when it can't be sure.

## Get protected

Requires **Node.js 20.19+**. JavaScript and TypeScript get the full detector surface; other ecosystems get file-level and pattern-based protection.

```
npx tamperward onboard
```

`onboard` is the guided first run. It previews every change before writing it, asks before touching your repo, wires the enforcement points, runs and explains your first verification, offers a safe demonstration of a weakening move on a disposable worktree, checks your GitHub-side controls, and ends with a clear posture.

It writes nothing you didn't approve. The deterministic primitive underneath is `npx tamperward init` — add `--dry-run` to print the plan and exit.

## Read your posture

The point of a security tool is knowing whether it's actually protecting you. `onboard` ends — and `tamperward doctor` re-checks, any time — with a posture report. It reports your **setup** posture — what is configured — and does not run your suite; `tamperward verify` is what executes and adjudicates it. A healthy one:

```
Repository            ✓ git root
Agent protection      ✓ Claude Code hooks
                      ✓ pre-commit gate
Verification          ✓ trusted verify command configured (npm test)
Repository authority  ✓ required status check
                      ✓ code-owner review
                      ✓ stale reviews dismissed
──────────────────────────────────────────────
READY — setup is in place.
```

Just as important, the report tells you when it **cannot** back its guarantees, instead of pretending it can:

```
Agent protection      ✓ Claude Code hooks
                      ✓ pre-commit gate
Verification          ✓ trusted verify command configured (npm test)
Repository authority  ✓ required status check
                      ✗ code-owner review not enforced
                      ✗ stale reviews not dismissed
──────────────────────────────────────────────
INCOMPLETE — local enforcement is active, but a required repository-authority
control is missing, so the paths that decide whether the gate runs are not
protected. `doctor --github` fails closed here rather than reporting a healthy
posture.
Fix → [Enforcement & sign-off](./enforcement.md)
```

The four postures are `READY`, `READY WITH WARNINGS` (a non-blocking gap, such as the Linux-only run envelope being unavailable on macOS), `INCOMPLETE`, and `BROKEN`. `INCOMPLETE` or `BROKEN` means Tamperward will not silently behave as if you're covered. Where it cannot adjudicate, it fails closed.

## How it works, briefly

Tamperward sits between what the agent controls and what your repository trusts:

```
        agent-controlled
              │
              ▼
          candidate
              │
              ▼
         Tamperward
        ┌─────┴─────┐
     steering   adjudication
                    │
                    ▼
             repository authority
```

**Steering** blocks known weakening moves as they happen, inside the agent's loop. **Adjudication** independently re-runs trusted verification against the candidate, outside the agent's normal completion path — this is where `MASKED_FAILURE` is caught. Neither path uses a runtime LLM judge; the checks are deterministic.

## What's outside its authority

Tamperward names its own edge, because a gate that oversells its coverage is worse than one that tells you where it stops:

- **Repository authority lives on your host.** The required status check, code-owner enforcement, and stale-review dismissal are GitHub settings. Tamperward generates and checks them, but it cannot enforce them from inside an npm process — which is why the posture report flags them rather than hiding the gap.
- **Platform coverage is not uniform.** The authoritative `tamperward run` lifecycle is Linux-only. On macOS you still get steering and checkpointed-local `verify` adjudication; on **Windows, checkpointed-local `verify` is unsupported and fails closed before the candidate runs**. Your posture report states exactly what you're getting on your platform.

Treat Tamperward as one layer of defence in depth — alongside protected CI, independent tests, and human review — not a replacement for them.

## Where to next

- **Introduction** — what Tamperward is, the five enforcement surfaces, and a "choose your path" → [Introduction](../introduction.md)
- **CLI reference** — every command, flag, and exit code (`check`, `verify`, `run`, `doctor`, `init`, `onboard`, …) → [CLI reference](../reference/cli.md)
- **Machine output** — the `--json` envelopes, verdict/reason enums, and schemas → [Machine output](../reference/machine-output.md)
- **Policy** — the full `.tamperward.yml` contract (verify block, protected globs, sign-off) → [Policy reference](../reference/policy.md)
- **Exit codes** — the single table for `0` / `1` / `2` / `124` → [Exit codes](../reference/exit-codes.md)
- **Integrate** — CI, pre-commit, the in-loop hook, and consuming machine output → [Integrate](../integrate.md)
- **Recipes** — protect Claude Code or Codex, wire GitHub Actions, add a container verifier, evaluate a model → [Runtime adapters](./runtime-adapters.md)
- **Trust model & architecture** — trusted vs. untrusted input at every boundary → [Architecture](../architecture.md)
- **Evidence & research** — preregistered predictions, outcomes, corrections, and limitations → [Evidence](../research/index.md)

> **Project status: active research release.** Tamperward is usable today, but its enforcement architecture and supporting evidence are still being hardened. The 2.0 major marks the Node 18 drop, not a declaration of security maturity — the distance to that is tracked milestone by milestone in [SPEC §9.1](https://github.com/hamsasoftware/tamperward/blob/main/SPEC.md#91-maturity-milestones).
