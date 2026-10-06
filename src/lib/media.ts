import type { AniCard, AniDetail, FuzzyDate } from '#/server/anilist/types'
import type { ListStatus } from './status'

// Slim, serializable shapes sent from the server to the UI. AniList objects
// are trimmed before they reach the page payload.
//
// Ids are MyAnimeList ids (AniList's `idMal`), so URLs and saved list entries
// stay stable regardless of the data source. Titles without a MAL id are
// skipped by the catalog functions.

export type MediaKind = 'anime' | 'manga'

export type MediaCard = {
  listStatus?: ListStatus | null
  id: number
  kind: MediaKind
  title: string
  titleEnglish: string | null
  image: string | null
  imageLarge: string | null
  /** 0–10 with one decimal (AniList's average score / 10). */
  score: number | null
  rank: number | null
  type: string | null
  status: string | null
  /** Episodes for anime, chapters for manga. */
  count: number | null
  year: number | null
  genres: string[]
  /** Users with the title on their AniList list. */
  members: number | null
}

export type Relation = {
  relation: string
  entries: { id: number; kind: MediaKind; name: string }[]
}

type DetailBase = MediaCard & {
  titleJapanese: string | null
  synopsis: string | null
  background: string | null
  scoredBy: number | null
  popularity: number | null
  favorites: number | null
  themes: string[]
  demographics: string[]
  relations: Relation[]
  malUrl: string
  siteUrl: string
}

export type AnimeDetail = DetailBase & {
  kind: 'anime'
  airing: boolean
  source: string | null
  duration: string | null
  rating: string | null
  season: string | null
  aired: string | null
  /** Next episode and when it airs, in Japan time, e.g. "Episode 5 · Fri, Oct 9, 23:00 JST". */
  broadcast: string | null
  studios: string[]
  producers: string[]
  trailerId: string | null
  streaming: { name: string; url: string }[]
}

export type MangaDetail = DetailBase & {
  kind: 'manga'
  publishing: boolean
  volumes: number | null
  published: string | null
  authors: string[]
  serializations: string[]
}

export type Character = {
  id: number
  name: string
  image: string | null
  role: string
  voiceActor: { name: string; image: string | null } | null
}

export type Recommendation = MediaCard & { votes: number }

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  MANGA: 'Manga',
  NOVEL: 'Light novel',
  ONE_SHOT: 'One-shot',
}

function formatLabel(m: Pick<AniCard, 'format' | 'countryOfOrigin'>) {
  if (!m.format) return null
  if (m.format === 'MANGA' && m.countryOfOrigin === 'KR') return 'Manhwa'
  if (m.format === 'MANGA' && m.countryOfOrigin === 'CN') return 'Manhua'
  return FORMAT_LABELS[m.format] ?? m.format
}

function statusLabel(status: AniCard['status'], kind: MediaKind) {
  switch (status) {
    case 'FINISHED':
      return 'Finished'
    case 'RELEASING':
      return kind === 'anime' ? 'Airing' : 'Publishing'
    case 'NOT_YET_RELEASED':
      return 'Not yet released'
    case 'CANCELLED':
      return 'Cancelled'
    case 'HIATUS':
      return 'On hiatus'
    default:
      return null
  }
}

/** Upper-snake enums (SIDE_STORY, LIGHT_NOVEL) as sentence case. */
export function humanize(value: string) {
  const text = value.toLowerCase().replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fuzzyDate(d: FuzzyDate | null | undefined) {
  if (!d?.year) return null
  if (!d.month) return String(d.year)
  return `${MONTHS[d.month - 1]}${d.day ? ` ${d.day},` : ''} ${d.year}`
}

function dateRange(start: FuzzyDate, end: FuzzyDate, ongoing: boolean) {
  const from = fuzzyDate(start)
  if (!from) return null
  const to = fuzzyDate(end)
  if (to && to !== from) return `${from} to ${to}`
  return ongoing ? `${from} to ?` : from
}

const jst = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Formats a unix time in Japan time, the same on server and client. */
export function formatJst(unixSeconds: number) {
  return `${jst.format(new Date(unixSeconds * 1000))} JST`
}

/** AniList descriptions contain light HTML (<br>, <i>) even in text mode. */
export function plainText(html: string | null) {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || null
}

const kindOf = (type: AniCard['type']): MediaKind => (type === 'MANGA' ? 'manga' : 'anime')

/** Null when AniList has no MAL id for the title (it can't be tracked or linked). */
export function toCard(m: AniCard): MediaCard | null {
  if (!m.idMal) return null
  const kind = kindOf(m.type)
  return {
    id: m.idMal,
    kind,
    title: m.title.romaji,
    titleEnglish: m.title.english,
    image: m.coverImage.large ?? m.coverImage.extraLarge,
    imageLarge: m.coverImage.extraLarge ?? m.coverImage.large,
    score: m.averageScore ? m.averageScore / 10 : null,
    rank: null,
    type: formatLabel(m),
    status: statusLabel(m.status, kind),
    count: kind === 'anime' ? m.episodes : m.chapters,
    year: m.seasonYear ?? m.startDate.year,
    genres: m.genres,
    members: m.popularity,
  }
}

export function toCards(list: AniCard[]): MediaCard[] {
  const seen = new Set<string>()
  const cards: MediaCard[] = []
  for (const m of list) {
    const card = toCard(m)
    if (!card || seen.has(`${card.kind}:${card.id}`)) continue
    seen.add(`${card.kind}:${card.id}`)
    cards.push(card)
  }
  return cards
}

function ranking(m: AniDetail, type: 'RATED' | 'POPULAR') {
  return m.rankings.find((r) => r.type === type && r.allTime)?.rank ?? null
}

function relations(m: AniDetail): Relation[] {
  const groups = new Map<string, Relation>()
  for (const edge of m.relations.edges) {
    if (!edge.node.idMal) continue
    const label = humanize(edge.relationType)
    const group = groups.get(label) ?? { relation: label, entries: [] }
    group.entries.push({
      id: edge.node.idMal,
      kind: kindOf(edge.node.type),
      name: edge.node.title.english || edge.node.title.romaji,
    })
    groups.set(label, group)
  }
  return [...groups.values()]
}

function detailBase(m: AniDetail, card: MediaCard) {
  const tags = m.tags.filter((t) => !t.isMediaSpoiler && t.rank >= 60)
  const scoredBy = m.stats?.scoreDistribution.reduce((n, s) => n + s.amount, 0)
  return {
    ...card,
    rank: ranking(m, 'RATED'),
    titleJapanese: m.title.native ?? null,
    synopsis: plainText(m.description),
    background: null,
    scoredBy: scoredBy || null,
    popularity: ranking(m, 'POPULAR'),
    favorites: m.favourites,
    themes: tags
      .filter((t) => t.category !== 'Demographic')
      .slice(0, 8)
      .map((t) => t.name),
    demographics: m.tags.filter((t) => t.category === 'Demographic').map((t) => t.name),
    relations: relations(m),
    malUrl: `https://myanimelist.net/${card.kind}/${card.id}`,
    siteUrl: m.siteUrl,
  }
}

export function animeDetail(m: AniDetail): AnimeDetail | null {
  const card = toCard(m)
  if (!card) return null
  const next = m.nextAiringEpisode
  return {
    ...detailBase(m, card),
    kind: 'anime',
    airing: m.status === 'RELEASING',
    source: m.source ? humanize(m.source) : null,
    duration: m.duration ? `${m.duration} min${m.episodes === 1 ? '' : ' per episode'}` : null,
    rating: null,
    season: m.season ? m.season.toLowerCase() : null,
    aired: dateRange(m.startDate, m.endDate, m.status === 'RELEASING'),
    broadcast: next ? `Episode ${next.episode} · ${formatJst(next.airingAt)}` : null,
    studios: m.studios.nodes.map((s) => s.name),
    producers: [],
    trailerId: m.trailer?.site === 'youtube' ? m.trailer.id : null,
    streaming: m.externalLinks.filter((l) => l.type === 'STREAMING').map((l) => ({ name: l.site, url: l.url })),
  }
}

const AUTHOR_ROLE = /^(story|art|original creator|original story)/i

export function mangaDetail(m: AniDetail): MangaDetail | null {
  const card = toCard(m)
  if (!card) return null
  const authors = m.staff.edges
    .filter((e) => AUTHOR_ROLE.test(e.role))
    .map((e) => `${e.node.name.full} (${e.role.replace(/\s*\(.*\)$/, '')})`)
  return {
    ...detailBase(m, card),
    kind: 'manga',
    publishing: m.status === 'RELEASING',
    volumes: m.volumes,
    published: dateRange(m.startDate, m.endDate, m.status === 'RELEASING'),
    authors: [...new Set(authors)],
    serializations: [],
  }
}

export function characters(m: AniDetail): Character[] {
  return m.characters.edges.map((e) => {
    const va = e.voiceActors.at(0)
    return {
      id: e.node.id,
      name: e.node.name.full,
      image: e.node.image.medium,
      role: humanize(e.role),
      voiceActor: va ? { name: va.name.full, image: va.image.medium } : null,
    }
  })
}

export function recommendations(m: AniDetail): Recommendation[] {
  const items: Recommendation[] = []
  for (const node of m.recommendations.nodes) {
    const card = node.mediaRecommendation ? toCard(node.mediaRecommendation) : null
    if (card && node.mediaRecommendation && !node.mediaRecommendation.isAdult) {
      items.push({ ...card, votes: node.rating })
    }
  }
  return items.slice(0, 12)
}

/** English title when the user would recognise it more easily. */
export function displayTitle(m: Pick<MediaCard, 'title' | 'titleEnglish'>) {
  return m.titleEnglish || m.title
}
