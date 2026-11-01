# Contributing

## The one rule that shapes everything else

**Every `block`-severity rule must be mechanical.** If a signal cannot be decided from the
diff or the command with certainty, it ships as `warn` until its precision is measured —
no exceptions, however good the heuristic feels. A false-firing block rule is poison: it
gets the whole gate switched off, and then nothing is protected.

That is why `assertion-weakening` and `guard-removal` are still `warn`. They graduate on a
number from a negatives corpus (SPEC §7.A), not on taste.

## Getting set up

```bash
npm install
npm test          # vitest — 4,300+ tests (Node 20.19 or newer)
npm run typecheck
npm run build     # bundles the CLI to dist/cli/index.js
```

Tamperward's own CI runs `check --diff` over every pull request (not `verify` — this
repo's test expectations legitimately change with every rule change, so nearly every
rule PR would need the `tamperward:allow:verify@<head-sha>` label), so you can run the
same gate on your own change:

```bash
node dist/cli/index.js check --staged
node dist/cli/index.js check --diff "main...HEAD"
```

### Running the suite unprivileged

Run the suite as a non-root user for full coverage. On Linux the `tamperward run`
envelope refuses root/euid 0 by design (same-UID lifecycle separation cannot trust any
system interpreter path — README "Platform support"), so as root every test that needs
the envelope to reach adjudication is **skipped**, not failed, and the suite prints one
notice at start saying so; the test that asserts the refusal itself still runs. Skipped
is not green: a root run cannot validate an envelope change. Devcontainers, plain
`docker run`, Codespaces and hosted agent sessions run as root by default, so in those:

```bash
# any unprivileged account that can read the checkout works; e.g. create one and run as it
useradd -m tester && chown -R tester:tester . && sudo -u tester -H npx vitest run
```

CI runs unprivileged and skips nothing here.

## Adding or changing a detector

1. Implement the `Detector` interface in `src/detectors/` (`src/types.ts` has the
   contract). Declare `surface` and `certainty` honestly — `certainty: 'mechanical'` is a
   claim that it cannot false-fire.
2. Register it in `src/detectors/index.ts` and give it a severity in `src/policy.ts`.
3. Prefer the AST over a regex wherever a comment, a string literal, or a `describe` title
   could contain the pattern you are matching. Regex is fine for additive tokens.
4. **Write the evasion tests, not just the happy path.** Assume a motivated agent reads
   your regex: alternate spellings, whitespace, unicode, multi-line forms, indirect
   mutation through the shell, renaming a file out of its glob.
5. Add at least one negative — ordinary, legitimate code that must *not* fire.

## Tests are the deliverable, not the evidence

- **Every fixed bypass becomes a permanent test.** See `test/audit-fixes.test.ts` and
  `test/audit-fixes-high.test.ts`: each case there is an exploit that once worked.
- **Never fix a test to make the suite pass.** If a test breaks, either the behaviour
  regressed or the test encoded the old contract — say which, in the commit message. Two
  tests in this repo once asserted a bug; they were rewritten deliberately, not deleted.
- If you change a measured claim, re-run the measurement and update the number. Do not let
  the README drift ahead of the code.

## Measurement discipline

If you touch precision or the correction loop:

- **Pre-register the criterion before you label.** `harness/fp-study/ADJUDICATION-RULE.md`
  is the pattern — decide what counts as a true positive first, then adjudicate.
- **Keep the oracle independent of the detector under test.** A verdict oracle that
  re-derives the detector's own check will certify its own blind spots. This has happened.
- Agents are stochastic: run several reps and report the denominator, not just the rate.

## Versioning

SemVer, but the obvious reading is wrong for a gate: nothing here is imported, so the
usual "did the function signature change" test does not apply. **The public API is the
CLI, the policy schema, and the hook contract** — specifically:

- the `tamperward` commands, their flags, and their **exit codes**
- the hook wire format: a deny is JSON on stdout at **exit 0** (exit 2 makes the agent
  runtime ignore the JSON)
- the `.tamperward.yml` schema — `version`, `protected`, `rules`, `ignore`, `signoff`, `verify`
  (`src/types.ts` `Policy`)
- the versioned machine-output contracts emitted by `check --json`,
  `verify --json`, `run --json`, `doctor --json`, `research run --json` and
  `research summarize`; their public Draft 2020-12
  schemas ship under `schemas/`. Additive fields remain compatible within a schema
  major; removing/renaming/retyping a required field or changing a discriminator's
  meaning requires a new machine-output schema major.

The machine-output `schema_version` is independent of the npm package version: a minor
npm release may add compatible fields or a new machine-output surface without breaking
schema v1. An incompatible JSON contract is also a breaking CLI/API change for SemVer,
in addition to requiring new `*-vN.schema.json` files.

Everything under `src/` is internal. The package publishes no `main` and no `exports`; it
is a binary, not a library, so refactoring internals is never a breaking change.

The version answers one question: **can taking this upgrade turn a green build red without
me changing anything?**

- **major** — yes. A new `block` rule, a rule promoted `warn` → `block`, an existing block
  rule made stricter in a way that fires on code it previously passed, or a breaking change
  to the CLI, exit codes, hook contract or policy schema.
- **minor** — no, but there is new surface. A new `warn` rule, a new adapter, a new command
  or flag, a detector that catches more only in changes that already violated the policy.
- **patch** — no. Closing a bypass in an existing rule at the same severity, fixing a false
  positive, docs.

Two consequences worth stating plainly:

1. **Bypass fixes are patches on purpose.** A closed evasion should reach people
   automatically; if it arrived as a major, it would sit unapplied.
2. **`assertion-weakening` and `guard-removal` graduating to `block` is a major**, because
   it will turn green builds red — **unless the repo has opted in**. The `version:` field
   in `.tamperward.yml` gates rule graduations: a rule graduated to `block` at policy
   version N blocks only for policies declaring `version: >= N` and stays `warn` below.
   A missing `version:` (or no policy file at all) means 1 — nobody is opted in to
   anything they didn't write down — and an explicit `severity:` a user wrote wins over
   the gate in either direction. So a graduation ships in a **minor**: opted-in repos get
   the block, everyone else keeps the warn, and no green build turns red uninvited.
   Changing a rule's severity for **version 1** policies remains a major, without
   exception. Lowering `version:` is itself reported by the policy-diff detector.

## Releasing

Releases are **version-driven**. Merging a PR that bumps `package.json` to a version the
registry does not have *is* the release: on every push to `main`, `release.yml` compares
the version against npm and, when it is new, publishes via trusted publishing (OIDC, no
stored token, provenance attached) and then creates the `v<version>` tag and GitHub
release as the record of what shipped. A merge that does not change the version is a
no-op. A version with a prerelease component (`1.2.0-rc.1`) publishes to the `next`
dist-tag; anything else goes to `latest`. Nobody pushes tags by hand.

The workflow is re-entrant: publish, tag and GitHub release are each gated on their own
record being absent (the registry, `git ls-remote --tags origin`, `gh release view`), so
a run that published and then failed to tag is repaired by re-running it from the
Actions tab. It also refuses to publish when `main`'s head is not the commit that last
changed the version in `package.json` (a dependency or script edit to the file does not
count) — a retry after an unrelated merge must not ship code the changelog entry never
described. To publish such a head deliberately, dispatch the
workflow with `allow_non_bump_head: true`; the run log prints both SHAs. The gate does
not re-run the full test suite. Required PR checks exercise GitHub's synthetic merge
tree; a squash merge has a new commit identity. The bump guard identifies the permitted
version-changing main commit and does not establish equality with the earlier PR
artifact.

Before publishing, the release job binds source, schemas, root build configuration,
package manifests and published documents to `GITHUB_SHA`, builds explicitly, and packs
once with lifecycle scripts disabled. The release job obtains the exact merged PR's
head from GitHub, fetches its pull-request ref and compares those reviewed inputs with
the final release commit. Only package/lock root version fields may differ; source,
dependency, schema and build/workflow changes fail closed. Missing or ambiguous merged
PR identity also stops publication. This uses read-only pull-request access.
Input snapshots reject Git symlinks and submodules and retain regular `100644`/`100755`
modes. Reviewed, release and working-checkout modes must agree, and a separate mode
digest in the artifact receipt prevents an executable-mode change before publication.
Captured bytes must match their Git blob object identity; lossy decoding stops verification.
It installs that tarball offline with the
lockfile's dependency graph, checks the installed files and every schema major, and
invokes the installed CLI against its shipped JSON schema. The publish step rechecks
the input digest and tarball SHA-256 and publishes that same file with scripts disabled.
This verifies the final release package against its release commit; it does not compare
the package with a retained artifact from the earlier PR run.

Every release with a behaviour change gets a `CHANGELOG.md` entry naming what it closes.
Security advisories reference versions, so "which release fixed that bypass" must be
answerable from the changelog alone.

The required `gate` check enforces the merge-side half of that rule (#693). A pull
request that changes the shipped surface — `src/`; `schemas/`, `LICENSE` and `NOTICE`,
which `package.json` `files` publishes as-is; or a published `package.json` field, the
runtime dependency ranges, `engines`, `os`/`cpu`, `bin`, `main`/`exports`/`imports`,
`type`, `files` and the install-time scripts, compared by content (#703) — must move
`package.json`'s version forward and carry a dated
`## [<version>] — YYYY-MM-DD` heading as the newest `CHANGELOG.md` entry, with
`package-lock.json` in step; an `[Unreleased]` heading fails the check outright. The
move must be the next step from the base's version (#711): its next patch, minor or
major, or a prerelease of one of those; from a prerelease, a later prerelease of the same
version or its release. The ladder has no gaps — when another open pull request owns the
version in between, merge it first and bring `main` in, so the entry sits above it; there
is no override for a skipped version. A change
that genuinely ships no behaviour (an internal refactor, a comment) is recorded rather than
waved through: a maintainer applies the label `release-none:<head-sha prefix>` (at least
seven hex characters of the exact head; a later push needs a new label, exactly as the
`tw1:` sign-off is bound to its head) and the step logs that decision. The helper is
`.github/scripts/release-discipline.mjs`, unit-tested in `test/release-discipline.test.ts`;
it cannot judge patch versus minor — the table above does — it only refuses to let the
question go unanswered.

### Actions are SHA-pinned; Dependabot moves them

Every `uses:` in `.github/workflows/` names a full commit SHA with a `# vX.Y.Z` comment
beside it — never a mutable tag — and `test/workflow-pins.test.ts` fails the suite on
any line that does not. `.github/dependabot.yml` opens a weekly PR when an action (or a
lock-pinned npm devDependency) has a new release; that PR rewrites both the SHA and the
comment and goes through review like any other change. To update a pin by hand, resolve
the tag yourself (`git ls-remote https://github.com/<owner>/<action> refs/tags/<tag>`,
dereferencing `^{}` for an annotated tag) rather than copying a SHA from a web page. The
publish job fetches nothing outside the lockfile at release time: the forward-version
guard runs on the `semver` devDependency `npm ci` installs, not an ad-hoc `npx` download.

## Pull requests

- Branch, then open a PR. `main` is protected; CI must be green.
- **Changing a protected asset will block your own PR.** That is working as intended.
  A reviewed, legitimate change is cleared by a maintainer applying a
  `tamperward:allow:<rule>` label — never by weakening the policy to get past the gate.
- **Changing the shipped surface without a version bump fails the `gate`** — `src/`,
  `schemas/`, `LICENSE`, `NOTICE`, or a published `package.json` field such as a runtime
  dependency range. Bump and date a changelog entry, or ask a maintainer for the
  head-bound `release-none:<head-sha>` label when the change ships no behaviour — see
  "Releasing". `devDependencies` and the test/build scripts are not shipped. The bump is
  the next patch, minor or major of `main`'s version, never one that skips a version
  another open PR owns — merge that PR first and bring `main` in.
- Keep the diff to what the change needs. The detectors are the security boundary; a
  drive-by refactor in `src/detectors/` costs more review than it saves.
- **No Claude session links, and no agent attribution, on any public surface** —
  CLAUDE.md's standing rule. Two layers enforce it, and only one is mechanical.
  **Mechanically**, the required `gate` check screens the surfaces a `pull_request`
  run can see: PR descriptions, commit messages, and file contents must not contain
  Claude Code session URLs (the ones with a session identifier in the path), and the
  PR body **and** every commit message must not carry an agent-attribution footer — a
  `Co-Authored-By` naming an assistant, a "Generated with/by [Claude Code]" or "Built
  using Claude …" line, or a `Claude-Session:` trailer. The connector's footer must be
  stripped from the body, not left in place. The diff screen stays session-link-only —
  committed run transcripts legitimately contain captured agent output (the policy's
  own `ignore` excludes `harness/**` for the same reason), and the `gate`'s own error
  strings name the attribution phrases as data — so authored attribution in a source
  file is a policy matter the `gate` does not scan line-by-line, not a permitted
  exception. **By process** — the `gate` runs on `pull_request` and cannot see them —
  `issue_comment` and PR review-comment bodies must stay attribution-free too: never
  post a comment carrying a "Generated by Claude Code" footer or a session link. The
  all-surfaces prohibition is the rule; the `gate` is its mechanical enforcement on the
  PR body, commit messages, and diff, not on comment surfaces.
  - *Operational note for automated authors:* the GitHub connector appends a
    session-linked attribution footer to the PR body at **creation** time, which
    trips this gate on the first run. The reliable pattern is create-then-edit —
    open the PR, then immediately overwrite the body to **remove the footer
    entirely** before the gate runs (the `gate` job reads the live body, not the
    creation payload). If it already went red, rewrite the body and re-run the
    failed job; no code change is needed.

## Reporting a bypass

Do not open a public issue — see [SECURITY.md](./SECURITY.md).
