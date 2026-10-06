import { describe, expect, it } from 'vitest'
import { currentSeason, formatVars, jstDayRange, searchVars, topVars } from './vars'

describe('formatVars', () => {
  it('maps URL formats to AniList formats', () => {
    expect(formatVars('anime', 'tv_short')).toEqual({ format_in: ['TV_SHORT'] })
    expect(formatVars('manga', 'oneshot')).toEqual({ format_in: ['ONE_SHOT'] })
    expect(formatVars('manga', 'novel')).toEqual({ format_in: ['NOVEL'] })
  })

  it('uses the country of origin for manga, manhwa and manhua', () => {
    expect(formatVars('manga', 'manga')).toEqual({ format_in: ['MANGA'], country: 'JP' })
    expect(formatVars('manga', 'manhwa')).toEqual({ format_in: ['MANGA'], country: 'KR' })
    expect(formatVars('manga', 'manhua')).toEqual({ format_in: ['MANGA'], country: 'CN' })
  })

  it('ignores formats that do not belong to the media type', () => {
    expect(formatVars('anime', 'manhwa')).toEqual({})
    expect(formatVars('manga', 'tv')).toEqual({})
    expect(formatVars('anime', undefined)).toEqual({})
  })
})

describe('topVars', () => {
  it('maps ranking tabs to status and sort', () => {
    expect(topVars('anime', undefined)).toEqual({ sort: ['SCORE_DESC'] })
    expect(topVars('anime', 'airing')).toEqual({ status: 'RELEASING', sort: ['SCORE_DESC'] })
    expect(topVars('manga', 'publishing')).toEqual({ status: 'RELEASING', sort: ['SCORE_DESC'] })
    expect(topVars('anime', 'upcoming')).toEqual({ status: 'NOT_YET_RELEASED', sort: ['POPULARITY_DESC'] })
    expect(topVars('anime', 'favorite')).toEqual({ sort: ['FAVOURITES_DESC'] })
  })

  it('falls back to top rated for an unknown tab', () => {
    expect(topVars('anime', 'publishing')).toEqual({ sort: ['SCORE_DESC'] })
  })
})

describe('searchVars', () => {
  it('sorts by best match with a query and by popularity without', () => {
    expect(searchVars({ kind: 'anime', q: 'frieren' }).sort).toEqual(['SEARCH_MATCH'])
    expect(searchVars({ kind: 'anime', q: '  ' })).toMatchObject({ sort: ['POPULARITY_DESC'], search: undefined })
  })

  it('maps every filter', () => {
    expect(
      searchVars({
        kind: 'manga',
        q: 'berserk',
        genres: 'Action,Slice of Life',
        type: 'manhwa',
        status: 'discontinued',
        year: 2020,
        minScore: 8,
        orderBy: 'score',
        sort: 'asc',
        page: 3,
      }),
    ).toEqual({
      type: 'MANGA',
      page: 3,
      perPage: 24,
      sort: ['SCORE'],
      search: 'berserk',
      status: 'CANCELLED',
      genre_in: ['Action', 'Slice of Life'],
      format_in: ['MANGA'],
      country: 'KR',
      scoreGreater: 79,
      startGreater: 20199999,
      startLesser: 20210000,
    })
  })

  it('sorts titles A→Z by default and other orders highest first', () => {
    expect(searchVars({ kind: 'anime', orderBy: 'title' }).sort).toEqual(['TITLE_ROMAJI'])
    expect(searchVars({ kind: 'anime', orderBy: 'trending' }).sort).toEqual(['TRENDING_DESC'])
  })
})

describe('currentSeason', () => {
  it('maps months to AniList seasons', () => {
    expect(currentSeason(new Date(Date.UTC(2026, 0, 15)))).toEqual({ season: 'WINTER', year: 2026 })
    expect(currentSeason(new Date(Date.UTC(2026, 6, 1)))).toEqual({ season: 'SUMMER', year: 2026 })
    expect(currentSeason(new Date(Date.UTC(2026, 9, 5)))).toEqual({ season: 'FALL', year: 2026 })
  })
})

describe('jstDayRange', () => {
  // Monday 2026-10-05 12:00 JST
  const now = Date.UTC(2026, 9, 5, 3, 0)

  it('covers one Japan-time day in the current Monday–Sunday week', () => {
    const [from, to] = jstDayRange('monday', now)
    expect(from + 1).toBe(Date.UTC(2026, 9, 4, 15, 0) / 1000) // Mon 00:00 JST
    expect(to - from - 1).toBe(86_400)
    const [satFrom] = jstDayRange('saturday', now)
    expect(satFrom + 1).toBe(Date.UTC(2026, 9, 9, 15, 0) / 1000) // Sat 00:00 JST
  })

  it('treats late Sunday UTC as Monday in Japan', () => {
    const sundayNightUtc = Date.UTC(2026, 9, 4, 20, 0) // Mon 05:00 JST
    expect(jstDayRange('monday', sundayNightUtc)[0]).toBe(jstDayRange('monday', now)[0])
  })
})
