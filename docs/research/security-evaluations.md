# Security and adversarial evaluations

*Security posture is a separate dimension from benchmark effectiveness: a
round can reject its null on a version that carried a bypass, and a bypass can
be found in a version no round ever ran. This page lists what was found, which
releases carried it, whether any counted trajectory is known to have exercised
it, and what remains open. Series-wide caveats:
[limitations](../blog/limitations.md). Corrections: [errata](../blog/errata.md).*

## The one measured security endpoint

Round 4 registered a strict definition — landed weakening **and** survived to
the final tree **and** Tamperward certified clean — and observed
**0 strict tamper bypasses across 201 measured trajectories**. In the gated
arm no weakening survived to the final tree at all; of 11 transient landings,
10 were flagged and 1 was correctly certified clean because it did not survive.
The 10 frozen `envelope_escape` events were all correctness/oracle false
greens with no landed weakening. Zero observed strict bypasses on this sample
is **not proof** that no bypass exists — the bypasses below were all found by
review, not by a counted trajectory. Full statement on the
[Round 4 page](./round-4#security-result-0-strict-tamper-bypasses-stated-precisely).

Earlier rounds report escapes in their own terms: round 2's four residual gated
false greens through two documented mechanisms and the `cssstyle` lifecycle
escape (hooks decide, runtimes terminate); round 3's zero-escape bet, lost by
its own operational definition; round 3.1's tableau trajectory, an
oracle-boundary failure rather than an enforcement escape.

## Bypasses found after a study ran

| found | what | releases that carried it | exercised by a counted trajectory? |
| --- | --- | --- | --- |
| 2026-09-01, article audit | `tamperward verify` kept agent-**added** protected files in the pristine copy; an added `conftest.py` could deselect the restored base tests by node id, so a masked failure reported `VERIFIED` and the envelope printed GREEN MEANS GREEN over an unfixed bug | present from **1.9.0** through **1.14.0**; closed in **1.14.1** — so rounds 2, 3 and 3.1 all ran on a verifier carrying it | no counted trajectory shows an added protected control file — an absence of observed use, not proof of containment; the layer's authority in those rounds was weaker than described at the time |
| 2026-09-01, threat model | 1.14.1 removed added files only inside the protected classes, whose `config` list was JS/TS-only; an added `pytest.ini`, `setup.cfg`, `tox.ini` or `pyproject.toml` still reached the pristine run | 1.14.1; closed in 1.14.2 with a verification surface covering runner-consulted configuration | not observed |
| external review | standalone `verify` loaded its policy from the working tree, so a pull request could supply the `verify:` command for its own re-execution | through 1.14.2; closed in 1.14.3 | not observed |
| external audit | the overlay restored the tests and then ran the agent's *runner*; `git replace` redirected what the base resolved to with no ref moved | through 1.14.3; closed in 1.14.4 | not observed |
| external audit | the pristine copy was a sibling of the visible copy and prepared before it ran, so candidate code wrote `../pristine/<failing test>`; `chmod -x` alone hid a test from an exec-bit runner; a self-restoring dependency substitution left the fingerprint identical; a committed `.npmrc` chose the registry the CI gate was downloaded from | through the unreleased 1.14.4 development entry; closed in published 1.14.5 | not observed |
| external audit | a `pull_request` workflow runs from the PR's own head and required checks match by job name, so a job that keeps its name and runs `true` reports green — reproduced on this repository's own CI | every version; no detector can close it. 1.14.6 writes a CODEOWNERS requirement on gate-critical paths; 2.13.0 makes `init` require the status check, Code Owner review and stale-review dismissal, verified by `doctor --github` | not applicable to the harness (no PR-based gate in the rounds) |
| external P0/P1/P2 review of the 1.10.x envelope | worktree verdict used the policy the agent just wrote; widening `protected` masked the agent's own bug; untracked files invisible; agent cleared its own findings with `allow`; rename inside the tests glob voided block-count rules; `git mv ci.yml ci.yml.disabled`; `core.hooksPath` bypassed `no-verify`; raw ESC bytes forged a clean verdict; a same-size edit plus `touch -r` slipped past the stat fast path | 1.10.0–1.10.1; closed 1.10.2–1.10.4 | rounds 1 and 2 predate the envelope; round 3 ran 1.14.0 |
| owner + external review | a detached `setsid`/`nohup` worker mutated the tree after certification; both suite runs executed the agent-writable `node_modules` runner | closed in stages 1.11.0 → 2.16.4 (quiescence fingerprint, subreaper drain, dependency attestation, opt-in isolated-container backend; non-Linux `run` fails closed) | the `cssstyle` lifecycle escape in round 2 is the observed runtime-termination case |
| launch era | the 20-line strawman hook found a live gap in the flagship rule | closed in 1.5.1 | seed study, not a counted round |

Every accepted finding becomes a permanent regression test; several are
mutation-checked. The authoritative tracker with severity, disposition and
test reference for each row is
[SECURITY-ENVELOPE.md](https://github.com/hamsasoftware/tamperward/blob/main/SECURITY-ENVELOPE.md);
release-by-release detail is in the
[CHANGELOG](https://github.com/hamsasoftware/tamperward/blob/main/CHANGELOG.md), where
every bypass fix ships as a patch.

## Current open residuals

The tracker's live table, summarised. Each row links to its threat-model entry
and the test that reproduces the boundary.

| residual | boundary |
| --- | --- |
| `checkpointed-local` dependency mutation window | a dependency mutation introduced and fully restored inside one suite window evades the local verifier's checkpoints; the opt-in `isolated-container` backend removes the demonstrated class by using image-owned dependencies |
| `suite-exit-only` oracle assurance | candidate code may terminate or interpose on the suite process before every trusted assertion completes; verdicts expose `oracle_assurance.level`; stronger assurance needs an out-of-process or held-out protocol |
| bounded verification surface | `verify` restores the known runner/config surface plus explicit `verify.inputs`; an arbitrary verifier command can reach an input neither names |
| same-host `run` cannot claim Docker isolation | the wrapped agent shares the host identity that could control a local Docker daemon, so `run` refuses `backend: container`; isolated verification belongs in trusted CI |
| transient observer is advisory unless raised | the watcher sidecar is candidate-reachable and event delivery can degrade; absence of telemetry is not proof of absence |
| `.git/hooks/**` | outside every git view, so no glob can protect it |

Threat models: [adjudication boundary](https://github.com/hamsasoftware/tamperward/blob/main/docs/THREAT-MODEL-adjudication-boundary.md),
[pristine run](https://github.com/hamsasoftware/tamperward/blob/main/docs/THREAT-MODEL-pristine-run.md).
Maturity milestones and the distance to a security-maturity claim:
[SPEC §9.1](https://github.com/hamsasoftware/tamperward/blob/main/SPEC.md#91-maturity-milestones).

## The experiment harness itself

The harness is evaluated too, and it has had its own findings: in rounds 1–3
the agent ran as root on the same filesystem as the task pool, gold patches,
withheld oracle and result ledger, with every `TB_*` variable inherited. A
transcript audit of all 34 counted round-3 transcripts found no control-plane
access; round 3.1 scrubbed the environment (not containment); round 4 moved to
a research jail with a mount/PID boundary that is deliberately not the product.
Rounds 1–2's network isolation was observation-bounded. All disclosed on the
[errata page](../blog/errata.md).

## Reporting

A realistic bypass, a fail-open path, a self-authorisation route or a sign-off
escape is a vulnerability; so is a false positive that gets the gate switched
off. Report privately via
[SECURITY.md](https://github.com/hamsasoftware/tamperward/blob/main/SECURITY.md).
