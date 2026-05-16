# BKOS — Business Knowledge Operating System

Self-hosted knowledge capture, processing, retrieval and action
tracking. BKOS turns meeting transcripts, voice notes, emails and
clipped web pages into a queryable knowledge base with semantic search,
entity graph, action reminders and outbound webhooks.

[![Roadmap status: 1.0 ready](https://img.shields.io/badge/roadmap-1.0--ready-brightgreen)](docs/roadmap-v1.md)

## At a glance

- **Capture** from text, drag-and-drop file uploads (PDF / DOCX),
  IMAP email, or a one-click web-clipper bookmarklet.
- **Process** with pluggable extraction (OpenRouter / Ollama /
  placeholder) and 1024-dim multilingual embeddings (bge-m3 or
  text-embedding-3-small).
- **Discover** with hybrid semantic + lexical search,
  entity-link suggestions, and a `⌘K` command palette.
- **Act** with an Asana-style action board and a daily mail digest of
  due / overdue items.
- **Integrate** via a versioned REST API (`/api/v1/*`) with API keys
  and HMAC-signed outbound webhooks.
- **Operate** with `/healthz`, `/readyz`, structured pino logs, an
  append-only audit log and a portable JSONL backup CLI.

## 5-minute quickstart (local dev)

```bash
git clone https://github.com/your-org/bkos.git
cd bkos
pnpm install
pnpm bkos:setup       # interactive: creates .env, password, secret;
                      # starts Postgres; applies migrations.
pnpm dev
```

Visit <http://localhost:3000> and log in with the credentials the
setup tool printed.

Want to do it by hand? `pnpm bkos:hash-password`, write `.env`,
`docker compose up -d postgres`, `pnpm db:migrate`, `pnpm dev`.

## Production deployment

```bash
cp .env.prod.example .env.prod   # fill in MUST-CHANGE lines
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

See [`docs/deployment.md`](docs/deployment.md) for the full guide,
including TLS via Caddy or Traefik and **zero-trust** options
(Tailscale + Cloudflare Access) that never expose BKOS to the public
internet.

## Documentation

| Topic                     | File                                |
| ------------------------- | ----------------------------------- |
| Roadmap & sprint status   | [`docs/roadmap-v1.md`](docs/roadmap-v1.md) |
| Changelog                 | [`docs/changelog.md`](docs/changelog.md)   |
| Public REST API           | [`docs/api.md`](docs/api.md)               |
| Security model            | [`docs/security.md`](docs/security.md)     |
| Email → BKOS              | [`docs/email-setup.md`](docs/email-setup.md) |
| Backup & restore          | [`docs/backup.md`](docs/backup.md)         |
| Deployment (incl. zero-trust) | [`docs/deployment.md`](docs/deployment.md) |
| Contributing              | [`docs/contributing.md`](docs/contributing.md) |
| ADRs                      | [`docs/adr/`](docs/adr/)                    |

## Tests

```bash
pnpm test         # unit + integration, requires Docker for Postgres testcontainer
pnpm test:cov     # with coverage
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
