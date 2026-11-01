The unmodified [OASIS SARIF 2.1.0 schema](https://github.com/oasis-tcs/sarif-spec/blob/main/sarif-2.1/schema/sarif-schema-2.1.0.json) validates the SARIF regressions offline.

SHA-256: `c3b4bb2d6093897483348925aaa73af03b3e3f4bd4ca38cef26dcb4212a2682e`.

The schema uses Draft 4 metadata. The test omits only its root `id` and `$schema` metadata when compiling with the existing Ajv Draft 7 validator. All validation keywords used by this schema have the same meaning in Draft 7.
