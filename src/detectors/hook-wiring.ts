// The enforcement wiring, read at the grain each format actually has.
//
// hook-tampering used to compare every hooks-class file as text: a removed line
// carrying a runner token, an added line matching `^exit 0$`. Text is the wrong
// grain for all of them, in both directions. A shell hook is disabled just as well
// by `|| true`, by `if false; then`, by `exit 0  # done`, by piping the gate into
// `tee`; it is NOT disabled by `npx` becoming `pnpm exec`. CODEOWNERS is not a
// script at all, and the word `husky` in an ownership rule is not an invocation.
// A lefthook or pre-commit entry is disabled by `skip: true`, by `stages:
// [manual]`, by an `exclude` covering everything — no invocation moves. Each
// helper here reads one format the way its consumer does; hook-tampering asks
// them what was lost.
//
// The script model below is EVIDENCE, not the verdict, for hand-written hooks. A
// script init wrote is judged by hook-tampering against init's exact shape (see
// ../wiring.ts initScriptPin); a hand-written script is held byte-equal to its
// before modulo a pin raise (pinRaiseOnly below) — every other edit needs a
// sign-off. The model then answers "does the after-script still run every check
// the before-script ran, in a position where its failure fails the hook", so the
// human signing off sees WHAT changed. It is not sound and cannot be: a third
// adversarial pass over a rebuilt model found thirteen more shapes a shell runs
// one way and a line-by-line reading runs another (inner groups, multi-line
// groups, `exit 0` inside a brace, traps by name, multi-line quotes, `$#` and
// `"$@"` in a hook with no argv, a second heredoc on one line, `case` globs). A
// new script (no before) is judged by it alone, since there is no before to hold
// it to: the gate must be live. Every rule here was checked under both ways a
// hook runs — husky's `sh -e <file>` and git's direct exec — with a failing
// stand-in for the gate.

import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { yaml } from '../lazy-deps';
import { isProtected } from '../policy';
import { DetectorContext, Policy } from '../types';
import { PLAIN_SEMVER, TW_VERSION, canonicalPath, claudeConfigDir, compareVersions, homeDir, isClaudeSettings, pinNotBelow, runtimeGatePins, withoutRuntimeGatePins } from '../wiring';
import { containsProtected, trackedFiles } from './repo';

// ── shell hook scripts ─────────────────────────────────────────────────────────

/** Drop a trailing `# comment` that sits outside quotes. */
export function stripComment(line: string): string {
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !double) single = !single;
    else if (ch === '"' && !single) double = !double;
    else if (ch === '#' && !single && !double && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

const isComment = (line: string): boolean => /^\s*#/.test(line);

/** A package runner in front of the tool. `npx tamperward`, `pnpm exec tamperward`,
 *  `yarn tamperward` and `bunx tamperward` run the same binary; the prefix is a
 *  package-manager preference, not a check. */
const RUNNER = /^(?:npx|pnpm|yarn|bunx|bun|npm)\s+(?:(?:exec|dlx|x|run)\s+)?(?:(?:--yes|-y|--no-install|--silent|-s|--)\s+)*/;

/** Tools that are a check wherever they are invoked from. */
const TOOL = /^(tamperward|jest|vitest|eslint|tsc|lint-staged|lefthook|husky|pytest|make|cargo|go|pre-commit|mypy|ruff|rubocop|prettier|gradlew?)\b/;
/** Script names that are a check only when run THROUGH a package runner (`npm test`);
 *  a bare `test` in shell is the `[` builtin. */
const SCRIPT = /^(test|tests|lint|typecheck|type-check|coverage|check)\b/;
/** Tools whose first argument names WHAT runs (`tamperward check`, `make test`). */
const SUBCOMMAND_TOOLS = new Set(['tamperward', 'make', 'cargo', 'go', 'lefthook', 'husky', 'pre-commit']);

/** Words a segment may start with that are not the command: keywords, env
 *  assignments, wrappers. `!` is deliberately NOT here: it inverts the status. */
const PREFIX = /^(?:(?:then|do|else|\{|\(|exec|command|time|nice|env|sudo|[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"(?=\s|$)|'[^']*'(?=\s|$)|[^\s"']\S*|(?=\s)))\s+)*/;

/** The mode flag of a `tamperward check`: WHAT it looks at. `--staged` sees the
 *  commit; `--diff HEAD...HEAD` sees nothing; `--worktree` in a pre-commit hook
 *  sees the unstaged tree, not the commit. */
const MODE = /\s(--staged|--worktree|--diff(?:[=\s]+[^\s-][^\s;)}|&]*)?)(?=[\s;)}|&]|$)/;
/** `--cwd <path>`, the path quoted or not; a `$(git rev-parse --show-toplevel)`
 *  is the repository root, which is where the gate runs anyway. */
const CWD = /\s--cwd(?:=|\s+)("[^"]*"|'[^']*'|\S+)/;

/**
 * The identity of the check a shell segment runs, or null when it runs none.
 *
 * `npx tamperward@2.1.0 check --staged >/dev/null` and `pnpm exec tamperward check
 * --staged` are the same check: runner, pin, output redirection and extra flags
 * are not what a hook is for. `echo "npx tamperward check --staged"` is not a
 * check (the invocation is in argument position) and neither is `npx tamperward
 * --version` (no subcommand that checks anything). The mode flag and `--cwd
 * <path>` ARE identity for the gate: `check --diff HEAD...HEAD` in a pre-commit
 * hook never sees the staged change, and a check run over another directory is
 * another check.
 */
export function checkIdentity(segment: string): string | null {
  const core = segment.trim().replace(PREFIX, '').replace(/\s+/g, ' ');
  const viaRunner = RUNNER.test(core);
  const rest = core.replace(RUNNER, '');
  const tool = rest.match(TOOL)?.[1] ?? (viaRunner ? rest.match(SCRIPT)?.[1] : undefined);
  if (!tool) return null;
  const toks = rest.replace(/^tamperward@\S+/, 'tamperward').split(' ');
  if (tool === 'tamperward') {
    const sub = toks[1];
    if (!sub || sub.startsWith('-')) return null; // `tamperward --version` checks nothing
    const mode = rest.match(MODE)?.[1].replace(/[=\s]+/, ' ');
    const cwd = rest.match(CWD)?.[1];
    const away = cwd !== undefined && !/rev-parse\s+--show-toplevel/.test(cwd) ? `--cwd ${cwd}` : undefined;
    return ['tamperward', sub, mode, away].filter((x): x is string => !!x).join(' ');
  }
  if (SUBCOMMAND_TOOLS.has(tool) && toks[1] && !toks[1].startsWith('-')) return `${tool} ${toks[1]}`;
  return tool;
}

/** The pin a tamperward invocation carries, '' when unpinned, null when it is not
 *  a tamperward invocation. */
function pinOfSegment(segment: string): string | null {
  const m = segment.trim().replace(PREFIX, '').replace(RUNNER, '').match(/^tamperward(?:@(\S+))?\b/);
  return m ? (m[1] ?? '') : null;
}

/** Split a statement into its segments and the operators between them. A `{ …;
 *  … }` group or a `( … )` subshell is one segment: `gate || { echo; exit 1; }`
 *  has one `||` and one operand after it. A single `&` is an operator too —
 *  `gate & wait` backgrounds the gate and waits for nothing in particular — but
 *  the `&` of `2>&1`, `&>` and `<&` is a redirection. */
function split(stmt: string): { segs: string[]; ops: string[] } {
  const segs: string[] = [];
  const ops: string[] = [];
  let depth = 0;
  let single = false;
  let double = false;
  let last = 0;
  for (let i = 0; i < stmt.length; i++) {
    const ch = stmt[i];
    if (ch === "'" && !double) { single = !single; continue; }
    if (ch === '"' && !single) { double = !double; continue; }
    if (single || double) continue;
    if (ch === '(' || (ch === '{' && /(?:^|\s)$/.test(stmt.slice(0, i)) && /^(?:\s|$)/.test(stmt.slice(i + 1)))) { depth++; continue; }
    if (ch === ')' || (ch === '}' && depth > 0 && /(?:^|[\s;])$/.test(stmt.slice(0, i)))) { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const bg = ch === '&' && stmt[i + 1] !== '&' && stmt[i + 1] !== '>' && !/[<>]$/.test(stmt.slice(0, i));
    const op = stmt.startsWith('&&', i) ? '&&' : stmt.startsWith('||', i) ? '||' : ch === ';' ? ';' : ch === '|' ? '|' : bg ? '&' : null;
    if (!op) continue;
    segs.push(stmt.slice(last, i));
    ops.push(op);
    i += op.length - 1;
    last = i + 1;
  }
  segs.push(stmt.slice(last));
  return { segs, ops };
}

const unq = (s: string): string => s.replace(/^["']|["']$/g, '');

/**
 * Whether a shell condition can never be true — the spellings of `false`.
 * `[ 0 -eq 1 ]`, `[ "a" = "b" ]`, `[ -n "" ]`, `test 1 -eq 0`, `! true`, `( exit 1 )`.
 * Anything mentioning a variable is unknown, and unknown is not false.
 */
export function alwaysFalse(cond: string): boolean {
  const c = cond.trim().replace(/;$/, '').trim();
  if (/^(?:false|!\s*true|\(\s*exit\s+[1-9]\d*\s*\))$/.test(c)) return true;
  const m = c.match(/^(?:\[\[\s+(.+?)\s+\]\]|\[\s+(.+?)\s+\]|test\s+(.+))$/);
  if (!m) return false;
  const inner = (m[1] ?? m[2] ?? m[3]).trim();
  if (inner.includes('$')) return false;
  const parts = inner.match(/^(\S+)\s+(-eq|-ne|-lt|-le|-gt|-ge|=|==|!=)\s+(\S+)$/);
  if (parts) {
    const [, a, op, b] = parts;
    const x = unq(a);
    const y = unq(b);
    const nx = Number(x);
    const ny = Number(y);
    const ints = /^-?\d+$/.test(x) && /^-?\d+$/.test(y);
    switch (op) {
      case '-eq': return ints && nx !== ny;
      case '-ne': return ints && nx === ny;
      case '-lt': return ints && !(nx < ny);
      case '-le': return ints && !(nx <= ny);
      case '-gt': return ints && !(nx > ny);
      case '-ge': return ints && !(nx >= ny);
      case '=': case '==': return x !== y;
      case '!=': return x === y;
    }
  }
  const unary = inner.match(/^(-n|-z)\s+(\S+)$/);
  if (unary) {
    const v = unq(unary[2]);
    return unary[1] === '-n' ? v === '' : v !== '';
  }
  if (/^(?:""|'')$/.test(inner)) return true;
  return false;
}

/** Whether a shell condition can never be false — the spellings of `true`. A
 *  constant comparison is one or the other; anything with a variable is neither. */
export const alwaysTrue = (cond: string): boolean => {
  const c = cond.trim().replace(/;$/, '').trim();
  if (/^(?:true|:|!\s*false|\(\s*exit\s+0*\s*\))$/.test(c)) return true;
  const m = c.match(/^(?:\[\[\s+(.+?)\s+\]\]|\[\s+(.+?)\s+\]|test\s+(.+))$/);
  if (!m) return false;
  const inner = (m[1] ?? m[2] ?? m[3]).trim();
  if (inner.includes('$')) return false;
  const parts = inner.match(/^(\S+)\s+(-eq|-ne|-lt|-le|-gt|-ge|=|==|!=)\s+(\S+)$/);
  if (parts) {
    const ints = /^-?\d+$/.test(unq(parts[1])) && /^-?\d+$/.test(unq(parts[3]));
    if (parts[2].startsWith('-') && !ints) return false; // not integers: an error, not true
    return !alwaysFalse(c);
  }
  if (/^(?:-n|-z)\s+\S+$/.test(inner)) return !alwaysFalse(c);
  if (/^\S+$/.test(inner)) return unq(inner) !== ''; // `[ "x" ]`: true when non-empty
  return false;
};

/** An exit that passes: `exit`, `exit 0`, `return 0`, with or without `;`. */
const EXIT_ZERO = /^(?:exit|return)(?:\s+0+)?$/;
/** Any exit, with any argument: the rest of the script is unreachable after it. */
const EXIT_ANY = /^(?:exit|return)(?:\s+\S+)?$/;

export interface Invocation {
  identity: string;
  line: string;
  /** How the invocation is prevented from deciding the hook's exit, if it is. */
  state: 'live' | 'neutered' | 'unreachable' | 'comment';
  /** The specific reason for a neutered/unreachable state. */
  why?: string;
  /** The pin a tamperward invocation carries ('' unpinned); absent otherwise. */
  pin?: string;
}

/** Whether an added line INSERTS a passing exit: `exit 0`, `exit 0  # done`, `exit 0;`,
 *  bare `exit`, `[ -n "$X" ] || exit 0`. Statement-level: `echo exit 0` is text. */
export function insertsPassingExit(line: string): boolean {
  if (isComment(line)) return false;
  return split(stripComment(line)).segs.some((s) => EXIT_ZERO.test(s.trim().replace(/^!\s+/, '').replace(PREFIX, '')));
}

/** Whether an added line opens a guard that can never be true (`if false; then`). */
export function insertsDeadGuard(line: string): boolean {
  if (isComment(line)) return false;
  const m = stripComment(line).trim().match(/^(?:if|elif)\s+(.+?)\s*(?:;\s*then)?\s*$/);
  return !!m && alwaysFalse(m[1]);
}

export interface ScriptOpts {
  /** The runner passes `-e` (husky runs `sh -e <file>`). When absent the script's
   *  own `set -e` / shebang flags decide, as git's direct exec would. */
  errexit?: boolean;
}

// ── preprocessing: continuations, heredocs, one-line constructs, functions ────

/** Join backslash-continued lines, so `gate \` + `|| true` is one statement. */
function joinContinued(lines: string[]): string[] {
  const out: string[] = [];
  let cur: string | null = null;
  for (const l of lines) {
    cur = cur === null ? l : cur + ' ' + l.trimStart();
    const m = cur.match(/(\\+)$/);
    if (m && m[1].length % 2 === 1 && !isComment(cur)) {
      cur = cur.slice(0, -1);
      continue;
    }
    out.push(cur);
    cur = null;
  }
  if (cur !== null) out.push(cur);
  return out;
}

/** Heredoc bodies are data: `cat <<EOF … EOF` carries text, not statements. */
export function stripHeredocs(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    out.push(l);
    if (isComment(l)) continue;
    const m = stripComment(l).match(/<<(-?)\s*(?:'([^']+)'|"([^"]+)"|\\?([A-Za-z_]\w*))/);
    if (!m) continue;
    const word = m[2] ?? m[3] ?? m[4];
    const dash = m[1] === '-';
    for (i++; i < lines.length; i++) {
      const t = dash ? lines[i].replace(/^\t+/, '') : lines[i];
      if (t === word) break;
    }
  }
  return out;
}

/** `if c; then x; fi` on one line becomes the lines the walker reads. */
function explodeKeywords(line: string): string[] {
  if (isComment(line)) return [line];
  let s = stripComment(line);
  s = s.replace(/;;/g, '\n;;');
  s = s.replace(/;\s*(then|do|fi|done|esac|else|elif)\b/g, '\n$1');
  s = s.replace(/^(\s*case\s+\S+\s+in)\s+(?=\S)/, '$1\n');
  s = s.replace(/^(\s*)(then|do|else)\s+(?=\S)/, '$1$2\n');
  s = s.replace(/\n(then|do|else)\s+(?=\S)/g, '\n$1\n');
  return s.split('\n');
}

/** Index of the `}` that brings an open group at `depth` back to zero, ignoring
 *  quotes and `${…}` expansions; -1 when the line does not close it. */
function closingBrace(line: string, depth: number): number {
  let single = false;
  let double = false;
  let expansion = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !double) single = !single;
    else if (ch === '"' && !single) double = !double;
    else if (single) continue;
    else if (ch === '$' && line[i + 1] === '{') { expansion++; i++; }
    else if (ch === '}' && expansion > 0) expansion--;
    else if (ch === '{' && !double) depth++;
    else if (ch === '}' && !double && --depth === 0) return i;
  }
  return -1;
}

/** Net brace depth change of a line. */
function braceDelta(line: string): number {
  let d = 0;
  let single = false;
  let double = false;
  let expansion = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !double) single = !single;
    else if (ch === '"' && !single) double = !double;
    else if (single) continue;
    else if (ch === '$' && line[i + 1] === '{') { expansion++; i++; }
    else if (ch === '}' && expansion > 0) expansion--;
    else if (ch === '{' && !double) d++;
    else if (ch === '}' && !double) d--;
  }
  return d;
}

const FN_DEF = /^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\s*\)\s*(.*)$|^\s*function\s+([A-Za-z_][\w-]*)\s*(\{.*)?$/;

interface Prepared {
  /** Top-level statements, function bodies removed. */
  top: string[];
  fns: Map<string, string[]>;
  /** Names redefined by a function or an alias: a live invocation of one of them
   *  runs the redefinition, not the tool. */
  shadowed: Set<string>;
  pipefail: boolean;
  errexit: boolean;
}

/** Split a script into its top-level statements and its function bodies. A body
 *  is not a frame the script executes: `gate() { … }` runs nothing until called. */
function prepare(lines: string[], opts: ScriptOpts): Prepared {
  const flat = stripHeredocs(joinContinued(lines)).flatMap(explodeKeywords);
  const top: string[] = [];
  const fns = new Map<string, string[]>();
  const shadowed = new Set<string>();
  let errexit = opts.errexit ?? false;
  let pipefail = false;
  if (flat[0]?.startsWith('#!')) {
    const sb = flat[0];
    if (/\s-[a-zA-Z]*e[a-zA-Z]*(?:\s|$)/.test(sb)) errexit = true;
    if (/-[a-zA-Z]*o\s+pipefail\b/.test(sb)) pipefail = true;
  }
  for (let i = 0; i < flat.length; i++) {
    const raw = flat[i];
    if (isComment(raw)) { top.push(raw); continue; }
    const stmt = stripComment(raw).trim();
    const al = stmt.match(/^alias\s+([A-Za-z_][\w-]*)=/);
    if (al) shadowed.add(al[1]);
    const def = stmt.match(FN_DEF);
    if (!def) { top.push(raw); continue; }
    const name = def[1] ?? def[3];
    shadowed.add(name);
    let rest = (def[2] ?? def[4] ?? '').trim();
    if (rest === '' && /^\s*\{/.test(flat[i + 1] ?? '')) { i++; rest = flat[i].trim(); }
    const body: string[] = [];
    if (!rest.startsWith('{')) { fns.set(name, body); continue; } // subshell or unknown body: opaque
    rest = rest.slice(1);
    // `f() { …; }; f || true`: what follows the closing brace is a top-level statement
    const after = (line: string, close: number): void => {
      const t = line.slice(0, close);
      if (t.trim()) body.push(t);
      const remainder = line.slice(close + 1).replace(/^\s*;?\s*/, '');
      if (remainder.trim()) top.push(remainder);
    };
    let close = closingBrace(rest, 1);
    if (close !== -1) {
      after(rest, close);
    } else {
      if (rest.trim()) body.push(rest);
      let depth = 1 + braceDelta(rest);
      for (i++; i < flat.length; i++) {
        const line = isComment(flat[i]) ? '' : stripComment(flat[i]);
        close = closingBrace(line, depth);
        if (close !== -1) { after(line, close); break; }
        depth += braceDelta(line);
        body.push(flat[i]);
      }
    }
    fns.set(name, body);
  }
  return { top, fns, shadowed, pipefail, errexit };
}

// ── the walk ───────────────────────────────────────────────────────────────────

/** `exit`: the script terminates with a failing status. */
type Status = 'ok' | 'fail' | 'exit' | 'unknown';

interface Frame { dead: boolean; exhausted: boolean; kind: 'base' | 'if' | 'loop' | 'case'; word?: string }

/** Environment the gate resolves through: which `npx`, which `node`, which
 *  registry, what `node` loads before the gate's own code. An assignment to one
 *  of these before or on the gate makes the gate whatever the assignment chose. */
const SENSITIVE_ENV = /^(?:PATH|NODE_OPTIONS|NODE_PATH|HOME|LD_PRELOAD|BASH_ENV|ENV|npm_config_\w*|NPM_CONFIG_\w*)$/;
/** The names a run of `NAME=value` prefix assignments sets, values consumed so a
 *  `PATH=` inside a quoted value is not read as an assignment. */
const assignedNames = (prefix: string): string[] =>
  [...prefix.matchAll(/(?:^|\s)([A-Za-z_]\w*)=(?:"[^"]*"|'[^']*'|[^\s"']\S*|(?=\s))/g)].map((m) => m[1]);
/** `wait $!`: the status of the last backgrounded job, which is the gate's. */
const WAIT_PID = /^wait\s+"?\$!"?\s*;?$/;

interface State {
  errexit: boolean;
  pipefail: boolean;
  /** The script `cd`ed somewhere that is not the repository root. */
  cdAway: boolean;
  /** The script set PATH, NODE_OPTIONS or another variable the gate resolves through. */
  redirected: boolean;
  vars: Map<string, string>;
  fns: Map<string, string[]>;
  shadowed: Set<string>;
  /** Statement indices of traps whose action passes on EXIT/ERR. */
  traps: number[];
  out: Array<Invocation & { idx: number; errexit: boolean; passthrough: boolean }>;
  /** Index of the last top-level statement that is not transparent. */
  lastReal: number;
}

/** Whether a statement contributes nothing to the script's exit status after the
 *  gate: closers, keywords, an `exit $?` that forwards the status. */
const TRANSPARENT = /^(?:fi|done|esac|\}|\)|;;|then|do|else|exit\s+"?\$\??"?|exit\s+"?\$\{\?\}"?|wait\s+"?\$!"?)\s*;?$/;

/** The status a segment leaves when run after a failed gate, as far as it can be
 *  known. Statement by statement: what fails loudly is an explicit non-zero exit,
 *  `false`, a `kill` of the shell, or a bare `exit`/`return` that forwards a
 *  failing status. Anything else — `true`, `echo`, `kill -0`, `exit 0`, `exit
 *  $status` with status=0, `{ echo x; exit; }` (the `exit` forwards echo's 0) —
 *  passes. Words inside arguments (`echo "exit 1"`) are not statements. */
function statusAfterFailure(seg: string, vars: Map<string, string>): Status {
  const inner = seg.trim().replace(/^[{(]\s*/, '').replace(/\s*[})]\s*;?\s*$/, '');
  let status: Status = 'fail'; // the gate's, until something runs
  for (const piece of inner.split(/;|&&|\|\||\|/)) {
    const w = piece.trim().replace(PREFIX, '').split(/\s+/);
    switch (w[0]) {
      case '': break;
      case 'true': case ':': status = 'ok'; break;
      case 'false': status = 'fail'; break;
      case 'kill': status = w[1] === '-0' ? 'ok' : 'exit'; break;
      case 'exit': case 'return': {
        const arg = unq(w[1] ?? '');
        if (arg === '' || arg === '$?' || arg === '${?}') return status === 'ok' ? 'ok' : 'exit';
        if (/^0+$/.test(arg)) return 'ok';
        if (/^[1-9]\d*$/.test(arg)) return 'exit';
        const v = arg.match(/^\$\{?([A-Za-z_]\w*)\}?$/);
        const known = v ? vars.get(v[1]) : undefined;
        return known !== undefined && /^0+$/.test(known) ? 'ok' : 'exit';
      }
      default: status = 'ok';
    }
  }
  return status;
}

/** Constant status of a segment run on its own, for reachability through `&&`/`||`. */
function constStatus(seg: string): Status {
  const s = seg.trim().replace(/^!\s+/, '');
  if (alwaysTrue(s)) return 'ok';
  if (alwaysFalse(s)) return 'fail';
  return 'unknown';
}

/** Whether segment `i` of a statement runs: 'yes' unconditionally, 'no' never,
 *  'maybe' when an earlier segment's status is not a constant. */
function reaches(segs: string[], ops: string[], i: number): 'yes' | 'no' | 'maybe' {
  let status: Status = 'ok';
  let certain = true;
  for (let j = 0; j < i; j++) {
    const runs = j === 0 ? true : ops[j - 1] === '&&' ? status !== 'fail' : ops[j - 1] === '||' ? status !== 'ok' : true;
    if (!runs) continue;
    const s = constStatus(segs[j]);
    if (s === 'unknown' && (ops[j] === '&&' || ops[j] === '||')) certain = false;
    if (ops[j] === ';' || ops[j] === '|' || ops[j] === '&') { status = 'ok'; certain = certain && true; continue; }
    status = s;
  }
  const gate = i === 0 ? true : ops[i - 1] === '&&' ? status !== 'fail' : ops[i - 1] === '||' ? status !== 'ok' : true;
  if (!gate) return 'no';
  if (i === 0 || ops[i - 1] === ';' || ops[i - 1] === '|' || ops[i - 1] === '&') return 'yes';
  if (!certain || status === 'unknown') return 'maybe';
  return 'yes';
}

/** Resolve `$VAR`/`${VAR}` against the assignments seen so far; null when unknown. */
function literal(arg: string, vars: Map<string, string>): string | null {
  const a = unq(arg.trim());
  if (/[`]|\$\(/.test(a)) return null;
  let unknown = false;
  const r = a.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (_, n: string) => {
    const v = vars.get(n);
    if (v === undefined) unknown = true;
    return v ?? '';
  });
  return unknown ? null : r;
}

/** Whether a `cd` target is the repository root (so the gate still sees the repo). */
function cdStaysHome(arg: string, vars: Map<string, string>): boolean | null {
  const a = arg.trim();
  if (/rev-parse\s+--show-toplevel/.test(a)) return true;
  const lit = literal(a, vars);
  if (lit === null) return null; // unknown: not judged
  return lit === '' || lit === '.' || lit === './';
}

function walk(lines: string[], st: State, topIdx: (i: number) => number, depth: number): boolean {
  const frames: Frame[] = [{ dead: false, exhausted: false, kind: 'base' }];
  const dead = (): boolean => frames.some((f) => f.dead);
  const conditional = (): boolean => frames.length > 1;
  let exits = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const idx = topIdx(i);
    if (isComment(raw)) {
      const id = checkIdentity(raw.replace(/^\s*#+\s*/, ''));
      if (id) st.out.push({ identity: id, line: raw, state: 'comment', idx, errexit: st.errexit, passthrough: false });
      continue;
    }
    let stmt = stripComment(raw).trim();
    if (!stmt) continue;

    // ── control flow ──
    const ifm = stmt.match(/^(if|elif)\s+(.+)$/);
    if (ifm) {
      const cond = ifm[2].replace(/;\s*$/, '');
      // a gate used AS a condition has its status consumed by the `if`
      const cid = checkIdentity(cond.replace(/^!\s+/, ''));
      if (cid) st.out.push({ identity: cid, line: raw, state: dead() ? 'unreachable' : 'neutered', why: 'used as an `if` condition — its failure selects a branch instead of failing the hook', idx, errexit: st.errexit, passthrough: false });
      if (ifm[1] === 'if') frames.push({ dead: alwaysFalse(cond), exhausted: alwaysTrue(cond), kind: 'if' });
      else if (frames.length > 1) {
        const f = frames[frames.length - 1];
        f.dead = f.exhausted || alwaysFalse(cond);
        f.exhausted = f.exhausted || alwaysTrue(cond);
      }
      continue;
    }
    if (/^else\b/.test(stmt)) {
      if (frames.length > 1) { const f = frames[frames.length - 1]; f.dead = f.exhausted; }
      continue;
    }
    if (/^(?:fi|done|esac)\b/.test(stmt)) { if (frames.length > 1) frames.pop(); continue; }
    if (/^(?:then|do)\b/.test(stmt)) continue;
    const loop = stmt.match(/^(while|until)\s+(.+)$/);
    if (loop) {
      const cond = loop[2].replace(/;\s*$/, '');
      frames.push({ dead: loop[1] === 'while' ? alwaysFalse(cond) : alwaysTrue(cond), exhausted: false, kind: 'loop' });
      continue;
    }
    const forl = stmt.match(/^for\s+[A-Za-z_]\w*(?:\s+in\b(.*))?$/);
    if (forl) {
      const list = (forl[1] ?? '$@').replace(/;\s*$/, '').trim();
      frames.push({ dead: forl[1] !== undefined && (list === '' || /^(?:""|'')$/.test(list)), exhausted: false, kind: 'loop' });
      continue;
    }
    const casem = stmt.match(/^case\s+(\S+)\s+in\b/);
    if (casem) { frames.push({ dead: false, exhausted: false, kind: 'case', word: unq(casem[1]) }); continue; }
    const pat = frames[frames.length - 1].kind === 'case' ? stmt.match(/^\(?([^()]+)\)\s*(.*)$/) : null;
    if (pat) {
      const f = frames[frames.length - 1];
      const word = f.word ?? '';
      const patterns = pat[1].split('|').map((p) => unq(p.trim()));
      const may = /[$`]/.test(word) || patterns.some((p) => p === '*' || /[$`*?[]/.test(p) || p === word);
      f.dead = !may;
      stmt = pat[2].trim();
      if (!stmt) continue;
    }
    if (/^;;$/.test(stmt)) continue;
    if (/^[{}()]$/.test(stmt)) continue;

    // ── statements ──
    // A trailing `&` backgrounds the statement; a `wait $!` on the very next line
    // brings its status back, a bare `wait` (or nothing) does not.
    const bgLine = /(?<![&<>])&\s*$/.test(stmt) && !/&&\s*$/.test(stmt);
    if (bgLine) stmt = stmt.replace(/\s*&\s*$/, '');
    const bg = bgLine && !WAIT_PID.test(stripComment(lines[i + 1] ?? '').trim());
    const { segs, ops } = split(stmt);
    for (let s = 0; s < segs.length; s++) {
      let seg = segs[s].trim();
      const inverted = /^!\s+/.test(seg);
      seg = seg.replace(/^!\s+/, '');
      const execs = /^exec\s+/.test(seg) && !/^exec\s+(?:\d*[<>]|&>)/.test(seg);
      const whole = seg;
      seg = seg.replace(PREFIX, '');
      // the words PREFIX stripped: `command`, `env`, `exec`, `NAME=value` …
      const prefix = whole.slice(0, whole.length - seg.length);
      const reach = dead() ? 'no' : reaches(segs, ops, s);
      const first = seg.split(/\s+/)[0] ?? '';

      // State-changing statements. Switching a protection OFF (`set +e`, a passing
      // trap, a `cd` away) counts wherever it might run; switching one ON (`set
      // -e`, `cd` back to the root, a known variable) only where it certainly runs.
      if (reach !== 'no') {
        const certain = reach === 'yes' && !conditional();
        const set = seg.match(/^set\s+(.+)$/);
        if (set) {
          const toks = set[1].split(/\s+/);
          for (let t = 0; t < toks.length; t++) {
            const m = toks[t].match(/^([-+])([a-zA-Z]+)$/);
            if (!m) continue;
            const on = m[1] === '-';
            const flip = (cur: boolean): boolean => (on ? (certain ? true : cur) : false);
            if (m[2].includes('e')) st.errexit = flip(st.errexit);
            if (m[2].includes('o')) {
              const name = toks[++t];
              if (name === 'errexit') st.errexit = flip(st.errexit);
              if (name === 'pipefail') st.pipefail = flip(st.pipefail);
            }
          }
        }
        const trap = seg.match(/^trap\s+(?:'([^']*)'|"([^"]*)"|(\S+))\s+(.+)$/);
        if (trap) {
          const action = trap[1] ?? trap[2] ?? trap[3];
          const sigs = trap[4].split(/\s+/);
          if (sigs.some((x) => /^(?:EXIT|ERR|0|SIGERR)$/i.test(x)) && /(?:^|[;\s])(?:exit(?:\s+0+)?|true|:)\s*(?:;|$)/.test(action)) st.traps.push(idx);
        }
        const asg = seg.match(/^(?:export\s+|readonly\s+|declare\s+-\w+\s+|local\s+)?([A-Za-z_]\w*)=(.*)$/);
        if (asg) {
          const v = certain ? literal(asg[2], st.vars) : null;
          if (v === null) st.vars.delete(asg[1]); else st.vars.set(asg[1], v);
          if (SENSITIVE_ENV.test(asg[1])) st.redirected = true;
        }
        if (first === 'cd') {
          const home = cdStaysHome(seg.slice(2), st.vars);
          if (home === false) st.cdAway = true;
          else if (home === true && certain) st.cdAway = false;
        }
      }

      const id = checkIdentity(seg);
      if (!id) {
        if (reach === 'yes') {
          if (EXIT_ANY.test(seg)) {
            if (!conditional()) { frames[0].dead = true; if (/^exit\b/.test(seg)) exits = true; }
            else if (/^exit\b/.test(seg) && depth > 0) { /* conditional exit inside a function: not judged */ }
          } else if (execs && !conditional()) {
            frames[0].dead = true; // the shell is replaced
          } else if (st.fns.has(first) && reach === 'yes') {
            const start = st.out.length;
            const body = st.fns.get(first) ?? [];
            const sub: State = { ...st, out: st.out };
            const fnExits = depth < 6 && walk(body, sub, () => idx, depth + 1);
            st.errexit = sub.errexit; st.pipefail = sub.pipefail; st.cdAway = sub.cdAway; st.redirected = sub.redirected;
            // the call's own position neuters what the body ran
            const verdict = chainVerdict(segs, ops, s, st, inverted, bg);
            for (let k = start; k < st.out.length; k++) {
              const inv = st.out[k];
              if (inv.state === 'live' && verdict.state !== 'live') { inv.state = verdict.state; inv.why = verdict.why; }
              if (inv.state === 'live') inv.passthrough = inv.passthrough && verdict.passthrough;
            }
            if (fnExits && !conditional()) { frames[0].dead = true; exits = true; }
          }
        } else if (reach === 'maybe' && st.fns.has(first)) {
          const start = st.out.length;
          const sub: State = { ...st, out: st.out };
          if (depth < 6) walk(st.fns.get(first) ?? [], sub, () => idx, depth + 1);
          const verdict = chainVerdict(segs, ops, s, st, inverted, bg);
          for (let k = start; k < st.out.length; k++) {
            const inv = st.out[k];
            if (inv.state === 'live' && verdict.state !== 'live') { inv.state = verdict.state; inv.why = verdict.why; }
          }
        }
        continue;
      }

      let state: Invocation['state'] = 'live';
      let why: string | undefined;
      let passthrough = false;
      if (reach === 'no') { state = 'unreachable'; why = dead() ? 'behind an always-false guard, an early exit, or a function body that is never called' : 'behind a constant condition'; }
      else {
        const v = chainVerdict(segs, ops, s, st, inverted, bg);
        state = v.state; why = v.why; passthrough = v.passthrough;
        if (state === 'live' && /^tamperward\b/.test(id) && st.cdAway) { state = 'neutered'; why = 'runs from another directory after a `cd` away from the repository root'; }
        if (state === 'live' && /^tamperward\b/.test(id)) {
          const onGate = assignedNames(prefix).filter((n) => SENSITIVE_ENV.test(n));
          if (onGate.length) { state = 'neutered'; why = `runtime redirected — \`${onGate[0]}=\` in front of it decides what the gate resolves to`; }
          else if (st.redirected) { state = 'neutered'; why = 'runtime redirected — PATH, NODE_OPTIONS or another variable the gate resolves through is set earlier in the script'; }
        }
        if (state === 'live') {
          // the wrapper words in front of the command are commands too: `command()
          // { :; }` then `command npx …` runs the function
          const words = [...prefix.split(/\s+/), first, 'tamperward'].filter((w) => w && st.shadowed.has(w));
          if (words.length) { state = 'neutered'; why = `\`${words[0]}\` is redefined by a function or alias in this script`; }
        }
      }
      const pin = pinOfSegment(seg);
      st.out.push({ identity: id, line: raw, state, why, idx, errexit: st.errexit, passthrough, ...(pin !== null ? { pin } : {}) });
    }
  }
  return exits;
}

/** What the rest of the statement does to a failed gate at segment `i`. */
function chainVerdict(segs: string[], ops: string[], i: number, st: State, inverted: boolean, bg: boolean): { state: Invocation['state']; why?: string; passthrough: boolean } {
  if (inverted) return { state: 'neutered', why: 'its status is inverted by `!`', passthrough: false };
  if (bg) return { state: 'neutered', why: 'run in the background — the hook does not wait for its status', passthrough: false };
  let cur: Status = 'fail';
  let waited = -1; // the `wait $!` segment that brings a backgrounded gate's status back
  for (let j = i; j < ops.length; j++) {
    const op = ops[j];
    const next = segs[j + 1];
    if (op === '|') {
      if (!st.pipefail) return { state: 'neutered', why: 'piped into another command without `pipefail`', passthrough: false };
      continue;
    }
    if (op === '&') {
      if (WAIT_PID.test((next ?? '').trim())) { waited = j + 1; continue; }
      return { state: 'neutered', why: 'run in the background — a `wait` without its pid returns 0, and without `wait` the hook does not wait for its status', passthrough: false };
    }
    if (cur === 'exit') break; // the script has ended, failing
    if (op === '||') {
      if (cur === 'fail') cur = statusAfterFailure(next, st.vars);
    } else if (op === '&&') {
      if (cur === 'ok') cur = statusAfterFailure(next, st.vars);
    } else if (op === ';') {
      const rest = segs.slice(j + 1).map((x) => x.trim());
      if (st.errexit && cur === 'fail') {
        if (rest.some((x) => /^(?:true|:)$/.test(x) || EXIT_ZERO.test(x))) return { state: 'neutered', why: 'followed by a passing statement in the same line', passthrough: false };
        return { state: 'live', passthrough: false };
      }
      if (rest.every((x) => TRANSPARENT.test(x))) return { state: cur === 'fail' ? 'live' : 'neutered', why: cur === 'fail' ? undefined : 'the `||` chain after it ends in success', passthrough: cur === 'fail' };
      return { state: 'neutered', why: 'followed by other statements whose status replaces it (no `set -e`)', passthrough: false };
    }
  }
  if (cur === 'ok') return { state: 'neutered', why: 'the `||` chain after it ends in success', passthrough: false };
  if (cur === 'exit') return { state: 'live', passthrough: false }; // `|| exit 1`: fails the hook by itself
  // the statement's status is the gate's: under errexit that fails the hook; without
  // it, only when nothing runs afterwards
  return { state: 'live', passthrough: i === ops.length || ops.slice(i).every((o, k) => o === '&&' || o === '||' || (o === '&' && i + k + 1 === waited)) };
}

/**
 * Every check invocation in a hook script, with the state the script leaves it in:
 * live, neutered in place (`|| true`, `; true`, piped into something without
 * pipefail, shadowed by a function or alias, backgrounded, inverted, run after a
 * `cd` away, or — without `set -e` — followed by other statements), unreachable
 * (inside an always-false or exhausted branch, an empty loop, after an exit or an
 * exec, or in a function that is never called), or commented out. The comparison
 * the detector makes is over the LIVE set — everything else is one spelling or
 * another of "the hook no longer runs it".
 */
export function invocations(lines: string[], opts: ScriptOpts = {}): Invocation[] {
  const prep = prepare(lines, opts);
  const st: State = {
    errexit: prep.errexit,
    pipefail: prep.pipefail,
    cdAway: false,
    redirected: false,
    vars: new Map(),
    fns: prep.fns,
    shadowed: prep.shadowed,
    traps: [],
    out: [],
    lastReal: -1,
  };
  for (let i = 0; i < prep.top.length; i++) {
    const t = stripComment(prep.top[i]).trim();
    if (t && !isComment(prep.top[i]) && !TRANSPARENT.test(t)) st.lastReal = i;
  }
  walk(prep.top, st, (i) => i, 0);
  // Invocations inside bodies that were never called: unreachable, so the
  // comparison can say where the gate went.
  const seen = new Set(st.out.map((o) => o.line));
  for (const [, body] of prep.fns) {
    const sub: State = { ...st, out: [], traps: [] };
    walk(body, sub, () => -1, 1);
    for (const inv of sub.out) if (!seen.has(inv.line) && inv.state !== 'comment') st.out.push({ ...inv, state: 'unreachable', why: 'defined in a function that is never called' });
  }
  return st.out.map((inv) => {
    if (inv.state !== 'live') return strip(inv);
    if (st.traps.some((t) => t < inv.idx) || (!inv.errexit && st.traps.some((t) => t > inv.idx))) {
      return strip({ ...inv, state: 'neutered', why: 'a `trap` on EXIT/ERR exits 0 whatever the gate returned' });
    }
    if (inv.passthrough && !inv.errexit && inv.idx !== -1 && inv.idx < st.lastReal) {
      return strip({ ...inv, state: 'neutered', why: 'without `set -e` its failure does not fail the hook — other statements run after it' });
    }
    return strip(inv);
  });
}

const strip = (inv: Invocation & { idx: number; errexit: boolean; passthrough: boolean }): Invocation => {
  const { idx: _i, errexit: _e, passthrough: _p, ...rest } = inv;
  return rest;
};

/** An identity without its flags: `tamperward check --diff HEAD...HEAD` and
 *  `tamperward check --staged` are both spellings of the gate. */
const baseIdentity = (id: string): string => id.replace(/\s--.*$/, '');

/**
 * Whether an edit to a hand-written hook script is a PIN RAISE and nothing else:
 * byte-equal modulo trailing newlines, every `tamperward@<ver>` token's plain
 * version going up (or a plain pin added to an unpinned token) and never above
 * the gate judging it. This is the only edit that passes without a sign-off. A
 * pin removed, a range (`@^1`), a tag (`@latest`), a pre-release, a comment
 * added, CRLF, a doubled space: all of it is a change to the gate script.
 */
export function pinRaiseOnly(before: string, after: string): boolean {
  const mask = (src: string): { text: string; pins: string[] } => {
    const pins: string[] = [];
    const text = src.replace(/\n+$/, '').replace(/\btamperward(?:@(\d+\.\d+\.\d+))?(?=\s|$)/g, (_m, v: string | undefined) => {
      pins.push(v ?? '');
      return 'tamperward@\0';
    });
    return { text, pins };
  };
  const b = mask(before);
  const a = mask(after);
  if (b.text !== a.text || b.pins.length !== a.pins.length) return false;
  return a.pins.every((now, i) => {
    const was = b.pins[i];
    if (now === was) return true;
    if (now === '') return false; // the pin removed
    if (was !== '' && (compareVersions(now, was) ?? -1) < 0) return false; // lowered
    return !PLAIN_SEMVER.test(TW_VERSION) || (compareVersions(now, TW_VERSION) ?? 1) <= 0; // never above the judging gate
  });
}

/** Reasons the after-script runs fewer checks than the before-script. */
export function scriptWeakening(before: string[], after: string[], opts: ScriptOpts = {}): Array<{ reason: string; evidence: string }> {
  const beforeInv = invocations(before, opts);
  const afterInv = invocations(after, opts);
  const live = (inv: Invocation[]) => new Set(inv.filter((i) => i.state === 'live').map((i) => i.identity));
  const bl = live(beforeInv);
  const al = live(afterInv);
  const out: Array<{ reason: string; evidence: string }> = [];
  for (const id of bl) {
    if (al.has(id)) continue;
    const trace = afterInv.find((i) => i.identity === id) ?? afterInv.find((i) => baseIdentity(i.identity) === baseIdentity(id));
    const how =
      trace?.state === 'neutered'
        ? `neutralised in place (${trace.why ?? 'its failure can no longer fail the hook'})`
        : trace?.state === 'unreachable'
          ? `made unreachable (${trace.why ?? 'behind an always-false guard or an early exit'})`
          : trace?.state === 'comment'
            ? 'commented out'
            : trace && trace.identity !== id
              ? `replaced by \`${trace.identity}\``
              : 'removed';
    const evidence = (trace?.line ?? before.find((l) => checkIdentity(stripComment(l).trim().replace(/^!\s+/, '').replace(PREFIX, '')) === id) ?? id).trim();
    out.push({ reason: `the check invocation \`${id}\` was ${how}`, evidence });
  }
  // A pin lowered below what the before-script ran is a downgrade of the gate,
  // whatever else stayed live — and so is a pin that is no longer a plain version:
  // `@^1` resolves to 1.x, `@latest` to whatever the registry serves, a
  // pre-release to a build nobody released.
  const floor = beforeInv.flatMap((i) => (i.state === 'live' && i.pin && PLAIN_SEMVER.test(i.pin) ? [i.pin] : [])).sort((a, b) => compareVersions(a, b) ?? 0)[0];
  if (floor) {
    for (const inv of afterInv) {
      if (inv.state !== 'live' || !inv.pin) continue;
      if (!PLAIN_SEMVER.test(inv.pin)) out.push({ reason: `the gate's pin was changed from ${floor} to \`${inv.pin}\`, which is not a plain version — a range, tag or pre-release resolves to whatever the registry serves`, evidence: inv.line.trim() });
      else if ((compareVersions(inv.pin, floor) ?? 0) < 0) out.push({ reason: `the gate's pin was lowered from ${floor} to ${inv.pin}`, evidence: inv.line.trim() });
    }
  }
  return out;
}

/** A shell interpreter in shebang position, or a shebang that is not one: git
 *  execs a hook directly, so `#!/usr/bin/env -S sh -c 'exit 0'` or `#!/bin/echo`
 *  runs the interpreter named there and never the script. */
export function shebangProblem(src: string): string | null {
  const first = src.split('\n')[0] ?? '';
  if (!first.startsWith('#!')) return null;
  const body = first.slice(2).trim();
  const toks = body.split(/\s+/);
  let i = 0;
  if (/(?:^|\/)env$/.test(toks[0] ?? '')) {
    i = 1;
    while (i < toks.length && toks[i].startsWith('-')) i++;
  }
  const interp = (toks[i] ?? '').replace(/^.*\//, '');
  if (!/^(?:sh|bash|dash|zsh|ksh|ash|busybox)$/.test(interp)) return `the shebang runs \`${body}\`, not a shell`;
  if (toks.slice(i + 1).some((t) => /^-[a-zA-Z]*c/.test(t))) return `the shebang passes \`-c\` — the interpreter runs the argument, not the script`;
  return null;
}

// ── CODEOWNERS ─────────────────────────────────────────────────────────────────

export const isCodeowners = (path: string): boolean => /(?:^|\/)CODEOWNERS$/.test(path);

/** The concrete files whose ownership decides whether the gate can be edited
 *  without a human. Evaluated as FILES, with GitHub's glob semantics: a later
 *  ownerless `/.husky/pre-commit`, `*.yml` or `**\/pre-commit` un-owns the gate
 *  while the directory rule above it still reads as owned. */
export const GATE_CRITICAL = [
  '/.github/workflows/tamperward.yml',
  '/.tamperward.yml',
  '/.github/CODEOWNERS',
  '/CODEOWNERS',
  '/docs/CODEOWNERS',
  '/.husky/pre-commit',
  '/.claude/settings.json',
  '/.claude/settings.local.json',
  '/.pre-commit-config.yaml',
  '/lefthook.yml',
  '/lefthook.yaml',
];

/** A CODEOWNERS pattern as a matcher over root-anchored file paths, per GitHub's
 *  rules: `*` stays within a segment, `**` crosses segments, a pattern without a
 *  slash matches at any depth, a leading slash anchors, a trailing slash (or a
 *  pattern naming a directory) covers everything beneath. */
function codeownersMatcher(pattern: string): (file: string) => boolean {
  let p = pattern.trim();
  if (p === '*' || p === '**') return () => true;
  let anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);
  const dir = p.endsWith('/');
  p = p.replace(/\/+$/, '');
  if (p.includes('/')) anchored = true; // an inner slash anchors to the root, as in gitignore
  if (p.startsWith('**/')) { anchored = false; p = p.slice(3); }
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*') { re += '.*'; i++; }
      else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const body = (anchored ? '^/' : '(?:^|/)') + re;
  const exact = new RegExp(body + '$');
  const under = new RegExp(body + '/');
  return (file: string) => (!dir && exact.test(file)) || under.test(file);
}

/** The owners the file assigns a critical path — the LAST matching rule wins, as
 *  GitHub reads it — or null when no rule matches. */
function ownersOf(content: string, critical: string): string[] | null {
  let owners: string[] | null = null;
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [pattern, ...rest] = t.split(/\s+/);
    let matches: boolean;
    try {
      matches = codeownersMatcher(pattern)(critical);
    } catch {
      matches = false;
    }
    if (matches) owners = rest.filter((o) => !o.startsWith('#'));
  }
  return owners;
}

/** Reasons the after-CODEOWNERS requires a human on fewer gate-critical files.
 *  `extra` adds files the repository has (its workflow files, its hooks). */
export function codeownersWeakening(before: string, after: string, extra: string[] = []): string[] {
  const out: string[] = [];
  const files = [...new Set([...GATE_CRITICAL, ...extra.map((f) => (f.startsWith('/') ? f : '/' + f))])];
  for (const critical of files) {
    const was = ownersOf(before, critical);
    if (!was || was.length === 0) continue;
    const now = ownersOf(after, critical);
    if (!now) out.push(`the code-owner rule covering ${critical} was removed — the gate's own files no longer require a human reviewer`);
    else if (now.length === 0) out.push(`the code-owner rule covering ${critical} lost its owners — the gate's own files no longer require a human reviewer`);
  }
  return out;
}

// ── the experimental runtimes' hook wiring ─────────────────────────────────────
//
// Codex reads project hooks from the `[hooks]` tables of `.codex/config.toml`, a file
// that also carries the model, the approval policy and whatever else the project
// configures; the Copilot CLI reads repository hooks from the `hooks` member of
// `.github/hooks/tamperward.json`. Each is read at that grain: the hook tables (or
// member) are held as they were, the rest of the file is the project's to edit.
// Hooks that arrive where there were none are an install, not a weakening.

const TOML_TABLE = /^\s*\[\[?\s*([^\]]*?)\s*\]\]?/;
const isHooksTable = (name: string): boolean => name === 'hooks' || name.startsWith('hooks.');

/** The lines of every `[hooks]` / `[hooks.*]` / `[[hooks.*]]` table, trimmed, with
 *  blank and comment lines dropped — the part of a Codex config the runtime reads
 *  hooks from, as one comparable text. */
export function codexHooksTables(toml: string): string {
  const out: string[] = [];
  let inHooks = false;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const table = line.match(TOML_TABLE);
    if (table) inHooks = isHooksTable(table[1].replace(/["']/g, ''));
    if (inHooks) out.push(line);
  }
  return out.join('\n');
}

/** The one edit to runtime wiring that needs no sign-off: the gate's pin raised, as a re-run
 *  of `init` from a newer build raises it, with nothing else changed. A lowered pin is named. */
function runtimeGatePinRaise(was: string, now: string): 'same' | 'raised' | 'lowered' | 'changed' {
  if (now === was) return 'same';
  if (withoutRuntimeGatePins(now) !== withoutRuntimeGatePins(was)) return 'changed';
  const before = runtimeGatePins(was);
  const after = runtimeGatePins(now);
  return after.every((pin, i) => pinNotBelow(pin, before[i])) ? 'raised' : 'lowered';
}

/** Reasons the after-config's `[hooks]` tables are not the before-config's. */
export function codexHooksWeakening(before: string, after: string): string[] {
  const was = codexHooksTables(before);
  if (!was) return [];
  const now = codexHooksTables(after);
  const change = runtimeGatePinRaise(was, now);
  if (change === 'same' || change === 'raised') return [];
  if (change === 'lowered') return ['the tamperward pin in the [hooks] tables was lowered or is no longer a plain version — the gate only ever raises its pin'];
  if (GATE.test(was) && !GATE.test(now)) return ['the tamperward hook entries were removed from the [hooks] tables — Codex no longer runs the gate'];
  return ['the [hooks] tables changed — the PreToolUse and Stop wiring Codex reads is no longer what it was'];
}

function hooksMember(src: string): { hooks: string | null } | null {
  let doc: unknown;
  try {
    doc = JSON.parse(src);
  } catch {
    return null;
  }
  if (!isDoc(doc)) return { hooks: null };
  return { hooks: doc.hooks === undefined ? null : JSON.stringify(doc.hooks) };
}

/** Reasons the after-wiring's `hooks` member is not the before-wiring's. A before
 *  that did not parse has nothing to compare; an after that does not parse loads no
 *  hook at all. */
export function copilotHooksWeakening(before: string, after: string): string[] {
  const was = hooksMember(before);
  if (was === null || was.hooks === null) return [];
  const now = hooksMember(after);
  if (now === null) return ['the file no longer parses as JSON — the Copilot CLI loads no hook from it'];
  const change = runtimeGatePinRaise(was.hooks, now.hooks ?? '');
  if (change === 'same' || change === 'raised') return [];
  if (change === 'lowered') return ['the tamperward pin in "hooks" was lowered or is no longer a plain version — the gate only ever raises its pin'];
  if (GATE.test(was.hooks) && !GATE.test(now.hooks ?? '')) return ['the tamperward hook entries were removed from "hooks" — the Copilot CLI no longer runs the gate'];
  return ['the "hooks" entries changed — the preToolUse and agentStop wiring the Copilot CLI reads is no longer what it was'];
}

// ── lefthook / pre-commit / package.json ───────────────────────────────────────

type Doc = Record<string, unknown>;
const isDoc = (v: unknown): v is Doc => v !== null && typeof v === 'object' && !Array.isArray(v);

export function parseDoc(src: string): Doc | null {
  try {
    const v: unknown = yaml.parse(src);
    return isDoc(v) ? v : null;
  } catch {
    return null;
  }
}

export const isLefthook = (path: string): boolean => /(?:^|\/)\.?lefthook(?:-local)?\.(?:ya?ml|toml|json)$/.test(path);
export const isLefthookLocal = (path: string): boolean => /(?:^|\/)\.?lefthook-local\.(?:ya?ml|toml|json)$/.test(path);
export const isPreCommitConfig = (path: string): boolean => /(?:^|\/)\.pre-commit-config\.ya?ml$/.test(path);
export const isPackageJson = (path: string): boolean => /(?:^|\/)package\.json$/.test(path);

const GATE = /\btamperward\b/;
const str = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(String).join(' ') : v == null ? '' : JSON.stringify(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[\s,]+/).filter(Boolean) : []);

/** The live gate a config's command string runs — `tamperward check` in
 *  invocation position, its failure able to fail the entry, not the word — with
 *  its identity (mode flag and `--cwd` included) and pin; null when it runs none. */
export function gateOf(command: string): { identity: string; pin: string } | null {
  const live = invocations([command], { errexit: true }).find((i) => i.state === 'live' && /^tamperward check\b/.test(i.identity));
  return live ? { identity: live.identity, pin: live.pin ?? '' } : null;
}

/** Whether a config's command string runs the gate LIVE. */
export const runsGate = (command: string): boolean => gateOf(command) !== null;

/** The entries of a config-level `env` map that redirect the gate's runtime, as
 *  `KEY=value`, so a changed value reads as a change. */
const redirectingEnv = (env: unknown): string[] =>
  isDoc(env) ? Object.keys(env).filter((k) => SENSITIVE_ENV.test(k)).sort().map((k) => `${k}=${str(env[k])}`) : [];

/** How the gate an entry runs changed between two readings of it: another
 *  identity (`--staged` → `--diff HEAD...HEAD`, a `--cwd`), a pin no longer plain
 *  or lower, an `env` the gate resolves through gained or changed. */
function gateDrift(what: string, was: { gate: { identity: string; pin: string } | null; env: string[] }, now: { gate: { identity: string; pin: string } | null; env: string[] }): string[] {
  const out: string[] = [];
  if (was.gate && now.gate) {
    if (now.gate.identity !== was.gate.identity) out.push(`${what} now runs \`${now.gate.identity}\` instead of \`${was.gate.identity}\` — another check`);
    if (PLAIN_SEMVER.test(was.gate.pin) && now.gate.pin) {
      if (!PLAIN_SEMVER.test(now.gate.pin)) out.push(`${what} pins the gate to \`${now.gate.pin}\`, which is not a plain version (was ${was.gate.pin}) — a range, tag or pre-release resolves to whatever the registry serves`);
      else if ((compareVersions(now.gate.pin, was.gate.pin) ?? 0) < 0) out.push(`${what} lowered the gate's pin from ${was.gate.pin} to ${now.gate.pin}`);
    }
  }
  if (now.env.length && now.env.join(',') !== was.env.join(',')) out.push(`${what} sets ${now.env.map((e) => e.split('=')[0]).join(', ')} in its \`env\` — the gate's runtime is redirected`);
  return out;
}

/** lefthook's overlay: `lefthook-local.yml` is merged over `lefthook.yml`, maps
 *  deeply, everything else replaced. */
export function mergeDocs(base: Doc, over: Doc): Doc {
  const out: Doc = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = isDoc(b) && isDoc(v) ? mergeDocs(b, v) : v;
  }
  return out;
}

interface LefthookEntry {
  live: boolean;
  /** The live gate's identity and pin; null when the entry runs none. */
  gate: { identity: string; pin: string } | null;
  /** The entry's `env` entries the gate resolves through, as `KEY=value`. */
  env: string[];
  skip: unknown;
  only: unknown;
  sectionSkip: unknown;
  sectionOnly: unknown;
  glob: string;
  exclude: string;
  /** The entry's tags that the section's `exclude_tags` names. */
  excludedByTag: string[];
}

const off = (v: unknown): boolean => v === undefined || v === null || v === false;

/** Every lefthook command/script that names the gate, keyed by section and name,
 *  with whether it runs it live. An overlay entry that carries no `run` but sits
 *  under the gate's name is read as the gate's (the base config it overlays has
 *  the `run`). */
function lefthookEntries(doc: Doc): Map<string, LefthookEntry> {
  const out = new Map<string, LefthookEntry>();
  for (const [section, v] of Object.entries(doc)) {
    if (!isDoc(v)) continue;
    const sectionExclude = list(v.exclude_tags);
    for (const group of ['commands', 'scripts']) {
      const g = v[group];
      if (!isDoc(g)) continue;
      for (const [name, cfg] of Object.entries(g)) {
        if (!isDoc(cfg)) continue;
        const run = cfg.run ?? cfg.runner;
        const named = GATE.test(name);
        if (!GATE.test(str(run)) && !named) continue;
        const tags = list(cfg.tags);
        const gate = run === undefined ? (named ? { identity: 'tamperward check --staged', pin: '' } : null) : gateOf(str(run));
        out.set(`${section}.${group}.${name}`, {
          live: gate !== null,
          gate,
          env: redirectingEnv(cfg.env),
          skip: cfg.skip, only: cfg.only, sectionSkip: v.skip, sectionOnly: v.only,
          glob: str(cfg.glob), exclude: str(cfg.exclude),
          excludedByTag: tags.filter((t) => sectionExclude.includes(t)),
        });
      }
    }
  }
  return out;
}

export function lefthookWeakening(before: Doc, after: Doc): string[] {
  const out: string[] = [];
  const b = lefthookEntries(before);
  const a = lefthookEntries(after);
  for (const [key, was] of b) {
    if (!was.live) continue;
    const now = a.get(key);
    if (!now) { out.push(`lefthook entry ${key} (the gate) was removed`); continue; }
    if (!now.live) out.push(`lefthook entry ${key} no longer runs \`tamperward check\` live`);
    out.push(...gateDrift(`lefthook entry ${key} (the gate)`, was, now));
    if (!off(now.skip) && off(was.skip)) out.push(`lefthook entry ${key} (the gate) is now \`skip: ${str(now.skip)}\``);
    if (!off(now.sectionSkip) && off(was.sectionSkip)) out.push(`the lefthook hook carrying ${key} (the gate) is now \`skip: ${str(now.sectionSkip)}\``);
    if (!off(now.only) && str(now.only) !== str(was.only)) out.push(`lefthook entry ${key} (the gate) gained or changed \`only\` (${str(now.only)})`);
    if (!off(now.sectionOnly) && str(now.sectionOnly) !== str(was.sectionOnly)) out.push(`the lefthook hook carrying ${key} (the gate) gained or changed \`only\` (${str(now.sectionOnly)})`);
    if (now.glob !== was.glob && now.glob) out.push(`lefthook entry ${key} (the gate) gained or changed \`glob\` (${now.glob}) — it no longer runs on every commit`);
    if (now.exclude !== was.exclude && now.exclude) out.push(`lefthook entry ${key} (the gate) gained or changed \`exclude\` (${now.exclude})`);
    if (now.excludedByTag.length && !was.excludedByTag.length) out.push(`lefthook entry ${key} (the gate) is tagged ${now.excludedByTag.join(', ')}, which the hook's \`exclude_tags\` switches off`);
  }
  return out;
}

interface PreCommitEntry {
  live: boolean;
  gate: { identity: string; pin: string } | null;
  env: string[];
  /** `additional_dependencies` as written: for a `language: node` hook they choose
   *  which `tamperward` the isolated environment installs. */
  deps: string;
  stages: string[];
  explicitStages: boolean;
  exclude: string;
  files: string;
  types: string;
  alwaysRun: boolean;
}
/** The stages the gate is for, legacy names folded onto the current ones. */
const STAGE_ALIAS: Record<string, string> = { commit: 'pre-commit', push: 'pre-push', merge_commit: 'pre-merge-commit' };
const GATE_STAGES = new Set(['pre-commit', 'pre-push']);
const ALL_STAGES = ['pre-commit', 'pre-merge-commit', 'pre-push', 'prepare-commit-msg', 'commit-msg', 'post-checkout', 'post-commit', 'post-merge', 'post-rewrite', 'manual'];
const normStage = (s: string): string => STAGE_ALIAS[s] ?? s;

function preCommitEntries(doc: Doc): Map<string, PreCommitEntry> {
  const out = new Map<string, PreCommitEntry>();
  const repos = Array.isArray(doc.repos) ? doc.repos : [];
  const defaults = Array.isArray(doc.default_stages) ? doc.default_stages.map(String).map(normStage) : ALL_STAGES;
  for (const repo of repos) {
    if (!isDoc(repo)) continue;
    const hooks = Array.isArray(repo.hooks) ? repo.hooks : [];
    for (const h of hooks) {
      if (!isDoc(h)) continue;
      if (!GATE.test(`${str(repo.repo)} ${str(h.id)} ${str(h.entry)} ${str(h.name)}`)) continue;
      // a local hook runs its `entry` followed by its `args`; a remote repo's hook
      // runs what that repo defines
      const gate = h.entry !== undefined
        ? gateOf(`${str(h.entry)} ${list(h.args).join(' ')}`.trim())
        : GATE.test(`${str(repo.repo)} ${str(h.id)}`) ? { identity: 'tamperward check --staged', pin: '' } : null;
      out.set(`${str(repo.repo)}:${str(h.id)}`, {
        live: gate !== null,
        gate,
        env: redirectingEnv(h.env),
        deps: str(h.additional_dependencies),
        stages: Array.isArray(h.stages) ? h.stages.map(String).map(normStage) : defaults,
        explicitStages: Array.isArray(h.stages),
        exclude: str(h.exclude),
        files: str(h.files),
        types: [str(h.types), str(h.types_or), str(h.exclude_types)].join(' ').trim(),
        alwaysRun: h.always_run === true,
      });
    }
  }
  return out;
}

export function preCommitWeakening(before: Doc, after: Doc): string[] {
  const out: string[] = [];
  const b = preCommitEntries(before);
  const a = preCommitEntries(after);
  for (const [key, was] of b) {
    if (!was.live) continue;
    const now = a.get(key);
    if (!now) { out.push(`pre-commit hook ${key} (the gate) was removed`); continue; }
    if (!now.live) out.push(`pre-commit hook ${key} no longer runs \`tamperward check\` live`);
    out.push(...gateDrift(`pre-commit hook ${key} (the gate)`, was, now));
    if (now.deps && now.deps !== was.deps) out.push(`pre-commit hook ${key} (the gate) gained or changed \`additional_dependencies\` (${now.deps}) — they choose which gate the hook installs`);
    const lost = was.stages.filter((s) => GATE_STAGES.has(s) && !now.stages.includes(s));
    if (lost.length && !now.stages.some((s) => GATE_STAGES.has(s))) {
      out.push(`pre-commit hook ${key} (the gate) now runs only at stages [${now.stages.join(', ')}] — no commit or push triggers it`);
    } else if (lost.length) {
      out.push(`pre-commit hook ${key} (the gate) no longer runs at stage(s) ${lost.join(', ')}${now.explicitStages ? '' : ' (default_stages changed)'}`);
    }
    if (now.exclude !== was.exclude && now.exclude) out.push(`pre-commit hook ${key} (the gate) gained or changed \`exclude\` (${now.exclude})`);
    if (now.files !== was.files && now.files) out.push(`pre-commit hook ${key} (the gate) gained or changed \`files\` (${now.files})`);
    if (now.types !== was.types && now.types && !now.alwaysRun) out.push(`pre-commit hook ${key} (the gate) is scoped by file type (${now.types}) without \`always_run\``);
  }
  const topB = str(before.exclude);
  const topA = str(after.exclude);
  if (topA && topA !== topB && b.size > 0) out.push(`a top-level pre-commit \`exclude\` was added or changed (${topA}) — it scopes every hook, the gate included`);
  return out;
}

const INSTALL_SCRIPTS = ['prepare', 'postinstall', 'install', 'preinstall'];

/** The hook installer a lifecycle script runs — `husky`, `husky install`,
 *  `lefthook install`, `simple-git-hooks`, `pre-commit install` — by command
 *  identity, or null. `echo husky` says the word, `HUSKY=0 husky` runs it
 *  disabled, `husky uninstall` removes the hooks: none installs anything. */
export function installerOf(script: string): string | null {
  for (const seg of script.split(/&&|\|\||;|\n/)) {
    const raw = seg.trim();
    if (!raw) continue;
    if (/^(?:HUSKY|LEFTHOOK)=0\b/.test(raw)) continue;
    const core = raw.replace(PREFIX, '').replace(RUNNER, '').replace(/\s+/g, ' ');
    const m = core.match(/^(?:node\s+)?(?:\S*\/)?(husky|lefthook|simple-git-hooks|pre-commit)(?:\.js)?(?:\s+(\S+))?/);
    if (!m) continue;
    const [, tool, sub] = m;
    if (tool === 'husky' && (sub === undefined || sub === 'install' || sub.startsWith('-'))) return sub === 'install' ? 'husky install' : 'husky';
    if (tool === 'lefthook' && sub === 'install') return 'lefthook install';
    if (tool === 'pre-commit' && sub === 'install') return 'pre-commit install';
    if (tool === 'simple-git-hooks' && (sub === undefined || sub.startsWith('-'))) return 'simple-git-hooks';
  }
  return null;
}

/** package.json: the lifecycle script that INSTALLS the git hooks (`prepare: husky`)
 *  losing its installer. Cheap and exact through the JSON, so it is judged here
 *  even though package.json sits in the config class. */
export function packageJsonWeakening(before: string, after: string): string[] {
  let b: unknown;
  let a: unknown;
  try {
    b = JSON.parse(before);
    a = JSON.parse(after);
  } catch {
    return [];
  }
  if (!isDoc(b) || !isDoc(a)) return [];
  const installers = (d: Doc): string[] => {
    const sc = d.scripts;
    if (!isDoc(sc)) return [];
    return INSTALL_SCRIPTS.map((k) => installerOf(str(sc[k]))).filter((x): x is string => x !== null);
  };
  const was = installers(b)[0];
  if (!was) return [];
  if (installers(a).length) return [];
  return [`the install script that wires the git hooks (\`${was}\`) was removed from package.json scripts — a fresh checkout installs no hooks`];
}

// ── renames within the hooks class ─────────────────────────────────────────────

export const GIT_HOOKS: ReadonlySet<string> = new Set([
  'applypatch-msg', 'pre-applypatch', 'post-applypatch', 'pre-commit', 'pre-merge-commit', 'prepare-commit-msg',
  'commit-msg', 'post-commit', 'pre-rebase', 'post-checkout', 'post-merge', 'pre-push', 'pre-receive', 'update',
  'post-receive', 'post-update', 'push-to-checkout', 'pre-auto-gc', 'post-rewrite', 'sendemail-validate',
]);

/** What a hooks-class path IS to its consumer, or null when the consumer would not
 *  read it there. `lefthook.yml` and `lefthook.yaml` are the same file to lefthook;
 *  `.husky/pre-commit` and `.husky/pre-commit.bak` are not the same file to git. */
export function hookIdentity(path: string): string | null {
  const base = path.split('/').pop() ?? '';
  if (isLefthook(path)) return isLefthookLocal(path) ? 'lefthook-local' : 'lefthook';
  if (isPreCommitConfig(path)) return 'pre-commit-config';
  if (base === 'CODEOWNERS') return 'codeowners';
  const husky = path.match(/(?:^|\/)\.husky\/([^/]+)$/);
  if (husky && GIT_HOOKS.has(husky[1])) return `husky:${husky[1]}`;
  return null;
}

// ── the command surface ────────────────────────────────────────────────────────

const ownerExec = (mode: string): boolean => (parseInt(mode.slice(-3).padStart(3, '0'), 8) & 0o100) !== 0;
const SYMBOLIC = /^([ugoa]*)((?:[-+=][rwxXstugo]*)+)$/;

/**
 * Whether a `chmod` DROPS the owner execute bit. Direction-aware: `+x` and `u+x`
 * add it and are the repair, not the tamper. `chmod 0`, `chmod 00644` (any 1–5
 * octal digits: the last three decide) and `--reference=<file>` (a mode read from
 * elsewhere, unknowable here) count as dropping it. A clause with several op
 * groups (`u+rw-x`, `u-x+r`, `u=g`) is applied in order and judged by its end.
 */
export function chmodDropsExec(toks: string[]): boolean {
  const at = toks.findIndex((t) => t === 'chmod' || t.endsWith('/chmod'));
  if (at === -1) return false;
  for (const tok of toks.slice(at + 1)) {
    if (/^--reference=/.test(tok)) return true;
    if (/^[0-7]{1,5}$/.test(tok)) {
      if (!ownerExec(tok)) return true;
      continue;
    }
    for (const clause of tok.split(',')) {
      const m = clause.match(SYMBOLIC);
      if (!m) continue;
      const [, who, opsText] = m;
      if (who && !/[ua]/.test(who)) continue; // group/other only: the owner bit is untouched
      let exec: boolean | null = null; // null: unchanged so far
      for (const g of opsText.match(/[-+=][rwxXstugo]*/g) ?? []) {
        const op = g[0];
        const perms = g.slice(1);
        if (/[ugo]/.test(perms)) { exec = false; continue; } // copied from another class: unknowable, fail closed
        if (op === '-' && /[xX]/.test(perms)) exec = false;
        else if (op === '+' && /[xX]/.test(perms)) exec = true;
        else if (op === '=') exec = /[xX]/.test(perms);
      }
      if (exec === false) return true;
    }
  }
  return false;
}

/** `setfacl -m u::rw- hook` rewrites the owner's base permissions through the
 *  ACL: an owner entry without `x` drops the execute bit. */
export function setfaclDropsExec(toks: string[]): boolean {
  if (!toks.some((t) => /^-[a-zA-Z]*m|^--modify/.test(t))) return false;
  return toks.some((t) => t.split(',').some((e) => {
    const m = e.match(/^(?:u|user)::([rwxX-]*)$/);
    return !!m && !/[xX]/.test(m[1]);
  }));
}

/** A token that runs the NEXT token as the command: `sudo rm x`, `env rm x`,
 *  `FOO=1 rm x`. Shared with test-deletion so both rules read the same word as
 *  the command. */
export const WRAPPERS = /^(?:sudo|command|exec|time|nice|env|[A-Za-z_][A-Za-z0-9_]*=\S*)$/;
const INTERPRETERS = new Set(['python', 'python2', 'python3', 'node', 'perl', 'ruby', 'php', 'deno', 'bun']);
const INLINE_FLAG = /^-(?:c|e|r|E|p|pe|pi|i|ne|ni|le)$|^--eval$|^--print$|^--exec$/;
const EDITORS = new Set(['ex', 'ed', 'vim', 'vi', 'nvim']);
/** A path-shaped word inside an inline script: `$HOME`, `${CLAUDE_CONFIG_DIR}` and
 *  `%USERPROFILE%` stay one word with the path they prefix, so the shell
 *  expansion reads them as the shell would. */
const SCRIPT_WORD = /[\w.~/$%{}\\-]+/g;
const HOOK_BASENAMES = ['pre-commit', 'pre-push', 'commit-msg', 'settings.json', 'settings.local.json', 'managed-settings.json', '.tamperward.yml', 'lefthook.yml', 'lefthook.yaml', 'lefthook-local.yml', '.pre-commit-config.yaml', 'CODEOWNERS'];

/** A `find -name` glob as a matcher over hook basenames. */
function nameGlob(pattern: string): (name: string) => boolean {
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return (n) => re.test(n);
}

/** The write targets a copy-like command names, dir destinations expanded: `cp
 *  x .husky/` writes `.husky/x`; `install -t .husky x` writes `.husky/x`. */
export function destinations(cmd: string, args: string[], isDir: (p: string) => boolean): string[] {
  const positional: string[] = [];
  let target: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { positional.push(...args.slice(i + 1)); break; }
    if (a === '-t' || a === '--target-directory') { target = args[++i] ?? null; continue; }
    const eq = a.match(/^--target-directory=(.*)$/);
    if (eq) { target = eq[1]; continue; }
    if ((cmd === 'install' && /^-[mogS]$/.test(a)) || (cmd === 'install' && /^--(?:mode|owner|group|suffix)$/.test(a)) || (cmd === 'rsync' && /^(?:-e|--rsh|--exclude|--include|--files-from)$/.test(a))) { i++; continue; }
    if (a.startsWith('-')) continue;
    positional.push(a);
  }
  const base = (p: string): string => p.replace(/\/+$/, '').split('/').pop() ?? p;
  if (target !== null) {
    const dir = target.replace(/\/+$/, '');
    return positional.map((p) => `${dir}/${base(p)}`);
  }
  if (positional.length < 2) return [];
  const dest = positional[positional.length - 1];
  const srcs = positional.slice(0, -1);
  if (dest.endsWith('/') || srcs.length > 1 || isDir(dest)) return [dest, ...srcs.map((s) => `${dest.replace(/\/+$/, '')}/${base(s)}`)];
  return [dest];
}

/**
 * Whether a shell segment WRITES a protected hook, and how — as opposed to reading
 * it. `cat .husky/pre-commit > /tmp/backup` reads the hook and writes a backup;
 * `cp .husky/pre-commit /tmp/` reads it; `sed -n 1,5p .husky/pre-commit` reads it.
 * Only the hook as a write TARGET — redirect target, cp/install/ln/rsync
 * destination (a directory destination expanded to the file it receives), either
 * side of mv, tee/sponge/truncate/rm argument, in-place sed/perl/awk target, dd
 * `of=`, an inline interpreter script or batch editor naming it, a patch naming
 * it, or a `git checkout <rev>`/`git restore --source` that puts an older version
 * of it (or of a directory holding it, or of everything) back — is tampering. An
 * absolute path under the repository is the repository path.
 */
/** A redirection's target: `>x`, `>>x`, `2>x`, `>|x` (past `noclobber`), `&>x`. */
export const REDIRECT_TARGET = /(?:^|\s)(?:\d*>{1,2}\|?|&>{1,2})\s*(\S+)/g;

/** A shell path token with the spellings the shell expands before a write lands:
 *  `~`, `$HOME`/`${HOME}` (perl's `$ENV{HOME}`), `%USERPROFILE%`, `$CLAUDE_CONFIG_DIR` (its value when the
 *  hook's own environment sets it, else the runtime's default `~/.claude` — an
 *  unset variable is read as the default it stands for, not as nothing), and
 *  backslashes as separators. */
export function expandShellPath(t: string, env: NodeJS.ProcessEnv = process.env): string {
  const home = homeDir(env);
  return t
    .replace(/\\/g, '/')
    .replace(/^~(?=\/|$)/, home)
    .replace(/\$(?:\{HOME\}|HOME\b|ENV\{HOME\})/g, home)
    .replace(/%USERPROFILE%/gi, home)
    .replace(/\$(?:\{CLAUDE_CONFIG_DIR\}|CLAUDE_CONFIG_DIR\b)/g, claudeConfigDir(env));
}

/** Path tests over a command's tokens, relative to the repository: a token is
 *  expanded as the shell would (`~`, `$HOME`, `$CLAUDE_CONFIG_DIR`, backslashes),
 *  every symlink in it resolved, and an absolute path under the cwd is the
 *  repository path — so `/tmp/xlink/.claude/settings.json` with `/tmp/xlink ->
 *  <repo>` is `.claude/settings.json`, and `/tmp/cfg/settings.json` with
 *  `/tmp/cfg -> ~/.claude` is the user file. `.`, `./`, `:/`, `*` are the whole
 *  tree; a directory holds a hook when a protected file lives under it. A hook is
 *  a path in `protected.hooks`, or any Claude settings file wherever it lives:
 *  the runtime reloads every one of them live, and the user and managed files
 *  are outside every repository glob. */
export function hookTests(policy: Policy, ctx?: DetectorContext) {
  const cwd = ctx?.cwd;
  // The repository directory when it exists on disk; relative tokens resolve
  // against it and only then.
  const diskCwd = cwd !== undefined && existsSync(cwd) ? cwd : undefined;
  const root = diskCwd !== undefined ? canonicalPath(diskCwd) : cwd;
  const memo = new Map<string, string>();
  const rel = (t: string): string => {
    const hit = memo.get(t);
    if (hit !== undefined) return hit;
    let p = expandShellPath(t.replace(/^["']|["']$/g, ''));
    // `s/a/b/`, `:/`, `{}`, `-name`: not paths — only a path-shaped token is resolved.
    const pathy = isAbsolute(p) || (p.includes('/') && !/^[-:]/.test(p));
    const abs = isAbsolute(p) ? p : diskCwd !== undefined ? resolve(diskCwd, p) : null;
    if (pathy && abs !== null) {
      p = canonicalPath(abs);
      if (root !== undefined) {
        if (p === root) p = '.';
        else if (p.startsWith(root + '/')) p = p.slice(root.length + 1);
      }
    }
    if (cwd !== undefined && p.startsWith(cwd + '/')) p = p.slice(cwd.length + 1);
    p = p.replace(/^\.\/(?=.)/, '');
    memo.set(t, p);
    return p;
  };
  const hook = (t: string): boolean => {
    const p = rel(t);
    return isProtected(p, policy, 'hooks') || isClaudeSettings(p) || isClaudeSettings(expandShellPath(t.replace(/^["']|["']$/g, '')));
  };
  const whole = (t: string): boolean => /^(?:\.|\.\/|:\/|\*)$/.test(rel(t)) || (cwd !== undefined && rel(t) === cwd);
  // The user settings file lives in no repository listing: a directory token that
  // is an ancestor of it (`rm -rf ~/.claude`, `find ~/.claude -delete`) holds it.
  const userSettings = `${claudeConfigDir()}/settings.json`;
  const userSettingsUnder = (t: string): string | null => {
    const dir = rel(t).replace(/\/+$/, '');
    return dir !== '' && dir !== '/' && userSettings.startsWith(dir + '/') ? userSettings : null;
  };
  const holds = (t: string): boolean => !t.startsWith('-') && (whole(t) || userSettingsUnder(t) !== null || containsProtected(rel(t), policy, 'hooks', ctx));
  const hookish = (t: string): boolean => hook(t) || holds(t);
  return { rel, hook, whole, holds, hookish, userSettingsUnder };
}

/**
 * The protected hook a shell segment NAMES — the path a shellWritesHook finding is
 * about: the redirect target first, then the arguments in order (`of=` unwrapped
 * for dd, absolute paths under the cwd made repo-relative), then a directory (or
 * the whole tree) holding one, resolved to the first protected file under it when
 * the repository listing is known. A command-surface finding used to carry no
 * `file`, and the engine's pin on the guarded rule (src/engine.ts isGuardedFinding)
 * is keyed on the file: under a policy that lowered hook-tampering to warn, `rm
 * .claude/settings.json` from the shell was a warn — and, at the hook, an allow —
 * while the same removal through an Edit was pinned to block.
 */
export function shellHookTarget(seg: string, toks: string[], policy: Policy, ctx?: DetectorContext): string | null {
  const { rel, hook, whole, holds, userSettingsUnder } = hookTests(policy, ctx);
  for (const m of seg.matchAll(REDIRECT_TARGET)) {
    if (hook(m[1])) return rel(m[1]);
  }
  const args = toks.map((t) => t.replace(/^(?:of=|--(?:include|exclude|directory)=)/, ''));
  // the path an inline interpreter script names (`python3 -c "open('…/settings.json','w')"`)
  for (let i = 1; i < args.length; i++) {
    if (!INLINE_FLAG.test(args[i - 1])) continue;
    for (const word of args[i].match(SCRIPT_WORD) ?? []) if (hook(word)) return rel(word);
  }
  // `.husky/**` matches the bare `.husky` too: a token is the FILE only when it
  // looks like one (a hook's basename, an extension) or the listing says so.
  const fileLike = (p: string): boolean => {
    const b = p.replace(/\/+$/, '').split('/').pop() ?? '';
    return HOOK_BASENAMES.includes(b) || /\.[A-Za-z0-9]+$/.test(b.replace(/^\.+/, '')) || (trackedFiles(ctx)?.includes(p) ?? false);
  };
  for (const t of args) if (hook(t) && fileLike(rel(t))) return rel(t);
  for (const t of args) {
    if (t.startsWith('-') || !holds(t)) continue;
    const user = userSettingsUnder(t);
    if (user !== null) return user;
    const dir = rel(t).replace(/\/+$/, '');
    const under = whole(t) ? '' : dir + '/';
    const listed = trackedFiles(ctx)?.find((f) => f.startsWith(under) && isProtected(f, policy, 'hooks'));
    if (listed) return listed;
    const guess = under + 'pre-commit';
    return isProtected(guess, policy, 'hooks') ? guess : whole(t) ? '.tamperward.yml' : dir;
  }
  return null;
}

export function shellWritesHook(seg: string, toks: string[], policy: Policy, ctx?: DetectorContext): string | null {
  const { hook, whole, holds, hookish } = hookTests(policy, ctx);
  for (const m of seg.matchAll(REDIRECT_TARGET)) {
    if (hook(m[1])) return 'a redirect empties or rewrites a protected hook';
  }
  let at = 0;
  while (at < toks.length && WRAPPERS.test(toks[at])) at++;
  const cmd = (toks[at] ?? '').replace(/^.*\//, '');
  const args = toks.slice(at + 1);
  const positional = args.filter((a) => a !== '--' && !a.startsWith('-'));
  const anyHook = args.some(hook);
  const inPlace = args.some((a) => /^-[A-Za-z]*i|^--in-place/.test(a));
  // the SCRIPT an interpreter runs inline (the token after `-c`/`-e`/`-r`), not
  // the files it is given: `perl -ne 'print' hook` reads the hook
  const scripts = args.filter((_, i) => i > 0 && INLINE_FLAG.test(args[i - 1]));
  const namesHookInText = (): boolean => scripts.some((a) => (a.match(SCRIPT_WORD) ?? []).some(hook));
  switch (cmd) {
    case 'rm': case 'unlink': case 'shred':
      return anyHook || positional.some(holds) ? 'rm deletes a protected hook' : null;
    case 'truncate':
      return anyHook ? 'truncate empties a protected hook' : null;
    case 'chmod':
      return (anyHook || positional.some(holds)) && chmodDropsExec(toks) ? 'chmod removes execute permission from a hook — git will skip it' : null;
    case 'setfacl':
      return anyHook && setfaclDropsExec(args) ? 'setfacl removes the owner execute permission from a hook — git will skip it' : null;
    case 'mv':
      return anyHook || positional.some(holds) ? 'mv moves a protected hook out of place or overwrites it' : null;
    case 'cp': case 'install': case 'ln': case 'rsync': {
      const dests = destinations(cmd, args, holds);
      return dests.some(hook) ? `${cmd} replaces a protected hook in place` : null;
    }
    case 'tee': case 'sponge':
      return anyHook ? `${cmd} rewrites a protected hook in place` : null;
    case 'dd':
      return args.some((a) => a.startsWith('of=') && hook(a.slice(3))) ? 'dd rewrites a protected hook in place' : null;
    case 'sed': case 'perl':
      if (anyHook && inPlace) return `an in-place ${cmd} rewrites a protected hook`;
      if (cmd === 'perl' && args.some((a) => INLINE_FLAG.test(a)) && namesHookInText()) return 'an inline perl script names a protected hook';
      return null;
    case 'awk': case 'gawk':
      return anyHook && args.some((a, i) => (a === '-i' && args[i + 1] === 'inplace') || a === '--in-place' || a === '-i=inplace')
        ? 'an in-place awk rewrites a protected hook'
        : null;
    case 'patch':
      return anyHook ? 'patch rewrites a protected hook' : null;
    case 'xargs':
      return null; // judged by the caller, which sees the segments feeding it
    case 'find': {
      const mutates = /\s(?:-delete\b|-exec(?:dir)?\s+(?:rm|unlink|chmod|truncate|mv|sed|tee|shred)\b)/.test(seg);
      if (!mutates) return null;
      if (/-exec(?:dir)?\s+chmod\b/.test(seg) && !chmodDropsExec(toks)) return null;
      const dirs = positional.filter((p) => !/^-/.test(p) && !['{}', ';', '+', 'rm', 'chmod', 'unlink', 'truncate', 'mv', 'sed', 'tee', 'shred', 'inplace'].includes(p));
      const names = args.filter((_a, i) => /^-i?(?:name|path|regex)$/.test(args[i - 1] ?? ''));
      const nameHits = names.length === 0 || names.some((n) => { try { const g = nameGlob(n.replace(/^.*\//, '')); return HOOK_BASENAMES.some(g); } catch { return true; } });
      const reachesHook = dirs.some((d) => hook(d) || holds(d) || (whole(d) && nameHits)) || (dirs.length === 0 && nameHits);
      return reachesHook && nameHits ? 'find rewrites or removes protected hooks' : null;
    }
    case 'git': {
      // skip the global options (`-C <dir>`, `-c <k=v>`, `--git-dir=…`) to the subcommand
      let i = 0;
      while (i < args.length && args[i].startsWith('-')) i += args[i] === '-C' || args[i] === '-c' ? 2 : 1;
      const sub = args[i];
      const rest = args.slice(i + 1);
      if (sub === 'apply' || sub === 'am') return rest.some((a) => hook(a.replace(/^--(?:include|exclude|directory)=/, ''))) ? `git ${sub} applies a patch that names a protected hook` : null;
      if (!rest.some(hookish)) return null;
      if (sub === 'checkout') {
        // `git checkout <rev> [--] <hook>`: a rev between the subcommand and the path.
        // `git checkout -- <hook>` (from the index) restores the trusted state and passes.
        const dd = rest.indexOf('--');
        const before = dd === -1 ? rest : rest.slice(0, dd);
        const revs = before.filter((p) => !p.startsWith('-') && !hookish(p));
        return revs.length > 0 ? 'git checkout <rev> -- <hook> puts an older version of a protected hook back' : null;
      }
      if (sub === 'restore' && rest.some((a) => /^--source(?:=|$)/.test(a) || a === '-s')) {
        return 'git restore --source=<rev> <hook> puts an older version of a protected hook back';
      }
      return null;
    }
    default:
      if (INTERPRETERS.has(cmd) && inPlace && anyHook) return `an in-place ${cmd} rewrites a protected hook`;
      if (INTERPRETERS.has(cmd) && args.some((a) => INLINE_FLAG.test(a)) && namesHookInText()) return `an inline ${cmd} script names a protected hook`;
      if (EDITORS.has(cmd) && (anyHook || (args.some((a) => /^-[a-zA-Z]*[cs]/.test(a) || a === '--cmd') && namesHookInText()))) return `${cmd} rewrites a protected hook`;
      return null;
  }
}

/** The command an `xargs` segment runs over what feeds it, past xargs's own
 *  flags (`xargs -n1 rm -f` runs `rm`): its basename, its arguments, and the
 *  index of the command token. Null when the segment does not run xargs. */
export function xargsCommand(toks: string[]): { cmd: string; args: string[]; at: number } | null {
  const at = toks.findIndex((t) => t === 'xargs' || t.endsWith('/xargs'));
  if (at === -1) return null;
  let i = at + 1;
  while (i < toks.length && toks[i].startsWith('-')) i += /^-(?:I|n|L|P|d|a|s)$/.test(toks[i]) ? 2 : 1;
  return { cmd: (toks[i] ?? '').replace(/^.*\//, ''), args: toks.slice(i + 1), at: i };
}

/** `… | xargs rm` / `xargs chmod -x`: the hook path is in the segment feeding
 *  xargs, not in xargs's own. `fed` are the tokens of the earlier segments. */
export function xargsWritesHook(toks: string[], fed: string[], policy: Policy, ctx?: DetectorContext): string | null {
  const run = xargsCommand(toks);
  if (run === null) return null;
  const { hookish } = hookTests(policy, ctx);
  const fedHook = fed.some(hookish);
  if (!fedHook) return null;
  const { cmd, args, at: i } = run;
  if (['rm', 'unlink', 'shred', 'truncate', 'mv', 'tee', 'sponge'].includes(cmd)) return `xargs ${cmd} rewrites or removes a protected hook named earlier in the line`;
  if (cmd === 'chmod' && chmodDropsExec(toks.slice(i))) return 'xargs chmod removes execute permission from a hook named earlier in the line';
  if ((cmd === 'sed' || cmd === 'perl') && args.some((a) => /^-[A-Za-z]*i|^--in-place/.test(a))) return `xargs ${cmd} -i rewrites a protected hook named earlier in the line`;
  return null;
}
