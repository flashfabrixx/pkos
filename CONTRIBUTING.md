# Contributing to PKOS

Thanks for taking the time to consider contributing. PKOS is a
single-user, self-hosted Private Knowledge OS — small, focused, and
maintained at the pace of one person plus contributors. The bar for
"yes" on a PR is high but the process is friendly.

## Before you start

- **Bug?** [Open an issue](https://github.com/flashfabrixx/pkos/issues/new/choose)
  with the bug template. Don't send a PR without an issue unless the
  fix is one obvious line — we'd rather agree on the diagnosis first.
- **Feature?** [Discussions](https://github.com/flashfabrixx/pkos/discussions)
  is the better place to float an idea. Things that fit PKOS's
  positioning (single-user, self-hosted, your-data) get a fast "yes";
  multi-tenant SaaS shapes get a fast "no". Save yourself the cycles.
- **Security?** Don't open an issue — see
  [`SECURITY.md`](./SECURITY.md).
- **Big refactor?** Open an issue describing the *why* first. Drive-by
  rewrites get closed with thanks.

## Local setup

```bash
git clone https://github.com/flashfabrixx/pkos.git
cd pkos
pnpm install
cp .env.example .env
# fill in PKOS_PASSWORD_HASH, SESSION_SECRET, POSTGRES_PASSWORD …
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

You'll need:

- Node 22 (matches `engines.node` and CI)
- pnpm 10.9 (matches `packageManager` and CI)
- Docker (for Postgres + the integration test container)

See [`docs/contributing.md`](docs/contributing.md) for the deeper guide
and [`CLAUDE.md`](CLAUDE.md) for the codebase architecture overview —
the latter is what gives a new contributor the lay of the land in one
read.

## Workflow

1. Fork + branch from `main`. Branch names: `fix/short-description`,
   `feat/short-description`, `docs/…`, `chore/…`.
2. Keep PRs **small and focused**. One concern per PR. A 300-line
   "fix the bug and refactor a bit and rename some things" PR gets
   asked to split. A 30-line PR gets reviewed today.
3. Match existing patterns. PKOS uses opinionated conventions
   (Tailwind utility-first, no `dark:` variants, Heroicons only, no
   emojis, ui/* primitives for variants). Before adding new patterns,
   check `CLAUDE.md` and grep for what already exists.
4. Every new endpoint, util or scheduled task ships with a Vitest spec
   that covers at least one happy path and one explicit failure mode.
5. Pass CI locally before pushing:

   ```bash
   pnpm typecheck    # vue-tsc via nuxt typecheck
   pnpm build        # production bundle
   pnpm test         # vitest run (needs Docker)
   ```

6. Open the PR using the template. Screenshots for UI changes (light
   *and* dark mode — PKOS dark mode flows through tokens, not `dark:`
   variants).

## Commit + PR conventions

- Conventional Commits prefixes: `feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `test:`, `perf:`. One scope per commit when it's
  obvious (`fix(auth): …`, `feat(ui): …`).
- Squash on merge by default; preserve commit chain if the PR was
  deliberately staged (the `feat(ui): phase 0 … phase 6` migration was
  one such case).
- DCO sign-off is not required for now. Apache 2.0 contributions stay
  inbound under the same license as the project.

## What I look for in review

- **Does it match the convention?** No emojis. No new BEM in CSS.
  Tailwind utilities via tokens. Headless UI for any popover/dialog.
- **Does it preserve dark mode through tokens?** If you reach for
  `dark:` you've usually missed a missing semantic token.
- **Does it ship with a test that would fail without the fix?**
- **Is the commit message clear about *why*?** "what" is in the diff.
- **Did you delete more code than you added?** Bonus points; PKOS is
  meant to stay small.

## Becoming a maintainer

There isn't a process — yet. If you keep landing thoughtful PRs and
help triage issues, I'll ask. The bar is "I trust this person to
say no on my behalf."

## License

PKOS is Apache License 2.0. By contributing, you agree your
contributions are licensed under the same.

---

For the deeper hands-on guide (test layout, debugging tips,
codebase tour), see [`docs/contributing.md`](docs/contributing.md).
