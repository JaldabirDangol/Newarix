import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '#/server/db'
import { applyEntryChange, removeEntry } from '#/server/tracking'
import type * as AniListClient from '#/server/anilist/client'

// AniList is replaced by fixed titles: id 1 has 12 episodes, id 2 is still
// airing with no episode count, manga 3 has 100 chapters in 10 volumes.
vi.mock('#/server/anilist/client', async (importOriginal) => {
  const actual = await importOriginal<typeof AniListClient>()
  return {
    ...actual,
    anilist: vi.fn((_query: string, vars: { idMal: number; type: string }) => {
      const id = vars.idMal
      const base = {
        idMal: id,
        title: { romaji: `Title ${id}`, english: null },
        coverImage: { large: 'x.jpg', extraLarge: 'x.jpg' },
        genres: ['Drama'],
      }
      if (vars.type === 'MANGA') {
        return Promise.resolve({ Media: { ...base, chapters: 100, volumes: 10, episodes: null } })
      }
      return Promise.resolve({ Media: { ...base, episodes: id === 2 ? null : 12, chapters: null, volumes: null } })
    }),
  }
})

let userId: string

beforeEach(async () => {
  await db.execute(sql`truncate users cascade`)
  const [user] = await db
    .insert(schema.users)
    .values({ email: 'a@test.dev', username: 'tester', passwordHash: 'x' })
    .returning()
  userId = user.id
})

async function history() {
  const rows = await db
    .select()
    .from(schema.watchHistory)
    .where(eq(schema.watchHistory.userId, userId))
    .orderBy(asc(schema.watchHistory.createdAt))
  return rows.map((r) => [r.action, r.progress ?? r.status ?? r.score])
}

describe('applyEntryChange', () => {
  it('adds a planned entry with a snapshot from Jikan', async () => {
    const entry = await applyEntryChange(userId, 'anime', 1, {
      status: 'planned',
    })
    expect(entry).toMatchObject({
      status: 'planned',
      progress: 0,
      title: 'Title 1',
      total: 12,
      genres: ['Drama'],
    })
    expect(await history()).toEqual([['added', 'planned']])
  })

  it('moves a planned entry to watching when progress starts', async () => {
    await applyEntryChange(userId, 'anime', 1, { status: 'planned' })
    const entry = await applyEntryChange(userId, 'anime', 1, {
      progressDelta: 1,
    })
    expect(entry.status).toBe('current')
    expect(entry.startedAt).not.toBeNull()
    expect(await history()).toEqual([
      ['added', 'planned'],
      ['progress', 1],
      ['status', 'current'],
    ])
  })

  it('completes the entry on the last episode', async () => {
    await applyEntryChange(userId, 'anime', 1, {
      status: 'current',
      progress: 11,
    })
    const entry = await applyEntryChange(userId, 'anime', 1, {
      progressDelta: 1,
    })
    expect(entry).toMatchObject({ status: 'completed', progress: 12 })
    expect(entry.completedAt).not.toBeNull()
    expect((await history()).slice(-2)).toEqual([
      ['progress', 12],
      ['completed', 'completed'],
    ])
  })

  it('fills progress to the total when marked completed', async () => {
    const entry = await applyEntryChange(userId, 'anime', 1, {
      status: 'completed',
    })
    expect(entry.progress).toBe(12)
    // A brand-new completed entry logs only "completed", not "added".
    expect(await history()).toEqual([
      ['progress', 12],
      ['completed', 'completed'],
    ])
  })

  it('clamps progress between 0 and the total', async () => {
    expect(
      (await applyEntryChange(userId, 'anime', 1, { progress: 50 })).progress,
    ).toBe(12)
    expect(
      (
        await applyEntryChange(userId, 'anime', 1, {
          progress: 0,
          status: 'current',
        })
      ).progress,
    ).toBe(0)
    expect(
      (await applyEntryChange(userId, 'anime', 1, { progressDelta: -1 }))
        .progress,
    ).toBe(0)
  })

  it('never auto-completes when the total is unknown', async () => {
    const entry = await applyEntryChange(userId, 'anime', 2, { progress: 500 })
    expect(entry).toMatchObject({
      status: 'current',
      progress: 500,
      total: null,
    })
  })

  it('removes the mistaken history event when progress goes back down', async () => {
    await applyEntryChange(userId, 'anime', 1, { status: 'current' })
    await applyEntryChange(userId, 'anime', 1, { progressDelta: 1 })
    await applyEntryChange(userId, 'anime', 1, { progressDelta: 1 })
    await applyEntryChange(userId, 'anime', 1, { progressDelta: -1 })
    const events = await history()
    expect(events.filter(([a]) => a === 'progress')).toEqual([['progress', 1]])
  })

  it('logs score changes but not clearing a score', async () => {
    await applyEntryChange(userId, 'anime', 1, { score: 8 })
    await applyEntryChange(userId, 'anime', 1, { score: 8 })
    const cleared = await applyEntryChange(userId, 'anime', 1, { score: null })
    expect(cleared.score).toBeNull()
    expect((await history()).filter(([a]) => a === 'scored')).toEqual([
      ['scored', 8],
    ])
  })

  it('tracks manga chapters and volumes separately', async () => {
    const entry = await applyEntryChange(userId, 'manga', 3, {
      status: 'current',
      progress: 40,
      progressVolumes: 15,
    })
    expect(entry).toMatchObject({
      progress: 40,
      progressVolumes: 10,
      total: 100,
      totalVolumes: 10,
    })
  })

  it('keeps one entry per user and title', async () => {
    await applyEntryChange(userId, 'anime', 1, { status: 'planned' })
    await applyEntryChange(userId, 'anime', 1, { status: 'current' })
    await applyEntryChange(userId, 'manga', 1, { status: 'planned' })
    const rows = await db
      .select()
      .from(schema.listEntries)
      .where(eq(schema.listEntries.userId, userId))
    expect(rows).toHaveLength(2)
  })
})

describe('removeEntry', () => {
  it('deletes the entry and records the removal', async () => {
    await applyEntryChange(userId, 'anime', 1, { status: 'planned' })
    await removeEntry(userId, 'anime', 1)
    const rows = await db
      .select()
      .from(schema.listEntries)
      .where(eq(schema.listEntries.userId, userId))
    expect(rows).toHaveLength(0)
    expect((await history()).at(-1)?.[0]).toBe('removed')
  })

  it('does nothing for an entry that is not on the list', async () => {
    await removeEntry(userId, 'anime', 99)
    expect(await history()).toEqual([])
  })
})
