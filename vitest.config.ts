import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./apps/web/app', import.meta.url))
    }
  },
  test: {
    // Each suite spins up a Postgres testcontainer; serialize them so we
    // don't churn through 16+ containers at once on developer machines.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    },
    include: [
      'apps/web/test/**/*.test.ts',
      'packages/*/test/**/*.test.ts'
    ],
    // Component specs under apps/web/test/ui/ run in happy-dom via the
    // `// @vitest-environment happy-dom` file pragma. Everything else
    // (server utils + db integration) stays in the default node env.
    // (vitest 4 removed environmentMatchGlobs; pragmas are the
    // pool-agnostic replacement.)
    testTimeout: 60_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      include: [
        'apps/web/server/**/*.ts',
        'apps/web/app/components/ui/**/*.vue',
        'packages/*/src/**/*.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/test/**'
      ]
    }
  }
})
