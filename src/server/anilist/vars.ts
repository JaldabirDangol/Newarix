import { animeTopFilters, animeTypes, mangaTopFilters, mangaTypes, scheduleDays } from '#/lib/filters'
import type { CatalogSearch, ScheduleDay } from '#/lib/filters'
import type { MediaKind } from '#/lib/media'

// Pure translations from Newarix's URL filter values to AniList arguments.

export const PER_PAGE = 24
export const mediaType = (kind: MediaKind) => (kind === 'anime' ? 'ANIME' : 'MANGA')

export type BrowseVars = {
  type: 'ANIME' | 'MANGA'
  page: number
  perPage: number
  sort: string[]
  search?: string
  status?: string
  format_in?: string[]
  genre_in?: string[]
  country?: string
  scoreGreater?: number
  startGreater?: number
  startLesser?: number
}

/** Format (and, for manhwa/manhua, country) for a URL `type` value. */
export function formatVars(kind: MediaKind, type: string | undefined): Partial<BrowseVars> {
  const allowed: readonly string[] = kind === 'anime' ? animeTypes : mangaTypes
  if (!type || !allowed.includes(type)) return {}
  switch (type) {
    case 'manga':
      return { format_in: ['MANGA'], country: 'JP' }
    case 'manhwa':
      return { format_in: ['MANGA'], country: 'KR' }
    case 'manhua':
      return { format_in: ['MANGA'], country: 'CN' }
    case 'oneshot':
      return { format_in: ['ONE_SHOT'] }
    default:
      return { format_in: [type.toUpperCase()] }
  }
}

const STATUS: Record<string, string> = {
  airing: 'RELEASING',
  publishing: 'RELEASING',
  complete: 'FINISHED',
  upcoming: 'NOT_YET_RELEASED',
  hiatus: 'HIATUS',
  discontinued: 'CANCELLED',
}

/** Ranking tab → status + sort. */
export function topVars(kind: MediaKind, filter: string | undefined): Partial<BrowseVars> {
  const allowed: readonly string[] = kind === 'anime' ? animeTopFilters : mangaTopFilters
  switch (filter && allowed.includes(filter) ? filter : '') {
    case 'airing':
    case 'publishing':
      return { status: 'RELEASING', sort: ['SCORE_DESC'] }
    case 'upcoming':
      return { status: 'NOT_YET_RELEASED', sort: ['POPULARITY_DESC'] }
    case 'bypopularity':
      return { sort: ['POPULARITY_DESC'] }
    case 'favorite':
      return { sort: ['FAVOURITES_DESC'] }
    default:
      return { sort: ['SCORE_DESC'] }
  }
}

const ORDER: Record<NonNullable<CatalogSearch['orderBy']>, string> = {
  score: 'SCORE',
  popularity: 'POPULARITY',
  trending: 'TRENDING',
  start_date: 'START_DATE',
  title: 'TITLE_ROMAJI',
  favorites: 'FAVOURITES',
}

export function searchVars(data: CatalogSearch): BrowseVars {
  const q = data.q?.trim()
  let sort: string[]
  if (data.orderBy) {
    const base = ORDER[data.orderBy]
    // Titles read A→Z by default; everything else highest first.
    const desc = data.sort ? data.sort === 'desc' : data.orderBy !== 'title'
    sort = [desc ? `${base}_DESC` : base]
  } else {
    sort = q ? ['SEARCH_MATCH'] : ['POPULARITY_DESC']
  }
  const genres = data.genres?.split(',').map((g) => g.trim()).filter(Boolean)
  return {
    type: mediaType(data.kind),
    page: data.page ?? 1,
    perPage: PER_PAGE,
    sort,
    search: q || undefined,
    status: data.status ? STATUS[data.status] : undefined,
    genre_in: genres?.length ? genres : undefined,
    // AniList compares with ">", so step just below the boundary.
    scoreGreater: data.minScore ? data.minScore * 10 - 1 : undefined,
    startGreater: data.year ? data.year * 10000 - 1 : undefined,
    startLesser: data.year ? (data.year + 1) * 10000 : undefined,
    ...formatVars(data.kind, data.type),
  }
}

export function currentSeason(date = new Date()) {
  const month = date.getUTCMonth()
  const season = ['WINTER', 'WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL'][month]
  return { season, year: date.getUTCFullYear() }
}

/** Unix-second bounds of `day` in the current Monday–Sunday week, in Japan time. */
export function jstDayRange(day: ScheduleDay, now = Date.now()): [number, number] {
  const JST = 9 * 3600_000
  const local = new Date(now + JST)
  const today = (local.getUTCDay() + 6) % 7 // Monday = 0
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - JST
  const start = midnight + (scheduleDays.indexOf(day) - today) * 86_400_000
  return [start / 1000 - 1, start / 1000 + 86_400]
}

