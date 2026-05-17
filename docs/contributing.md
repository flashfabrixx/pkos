# Contributing

Welcome. Hands-on guide for working on PKOS.

## Local setup

```bash
pnpm install
cp .env.example .env
# fill in PKOS_PASSWORD_HASH, SESSION_SECRET, POSTGRES_PASSWORD …
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

## Tests

PKOS uses [Vitest](https://vitest.dev) with [Testcontainers](https://node.testcontainers.org)
for integration tests. Each integration suite spins up a real `pgvector/pgvector:pg16`
container, applies every migration, and tears it down afterwards.

```bash
pnpm test            # one-shot run
pnpm test:watch      # watch mode
pnpm test:cov        # coverage report (text + HTML)
```

Requirements:

- Docker daemon running locally
- Roughly 5 minutes for the first run while images are pulled

Pure-utility tests under `apps/web/test/utils/` do not need Docker; they
run as standalone Vitest specs.

## Layout

```
apps/web/test/
  setup/
    pg.ts          # Testcontainer + migration applier + withTx helper
  utils/           # Unit tests for pure utilities
  db/              # Integration tests that touch a real Postgres
```

Every new endpoint, util, or scheduled task should ship with a Vitest spec
that covers at least the happy path plus one explicit failure mode.

## UI

The UI is Tailwind v4, utility-first. Design tokens are declared once in
`apps/web/app/assets/css/app.css` (the `@theme` block plus the three
`:root` token blocks); everything else lives in component templates as
utilities or in the small primitive library at
`apps/web/app/components/ui/` (`UiButton`, `UiInput`, `UiField`,
`UiSelect`, `UiCard`, `UiDialog`, `UiBadge`, etc.).

The styleguide and rules of engagement (no `dark:` variants, no `@apply`
outside the base layer, Heroicons-only, no emojis) are in
[`CLAUDE.md`](../CLAUDE.md#ui-styleguide-tailwind-v4) — read it before
adding new screens.

## Roadmap

See [`docs/roadmap-v1.md`](./roadmap-v1.md). Each batch lands in its own
worktree-PR; the changelog (`docs/changelog.md`) is the human-readable
running log of what shipped.
