/**
 * Contract test against the real AniList API. Run with:
 *   npm run test:live
 * It sends the exact queries the app uses, checks every field the mappers
 * read (with Zod), then runs the real mappers on the responses. About ten
 * requests, well under AniList's rate limit.
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MemoryStore } from '#/server/kv'
import { TTL, createAniListClient } from '#/server/anilist/client'
import { BROWSE, DETAIL, EPISODES, GENRES, HOME, QUICK_SEARCH, SCHEDULE } from '#/server/anilist/queries'
import { currentSeason, jstDayRange, searchVars, topVars } from '#/server/anilist/vars'
import { animeDetail, characters, mangaDetail, recommendations, toCards } from '#/lib/media'
import type { AniDetail, AniPage } from '#/server/anilist/types'

const anilist = createAniListClient({
  store: new MemoryStore(),
  url: process.env.ANILIST_URL ?? 'https://graphql.anilist.co',
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: Date.now,
})

const str = z.string().nullable()
const num = z.number().nullable()
const fuzzy = z.object({ year: num, month: num.optional(), day: num.optional() })

const card = z.object({
  id: z.number(),
  idMal: num,
  type: z.enum(['ANIME', 'MANGA']),
  format: str,
  status: str,
  episodes: num,
  chapters: num,
  seasonYear: num,
  isAdult: z.boolean(),
  countryOfOrigin: str,
  startDate: fuzzy,
  averageScore: num,
  popularity: num,
  genres: z.array(z.string()),
  title: z.object({ romaji: z.string(), english: str }),
  coverImage: z.object({ large: str, extraLarge: str }),
})

const page = z.object({
  pageInfo: z.object({ currentPage: z.number(), lastPage: z.number(), hasNextPage: z.boolean() }),
  media: z.array(card),
})

const detail = card.extend({
  siteUrl: z.string(),
  bannerImage: str,
  description: str,
  season: str,
  duration: num,
  source: str,
  volumes: num,
  favourites: num,
  title: z.object({ romaji: z.string(), english: str, native: str }),
  startDate: fuzzy,
  endDate: fuzzy,
  rankings: z.array(z.object({ rank: z.number(), type: z.string(), allTime: z.boolean() })),
  tags: z.array(z.object({ name: z.string(), category: z.string(), rank: z.number(), isMediaSpoiler: z.boolean() })),
  studios: z.object({ nodes: z.array(z.object({ name: z.string() })) }),
  trailer: z.object({ id: z.string(), site: z.string() }).nullable(),
  nextAiringEpisode: z.object({ airingAt: z.number(), episode: z.number() }).nullable(),
  externalLinks: z.array(z.object({ site: z.string(), type: str, url: z.string() })),
  stats: z.object({ scoreDistribution: z.array(z.object({ amount: z.number() })) }).nullable(),
  relations: z.object({
    edges: z.array(
      z.object({
        relationType: z.string(),
        node: z.object({ idMal: num, type: z.enum(['ANIME', 'MANGA']), title: z.object({ romaji: z.string(), english: str }) }),
      }),
    ),
  }),
  staff: z.object({ edges: z.array(z.object({ role: z.string(), node: z.object({ name: z.object({ full: z.string() }) }) })) }),
  characters: z.object({
    edges: z.array(
      z.object({
        role: z.string(),
        node: z.object({ id: z.number(), name: z.object({ full: z.string() }), image: z.object({ medium: str }) }),
        voiceActors: z.array(z.object({ name: z.object({ full: z.string() }), image: z.object({ medium: str }) })),
      }),
    ),
  }),
  recommendations: z.object({ nodes: z.array(z.object({ rating: z.number(), mediaRecommendation: card.nullable() })) }),
})

function check(schema: z.ZodTypeAny, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'))
  }
}

const FRIEREN = 52991 // MAL id
const BERSERK = 2

describe('AniList contract', { timeout: 120_000 }, () => {
  it('home shelves', async () => {
    const res = await anilist<Record<string, unknown>>(HOME, currentSeason(), TTL.none)
    for (const shelf of ['season', 'airing', 'top', 'upcoming', 'manga']) {
      check(z.object({ media: z.array(card) }), res[shelf])
      expect(toCards((res[shelf] as AniPage).media).length, shelf).toBeGreaterThan(5)
    }
  })

  it('anime detail with characters and recommendations', async () => {
    const res = await anilist<{ Media: AniDetail }>(DETAIL, { idMal: FRIEREN, type: 'ANIME' }, TTL.none)
    check(detail, res.Media)
    const a = animeDetail(res.Media)!
    expect(a.id).toBe(FRIEREN)
    expect(a.titleEnglish).toMatch(/Frieren/)
    expect(a.score).toBeGreaterThan(8)
    expect(a.count).toBeGreaterThan(20)
    expect(a.studios.join().toLowerCase()).toContain('madhouse')
    expect(a.synopsis).not.toMatch(/<[a-z]/i)
    expect(characters(res.Media).length).toBeGreaterThan(5)
    expect(recommendations(res.Media).length).toBeGreaterThan(3)
  })

  it('manga detail with authors', async () => {
    const res = await anilist<{ Media: AniDetail }>(DETAIL, { idMal: BERSERK, type: 'MANGA' }, TTL.none)
    check(detail, res.Media)
    const m = mangaDetail(res.Media)!
    expect(m.title).toMatch(/Berserk/)
    expect(m.authors.join()).toMatch(/Miura/)
  })

  it('top list and search with every filter', async () => {
    const top = await anilist<{ Page: AniPage }>(
      BROWSE,
      { type: 'ANIME', page: 1, perPage: 10, ...topVars('anime', 'airing') },
      TTL.none,
    )
    check(page, top.Page)
    expect(top.Page.media.every((m) => m.status === 'RELEASING')).toBe(true)

    const search = await anilist<{ Page: AniPage }>(
      BROWSE,
      searchVars({ kind: 'anime', q: 'frieren', genres: 'Adventure,Drama', type: 'tv', status: 'complete', minScore: 8, year: 2023 }),
      TTL.none,
    )
    check(page, search.Page)
    expect(toCards(search.Page.media).map((c) => c.id)).toContain(FRIEREN)

    const manhwa = await anilist<{ Page: AniPage }>(BROWSE, searchVars({ kind: 'manga', type: 'manhwa' }), TTL.none)
    expect(toCards(manhwa.Page.media).every((c) => c.type === 'Manhwa')).toBe(true)
  })

  it('quick search', async () => {
    const res = await anilist<{ anime: AniPage; manga: AniPage }>(QUICK_SEARCH, { search: 'berserk' }, TTL.none)
    check(z.object({ media: z.array(card) }), res.anime)
    expect(toCards(res.manga.media).map((c) => c.id)).toContain(BERSERK)
  })

  it('schedule for today in Japan time', async () => {
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Tokyo' }).format(new Date()).toLowerCase()
    const [from, to] = jstDayRange(day as 'monday')
    const res = await anilist<{ Page: { airingSchedules: { airingAt: number; episode: number; media: unknown }[] } }>(
      SCHEDULE,
      { from, to, page: 1 },
      TTL.none,
    )
    check(z.array(z.object({ airingAt: z.number(), episode: z.number(), media: card })), res.Page.airingSchedules)
    expect(res.Page.airingSchedules.length).toBeGreaterThan(0)
    expect(res.Page.airingSchedules.every((s) => s.airingAt > from && s.airingAt < to)).toBe(true)
  })

  it('episodes and genres', async () => {
    const eps = await anilist<{ Media: unknown }>(EPISODES, { idMal: FRIEREN, page: 1 }, TTL.none)
    check(
      z.object({
        episodes: num,
        coverImage: z.object({ extraLarge: str }),
        bannerImage: str,
        streamingEpisodes: z.array(z.object({ title: str, thumbnail: str })),
        airingSchedule: z.object({
          pageInfo: z.object({ hasNextPage: z.boolean() }),
          nodes: z.array(z.object({ episode: z.number(), airingAt: z.number() })),
        }),
      }),
      eps.Media,
    )
    const genres = await anilist<{ GenreCollection: string[] }>(GENRES, {}, TTL.none)
    expect(genres.GenreCollection).toContain('Slice of Life')
  })

  it('returns 404 for a MAL id AniList does not have', async () => {
    await expect(anilist(DETAIL, { idMal: 99999999, type: 'ANIME' }, TTL.none)).rejects.toMatchObject({ status: 404 })
  })
})
