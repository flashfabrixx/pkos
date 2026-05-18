# PKOS — Private Knowledge Operating System

> Your knowledge, your server, your conversations. PKOS turns meeting
> transcripts, voice notes, emails and clipped web pages into a
> queryable knowledge base — and lets you actually have a conversation
> with it, all from your own machine.

[![CI](https://github.com/marcel-klein/pkos/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/marcel-klein/pkos/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![Tailwind v4](https://img.shields.io/badge/tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Roadmap: 1.0 ready](https://img.shields.io/badge/roadmap-1.0--ready-brightgreen)](docs/roadmap-v1.md)
[![Sponsor](https://img.shields.io/badge/sponsor-on%20github-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/marcel-klein)

---

## What PKOS is

Single-user, self-hosted, **private** knowledge OS. The whole thing
runs on a small VM (or your laptop) behind a reverse proxy. Nothing
leaves your box unless you tell it to.

- **Capture** from text, drag-and-drop file uploads (PDF / DOCX / VTT
  / Markdown), IMAP email, or a one-click web-clipper bookmarklet.
- **Process** with pluggable extraction (OpenRouter / Ollama /
  placeholder) and 1024-dim multilingual embeddings (bge-m3 or
  text-embedding-3-small).
- **Discover** with hybrid semantic + lexical search, entity-link
  suggestions, and a `⌘K` command palette across documents, people,
  projects, tags and departments.
- **Act** with an Asana-style action board and a daily mail digest of
  due / overdue items.
- **Integrate** via a versioned REST API (`/api/v1/*`) with API keys
  and HMAC-signed outbound webhooks.
- **Operate** with `/healthz`, `/readyz`, structured pino logs, an
  append-only audit log and a portable tar.gz backup CLI.

## What PKOS is **not**

- Not multi-tenant. There is one user account per install. By design.
- Not a SaaS. There's no hosted version (yet). You run it.
- Not a Notion / Confluence replacement for teams. It's for one person
  who wants their own knowledge to live somewhere they own.
- Not a CRM. People + projects + departments are organising-context
  entities, not contact-management rows with deal stages and pipelines.

If you need any of the above, PKOS isn't your tool. That's fine —
single-user, self-hosted is a wedge, not a weakness.

## 5-minute quickstart (local dev)

```bash
git clone https://github.com/marcel-klein/pkos.git
cd pkos
pnpm install
pnpm pkos:setup       # interactive: creates .env, hashes a password,
                      # writes a session secret, starts Postgres,
                      # applies migrations.
pnpm dev
```

Visit <http://localhost:3000> and sign in with the credentials the
setup tool printed.

Want to do it by hand? `pnpm pkos:hash-password`, write `.env`,
`docker compose up -d postgres`, `pnpm db:migrate`, `pnpm dev`.

Requirements: Node 22, pnpm 10.9, Docker (for Postgres + the
integration test container).

## Production deployment

```bash
cp .env.prod.example .env.prod   # fill in MUST-CHANGE lines
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

See [`docs/deployment.md`](docs/deployment.md) for the full guide,
including TLS via Caddy or Traefik and **zero-trust** options
(Tailscale + Cloudflare Access) that never expose PKOS to the public
internet.

A signed multi-arch container image is published to
`ghcr.io/marcel-klein/pkos:<tag>` on every tagged release — see the
release workflow + cosign verification snippet below.

```bash
docker pull ghcr.io/marcel-klein/pkos:latest
```

## Documentation

| Topic | File |
| --- | --- |
| Codebase tour + UI styleguide | [`CLAUDE.md`](CLAUDE.md) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Security policy | [`SECURITY.md`](SECURITY.md) |
| Roadmap & sprint status | [`docs/roadmap-v1.md`](docs/roadmap-v1.md) |
| Changelog | [`docs/changelog.md`](docs/changelog.md) |
| Public REST API | [`docs/api.md`](docs/api.md) |
| Security model | [`docs/security.md`](docs/security.md) |
| Email → PKOS | [`docs/email-setup.md`](docs/email-setup.md) |
| Backup & restore | [`docs/backup.md`](docs/backup.md) |
| Deployment (incl. zero-trust) | [`docs/deployment.md`](docs/deployment.md) |
| ADRs | [`docs/adr/`](docs/adr/) |

## Tests

```bash
pnpm test         # unit + integration, requires Docker for Postgres testcontainer
pnpm test:cov     # with coverage
```

Pure-utility tests under `apps/web/test/utils/` and component tests
under `apps/web/test/ui/` run without Docker.

## Stack

- **Frontend:** Nuxt 4 + Vue 3, Tailwind v4 (CSS-first, semantic
  tokens, dark mode through `[data-theme="dark"]` — no `dark:`
  variants in markup), Headless UI, Heroicons.
- **Backend:** Nuxt Nitro (Node 22), Postgres 16 + pgvector, server
  utilities auto-imported from `apps/web/server/utils/`.
- **Tooling:** pnpm workspace, Vitest, Testcontainers, vue-tsc.

## Community

- **Discussions:** [github.com/marcel-klein/pkos/discussions](https://github.com/marcel-klein/pkos/discussions)
  for questions, "would you accept a PR for X?", and how-are-you-using-it.
- **Issues:** bug reports and accepted feature requests.
- **Security:** private disclosure via [`SECURITY.md`](SECURITY.md) —
  please don't open public issues for vulnerabilities.

## Support the project

PKOS is one person's tool that anyone can use. If it saves you time
and you'd like to help keep it maintained:

- **Star the repo** — GitHub's discovery surfaces lift starred repos,
  which brings the next contributor in.
- **[Sponsor on GitHub](https://github.com/sponsors/marcel-klein)** —
  any amount funds the time to keep shipping fixes and the chat
  workflow (see roadmap).
- **File a clear bug report or thoughtful feature proposal** — those
  are contributions too.

## License

Apache License 2.0 — see [LICENSE](LICENSE). Contributions inbound under
the same.
