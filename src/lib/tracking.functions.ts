import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, avg, count, desc, eq, inArray, lt, sql, sum } from 'drizzle-orm'
import { db, schema } from '#/server/db'
import { authMiddleware } from '#/server/auth/middleware'
import { getSessionUser } from '#/server/auth/session'
import {
  applyEntryChange,
  loadSnapshot,
  recentHistory,
  recordPlayback,
  removeEntry,
} from '#/server/tracking'
import { CatalogError } from '#/server/anilist/client'
import type { Favorite, HistoryEntry, ListEntry } from '#/server/db/schema'

import { listStatuses } from './status'
import type { ListStatus } from './status'

const kind = z.enum(['anime', 'manga'])
const ref = z.object({ kind, id: z.number().int().positive() })

// Dates become ISO strings so loaders return plain JSON-friendly data.
export type EntryDTO = Omit<
  ListEntry,
  'userId' | 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'
> & {
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}
export type HistoryDTO = Omit<HistoryEntry, 'userId' | 'createdAt'> & {
  createdAt: string
}
export type FavoriteDTO = Omit<Favorite, 'userId' | 'createdAt'> & {
  createdAt: string
}

function entryDTO(e: ListEntry): EntryDTO {
  const { userId: _u, createdAt: _c, ...rest } = e
  return {
    ...rest,
    updatedAt: e.updatedAt.toISOString(),
    startedAt: e.startedAt?.toISOString() ?? null,
    completedAt: e.completedAt?.toISOString() ?? null,
  }
}

function historyDTO(h: HistoryEntry): HistoryDTO {
  const { userId: _u, ...rest } = h
  return { ...rest, createdAt: h.createdAt.toISOString() }
}

function favoriteDTO(f: Favorite): FavoriteDTO {
  const { userId: _u, ...rest } = f
  return { ...rest, createdAt: f.createdAt.toISOString() }
}

function catalogFailure(err: unknown): never {
  if (err instanceof CatalogError) {
    throw new Error(
      'Could not load this title from the anime database. Try again shortly.',
    )
  }
  throw err
}

/** Entry + favorite state for a detail page. Works logged out. */
export const getTracking = createServerFn({ method: 'GET' })
  .validator(ref)
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user) return { loggedIn: false as const, entry: null, favorite: false }
    const [entry, fav] = await Promise.all([
      db.query.listEntries.findFirst({
        where: and(
          eq(schema.listEntries.userId, user.id),
          eq(schema.listEntries.mediaType, data.kind),
          eq(schema.listEntries.malId, data.id),
        ),
      }),
      db.query.favorites.findFirst({
        where: and(
          eq(schema.favorites.userId, user.id),
          eq(schema.favorites.mediaType, data.kind),
          eq(schema.favorites.malId, data.id),
        ),
      }),
    ])
    return {
      loggedIn: true as const,
      entry: entry ? entryDTO(entry) : null,
      favorite: Boolean(fav),
    }
  })

const saveInput = ref.extend({
  status: z.enum(listStatuses).optional(),
  progress: z.number().int().min(0).max(100_000).optional(),
  progressDelta: z.number().int().min(-1).max(1).optional(),
  progressVolumes: z.number().int().min(0).max(10_000).optional(),
  score: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const saveEntry = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(saveInput)
  .handler(async ({ data, context }) => {
    const { kind: k, id, notes, ...patch } = data
    const entry = await applyEntryChange(context.user.id, k, id, {
      ...patch,
      notes: notes === undefined ? undefined : notes?.trim() || null,
    }).catch(catalogFailure)
    return entryDTO(entry)
  })

export const deleteEntry = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(ref)
  .handler(async ({ data, context }) => {
    await removeEntry(context.user.id, data.kind, data.id)
    return { ok: true }
  })

export const toggleFavorite = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(ref)
  .handler(async ({ data, context }) => {
    const where = and(
      eq(schema.favorites.userId, context.user.id),
      eq(schema.favorites.mediaType, data.kind),
      eq(schema.favorites.malId, data.id),
    )
    const deleted = await db.delete(schema.favorites).where(where).returning()
    if (deleted.length) return { favorite: false }
    const snap = await loadSnapshot(data.kind, data.id).catch(catalogFailure)
    await db.insert(schema.favorites).values({
      userId: context.user.id,
      mediaType: data.kind,
      malId: data.id,
      title: snap.title,
      imageUrl: snap.imageUrl,
    })
    return { favorite: true }
  })

export const getMyList = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ kind, status: z.enum(listStatuses).optional() }))
  .handler(async ({ data, context }) => {
    const rows = await db
      .select()
      .from(schema.listEntries)
      .where(
        and(
          eq(schema.listEntries.userId, context.user.id),
          eq(schema.listEntries.mediaType, data.kind),
        ),
      )
      .orderBy(desc(schema.listEntries.updatedAt))
    const counts = Object.fromEntries(
      listStatuses.map((s) => [s, 0]),
    ) as Record<ListStatus, number>
    for (const r of rows) counts[r.status]++
    const entries = data.status
      ? rows.filter((r) => r.status === data.status)
      : rows
    return { entries: entries.map(entryDTO), counts, total: rows.length }
  })

/** "Continue watching/reading" row. Empty when logged out. */
export const getContinue = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser()
    if (!user) return []
    const rows = await db
      .select()
      .from(schema.listEntries)
      .where(
        and(
          eq(schema.listEntries.userId, user.id),
          eq(schema.listEntries.status, 'current'),
        ),
      )
      .orderBy(desc(schema.listEntries.updatedAt))
      .limit(12)
    return rows.map(entryDTO)
  },
)

const PAGE_SIZE = 30

export const getHistory = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      kind: kind.optional(),
      before: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const rows = await db
      .select()
      .from(schema.watchHistory)
      .where(
        and(
          eq(schema.watchHistory.userId, context.user.id),
          data.kind ? eq(schema.watchHistory.mediaType, data.kind) : undefined,
          data.before
            ? lt(schema.watchHistory.createdAt, new Date(data.before))
            : undefined,
        ),
      )
      .orderBy(desc(schema.watchHistory.createdAt))
      .limit(PAGE_SIZE + 1)
    return {
      items: rows.slice(0, PAGE_SIZE).map(historyDTO),
      hasMore: rows.length > PAGE_SIZE,
    }
  })

export const getProfile = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id
    const e = schema.listEntries

    const totals = await db
      .select({
        kind: e.mediaType,
        status: e.status,
        entries: count(),
        progress: sum(e.progress).mapWith(Number),
        volumes: sum(e.progressVolumes).mapWith(Number),
      })
      .from(e)
      .where(eq(e.userId, userId))
      .groupBy(e.mediaType, e.status)

    const scores = await db
      .select({
        kind: e.mediaType,
        mean: avg(e.score).mapWith(Number),
        scored: count(e.score),
      })
      .from(e)
      .where(eq(e.userId, userId))
      .groupBy(e.mediaType)

    const distribution = await db
      .select({ score: e.score, n: count() })
      .from(e)
      .where(and(eq(e.userId, userId), sql`${e.score} is not null`))
      .groupBy(e.score)

    // Genres of everything the user has started, not things only planned.
    const genre = sql<string>`unnest(${e.genres})`
    const genres = await db
      .select({ name: genre, n: count(), mean: avg(e.score).mapWith(Number) })
      .from(e)
      .where(
        and(
          eq(e.userId, userId),
          inArray(e.status, ['current', 'completed', 'on_hold', 'dropped']),
        ),
      )
      .groupBy(genre)
      .orderBy(desc(count()))
      .limit(10)

    const favs = await db
      .select()
      .from(schema.favorites)
      .where(eq(schema.favorites.userId, userId))
      .orderBy(desc(schema.favorites.createdAt))

    const stat = (media: 'anime' | 'manga') => {
      const rows = totals.filter((t) => t.kind === media)
      const byStatus = Object.fromEntries(
        listStatuses.map((s) => [s, 0]),
      ) as Record<ListStatus, number>
      for (const r of rows) byStatus[r.status] = r.entries
      const s = scores.find((x) => x.kind === media)
      return {
        total: rows.reduce((n, r) => n + r.entries, 0),
        byStatus,
        progress: rows.reduce((n, r) => n + (r.progress || 0), 0),
        volumes: rows.reduce((n, r) => n + (r.volumes || 0), 0),
        meanScore: s?.scored ? Math.round(s.mean * 100) / 100 : null,
      }
    }

    return {
      user: context.user,
      anime: stat('anime'),
      manga: stat('manga'),
      scoreDistribution: Array.from({ length: 10 }, (_, i) => ({
        score: i + 1,
        n: distribution.find((d) => d.score === i + 1)?.n ?? 0,
      })),
      genres: genres.map((g) => ({
        name: g.name,
        n: g.n,
        mean: g.mean ? Math.round(g.mean * 10) / 10 : null,
      })),
      favorites: favs.map(favoriteDTO),
      recent: (await recentHistory(userId, 6)).map(historyDTO),
    }
  })

export const recordWatch = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive(), episode: z.number().int().positive().max(100_000), positionSeconds: z.number().int().min(0).max(604800).optional() }))
  .handler(async ({ data, context }) => {
    await recordPlayback(context.user.id, data.id, data.episode, data.positionSeconds).catch(catalogFailure)
    return { ok: true }
  })
