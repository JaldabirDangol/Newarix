// Shapes of the AniList fields Newarix queries (see queries.ts).
// Schema reference: https://docs.anilist.co/reference/

export type MediaType = 'ANIME' | 'MANGA'
export type MediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
export type FuzzyDate = { year: number | null; month?: number | null; day?: number | null }

/** Fields from the `card` fragment, present on every list item. */
export type AniCard = {
  id: number
  idMal: number | null
  type: MediaType
  format: string | null
  status: MediaStatus | null
  episodes: number | null
  chapters: number | null
  seasonYear: number | null
  startDate: FuzzyDate
  averageScore: number | null
  popularity: number | null
  genres: string[]
  isAdult: boolean
  countryOfOrigin: string | null
  title: { romaji: string; english: string | null; native?: string | null }
  coverImage: { large: string | null; extraLarge: string | null }
}

export type AniDetail = AniCard & {
  siteUrl: string
  bannerImage: string | null
  description: string | null
  season: string | null
  duration: number | null
  source: string | null
  volumes: number | null
  favourites: number | null
  startDate: FuzzyDate
  endDate: FuzzyDate
  rankings: { rank: number; type: 'RATED' | 'POPULAR'; allTime: boolean }[]
  tags: { name: string; category: string; rank: number; isMediaSpoiler: boolean }[]
  studios: { nodes: { name: string }[] }
  trailer: { id: string; site: string } | null
  nextAiringEpisode: { airingAt: number; episode: number } | null
  externalLinks: { site: string; type: string; url: string }[]
  stats: { scoreDistribution: { amount: number }[] } | null
  relations: {
    edges: { relationType: string; node: { idMal: number | null; type: MediaType; title: { romaji: string; english: string | null } } }[]
  }
  staff: { edges: { role: string; node: { name: { full: string } } }[] }
  characters: {
    edges: {
      role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND'
      node: { id: number; name: { full: string }; image: { medium: string | null } }
      voiceActors: { name: { full: string }; image: { medium: string | null } }[]
    }[]
  }
  recommendations: { nodes: { rating: number; mediaRecommendation: AniCard | null }[] }
}

export type PageInfo = { currentPage: number; lastPage: number; hasNextPage: boolean }
export type AniPage = { pageInfo: PageInfo; media: AniCard[] }
export type AniEpisodes = {
  episodes: number | null
  coverImage: { extraLarge: string | null }
  bannerImage: string | null
  streamingEpisodes: { title: string | null; thumbnail: string | null }[]
  airingSchedule: { pageInfo: { hasNextPage: boolean }; nodes: { episode: number; airingAt: number }[] }
}
export type AniSchedule = { airingAt: number; episode: number; media: AniCard }
