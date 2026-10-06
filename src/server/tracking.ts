import { and, desc, eq, gt, gte } from 'drizzle-orm'
import { db, schema } from './db'
import { TTL, anilist } from './anilist/client'
import { DETAIL } from './anilist/queries'
import type { AniDetail } from './anilist/types'
import type { ListStatus, MediaType } from './db/schema'

export type Snapshot = {
  title: string
  imageUrl: string | null
  total: number | null
  totalVolumes: number | null
  genres: string[]
}

// Uses the AniList cache, which the detail page has usually just filled.
export async function loadSnapshot(
  kind: MediaType,
  id: number,
): Promise<Snapshot> {
  const { Media: m } = await anilist<{ Media: AniDetail }>(
    DETAIL,
    { idMal: id, type: kind === 'anime' ? 'ANIME' : 'MANGA' },
    TTL.detail,
  )
  return {
    title: m.title.english || m.title.romaji,
    imageUrl: m.coverImage.large,
    total: kind === 'anime' ? m.episodes : m.chapters,
    totalVolumes: kind === 'manga' ? m.volumes : null,
    genres: m.genres,
  }
}

export type EntryPatch = {
  status?: ListStatus
  progress?: number
  progressDelta?: number
  progressVolumes?: number
  score?: number | null
  notes?: string | null
}

const clamp = (n: number, max: number | null) =>
  Math.max(0, max ? Math.min(n, max) : n)

/**
 * Applies a change to a list entry and records history, in one transaction.
 *
 * Rules:
 * - Raising progress on a planned entry moves it to Watching/Reading.
 * - Reaching the last episode/chapter marks it Completed.
 * - Marking Completed fills progress to the total.
 * - Lowering progress removes the matching recent "watched episode" event,
 *   so a mis-click followed by -1 doesn't leave a wrong history entry.
 */
export async function applyEntryChange(
  userId: string,
  kind: MediaType,
  malId: number,
  patch: EntryPatch,
) {
  const where = and(
    eq(schema.listEntries.userId, userId),
    eq(schema.listEntries.mediaType, kind),
    eq(schema.listEntries.malId, malId),
  )
  const existing = await db.query.listEntries.findFirst({ where })

  let snapshot: Snapshot | null = null
  if (!existing) {
    snapshot = await loadSnapshot(kind, malId)
  } else if (existing.total === null) {
    // Airing shows gain an episode count later; refresh when we can.
    snapshot = await loadSnapshot(kind, malId).catch(() => null)
  }

  const total = snapshot?.total ?? existing?.total ?? null
  const totalVolumes = snapshot?.totalVolumes ?? existing?.totalVolumes ?? null
  const prevProgress = existing?.progress ?? 0
  const prevStatus = existing?.status ?? null

  let progress = clamp(
    patch.progress ?? prevProgress + (patch.progressDelta ?? 0),
    total,
  )
  let status: ListStatus =
    patch.status ?? prevStatus ?? (progress > 0 ? 'current' : 'planned')

  if (!patch.status && progress > prevProgress && status === 'planned') {
    status = 'current'
  }
  if (!patch.status && total && progress >= total && progress > prevProgress) {
    status = 'completed'
  }
  if (patch.status === 'completed' && total) progress = total

  const progressVolumes = clamp(
    patch.progressVolumes ?? existing?.progressVolumes ?? 0,
    totalVolumes,
  )
  const score =
    patch.score === undefined ? (existing?.score ?? null) : patch.score
  const notes =
    patch.notes === undefined ? (existing?.notes ?? null) : patch.notes

  const now = new Date()
  const becameActive = status === 'current' || status === 'completed'
  const values = {
    status,
    progress,
    progressVolumes,
    score,
    notes,
    total,
    totalVolumes,
    startedAt: existing?.startedAt ?? (becameActive ? now : null),
    completedAt:
      status === 'completed'
        ? prevStatus === 'completed'
          ? existing?.completedAt
          : now
        : null,
    updatedAt: now,
    ...(snapshot && {
      title: snapshot.title,
      imageUrl: snapshot.imageUrl,
      genres: snapshot.genres,
    }),
  }

  return db.transaction(async (tx) => {
    const [entry] = existing
      ? await tx
          .update(schema.listEntries)
          .set(values)
          .where(eq(schema.listEntries.id, existing.id))
          .returning()
      : await tx
          .insert(schema.listEntries)
          .values({
            userId,
            mediaType: kind,
            malId,
            ...values,
            title: snapshot!.title,
          })
          .returning()

    const base = {
      userId,
      malId,
      mediaType: kind,
      title: entry.title,
      imageUrl: entry.imageUrl,
    }
    const events: (typeof schema.watchHistory.$inferInsert)[] = []
    // Events in one save get increasing timestamps so they sort correctly.
    const at = () => new Date(now.getTime() + events.length)

    if (!existing && status !== 'completed') {
      events.push({ ...base, action: 'added', status, createdAt: at() })
    }
    if (progress > prevProgress) {
      events.push({ ...base, action: 'progress', progress, createdAt: at() })
    }
    if (status !== prevStatus && existing) {
      events.push({
        ...base,
        action: status === 'completed' ? 'completed' : 'status',
        status,
        createdAt: at(),
      })
    } else if (!existing && status === 'completed') {
      events.push({ ...base, action: 'completed', status, createdAt: at() })
    }
    if (score !== null && score !== (existing?.score ?? null)) {
      events.push({ ...base, action: 'scored', score, createdAt: at() })
    }
    if (events.length) await tx.insert(schema.watchHistory).values(events)

    if (progress < prevProgress) {
      await tx
        .delete(schema.watchHistory)
        .where(
          and(
            eq(schema.watchHistory.userId, userId),
            eq(schema.watchHistory.mediaType, kind),
            eq(schema.watchHistory.malId, malId),
            eq(schema.watchHistory.action, 'progress'),
            gt(schema.watchHistory.progress, progress),
            gte(
              schema.watchHistory.createdAt,
              new Date(now.getTime() - 60 * 60_000),
            ),
          ),
        )
    }
    return entry
  })
}

export async function removeEntry(
  userId: string,
  kind: MediaType,
  malId: number,
) {
  const removed = (
    await db
      .delete(schema.listEntries)
      .where(
        and(
          eq(schema.listEntries.userId, userId),
          eq(schema.listEntries.mediaType, kind),
          eq(schema.listEntries.malId, malId),
        ),
      )
      .returning()
  ).at(0)
  if (removed) {
    await db.insert(schema.watchHistory).values({
      userId,
      malId,
      mediaType: kind,
      action: 'removed',
      title: removed.title,
      imageUrl: removed.imageUrl,
    })
  }
}

export async function recentHistory(userId: string, limit: number) {
  return db
    .select()
    .from(schema.watchHistory)
    .where(eq(schema.watchHistory.userId, userId))
    .orderBy(desc(schema.watchHistory.createdAt))
    .limit(limit)
}
