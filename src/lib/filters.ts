import { z } from 'zod'

// Option values used in URLs. catalog.functions.ts maps them to AniList's
// MediaFormat / MediaStatus / MediaSort enums.

export const animeTypes = [
  'tv',
  'tv_short',
  'movie',
  'ova',
  'special',
  'ona',
  'music',
] as const
export const mangaTypes = [
  'manga',
  'novel',
  'oneshot',
  'manhwa',
  'manhua',
] as const
export const animeTopFilters = [
  'airing',
  'upcoming',
  'bypopularity',
  'favorite',
] as const
export const mangaTopFilters = [
  'publishing',
  'upcoming',
  'bypopularity',
  'favorite',
] as const
export const animeStatuses = ['airing', 'complete', 'upcoming'] as const
export const mangaStatuses = [
  'publishing',
  'complete',
  'hiatus',
  'discontinued',
  'upcoming',
] as const
export const orderByOptions = [
  'score',
  'popularity',
  'trending',
  'start_date',
  'title',
  'favorites',
] as const
export const scheduleDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type ScheduleDay = (typeof scheduleDays)[number]

export const typeLabels: Record<string, string> = {
  tv: 'TV',
  tv_short: 'TV short',
  movie: 'Movie',
  ova: 'OVA',
  special: 'Special',
  ona: 'ONA',
  music: 'Music',
  manga: 'Manga',
  novel: 'Light novel',
  oneshot: 'One-shot',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
}

export const topFilterLabels: Record<string, string> = {
  '': 'Top rated',
  airing: 'Airing now',
  publishing: 'Publishing',
  upcoming: 'Upcoming',
  bypopularity: 'Most popular',
  favorite: 'Most favorited',
}

export const statusLabels: Record<string, string> = {
  airing: 'Airing',
  publishing: 'Publishing',
  complete: 'Finished',
  hiatus: 'On hiatus',
  discontinued: 'Cancelled',
  upcoming: 'Upcoming',
}

export const orderByLabels: Record<string, string> = {
  score: 'Score',
  popularity: 'Popularity',
  trending: 'Trending',
  start_date: 'Start date',
  title: 'Title',
  favorites: 'Favorites',
}

const page = z.coerce.number().int().min(1).max(1000).catch(1)

export const topSearchSchema = z.object({
  type: z.string().optional().catch(undefined),
  filter: z.string().optional().catch(undefined),
  page: page.optional(),
})

export const catalogSearchSchema = z.object({
  kind: z.enum(['anime', 'manga']).catch('anime'),
  q: z.string().max(100).optional().catch(undefined),
  /** Comma-separated AniList genre names, e.g. "Action,Slice of Life". */
  genres: z
    .string()
    .max(300)
    .regex(/^[\w ,'&-]*$/)
    .optional()
    .catch(undefined),
  type: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  year: z.coerce.number().int().min(1917).max(2100).optional().catch(undefined),
  minScore: z.coerce.number().min(1).max(10).optional().catch(undefined),
  orderBy: z.enum(orderByOptions).optional().catch(undefined),
  sort: z.enum(['asc', 'desc']).optional().catch(undefined),
  page: page.optional(),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>
