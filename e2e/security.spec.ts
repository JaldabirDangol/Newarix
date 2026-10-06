import { expect, test } from '@playwright/test'

test('private pages and RPC errors cannot be cached or leak recovery tokens through referrers', async ({
  request,
}) => {
  for (const path of [
    '/login',
    '/reset-password?token=synthetic-test-token',
    '/_serverFn/missing',
  ]) {
    const response = await request.get(path)
    expect(response.headers()['cache-control']).toContain('no-store')
    expect(response.headers()['referrer-policy']).toBe('no-referrer')
  }
})

test('CSRF rejects foreign origins and requests without origin metadata', async ({
  request,
}) => {
  const cases: Record<string, string>[] = [
    { Origin: 'https://foreign.example' },
    {},
    { 'Sec-Fetch-Site': 'same-site' },
  ]
  for (const headers of cases) {
    const response = await request.post('/_serverFn/missing', {
      headers,
      data: '{}',
    })
    expect(response.status()).toBe(403)
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
  }
})

test('built server enforces body size and encoding before RPC parsing', async ({
  request,
}) => {
  const oversized = await request.post('/_serverFn/missing', {
    headers: { Origin: 'http://localhost:3100' },
    data: Buffer.alloc(6 * 1024 * 1024 + 1),
  })
  expect(oversized.status()).toBe(413)
  const compressed = await request.post('/_serverFn/missing', {
    headers: { Origin: 'http://localhost:3100', 'Content-Encoding': 'gzip' },
    data: 'small',
  })
  expect(compressed.status()).toBe(415)
})

test('image proxy rejects internal and non-allowlisted sources without fetching them', async ({
  request,
}) => {
  for (const source of [
    'http://127.0.0.1/',
    'https://169.254.169.254/',
    'https://cdn.myanimelist.net.evil.example/images/1.jpg',
    'https://s4.anilist.co/other/test.jpg',
  ]) {
    expect(
      (
        await request.get(`/api/img?${new URLSearchParams({ url: source })}`)
      ).status(),
    ).toBe(400)
  }
})
