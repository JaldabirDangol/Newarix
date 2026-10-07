import { defineConfig } from '@playwright/test'

const port = 3101

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'image-routing.spec.ts',
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    channel: process.env.PW_CHANNEL ?? 'chromium',
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/api/manga/page`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
