import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const MOCK_PORT = 4545
const E2E_DB =
  process.env.E2E_DATABASE_URL ??
  'postgres://newarix:newarix@localhost:15434/newarix_e2e'
const E2E_REDIS = process.env.E2E_REDIS_URL ?? 'redis://localhost:16379/14'

/**
 * End-to-end tests run against the production build (so CSP and CSRF are
 * exercised) with a mock AniList. Needs the docker-compose Postgres and Redis.
 * Uses system Chrome when PW_CHANNEL=chrome; otherwise `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL ?? 'chromium',
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-anilist.mjs',
      port: MOCK_PORT,
      env: { MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && node .output/server/index.mjs',
      url: `http://localhost:${PORT}`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(PORT),
        NODE_ENV: 'production',
        DATABASE_URL: E2E_DB,
        REDIS_URL: E2E_REDIS,
        JWT_SECRET: 'e2e-secret-that-is-long-enough-for-production-checks',
        ANILIST_URL: `http://localhost:${MOCK_PORT}/graphql`,
        MANGADEX_API_URL: `http://localhost:${MOCK_PORT}/mangadex`,
        APP_URL: `http://localhost:${PORT}`,
        RESEND_API_KEY: 'test-email-key',
        EMAIL_FROM: 'Newarix <test@example.com>',
        EMAIL_API_URL: `http://localhost:${MOCK_PORT}/emails`,
        GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'test-secret',
      },
    },
  ],
})
