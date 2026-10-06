import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import type { BrowserContext } from '@playwright/test'

let signedIn: Awaited<ReturnType<BrowserContext['storageState']>>
const findings: Record<string, unknown>[] = []
const publicPages = ['/', '/anime', '/manga', '/search', '/schedule', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/anime/2', '/manga/3', '/anime/99999999']
const privatePages = ['/list', '/history', '/profile']

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/signup')
  const suffix = String(Date.now()).slice(-9)
  await page.fill('#email', `audit-${suffix}@example.com`)
  await page.fill('#username', `audit${suffix}`)
  await page.fill('#password', 'audit-password-123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/anime/2')
  await page.getByRole('button', { name: 'Start watching' }).click()
  await page.getByRole('button', { name: 'Add one episode' }).click()
  await expect(page.getByLabel('episode progress')).toHaveValue('1')
  await page.getByRole('button', { name: 'Score 8 out of 10' }).click()
  await expect(page.getByRole('button', { name: 'Score 8 out of 10' })).toHaveAttribute('aria-pressed', 'true')
  signedIn = await context.storageState()
  await context.close()
})

test.afterAll(async () => {
  if (!findings.length) return
  await mkdir('docs', { recursive: true })
  await writeFile('docs/accessibility-results.json', JSON.stringify({ date: new Date().toISOString(), engine: 'axe-core', tags: ['wcag2a', 'wcag2aa', 'wcag21aa'], checks: findings }, null, 2))
})

for (const theme of ['dark', 'light'] as const) {
  for (const path of [...publicPages, ...privatePages]) {
    test(`axe ${theme} ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: privatePages.includes(path) ? signedIn : undefined, reducedMotion: 'reduce', viewport: { width: theme === 'dark' ? 1280 : 390, height: 844 } })
      await context.addCookies([{ name: 'nx_theme', value: theme, url: 'http://localhost:3100' }])
      const page = await context.newPage()
      await page.goto(path)
      await page.locator('main').waitFor()
      if (path === '/') await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      if (path === '/anime/2') await expect(page.getByText('Episode title 1', { exact: true })).toBeVisible()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      findings.push({ path, theme, viewport: page.viewportSize(), violations: results.violations, incomplete: results.incomplete.map((i) => ({ id: i.id, nodes: i.nodes.map((n) => n.target) })) })
      await context.close()
      expect(results.violations, `${theme} ${path}`).toEqual([])
    })
  }
}
