import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withListStatus } from '#/server/card-status'
import { catalogMiddleware } from '#/server/anilist/middleware'
import { CatalogError, TTL, anilist } from '#/server/anilist/client'
import {
  BROWSE,
  DETAIL,
  EPISODES,
  GENRES,
  HOME,
  QUICK_SEARCH,
  SCHEDULE,
} from '#/server/anilist/queries'
import type {
  AniCard,
  AniDetail,
  AniEpisodes,
  AniPage,
  AniSchedule,
} from '#/server/anilist/types'
import {
  animeDetail,
  characters,
  mangaDetail,
  recommendations,
  toCard,
  toCards,
} from './media'
import { catalogSearchSchema, scheduleDays } from './filters'
import {
  PER_PAGE,
  currentSeason,
  formatVars,
  jstDayRange,
  mediaType,
  searchVars,
  topVars,
} from '#/server/anilist/vars'
import type { BrowseVars } from '#/server/anilist/vars'
import type { MediaCard, MediaKind } from './media'

export type PageInfo = { page: number; lastPage: number; hasNext: boolean }

export type Section =
  { ok: true; items: MediaCard[] } | { ok: false; error: string }

function pageInfo(p: AniPage['pageInfo'], page: number): PageInfo {
  return {
    page,
    lastPage: Math.max(p.lastPage, page, 1),
    hasNext: p.hasNextPage,
  }
}

function errorMessage(err: unknown) {
  if (err instanceof CatalogError && err.status === 429) {
    return 'The anime database is busy right now. Try again in a minute.'
  }
  return 'Could not load this from the anime database. Try again shortly.'
}

async function browse(vars: BrowseVars, ttl: number) {
  const res = await anilist<{ Page: AniPage }>(BROWSE, vars, ttl)
  return {
    items: await withListStatus(toCards(res.Page.media)),
    pageInfo: pageInfo(res.Page.pageInfo, vars.page),
  }
}

// ---------------------------------------------------------------------------
// Home

type HomeData = Record<
  'season' | 'airing' | 'top' | 'upcoming' | 'manga',
  { media: AniCard[] }
>

const homeShelf = z.enum(['season', 'airing', 'top', 'upcoming', 'manga'])

/**
 * One shelf of the home page. All five shelves come from a single cached
 * AniList request, so loading them separately costs one upstream call.
 */
export const getHomeShelf = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(z.object({ shelf: homeShelf }))
  .handler(async ({ data }): Promise<Section> => {
    try {
      const res = await anilist<HomeData>(HOME, currentSeason(), TTL.list)
      return {
        ok: true,
        items: await withListStatus(toCards(res[data.shelf].media)),
      }
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    }
  })

// ---------------------------------------------------------------------------
// Lists and search

const topInput = z.object({
  kind: z.enum(['anime', 'manga']),
  type: z.string().max(30).optional(),
  filter: z.string().max(30).optional(),
  page: z.number().int().min(1).max(1000).default(1),
})

export const getTopList = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(topInput)
  .handler(async ({ data }) =>
    browse(
      {
        type: mediaType(data.kind),
        page: data.page,
        perPage: PER_PAGE,
        sort: ['SCORE_DESC'],
        ...topVars(data.kind, data.filter),
        ...formatVars(data.kind, data.type),
      },
      TTL.list,
    ),
  )

export const searchCatalog = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(catalogSearchSchema)
  .handler(async ({ data }) => browse(searchVars(data), TTL.search))

export const quickSearch = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(z.object({ q: z.string().trim().min(2).max(100) }))
  .handler(async ({ data }) => {
    const res = await anilist<{
      anime: { media: AniCard[] }
      manga: { media: AniCard[] }
    }>(QUICK_SEARCH, { search: data.q }, TTL.search)
    return withListStatus([
      ...toCards(res.anime.media),
      ...toCards(res.manga.media),
    ])
  })

export const getGenres = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(z.object({ kind: z.enum(['anime', 'manga']) }))
  .handler(async () => {
    const res = await anilist<{ GenreCollection: string[] }>(
      GENRES,
      {},
      TTL.meta,
    )
    return res.GenreCollection.filter((g) => g !== 'Hentai')
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }))
  })

// ---------------------------------------------------------------------------
// Detail pages

const idInput = z.object({ id: z.number().int().positive().max(2147483647) })

/** The full record; characters and recommendations come in the same response. */
async function loadDetail(
  kind: MediaKind,
  id: number,
): Promise<AniDetail | null> {
  try {
    const res = await anilist<{ Media: AniDetail | null }>(
      DETAIL,
      { idMal: id, type: mediaType(kind) },
      TTL.detail,
    )
    return res.Media && !res.Media.isAdult ? res.Media : null
  } catch (err) {
    if (err instanceof CatalogError && err.status === 404) return null
    throw err
  }
}

export const getAnime = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(idInput)
  .handler(async ({ data }) => {
    const m = await loadDetail('anime', data.id)
    return m ? animeDetail(m) : null
  })

export const getManga = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(idInput)
  .handler(async ({ data }) => {
    const m = await loadDetail('manga', data.id)
    return m ? mangaDetail(m) : null
  })

/** Characters and recommendations. Served from the cached detail request. */
export const getExtras = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(idInput.extend({ kind: z.enum(['anime', 'manga']) }))
  .handler(async ({ data }) => {
    const m = await loadDetail(data.kind, data.id).catch(() => null)
    if (!m) return { characters: null, recommendations: null }
    const recs = recommendations(m)
    const withStatus = await withListStatus(recs)
    return {
      characters: characters(m),
      recommendations: recs.map((r, i) => ({
        ...r,
        listStatus: withStatus[i].listStatus,
      })),
    }
  })

const EPISODE_PAGE = 100

/** Episode list from AniList's airing schedule and streaming listings. */
export const getEpisodes = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(
    idInput.extend({ page: z.number().int().min(1).max(1000).default(1) }),
  )
  .handler(async ({ data }) => {
    // Each of our pages (100 episodes) spans two AniList schedule pages (50 each).
    const [first, second] = await Promise.all(
      [data.page * 2 - 1, data.page * 2].map((page) =>
        anilist<{ Media: AniEpisodes | null }>(
          EPISODES,
          { idMal: data.id, page },
          TTL.detail,
        ),
      ),
    )
    const media = first.Media
    if (!media)
      return {
        items: [],
        pageInfo: { page: data.page, lastPage: 1, hasNext: false },
      }

    const airedAt = new Map<number, number>()
    for (const node of [
      ...media.airingSchedule.nodes,
      ...(second.Media?.airingSchedule.nodes ?? []),
    ]) {
      airedAt.set(node.episode, node.airingAt)
    }
    const titles = new Map<number, string>()
    for (const ep of media.streamingEpisodes) {
      const match = /^Episode\s+(\d+)\s*[-–:]\s*(.+)$/i.exec(ep.title ?? '')
      if (match) titles.set(Number(match[1]), match[2].trim())
    }
    const total =
      media.episodes ?? Math.max(0, ...airedAt.keys(), ...titles.keys())
    const start = (data.page - 1) * EPISODE_PAGE + 1
    const end = Math.min(total, data.page * EPISODE_PAGE)
    const items = []
    for (let n = start; n <= end; n++) {
      const at = airedAt.get(n)
      items.push({
        id: n,
        title: titles.get(n) ?? `Episode ${n}`,
        aired: at ? new Date(at * 1000).toISOString() : null,
        filler: false,
        recap: false,
        score: null as number | null,
      })
    }
    return {
      items,
      pageInfo: {
        page: data.page,
        lastPage: Math.max(1, Math.ceil(total / EPISODE_PAGE)),
        hasNext: end < total,
      },
    }
  })

/** AniList has no gallery: the cover, the banner and episode thumbnails. */
export const getPictures = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(idInput.extend({ kind: z.enum(['anime', 'manga']) }))
  .handler(async ({ data }) => {
    if (data.kind === 'anime') {
      const res = await anilist<{ Media: AniEpisodes | null }>(
        EPISODES,
        { idMal: data.id, page: 1 },
        TTL.detail,
      )
      const m = res.Media
      if (!m) return []
      const urls = [
        m.coverImage.extraLarge,
        m.bannerImage,
        ...m.streamingEpisodes.map((e) => e.thumbnail),
      ]
      return [...new Set(urls.filter((u): u is string => Boolean(u)))].slice(
        0,
        40,
      )
    }
    const m = await loadDetail('manga', data.id)
    return m
      ? [m.coverImage.extraLarge, m.bannerImage].filter((u): u is string =>
          Boolean(u),
        )
      : []
  })

// ---------------------------------------------------------------------------
// Schedule and random

const jstTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const getSchedule = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .validator(z.object({ day: z.enum(scheduleDays) }))
  .handler(async ({ data }) => {
    const [from, to] = jstDayRange(data.day)
    const rows: AniSchedule[] = []
    // A busy day can exceed one page of 50; fetch up to three.
    for (let page = 1; page <= 3; page++) {
      const res = await anilist<{
        Page: {
          pageInfo: { hasNextPage: boolean }
          airingSchedules: AniSchedule[]
        }
      }>(SCHEDULE, { from, to, page }, TTL.list)
      rows.push(...res.Page.airingSchedules)
      if (!res.Page.pageInfo.hasNextPage) break
    }
    const seen = new Set<number>()
    const items: {
      card: MediaCard
      time: string
      timezone: string
      episode: number
    }[] = []
    for (const row of rows) {
      const card = row.media.isAdult ? null : toCard(row.media)
      if (!card || seen.has(card.id)) continue
      seen.add(card.id)
      items.push({
        card,
        time: jstTime.format(new Date(row.airingAt * 1000)),
        timezone: 'Asia/Tokyo',
        episode: row.episode,
      })
    }
    return items
  })

export const getRandomAnimeId = createServerFn({ method: 'GET' })
  .middleware([catalogMiddleware])
  .handler(async () => {
    // AniList has no random endpoint: pick a random title among the
    // 3,000 most popular, retrying if it has no MAL id.
    for (let attempt = 0; attempt < 3; attempt++) {
      const page = 1 + Math.floor(Math.random() * 3000)
      const res = await anilist<{ Page: AniPage }>(
        BROWSE,
        { type: 'ANIME', page, perPage: 1, sort: ['POPULARITY_DESC'] },
        TTL.none,
      )
      const card = res.Page.media[0] ? toCard(res.Page.media[0]) : null
      if (card) return card.id
    }
    throw new CatalogError("Couldn't pick a random anime. Try again.", 503)
  })
