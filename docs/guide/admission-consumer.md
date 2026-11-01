# Admission consumer for signed verification evidence

## Evidence inventory

| Existing producer or transport | Established evidence | Admission limit |
| --- | --- | --- |
| `verify` terminal / `verify-v1` JSON | Candidate and pristine suite exits, integrity and runtime checks; `suite-exit-only` | Candidate source executes in the suite process and may terminate or interpose on assertions. Execution isolation does not establish semantic isolation. |
| `receipt-v1` | Unsigned local `VERIFIED` identity and bounded stage results | Its digest detects inconsistency, not producer authenticity. It grants no admission authority. |
| `signed-verdict-v1` | Trusted Ed25519 key signs revision, policy, verdict, audience, nonce and validity | No tree, verifier-configuration digest, completion, explicit exception or assurance binding. Preserve v1 consumers and bytes. |
| `oracle-v1` / `oracle-v2` | Independent host completion and comparison of finite CommonJS JSON response cases | Separate unsigned evidence. Neither a suite result nor a signed suite statement proves this oracle ran. |

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
