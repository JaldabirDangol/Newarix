import { and, eq, inArray, or } from 'drizzle-orm'
import { db, schema } from './db'
import { getSessionUser } from './auth/session'
import type { MediaCard } from '#/lib/media'

/** One lookup for the visible cards, regardless of how many posters render. */
export async function withListStatus(items: MediaCard[]): Promise<MediaCard[]> {
  const user = await getSessionUser()
  if (!user || !items.length) return items
  const anime = items.filter((m) => m.kind === 'anime').map((m) => m.id)
  const manga = items.filter((m) => m.kind === 'manga').map((m) => m.id)
  const e = schema.listEntries
  const rows = await db
    .select({ id: e.malId, kind: e.mediaType, status: e.status })
    .from(e)
    .where(
      and(
        eq(e.userId, user.id),
        or(
          anime.length
            ? and(eq(e.mediaType, 'anime'), inArray(e.malId, anime))
            : undefined,
          manga.length
            ? and(eq(e.mediaType, 'manga'), inArray(e.malId, manga))
            : undefined,
        ),
      ),
    )
  const statuses = new Map(rows.map((r) => [`${r.kind}:${r.id}`, r.status]))
  return items.map((m) => ({
    ...m,
    listStatus: statuses.get(`${m.kind}:${m.id}`) ?? null,
  }))
}
