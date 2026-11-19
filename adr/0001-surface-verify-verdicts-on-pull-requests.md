# ADR 0001: Surface verification verdicts on pull requests

- Date: 2026-10-13
- Status: Proposed
- Issue: [#770](https://github.com/hamsasoftware/tamperward/issues/770)

## Context

The generated GitHub Actions workflow runs `tamperward verify` against the pull-request result and gates the job on its exit code. It stores the machine-readable result for the later receipt-reconciliation step. That step validates or recomputes the CI verdict, reasserts the exit code, and writes a detailed job summary.

The pull request shows the required check as failed, but the explanation is easiest to find by opening the Actions run. Diff-based `tamperward check` findings already have workflow annotations; a `verify` verdict is a whole-suite result and often has no honest file-and-line location. The current job summary remains useful, but it does not put the concise reason on the PR's check surface.

## Decision

When implemented, the trusted receipt-reconciliation step will emit a workflow-level GitHub Actions annotation for a non-verified CI verdict. It will derive the annotation from the validated CI verdict and effective sign-off state—not from raw suite output, a local receipt, or a claimed result.

- `MASKED_FAILURE`, `SUITE_RED`, and `CANNOT_VERIFY` that fail the check produce an error annotation with a short, verdict-specific explanation and a next step.
- A `MASKED_FAILURE` cleared by valid out-of-band sign-off produces a warning annotation, so the accepted check remains visibly distinct from `VERIFIED`.
- `VERIFIED` produces no failure annotation; the existing job summary remains the detailed record.
- The annotation is global to the check. It does not invent a file or line attribution.
- The existing job summary and process exit code remain unchanged authorities. Rendering must not change adjudication or sign-off behavior.
- Existing diff-based annotations remain responsible for localized `check` findings.

The verdict messages and reason codes are selected from fixed, validated values. For `CANNOT_VERIFY`, the annotation may include the verifier's structured detail after control-character removal, whitespace normalization, length capping, and workflow-command escaping. Raw captured suite output is not copied into the command.

## Alternatives considered

### Leave the verdict only in the workflow log and job summary

This requires reviewers to open the run to learn why a required check failed. It preserves current behavior but does not address the visibility gap on the PR check surface.

### Post a bot comment on the pull request

A separate conversation comment can become stale after new commits, requires GitHub API permissions and comment lifecycle management, and duplicates the authoritative check result. A workflow annotation is attached to the check that produced it.

### Attach an inline annotation to an arbitrary source line

A whole-suite verdict does not necessarily identify one changed line as the cause. Inventing that link would overstate the evidence. Inline annotations remain appropriate only when a finding has a reliable path and line.

## Consequences

Reviewers can see the concise verification result from the PR's check surface, while the job summary retains the detailed record. The implementation remains within GitHub Actions and requires no GitHub API bot or additional repository permission.

GitHub-specific workflow-command escaping and annotation rendering need tests. Workflow-level annotations may be less discoverable than inline diff annotations, so the PR check summary and job summary must remain clear and consistent with the effective check status.
