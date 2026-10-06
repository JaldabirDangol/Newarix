import { describe, expect, it } from 'vitest'
import {
  animeDetail,
  characters,
  displayTitle,
  formatJst,
  humanize,
  mangaDetail,
  plainText,
  recommendations,
  toCard,
  toCards,
} from './media'
import type { AniCard, AniDetail } from '#/server/anilist/types'

function card(overrides: Partial<AniCard> = {}): AniCard {
  return {
    id: 154587,
    idMal: 52991,
    type: 'ANIME',
    format: 'TV',
    status: 'FINISHED',
    episodes: 28,
    chapters: null,
    seasonYear: 2023,
    startDate: { year: 2023 },
    averageScore: 91,
    popularity: 600000,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    isAdult: false,
    countryOfOrigin: 'JP',
    title: {
      romaji: 'Sousou no Frieren',
      english: "Frieren: Beyond Journey's End",
    },
    coverImage: {
      large: 'https://s4.anilist.co/file/anilistcdn/l.jpg',
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/xl.jpg',
    },
    ...overrides,
  }
}

function detail(overrides: Partial<AniDetail> = {}): AniDetail {
  return {
    ...card(),
    siteUrl: 'https://anilist.co/anime/154587',
    bannerImage: null,
    description:
      'An elf mage.<br><br>She outlives her party &amp; learns <i>why</i> it mattered.',
    season: 'FALL',
    duration: 24,
    source: 'MANGA',
    volumes: null,
    favourites: 50000,
    title: {
      romaji: 'Sousou no Frieren',
      english: "Frieren: Beyond Journey's End",
      native: '葬送のフリーレン',
    },
    startDate: { year: 2023, month: 9, day: 29 },
    endDate: { year: 2024, month: 3, day: 22 },
    rankings: [
      { rank: 1, type: 'RATED', allTime: true },
      { rank: 3, type: 'RATED', allTime: false },
      { rank: 52, type: 'POPULAR', allTime: true },
    ],
    tags: [
      {
        name: 'Travel',
        category: 'Theme-Other',
        rank: 96,
        isMediaSpoiler: false,
      },
      {
        name: 'Twist',
        category: 'Theme-Other',
        rank: 90,
        isMediaSpoiler: true,
      },
      {
        name: 'Shounen',
        category: 'Demographic',
        rank: 80,
        isMediaSpoiler: false,
      },
      {
        name: 'Minor',
        category: 'Theme-Other',
        rank: 20,
        isMediaSpoiler: false,
      },
    ],
    studios: { nodes: [{ name: 'Madhouse' }] },
    trailer: { id: 'tR8YH0G67Rk', site: 'youtube' },
    nextAiringEpisode: null,
    externalLinks: [
      {
        site: 'Crunchyroll',
        type: 'STREAMING',
        url: 'https://crunchyroll.com/x',
      },
      { site: 'Twitter', type: 'SOCIAL', url: 'https://x.com/x' },
    ],
    stats: { scoreDistribution: [{ amount: 10 }, { amount: 90 }] },
    relations: {
      edges: [
        {
          relationType: 'ADAPTATION',
          node: {
            idMal: 126287,
            type: 'MANGA',
            title: { romaji: 'Sousou no Frieren', english: null },
          },
        },
        {
          relationType: 'SIDE_STORY',
          node: {
            idMal: null,
            type: 'ANIME',
            title: { romaji: 'No MAL id', english: null },
          },
        },
      ],
    },
    staff: {
      edges: [
        { role: 'Story', node: { name: { full: 'Kanehito Yamada' } } },
        { role: 'Art', node: { name: { full: 'Tsukasa Abe' } } },
        { role: 'Translator (English)', node: { name: { full: 'Someone' } } },
      ],
    },
    characters: {
      edges: [
        {
          role: 'MAIN',
          node: {
            id: 1,
            name: { full: 'Frieren' },
            image: { medium: 'c.jpg' },
          },
          voiceActors: [
            { name: { full: 'Atsumi Tanezaki' }, image: { medium: 'v.jpg' } },
          ],
        },
      ],
    },
    recommendations: {
      nodes: [
        {
          rating: 120,
          mediaRecommendation: card({
            idMal: 51,
            title: { romaji: 'Rec', english: null },
          }),
        },
        { rating: 40, mediaRecommendation: card({ idMal: null }) },
        { rating: 10, mediaRecommendation: null },
      ],
    },
    ...overrides,
  }
}

describe('cards', () => {
  it('uses the MAL id and scales the score to 0–10', () => {
    const c = toCard(card())
    expect(c).toMatchObject({
      id: 52991,
      kind: 'anime',
      score: 9.1,
      count: 28,
      year: 2023,
      type: 'TV',
      status: 'Finished',
    })
  })

  it('skips titles without a MAL id', () => {
    expect(toCard(card({ idMal: null }))).toBeNull()
    expect(toCards([card(), card({ idMal: null }), card()])).toHaveLength(1)
  })

  it('treats a missing score as no score', () => {
    expect(toCard(card({ averageScore: null }))?.score).toBeNull()
  })

  it('labels manhwa and manhua by country', () => {
    const manga = {
      type: 'MANGA' as const,
      format: 'MANGA',
      chapters: 120,
      episodes: null,
    }
    expect(toCard(card({ ...manga, countryOfOrigin: 'KR' }))?.type).toBe(
      'Manhwa',
    )
    expect(toCard(card({ ...manga, countryOfOrigin: 'CN' }))?.type).toBe(
      'Manhua',
    )
    expect(toCard(card({ ...manga, countryOfOrigin: 'JP' }))).toMatchObject({
      type: 'Manga',
      count: 120,
      kind: 'manga',
    })
  })

  it('shows the English title when there is one', () => {
    expect(displayTitle(toCard(card())!)).toBe("Frieren: Beyond Journey's End")
    expect(
      displayTitle(
        toCard(card({ title: { romaji: 'Romaji', english: null } }))!,
      ),
    ).toBe('Romaji')
  })
})

describe('details', () => {
  it('maps anime details', () => {
    const a = animeDetail(detail())!
    expect(a).toMatchObject({
      rank: 1,
      popularity: 52,
      scoredBy: 100,
      titleJapanese: '葬送のフリーレン',
      source: 'Manga',
      duration: '24 min per episode',
      season: 'fall',
      aired: 'Sep 29, 2023 to Mar 22, 2024',
      studios: ['Madhouse'],
      trailerId: 'tR8YH0G67Rk',
      streaming: [{ name: 'Crunchyroll', url: 'https://crunchyroll.com/x' }],
      malUrl: 'https://myanimelist.net/anime/52991',
      broadcast: null,
    })
  })

  it('hides spoiler and low-ranked tags, and splits out demographics', () => {
    const a = animeDetail(detail())!
    expect(a.themes).toEqual(['Travel'])
    expect(a.demographics).toEqual(['Shounen'])
  })

  it('keeps only relations that have a MAL id', () => {
    expect(animeDetail(detail())!.relations).toEqual([
      {
        relation: 'Adaptation',
        entries: [{ id: 126287, kind: 'manga', name: 'Sousou no Frieren' }],
      },
    ])
  })

  it('formats the next episode in Japan time', () => {
    const a = animeDetail(
      detail({
        status: 'RELEASING',
        nextAiringEpisode: { episode: 5, airingAt: 1_791_900_000 },
      }),
    )!
    expect(a.airing).toBe(true)
    expect(a.broadcast).toBe(`Episode 5 · ${formatJst(1_791_900_000)}`)
    expect(a.aired).toBe('Sep 29, 2023 to Mar 22, 2024')
  })

  it('lists story and art credits as manga authors', () => {
    const m = mangaDetail(
      detail({ type: 'MANGA', format: 'MANGA', chapters: 140, volumes: 14 }),
    )!
    expect(m.authors).toEqual(['Kanehito Yamada (Story)', 'Tsukasa Abe (Art)'])
    expect(m).toMatchObject({ kind: 'manga', count: 140, volumes: 14 })
  })

  it('returns null for a title without a MAL id', () => {
    expect(animeDetail(detail({ idMal: null }))).toBeNull()
  })

  it('maps characters and recommendations', () => {
    expect(characters(detail())).toEqual([
      {
        id: 1,
        name: 'Frieren',
        image: 'c.jpg',
        role: 'Main',
        voiceActor: { name: 'Atsumi Tanezaki', image: 'v.jpg' },
      },
    ])
    expect(recommendations(detail()).map((r) => [r.id, r.votes])).toEqual([
      [51, 120],
    ])
  })
})

describe('text helpers', () => {
  it('turns AniList descriptions into plain text', () => {
    expect(plainText(detail().description)).toBe(
      'An elf mage.\n\nShe outlives her party & learns why it mattered.',
    )
    expect(plainText('<br>')).toBeNull()
    expect(plainText(null)).toBeNull()
  })

  it('humanizes enums', () => {
    expect(humanize('SIDE_STORY')).toBe('Side story')
    expect(humanize('LIGHT_NOVEL')).toBe('Light novel')
  })

  it('formats times in JST regardless of the server timezone', () => {
    // 2026-10-09 14:00 UTC = 23:00 JST
    expect(formatJst(Date.UTC(2026, 9, 9, 14, 0) / 1000)).toBe(
      'Fri, Oct 9, 23:00 JST',
    )
  })
})

it('rejects executable or credential-bearing external links', async () => {
  const { safeHttpsUrl } = await import('./media')
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    'http://example.com',
    'https://user:pass@example.com',
    '//example.com',
  ])
    expect(safeHttpsUrl(url)).toBeNull()
  expect(safeHttpsUrl('https://example.com/watch')).toBe(
    'https://example.com/watch',
  )
})
