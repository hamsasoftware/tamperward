# Signed verdict statements

From 2.45.0, a trusted CI/signing job can sign a verdict for transport to a separate
consumer. This does not replace independent verification. The existing unsigned
verification receipt remains evidence and cannot authorize a merge.

The trust root is an operator-configured Ed25519 public key. Keep its private key in
an independent signing service or protected job that never executes candidate code.
Do not mount it into a verifier, put it in repository variables readable by candidate
jobs, or sign a candidate-supplied receipt or JSON file without independently establishing
every field. A valid signature proves what the trusted key signed; it cannot prove
that an unsafe signer actually ran the checks. The CLI does not create a key store,
grant key access, or establish payload provenance for you.

## Sign after independent verification

The trusted job constructs `payload.json` with exactly these fields:

```json
{
  "schema_version": 1,
  "head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "base": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "gate_version": "2.45.0",
  "policy_hash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "verdict": "VERIFIED",
  "audience": "owner/repo:merge",
  "nonce": "trusted-run-id/attempt-1",
  "issued_at": "2026-10-22T08:00:00.000Z",
  "expires_at": "2026-10-22T08:10:00.000Z"
}
```

The hashes above are illustrative. Use the immutable revisions and the SHA-256
effective-policy hash established by the trusted verifier, not candidate assertions.
Dates must be current, UTC and millisecond-normalized. Lifetime is positive and at
most 24 hours; consumers allow at most 60 seconds of future clock skew. The gate
version names the verifier actually used, not necessarily the signing CLI's version.

```sh
tamperward attestation sign --payload payload.json --key /trusted/ed25519-private.pem --out signed.json
```

The key must be Ed25519 PEM (PKCS#8 private / SPKI public). Output is a fresh file,
created with mode 0600; existing files and links are refused. Inputs are regular
files bounded to 64 KiB. The signed envelope is published as `signed-verdict-v1`.
Its domain-separated signature binds a strict fixed-order JSON encoding, algorithm
and the SHA-256 fingerprint of the public key's DER SPKI. Unknown fields are rejected.

## Verify before accepting

The consumer constructs `expected.json` independently with exactly `head`, `base`,
`gate_version`, `policy_hash`, `verdict`, `audience` and `nonce`. Require `VERIFIED`
when that is the only acceptable outcome; an approved masked failure is not VERIFIED.

```sh
tamperward attestation verify --statement signed.json --key /trusted/ed25519-public.pem --expect expected.json
```

Exit 0 means the signature, time window and every expected binding match. Invalid,
missing, malformed, expired, wrong-key or differently scoped statements exit 2.
The consumer must require this command to succeed; merely storing a statement or
running verification as an optional CI step grants no authority. Never obtain the
trusted key or expected scope from the candidate's claim. No key embedded in a
statement is trusted automatically.

Use a fresh trusted nonce for each authorization context, including retries when
appropriate, and an audience specific to the repository/action. A claim can be
replayed within the same expected scope until expiry; a one-use consumer must also
store and atomically consume nonces outside candidate control. This CLI has no
replay database. Rotation means distributing a new trusted public key through the
operator's control plane; old claims fail against the new key. Revocation is removal
of the old trusted key, not a repository edit or a candidate-controlled key id.

Signed transport does not qualify a second runtime or enforce an organisation policy
floor; those are separate M5 requirements.

For an admission decision, follow the [v1 admission consumer contract](./admission-consumer.md).
The v1 signature does not include the receipt's tree fingerprint or an assurance
level; consumers must not infer either from the signed verdict alone.


For opt-in completed suite evidence, use `attestation sign --schema-version 2`
with `--evidence` and its protected-producer `--sha256`, followed by
`attestation admit`. The [v2 producer and consumer contract](./admission-consumer.md#opt-in-v2-producer-and-executable-consumer)
binds the actual candidate tree, repository, policy and verifier configuration,
completion, `suite-exit-only` assurance, explicit exception and fresh request scope.
V1 remains the default. Neither format upgrades suite exits into an independent
semantic oracle.
