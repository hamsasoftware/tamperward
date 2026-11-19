# Cast inventory — TamperWard production source (#383)

Every type assertion (`x as T`, `<T>x`) and non-null assertion (`x!`) in `src/` on
`main` before this change, counted on the TypeScript AST by
[`harness/fp-study/cast-inventory.mjs`](https://github.com/hamsasoftware/tamperward/blob/main/harness/fp-study/cast-inventory.mjs), with its
classification and what replaced it. `as const` is a literal-type request and is not
counted. There were **no** `as any` casts and **no** `as unknown as T` double casts.

| form | main | now |
| --- | ---: | ---: |
| `as T` / `<T>x` (ordinary type assertion) | 60 | 0 |
| `x!` (non-null assertion) | 14 | 0 |
| `as any` | 0 | 0 |
| `as unknown as T` | 0 | 0 |

## Classes

- **untrusted JSON** — a document that same-UID, candidate or third-party code can write
  (snapshots, telemetry, the ledger, hook payloads, package.json, Docker inspect output,
  the policy file). Replaced by readers that check every field before building the typed
  value (`src/narrow.ts`, `ptreeFrom`, `fsEventFrom`, `ledgerEntryFrom`, `readWatcherHealth`,
  `hooksOf`, `validate()`).
- **thrown error / process result** — `e as NodeJS.ErrnoException`, `e as Error & { stderr }`.
  Replaced by `errnoCode`, `errorMessage`, `execFailure`.
- **guard narrows** — the code had already checked the value; the cast re-asserted what a
  type predicate, an `in` check or a restructured condition proves.
- **literal / const list** — `(LIST as readonly string[]).includes(x)`. Replaced by `.some`.
- **non-null invariant** — `x!` standing for a fact the control flow can state.
- **TypeScript internal API** — `parseDiagnostics` and `text` are not on the public node
  types; `'prop' in node` narrows without asserting the whole node.

Security-sensitive paths (trust boundaries: policy, ledger, hook payload, envelope, verifier,
telemetry, git, dependency attestation) are marked **●**.

| site (main) | form | what was asserted | class | replaced by |
| --- | --- | --- | --- | --- |
| ● `adapters/claude/changes.ts:102` | as-T | `e as { stdout?: string \| Buffer; status?: number \| null; code?: s…` | thrown error / process result | execFailure() |
| ● `adapters/claude/changes.ts:145` | as-T | `raw as { old_string?: string; new_string?: string }` | untrusted JSON | isRecord + asStr per field |
| ● `cli/doctor.ts:119` | as-T | `value as Record<string, unknown>` | type guard body | isRecord() |
| ● `cli/doctor.ts:513` | as-T | `e as Error & { stderr?: string \| Buffer }` | thrown error / process result | execFailure() |
| ● `cli/hook.ts:81` | as-T | `parsed as ClaudeHookInput` | untrusted JSON | hook payload built field by field |
| ● `cli/hook.ts:500` | as-T | `[] as Finding[]` | literal typing | annotated variable |
| ● `cli/init.ts:342` | as-T | `JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as { sc…` | untrusted JSON | isRecord chain |
| ● `cli/init.ts:466` | as-T | `parsed as ClaudeSettings` | untrusted JSON | hooksOf() rebuilds the checked shape |
| ● `cli/init.ts:780` | non-null | `existingRel!` | non-null invariant | existingRel checked in the condition |
| `cli/report.ts:23` | as-T | `FORMATS as string[]` | literal / const list | FORMATS.some |
| ● `cli/run.ts:552` | as-T | `supervisor.error as NodeJS.ErrnoException` | thrown error / process result | errnoCode() |
| ● `cli/run.ts:633` | as-T | `e as NodeJS.ErrnoException` | thrown error / process result | errnoCode() |
| ● `cli/run.ts:688` | non-null | `pid!` | non-null invariant | pid !== null before pidAlive |
| ● `cli/run.ts:698` | non-null | `pid!` | non-null invariant | same narrowed pid |
| `cli/trace-verify.ts:196` | non-null | `rel!` | non-null invariant | rel !== null branch restructured |
| `cli/trace-verify.ts:302` | non-null | `prefix.split(sep).at(-1)!` | non-null invariant | ?? prefix |
| ● `cli/verify.ts:344` | non-null | `pending.shift()!` | non-null invariant | for-loop over shift() until undefined |
| ● `cli/verify.ts:362` | non-null | `dependencyRoot!` | non-null invariant | deps domain resolves only with a dependency root |
| ● `cli/watch.ts:93` | as-T | `JSON.parse(readFileSync(watcherHealthPath(log), 'utf8')) as Partial…` | untrusted JSON | readWatcherHealth builds from checked fields |
| ● `cli/watch.ts:100` | as-T | `value as WatcherHealth` | untrusted JSON | same |
| ● `cli/watch.ts:112` | as-T | `e as NodeJS.ErrnoException` | thrown error / process result | errnoCode() |
| `detectors/ci-tampering.ts:419` | non-null | `l.match(/^\s*/)!` | non-null invariant | length - trimStart().length |
| `detectors/ci-tampering.ts:795` | non-null | `c.after!` | non-null invariant | c.after != null in the condition |
| `detectors/coverage-lowering.ts:57` | as-T | `METRICS as readonly string[]` | literal / const list | METRICS.some |
| `detectors/coverage-lowering.ts:508` | as-T | `'lower' as Direction` | literal / const list | contextual SimpleKey return type |
| `detectors/coverage-lowering.ts:744` | non-null | `o.after!` | non-null invariant | filter predicate types after: string |
| `detectors/coverage-lowering.ts:760` | non-null | `o.after!` | non-null invariant | same predicate |
| ● `detectors/fs-events.ts:167` | as-T | `JSON.parse(line) as FsEvent` | untrusted JSON | fsEventFrom() validates each record |
| ● `detectors/hook-tampering.ts:62` | as-T | `v as Settings` | untrusted JSON | isObj predicate already narrows |
| ● `detectors/hook-tampering.ts:313` | as-T | `c.tools as Set<string>` | guard narrows | tools null handled inline |
| ● `detectors/hook-tampering.ts:447` | as-T | `e.h as Obj` | guard narrows | isObj guard (schemaProblem already rejected non-objects) |
| ● `detectors/hook-tampering.ts:505` | as-T | `c.before as string` | guard narrows | c.before == null ternary |
| ● `detectors/hook-tampering.ts:563` | as-T | `(base[section] ??= {}) as Record<string, unknown>` | guard narrows | base typed as nested Record |
| ● `detectors/hook-tampering.ts:564` | as-T | `(sec[group] ??= {}) as Record<string, unknown>` | guard narrows | same |
| ● `detectors/hook-tampering.ts:870` | as-T | `c.after as string` | guard narrows | c.after != null in the condition |
| ● `detectors/hook-wiring.ts:866` | as-T | `i.pin as string` | guard narrows | flatMap with the pin check |
| ● `detectors/hook-wiring.ts:1348` | non-null | `target!` | non-null invariant | target narrowed before the closure |
| ● `detectors/hook-wiring.ts:1408` | as-T | `cwd as string` | guard narrows | diskCwd resolved once |
| ● `detectors/policy-diff.ts:43` | as-T | `v as RawPolicyShape` | untrusted JSON | raw shape is Record<string, unknown>; fields read via isRecord/verifyBlock/ruleOverrides |
| `detectors/snapshot-only.ts:51` | as-T | `snaps[0] as Extract<Change, { kind: 'file' }>` | guard narrows | filter predicate c is FileChange |
| `detectors/snapshot-rewrite.ts:105` | as-T | `c.oldPath as string` | guard narrows | oldPath ?? path |
| `detectors/suite-config.ts:217` | as-T | `PYTEST_INI_ORDER as readonly string[]` | literal / const list | findIndex |
| `detectors/suite-config.ts:441` | as-T | `x as ts.ParenthesizedExpression \| ts.AsExpression \| ts.SatisfiesE…` | guard narrows | ts.isSatisfiesExpression guard chain |
| `detectors/suite-config.ts:518` | as-T | `e as ts.ParenthesizedExpression \| ts.AsExpression \| ts.SatisfiesE…` | guard narrows | same |
| `detectors/test-deletion.ts:102` | as-T | `fn as ts.ArrowFunction \| ts.FunctionExpression` | guard narrows | find with a type predicate |
| `detectors/test-deletion.ts:275` | as-T | `JSON.parse(src ?? '{}') as { scripts?: Record<string, unknown> }` | untrusted JSON | isRecord chain |
| `detectors/test-deletion.ts:608` | as-T | `PYTEST_INI_ORDER as readonly string[]` | literal / const list | PYTEST_INI_ORDER.some |
| `detectors/test-skip.ts:221` | as-T | `sf as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }` | TypeScript internal API | 'parseDiagnostics' in sf narrowing |
| `detectors/test-skip.ts:461` | as-T | `node as ts.Node & { text?: unknown }` | TypeScript internal API | 'text' in node narrowing |
| ● `disk.ts:50` | as-T | `e as { code?: unknown }` | thrown error / process result | errnoCode() |
| ● `effect.ts:200` | as-T | `JSON.parse(readFileSync(p, 'utf8')) as PTree` | untrusted JSON | ptreeFrom() validates each entry |
| ● `engine.ts:87` | as-T | `{ rule: 'detector-error', severity: 'block', message: `Detector "${…` | literal typing | annotated Finding |
| ● `git/build.ts:52` | as-T | `e as { stderr?: string \| Buffer; message?: string }` | thrown error / process result | execFailure() |
| ● `git/build.ts:307` | as-T | `c as { path: string }` | guard narrows | flatMap on kind |
| ● `policy-load.ts:37` | as-T | `SEVERITIES as readonly unknown[]` | literal / const list | SEVERITIES.some |
| ● `policy-load.ts:83` | as-T | `r as Record<string, unknown>` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:90` | as-T | `r.rules as Record<string, unknown>` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:106` | as-T | `r.protected as Record<string, unknown>` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:113` | as-T | `r.signoff as Record<string, unknown>` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:118` | as-T | `r.signoff as Record<string, unknown>` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:126` | as-T | `r.verify as Record<string, unknown>` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:141` | as-T | `v.image as string` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy-load.ts:202` | as-T | `e as Error` | thrown error / process result | errorMessage() |
| ● `policy-load.ts:207` | as-T | `raw as RawPolicy` | untrusted JSON | validate() returns the proved shape; parsePolicy takes unknown |
| ● `policy.ts:65` | as-T | `{ ...(out[name] ?? {}), ...(cfg ?? {}) } as Policy['rules'][string]` | merge typing | RuleConfig.severity optional (what mergeRules always produced) |
| ● `signoff.ts:65` | as-T | `e as LedgerEntry` | untrusted JSON | ledgerEntryFrom() validates each field |
| ● `signoff.ts:131` | non-null | `normalizedHead!` | non-null invariant | early return on !head |
| ● `suite-diagnostics.ts:111` | non-null | `ch.codePointAt(0)!` | non-null invariant | ?? 0 |
| ● `suite-diagnostics.ts:327` | as-T | `JSON.parse(stdoutText) as RawResult` | untrusted JSON | isRecord + streamFromRaw(unknown) |
| ● `suite-diagnostics.ts:392` | as-T | `supervisor.error as NodeJS.ErrnoException` | thrown error / process result | errnoCode() |
| ● `verifier-backend.ts:151` | as-T | `metadata as { Config?: unknown }` | untrusted JSON | isRecord chain |
| ● `verifier-backend.ts:155` | as-T | `config as { Volumes?: unknown }` | untrusted JSON | same |
| ● `verifier-backend.ts:160` | as-T | `volumes as Record<string, unknown>` | untrusted JSON | same |
| ● `wiring.ts:34` | as-T | `JSON.parse(readFileSync(join(here, rel), 'utf8')) as { name?: strin…` | untrusted JSON | isRecord |

## Remaining assertions

None in `src/`. The one place a cast would have been the only way to reach a value —
TypeScript's non-public `parseDiagnostics` — is read through an `in` check instead.
Test files keep their assertions: they are fixtures, not the surface that decides whether
production typechecks, and `ts-cast-growth` excludes them for the same reason.

## Keeping it that way

`ts-cast-growth` (warn) reports net growth of this surface on every change; the
repository's own policy enables it. The inventory script can be re-run at any time:

```sh
node harness/fp-study/cast-inventory.mjs src
```
