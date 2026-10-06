import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'
import { tooManyAttempts } from '#/server/auth/rate-limit'
import { WorkLimit } from '#/server/concurrency'
import { loadChapterPage, readerError } from '#/server/mangadex'

const work = new WorkLimit(6)
const input = z.object({
  mangaId: z.uuid(),
  chapterId: z.uuid(),
  page: z.coerce.number().int().min(0).max(999),
})

export const Route = createFileRoute('/api/manga/page')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = input.safeParse(
          Object.fromEntries(new URL(request.url).searchParams),
        )
        if (!parsed.success)
          return new Response('Invalid manga page request', { status: 400 })
        if (
          await tooManyAttempts(
            `manga-pages:${getRequestIP() ?? 'unknown'}`,
            180,
            60_000,
          )
        )
          return new Response('Too many page requests. Try again shortly.', {
            status: 429,
            headers: { 'Retry-After': '60' },
          })
        try {
          const { mangaId, chapterId, page } = parsed.data
          const image = await work.run(() =>
            loadChapterPage(mangaId, chapterId, page),
          )
          return new Response(new Uint8Array(image.bytes), {
            headers: {
              'Content-Type': image.type,
              'Cache-Control': 'private, max-age=60',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        } catch (error) {
          return new Response(readerError(error), {
            status: 502,
            headers: { 'Cache-Control': 'no-store' },
          })
        }
      },
    },
  },
})
