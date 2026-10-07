import { store } from './kv'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chapterFeed,
  chapterImages,
  loadChapter,
  loadChapterPage,
  matchManga,
  readerChapter,
  safeExternalUrl,
} from './mangadex'

vi.mock('./kv', () => ({
  store: {
    get: vi.fn(async (): Promise<string | null> => null),
    set: async () => {},
    reserveSlot: async () => 0,
  },
}))
const mangaId = '58be6aa6-06cb-4ca5-bd20-f1392ce451fb'
const chapterId = 'ff4f79de-6102-4610-8327-539904cfe549'
const groupId = 'e8123dbe-b228-4a8a-b38a-40aacfeb2682'
const chapter = {
  id: chapterId,
  attributes: {
    title: 'Moving',
    chapter: '1',
    translatedLanguage: 'en',
    pages: 2,
    externalUrl: null,
  },
  relationships: [
    { id: mangaId, type: 'manga' },
    {
      id: groupId,
      type: 'scanlation_group',
      attributes: { name: 'Test translators' },
    },
  ],
}
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.mocked(store.get).mockReset().mockResolvedValue(null)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
function respond(data: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data)))
}

describe('MangaDex reader', () => {
  it('matches MAL IDs rather than the first similarly named title', async () => {
    respond({
      data: [
        {
          id: chapterId,
          attributes: {
            links: { mal: '999' },
            availableTranslatedLanguages: ['en'],
          },
        },
        {
          id: mangaId,
          attributes: {
            links: { mal: '104' },
            availableTranslatedLanguages: ['en', null, 'ja'],
          },
        },
      ],
    })
    expect(await matchManga(104, ['Yotsuba'])).toEqual({
      id: mangaId,
      languages: ['en', 'ja'],
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'contentRating%5B%5D=erotica',
    )
    respond({ data: [] })
    expect(await matchManga(9999, ['Missing'])).toBeNull()
  })

  it('uses AniList links when a MAL link is missing', async () => {
    respond({
      data: [
        {
          id: mangaId,
          attributes: {
            links: { al: '30025' },
            availableTranslatedLanguages: ['en'],
          },
        },
      ],
    })
    expect(await matchManga(25, ['Fullmetal Alchemist'], 30025)).toMatchObject({
      id: mangaId,
    })
  })

  it('matches a unique exact alternate title without catalog links', async () => {
    respond({
      data: [
        {
          id: mangaId,
          attributes: {
            links: null,
            title: { en: 'Boku no Hero Academia' },
            altTitles: [{ en: 'My Hero Academia' }],
            availableTranslatedLanguages: ['en'],
          },
        },
      ],
    })
    expect(await matchManga(75989, ['My Hero Academia'])).toMatchObject({
      id: mangaId,
    })
  })

  it('rejects ambiguous exact titles and conflicting catalog IDs', async () => {
    const attributes = {
      links: null,
      title: { en: 'Shared title' },
      availableTranslatedLanguages: ['en'],
    }
    respond({
      data: [
        { id: mangaId, attributes },
        { id: chapterId, attributes },
      ],
    })
    expect(await matchManga(25, ['Shared title'])).toBeNull()
    respond({
      data: [
        { id: mangaId, attributes: { ...attributes, links: { mal: '999' } } },
      ],
    })
    expect(await matchManga(25, ['Shared title'])).toBeNull()
  })

  it('proxies smaller images with original-format fallback and checks page bounds', async () => {
    const pages = {
      baseUrl: 'https://abc.mangadex.network',
      chapter: {
        hash: 'a'.repeat(32),
        data: ['page.png'],
        dataSaver: ['page.jpg'],
      },
    }
    respond({ data: chapter })
    respond(pages)
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/png' },
      }),
    )
    expect(await loadChapterPage(mangaId, chapterId, 0)).toMatchObject({
      type: 'image/png',
      bytes: Buffer.from([1, 2, 3]),
    })
    expect(String(fetchMock.mock.calls[2][0])).toContain('/data-saver/')
    expect(String(fetchMock.mock.calls[3][0])).toContain('/data/')
    respond({ data: chapter })
    respond(pages)
    await expect(loadChapterPage(mangaId, chapterId, 99)).rejects.toThrow(
      'does not exist',
    )
  })

  it('refreshes a cached image source once when both formats fail', async () => {
    const pages = {
      baseUrl: 'https://expired.mangadex.network',
      chapter: {
        hash: 'a'.repeat(32),
        data: ['page.png'],
        dataSaver: ['page.jpg'],
      },
    }
    vi.mocked(store.get).mockImplementation(async (key) =>
      JSON.stringify(key.includes('/at-home/') ? pages : { data: chapter }),
    )
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))
    respond({ data: chapter })
    respond({ ...pages, baseUrl: 'https://fresh.mangadex.network' })
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    )
    expect(await loadChapterPage(mangaId, chapterId, 0)).toMatchObject({
      type: 'image/jpeg',
      bytes: Buffer.from([1, 2, 3]),
    })
    expect(String(fetchMock.mock.calls[3][0])).toContain('/at-home/server/')
    expect(String(fetchMock.mock.calls[4][0])).toContain(
      'fresh.mangadex.network',
    )
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('stops after one fresh source retry when image delivery remains unavailable', async () => {
    const pages = {
      baseUrl: 'https://offline.mangadex.network',
      chapter: { hash: 'a'.repeat(32), data: ['page.png'] },
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      respond({ data: chapter })
      respond(pages)
      fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    }
    await expect(loadChapterPage(mangaId, chapterId, 0)).rejects.toThrow(
      'could not deliver this page',
    )
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it.skipIf(process.env.MANGADEX_LIVE !== '1')(
    'opens the Berserk chapter shown in the failed reader screenshot',
    async () => {
      vi.unstubAllGlobals()
      vi.stubEnv('MANGADEX_API_URL', 'https://api.mangadex.org')
      const berserkId = '801513ba-a712-498c-8f57-cae55b38cc92'
      const reportedChapterId = '0a2a4b71-cdc3-47a5-be49-bfd09d666968'
      const reading = await loadChapter(berserkId, reportedChapterId)
      expect(reading.images).toHaveLength(53)
      const page = await loadChapterPage(berserkId, reportedChapterId, 0)
      expect(page.bytes.length).toBeGreaterThan(1000)
      expect(page.type).toMatch(/^image\//)
    },
    60_000,
  )

  it.skipIf(process.env.MANGADEX_LIVE !== '1')(
    'opens the reported Fullmetal Alchemist chapter against live MangaDex',
    async () => {
      vi.unstubAllGlobals()
      vi.stubEnv('MANGADEX_API_URL', 'https://api.mangadex.org')
      expect(await matchManga(2, ['Berserk'])).not.toBeNull()
      const match = await matchManga(25, ['Fullmetal Alchemist'], 30025)
      expect(match).not.toBeNull()
      const reportedChapterId = '90c87477-123e-444c-8723-880ac9acb407'
      const reportedChapter = await loadChapter(match!.id, reportedChapterId)
      expect(reportedChapter.images).toHaveLength(43)
      const page = await loadChapterPage(match!.id, reportedChapterId, 0)
      expect(page.bytes.length).toBeGreaterThan(1000)
      expect(page.type).toMatch(/^image\//)
    },
    60_000,
  )

  it('paginates by raw results even when unavailable chapters are filtered', async () => {
    respond({
      data: [
        chapter,
        {
          ...chapter,
          attributes: { ...chapter.attributes, isUnavailable: true },
        },
      ],
      total: 3,
      limit: 100,
    })
    const data = await chapterFeed(mangaId, 'en', 0)
    expect(data.chapters).toHaveLength(1)
    expect(data).toMatchObject({ nextOffset: 2, hasMore: true })
    expect(data.chapters[0].groups).toEqual([
      { id: groupId, name: 'Test translators' },
    ])
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'translatedLanguage%5B%5D=en',
    )
  })

  it('honors group exclusions and rejects unsafe publisher links', () => {
    vi.stubEnv('MANGADEX_BLOCKED_GROUPS', groupId)
    expect(readerChapter(chapter)).toBeNull()
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('https://user:pass@example.com')).toBeNull()
    expect(
      safeExternalUrl('https://mangaplus.shueisha.co.jp/viewer/1'),
    ).toContain('mangaplus')
  })

  it('keeps external chapters external and verifies chapter ownership', async () => {
    respond({
      data: {
        ...chapter,
        attributes: {
          ...chapter.attributes,
          pages: 0,
          externalUrl: 'https://mangaplus.shueisha.co.jp/viewer/1',
        },
      },
    })
    expect(await loadChapter(mangaId, chapterId)).toMatchObject({
      images: [],
      chapter: { externalUrl: 'https://mangaplus.shueisha.co.jp/viewer/1' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    respond({ data: chapter })
    await expect(loadChapter(groupId, chapterId)).rejects.toThrow(
      'another manga',
    )
  })

  it('builds direct HTTPS page URLs and rejects forged image hosts and paths', () => {
    const data = {
      baseUrl: 'https://abc.mangadex.network/token',
      chapter: { hash: 'a'.repeat(32), data: ['1-page.jpg'] },
    }
    expect(chapterImages(data)[0]).toBe(
      `https://abc.mangadex.network/token/data/${'a'.repeat(32)}/1-page.jpg`,
    )
    expect(() =>
      chapterImages({ ...data, baseUrl: 'https://mangadex.network.evil.com' }),
    ).toThrow()
    expect(() =>
      chapterImages({
        ...data,
        chapter: { ...data.chapter, data: ['../secret'] },
      }),
    ).toThrow()
  })

  it('returns an actionable error when the API throttles requests', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }))
    await expect(matchManga(104, ['Yotsuba'])).rejects.toThrow(
      'Try again in a minute',
    )
  })
})
