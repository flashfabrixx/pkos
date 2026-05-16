import { defineConfig } from 'vitest/config'

export default defineConfig({
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
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: [
        'apps/web/server/**/*.ts',
        'packages/*/src/**/*.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/test/**'
      ]
    }
  }
})
