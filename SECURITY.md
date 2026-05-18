# Security policy

## Supported versions

PKOS is pre-1.0. Security fixes land on `main` and ship in the next
tagged release. No back-porting to older tags during the 0.x cycle.

| Version | Supported |
| ------- | --------- |
| 0.x (`main` + latest tag) | ✅ |
| anything older than the latest 0.x tag | ❌ |

## Reporting a vulnerability

**Do not open a public GitHub issue.** Use one of the channels below so
the fix lands before the problem is known.

1. **Preferred — GitHub Security Advisories.** Open a private advisory
   at <https://github.com/marcel-klein/pkos/security/advisories/new>.
   This stays private until we publish it.
2. **Fallback — Email.** Send the report to
   `security@`*your-domain* (or, until that mailbox exists,
   `marcel-klein` via GitHub). PGP is available on request.

Please include:

- A description of the vulnerability and the impact you observed.
- Step-by-step reproduction (the smallest possible test case).
- PKOS version: tag, or `git rev-parse --short HEAD` on `main`.
- Deployment shape: docker compose / pnpm dev / other.

What you should expect:

- Acknowledgement within **3 working days**.
- A first triage assessment within **7 working days**.
- A target fix window — typically **30 days** for critical issues,
  **90 days** for lower severity. We'll keep you in the loop.
- Credit in the advisory (and changelog) unless you ask to remain
  anonymous.

## Scope

In scope:

- The PKOS web app (`apps/web/`), the workspace packages
  (`packages/*`), the CLI scripts (`scripts/*`), the SQL migrations
  (`infra/migrations/*`), and the reference Docker / reverse-proxy
  configs (`infra/`, `docker-compose*.yml`, `apps/web/Dockerfile`).
- Auth, session, 2FA, API-key, webhook signing, audit log, attachment
  storage, email ingest, web clipper URL fetch (SSRF).

Out of scope:

- Self-inflicted misconfiguration (e.g. exposing Postgres on
  `0.0.0.0`, leaking a `SESSION_SECRET`).
- Third-party dependencies that are upstream-fixed — please file
  against the upstream project; we'll pick up the bump.
- Reports that require physical access to the host or root on the VM.
- Rate-limiting bypasses that require >1k requests/second from a
  single source against a self-hosted instance designed for one user.

For a description of how PKOS is *designed* to be secure — threat
model, defaults, recovery scenarios — see
[`docs/security.md`](docs/security.md). This file is about how to tell
us when those defenses fail.
