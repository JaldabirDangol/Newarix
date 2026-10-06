import { expect, test } from '@playwright/test'
import sharp from 'sharp'

test('verification, quick editing, gallery, avatar upload and password recovery', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const suffix = String(Date.now()).slice(-9)
  const email = `features-${suffix}@example.com`
  const username = `features${suffix}`
  const password = 'initial-password-123'
  const nextPassword = 'new-password-456'
  await page.goto('/signup')
  await page.fill('#email', email)
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/')
  const mail = await (await page.request.get(`http://localhost:4545/__mail?email=${encodeURIComponent(email)}`)).json() as { subject: string; text: string }[]
  const verification = mail.find((m) => m.subject.includes('Verify'))!.text.match(/http:\/\/localhost:3100\/verify-email\?token=[\w-]+/)![0]
  await page.goto(verification)
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Your email is verified')
  await page.goto(verification)
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already used')

  await page.goto('/anime/2')
  await page.getByRole('button', { name: 'Add to list', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toBeVisible()
  await expect(page.getByText('Episode title 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Recommended by 50 AniList users')).toBeVisible()
  await page.getByRole('tab', { name: 'pictures', exact: true }).click()
  await page.getByRole('button', { name: /Open picture 1 of/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()

  await page.goto('/list?kind=anime')
  await page.getByRole('button', { name: /Quick edit/ }).click()
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('current')
  await page.getByRole('combobox', { name: 'Your score', exact: true }).selectOption('9')
  await page.getByLabel('Episodes', { exact: true }).fill('3')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: /Quick edit/ })).toBeVisible()
  await page.goto('/anime')
  await expect(page.getByRole('link').filter({ hasText: 'Blue Lantern' }).filter({ hasText: 'Watching' }).first()).toBeVisible()
  await page.goto('/search?kind=anime')
  await expect(page.getByRole('link').filter({ hasText: 'Blue Lantern' }).filter({ hasText: 'Watching' }).first()).toBeVisible()

  await page.goto('/profile')
  await expect(page.getByText(`Email verified · ${email}`)).toBeVisible()
  await page.getByRole('button', { name: 'Edit profile' }).click()
  const upload = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffd84d' } }).png().toBuffer()
  await page.getByLabel('Upload avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: upload })
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible()
  const avatar = page.locator('header img[src*="/api/avatar/"]').last()
  await expect(avatar).toBeVisible()
  const avatarUrl = (await avatar.getAttribute('src'))!
  const avatarResponse = await page.request.get(avatarUrl)
  expect(avatarResponse.headers()['content-type']).toBe('image/webp')
  expect(await sharp(await avatarResponse.body()).metadata()).toMatchObject({ width: 256, height: 256 })

  const oldContext = await browser.newContext({ storageState: await page.context().storageState() })
  const oldPage = await oldContext.newPage()
  await oldPage.goto('/profile')
  await expect(oldPage.getByRole('heading', { name: username })).toBeVisible()
  await page.goto('/forgot-password')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If an account exists')
  const resetMail = await (await page.request.get(`http://localhost:4545/__mail?email=${encodeURIComponent(email)}`)).json() as { subject: string; text: string }[]
  const link = resetMail.find((m) => m.subject.includes('Reset'))!.text.match(/http:\/\/localhost:3100\/reset-password\?token=[\w-]+/)![0]
  await page.goto(link)
  await page.getByLabel('New password', { exact: true }).fill(nextPassword)
  await page.getByLabel('Confirm password', { exact: true }).fill(nextPassword)
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('all previous sessions have ended')
  await oldPage.reload()
  await expect(oldPage).toHaveURL(/\/login/)
  await oldContext.close()
  await page.goto(link)
  await page.getByLabel('New password', { exact: true }).fill(nextPassword)
  await page.getByLabel('Confirm password', { exact: true }).fill(nextPassword)
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already used')
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', nextPassword)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('catalog outages return 503 and image proxy rejects arbitrary URLs', async ({ request }) => {
  test.setTimeout(45_000)
  const response = await request.get('/anime/99998')
  expect(response.status()).toBe(503)
  expect(response.headers()['retry-after']).toBe('60')
  expect(await response.text()).toContain("This page couldn")
  for (const url of ['http://127.0.0.1:15434', 'https://example.com/image.png', 'https://cdn.myanimelist.net.evil.example/images/anime.png', 'https://cdn.myanimelist.net/other.png']) {
    expect((await request.get(`/api/img?${new URLSearchParams({ url, w: '320' })}`)).status()).toBe(400)
  }
  expect((await request.get('/api/img?url=https://cdn.myanimelist.net/images/anime/a.jpg&w=99999')).status()).toBe(400)
})

test('Google login uses state, nonce and PKCE and rejects invalid callbacks', async ({ request }) => {
  const response = await request.get('/api/auth/google', { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  const location = new URL(response.headers().location)
  expect(location.origin).toBe('https://accounts.google.com')
  expect(location.searchParams.get('scope')).toBe('openid email profile')
  expect(location.searchParams.get('state')).toBeTruthy()
  expect(location.searchParams.get('nonce')).toBeTruthy()
  expect(location.searchParams.get('code_challenge_method')).toBe('S256')
  expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:3100/api/auth/google/callback')
  const callback = await request.get('/api/auth/google/callback?state=invalid&code=fake', { maxRedirects: 0 })
  expect(callback.status()).toBe(303)
  expect(callback.headers().location).toBe('/login?error=google_failed')
})
