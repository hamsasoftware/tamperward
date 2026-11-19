# ADR 0002: Preserve content-based tree fingerprints

- Date: 2026-10-21
- Status: Accepted
- Issue: [#752](https://github.com/hamsasoftware/tamperward/issues/752)

## Context

Verification-state recomputation reads every tracked and untracked file, plus ignored
protected files. The measured `status.recompute.100`, `.1k` and `.10k` benchmarks and
smoke budget landed in #766. The remaining proposal was to substitute Git index blob
IDs for unchanged files while keeping existing verification digests byte-identical.

The digest is a rolling SHA-256 over each sorted path, entry kind, full filesystem
mode and raw working-tree bytes, with NUL framing. Git blob IDs have different framing
and can describe different bytes after EOL normalization or clean filters. They cannot
be substituted into that digest. Git's clean status and stat metadata are also not
content proofs: `assume-unchanged` and `skip-worktree` can hide equal-size edits with
restored timestamps. An agent-writable persistent cache adds an authority that the
current recomputation does not trust.

## Decision

Retain full-content recomputation and the existing verification-state schema. Do not
introduce an index, stat or persistent-cache fast path for verification validity.
Batch the path/kind/mode framing into one hash update per file to reduce native-call
overhead without changing the digest or the guarded disk reads.

The index-based, skip-reads part of #752 is not planned under the existing identity
contract. A future proposal needs a separate identity and trust design, explicit
migration of old records to UNVERIFIED if their schema changes, and evidence that
candidate-controlled index metadata cannot conceal changed working-tree content.
Changing the schema alone does not make trusting Git's clean status safe.

## Validation and consequences

Compatibility tests compare against the previous byte framing using an independent
fixture enumerator and reader, including binary data, Unicode paths, ignored protected
files, symlinks, filesystem modes and normalized Git blobs. Regression tests cover
hidden tracked edits with restored timestamps, staged/unstaged divergence, ignored
protected edits, additions and deletions. Existing guarded-read and verification-state
tests continue to apply.

A local, warm-cache 12,503-file fixture (Node 24.19.0, 11 timed repetitions after two
warm-ups, alternating old/new order) measured fingerprint p50 at 123.4 ms before and
115.3 ms after batching. The samples overlap; this is a small local measurement, not
a new performance guarantee. The committed performance baseline and smoke ratios
remain the regression authority. Work remains linear in file count and bytes; the
optimization does not claim incremental hashing.
