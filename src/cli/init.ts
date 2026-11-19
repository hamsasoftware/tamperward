// `tamperward init` — wire the policy and every enforcement point in one command.
//
// SPEC promised this since v0.2 ("tamperward init is not yet shipped"); until now
// adoption meant hand-writing a policy, editing .claude/settings.json, a pre-commit
// hook, and a CI workflow. Four pieces of friction between `npm install` and
// "protected" is how a gate ends up guarding nothing.
//
// CONTRACT: idempotent and non-destructive. Running twice is a no-op; nothing a user
// wrote is ever overwritten. Files we own are created only when absent; files we share
// (.claude/settings.json, an existing pre-commit script) are MERGED — parsed and
// extended for JSON, appended-with-a-marker for shell — and an unparseable shared file
// aborts that item with an error rather than clobbering it. `--dry-run` prints the plan
// and writes nothing.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { POLICY_FILE } from '../policy';
import { loadPolicy } from '../policy-load';
import { GENERATED_CI_TIMEOUT_MINUTES } from '../verifier-limits';
import {
  COPILOT_WIRING_NOTE, HOOK_CMD, MARKER, OURS, PRECOMMIT_CMD, PRE_MATCHER, SWEEP_CMD, TW_VERSION, codexWiringTables, copilotWiringDocument,
  requireShippedVersion, runtimeGatePins, withoutRuntimeGatePins,
} from '../wiring';
import { codexHooksTables } from '../detectors/hook-wiring';
import { detectRuntimes } from '../runtimes';
import { isRecord } from '../narrow';
import { judgeGateEntry, type HookEvent } from '../detectors/hook-tampering';
import { repoRoot } from '../repo-context';
import { atomicReplaceFile, existingMode, refuseNonRegular, writeTargetKind } from '../safe-write';

export interface InitOpts {
  cwd?: string;
  dryRun?: boolean;
  /** @internal Suppress the standalone init narrative when another command
   *  (currently onboard) renders the same canonical plan itself. */
  quiet?: boolean;
  /** Overwrite a CI workflow init did not write, or one that has been edited
   *  since it did. Operator-owned: the default never destroys your work. */
  forceWorkflow?: boolean;
}

interface Action {
  item: string;
  path: string;
  status: 'create' | 'update' | 'ok' | 'skip' | 'error';
  detail: string;
  /** Something the operator must check even though the item applied — printed
   *  after the plan, where it cannot hide inside a table row. */
  warning?: string;
  apply?: () => void;
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, ' ').trim();
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function gitConfig(cwd: string, key: string): string | null {
  try {
    return execFileSync('git', ['config', '--get', key], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

// The tools whose calls the PreToolUse gate must see (PRE_MATCHER, ../wiring).
// NotebookEdit was added in 1.13; an install wired before that has a matcher
// without it, and init's "already wired" check only ever asked whether OUR
// COMMAND was present — so every repo wired earlier kept a permanently narrower
// gate, and re-running init reported it as correctly configured. See
// planClaudeHooks. (P2-12.)
//
// Our three local commands, recognised in any pin. A command someone wrote by
// hand (`node ./node_modules/.bin/tamperward hook claude`) matches too and is
// left exactly as written; only the hardened `npx <fixed npm config>
// tamperward[@v]` form init itself writes is ever re-pinned (OURS, ../wiring).
// hook-tampering judges an edit to
// that form by the same shape: what init would write, modulo a pin that only
// goes up.
const HOOK_RE = /\btamperward(?:@\S+)?\s+hook\s+claude\b/;
const SWEEP_RE = /\btamperward(?:@\S+)?\s+sweep\s+claude\b/;
const PRECOMMIT_RE = /\btamperward(?:@\S+)?\s+check\s+--staged\b/;
// Commands written before this boundary fix are recognised only so `init` can
// migrate them. They are not canonical wiring: project .npmrc still reaches npx.
const LEGACY_OURS = /^\s*npx\s+(?:--yes|-y)\s+tamperward(?:@(\S+))?\s+(hook claude|sweep claude|check --staged)\s*$/;
const PRE_GLOBAL_OURS = /^\s*npx --yes --registry=https:\/\/registry\.npmjs\.org\/ --node-options=' ' --script-shell= --ignore-scripts --offline=false --prefer-online tamperward(?:@(\S+))? (hook claude|sweep claude|check --staged)\s*$/;

// CODEOWNERS. The gate cannot guard the file that decides whether the gate runs.
//
// A `pull_request` workflow executes from the PULL REQUEST'S OWN HEAD, and a
// required status check is matched by JOB NAME. So a pull request can keep the
// job called `gate`, replace every Tamperward invocation in it with `true`, and
// present a green required check over any change it likes — including one the
// gate would have blocked. Reproduced end to end on this project's own CI: the
// job reported success in three seconds, having run `true`, over a pull request
// that lowered a mechanical rule from block to warn.
//
// No detector can close this, because the detector is defined by the candidate.
// The only thing that can is a human requirement on the paths that constitute
// the gate — which is what CODEOWNERS expresses, and what branch protection
// enforces. Both halves are needed: the file alone is advisory.
const CODEOWNERS_MARK = '# tamperward: the gate cannot guard the file that defines it';
const CODEOWNERS_PATHS = ['/.github/workflows/', '/.tamperward.yml', '/.github/CODEOWNERS'];

/**
 * Whether an existing CODEOWNERS already requires an owner on `critical`.
 *
 * Directory rules cover what is under them, so a repository that already writes
 * `/.github/ @someone` needs nothing added for `/.github/workflows/`. Checking
 * for the literal string instead would append rules that are already in force —
 * noise in the one file people need to be able to read at a glance.
 */
function coveredBy(existing: string, critical: string): boolean {
  for (const line of existing.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const raw = t.split(/\s+/)[0];
    if (!t.slice(raw.length).trim()) continue; // a pattern with no owner requires nobody
    if (raw === '*' || raw === '**') return true;
    // `/.github/**` and `/.github/*` are the glob spellings of the directory rule
    // `/.github/`; an unanchored pattern (`.github/`, `CODEOWNERS`) matches at any
    // depth, so it covers the anchored path too. Re-runs used to miss both forms
    // and append a second rule for a path that already had an owner. (D-10.)
    const pattern = raw.replace(/\/\*{1,2}$/, '/');
    if (pattern.includes('*')) continue; // other wildcards: not something this can vouch for
    const anchored = pattern.startsWith('/') ? pattern : '/' + pattern;
    if (anchored === critical) return true;
    if (anchored.endsWith('/') && critical.startsWith(anchored)) return true;
    if (!pattern.startsWith('/')) {
      if (critical.endsWith('/' + pattern)) return true;
      if (pattern.endsWith('/') && critical.includes('/' + pattern)) return true;
    }
  }
  return false;
}

/**
 * `@owner` from the origin remote, or null when it cannot be determined.
 *
 * The first path segment of a GitHub remote is a user OR an organisation, and
 * only a user is a valid CODEOWNERS owner on its own — an organisation must be
 * spelled `@org/team`. GitHub does not say which it is offline, so `confirmed`
 * is true only when the segment is the operator's own login (`github.user` or
 * `user.name` in git config); otherwise the rule is written with a TODO and
 * init warns, because a rule GitHub rejects protects nothing, silently. (D-10.)
 */
function inferOwner(cwd: string): { owner: string; confirmed: boolean } | null {
  const url = gitConfig(cwd, 'remote.origin.url');
  const m = url?.match(/github\.com[:/]+([^/]+)\//);
  if (!m) return null;
  const segment = m[1];
  const self = [gitConfig(cwd, 'github.user'), gitConfig(cwd, 'user.name')].filter((v): v is string => v !== null);
  return { owner: `@${segment}`, confirmed: self.some((v) => v.toLowerCase() === segment.toLowerCase()) };
}

const POLICY_CONTENT = `# Tamperward policy. The BASELINE (all rules, standard protected globs) applies even
# without this file — everything here is an override, so an empty file changes nothing.
# Docs: https://github.com/hamsasoftware/tamperward#readme
#
# version gates rule GRADUATIONS: a baseline rule promoted warn -> block at policy
# version N blocks only when you declare version >= N. Raising it is opting in.
version: 1

# protected:            # categories MERGE with the baseline (additive, never replace)
#   tests: ['e2e/**']
# rules:                # an explicit severity wins over the baseline in either direction
#   snapshot-rewrite: { severity: block }
# ignore: []            # visible blind spots — the count is always reported
`;

// The local hooks are PINNED, like the workflow (HOOK_CMD, SWEEP_CMD,
// PRECOMMIT_CMD, ../wiring). They used to be `npx --yes tamperward` with no
// version: where the package is a devDependency npx runs the installed copy,
// but where it is not — the common case for a repo that only ran `init` —
// every hook invocation resolved `latest` from the registry, so the gate a
// repo ran changed under it without anyone changing anything. That is the
// P2-15 floating dependency again, in the two enforcement points nobody had
// pinned. `init` re-pins an install it wrote for an older version
// (planClaudeHooks, planPreCommit); a command someone edited by hand is left
// alone.

/** The pin an `npx --yes tamperward…` command of ours carries: a version, '' for
 *  unpinned, or null when the command is not one init writes. */
function pinOf(command: string): string | null {
  const m = ours(command);
  return m ? (m[1] ?? '') : null;
}

function ours(command: string): RegExpMatchArray | null {
  const previous = command.replace(' --global', '').replace(' || (echo tamperward: authority failed to start >&2 && exit 2)', '');
  return command.match(OURS) ?? previous.match(PRE_GLOBAL_OURS) ?? command.match(LEGACY_OURS);
}

/** Whether a command init wrote needs re-pinning to this build. */
function stalePin(command: string): boolean {
  const pin = pinOf(command);
  return pin !== null && (pin !== TW_VERSION || !OURS.test(command));
}

const WORKFLOW_CONTENT = `name: tamperward

# The CI authority for main: the same engine as the agent hook and pre-commit, run over
# the PR's commit range. A block fails the check and clears ONLY via the out-of-band
# compact label \`tw1:<digest>\` (print one with \`tamperward signoff-label\`) applied by
# someone with triage access or higher — never a file the PR itself can commit. Legacy
# \`tamperward:allow:<rule>@<head-sha>\` labels remain accepted. The verify step reads
# the same labels: a token for \`verify\` accepts a masked failure a reviewer has judged.
#
# labeled/unlabeled re-run the gate because the sign-off is read from the EVENT payload:
# a label applied after a failure could otherwise never take effect, and REVOKING a
# sign-off must re-block rather than linger green.
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read

jobs:
  tamperward:
    runs-on: ubuntu-latest
    timeout-minutes: ${GENERATED_CI_TIMEOUT_MINUTES}
    steps:
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: 22
      # Install the authority before candidate files exist in the job workspace.
      # npm therefore cannot discover a pull-request .npmrc, and every security-
      # relevant npm setting is fixed on the command line. Later steps invoke the
      # installed binary directly: npm/npx never starts from candidate-controlled cwd.
      - name: Install Tamperward authority
        working-directory: \${{ runner.temp }}
        run: npm install --global --registry=https://registry.npmjs.org/ --node-options=' ' --script-shell= --ignore-scripts --offline=false --prefer-online tamperward@${TW_VERSION}
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
        with:
          fetch-depth: 0 # the range diff needs both endpoints
          # Candidate code runs later in this job. Do not leave the checkout
          # token in .git/config where a verifier command can read/reuse it.
          persist-credentials: false
      - name: Tamperward doctor (CI verifier envelope)
        # Validate the outer GitHub job budget against the TRUSTED base policy
        # before starting visible/pristine execution. Large policy budgets remain
        # valid for custom runners; this generated authority refuses if its host
        # cannot accommodate both stages plus cleanup/reporting reserve.
        run: tamperward doctor --base "\${{ github.event.pull_request.base.sha }}" --workflow .github/workflows/tamperward.yml
      - name: Resolve out-of-band sign-off from PR labels
        id: oob
        env:
          LABELS: \${{ toJSON(github.event.pull_request.labels.*.name) }}
        run: |
          RULES="$(printf '%s' "$LABELS" | jq -r '.[] | if startswith("tamperward:allow:") then sub("^tamperward:allow:"; "") elif startswith("tw1:") then . else empty end' | paste -sd, -)"
          echo "rules=$RULES" >> "$GITHUB_OUTPUT"
      - name: Tamperward gate (diff-time)
        env:
          TAMPERWARD_OOB_SIGNOFF: \${{ steps.oob.outputs.rules }}
          # Binds each approval to the commit it was granted for: labels persist
          # across pushes, so an unbound one would clear every later finding on
          # the same PR. Compact labels hash the exact rule/file/head tuple; legacy
          # labels must read tamperward:allow:<rule>@<head-sha>.
          TAMPERWARD_OOB_HEAD: \${{ github.event.pull_request.head.sha }}
        run: tamperward check --diff "\${{ github.event.pull_request.base.sha }}...\${{ github.event.pull_request.head.sha }}"
      # Diff-time detection is spelling-dependent by nature; pristine
      # re-execution is not, and it was the layer nothing got past in the
      # taskbench sweeps. Shipping a CI template WITHOUT it meant every
      # masked-failure class was adjudicated only at the local layer — the
      # layer an agent shares a filesystem with. (P1-5, external review.)
      #
      # Requires a \`verify:\` block in .tamperward.yml naming the suite command;
      # without one this step fails closed (exit 2) rather than passing quietly.
      - name: Tamperward verify (pristine re-execution)
        # bash so \`set -o pipefail\` propagates verify's exit through the tee — the
        # default GitHub shell does not enable pipefail, and tee's own 0 would
        # otherwise mask a red verify.
        shell: bash
        env:
          # The same channel as the gate. A compact token generated for \`verify\`
          # (or legacy \`tamperward:allow:verify@<head-sha>\`) accepts a MASKED_FAILURE —
          # a reviewer has read the intentional test
          # change and agrees the original suite no longer applies. It clears
          # nothing else: a red visible suite, or a run that could not verify,
          # stays red whatever the labels say.
          TAMPERWARD_OOB_SIGNOFF: \${{ steps.oob.outputs.rules }}
          TAMPERWARD_OOB_HEAD: \${{ github.event.pull_request.head.sha }}
        # --json to a file for the reconciliation step below; the tee keeps the
        # verdict visible in the log. This step remains the ENFORCEMENT authority:
        # its own exit gates the job.
        run: tamperward verify --require-ancestor --base "\${{ github.event.pull_request.base.sha }}" --json | tee "\$RUNNER_TEMP/tw-verify.json"
      # EVIDENCE, not authority (#601). CI has now rerun the canonical verification
      # itself; this step reconciles a claimed LOCAL verification receipt against
      # THAT result and writes a job summary separating the local claim, the CI
      # result and their agreement/divergence. A stale/mismatched/tampered/missing/
      # unknown-schema receipt can NEVER promote a CI result — the reconciled
      # verdict is CI's own (consumed from the verify --json above), recomputed from
      # trusted inputs. Set TAMPERWARD_RECEIPT (e.g. from a download-artifact step)
      # to a receipt exported by \`tamperward receipt export\` on the BRANCH TIP;
      # with none, reconciliation reports NO_CLAIM and CI's verdict stands.
      # \`if: always()\` re-asserts CI's verdict even when the verify step failed.
      #
      # The reconcile computes CI's candidate identity from pull_request.head.sha —
      # the branch tip a developer verifies — NOT this job's merge-ref HEAD, so a
      # genuine receipt's \`head\`/\`tree\` line up (a receipt binds the branch tip;
      # the merge ref is a synthetic commit that no receipt can match). A linked
      # worktree reuses this checkout's object store (base, head and the merge
      # commit are all present from fetch-depth: 0), so merge-base resolves without
      # a second fetch. reconcile with --ci-result runs NO candidate code here — it
      # only computes identity (git/filesystem reads) and consumes the verdict the
      # verify step already produced. The enforcement authority remains the verify
      # step, which runs over the MERGE result as before.
      - name: Tamperward receipt reconciliation (evidence)
        if: always()
        shell: bash
        env:
          # The reconcile step's exit re-asserts CI's verdict, and a MASKED_FAILURE
          # a reviewer has signed off must exit 0 here just as the verify step does.
          # reconcile recomputes that sign-off from this SAME trusted channel — never
          # from the --ci-result document — so a forged oob_signoff field inside the
          # file it validates can never flip the exit (#601 re-review).
          TAMPERWARD_OOB_SIGNOFF: \${{ steps.oob.outputs.rules }}
          TAMPERWARD_OOB_HEAD: \${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          HEAD_TREE="\$RUNNER_TEMP/tw-head"
          rm -rf "\$HEAD_TREE"
          git worktree add --detach "\$HEAD_TREE" "\${{ github.event.pull_request.head.sha }}"
          args=(receipt reconcile --require-ancestor --cwd "\$HEAD_TREE" --base "\${{ github.event.pull_request.base.sha }}" --ci-result "\$RUNNER_TEMP/tw-verify.json")
          if [ -n "\${TAMPERWARD_RECEIPT:-}" ] && [ -f "\${TAMPERWARD_RECEIPT:-}" ]; then
            args+=(--receipt "\$TAMPERWARD_RECEIPT")
          fi
          tamperward "\${args[@]}"
          git worktree remove --force "\$HEAD_TREE" || true
`;

// Provenance mark for the generated workflow. A file init wrote and NOBODY has
// touched can be migrated safely when the template changes; a file someone
// edited must never be overwritten. The stamp records both facts — which
// version generated the body, and the hash of the body as generated — so the
// two cases are distinguishable years later without keeping old templates
// around. Un-stamped files are treated as somebody else's, not as ours.
const WORKFLOW_MARK = '# tamperward:generated';
const WORKFLOW_MARK_RE = /^# tamperward:generated v(\S+) sha256:([0-9a-f]+)\n/m;

function bodyHash(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

function workflowFile(body: string): string {
  return `${WORKFLOW_MARK} v${TW_VERSION} sha256:${bodyHash(body)}\n${body}`;
}

/** The stamp and the body, or null when the file carries no stamp. */
function readWorkflowMark(src: string): { version: string; hash: string; body: string } | null {
  const m = src.match(WORKFLOW_MARK_RE);
  if (!m) return null;
  return { version: m[1], hash: m[2], body: src.replace(WORKFLOW_MARK_RE, '') };
}

// The fields TamperWard reads or writes are named; everything else a user put on
// a matcher or entry is carried as-is — init merges its two hooks in and must
// preserve the rest byte-for-byte (`description`, `timeout`, anything newer).
interface HookEntry { type?: unknown; command?: unknown; [key: string]: unknown }
interface HookMatcher { matcher?: unknown; hooks?: HookEntry[]; [key: string]: unknown }
interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[] | undefined>;
  [key: string]: unknown;
}

/** The tools a matcher selects, or null when it selects everything (`*`, or an
 *  absent matcher — Claude Code treats both as "every tool"). The runtime reads a
 *  matcher of letters, digits, `_`, `-`, spaces, `,` and `|` as an exact list
 *  separated by `|` or `,` with optional surrounding whitespace, so `Edit, Write`
 *  is the same list as `Edit|Write`. */
function toolSet(matcher: unknown): Set<string> | null {
  const m = String(matcher ?? '').trim();
  if (m === '' || m === '*') return null;
  return new Set(m.split(/[|,]/).map((t) => t.trim()).filter(Boolean));
}

/** Tools PRE_MATCHER requires that this matcher does not select. */
function missingTools(matcher: unknown): string[] {
  const have = toolSet(matcher);
  if (have === null) return []; // matches every tool: nothing is missing
  return PRE_MATCHER.split('|').filter((t) => !have.has(t));
}

/** Why `hooks` is not the shape Claude Code reads, or null when it is. */
/** The shape check as a type predicate: what hooksShapeError accepts IS the
 *  typed mapping (every matcher an object, every entry list a list of objects;
 *  the named fields are read tolerantly). The original objects are kept, so
 *  nothing a user put beside our fields is lost when init rewrites the file. */
function isHooksShape(hooks: unknown): hooks is ClaudeSettings['hooks'] | null {
  return hooksShapeError(hooks) === null;
}

function hooksShapeError(hooks: unknown): string | null {
  if (hooks === undefined || hooks === null) return null;
  if (!isPlainObject(hooks)) return 'hooks is not an object';
  for (const [event, arr] of Object.entries(hooks)) {
    if (arr === undefined || arr === null) continue;
    if (!Array.isArray(arr)) return `hooks.${event} is not a list`;
    for (const m of arr) {
      if (!isPlainObject(m)) return `hooks.${event} contains an entry that is not an object`;
      if (m.hooks !== undefined && m.hooks !== null && !(Array.isArray(m.hooks) && m.hooks.every(isPlainObject))) {
        return `hooks.${event} has a "hooks" value that is not a list of { type, command }`;
      }
    }
  }
  return null;
}

/** Advisory high-confidence suite-command candidates, in discovery order. Read by
 *  init's VERIFICATION SETUP status and by `tamperward onboard`, which asks the
 *  operator before any of them reaches the policy. */
export function verifierCandidates(cwd: string): string[] {
  const candidates: string[] = [];
  const add = (command: string): void => {
    if (!candidates.includes(command)) candidates.push(command);
  };

  // package.json is high-confidence only when it has a real test script.
  try {
    const pkg: unknown = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    const test = isRecord(pkg) && isRecord(pkg.scripts) ? pkg.scripts.test : undefined;
    if (
      typeof test === 'string' &&
      test.trim() !== '' &&
      !/error:\s*no test specified/i.test(test)
    ) add('npm test');
  } catch {
    // Advisory discovery only. A malformed/missing package.json is not an init
    // wiring error; the actual verifier remains operator-owned.
  }

  // Python: require an explicit runner config rather than guessing from
  // pyproject existence alone.
  try {
    const pyproject = readFileSync(join(cwd, 'pyproject.toml'), 'utf8');
    if (/^\s*\[tool\.pytest(?:\.ini_options)?\]\s*$/m.test(pyproject)) add('pytest');
  } catch { /* absent */ }
  if (existsSync(join(cwd, 'pytest.ini'))) add('pytest');
  try {
    const setupCfg = readFileSync(join(cwd, 'setup.cfg'), 'utf8');
    if (/^\s*\[tool:pytest\]\s*$/m.test(setupCfg)) add('pytest');
  } catch { /* absent */ }
  try {
    const tox = readFileSync(join(cwd, 'tox.ini'), 'utf8');
    if (/^\s*\[tox\]\s*$/m.test(tox)) add('tox');
  } catch { /* absent */ }

  // Rust: a readable Cargo manifest with an actual package or workspace root.
  // Mere path existence is not a runnable-suite signal: an empty file or a
  // directory named Cargo.toml must not become a "high-confidence" suggestion.
  try {
    const cargo = readFileSync(join(cwd, 'Cargo.toml'), 'utf8');
    if (/^\s*\[(?:package|workspace)\]\s*(?:#.*)?$/m.test(cargo)) add('cargo test');
  } catch { /* absent, unreadable, or not a regular readable file */ }

  // Go: require the module directive that makes this a module root. As above,
  // existence alone is deliberately insufficient.
  try {
    const goMod = readFileSync(join(cwd, 'go.mod'), 'utf8');
    if (/^\s*module\s+\S+\s*(?:\/\/.*)?$/m.test(goMod)) add('go test ./...');
  } catch { /* absent, unreadable, or not a regular readable file */ }

  return candidates;
}

function verifierSetupMessage(cwd: string): string {
  try {
    const policy = loadPolicy(cwd);
    const command = policy.verify?.command?.trim();
    if (command) return `verification configured — ${command}`;
  } catch (e) {
    return (
      'INCOMPLETE: verification not configured — policy cannot currently be loaded; ' +
      `CI will fail closed until the policy is fixed (${errText(e)}).`
    );
  }

  const candidates = verifierCandidates(cwd);
  const lines = [
    'INCOMPLETE: verification not configured — CI will fail closed until .tamperward.yml names a trusted suite command.',
  ];
  if (candidates.length === 1) {
    lines.push(`Suggested verifier command: ${candidates[0]}`);
    lines.push('Review it, then add:');
    lines.push('verify:');
    lines.push(`  command: "${candidates[0]}"`);
    lines.push('  budget: 300');
  } else if (candidates.length > 1) {
    lines.push(`Detected verifier candidates: ${candidates.join(', ')}`);
    lines.push('Choose the suite that defines merge authority, then add for example:');
    lines.push('verify:');
    lines.push('  command: "<reviewed suite command>"');
    lines.push('  budget: 300');
  } else {
    lines.push('Add the reviewed suite command to .tamperward.yml, for example:');
    lines.push('verify:');
    lines.push('  command: "<your test command>"');
    lines.push('  budget: 300');
  }
  lines.push('TamperWard does not write an inferred verifier command automatically because it is part of the trust anchor.');
  return lines.join('\n');
}

function planPolicy(cwd: string): Action {
  const path = join(cwd, POLICY_FILE);
  const refused = refuseNonRegular(path);
  if (refused) return { item: 'policy', path: POLICY_FILE, status: 'error', detail: refused };
  if (existsSync(path)) {
    // "Present" is not "in force": a policy that does not load switches the gate
    // off (check exits 2, the hook denies everything) — init used to report it as
    // fine without reading it. Load it with the real loader and say what is wrong.
    try {
      loadPolicy(cwd);
    } catch (e) {
      return { item: 'policy', path: POLICY_FILE, status: 'error', detail: `present but does not load — ${errText(e)}; fix it, then re-run init (left untouched)` };
    }
    return { item: 'policy', path: POLICY_FILE, status: 'ok', detail: 'already present and loads — left untouched' };
  }
  return {
    item: 'policy', path: POLICY_FILE, status: 'create',
    detail: 'baseline policy with commented overrides',
    apply: () => atomicReplaceFile(path, POLICY_CONTENT, 0o644),
  };
}

/**
 * Fresh Node repositories commonly have dependencies installed before their first
 * commit. If node_modules is not ignored, the staged gate sees third-party source as
 * repository source and correctly reports every suppression pattern it contains —
 * technically sound, but disastrous onboarding. Keep the security boundary honest:
 * make Git exclude the dependency tree instead of teaching TamperWard to ignore a
 * tracked path. If node_modules is already tracked, or the operator has an explicit
 * negation for it, leave the repository semantics alone and surface an action row.
 */
function planGitignore(cwd: string): Action | null {
  const rel = '.gitignore';
  const path = join(cwd, rel);
  if (!existsSync(join(cwd, 'node_modules'))) return null;

  let existing = '';
  let kind;
  try {
    kind = writeTargetKind(path);
  } catch (e) {
    return { item: 'gitignore', path: rel, status: 'error', detail: 'cannot inspect — ' + errText(e) };
  }
  const refused = refuseNonRegular(path);
  if (refused) return { item: 'gitignore', path: rel, status: 'error', detail: refused };
  if (kind === 'file') existing = readFileSync(path, 'utf8');

  // Do not hide a dependency tree the repository has chosen to track. --cached
  // includes index entries on an unborn branch, so this also catches git add .
  // performed before onboarding.
  try {
    const tracked = execFileSync('git', ['ls-files', '--cached', '--', 'node_modules'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (tracked) {
      return {
        item: 'gitignore',
        path: rel,
        status: 'skip',
        detail: 'node_modules is already tracked/staged — left unchanged; TamperWard will scan it as repository content',
      };
    }
  } catch {
    // init is also usable outside Git; pre-commit planning reports that separately.
  }

  const meaningful = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  // A negation is explicit repository intent. Check it BEFORE accepting a broad
  // node_modules ignore: Git's last-match-wins rules may deliberately re-include
  // a vendored patch subtree, and appending another ignore would silently undo it.
  if (meaningful.some((line) => line.startsWith('!') && line.includes('node_modules'))) {
    return {
      item: 'gitignore',
      path: rel,
      status: 'skip',
      detail: 'contains an explicit node_modules negation — left untouched; review the repository ignore policy before committing dependencies',
    };
  }

  // Common root/all-depth spellings. We deliberately do not implement Git's full
  // ignore grammar here; appending an equivalent root rule is harmless and makes
  // the repository's intent explicit.
  if (meaningful.some((line) => /^(?:\/|\*\*\/)?node_modules\/?$/.test(line))) {
    return { item: 'gitignore', path: rel, status: 'ok', detail: 'node_modules is already ignored by the repository' };
  }

  const next = existing.length === 0
    ? 'node_modules/\n'
    : existing.replace(/\n?$/, '\n') + 'node_modules/\n';
  return {
    item: 'gitignore',
    path: rel,
    status: kind === 'file' ? 'update' : 'create',
    detail: 'exclude installed Node dependencies from repository diffs',
    apply: () => atomicReplaceFile(path, next, existingMode(path, 0o644)),
  };
}

/** The detector's verdict on every entry under `event` that carries our command. */
function gateVerdicts(event: HookEvent, groups: HookMatcher[], needle: RegExp): Array<{ event: HookEvent; group: HookMatcher; h: HookEntry; runs: boolean; problems: string[] }> {
  const out: Array<{ event: HookEvent; group: HookMatcher; h: HookEntry; runs: boolean; problems: string[] }> = [];
  for (const group of groups) {
    for (const h of group.hooks ?? []) {
      if (!needle.test(String(h.command ?? ''))) continue;
      const { runs, problems } = judgeGateEntry(event, group.matcher, h);
      out.push({ event, group, h, runs, problems });
    }
  }
  return out;
}

/** Merge our two hooks into .claude/settings.json, preserving everything else. */
function planClaudeHooks(cwd: string): Action {
  const rel = '.claude/settings.json';
  const path = join(cwd, rel);
  const refused = refuseNonRegular(path);
  if (refused) return { item: 'agent', path: rel, status: 'error', detail: refused };
  let settings: ClaudeSettings = {};
  if (existsSync(path)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return {
        item: 'agent', path: rel, status: 'error',
        detail: 'exists but is not valid JSON — fix it, then re-run init (refusing to overwrite)',
      };
    }
    if (!isRecord(parsed)) {
      return { item: 'agent', path: rel, status: 'error', detail: 'exists but is not a JSON object — refusing to overwrite' };
    }
    // The shape Claude Code reads: hooks → event → [{ matcher, hooks: [{ type, command }] }].
    // Anything else used to throw halfway through apply (after the policy was already
    // written) — planned here, so a malformed file is an error row and nothing else.
    const shapeError = hooksShapeError(parsed.hooks);
    if (shapeError || !isHooksShape(parsed.hooks)) {
      return { item: 'agent', path: rel, status: 'error', detail: `${shapeError ?? 'hooks is not the shape Claude Code reads'} — fix it, then re-run init (refusing to overwrite)` };
    }
    settings = { ...parsed, hooks: parsed.hooks ?? undefined };
  }

  const hooks = (settings.hooks ??= {});
  const entriesWith = (arr: HookMatcher[] | undefined, needle: RegExp): HookMatcher[] =>
    (arr ?? []).filter((m) => (m.hooks ?? []).some((h) => needle.test(String(h.command ?? ''))));

  const preEntries = entriesWith(hooks.PreToolUse, HOOK_RE);
  const needPre = preEntries.length === 0;
  const stopEntries = entriesWith(hooks.Stop, SWEEP_RE);
  const needStop = stopEntries.length === 0;

  // NEUTRALISED entries: our command is present, and the runtime would not run
  // the gate through the entry — `"async": true` beside a perfect command means
  // the verdict is never awaited, `"timeout": 1` kills it before it answers, an
  // `if` means it is never asked, a matcher on the Stop entry, a pipe or chain
  // around the invocation. Presence was the whole of the check before (#413),
  // so the file `check --staged` blocks as hook-tampering was the file init and
  // doctor certified as wired. The verdict is the detector's own comparator
  // (judgeGateEntry): one definition of the canonical shape, three consumers.
  // An entry whose COMMAND is one init wrote is restored to the shape init
  // writes; a hand-written command is reported, never rewritten.
  const neutralised = [
    ...gateVerdicts('PreToolUse', preEntries, HOOK_RE),
    ...gateVerdicts('Stop', stopEntries, SWEEP_RE),
  ].filter((v) => !v.runs);
  const foreign = neutralised.filter((v) => ours(String(v.h.command ?? '')) === null);
  if (foreign.length > 0) {
    return {
      item: 'agent', path: rel, status: 'error',
      detail: `${foreign.map((v) => `the ${v.event} gate entry is neutralised (${v.problems.join('; ')})`).join('; ')} — the runtime would not run the gate through it; remove the entry, then re-run init (refusing to rewrite a hand-written entry)`,
    };
  }

  // REPAIR an existing PreToolUse matcher that does not cover every tool the
  // gate must see. Presence of our command was the only thing checked before,
  // so an install wired against an older PRE_MATCHER stayed narrow forever and
  // re-running init confirmed it as fine. A matcher listing fewer tools is a
  // gate with a hole in it, not a preference. (P2-12.)
  const stale = preEntries.filter((m) => missingTools(m.matcher).length > 0);
  // RE-PIN commands init wrote for another version (or wrote unpinned, before
  // 1.14.7). Only the exact `npx --yes tamperward[@v] <ours>` shape qualifies.
  const restoring = new Set(neutralised.map((v) => v.h));
  const repin = [...preEntries, ...stopEntries]
    .flatMap((m) => m.hooks ?? [])
    .filter((h) => !restoring.has(h) && stalePin(String(h.command ?? '')));
  // DECLARE `disableAllHooks: false`. The runtime honours the key from any settings
  // file, the project file overriding the user file, and reloads every file live
  // in-session — so a `true` written to `~/.claude/settings.json` (outside every
  // repository glob) switched the gate off for the rest of the session. With the
  // project file saying `false`, the user file's value never reaches the runtime.
  // hook-tampering holds the declaration in place: removing or flipping it is
  // the tamper. (Pass 3a, P0-1.)
  const needDisableFalse = settings.disableAllHooks !== false;
  if (!needPre && !needStop && stale.length === 0 && repin.length === 0 && neutralised.length === 0 && !needDisableFalse) {
    return { item: 'agent', path: rel, status: 'ok', detail: 'PreToolUse + Stop hooks already wired' };
  }

  const repairing = stale.length > 0 ? [...new Set(stale.flatMap((m) => missingTools(m.matcher)))] : [];
  const pins = [...new Set(repin.map((h) => pinOf(String(h.command ?? '')) || 'unpinned'))];
  return {
    item: 'agent', path: rel, status: existsSync(path) ? 'update' : 'create',
    detail: [
      needPre && 'wire PreToolUse deny',
      needStop && 'wire Stop sweep',
      repairing.length > 0 && `widen the PreToolUse matcher to cover ${repairing.join(', ')}`,
      repin.length > 0 && `re-pin the hook commands to tamperward@${TW_VERSION} (was ${pins.join(', ')})`,
      ...neutralised.map((v) => `restore the ${v.event} gate entry to the shape init writes — it is neutralised (${v.problems.join('; ')})`),
      needDisableFalse && (settings.disableAllHooks === undefined
        ? 'declare disableAllHooks: false so the user settings file cannot switch the hooks off'
        : `set disableAllHooks: false (was ${JSON.stringify(settings.disableAllHooks)})`),
    ].filter(Boolean).join(' + '),
    apply: () => {
      for (const v of neutralised) {
        // The entry as init writes it and nothing else: every key the runtime
        // would honour against the gate (`async`, `if`, a short `timeout`) goes.
        for (const k of Object.keys(v.h)) delete v.h[k];
        v.h.type = 'command';
        v.h.command = v.event === 'PreToolUse' ? HOOK_CMD : SWEEP_CMD;
        if (v.event === 'Stop') delete v.group.matcher;
      }
      for (const h of repin) {
        const kind = ours(String(h.command ?? ''))?.[2];
        h.command = kind === 'hook claude' ? HOOK_CMD : kind === 'sweep claude' ? SWEEP_CMD : h.command;
      }
      if (needPre) {
        (hooks.PreToolUse ??= []).push({
          matcher: PRE_MATCHER,
          hooks: [{ type: 'command', command: HOOK_CMD }],
        });
      }
      for (const m of stale) {
        // Union, not replacement: a matcher someone widened with their own
        // tools keeps them. Only the missing ones are appended.
        m.matcher = [...(toolSet(m.matcher) ?? new Set<string>()), ...missingTools(m.matcher)].join('|');
      }
      if (needStop) {
        (hooks.Stop ??= []).push({ hooks: [{ type: 'command', command: SWEEP_CMD }] });
      }
      if (needDisableFalse) settings.disableAllHooks = false;
      mkdirSync(dirname(path), { recursive: true });
      atomicReplaceFile(path, JSON.stringify(settings, null, 2) + '\n', existingMode(path, 0o644));
    },
  };
}

// Hook MANAGERS that own the script in the hooks directory and regenerate it on
// their next install: a line appended to their file lasts until then, and the
// gate silently stops running. Their wiring belongs in their config, so init
// reports the exact snippet instead of writing where it cannot stay.
const MANAGED_HOOKS: ReadonlyArray<{ name: string; configs: string[]; hookRe: RegExp; hint: string }> = [
  {
    name: 'lefthook',
    configs: ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml', 'lefthook-local.yml', 'lefthook-local.yaml'],
    hookRe: /\blefthook\b/i,
    hint: `add this under \`pre-commit:\` → \`commands:\` in lefthook.yml:\n` +
      `        tamperward:\n          run: ${PRECOMMIT_CMD}`,
  },
  {
    name: 'pre-commit',
    configs: ['.pre-commit-config.yaml', '.pre-commit-config.yml'],
    hookRe: /pre-commit\.com|File generated by pre-commit/i,
    hint: `add this under \`repos:\` in .pre-commit-config.yaml:\n` +
      `        - repo: local\n          hooks:\n            - id: tamperward\n              name: tamperward\n` +
      `              entry: ${PRECOMMIT_CMD}\n              language: system\n              pass_filenames: false\n              always_run: true`,
  },
];

/**
 * The hooks directory git will actually run from. `git rev-parse --git-path hooks`
 * honours `core.hooksPath` (a committed `.githooks/`, simple-git-hooks, lefthook,
 * husky), a worktree's shared git dir, and a submodule's — where a hard-wired
 * `.git/hooks` used to write a hook git never ran and then report it as wired
 * on every re-run. (D-3.) Falls back to `.git/hooks` when git is unavailable
 * but a `.git` directory is present.
 */
function hooksDir(cwd: string): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) return resolve(cwd, out);
  } catch {
    /* not a repo, or no git on PATH */
  }
  return existsSync(join(cwd, '.git')) ? join(cwd, '.git', 'hooks') : null;
}

/** A path for the plan table: repo-relative when it is inside the repo. */
function display(cwd: string, path: string): string {
  const rel = relative(cwd, path);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : path;
}

/**
 * Index of the first line after which nothing in the script runs — an `exec` or
 * `exit` at the TOP LEVEL (not inside if/case/loop/function, not after `&&` or
 * `||`, not a comment, not the redirection-only `exec < /dev/tty`) — or -1.
 * Appending the gate after such a line produced dead code that init then
 * reported as wired. (D-4.) Kept deliberately conservative: a construct this
 * does not understand reads as depth > 0, which means "append" — today's
 * behaviour — never a wrong insertion in the middle of somebody's script.
 */
export function unconditionalExitAt(lines: string[]): number {
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    if (depth === 0) {
      if (/^exit(\s|$|;)/.test(t)) return i;
      const exec = t.match(/^exec(?:\s+(.*))?$/);
      // `exec` alone or followed only by redirections re-plumbs the shell; it does
      // not replace it. `exec cmd …` does.
      if (exec && exec[1] && !/^(\d*[<>]|&>)/.test(exec[1])) return i;
    }
    const opens =
      (t.match(/(?:^|[;(]\s*|&&\s*|\|\|\s*)(?:if|case|for|while|until)\s/g) ?? []).length +
      (/(?:^|\s)\{\s*$/.test(t) ? 1 : 0);
    const closes =
      (t.match(/(?:^|[;]\s*)(?:fi|esac|done)(?:\s|;|$)/g) ?? []).length + (/^\}/.test(t) ? 1 : 0);
    depth = Math.max(0, depth + opens - closes);
  }
  return -1;
}

/**
 * Husky when present; otherwise the hooks directory git resolves; never a file
 * a hook manager will regenerate. Appending to an existing script is safe for
 * shell (a new line at the end) UNLESS an unconditional `exec`/`exit` precedes
 * it, in which case the gate goes before that line. Marked, so re-runs find it.
 */
function planPreCommit(cwd: string): Action {
  const block = [MARKER, PRECOMMIT_CMD];
  const skip = (detail: string): Action => ({ item: 'pre-commit', path: '(none)', status: 'skip', detail });

  let path: string;
  let note: string;
  if (existsSync(join(cwd, '.husky'))) {
    path = join(cwd, '.husky', 'pre-commit');
    note = 'husky';
  } else {
    const managed = MANAGED_HOOKS.find((m) => m.configs.some((c) => existsSync(join(cwd, c))));
    if (managed) {
      return skip(`${managed.name} manages this repository's hooks and regenerates them on install, so a line in the hooks directory would not last — ${managed.hint}`);
    }
    const dir = hooksDir(cwd);
    if (!dir) return skip('not a git repo and no .husky/ — nothing to wire');
    if (basename(dir) === '_' && basename(dirname(dir)) === '.husky') {
      // husky v9 points core.hooksPath at its shim directory; the user's script is
      // .husky/pre-commit, which the shim runs.
      path = join(dirname(dir), 'pre-commit');
      note = 'husky';
    } else {
      path = join(dir, 'pre-commit');
      const rel = display(cwd, dir);
      note = rel === join('.git', 'hooks')
        ? 'plain git hook (local-only: .git/hooks is not committed — consider husky to share it)'
        : `git hooks directory ${rel} (core.hooksPath)`;
    }
  }
  const rel = display(cwd, path);

  const refused = refuseNonRegular(path);
  if (refused) return { item: 'pre-commit', path: rel, status: 'error', detail: refused };
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;
  // Executable, and whatever else the existing script's mode carried.
  const hookMode = (): number => existingMode(path, 0o755) | 0o111;
  if (existing === null) {
    return {
      item: 'pre-commit', path: rel, status: 'create', detail: `create via ${note}`,
      apply: () => {
        mkdirSync(dirname(path), { recursive: true });
        atomicReplaceFile(path, `#!/bin/sh\n${block.join('\n')}\n`, hookMode());
      },
    };
  }

  const owner = MANAGED_HOOKS.find((m) => m.hookRe.test(existing));
  if (owner) {
    return { item: 'pre-commit', path: rel, status: 'skip', detail: `generated by ${owner.name}, which overwrites it on install — ${owner.hint}` };
  }

  const lines = existing.split('\n');
  const dead = unconditionalExitAt(lines);
  // A line whose first non-blank character is `#` is a comment: `# npx …
  // check --staged` is the common "temporarily disable" edit, and it used to
  // read as wired (#413). The gate is what the shell runs, not what the file says.
  const at = lines.findIndex((l) => !/^\s*#/.test(l) && PRECOMMIT_RE.test(l));
  const write = (out: string[]): void => atomicReplaceFile(path, out.join('\n'), hookMode());

  if (at !== -1 && (dead === -1 || at < dead)) {
    // Present AND reachable. Re-pin the line init wrote if it carries another
    // version (or none); a hand-written invocation is left exactly as it is.
    if (!stalePin(lines[at])) {
      return { item: 'pre-commit', path: rel, status: 'ok', detail: 'already runs the staged check' };
    }
    const was = pinOf(lines[at]) || 'unpinned';
    return {
      item: 'pre-commit', path: rel, status: 'update',
      detail: `re-pin the staged check to tamperward@${TW_VERSION} (was ${was})`,
      apply: () => { lines[at] = PRECOMMIT_CMD; write(lines); },
    };
  }

  if (at !== -1) {
    // Present but UNREACHABLE: line `dead` ends the script before it. The block
    // init wrote (marker + our own command) is moved above; anything else is
    // somebody's script, so it is reported rather than rearranged.
    const ours = pinOf(lines[at]) !== null && lines[at - 1]?.trim() === MARKER;
    if (!ours) {
      return {
        item: 'pre-commit', path: rel, status: 'error',
        detail: `the staged check on line ${at + 1} never runs: line ${dead + 1} (\`${lines[dead].trim()}\`) ends the script first — move the tamperward line above it`,
      };
    }
    return {
      item: 'pre-commit', path: rel, status: 'update',
      detail: `move the staged check above line ${dead + 1} (\`${lines[dead].trim()}\`), which ended the script before it ran`,
      apply: () => {
        const out = lines.filter((_, i) => i !== at && i !== at - 1);
        out.splice(dead, 0, ...block);
        write(out);
      },
    };
  }

  if (dead !== -1) {
    return {
      item: 'pre-commit', path: rel, status: 'update',
      detail: `insert the staged check above line ${dead + 1} (\`${lines[dead].trim()}\`), which ends the script — ${note}`,
      apply: () => {
        const out = [...lines];
        out.splice(dead, 0, ...block);
        write(out);
      },
    };
  }

  return {
    item: 'pre-commit', path: rel, status: 'update', detail: `append the staged check (${note})`,
    apply: () => write([...existing.replace(/\n?$/, '\n').split('\n').slice(0, -1), ...block, '']),
  };
}

/**
 * The CI workflow, with MIGRATION.
 *
 * "Already present — left untouched" was the whole of the previous logic, and
 * it made the CI template write-once per repository. Everything shipped in that
 * template since is therefore absent from every repo that ran init before it:
 * the verify step (1.9), the version pin (P2-15), `--require-ancestor` (P1-3),
 * the head-bound sign-off label. Those are not cosmetic — a repo whose workflow
 * predates 1.9 has diff-time detection and no pristine re-execution at all, and
 * `init` told its owner, truthfully by its own logic and misleadingly in fact,
 * that CI was wired. Security fixes that only reach new adopters are not
 * shipped.
 *
 * So: files we generated AND nobody has edited are migrated in place; files
 * that were edited, or that we never wrote, are reported and left exactly as
 * they are. The stamp decides which — never a guess, never a heuristic on
 * content. `--force-workflow` is the operator's override for the second case.
 */
/**
 * Require a human on the paths that decide whether the gate runs.
 *
 * Appended at the END of an existing CODEOWNERS on purpose: the file is
 * last-match-wins, so our rules take precedence over a broader earlier pattern
 * rather than being shadowed by one.
 */
function planCodeowners(cwd: string): Action {
  const rel = '.github/CODEOWNERS';
  // GitHub reads whichever of these exists; do not add a second one.
  // lstat, not existsSync: a dangling symlink is still the file GitHub would
  // read, and it is refused below rather than shadowed by a fresh one.
  const existingRel = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'].find((r) =>
    writeTargetKind(join(cwd, r)) !== 'absent',
  );
  const path = join(cwd, existingRel ?? rel);
  const refused = refuseNonRegular(path);
  if (refused) return { item: 'codeowners', path: existingRel ?? rel, status: 'error', detail: refused };
  const existing = existingRel ? readFileSync(path, 'utf8') : null;

  const missing = CODEOWNERS_PATHS.filter((p) => existing === null || !coveredBy(existing, p));
  if (existingRel !== undefined && missing.length === 0) {
    return { item: 'codeowners', path: existingRel, status: 'ok', detail: 'gate paths already have code owners' };
  }

  const inferred = inferOwner(cwd);
  const owner = inferred?.owner ?? null;
  const unconfirmed = inferred !== null && !inferred.confirmed;
  const block =
    `\n${CODEOWNERS_MARK}\n` +
    '# A pull request that rewrites the workflow can keep the job name, replace the\n' +
    '# gate with `true`, and still report a green required check. Only a human\n' +
    '# requirement on these paths prevents that.\n' +
    (owner === null
      ? '# REPLACE @OWNER BELOW with a real user or team — an unresolvable owner protects nothing.\n'
      : unconfirmed
        ? `# TODO: replace ${owner} with ${owner}/<team> if "${owner.slice(1)}" is an organisation. GitHub\n` +
          '# rejects a bare organisation as an owner, and a rule with an invalid owner protects\n' +
          '# nothing. A user login is fine as written.\n'
        : '') +
    missing.map((p) => `${p.padEnd(24)} ${owner ?? '@OWNER'}`).join('\n') +
    '\n';

  return {
    item: 'codeowners',
    path: existingRel ?? rel,
    status: existing === null ? 'create' : 'update',
    detail:
      (existing === null ? 'require a code owner on ' : 'add missing code-owner rules for ') +
      missing.join(', ') +
      (owner === null ? ' — OWNER UNKNOWN, edit @OWNER before this does anything' : ` (${owner}${unconfirmed ? ', unconfirmed — see warning below' : ''})`),
    ...(inferred && unconfirmed
      ? {
          warning:
            `${inferred.owner} was inferred from the origin remote and is not confirmed to be a user. If "${inferred.owner.slice(1)}" is an ` +
            `organisation, replace it with ${inferred.owner}/<team> in CODEOWNERS: GitHub rejects a bare organisation as an owner, ` +
            'and a rule with an invalid owner protects nothing.',
        }
      : {}),
    apply: () => {
      mkdirSync(dirname(path), { recursive: true });
      atomicReplaceFile(path, existing === null ? block.replace(/^\n/, '') : existing.replace(/\n?$/, '\n') + block, existingMode(path, 0o644));
    },
  };
}

function planWorkflow(cwd: string, force: boolean): Action {
  const rel = '.github/workflows/tamperward.yml';
  const path = join(cwd, rel);
  const write = (): void => {
    mkdirSync(dirname(path), { recursive: true });
    atomicReplaceFile(path, workflowFile(WORKFLOW_CONTENT), existingMode(path, 0o644));
  };
  const refused = refuseNonRegular(path);
  if (refused) return { item: 'ci', path: rel, status: 'error', detail: refused };
  if (!existsSync(path)) {
    return {
      item: 'ci', path: rel, status: 'create',
      detail: 'PR gate with out-of-band label sign-off (re-runs on labeled/unlabeled)',
      apply: write,
    };
  }

  let src: string;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    return { item: 'ci', path: rel, status: 'error', detail: 'exists but cannot be read — refusing to overwrite' };
  }
  const current = bodyHash(WORKFLOW_CONTENT);
  const mark = readWorkflowMark(src);

  if (mark && bodyHash(mark.body) === current) {
    return { item: 'ci', path: rel, status: 'ok', detail: `generated by tamperward and current (v${mark.version})` };
  }
  if (mark && bodyHash(mark.body) === mark.hash) {
    // Ours, byte-identical to what v<mark.version> generated: safe to migrate.
    return {
      item: 'ci', path: rel, status: 'update',
      detail: `generated by tamperward v${mark.version} and unmodified — migrating to the v${TW_VERSION} template`,
      apply: write,
    };
  }
  if (force) {
    return {
      item: 'ci', path: rel, status: 'update',
      detail: mark
        ? `edited since tamperward v${mark.version} generated it — OVERWRITING (--force-workflow)`
        : 'not generated by tamperward — OVERWRITING (--force-workflow)',
      apply: write,
    };
  }
  return {
    item: 'ci', path: rel, status: 'skip',
    detail:
      (mark ? `edited since tamperward v${mark.version} generated it` : 'present but not generated by tamperward') +
      ` — left untouched. Compare it against the v${TW_VERSION} template (an older one may lack the ` +
      'pristine-verify step) and re-run with --force-workflow to replace it.',
  };
}

/** A planner that throws (a directory where a file was expected, an unreadable
 *  file) becomes an error ROW, so the rest of the plan still exists and nothing is
 *  applied before every item has been planned. (D-6.) */
function planned(item: string, path: string, plan: () => Action): Action {
  try {
    return plan();
  } catch (e) {
    return { item, path, status: 'error', detail: `cannot plan this item — ${errText(e)}` };
  }
}

/** The two spellings name one directory (a symlinked checkout, a `..` segment). */
function sameDir(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

const RUNTIME_WARNING = (label: string, id: string): string =>
  `EXPERIMENTAL: the ${label} hook wiring was written because this repository shows ${label} markers, but the ${label} adapter has not passed a pinned live qualification. \`tamperward runtime verify --runtime ${id}\` grades what is proven; until it reports in-loop steering, the agent-neutral layers (pre-commit + CI) are the live protection.`;

/** `.codex/config.toml`: Codex reads project hooks from its `[hooks]` tables. The file is the
 *  project's; init appends the tables when none exist, re-pins the ones it wrote, and refuses
 *  a hand-written hooks block. Planned only when a Codex marker is present. */
function planCodexHooks(cwd: string): Action {
  const rel = '.codex/config.toml';
  const path = join(cwd, rel);
  const item = 'codex-hooks';
  const refused = refuseNonRegular(path);
  if (refused) return { item, path: rel, status: 'error', detail: refused };
  const warning = RUNTIME_WARNING('Codex', 'codex');
  const tables = codexWiringTables();
  if (!existsSync(path)) {
    return {
      item, path: rel, status: 'create', detail: 'wire the PreToolUse deny and Stop sweep [hooks] tables (experimental)', warning,
      apply: () => {
        mkdirSync(dirname(path), { recursive: true });
        atomicReplaceFile(path, tables, 0o644);
      },
    };
  }
  const current = readFileSync(path, 'utf8');
  const existing = codexHooksTables(current);
  if (!existing) {
    const next = current + (current.endsWith('\n') || current === '' ? '' : '\n') + '\n' + tables;
    return {
      item, path: rel, status: 'update', detail: 'append the PreToolUse deny and Stop sweep [hooks] tables (experimental)', warning,
      apply: () => atomicReplaceFile(path, next, existingMode(path, 0o644)),
    };
  }
  if (existing === codexHooksTables(tables)) return { item, path: rel, status: 'ok', detail: 'PreToolUse + Stop hooks already wired' };
  if (withoutRuntimeGatePins(existing) === withoutRuntimeGatePins(codexHooksTables(tables))) {
    const pins = [...new Set(runtimeGatePins(existing))];
    const next = current.replace(/\btamperward@\S+ (hook|sweep) codex\b/g, `tamperward@${TW_VERSION} $1 codex`);
    return {
      item, path: rel, status: 'update', detail: `re-pin the hook commands to tamperward@${TW_VERSION} (was ${pins.join(', ')})`, warning,
      apply: () => atomicReplaceFile(path, next, existingMode(path, 0o644)),
    };
  }
  return {
    item, path: rel, status: 'error',
    detail: 'the [hooks] tables are not the shape init writes — remove them or add the tamperward entries by hand, then re-run init (refusing to rewrite a hand-written hooks block)',
  };
}

/** `.github/hooks/tamperward.json`: the Copilot CLI loads workspace hooks from
 *  `.github/hooks/*.json`. The file is TamperWard's own, so it is written whole; a file that
 *  carries anything init did not write is refused. Planned only when a Copilot marker is present. */
function planCopilotHooks(cwd: string): Action {
  const rel = '.github/hooks/tamperward.json';
  const path = join(cwd, rel);
  const item = 'copilot-hooks';
  const refused = refuseNonRegular(path);
  if (refused) return { item, path: rel, status: 'error', detail: refused };
  const warning = RUNTIME_WARNING('Copilot CLI', 'copilot');
  const document = copilotWiringDocument();
  const content = JSON.stringify({ $comment: COPILOT_WIRING_NOTE, ...document }, null, 2) + '\n';
  const write = (): void => {
    mkdirSync(dirname(path), { recursive: true });
    atomicReplaceFile(path, content, existingMode(path, 0o644));
  };
  if (!existsSync(path)) {
    return { item, path: rel, status: 'create', detail: 'wire the preToolUse deny and agentStop sweep hooks (experimental)', warning, apply: write };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { item, path: rel, status: 'error', detail: 'exists but is not valid JSON — fix it, then re-run init (refusing to overwrite)' };
  }
  const hooks = isRecord(parsed) ? JSON.stringify(parsed.hooks ?? null) : 'null';
  const wanted = JSON.stringify(document.hooks);
  if (hooks === wanted) return { item, path: rel, status: 'ok', detail: 'preToolUse + agentStop hooks already wired' };
  if (withoutRuntimeGatePins(hooks) === withoutRuntimeGatePins(wanted)) {
    const pins = [...new Set(runtimeGatePins(hooks))];
    return { item, path: rel, status: 'update', detail: `re-pin the hook commands to tamperward@${TW_VERSION} (was ${pins.join(', ')})`, warning, apply: write };
  }
  return {
    item, path: rel, status: 'error',
    detail: 'the hooks are not the shape init writes — remove the file or restore the tamperward entries by hand, then re-run init (refusing to rewrite a hand-written hooks file)',
  };
}

export function planInit(cwd: string, opts: { forceWorkflow?: boolean } = {}): Action[] {
  // Canonical hook/pre-commit/CI wiring is a trust anchor. If this build cannot
  // identify its own plain release version, generating a floating or synthetic
  // pin would let the authority change underneath the repository. Refuse before
  // planning any writable action.
  requireShippedVersion();
  const gitignore = planGitignore(cwd);
  return [
    planned('policy', POLICY_FILE, () => planPolicy(cwd)),
    ...(gitignore ? [gitignore] : []),
    planned('agent', '.claude/settings.json', () => planClaudeHooks(cwd)),
    ...runtimeWiringPlans(cwd),
    planned('pre-commit', '(hooks)', () => planPreCommit(cwd)),
    planned('ci', '.github/workflows/tamperward.yml', () => planWorkflow(cwd, opts.forceWorkflow ?? false)),
    planned('codeowners', '.github/CODEOWNERS', () => planCodeowners(cwd)),
  ];
}

/** The experimental runtimes' wiring, planned only for a runtime whose markers are present:
 *  a repository that does not show Codex or Copilot use gets no inert files for them. */
function runtimeWiringPlans(cwd: string): Action[] {
  let detected: Set<string>;
  try {
    detected = new Set(detectRuntimes(cwd).map((r) => r.id));
  } catch {
    detected = new Set();
  }
  return [
    ...(detected.has('codex') ? [planned('codex-hooks', '.codex/config.toml', () => planCodexHooks(cwd))] : []),
    ...(detected.has('copilot') ? [planned('copilot-hooks', '.github/hooks/tamperward.json', () => planCopilotHooks(cwd))] : []),
  ];
}

export function runInit(opts: InitOpts): number {
  // The wiring is repository-wide: the policy, the Claude settings, the workflow and
  // CODEOWNERS belong at the root, beside the `.git` the pre-commit hook lands in.
  // From a subdirectory the plan used to put the files under it while wiring the
  // parent's hooks (#412); it is re-rooted, and the re-rooting is said out loud.
  const requested = resolve(opts.cwd ?? process.cwd());
  const cwd = repoRoot(requested);
  const w = opts.quiet
    ? { write: (_text: string): boolean => true }
    : process.stdout;
  if (cwd !== requested && !sameDir(cwd, requested)) {
    process.stderr.write(`tamperward init: ${requested} is inside the repository rooted at ${cwd}; wiring the root.\n`);
  }
  const plan = planInit(cwd, { forceWorkflow: opts.forceWorkflow });

  // The plan is complete before the first write (planInit never throws). An apply
  // that fails anyway is reported as its own error row and never as a crash that
  // leaves the summary unprinted and the operator guessing what was written.
  let applied = 0;
  for (const a of plan) {
    if (!opts.dryRun && a.apply) {
      try {
        a.apply();
        applied++;
      } catch (e) {
        a.status = 'error';
        a.detail = `could not be written — ${errText(e)}`;
        a.apply = undefined;
      }
    }
    const verb = opts.dryRun && (a.status === 'create' || a.status === 'update') ? `would ${a.status}` : a.status;
    w.write(`  ${a.item.padEnd(10)} ${verb.padEnd(12)} ${a.path}  — ${a.detail}\n`);
  }
  for (const a of plan) {
    if (a.warning) w.write(`\nWARNING (${a.item}): ${a.warning}\n`);
  }

  const errors = plan.filter((a) => a.status === 'error');
  const changed = opts.dryRun ? plan.filter((a) => a.apply).length : applied;

  // Presence of wiring is not the same as a runnable CI authority. Print this
  // even when another init item is broken: a malformed policy is itself an
  // incomplete verifier configuration, and returning before saying so would
  // recreate the ambiguity #320 is closing.
  w.write(`\nVERIFICATION SETUP\n${verifierSetupMessage(cwd)}\n`);

  if (errors.length) {
    w.write(`\ntamperward init: ${errors.length} item(s) need your attention above; the rest ${opts.dryRun ? 'are planned' : 'were applied'}.\n`);
    return 2;
  }
  w.write(
    changed === 0
      ? '\ntamperward init: everything already wired — nothing to do.\n'
      : opts.dryRun
        ? `\ntamperward init: ${changed} change(s) planned. Re-run without --dry-run to apply.\n`
        : `\ntamperward init: ${changed} change(s) applied. Commit them so the gate travels with the repo.\n`,
  );
  // Always, and last, because it is the one thing init CANNOT do for you and the
  // one thing without which the CI half of this tool is decorative.
  w.write(
    '\nONE STEP LEFT, AND IT IS NOT OPTIONAL. In your branch-protection or ruleset\n' +
      'settings for the default branch, configure ALL THREE repository-authority controls:\n' +
      '  1. require the tamperward check;\n' +
      '  2. enable "Require review from Code Owners"; and\n' +
      '  3. enable "Dismiss stale pull request approvals when new commits are pushed".\n\n' +
      'The freshness control is part of the security boundary: an approval for an older\n' +
      'gate-critical diff must not authorize a later push. "Require approval of the most\n' +
      'recent reviewable push" can be useful in addition, but is not a substitute here\n' +
      'because the fresh approver is not necessarily the Code Owner for the gate path.\n\n' +
      'Until all three are enforced, the CI gate is advisory. A pull request runs the\n' +
      'workflow from its OWN head, and a required check is matched by job name — so a\n' +
      'pull request can keep the job called `tamperward`, replace the gate with `true`,\n' +
      'and present a green required check over a change the gate would have blocked.\n' +
      'CODEOWNERS puts a human in front of gate-critical paths; branch protection or an\n' +
      'active ruleset makes that review fresh and binding. Verify with: tamperward doctor\n' +
      '--github --repo OWNER/REPO --branch <default-branch>.\n',
  );
  return 0;
}
