import { expect, test } from '@playwright/test'

for (const [path, message] of [
  ['/api/manga/page', 'Invalid manga page request'],
  ['/api/img', 'Invalid image request'],
]) {
  test(`${path} reaches its handler for browser image requests`, async ({
    page,
  }) => {
    // Invalid input avoids external providers while identifying the API handler.
    await page.goto('/api/manga/page')
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === path,
    )
    await page.evaluate((src) => {
      const image = document.createElement('img')
      image.src = `${src}?routing-check=1`
      document.body.append(image)
    }, path)
    const response = await responsePromise
    expect(await response.request().headerValue('sec-fetch-dest')).toBe('image')
    expect(response.status()).toBe(400)
    expect(await response.text()).toBe(message)
  })
}
