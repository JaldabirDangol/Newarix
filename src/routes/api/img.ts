import { createFileRoute } from '@tanstack/react-router'
import { createHash } from 'node:crypto'
import { getRequestIP } from '@tanstack/react-start/server'
import { IMAGE_WIDTHS, posterUrl, resizedPoster } from '#/server/images'
import { tooManyAttempts } from '#/server/auth/rate-limit'

export const Route = createFileRoute('/api/img')({ server: { handlers: {
  GET: async ({ request }) => {
    const query = new URL(request.url).searchParams
    const width = Number(query.get('w') ?? 320)
    let source: URL
    try {
      if (!(IMAGE_WIDTHS as readonly number[]).includes(width)) throw new Error('Unsupported width')
      source = posterUrl(query.get('url') ?? '')
    } catch { return new Response('Invalid image request', { status: 400 }) }
    if (await tooManyAttempts(`image:${getRequestIP() ?? 'unknown'}`, 240, 60_000)) return new Response('Too many image requests', { status: 429, headers: { 'Retry-After': '60' } })
    try {
      const image = await resizedPoster(source, width)
      const etag = `"${createHash('sha256').update(image).digest('hex')}"`
      const headers = { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400', ETag: etag, 'X-Content-Type-Options': 'nosniff' }
      return request.headers.get('if-none-match') === etag ? new Response(null, { status: 304, headers }) : new Response(new Uint8Array(image), { headers })
    } catch { return new Response('Image unavailable', { status: 503, headers: { 'Retry-After': '60' } }) }
  },
} } })
