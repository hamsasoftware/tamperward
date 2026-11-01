// tamperward CLI dispatch: argument parsing, help, and the process-level guard.
// Kept apart from the entry file (index.ts) so it can be imported by tests
// without running the entry's `process.exit`.

import { runCheck, CheckOpts } from './check';
import { FORMATS, isFormat } from './report';
import { runHookClaude, runHookFromRaw, runSweepClaude } from './hook';
import { runHookService } from './hook-service';
import { runAllow, AllowOpts } from './allow';
import { runInit, InitOpts } from './init';
import { runDoctor, DoctorOpts } from './doctor';
import { runStatus, StatusOpts } from './status';
import { runVerify, parseVerify } from './verify';
import { runTraceVerify, parseTraceVerify } from './trace-verify';
import { runEnvelope, parseRun } from './run';
import { runWatch } from './watch';
import { runOnboard, OnboardOpts } from './onboard';
import { runRuntimeHook } from './runtime-hook';
import { runResearchCommand, RESEARCH_SUBCOMMANDS } from './research';
import { runRuntime, parseRuntime, RUNTIME_SUBCOMMANDS } from './runtime';
import { runReceipt, RECEIPT_SUBCOMMANDS } from './receipt';
import { runStats, type StatsOpts } from './audit';
import { runMeasureSuite } from './measure-suite';
import { runAttestation } from './attestation';
import { runOracle } from './oracle';
import { runSignoffLabel, SignoffLabelOpts } from './signoff-label';

function parseAllow(args: string[]): AllowOpts {
  const o: AllowOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file') o.file = args[++i];
    else if (a === '--reason') o.reason = args[++i];
    else if (a === '--cwd') o.cwd = args[++i];
    else if (!a.startsWith('--') && !o.rule) o.rule = a;
  }
  return o;
}

function runAgentCommand(kind: 'hook' | 'sweep', args: string[]): number {
  const agent = args[0] ?? '';
  if (agent === 'claude') return kind === 'hook' ? runHookClaude() : runSweepClaude();
  return runRuntimeHook(kind === 'hook' ? 'PreToolUse' : 'Stop', agent);
}

function parseInit(args: string[]): InitOpts {
  const o: InitOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--cwd') o.cwd = args[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force-workflow') o.forceWorkflow = true;
  }
  return o;
}

function parseOnboard(args: string[]): OnboardOpts {
  const o: OnboardOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--cwd') o.cwd = args[++i];
    else if (a === '--base') o.base = args[++i];
    else if (a === '--repo') o.repo = args[++i];
    else if (a === '--branch') o.branch = args[++i];
    else if (a === '--verify-command') o.verifyCommand = args[++i];
    else if (a === '--skip-demo') o.skipDemo = true;
    else if (a === '--demo') o.demo = true;
    else if (a === '--no-github') o.noGithub = true;
    else if (a === '--yes') o.yes = true;
  }
  return o;
}

function parseDoctor(args: string[]): DoctorOpts {
  const o: DoctorOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--cwd') o.cwd = args[++i];
    else if (a === '--base') o.base = args[++i];
    else if (a === '--workflow') o.workflow = args[++i];
    else if (a === '--github') o.github = true;
    else if (a === '--json') o.json = true;
    else if (a === '--repo') o.repo = args[++i];
    else if (a === '--branch') o.branch = args[++i];
    else if (a === '--required-checks') o.requiredChecks = args[++i].split(',');
    else if (a === '--check-contract') o.checkContract = args[++i] as DoctorOpts['checkContract'];
  }
  return o;
}

function parseStatus(args: string[]): StatusOpts {
  const o: StatusOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') o.json = true;
    else if (a === '--cwd') o.cwd = args[++i];
  }
  return o;
}

function parseStats(args: string[]): StatsOpts {
  const o: StatsOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--cwd') o.cwd = args[++i];
    else if (a === '--file') o.file = args[++i];
    else if (a === '--since') o.since = args[++i];
    else if (a === '--json') o.json = true;
  }
  return o;
}

function parseSignoffLabel(args: string[]): SignoffLabelOpts {
  const o: SignoffLabelOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--rule') o.rule = args[++i];
    else if (a === '--file') o.file = args[++i];
    else if (a === '--head') o.head = args[++i];
  }
  return o;
}

function parseCheck(args: string[]): CheckOpts {
  const o: CheckOpts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--staged') o.staged = true;
    else if (a === '--worktree') o.worktree = true;
    else if (a === '--json') o.json = true;
    else if (a === '--format') {
      const v = args[++i];
      if (v !== undefined && isFormat(v)) o.format = v;
    }
    else if (a === '--diff') o.diff = args[++i];
    else if (a === '--cwd') o.cwd = args[++i];
  }
  return o;
}

type ValueRule = 'string' | 'positive' | 'positive-integer' | 'non-negative' | 'format' | 'mode';

function splitLongOptionEquals(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // A terminal `--` ends option parsing. Everything after it belongs to the
    // wrapped command (`run -- <agent>`, `research run -- <agent>`) and is handed
    // through byte for byte, `--name=value` tokens included: the envelope must
    // never rewrite the argv it was asked to supervise.
    if (arg === '--') {
      out.push(...args.slice(i));
      break;
    }
    if (arg.startsWith('--')) {
      const equals = arg.indexOf('=');
      if (equals > 2) {
        out.push(arg.slice(0, equals), arg.slice(equals + 1));
        continue;
      }
    }
    out.push(arg);
  }
  return out;
}

function helpRequested(args: string[]): boolean {
  for (const arg of args) {
    if (arg === '--') break;
    if (arg === '-h' || arg === '--help') return true;
  }
  return false;
}

interface CliGrammar {
  flags?: readonly string[];
  values?: Readonly<Record<string, ValueRule>>;
  positional?: 'none' | 'one';
}

interface ValidatedArgs {
  error?: string;
  seen: Set<string>;
  positionals: string[];
}

function validateFlatArgs(args: string[], grammar: CliGrammar): ValidatedArgs {
  const flags = new Set(grammar.flags ?? []);
  const values = grammar.values ?? {};
  const seen = new Set<string>();
  const positionals: string[] = [];
  let options = true;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (options && a === '--') {
      options = false;
      continue;
    }

    if (options && (flags.has(a) || Object.prototype.hasOwnProperty.call(values, a))) {
      if (seen.has(a)) {
        return { error: `option "${a}" specified more than once`, seen, positionals };
      }
      seen.add(a);

      const rule = values[a];
      if (!rule) continue;

      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) {
        return {
          error: `${a} needs a value` + (v === undefined ? '' : ` (got the flag "${v}")`),
          seen,
          positionals,
        };
      }
      i++;

      if (rule === 'positive') {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) {
          return { error: `${a} needs a positive number (got "${v}")`, seen, positionals };
        }
      } else if (rule === 'positive-integer') {
        const n = Number(v);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
          return { error: `${a} needs a positive integer (got "${v}")`, seen, positionals };
        }
      } else if (rule === 'non-negative') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return { error: `${a} needs a non-negative number (got "${v}")`, seen, positionals };
        }
      } else if (rule === 'format' && !isFormat(v)) {
        return {
          error: `--format needs one of ${FORMATS.join(' | ')} (got "${v}")`,
          seen,
          positionals,
        };
      } else if (rule === 'mode' && v !== 'headless' && v !== 'interactive') {
        return {
          error: `${a} needs one of headless | interactive (got "${v}")`,
          seen,
          positionals,
        };
      }
      continue;
    }

    if (options && a.startsWith('-')) {
      return { error: `unknown option "${a}"`, seen, positionals };
    }

    if (grammar.positional === 'one' && positionals.length === 0) {
      positionals.push(a);
      continue;
    }
    return { error: `unexpected argument "${a}"`, seen, positionals };
  }

  return { seen, positionals };
}

/**
 * Process-level CLI grammar. This runs before command-specific parsing or any
 * filesystem/git/agent side effect. Programmatic APIs still accept typed opts;
 * only user-supplied argv is governed here.
 */
export function validateCliArgs(cmd: string, args: string[]): string | undefined {
  args = splitLongOptionEquals(args);
  if (helpRequested(args)) return undefined;

  if (cmd === 'hook' || cmd === 'sweep') {
    if (args.length === 0) return `${cmd} requires an agent name`;
    if (args.length > 1) return `unexpected argument "${args[1]}"`;
    return undefined;
  }

  if (cmd === 'run') {
    const delimiter = args.indexOf('--');
    if (delimiter < 0) return 'run requires an explicit "--" before the wrapped command';
    const prefix = args.slice(0, delimiter);
    const command = args.slice(delimiter + 1);
    const parsed = validateFlatArgs(prefix, {
      flags: ['--allow-dirty', '--allow-dep-drift', '--observe-transients', '--json'],
      values: {
        '--base': 'string',
        '--cmd': 'string',
        '--budget': 'positive',
        '--agent-budget': 'positive',
        '--settle': 'non-negative',
        '--cwd': 'string',
      },
    });
    if (parsed.error) return parsed.error;
    if (command.length === 0) return 'run requires a wrapped command after "--"';
    return undefined;
  }

  if (cmd === 'check') {
    const parsed = validateFlatArgs(args, {
      flags: ['--staged', '--worktree', '--json'],
      values: { '--diff': 'string', '--format': 'format', '--cwd': 'string' },
    });
    if (parsed.error) return parsed.error;
    const views = ['--staged', '--worktree', '--diff'].filter((x) => parsed.seen.has(x));
    if (views.length > 1) return 'choose exactly one of --staged, --worktree, or --diff';
    if (parsed.seen.has('--json') && parsed.seen.has('--format')) {
      return '--json cannot be combined with --format';
    }
    return undefined;
  }

  if (cmd === 'allow') {
    const parsed = validateFlatArgs(args, {
      values: { '--file': 'string', '--reason': 'string', '--cwd': 'string' },
      positional: 'one',
    });
    if (parsed.error) return parsed.error;
    if (parsed.positionals.length === 0) return 'allow requires a rule';
    return undefined;
  }

  if (cmd === 'signoff-label') {
    return validateFlatArgs(args, {
      values: { '--rule': 'string', '--file': 'string', '--head': 'string' },
    }).error;
  }

  if (cmd === 'init') {
    return validateFlatArgs(args, {
      flags: ['--dry-run', '--force-workflow'],
      values: { '--cwd': 'string' },
    }).error;
  }

  if (cmd === 'doctor') {
    const parsed = validateFlatArgs(args, {
      flags: ['--github', '--json'],
      values: {
        '--cwd': 'string',
        '--base': 'string',
        '--workflow': 'string',
        '--repo': 'string',
        '--branch': 'string',
        '--required-checks': 'string',
        '--check-contract': 'string',
      },
    });
    if (parsed.error) return parsed.error;
    if (parsed.seen.has('--required-checks') && parsed.seen.has('--check-contract')) return 'choose either --required-checks or --check-contract';
    const contract = args[args.indexOf('--check-contract') + 1];
    if (parsed.seen.has('--check-contract') && contract !== 'tamperward-repo') return '--check-contract must be tamperward-repo';
    return undefined;
  }

  if (cmd === 'stats') {
    return validateFlatArgs(args, {
      flags: ['--json'],
      values: {
        '--cwd': 'string',
        '--file': 'string',
        '--since': 'string',
      },
    }).error;
  }

  if (cmd === 'measure-suite') {
    const parsed = validateFlatArgs(args, { values: { '--cwd': 'string', '--cmd': 'string', '--budget': 'positive' } });
    return parsed.error ?? (parsed.seen.has('--cmd') ? undefined : 'measure-suite requires --cmd');
  }

  if (cmd === 'status') {
    return validateFlatArgs(args, {
      flags: ['--json'],
      values: { '--cwd': 'string' },
    }).error;
  }

  if (cmd === 'onboard') {
    const parsed = validateFlatArgs(args, {
      flags: ['--yes', '--skip-demo', '--demo', '--no-github'],
      values: {
        '--cwd': 'string',
        '--base': 'string',
        '--repo': 'string',
        '--branch': 'string',
        '--verify-command': 'string',
      },
    });
    if (parsed.error) return parsed.error;
    if (parsed.seen.has('--demo') && parsed.seen.has('--skip-demo')) return '--demo cannot be combined with --skip-demo';
    return undefined;
  }

  if (cmd === 'hook-service') {
    const sub = args[0];
    if (sub !== 'start' && sub !== 'stop' && sub !== 'status') return 'hook-service requires one of start | stop | status';
    return validateFlatArgs(args.slice(1), { values: { '--dir': 'string' } }).error;
  }

  if (cmd === 'verify') {
    return validateFlatArgs(args, {
      flags: ['--json', '--keep', '--require-ancestor'],
      values: {
        '--base': 'string',
        '--cmd': 'string',
        '--cwd': 'string',
        '--cargo-target-root': 'string',
        '--budget': 'positive',
      },
    }).error;
  }

  if (cmd === 'trace-verify') {
    return validateFlatArgs(args, {
      flags: ['--json'],
      values: {
        '--base': 'string',
        '--cmd': 'string',
        '--cwd': 'string',
        '--budget': 'positive',
        '--runs': 'positive-integer',
      },
    }).error;
  }

  if (cmd === 'watch') {
    return validateFlatArgs(args, {
      values: { '--dir': 'string', '--log': 'string', '--base': 'string' },
    }).error;
  }

  if (cmd === 'runtime') {
    const [sub, ...rest] = args;
    if (sub === undefined) return `runtime requires a subcommand (${RUNTIME_SUBCOMMANDS.join(' | ')})`;
    if (sub !== 'verify' && sub !== 'status') {
      return `unknown runtime subcommand "${sub}" (${RUNTIME_SUBCOMMANDS.join(' | ')})`;
    }
    const parsed = validateFlatArgs(rest, {
      flags: ['--json'],
      values: { '--cwd': 'string', '--runtime': 'string', '--mode': 'mode', '--model': 'string' },
    });
    if (parsed.error) return parsed.error;
    return undefined;
  }

  if (cmd === 'research') {
    const [sub, ...rest] = args;
    if (sub === undefined) return `research requires a subcommand (${RESEARCH_SUBCOMMANDS.join(' | ')})`;
    if (sub === 'init') {
      const parsed = validateFlatArgs(rest, {
        values: {
          '--out': 'string',
          '--repo': 'string',
          '--base': 'string',
          '--id': 'string',
          '--prompt': 'string',
          '--verify-command': 'string',
          '--verify-budget': 'positive',
        },
      });
      if (parsed.error) return parsed.error;
      for (const required of ['--out', '--repo', '--prompt', '--verify-command']) {
        if (!parsed.seen.has(required)) return `research init requires ${required}`;
      }
      return undefined;
    }
    if (sub === 'run') {
      // Like `run`: an explicit "--" separates the research options from the
      // agent command, so a typoed option is never handed to the agent.
      const delimiter = rest.indexOf('--');
      const prefix = delimiter < 0 ? rest : rest.slice(0, delimiter);
      const parsed = validateFlatArgs(prefix, {
        flags: ['--break-lock', '--json'],
        values: {
          '--manifest': 'string',
          '--out': 'string',
          '--adapter': 'string',
          '--pairs': 'positive-integer',
          '--model': 'string',
          '--agent-budget': 'positive',
        },
      });
      if (parsed.error) return parsed.error;
      for (const required of ['--manifest', '--out', '--adapter']) {
        if (!parsed.seen.has(required)) return `research run requires ${required}`;
      }
      return undefined;
    }
    if (sub === 'summarize') {
      const parsed = validateFlatArgs(rest, { values: { '--ledger': 'string' } });
      if (parsed.error) return parsed.error;
      if (!parsed.seen.has('--ledger')) return 'research summarize requires --ledger';
      return undefined;
    }
    if (sub === 'report') {
      const parsed = validateFlatArgs(rest, { flags: ['--json'], values: { '--ledger': 'string' } });
      if (parsed.error) return parsed.error;
      if (!parsed.seen.has('--ledger')) return 'research report requires --ledger';
      return undefined;
    }
    if (sub === 'bundle') {
      const parsed = validateFlatArgs(rest, {
        values: { '--ledger': 'string', '--out': 'string', '--manifest': 'string', '--validate': 'string' },
      });
      if (parsed.error) return parsed.error;
      if (parsed.seen.has('--validate')) return undefined;
      for (const required of ['--ledger', '--out']) {
        if (!parsed.seen.has(required)) return `research bundle requires ${required}`;
      }
      return undefined;
    }
    if (sub === 'validate') {
      const parsed = validateFlatArgs(rest, { values: { '--bundle': 'string' } });
      if (parsed.error) return parsed.error;
      if (!parsed.seen.has('--bundle')) return 'research validate requires --bundle';
      return undefined;
    }
    return `unknown research subcommand "${sub}" (${RESEARCH_SUBCOMMANDS.join(' | ')})`;
  }

  if (cmd === 'receipt') {
    const [sub, ...rest] = args;
    if (sub === undefined) return `receipt requires a subcommand (${RECEIPT_SUBCOMMANDS.join(' | ')})`;
    if (sub === 'export') {
      return validateFlatArgs(rest, {
        values: { '--out': 'string', '--cwd': 'string' },
      }).error;
    }
    if (sub === 'reconcile') {
      return validateFlatArgs(rest, {
        flags: ['--json', '--require-ancestor'],
        values: {
          '--base': 'string',
          '--cmd': 'string',
          '--budget': 'positive',
          '--cwd': 'string',
          '--receipt': 'string',
          '--ci-result': 'string',
        },
      }).error;
    }
    return `unknown receipt subcommand "${sub}" (${RECEIPT_SUBCOMMANDS.join(' | ')})`;
  }

  return undefined;
}

function printHelp(): void {
  process.stdout.write(`tamperward — the deterministic agent-integrity gate

Usage:
  tamperward check --staged                 check staged changes (pre-commit)
  tamperward check --worktree               check working-tree changes (stop sweep)
  tamperward check --diff <base>...<head>   check a commit range (CI authority)
  tamperward check ... --json               machine-readable output (alias for --format json)
  tamperward check ... --format <fmt>       text | json | github | auto (default)

Formats:
  text    grouped, wrapped, colour-optional terminal output. Severity is always
          spelled out ("BLOCK" / "warn"), never carried by colour alone. Honours
          NO_COLOR and FORCE_COLOR; colour is off when stdout is not a terminal.
  github  GitHub Actions view: one inline annotation per finding (so it shows up
          on the line in "Files changed") plus a job-summary table on the run
          page, alongside the same text output in the log.
  json    versioned machine-readable output. Top-level schema_version identifies
          the public JSON-schema major; published schemas live under schemas/.
  auto    github when GITHUB_ACTIONS=true, otherwise text.
  tamperward hook claude                    PreToolUse gate (reads hook JSON on stdin)
  tamperward sweep claude                   Stop sweep (re-scan the turn's working tree)
  tamperward hook-service start [--dir D]   OPT-IN persistent hook service: one warm
  tamperward hook-service stop [--dir D]    process per user and repository that
  tamperward hook-service status [--dir D]  evaluates hook/sweep requests over a
                                            private unix socket, so each tool call
                                            skips Node + bundle startup. Hooks
                                            consult it only with
                                            TAMPERWARD_HOOK_SERVICE=1 in Claude
                                            Code's environment, and run in-process
                                            (the ordinary path, same verdict) when
                                            it is absent, stale, another version
                                            or its socket fails the ownership and
                                            mode checks. Not available on Windows.
  tamperward watch [--dir D] [--log F]      filesystem-event observer daemon: records
             [--base R]                     protected-file events so the sweep can
                                            observe supported transient effects.
                                            --base freezes observer policy to a
                                            trusted revision
  tamperward verify [--base R] [--cmd C]    pristine-suite re-execution: run the suite
             [--budget S] [--json] [--keep] as-is AND with protected files restored
             [--require-ancestor] [--cwd D]  from the trusted base; a visible-green /
                                            pristine-red result is a MASKED FAILURE
                                            (exit 1, or 0 under a compact tw1:<digest>
                                            or legacy verify@<full-sha> approval); cannot-verify
                                            fails closed (2)
             [--cargo-target-root D]        separate local Cargo targets D/visible
                                            and D/pristine (operator-owned cache)
  tamperward trace-verify [--base R]          advisory Linux verifier-input discovery:
             [--cmd C] [--budget S] [--runs N] trace a trusted/known-good base with
             [--json] [--cwd D]                strace, union repeated observations,
                                               mark dynamic/config/external reads,
                                               and suggest uncovered exact paths for
                                               HUMAN review as verify.inputs. Never
                                               edits policy; unsupported platforms
                                               fail explicitly rather than claiming parity.
  tamperward run [opts] -- <agent cmd...>   enforcement envelope: record the trusted
             [--base R] [--cmd C]           base, run the agent, treat its exit as
             [--budget S] [--agent-budget S] untrusted, then re-adjudicate the tree it
             [--allow-dirty] [--settle S]   left (policy over base...HEAD and the
             [--allow-dep-drift] [--cwd D]  worktree, plus verify).
             [--observe-transients] [--json] --observe-transients starts a session-
                                            scoped observer before the agent and
                                            reports temporal evidence/health after it.
                                            --agent-budget bounds the agent runtime
                                            itself and still adjudicates after timeout.
                                            --json emits one final versioned run verdict
                                            document on stdout after agent adjudication.
                                            Exit: agent's
                                            code when clean; 124 on clean AGENT_TIMEOUT;
                                            1 on any blocking finding/masked failure;
                                            2 when it cannot adjudicate (fails closed)
  tamperward research init --out F --repo R  author a versioned one-task manifest
             --prompt P --verify-command C     and print its sha256 identity
  tamperward research run --manifest F      bring-your-own-model evaluation: for every
             --out D --adapter A [--pairs N]  task in the manifest, pin one source commit,
             [--model M] [--agent-budget S]   clone fresh state per arm, run the agent
             [--break-lock] [--json]         ungated and under the run envelope, then
             [-- <agent cmd...>]             observe both with verify + check. Records
                                             are resumable by full experiment identity.
                                             --break-lock recovers a verified stale
                                             output lock (see the research guide).
  tamperward research summarize --ledger D  aggregate measured pairs into model behaviour,
                                             independent outcome, TamperWard hits/misses
                                             and paired counts — no composite score
  tamperward research report --ledger D     human-readable four-section report (or --json)
  tamperward research bundle --ledger D     reproducible records/provenance archive
             --out F [--manifest M]          (manifest/prompts included only when requested)
  tamperward research bundle --validate F   structurally and provenance-validate a bundle
  tamperward research validate --bundle F   alias for bundle validation
  tamperward stats [--file F] [--since 30d] aggregate privacy-safe hook/sweep audit
             [--json] [--cwd D]              events by rule and enforcement surface.
                                             Defaults to the repository-local
                                             .git/tamperward/audit.jsonl (or
                                             TAMPERWARD_AUDIT_LOG). A finding is an
                                             integrity signal, not proof of agent intent.
  tamperward measure-suite --cmd C [--budget S] time a bare suite in the live checkout
  tamperward oracle --manifest F --sha256 H [--cwd D] [--schema-version 1|2]
                                            independent container-backed JSON function oracle
  tamperward attestation sign --payload F --key K --out F
                                            sign a trusted CI verdict with an external Ed25519 key
  tamperward attestation sign --schema-version 2 --payload F --evidence F
             --sha256 H --key K --out F      sign completed suite evidence for admission
  tamperward attestation admit --statement F --key K --expect F
                                            require exact suite assurance and request scope
  tamperward attestation verify --statement F --key K --expect F
                                            require a trusted public key and exact fresh binding
  tamperward allow <rule> --reason "..."    record a human sign-off (local audit ledger)
             [--file F] [--cwd D]
  tamperward signoff-label --rule <rule> --head <sha> [--file F]
                                            print a compact, exact-head-bound CI label
  tamperward onboard [--yes] [--cwd D]      guided first-run setup: preflight, the
             [--base R] [--repo O/R]        init plan with a confirmation before any
             [--branch B] [--verify-command C] write, canonical init, explicit verifier
             [--skip-demo | --demo]         acceptance (a detected suite command is
             [--no-github]                  never written without it), the first
                                            verify explained, an optional demo on a
                                            disposable worktree, GitHub authority via
                                            doctor --github or the manual controls,
                                            and a READY / READY WITH WARNINGS /
                                            BROKEN / INCOMPLETE posture from doctor.
                                            Non-interactive stdin refuses unless
                                            --yes scripts it (then --verify-command
                                            is the only way to configure verify).
                                            Exit: 0 READY[ WITH WARNINGS], 1
                                            BROKEN/INCOMPLETE, 2 refused or aborted
  tamperward init [--dry-run]               wire the policy file plus every
             [--force-workflow] [--cwd D]   enforcement point: Claude Code hooks,
                                            pre-commit, CI. Idempotent; never
                                            overwrites your files. Re-running it
                                            MIGRATES a CI workflow it generated and
                                            you have not edited, and widens a
                                            PreToolUse matcher that no longer covers
                                            every tool the gate must see.
                                            --force-workflow replaces a workflow it
                                            did not write, or one you have edited.
  tamperward status [--json] [--cwd D]      verification posture in three distinct
                                            lanes — Authority (repository/final
                                            adjudication), Intervention (runtime
                                            steering), and Verification: whether the
                                            last successful verify still applies to
                                            the EXACT current state (CURRENT / STALE /
                                            VERIFYING / BROKEN / UNVERIFIED). --json
                                            emits the versioned status document for
                                            editors, CI and dashboards. Local CURRENT
                                            is posture, never repository/CI authority.
  tamperward receipt export [--out F]       emit the bounded, transportable verification
             [--cwd D]                      receipt for the CURRENT verified state (to F,
                                            else stdout). Refuses when the state is not
                                            CURRENT. Raw evidence otherwise stays under
                                            .git/tamperward/, never in the tracked tree.
  tamperward receipt reconcile [--base R]   CI reruns the canonical verification FIRST,
             [--cmd C] [--budget S]         then reconciles a claimed receipt against its
             [--receipt F] [--ci-result F]  own adjudication. --receipt is the claimed
             [--require-ancestor] [--json]  local receipt (absent → NO_CLAIM, never a
             [--cwd D]                       failure by itself); --ci-result consumes a
                                            preceding "verify --json" so the suite runs
                                            once. Prints LOCAL / CI / RESULT and (--json)
                                            a machine-readable reconciliation document,
                                            plus a GitHub job summary. The receipt is
                                            evidence, never authority: a stale, mismatched,
                                            tampered, missing or unknown-schema receipt can
                                            NEVER promote a CI result. Exit is CI's verdict.
  tamperward runtime verify [--runtime ID]  qualify the in-loop runtime: an operation-
             [--mode headless|interactive]  specific capability matrix (pre-deny:shell,
             [--model M] [--json] [--cwd D]  native-edit, mcp, end-of-turn, transport:*,
                                            …) with an explicit state per capability
                                            (PROVEN | PARTIAL | UNPROVEN | UNSUPPORTED |
                                            FAIL-OPEN | INCONCLUSIVE; never a score),
                                            derived from the shipped adapter's declared
                                            capabilities and committed evidence. Bound to
                                            the runtime version, TamperWard version/commit,
                                            adapter hash, hook-config hash, execution mode,
                                            platform and model; persisted git-locally.
                                            Reports EXISTING facts only — no promotion, no
                                            Round 4.1 claim. Final authority (CI / pristine
                                            verify) stays separate from in-loop steering.
  tamperward runtime status [--runtime ID]  render the latest recorded qualification
             [--mode headless|interactive]  WITHOUT rerunning it, and mark it STALE when a
             [--model M] [--json] [--cwd D]  load-bearing input (version/config/adapter/mode/
                                            model/…) changed since it was recorded. --mode and
                                            --model select the binding staleness is compared
                                            against, as for verify.
  tamperward doctor [--base R]              report installation + authority posture
             [--workflow F] [--cwd D]       and validate the CI verifier's outer-time
             [--json]                       envelope against the trusted policy.
             [--github] [--repo O/R]        --github also validates repository
             [--branch B]                   authority: required tamperward status,
             [--required-checks A,B]        explicit required status contexts, or
             [--check-contract tamperward-repo]  this repository's expanded list;
                                            Code Owner review, and stale-review
                                            dismissal after new pushes. Public
                                            rules can be read anonymously; set
                                            GH_TOKEN/GITHUB_TOKEN when needed.

Exit codes: 0 clean · 1 a blocking finding (check), MASKED_FAILURE or SUITE_RED
            (verify), any blocking finding or masked failure (run) · 2 cannot
            evaluate, failing closed: policy error, bad --diff range, no view,
            not a git repository, unresolvable base or revision, --require-ancestor
            refused, budget exceeded — always one line on stderr, never a stack
            trace. hook/sweep → 0 with a deny emitted as JSON on stdout (exit 2
            would make Claude Code ignore the JSON); 2 only for an unsupported
            agent name.
`);
}

/** The thin service client's in-process fallback (src/cli/index.ts). */
export { runHookFromRaw };

export function main(argv: string[]): number | Promise<number> {
  const [cmd, ...rawRest] = argv;
  const rest = splitLongOptionEquals(rawRest);
  if (cmd !== undefined && cmd !== '-h' && cmd !== '--help' && helpRequested(rest)) {
    printHelp();
    return 0;
  }
  if (cmd !== undefined && cmd !== '-h' && cmd !== '--help') {
    const invalid = validateCliArgs(cmd, rest);
    if (invalid) {
      process.stderr.write(`tamperward: ${invalid}\n`);
      return 2;
    }
  }
  switch (cmd) {
    case 'check':
      return runCheck(parseCheck(rest));
    case 'hook':
      return runAgentCommand('hook', rest);
    case 'sweep':
      return runAgentCommand('sweep', rest);
    case 'allow':
      return runAllow(parseAllow(rest));
    case 'signoff-label':
      return runSignoffLabel(parseSignoffLabel(rest));
    case 'init':
      return runInit(parseInit(rest));
    case 'doctor':
      return runDoctor(parseDoctor(rest));
    case 'stats':
      return runStats(parseStats(rest));
    case 'measure-suite':
      return runMeasureSuite(rest);
    case 'attestation':
      return runAttestation(rest);
    case 'oracle':
      return runOracle(rest);
    case 'status':
      return runStatus(parseStatus(rest));
    case 'onboard':
      return runOnboard(parseOnboard(rest));
    case 'watch':
      return runWatch(rest);
    case 'hook-service':
      return runHookService(rest);
    case 'verify':
      return runVerify(parseVerify(rest));
    case 'trace-verify':
      return runTraceVerify(parseTraceVerify(rest));
    case 'research':
      return runResearchCommand(rest);
    case 'runtime': {
      const { sub, opts } = parseRuntime(rest);
      return runRuntime(sub, opts);
    }
    case 'receipt':
      return runReceipt(rest);
    case 'run':
      return runEnvelope({
        ...parseRun(rest),
        // The supervised observer re-launches this exact TamperWard CLI under
        // process.execPath rather than resolving another binary from PATH.
        observerEntry: process.argv[1],
      });
    case undefined:
    case '-h':
    case '--help':
      printHelp();
      return 0;
    default:
      process.stderr.write(`tamperward: unknown command "${cmd}"\n`);
      printHelp();
      return 2;
  }
}

/**
 * The process-level guard. Anything `main` does not catch used to escape as a
 * Node stack trace at exit 1 — the code that means "blocking finding" — for a
 * bad `--diff` revision, a `--worktree` outside a repository, an invalid policy
 * reaching `allow`, or a directory where `init` expected a file. A crash is a
 * verdict the gate could not reach, so it exits 2 (cannot evaluate: fail closed,
 * never 0, never 1) with one clean line. `hook`/`sweep` catch their own errors
 * and deny as JSON at exit 0 (src/cli/hook.ts); nothing of theirs arrives here.
 */
export function guardedMain(argv: string[], stderr: { write: (s: string) => unknown } = process.stderr): number | Promise<number> {
  const failClosed = (e: unknown): number => {
    // The first line only: git folds its usage text into some errors, and a
    // screenful of options is not a diagnostic.
    const first = (e instanceof Error ? e.message : String(e)).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    stderr.write(`tamperward: ${first || 'unexpected failure'}\n`);
    return 2;
  };
  try {
    const result = main(argv);
    // `onboard` prompts, so it is asynchronous; a rejection is guarded exactly
    // like a throw. Every other command still returns its code synchronously.
    return typeof result === 'number' ? result : result.catch(failClosed);
  } catch (e) {
    return failClosed(e);
  }
}
