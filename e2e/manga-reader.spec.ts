import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
  'base64',
)

test('reader opens pages, credits translators, saves a bookmark, and fits mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/manga/2')
  const section = page.getByRole('region', { name: 'Read manga' })
  await section
    .getByRole('button', { name: 'Chapter 1 · Test chapter 1' })
    .click()
  const reader = page.getByRole('dialog')
  await expect(reader.getByRole('img')).toHaveAttribute('src', /page=0/)
  await reader
    .getByRole('button', { name: 'Next page', exact: true })
    .first()
    .click()
  await expect(reader.getByRole('img')).toHaveAttribute('src', /page=1/)
  await expect(
    reader.getByRole('link', { name: 'Reader test group' }),
  ).toBeVisible()
  await expect(
    reader.getByRole('button', { name: 'Next page', exact: true }).first(),
  ).toBeDisabled()
  expect(
    await reader.evaluate(
      (element) => element.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  const bounds = await reader.boundingBox()
  expect(bounds?.x).toBe(0)
  expect(bounds?.y).toBe(0)
  expect(bounds?.width).toBe(390)
  expect(bounds?.height).toBe(844)
  const a11y = await new AxeBuilder({ page })
    .include('dialog')
    .disableRules(['color-contrast'])
    .analyze()
  expect(a11y.violations).toEqual([])
  await page.screenshot({
    path: '/tmp/anime-manga-reader-mobile.png',
    fullPage: false,
  })
  await page.keyboard.press('Escape')
  await expect(reader).not.toBeVisible()
  await page.reload()
  await section
    .getByRole('button', { name: 'Continue reading · page 2' })
    .click()
  await expect(reader.getByRole('img')).toHaveAttribute('src', /page=1/)
  await reader
    .getByRole('button', { name: 'Next chapter', exact: true })
    .click()
  await expect(
    reader.getByText('Chapter 2 · Test chapter 2', { exact: true }),
  ).toBeVisible()
  await expect(reader.getByRole('img')).toHaveAttribute('src', /page=0/)
})

test('language empty states, pagination, and publisher-only chapters', async ({
  page,
}) => {
  await page.goto('/manga/2')
  const section = page.getByRole('region', { name: 'Read manga' })
  await section.getByLabel('Chapter language').selectOption('fr')
  await expect(
    section.getByText(/No readable chapters were found/),
  ).toBeVisible()
  await section.getByLabel('Chapter language').selectOption('en')
  await section.getByRole('button', { name: 'Load more chapters' }).click()
  await expect(
    section.getByRole('button', { name: 'Chapter 4 · Test chapter 4' }),
  ).toBeVisible()
  await section
    .getByRole('button', { name: 'Chapter 3 · Test chapter 3' })
    .click()
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Open reading site' }),
  ).toHaveAttribute('href', 'https://mangaplus.shueisha.co.jp/viewer/test')
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(0)
})

test('unmatched titles and failed page recovery', async ({ page }) => {
  await page.goto('/manga/3')
  await expect(page.getByText(/could not be matched on MangaDex/)).toBeVisible()
  let fail = true
  await page.route('**/api/manga/page?**', (route) =>
    fail
      ? route.abort()
      : route.fulfill({ contentType: 'image/png', body: png }),
  )
  await page.goto('/manga/2')
  await page.getByRole('button', { name: 'Chapter 1 · Test chapter 1' }).click()
  const reader = page.getByRole('dialog')
  await expect(reader.getByText(/This page could not load/)).toBeVisible()
  fail = false
  await reader.getByRole('button', { name: 'Refresh chapter' }).click()
  await expect(reader.getByRole('img')).toBeVisible()
  await expect(reader.getByRole('img')).toHaveJSProperty('complete', true)
  await expect(reader.getByRole('img')).toHaveJSProperty('naturalWidth', 1)
  await expect(reader.getByText(/This page could not load/)).toHaveCount(0)
})
