// AniList GraphQL mock for end-to-end tests and offline development.
// Answers by operation name (Home, Browse, Detail, ...) with data shaped like
// the queries in src/server/anilist/queries.ts. Start with:
//   node e2e/mock-anilist.mjs   (then set ANILIST_URL=http://localhost:4545/graphql)
//
// Test hooks:
//   GET  /__fail429?n=3       next 3 GraphQL requests return 429
//   GET  /__hits              number of GraphQL requests served
//   POST /emails              captures outgoing email (Resend-compatible)
//   GET  /__mail?email=...    emails captured for an address
// Fixed ids: MAL id 99998 answers 503 (outage); ids >= 99999 are not found.
import http from 'node:http'

const PORT = Number(process.env.MOCK_PORT ?? process.env.MOCK_JIKAN_PORT ?? 4545)
const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Slice of Life', 'Mystery', 'Sports', 'Supernatural', 'Thriller']
const NAMES = ['Frieren', 'Kaiju Garden', 'Blue Lantern', 'Night Market', 'Starfall Academy', 'Ghost Ramen', 'Iron Bloom', 'Paper Moon', 'Tidebreaker', 'Hollow Crown', 'Velvet Signal', 'Summer Static', 'Mono Road', 'Ash & Petal', 'Clockwork Fox']
const HUES = [12, 48, 200, 280, 330, 160, 30, 230, 100, 300]
const DAY = 86_400
let hits = 0
let fail429 = 0
const mail = []

function svg(id) {
  const h = HUES[id % HUES.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="225" height="320" viewBox="0 0 225 320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 70% 55%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360} 60% 25%)"/></linearGradient></defs><rect width="225" height="320" fill="url(#g)"/><circle cx="160" cy="90" r="50" fill="hsl(${h} 90% 80% / .5)"/><text x="16" y="290" font-family="sans-serif" font-weight="800" font-size="34" fill="#fff">#${id}</text></svg>`
}
// data: URIs pass the production CSP without loosening img-src.
const poster = (id) => `data:image/svg+xml,${encodeURIComponent(svg(id))}`

function nameOf(id) {
  return `${NAMES[id % NAMES.length]}${id > NAMES.length ? ` ${Math.ceil(id / NAMES.length)}` : ''}`
}

function card(idMal, type = 'ANIME') {
  const anime = type === 'ANIME'
  const name = nameOf(idMal)
  return {
    id: 100_000 + idMal + (anime ? 0 : 500_000),
    idMal,
    type,
    format: anime ? ['TV', 'MOVIE', 'OVA', 'ONA'][idMal % 4] : ['MANGA', 'MANGA', 'NOVEL'][idMal % 3],
    countryOfOrigin: anime ? 'JP' : ['JP', 'KR', 'JP'][idMal % 3],
    status: idMal % 3 ? 'RELEASING' : 'FINISHED',
    episodes: anime ? (idMal % 7 === 0 ? null : [12, 13, 24, 25, 64, 220, 1100][idMal % 7]) : null,
    chapters: anime ? null : idMal % 5 === 0 ? null : 50 + idMal * 3,
    seasonYear: anime ? 2026 - (idMal % 10) : null,
    startDate: { year: 2026 - (idMal % 10) },
    averageScore: 60 + ((idMal * 37) % 40),
    popularity: 3_000_000 - idMal * 9000,
    genres: [GENRES[idMal % GENRES.length], GENRES[(idMal + 3) % GENRES.length], GENRES[(idMal + 7) % GENRES.length]],
    isAdult: false,
    title: { romaji: `${name} no Sekai`, english: name },
    coverImage: { large: poster(idMal), extraLarge: poster(idMal) },
  }
}

function detail(idMal, type) {
  const base = card(idMal, type)
  const anime = type === 'ANIME'
  const name = nameOf(idMal)
  return {
    ...base,
    siteUrl: `https://anilist.co/${anime ? 'anime' : 'manga'}/${base.id}`,
    bannerImage: poster(idMal + 1),
    description: `${name} follows a reluctant hero across a world that keeps rearranging itself.<br><br>`.repeat(idMal % 5 === 0 ? 10 : 2),
    season: anime ? 'FALL' : null,
    duration: anime ? 24 : null,
    source: 'MANGA',
    volumes: anime ? null : idMal % 5 === 0 ? null : 5 + idMal,
    favourites: 50_000 - idMal * 100,
    title: { ...base.title, native: '世界の物語' },
    startDate: { year: base.startDate.year, month: 4, day: 1 + (idMal % 8) },
    endDate: base.status === 'FINISHED' ? { year: base.startDate.year, month: 9, day: 20 } : { year: null, month: null, day: null },
    rankings: [
      { rank: idMal, type: 'RATED', allTime: true },
      { rank: idMal * 3, type: 'POPULAR', allTime: true },
    ],
    tags: [
      { name: 'Isekai', category: 'Theme-Fantasy', rank: 90, isMediaSpoiler: false },
      { name: 'Shounen', category: 'Demographic', rank: 80, isMediaSpoiler: false },
    ],
    studios: { nodes: anime ? [{ name: 'Madhouse' }] : [] },
    trailer: anime && idMal % 2 ? { id: 'dQw4w9WgXcQ', site: 'youtube' } : null,
    nextAiringEpisode:
      anime && base.status === 'RELEASING' ? { episode: 5, airingAt: Math.floor(Date.now() / 1000) + 3 * DAY } : null,
    externalLinks: anime ? [{ site: 'Crunchyroll', type: 'STREAMING', url: 'https://www.crunchyroll.com' }] : [],
    stats: { scoreDistribution: [{ amount: 400 }, { amount: idMal * 100 }] },
    relations: {
      edges: [
        { relationType: 'ADAPTATION', node: { idMal: idMal + 1000, type: anime ? 'MANGA' : 'ANIME', title: { romaji: `${name} (${anime ? 'manga' : 'anime'})`, english: null } } },
        { relationType: 'SEQUEL', node: { idMal: idMal + 1, type, title: { romaji: 'Next season', english: null } } },
      ],
    },
    staff: {
      edges: anime
        ? [{ role: 'Director', node: { name: { full: 'Keiichirou Saitou' } } }]
        : [
            { role: 'Story', node: { name: { full: 'Kanehito Yamada' } } },
            { role: 'Art', node: { name: { full: 'Tsukasa Abe' } } },
          ],
    },
    characters: {
      edges: Array.from({ length: 12 }, (_, i) => ({
        role: i < 3 ? 'MAIN' : 'SUPPORTING',
        node: { id: idMal * 100 + i, name: { full: `Character ${i + 1}` }, image: { medium: poster(i + 40) } },
        voiceActors: anime ? [{ name: { full: `Seiyuu ${i + 1}` }, image: { medium: poster(i + 60) } }] : [],
      })),
    },
    recommendations: {
      nodes: Array.from({ length: 10 }, (_, i) => ({ rating: 50 - i, mediaRecommendation: card(idMal + i + 1, type) })),
    },
  }
}

function pageOf(ids, page, perPage, total, type) {
  return {
    pageInfo: { currentPage: page, lastPage: Math.max(1, Math.ceil(total / perPage)), hasNextPage: page * perPage < total },
    media: ids.map((id) => card(id, type)),
  }
}

const range = (start, count) => Array.from({ length: count }, (_, i) => start + i)

function episodes(idMal, page) {
  const base = card(idMal)
  const total = base.episodes ?? 30
  const first = (page - 1) * 50 + 1
  const nodes = range(first, Math.max(0, Math.min(50, total - first + 1))).map((n) => ({
    episode: n,
    airingAt: Math.floor(Date.UTC(2026, 3, 1) / 1000) + (n - 1) * 7 * DAY,
  }))
  return {
    episodes: base.episodes,
    coverImage: { extraLarge: poster(idMal) },
    bannerImage: poster(idMal + 1),
    streamingEpisodes: range(1, Math.min(total, 150)).map((n) => ({
      title: `Episode ${n} - Episode title ${n}`,
      thumbnail: poster(n + 200),
    })),
    airingSchedule: { pageInfo: { hasNextPage: first + 50 <= total }, nodes },
  }
}

/** Returns [status, body] for a GraphQL request. */
function answer(operationName, v) {
  switch (operationName) {
    case 'Home':
      return [200, {
        data: {
          season: { media: range(1, 20).map((id) => card(id)) },
          airing: { media: range(1, 15).map((id) => card(id)) },
          top: { media: range(1, 15).map((id) => card(id)) },
          upcoming: { media: range(301, 15).map((id) => card(id)) },
          manga: { media: range(1, 15).map((id) => card(id, 'MANGA')) },
        },
      }]
    case 'Browse': {
      const page = v.page ?? 1
      const perPage = Math.min(v.perPage ?? 24, 50)
      if (v.search === 'zzzz') return [200, { data: { Page: pageOf([], page, perPage, 0, v.type) } }]
      const offset = v.search ? 40 : v.status === 'NOT_YET_RELEASED' ? 300 : 0
      return [200, { data: { Page: pageOf(range(offset + (page - 1) * perPage + 1, perPage), page, perPage, 200, v.type) } }]
    }
    case 'QuickSearch':
      return [200, {
        data: {
          anime: { media: range(41, 5).map((id) => card(id)) },
          manga: { media: range(41, 3).map((id) => card(id, 'MANGA')) },
        },
      }]
    case 'Detail':
    case 'Episodes': {
      if (v.idMal === 99998) return [503, { errors: [{ message: 'Service temporarily unavailable', status: 503 }] }]
      if (v.idMal >= 99999) return [404, { data: { Media: null }, errors: [{ message: 'Not Found.', status: 404 }] }]
      const media = operationName === 'Detail' ? detail(v.idMal, v.type ?? 'ANIME') : episodes(v.idMal, v.page ?? 1)
      return [200, { data: { Media: media } }]
    }
    case 'Schedule': {
      const start = v.from + 1
      // Vary the line-up by Japan-time weekday.
      const weekday = Math.floor((start + 9 * 3600) / DAY) % 7
      const rows = range(0, 12).map((k) => ({
        airingAt: start + 17 * 3600 + Math.floor(k / 3) * 1800,
        episode: k + 1,
        media: card(100 + weekday * 20 + k),
      }))
      return [200, { data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: v.page > 1 ? [] : rows } } }]
    }
    case 'Genres':
      return [200, { data: { GenreCollection: [...GENRES, 'Hentai'] } }]
    default:
      return [400, { data: null, errors: [{ message: `Mock has no answer for operation "${operationName}"` }] }]
  }
}

const readBody = (req) =>
  new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => resolve(body))
  })

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (url.pathname === '/emails' && req.method === 'POST') {
      mail.push(JSON.parse(await readBody(req)))
      return json(200, { id: `test-${mail.length}` })
    }
    if (url.pathname === '/__mail') {
      return json(200, mail.filter((m) => String([].concat(m.to)).includes(url.searchParams.get('email'))))
    }
    if (url.pathname === '/__fail429') {
      fail429 = Number(url.searchParams.get('n') ?? 2)
      return res.end('ok')
    }
    if (url.pathname === '/__hits') return res.end(String(hits))
    if (req.method !== 'POST') return json(404, { errors: [{ message: 'POST GraphQL requests to any path' }] })

    hits++
    const { operationName, variables = {} } = JSON.parse(await readBody(req))
    if (process.env.MOCK_LOG) console.log(new Date().toISOString().slice(11, 23), operationName, JSON.stringify(variables))
    if (fail429 > 0) {
      fail429--
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' })
      return res.end(JSON.stringify({ errors: [{ message: 'Too Many Requests.', status: 429 }] }))
    }
    const [status, body] = answer(operationName, variables)
    setTimeout(() => json(status, body), 120)
  })
  .listen(PORT, () => console.log(`mock AniList on http://localhost:${PORT}/graphql`))
