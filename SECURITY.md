# Security Policy

PrivyQ is applied cryptography. We take security reports seriously and
appreciate responsible disclosure.

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.** Instead, email
`security@privyq.dev` with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if possible),
- affected component(s) and version(s).

We aim to acknowledge reports within 72 hours and to provide a remediation
timeline after triage. Please give us a reasonable window to fix the issue
before public disclosure.

## Scope & current limitations

PrivyQ is under active development. Known limitations are documented candidly in
`docs/blueprint.md` §26. In particular:

- The local key store (`KEY_STORAGE=local`) is for development and small
  deployments; production deployments should use an HSM or cloud KMS backend.
- Default credentials in `.env.example` (`KEY_MASTER_PASSWORD`, `SECRET_KEY`)
  MUST be changed before any non-local deployment.
- Post-quantum algorithms are comparatively new; PrivyQ tracks the finalized
  NIST standards via well-reviewed implementations (Cloudflare CIRCL).

## Cryptographic provenance

Post-quantum primitives (ML-KEM / Kyber, ML-DSA / Dilithium) are provided by
[Cloudflare CIRCL](https://github.com/cloudflare/circl). Symmetric encryption is
AES-256-GCM; hashing is SHA-256. PrivyQ does not implement its own primitives.
