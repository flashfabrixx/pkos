# Multi-stage build for the BKOS Nuxt app.
# Run from the repo root: `docker build -f apps/web/Dockerfile -t bkos-web .`

# ---- deps ----
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages packages
RUN pnpm install --frozen-lockfile --filter @bkos/web... --filter "./packages/*"

# ---- builder ----
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY --from=deps /repo /repo
COPY . .
RUN pnpm --filter @bkos/web build

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    NUXT_HOST=0.0.0.0 \
    NUXT_PORT=3000 \
    LOG_LEVEL=info
RUN apk add --no-cache wget tini && \
    addgroup -S bkos && adduser -S bkos -G bkos
WORKDIR /app
COPY --from=builder --chown=bkos:bkos /repo/apps/web/.output ./
COPY --from=builder --chown=bkos:bkos /repo/infra/migrations /app/migrations
USER bkos
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1:3000/api/healthz || exit 1
CMD ["node", "server/index.mjs"]
