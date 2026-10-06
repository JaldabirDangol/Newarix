import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// One user walks through the whole app, so the tests share a page and run in order.
test.describe.configure({ mode: 'serial' })

const email = `e2e-${Date.now()}@example.com`
const username = `e2e${String(Date.now()).slice(-8)}`
const password = 'correct-horse-battery'

let page: Page
const consoleErrors: string[] = []

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  page.on('console', (m) => {
    // The not-found test loads a 404 page on purpose.
    if (m.type() === 'error' && !m.text().includes('404'))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
})

test.afterAll(async () => {
  await page.close()
})

const idle = () =>
  page.waitForFunction(() => !document.querySelector('[aria-busy=true]'))

test('home renders for visitors', async () => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Popular this season' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Create an account' }),
  ).toBeVisible()
})

test('private pages redirect to login', async () => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
})

test('signup validates, then creates the account', async () => {
  await page.goto('/signup')
  await page.fill('#email', email)
  await page.fill('#username', username)
  await page.fill('#password', 'short')
  await page.click('button[type=submit]')
  await expect(page.getByRole('alert')).toContainText('at least 8 characters')

  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible()
})

test('track an anime from its detail page', async () => {
  await page.goto('/anime/2')
  await expect(page.getByRole('heading', { name: 'Characters' })).toBeVisible()
  await page.getByRole('button', { name: 'Start watching' }).click()

  const add = page.getByRole('button', { name: 'Add one episode' })
  for (let i = 0; i < 5; i++) {
    await add.click()
    await idle()
  }
  await page.getByRole('button', { name: 'Remove one episode' }).click()
  await idle()
  await page.getByRole('button', { name: 'Score 8 out of 10' }).click()
  await idle()
  await page.getByRole('button', { name: 'Add to favorites' }).click()
  await expect(
    page.getByRole('button', { name: 'Remove from favorites' }),
  ).toBeVisible()
  await page.fill('#entry-notes', 'Rewatch the finale')
  await page.getByRole('button', { name: 'Save notes' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page.getByLabel('episode progress')).toHaveValue('4')

  await page.reload()
  await expect(page.getByLabel('episode progress')).toHaveValue('4')
  await expect(page.locator('#entry-notes')).toHaveValue('Rewatch the finale')
})

test('reaching the last episode completes the show', async () => {
  await page.goto('/anime/1') // 13 episodes in the mock
  await page.getByRole('button', { name: 'Add to list' }).click()
  const progress = page.getByLabel('episode progress')
  await progress.fill('13')
  await progress.press('Enter')
  await expect(page.getByRole('combobox').last()).toHaveValue('completed')
})

test('manga tracks chapters and volumes', async () => {
  await page.goto('/manga/3')
  await page.getByRole('button', { name: 'Start reading' }).click()
  await page.getByRole('button', { name: 'Add one chapter' }).click()
  await idle()
  await page.getByRole('button', { name: 'Add one volume' }).click()
  await idle()
  await expect(page.getByLabel('volume progress')).toHaveValue('1')
})

test('continue watching +1 from the home page', async () => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Continue watching' }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Mark episode 5 of/ }).click()
  await expect(
    page.getByRole('button', { name: /Mark episode 6 of/ }),
  ).toBeVisible()
})

test('my list shows entries by status', async () => {
  await page.goto('/list?kind=anime')
  await expect(page.getByRole('link', { name: /Watching\s*1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Completed\s*1/ })).toBeVisible()
})

test('history has one event per episode, without the undone one', async () => {
  await page.goto('/history')
  await expect(page.getByText('Watched episode 5 of')).toHaveCount(1)
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Filter history' })
    .getByRole('link', { name: 'Manga' })
    .click()
  await expect(page.getByText('Read chapter 1 of')).toBeVisible()
  await expect(page.getByText('Watched episode')).toHaveCount(0)
})

test('profile shows stats and favorites', async () => {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: username })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Top genres' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'anime stats' })).toContainText(
    '18',
  ) // 5 + 13 episodes
  await expect(
    page.getByRole('region', { name: 'Favorites' }).getByRole('link'),
  ).toHaveCount(1)
})

test('search: debounced query, genre filter, empty state', async () => {
  await page.goto('/search')
  await page.fill('#search-q', 'kaiju')
  await expect(page).toHaveURL(/q=kaiju/)
  await page.getByRole('button', { name: 'Action', exact: true }).click()
  await expect(page).toHaveURL(/genres=/)
  await expect(
    page.getByRole('button', { name: 'Action', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.fill('#search-q', 'zzzz')
  await expect(page.getByText(/No anime matches/)).toBeVisible()
})

test('navbar quick search supports the keyboard', async () => {
  await page.goto('/anime')
  const box = page
    .getByRole('combobox', { name: 'Search anime and manga' })
    .first()
  await box.fill('night')
  await expect(page.getByRole('option').first()).toBeVisible()
  await box.press('ArrowDown')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/anime\/\d+$/)
})

test('top lists, schedule and not-found', async () => {
  await page.goto('/anime?filter=airing&page=2')
  await expect(page.getByText('Page 2 of')).toBeVisible()
  await page.goto('/schedule?day=saturday')
  await expect(
    page
      .getByRole('navigation', { name: 'Day of week' })
      .locator('[aria-current=page]'),
  ).toHaveText(/saturday/i)
  await page.goto('/anime/99999999')
  await expect(page.getByText("This page doesn't exist")).toBeVisible()
})

test('episodes tab pages through a long series', async () => {
  await page.goto('/anime/5') // 220 episodes in the mock
  await expect(page.getByText('Episode title 1', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Episode pages' }).getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Episode title 101', { exact: true })).toBeVisible()
})

test('light mode persists across reloads', async () => {
  await page.goto('/anime/2')
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
})

test('mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/anime/2', '/search', '/profile']) {
    await page.goto(path)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow, `overflow on ${path}`).toBe(false)
  }
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.locator('#mobile-nav')).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
})

test('logout, wrong password, then log back in', async () => {
  await page.goto('/')
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()

  await page.goto('/profile')
  await page.fill('#email', email)
  await page.fill('#password', 'wrong-password')
  await page.click('button[type=submit]')
  await expect(page.getByRole('alert')).toContainText(
    'Email or password is incorrect',
  )
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await expect(page).toHaveURL(/\/profile$/)
})

test('no script or CSP errors in the browser console', () => {
  expect(consoleErrors).toEqual([])
})

test.describe('security', () => {
  test('pages send security headers and a nonce-based CSP', async ({
    request,
  }) => {
    const res = await request.get('/login')
    const headers = res.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    const csp = headers['content-security-policy']
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    expect(nonce).toBeTruthy()
    const html = await res.text()
    expect(html).toContain(`property="csp-nonce" content="${nonce}"`)
  })

  test('cross-site POSTs to server functions are rejected', async ({
    request,
  }) => {
    const res = await request.post('/_serverFn/anything', {
      headers: {
        'Sec-Fetch-Site': 'cross-site',
        'Content-Type': 'application/json',
      },
      data: '{}',
    })
    expect(res.status()).toBe(403)
  })

  test('cross-site page navigations still work', async ({ request }) => {
    const res = await request.get('/', {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    })
    expect(res.status()).toBe(200)
  })
})
