# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

BKOS is a self-hosted, **single-user** Business Knowledge Operating System: ingests text / file / IMAP / web-clipped content, runs it through an extractor + embedding pipeline, and exposes it via hybrid search, an entity graph, action board, and a versioned REST API.

This is a pnpm workspace with one Nuxt 4 app (`apps/web`) and three workspace libraries (`packages/core`, `packages/ingest`, `packages/retrieval`) that are inlined into the Nitro bundle (see `nuxt.config.ts → nitro.externals.inline`). The app talks to Postgres + pgvector — there is no other backend service.

## Commands

```bash
pnpm install
pnpm bkos:setup        # interactive: writes .env, hashes password, starts pg, runs migrations
pnpm dev               # Nuxt dev server on :3000 (binds 0.0.0.0)
pnpm build             # nuxt build (production bundle for apps/web)
pnpm typecheck         # vue-tsc via nuxt typecheck (apps/web only)

pnpm test              # vitest run — unit + integration. Needs Docker (testcontainers)
pnpm test:watch
pnpm test:cov
# Single test file:
pnpm exec vitest run apps/web/test/utils/password.test.ts
# Filter by name:
pnpm exec vitest run -t "rejects invalid signature"

pnpm db:migrate        # apply infra/migrations/*.sql against DATABASE_URL
pnpm db:reset          # drop + recreate schema (destructive)
pnpm db:embed          # backfill embeddings for existing rows
pnpm db:detect-language

pnpm bkos:hash-password
pnpm bkos:reset-2fa
pnpm bkos:export       # JSONL backup
pnpm bkos:import
```

The `bkos:*` prefix is intentional — the scripts were namespaced to avoid collisions with pnpm built-ins (`pnpm setup`, `pnpm import`, etc.). See commit `233cf6d`.

## Architecture

**Nuxt 4 + Nitro, server-rendered.** Routes live under `apps/web/app/pages/` (Vue 3), API handlers under `apps/web/server/api/`. Two API surfaces:

- `apps/web/server/api/v1/*` — versioned public REST API. Accepts either the session cookie **or** `Authorization: Bearer bkos_*` API keys. Documented in `docs/api.md`.
- Everything else under `server/api/` — internal UI endpoints, cookie auth only.

**Shared server utilities are in `apps/web/server/utils/`.** Nitro auto-imports from here, so most handlers don't import explicitly. The most load-bearing files:

- `db.ts` — single `pg.Pool` singleton + `withTransaction(fn)` helper. Always use these, never `new pg.Client()`.
- `auth.ts` — HMAC-SHA256 signed session cookies (`bkos_session`, 14d). A module-scoped `minIatSeconds` rejects tokens minted before the last revocation; it's seeded from `auth_config` at boot and bumped on logout. **Don't add per-request DB lookups for session validity** — that revocation checkpoint is the whole reason it's sync-readable.
- `api-keys.ts` — `bkos_<prefix>_<secret>` format, scrypt-hashed at rest; verified in `auth.ts`.
- `extractor.ts`, `embedding.ts` — pluggable providers (`openrouter | ollama | placeholder` / `bge-m3 | openai | placeholder`). Placeholder is the default so the app boots without external services.
- `audit.ts`, `webhook-deliver.ts`, `action-reminder.ts`, `email-ingest.ts`, `suggest-links.ts` — each is paired with a scheduled task under `server/tasks/`.

**Scheduled tasks** are wired in `nuxt.config.ts → nitro.scheduledTasks` (uses `nitro.experimental.tasks`). They are safe no-ops when their required env vars are missing — adding a new task should preserve that property:

- `*/5 * * * *` `email:poll` — IMAP poll, no-op if `MAIL_HOST` unset
- `0 2 * * *` `suggestions:entities` — nightly entity-link suggestion recompute
- `0 7 * * *` `reminders:actions` — daily action digest email, no-op if `SMTP_HOST`/`BKOS_REMINDER_EMAIL` unset
- `*/1 * * * *` `webhook:retry` — drain pending webhook deliveries with backoff

**Server middleware** in `apps/web/server/middleware/` runs in filename order: `00.security-headers → 01.csrf-origin → 02.request-log → 03.onboarding`. The numeric prefix matters; preserve it when adding new middleware.

**Database.** Postgres + pgvector (`pgvector/pgvector:pg16`). Migrations are append-only SQL files in `infra/migrations/NNNN_name.sql`, applied in lexical order by both `scripts/migrate.mjs` (prod) and the testcontainer (`apps/web/test/setup/pg.ts`). Never edit a migration that has shipped — add the next number.

**Core types** are exported from `packages/core/src/index.ts` (`SourceType`, `EntityType`, `ActionStatus`, etc.). Import via `@bkos/core`. Same for `@bkos/ingest`, `@bkos/retrieval`. These three packages are *not* built — Nitro inlines them, so changes are picked up immediately.

## Testing

Vitest with the **forks pool, single fork** (`vitest.config.ts`) — integration suites share one Postgres testcontainer because spinning 16 at once melts laptops. The contract:

- `apps/web/test/setup/pg.ts` exposes `startTestPg()` (call in `beforeAll`, `ctx.stop()` in `afterAll`) and `withTx(ctx, fn)` to run a case inside a `BEGIN/ROLLBACK` so cases don't leak.
- `apps/web/test/utils/**` — pure unit tests, **no Docker needed**.
- `apps/web/test/db/**`, `apps/web/test/http/**` — integration, **Docker required**.

Every new endpoint, util, or scheduled task ships with a Vitest spec covering at least one happy path and one explicit failure mode (per `docs/contributing.md`).

## Conventions

- **UI: no emojis.** Use Heroicons (`@heroicons/vue/24/outline`) everywhere, including mockups. This is enforced in review.
- **i18n:** UI strings go in `apps/web/i18n/en.json` + `de.json`. The `i18n-bundles.test.ts` test verifies parity — both files must have the same keys.
- **Runtime config:** all env reads go through `useRuntimeConfig()` (declared in `nuxt.config.ts`). Don't read `process.env` directly in app code. `nuxt.config.ts` loads the repo-root `.env` eagerly because Nuxt's `--dotenv` flag is unreliable, and dotenv-expand is deliberately disabled (scrypt hashes contain literal `$1`/`$8` segments).
- **Worktree PRs:** roadmap batches land as worktree branches that get merged into `main` (see recent merge commits). The changelog at `docs/changelog.md` is the running human log.

## UI styleguide (Tailwind v4)

This is how the team (Adam, Jonathan, David, Steve) wants the UI written. Treat it as the contract for every Vue file you touch.

### The baseline

- **Tailwind v4 with CSS-first config.** `apps/web/app/assets/css/app.css` starts with `@import "tailwindcss";`. All design tokens live in a single `@theme` block in that file — no `tailwind.config.{js,ts}`. New colours, spacing, radii, shadows, fonts go there. They become utilities automatically (`bg-surface-1`, `text-muted`, `rounded-card`, etc.).
- **Utilities in markup, not class soups in CSS.** The current `app.css` is ~4,400 lines of BEM (`.app-sidebar-nav-item`, `.login-shell`, `.entity-eyebrow`, …). That is debt. When you touch a component, port its rules into utilities on the template and delete the corresponding CSS block. Don't add new BEM-style class names.
- **Tokens map to Tailwind utilities, not raw `var(--…)`.** The legacy `--bg`, `--panel`, `--accent`, `--text-soft` … are exposed via `@theme` so you write `bg-surface-1` / `text-muted` / `border-subtle`, never `style="background: var(--surface-1)"` and never new bespoke CSS variables. If a token is missing, add it to `@theme` once.
- **`@apply` is a last resort.** Use it only for: (a) third-party HTML you don't control (markdown render output, generated form widgets), or (b) a genuinely repeated primitive that Headless UI can't express. Don't `@apply` to recreate a button — make a Vue component.

### Design tokens

The names below are stable. Always prefer the semantic token over a raw palette colour (`bg-surface-1`, not `bg-white`; `text-muted`, not `text-slate-500`). Light/dark variants are wired through `data-theme="dark"` on `<html>` (set by `useTheme.ts`).

**Surface / background**
- `bg-app` — page background (`--bg`)
- `bg-surface-1` — panels, cards, popovers, sidebar (`--panel` / `--surface-1`)
- `bg-surface-2` — nested or alternating rows (`--surface-2`)
- `bg-surface-3` — hover / pressed surface (`--surface-3`)
- `bg-soft` — quiet fill behind tags, kbd, eyebrows (`--soft`)

**Text**
- `text-strong` — display + page title (`--text-strong`)
- `text-default` — body (`--text`) — set on `<body>`, rarely written
- `text-soft` — labels, secondary copy (`--text-soft`)
- `text-muted` / `text-muted-soft` — metadata, helper, disabled

**Border**
- `border-subtle` — internal dividers
- `border-default` — cards, inputs at rest
- `border-strong` — input hover, focused dropdowns

**Accent + status**
- `text-accent` / `bg-accent` / `border-accent` (+ `accent-strong`, `accent-soft`, `accent-fg`)
- `text-success` / `bg-success-soft` (and the same shape for `warning`, `danger`)

**Radii + shadows**
- `rounded-card` (8px) for cards / panels; `rounded-md` (6px) for inputs / buttons; `rounded-full` for pills + avatars
- `shadow-card` (`--shadow-1`) at rest, `shadow-popover` (`--shadow-2`) for overlays — never use Tailwind's default `shadow-sm/md` here

### Type scale

We use **Inter** (already on `<body>`) at the default 14px base. There are exactly four sizes in product UI:

| Use | Class |
| --- | --- |
| Page title (H1) | `text-xl font-semibold tracking-tight text-strong` |
| Section title (H2) | `text-sm font-semibold text-strong` |
| Body | `text-sm text-default` |
| Meta / helper | `text-xs text-muted` |

Eyebrows above titles: `text-xs font-medium uppercase tracking-wider text-muted`.

### Spacing + layout

- The 4/8px grid: `gap-1` (4), `gap-2` (8), `gap-3` (12), `gap-4` (16), `gap-6` (24), `gap-8` (32). Don't reach for `gap-5` / `gap-7`.
- Page shell: `<div class="grid min-h-screen grid-cols-[220px_minmax(0,1fr)]">`. The 220px sidebar column is the only fixed-width region.
- Page content padding: `px-6 py-6` on the `<main>`, `max-w-5xl` for content-heavy pages (search, documents). Wide tables go full-bleed.
- Vertical rhythm inside a panel: `space-y-4`. Between sections of a page: `space-y-6` to `space-y-8`.

### Component patterns

We model components on **Tailwind Plus / Catalyst**. Keep variants as props, never as parent-supplied class strings. State comes from `data-*` attributes (set by Headless UI) so styling stays declarative — no `:hover {}` rules in CSS, no `v-if` ladders that swap class names.

**Button** (`app/components/ui/Button.vue` — to be created)
```vue
<!-- variant: primary | secondary | ghost | danger ;  size: sm | md -->
<button
  class="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium
         transition-colors focus-visible:outline-2 focus-visible:outline-offset-2
         focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60
         data-[variant=primary]:bg-accent data-[variant=primary]:text-accent-fg
         data-[variant=primary]:hover:bg-accent-strong
         data-[variant=secondary]:bg-surface-1 data-[variant=secondary]:text-default
         data-[variant=secondary]:border data-[variant=secondary]:border-default
         data-[variant=secondary]:hover:bg-surface-3
         data-[variant=ghost]:text-soft data-[variant=ghost]:hover:bg-surface-3
         data-[variant=danger]:bg-danger data-[variant=danger]:text-white
         data-[size=sm]:h-8 data-[size=sm]:px-3
         data-[size=md]:h-9 data-[size=md]:px-4"
  :data-variant="variant" :data-size="size"
>
  <slot />
</button>
```

**Input / Textarea / Select** (`Input.vue`, `Textarea.vue`, `Select.vue`)
- Shared classes: `block w-full rounded-md border border-strong bg-surface-1 px-3 py-2 text-sm text-default placeholder:text-muted-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60`
- Wrap with `<Field>` that owns label + hint + error. Required marker is a `<span aria-hidden="true" class="text-danger">*</span>` after the label text.

**Card / Panel**
`bg-surface-1 border border-default rounded-card shadow-card`. Header row: `flex items-center justify-between gap-3 border-b border-subtle px-4 py-3`. Body: `p-4`. No third level of nesting inside a card.

**Dialogs, menus, comboboxes** → always Headless UI (`@headlessui/vue` is installed). Don't roll your own focus trap. The overlay is `bg-slate-900/40 backdrop-blur-sm`, the panel `bg-surface-1 rounded-card shadow-popover ring-1 ring-default`.

**Icons** → `@heroicons/vue/24/outline`, sized with `size-4` (inline with text) or `size-5` (button-leading). Set `aria-hidden="true"` unless the icon is the only label. No emojis anywhere — including in mockups, screenshots, and copy.

**Badges / pills**
`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium`. Status colour goes on the badge: `bg-success-soft text-success`, `bg-warning-soft text-warning`, `bg-danger-soft text-danger`, `bg-accent-soft text-accent`.

**Tables**
`min-w-full text-sm`. Header: `text-xs font-medium uppercase tracking-wider text-muted text-left`. Row hover: `hover:bg-surface-2`. Borders: `divide-y divide-subtle`. Don't striped-row, don't add vertical borders.

### Dark mode

Tokens already invert through `:root[data-theme="dark"]` in `app.css`. **Do not write `dark:` variants** on individual utilities — that's how the two themes drift apart. If the only way to express the design is `dark:`, the missing piece is a semantic token; add it to `@theme` and the dark `:root` block together.

### Accessibility (non-negotiable)

- Every interactive element has a visible focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`. Don't remove it.
- Icon-only buttons need `aria-label`; decorative icons need `aria-hidden="true"`.
- Form errors are linked via `aria-describedby`. Loading buttons use `aria-busy="true"` and stay focusable.
- Hit area minimum: 36×36 on desktop, 44×44 on touch. `size-*` icons inside don't count toward the hit area — pad the button.

### What "applying the styleguide" means in practice

When you touch a Vue file:
1. Replace its semantic class names with Tailwind utilities reading from the tokens above.
2. Delete the matching block from `app/assets/css/app.css`. Don't leave both wired up.
3. If you create something that looks like a Button / Input / Card / Badge / Dialog, use (or create) the component in `app/components/ui/` — don't inline a fifth variant of a button on a page.
4. Run `pnpm dev` and verify both `data-theme="light"` and `data-theme="dark"` before opening the PR. Token drift is the failure mode we care about most.

Migrating the whole stylesheet at once is not the goal — incremental conversion per touched view is. The destination is: `app.css` contains `@import "tailwindcss"`, the `@theme` block, the `:root` light/dark token blocks, and almost nothing else.

## Docs index

- `docs/roadmap-v1.md` — sprint / batch plan
- `docs/api.md` — public REST API
- `docs/security.md` — threat model, recovery scenarios
- `docs/deployment.md` — prod compose + zero-trust topologies
- `docs/adr/` — architecture decisions
