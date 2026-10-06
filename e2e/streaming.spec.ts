import { expect, test } from '@playwright/test'

test('episode playback stays embedded and supports selection, audio and recovery', async ({
  page,
}) => {
  const requests: string[] = []
  await page.route('https://megavid.buzz/**', async (route) => {
    requests.push(route.request().url())
    await route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Test episode player</body></html>',
    })
  })
  await page.goto('/anime/2')
  const player = page.getByRole('region', { name: 'Watch episodes' })
  const iframe = player.locator('iframe')
  await expect(
    player.getByRole('button', { name: 'Play episode 1' }),
  ).toBeVisible()
  expect(requests).toHaveLength(0)
  await page
    .getByRole('button', { name: 'Watch episode 3', exact: true })
    .click()
  await expect(iframe).toHaveAttribute('src', /megavid\.buzz\/mal\/2\/3\/sub\?/)
  await expect(iframe).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-presentation',
  )
  await expect(
    page
      .frameLocator('iframe[title*="Episode 3"]')
      .getByText('Test episode player'),
  ).toBeVisible()
  await player.getByLabel('Audio').selectOption('dub')
  await expect(iframe).toHaveAttribute('src', /\/3\/dub\?/)
  await player.getByRole('button', { name: 'Next episode' }).click()
  await expect(iframe).toHaveAttribute('src', /\/4\/dub\?/)
  await player
    .getByRole('spinbutton', { name: 'Episode', exact: true })
    .fill('1')
  await player.getByRole('button', { name: 'Go', exact: true }).click()
  await expect(iframe).toHaveAttribute('src', /\/1\/dub\?/)
  await expect(
    player.getByRole('button', { name: 'Previous episode' }),
  ).toBeDisabled()
  // Ignore forged playback messages from the parent or another origin.
  await page.evaluate(() =>
    window.postMessage({ channel: 'kisskh', event: 'error' }, '*'),
  )
  await expect(player.getByRole('status')).not.toContainText(
    'could not be played',
  )
  await page
    .frameLocator('iframe[title*="Episode 1"]')
    .locator('body')
    .evaluate(() => {
      window.parent.postMessage(
        JSON.stringify({ channel: 'kisskh', event: 'error' }),
        '*',
      )
    })
  await expect(player.getByRole('status')).toContainText('could not be played')
  await player.getByRole('button', { name: 'Reload player' }).click()
  await expect(iframe).toHaveAttribute('src', /refresh=1/)
  await player.getByRole('button', { name: 'Close player' }).click()
  await expect(iframe).toHaveCount(0)
  await expect(
    player.getByRole('button', { name: 'Play episode 1' }),
  ).toBeVisible()
})

test('player controls fit a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('https://megavid.buzz/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Player</body></html>',
    }),
  )
  await page.goto('/anime/2')
  await page.getByRole('button', { name: 'Play episode 1' }).click()
  await expect(page.locator('iframe[title*="Episode 1"]')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
