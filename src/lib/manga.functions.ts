import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { catalogMiddleware } from '#/server/anilist/middleware'
import {
  chapterFeed,
  loadChapter,
  matchManga,
  readerError,
} from '#/server/mangadex'

export const findReaderManga = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(
    z.object({
      malId: z.number().int().positive(),
      anilistId: z.number().int().positive().optional(),
      titles: z.array(z.string().max(300)).min(1).max(3),
    }),
  )
  .handler(({ data }) => matchManga(data.malId, data.titles, data.anilistId))

export const getReaderChapters = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(
    z.object({
      mangaId: z.uuid(),
      language: z.string().regex(/^[a-z]{2}(-[a-z]{2})?$/),
      offset: z.number().int().min(0).max(9900),
    }),
  )
  .handler(({ data }) => chapterFeed(data.mangaId, data.language, data.offset))

export const getReaderChapter = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(
    z.object({
      mangaId: z.uuid(),
      chapterId: z.uuid(),
      fresh: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const reading = await loadChapter(
        data.mangaId,
        data.chapterId,
        data.fresh,
      )
      return {
        ok: true as const,
        chapter: reading.chapter,
        images: reading.images.map(
          (_, page) =>
            `/api/manga/page?${new URLSearchParams({ mangaId: data.mangaId, chapterId: data.chapterId, page: String(page) })}`,
        ),
      }
    } catch (error) {
      return { ok: false as const, error: readerError(error) }
    }
  })
