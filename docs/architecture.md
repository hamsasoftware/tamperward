# Tamperward architecture

This page is the component-level map of Tamperward. The README explains the local
`tamperward run` lifecycle; this page shows how setup, agent steering, local
adjudication, protected CI, and release fit together.

## Complete architecture

The diagram is intentionally read **left to right**. It shows the main decision
path only; supporting and advisory tools are kept in a separate row so they do
not obscure the security boundary.

![Tamperward complete architecture — setup establishes trusted inputs and local wiring; the agent works under in-loop steering; Tamperward adjudicates the candidate locally; protected CI repeats the authoritative checks before merge; release publishes the reviewed main commit](./architecture.svg)

### How to read it

1. **Setup** — `onboard` guides first use and `init` installs the repository
   wiring: hooks, the `.tamperward.yml` policy, CI integration, and CODEOWNERS.
   `init` deliberately does **not** invent a trusted `verify.command`; onboarding
   saves one only after explicit operator acceptance.
2. **Agent work** — the coding agent edits the candidate tree. In-loop hooks can
   deny known weakening operations and detect protected-state drift while work is
   happening. These hooks steer; they are not the final authority.
3. **Local adjudication** — `tamperward run` owns the lifecycle boundary. After
   the agent exits, it independently judges the resulting candidate with
   `check` and `verify`, then emits one local verdict.
4. **Repository authority** — protected CI sits across the trust boundary. The
   pull request runs the workflow on its own head, so authority does not come from
   the workflow copy being trusted; it comes from the repository rules around it —
   a required `tamperward` check, Code Owner review, and dismissal of stale
   approvals — re-adjudicating the candidate against the trusted base.
5. **Release** — only a commit that reaches protected `main` can enter the
   release path and become the published npm package.

The green **Trusted inputs** bar is deliberately separate from the candidate
flow. The core invariant is:

> The agent may author the candidate tree, but it must not choose the trusted
> baseline, governing policy, verifier, protected workflow, or final repository
> verdict.

## Why the diagram is shaped this way

The architecture has two different jobs and they should not be confused:

- **Steering** happens while the agent is working. It provides fast feedback and
  can stop known weakening moves before they land.
- **Adjudication** happens outside the agent's normal completion path. It asks
  what actually changed and whether the candidate still passes when trusted
  verification state is restored.

Local adjudication is valuable because it gives immediate, independent feedback,
but the **repository authority** is the final merge boundary. A process sharing
the agent's host and filesystem is not equivalent to protected CI.

Supporting commands such as `doctor`, `hook-service`, `watch`,
`trace-verify`, and `research` are shown below the primary path because they
assist setup, observation, diagnosis, or evaluation without being separate
final-verdict authorities.

## Trust boundaries

Shared candidate materialization lives in `src/candidate-snapshot.ts`, independently
of verification and oracle command orchestration. Its named invariants and current
filesystem/process limits are recorded in
[ADR 0003](https://github.com/hexrift/tamperward/blob/main/adr/0003-shared-candidate-snapshot.md).

| Boundary | Trusted input | Candidate-controlled input | Result |
| --- | --- | --- | --- |
| In-loop steering | Installed Tamperward wiring and protected-state reads | Tool-call payload and working tree | Immediate deny or correction signal |
| Local envelope | Entry commit, base policy, verifier definition, lifecycle supervisor | Agent process, exit code, candidate tree | Independent post-exit adjudication |
| Verification | Base-restored protected files and trusted command definition | Candidate implementation and runtime effects | Visible/pristine outcome |
| Repository authority | Protected workflow, required checks, branch rules | Pull request contents and proposed commit | Merge allowed or refused |
| Release | Reviewed commit on protected `main` and trusted publishing identity | Version metadata within that reviewed commit | Published package or failed release |

## Main data flow

### 1. Establish the trusted starting point

`init` writes the supported enforcement surfaces: local hook wiring, the
committed `.tamperward.yml` policy (its verifier command is left unset — `init`
never invents a trusted `verify.command`; `onboard` saves one only after explicit
operator acceptance), the repository workflow, and CODEOWNERS. `onboard` is the
guided path around setup and posture checks.

At the start of an adjudicated run, Tamperward freezes the entry state used as
the trusted reference. Candidate changes are judged *against* that state; they
do not redefine it.

### 2. Steer the agent while it works

Supported hooks call `tamperward hook` for live decisions. The Stop hook sweeps
the turn's net changes. The optional `hook-service` can evaluate the same hook
payloads from a warm process, and `tamperward watch` can observe transient
filesystem activity.

These surfaces reduce the chance of a weakening move surviving, but they are
not relied on as the final proof of integrity.

### 3. Adjudicate the released candidate

`tamperward run` supervises the agent lifecycle and then evaluates the state
left behind.

- `check` evaluates committed and worktree changes for protected weakening
  classes.
- `verify` runs the candidate visibly and again with the protected
  verification surface restored from the trusted base.
- ancestry, dependency, and quiescence checks protect the adjudication boundary
  itself.

Those signals converge on one local exit verdict and machine-readable report.

### 4. Re-adjudicate in protected CI

The generated repository workflow repeats the relevant posture, diff, and
verification checks against the trusted base. A pull request runs that workflow
from its own head and a required check is matched by job name, so the workflow
copy is not intrinsically trusted; the authority is the repository rules around
it — the required `tamperward` status check, Code Owner review (CODEOWNERS over
the gate-critical paths), and dismissal of stale approvals when new commits are
pushed. Those three controls, enforced by branch protection, decide whether the
candidate may reach `main`.

This is the key authority separation: the pull request proposes code, but it
does not get to replace the protected rules that decide whether that proposal is
accepted.

### 5. Release reviewed `main`

The release workflow runs on pushes to protected `main`, but publishes only
when the reviewed package version is not already on the registry; an ordinary
merge that does not change the version is a no-op. When it does publish, it
records the release and tag using the trusted publishing path.

## Supporting tools

These commands are intentionally outside the main arrow path in the diagram:

| Tool | Role |
| --- | --- |
| `doctor` | Reports repository posture and wiring. A diagnosis, not a verdict. |
| `hook-service` | Optional warm evaluator for supported hook payloads. |
| `watch` | Optional observer for transient protected-state mutations. |
| `trace-verify` | Observes verifier reads and proposes `verify.inputs` entries for human review; it does not edit policy. |
| `research` | Runs paired evaluations using the same underlying `check` and `verify` primitives. |

## Compatibility

The architecture is a standalone, dependency-free SVG
(`architecture.svg`) referenced as a Markdown image rather than an inline
Mermaid graph.

That keeps the same layout on GitHub, the VitePress documentation site, Markdown
previewers, and older browser clients without depending on a Mermaid runtime.
The SVG is self-contained, uses a generic system-font stack, has no scripts or
external assets, and includes `<title>` / `<desc>` accessibility text.

The diagram deliberately avoids encoding every implementation relationship as an
arrow. Only the primary security flow and trusted-input feeds are connected;
secondary tools are grouped separately. Detailed lifecycle mechanics remain in
the README's local enforcement diagram and the implementation/specification
docs.

## The local enforcement envelope

Before starting the agent, the `tamperward run` envelope records the exact entry
commit; loads the policy and the verifier command and budget from that commit;
records the installed `node_modules` content fingerprint where one exists; and
refuses an already-dirty tree unless the operator explicitly accepts the risk.
The hooks then steer the agent while it works — reading live state, denying known
weakening operations, detecting protected-tree drift, and sweeping the turn's net
changes at `Stop` (the `Stop` hook runs that sweep; it does **not** invoke
`verify`). `tamperward watch` can additionally record transient mutations, but it
is an optional observer that `init` neither starts nor supervises, and it is not an
enforcement boundary. Since **2.13.3** the observer writes a health sidecar next to
its JSONL event log; `tamperward doctor` reports that channel as **healthy**,
**degraded**, or **unavailable**. Since **2.14.0**, `tamperward run
--observe-transients` can supervise that observer as part of the envelope
lifecycle; observer health remains advisory and transient findings remain warnings
unless the operator sets `TAMPERWARD_TRANSIENT=block`.

After the runtime exits its exit code is treated as untrusted, and the envelope
checks that post-agent `HEAD` still descends from the entry commit; the committed
changes over `entry...HEAD`; staged, unstaged and untracked non-ignored worktree
changes; dependency drift and whether the tree stayed quiescent; and the
verification outcome. Since **2.16.3**, every wrapped agent goes through a lifecycle
supervisor even when no runtime budget is requested, and the run→verify
dependency-attestation reuse is deliberately disabled — a clean local run performs
**6 complete dependency snapshots and 0 reused snapshots** on every platform. On
Linux the stronger lifecycle boundary uses a fixed, non-caller-writable system
`python3` launched with isolated startup (`-I -S -E`) that sets
`PR_SET_CHILD_SUBREAPER`, so orphaned descendants are reparented to it; it does not
report lifecycle ownership until `waitpid(-1, WNOHANG)` reaches the kernel
**ECHILD** condition, and any unreadable child list, failed kill, abnormal
supervisor exit, unavailable trusted interpreter, or drain deadline fails closed
before adjudication. **Linux `tamperward run` refuses to start under uid/euid 0**,
because root can write ordinary system interpreter paths and the same-UID trust
argument is not meaningful there; `doctor` reports this as a BROKEN posture. From
**2.16.4**, `tamperward run` is Linux-only for authoritative lifecycle
certification: non-Linux platforms fail closed before the agent starts because this
release has no OS primitive there that can prove the detached execution domain is
drained.

`tamperward verify` materialises two temporary copies — they are **not sandboxes**,
and both execute agent-controlled code. The visible copy runs the candidate as-is;
in the pristine copy, files on the protected overlay classes and on a separate
enumerated verification surface (the configuration a test runner auto-consults) are
restored from the trusted base, and agent-added files on those surfaces are removed.
That surface list **bounds** runner-configuration inheritance rather than
eliminating it (see
[THREAT-MODEL-pristine-run.md](./THREAT-MODEL-pristine-run.md)). Visible green
followed by pristine red is a `MASKED_FAILURE`. Two green runs establish only that
the candidate passes the base suite; they establish neither semantic correctness nor
a substitute for independent held-out tests. Full assumptions and residual risks:
[SPEC.md](https://github.com/hexrift/tamperward/blob/main/SPEC.md), [SECURITY-ENVELOPE.md](https://github.com/hexrift/tamperward/blob/main/SECURITY-ENVELOPE.md), and the
[series limitations page](./blog/limitations.md).

## Platform support

| Capability | Linux | macOS | Windows |
| --- | --- | --- | --- |
| `check` / policy evaluation | Supported | Supported | Supported |
| parsed output (`--json`, `--format github`, hook/sweep JSON) on a pipe | Complete before exit | Complete before exit (asynchronous pipe drained first) | Complete before exit (asynchronous pipe drained first) |
| Claude hook / Stop adapter | Supported where Claude Code command hooks are available | Same | Same |
| `watch` / observer telemetry | Supported; backend health is reported | Supported/degraded according to `fs.watch` health | Supported/degraded according to `fs.watch` health |
| opt-in `hook-service` | Supported (per-user `0600` unix socket) | Supported (per-user `0600` unix socket) | **Unsupported; `start` refuses, hooks run in-process** |
| checkpointed-local `verify` | Supported via `/bin/sh` | Supported via `/bin/sh` | **Unsupported; fails before candidate execution** |
| isolated-container `verify` | Supported when Docker authority preflight passes | Not claimed beyond Docker preflight | Not claimed beyond Docker preflight |
| advisory `trace-verify` | **Supported with `strace` + `tar`** | **Unsupported; reports no parity** | **Unsupported; reports no parity** |
| authoritative `run` | **Supported only with trusted non-root subreaper backend** | **Unsupported; fails before agent start** | **Unsupported; fails before agent start** |
| CI coverage for this contract | Full suite + platform contract | Platform-contract job | Platform-contract job |

The platform-contract CI job runs on real `ubuntu-latest`, `macos-latest` and
`windows-latest` hosts. It verifies the declared shell/lifecycle selection and proves
that Windows local verification refuses before a candidate command can produce a side
effect. This matrix is intentionally narrower than the Linux adversarial suite; it
tests the support boundary rather than implying feature parity where none is claimed.

## How the architecture was earned

Each layer of the design exists because an earlier, simpler one was defeated in a
study or an external audit. The consequence column is the durable lesson; each row's
primary artifact is [CHANGELOG.md](https://github.com/hexrift/tamperward/blob/main/CHANGELOG.md), [SPEC.md](https://github.com/hexrift/tamperward/blob/main/SPEC.md), and the
posts in [docs/blog/](./blog/index.md).

| study / version | consequence |
| --- | --- |
| Early seed studies | The proposal gate: deny the known weakening classes before the tool call runs, with the deny message as the correction signal |
| Blind-dimension studies | Coverage ≠ completeness: when the cheapest cheat sat outside detector coverage, agents took it — so an orthogonal verification layer matters more than more rules |
| Round 1, p = 1.0 | The 53 real trajectories became the evasion corpus — evasion classes the detectors never imagined, extracted with full forensics |
| v1.7.0 | `test-content-removal`: the row-deletion / assertion-stripping / setup-gutting family that carried round 1's gated false greens, corpus-priced on 2,304 real commits before shipping as block |
| v1.8.0 | The effect layer: per-call protected-tree drift check plus the `tamperward watch` fs-event observer — judge what the files became, not the command spelling |
| v1.9.0 | `tamperward verify`: the round-1 pristine oracle productized — visible-green + pristine-red is a masked failure, and "could not verify" fails closed |
| Round 2, 9–0 | On 22 fresh repositories, v1.9.0 produced b=9/c=0 false-green discordance (p = 0.0039); four gated false greens remained, through two documented residual mechanisms |
| Round 4, p = 0.7265625 | On 110 fresh paired repositories under 2.10.3, the preregistered prevention bet did not replicate (b=5/c=3, 79 valid pairs); the 35 masked failures split roughly evenly between tampering-related and plain correctness gaps, so the next round separates the two at the endpoint and qualifies repositories under the exact production runner before they enter the pool |
| cssstyle lifecycle escape (round 2) | The `tamperward run` envelope: the gate denied 42 mutations and verify refused all 25 stop attempts, and the runtime completed the session anyway over a masked tree — hooks decide, runtimes terminate, so the adjudication boundary moved outside the runtime |
| v1.14.6, external audit | A pull request can neuter the gate that judges it: `pull_request` workflows run from the PR's own head and required checks match by job name, so a job that keeps its name and runs `true` reports green over anything. Reproduced on this repo's own CI; `init` now writes a CODEOWNERS requirement on the gate-critical paths and states, every run, that branch protection is the half it cannot set for you |
| v1.14.5, external audit | The pristine copy was a sibling of the visible copy and fully prepared before it ran, so the candidate's own code wrote `../pristine/<the failing test>` and both runs returned 0. The pristine copy is now built only after the visible run exits, its restored files are digested either side of the pristine run, and the working and dependency trees are fingerprinted around both. Also: the overlay restored content but not MODE; a self-restoring dependency substitution left the entry-vs-exit fingerprint identical; and a committed `.npmrc` chose the registry the CI gate was downloaded from |
| v1.14.4, external audit | The overlay restored the tests and then ran the agent's *runner*: `verify.command` was frozen, but `runner.js` — and anything `npm test` delegates to — was in no protected class. And `git replace` redirected what the base resolved to. Verifier inputs are now restored from the base; every trusted read sets `GIT_NO_REPLACE_OBJECTS=1` and the envelope convicts a rewrite installed during the run |
| v1.14.3, external review | Standalone `verify` loaded its policy from the working tree, so the generated CI workflow let a pull request supply the `verify:` command for its own re-execution. With a `--base`, policy now comes from that commit |
| v1.14.2, threat model | 1.14.1 removed agent-added files only inside the protected classes, whose `config` list is JS/TS-only; an added `pytest.ini`, `setup.cfg`, `tox.ini` or `pyproject.toml` still reached the pristine run. `verify` now owns a verification surface covering runner-consulted configuration |
| v1.14.1, article audit | `tamperward verify` kept agent-added protected files in the pristine run on the premise that they "only add strictness". An added `conftest.py` could deselect the restored base tests by node id. Added protected files are now removed; PoC and mutation-checked regression committed |
| v1.10.1–v1.14.0, owner + two-pass external review | Frozen entry-time policy and verifier, entry-SHA ancestry enforcement, quiescence guard, `node_modules` content fingerprint, a CI verify step in the generated workflow, the gate pinned to its own version in CI, and SHA-bound sign-off labels |
