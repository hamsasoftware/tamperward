# Admission consumer for signed verification evidence

## Evidence inventory

| Existing producer or transport | Established evidence | Admission limit |
| --- | --- | --- |
| `verify` terminal / `verify-v1` JSON | Candidate and pristine suite exits, integrity and runtime checks; `suite-exit-only` | Candidate source executes in the suite process and may terminate or interpose on assertions. Execution isolation does not establish semantic isolation. |
| `receipt-v1` | Unsigned local `VERIFIED` identity and bounded stage results | Its digest detects inconsistency, not producer authenticity. It grants no admission authority. |
| `signed-verdict-v1` | Trusted Ed25519 key signs revision, policy, verdict, audience, nonce and validity | No tree, verifier-configuration digest, completion, explicit exception or assurance binding. Preserve v1 consumers and bytes. |
| `oracle-v1` / `oracle-v2` | Independent host completion and comparison of finite CommonJS JSON response cases | Separate unsigned evidence. Neither a suite result nor a signed suite statement proves this oracle ran. |
| `signed-verdict-v2` and `attestation admit` | SHA-pinned completed verify evidence, exact producer identity, suite assurance, exception and request scope | Supported assurance is only `suite-exit-only`. The protected job must establish evidence provenance and the consumer must enforce fresh request scope. |

## Existing v1 consumer contract

An admission consumer decides whether a **particular request** may proceed. A
`VERIFIED` string, an unsigned receipt, or a valid signature without an independently
established expected scope is insufficient. The v1 signed statement transports a
trusted signer's verdict; it does not attest to how the signer obtained that verdict.
Keep the signer and its key outside candidate-controlled jobs and establish the
verifier result in that trusted job before signing.

## Required inputs and checks

The protected admission service obtains these values from its own request, policy
configuration and trusted verifier, never from a candidate's submitted statement:

| Value | Admission check |
| --- | --- |
| Repository and action | Construct a fixed `audience` such as `owner/repo:merge` from the authenticated repository and requested action. Reject another repository or action. |
| Candidate and baseline | Read the *current* request head and intended base from the hosting service immediately before admission; compare them to the exact `head` and `base` in the statement. Recheck after any queue delay or update. |
| Effective policy and verifier | Independently establish the effective policy digest and verifier version for this request; compare `policy_hash` and `gate_version`. A repository-controlled or weaker policy cannot set the required floor. |
| Outcome and exception | Require the expected `verdict` to be `VERIFIED` when admission requires a clean pass. `MASKED_FAILURE` and an out-of-band sign-off are separate, explicit exception decisions; never turn either into `VERIFIED`. |
| Assurance | For the v1 `verify` path, require `suite-exit-only` and retain its limitation: candidate source executes in the suite process. The v1 signature has **no assurance field**, so verification of that signature alone cannot establish an oracle result or a stronger level. |
| Key and freshness | Load the trusted Ed25519 public key from protected configuration. Use an admission-context `nonce` generated outside candidate control; check the issue/expiry window and atomically consume the nonce if one-use admission is required. A retry needs a fresh nonce. |
| Evidence completeness | The trusted signer must finish its own candidate, policy and verifier checks before signing. Reject missing or partial verification evidence. A local receipt's `evidence_digest` detects internal inconsistency but does not authenticate its producer. |

The receipt's `binding` additionally names a tree fingerprint, verifier contract,
protected surface, intervention and dependencies. An admission service that needs
these identities must recompute and compare them within its trusted verifier or use
a future versioned statement that signs them. It must not join an arbitrary receipt
to a v1 statement by matching only `head`: the receipt is unsigned, and v1 does not
sign `tree`, `assurance`, or repository as a distinct field. The repository is scoped
through the protected audience, which must be derived from the authenticated request.

## Minimal protected-job integration

The protected service first obtains `head`, `base`, repository, action, policy hash,
gate version and a fresh nonce from its own control plane. It runs its trusted
verification against those immutable inputs, requires complete clean evidence, and
signs only the independently checked v1 payload described in
[signed verdict statements](./attestation.md). The admission side independently
builds `expected.json` from the **current** request and configured policy, with
exactly the seven fields accepted by the CLI:

```json
{
  "head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "base": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "gate_version": "2.48.3",
  "policy_hash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "verdict": "VERIFIED",
  "audience": "hexrift/tamperward:merge",
  "nonce": "protected-request-42/attempt-1"
}
```

The values above are illustrative. The protected admission step fails unless this
command returns zero:

```sh
tamperward attestation verify \
  --statement /protected/evidence/signed.json \
  --key /protected/config/ed25519-public.pem \
  --expect /protected/request/expected.json
```

Construct `expected.json` in the protected job from authenticated, fresh inputs;
do not copy the fields out of `signed.json`. Require the job to fail on a nonzero
exit and make its check mandatory in branch protection. Re-evaluate the live head,
base and policy before the final write/merge, and consume the nonce in the same
admission transaction if replay must be prevented. A changed head, base, policy,
audience, nonce, expiry or signer fails the v1 verification when the expected scope
and trusted key are correct. A stronger oracle request must fail this v1-only flow;
use separately trusted oracle evidence and a versioned assurance binding before
admitting it as a stronger claim.

The [external oracle](./external-oracle.md) is an opt-in finite JSON function
profile, not an upgrade to ordinary `verify`. Neither the example nor a signed
`VERIFIED` statement establishes its completion or provenance.

## Completed suite producer evidence

Completed verification reports include an additive `evidence_binding`: `head`,
resolved `base`, adjudicated `tree`, `gate_version`, `policy_hash`, `verifier_hash`,
`completed: true` and `integrity: "CLEAN"`. The producer captures these values from
the policy, command, budget, backend and candidate it actually uses. Incomplete,
budget-exceeded, dependency-drift or cannot-verify reports do not supply completed
evidence. This metadata does not authenticate an unsigned report. The default v1
signed statement remains unchanged and does not include this producer binding.

## Opt-in v2 producer and executable consumer

Use `attestation sign --schema-version 2` with the exact bytes of a completed
`verify --json` report, then use `attestation admit` in the admission job. V1
signing and verification keep their existing format and signature encoding.
V2 currently supports **only `suite-exit-only`**. The execution backend keeps its existing residuals, including checkpointed-local same-host mutation limits; signed transport does not improve that backend. An external-oracle or unknown
assurance requirement fails this consumer; the finite oracle requires its own
protected provenance and future admission binding.

The protected job prepares a v2 payload from its authenticated request and trusted
configuration. It includes exactly the existing v1 binding fields, plus
`schema_version: 2`, `repository`, `tree`, `verifier_hash`,
`assurance: "suite-exit-only"`, `exception: null`, `issued_at` and `expires_at`.
The policy and verifier hashes use the same canonical encoding as the local
verification record. The verifier hash includes the actual command, budget,
declared inputs, backend and image, so changing a command flag cannot retain the
same verifier identity. The baseline is the resolved baseline actually used;
a control plane requiring an exact baseline also uses `verify --require-ancestor`.

For a clean request, an illustrative payload is:

```json
{
  "schema_version": 2,
  "repository": "hexrift/tamperward",
  "head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "base": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "tree": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "gate_version": "2.51.0",
  "policy_hash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "verifier_hash": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "verdict": "VERIFIED",
  "assurance": "suite-exit-only",
  "exception": null,
  "audience": "hexrift/tamperward:merge",
  "nonce": "protected-request-42/attempt-1",
  "issued_at": "2026-11-01T12:00:00.000Z",
  "expires_at": "2026-11-01T12:10:00.000Z"
}
```

The paths below belong to the protected job. The launcher, CLI, policy, evidence
output path, payload and digest must be outside candidate control. Run candidate
code without the signing key and transfer the resulting artifact through the
protected job's authenticated artifact channel. Obtain its SHA-256 in that trusted
producer channel; computing a digest over an untrusted candidate submission does
not establish provenance. Signing deliberately refuses a report without the
completed producer binding, contradictory stage exits, another candidate, changed
policy or verifier, wrong assurance, or a mismatched artifact digest.

```sh
tamperward verify --base "$TRUSTED_BASE" --require-ancestor --json \
  > /protected/evidence/verify.json
sha256sum /protected/evidence/verify.json

tamperward attestation sign --schema-version 2 \
  --payload /protected/request/payload-v2.json \
  --evidence /protected/evidence/verify.json \
  --sha256 "$PRODUCER_EVIDENCE_SHA256" \
  --key /protected/signing/ed25519-private.pem \
  --out /protected/evidence/signed-v2.json
```

The signature covers the exact evidence-byte digest, reconstructed stage summary,
producer identity, assurance and its residual limitation, exception, request scope
and validity window under a separate v2 domain. The bounded signed statement
contains no suite logs or command text. Signing reads regular files, limits the
report to 256 KiB, and creates a fresh output file with mode 0600. A SHA-256 match
and signature prove which artifact the protected signer accepted; they do not
prove an unsafe signer ran the suite or protect keys the operator exposes to
candidate code.

The admission job constructs `expected-v2.json` with exactly the payload's binding
fields, omitting `schema_version`, `issued_at` and `expires_at`. It obtains current
repository, head, intended baseline, tree, audience and fresh nonce from its own
request; required policy, verifier and suite assurance come from protected
configuration and the independently trusted verifier. It must not copy them from
the candidate's submitted statement. It loads the public key from protected
configuration and requires this command to succeed:

```sh
tamperward attestation admit \
  --statement /protected/evidence/signed-v2.json \
  --key /protected/config/ed25519-public.pem \
  --expect /protected/request/expected-v2.json
```

The executable consumer checks every binding, signature, signer and expiry. A
stale head, tree or baseline; changed policy or verifier; wrong repository, action,
signer or nonce; unsupported assurance; incomplete evidence; or an unsigned/v1
claim exits 2. A statement replayed into a new request or retry fails its new nonce.
The CLI has no one-use database: a replay in the *same* valid request scope remains
cryptographically valid until expiry. The protected service must atomically consume
that nonce with its final admission transaction when one-use admission is required,
and recheck the current request identities immediately before that transaction.

A `MASKED_FAILURE` can be admitted only as a separate explicit exception. Both the
signed payload and independently expected request must name
`exception: {"rule":"verify","head":"<exact-head>","approval":"<trusted-signoff-token>"}`;
the completed verify report must carry that same trusted `oob_signoff`. A clean
`VERIFIED` statement requires `exception: null`. Admission preserves and prints
`MASKED_FAILURE` for an approved exception; it never changes that verdict to
`VERIFIED`. Red suites, budget exhaustion and cannot-verify evidence cannot be
admitted by this flow.
