import { defineConfig } from 'vitest/config'

const TEST_DB = 'postgres://newarix:newarix@localhost:15434/newarix_test'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      ...(process.env.JIKAN_LIVE ? ['tests/live/**/*.test.ts'] : []),
    ],
    globalSetup: ['tests/global-setup.ts'],
    // Integration tests share one database.
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? TEST_DB,
      JWT_SECRET: 'test-secret-that-is-long-enough-for-production-checks',
      // Unit tests use the in-memory store; Redis tests connect explicitly.
      REDIS_URL: '',
    },
  },
})
