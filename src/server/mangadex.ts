import { z } from 'zod'
import { store } from './kv'

const relation = z.object({
  id: z.uuid(),
  type: z.string(),
  attributes: z.object({ name: z.string().optional() }).optional(),
})
const chapterSchema = z.object({
  id: z.uuid(),
  attributes: z.object({
    title: z.string().nullable(),
    chapter: z.string().nullable(),
    translatedLanguage: z.string(),
    pages: z.number().int().nonnegative(),
    externalUrl: z.string().nullable().optional(),
    isUnavailable: z.boolean().optional(),
  }),
  relationships: z.array(relation),
})
const mangaSchema = z.object({
  id: z.uuid(),
  attributes: z.object({
    title: z.record(z.string(), z.string()).optional(),
    altTitles: z.array(z.record(z.string(), z.string())).optional(),
    links: z.record(z.string(), z.string()).nullable(),
    availableTranslatedLanguages: z.array(z.string().nullable()),
  }),
})

export type ReaderChapter = {
  id: string
  number: string | null
  title: string | null
  pages: number
  externalUrl: string | null
  groups: { id: string; name: string }[]
}

function blockedGroups() {
  return new Set(
    (process.env.MANGADEX_BLOCKED_GROUPS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

export function readerChapter(
  raw: z.infer<typeof chapterSchema>,
): ReaderChapter | null {
  const groups = raw.relationships.filter((r) => r.type === 'scanlation_group')
  if (
    raw.attributes.isUnavailable ||
    groups.some((g) => blockedGroups().has(g.id))
  )
    return null
  const externalUrl = safeExternalUrl(raw.attributes.externalUrl)
  if (raw.attributes.externalUrl && !externalUrl) return null
  if (!externalUrl && raw.attributes.pages === 0) return null
  return {
    id: raw.id,
    number: raw.attributes.chapter,
    title: raw.attributes.title,
    pages: raw.attributes.pages,
    externalUrl,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.attributes?.name ?? 'Scanlation group',
    })),
  }
}

const pending = new Map<string, Promise<unknown>>()
async function request(
  path: string,
  ttl = 60_000,
  fresh = false,
): Promise<unknown> {
  const key = `mangadex:v1:${path}`
  const cached = fresh ? null : await store.get(key)
  if (cached) return JSON.parse(cached)
  const existing = pending.get(key)
  if (existing) return existing
  const promise = (async () => {
    const deadline = Date.now() + 12_000
    let reserved = false
    while (!reserved) {
      const wait = await store.reserveSlot('mangadex:budget', {
        perSecond: 4,
        perMinute: 180,
        minGapMs: 260,
      })
      if (!wait) {
        reserved = true
        continue
      }
      if (Date.now() + wait > deadline)
        throw new Error('MangaDex is busy. Try again shortly.')
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
    if (path.startsWith('/at-home/')) {
      const wait = await store.reserveSlot('mangadex:pages-budget', {
        perSecond: 4,
        perMinute: 35,
        minGapMs: 260,
      })
      if (wait) throw new Error('MangaDex is busy. Try again shortly.')
    }
    const api = process.env.MANGADEX_API_URL ?? 'https://api.mangadex.org'
    const apiUrl = new URL(api)
    if (
      api !== 'https://api.mangadex.org' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname)
    )
      throw new Error('MangaDex overrides must use a local test server')
    const response = await fetch(`${api}${path}`, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Newarix/1.0 (MangaDex reader)',
      },
    })
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? 'MangaDex is busy. Try again in a minute.'
          : 'MangaDex could not load this. Try again shortly.',
      )
    const data: unknown = await response.json()
    await store.set(key, JSON.stringify(data), ttl)
    return data
  })().finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}

function normalizedTitle(title: string) {
  return title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export async function matchManga(
  malId: number,
  titles: string[],
  anilistId?: number,
) {
  const candidates = new Map<string, z.infer<typeof mangaSchema>>()
  const searches = [...new Set(titles.filter(Boolean))].slice(0, 3)
  const simplified = searches
    .map((title) =>
      title
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((title) => title && !searches.includes(title))
  for (const title of [...searches, ...simplified].slice(0, 5)) {
    const query = new URLSearchParams({ title, limit: '100' })
    query.append('contentRating[]', 'safe')
    query.append('contentRating[]', 'suggestive')
    query.append('contentRating[]', 'erotica')
    const result = z
      .object({ data: z.array(mangaSchema) })
      .parse(await request(`/manga?${query}`, 3_600_000))
    const match = result.data.find(
      (m) =>
        m.attributes.links?.mal === String(malId) ||
        (anilistId !== undefined &&
          m.attributes.links?.al === String(anilistId)),
    )
    if (match)
      return {
        id: match.id,
        languages: match.attributes.availableTranslatedLanguages.filter(
          (l): l is string => Boolean(l),
        ),
      }
    for (const candidate of result.data) candidates.set(candidate.id, candidate)
  }
  const wanted = new Set(titles.map(normalizedTitle).filter(Boolean))
  const exact = [...candidates.values()].filter((candidate) => {
    // A conflicting catalog ID always beats a similar title.
    if (candidate.attributes.links?.mal || candidate.attributes.links?.al)
      return false
    const names = [
      ...Object.values(candidate.attributes.title ?? {}),
      ...(candidate.attributes.altTitles ?? []).flatMap((t) =>
        Object.values(t),
      ),
    ]
    return names.some((name) => wanted.has(normalizedTitle(name)))
  })
  if (exact.length === 1)
    return {
      id: exact[0].id,
      languages: exact[0].attributes.availableTranslatedLanguages.filter(
        (l): l is string => Boolean(l),
      ),
    }
  return null
}

export async function chapterFeed(
  mangaId: string,
  language: string,
  offset: number,
) {
  const query = new URLSearchParams({
    limit: '100',
    offset: String(offset),
    'translatedLanguage[]': language,
    'order[chapter]': 'asc',
    'order[volume]': 'asc',
    'includes[]': 'scanlation_group',
    includeFutureUpdates: '0',
    includeEmptyPages: '0',
    includeUnavailable: '0',
  })
  query.append('contentRating[]', 'safe')
  query.append('contentRating[]', 'suggestive')
  query.append('contentRating[]', 'erotica')
  for (const group of blockedGroups()) query.append('excludedGroups[]', group)
  const result = z
    .object({
      data: z.array(chapterSchema),
      total: z.number(),
      limit: z.number(),
    })
    .parse(await request(`/manga/${mangaId}/feed?${query}`))
  return {
    chapters: result.data
      .map(readerChapter)
      .filter((c): c is ReaderChapter => c !== null),
    nextOffset: offset + result.data.length,
    hasMore:
      result.data.length > 0 &&
      offset + result.data.length < Math.min(result.total, 10_000),
  }
}

export function chapterImages(data: unknown, dataSaver = false) {
  const result = z
    .object({
      baseUrl: z.url(),
      chapter: z.object({
        hash: z.string().regex(/^[a-f0-9]{32}$/i),
        data: z.array(z.string()).max(1000),
        dataSaver: z.array(z.string()).max(1000).optional(),
      }),
    })
    .parse(data)
  const base = new URL(result.baseUrl)
  const mockApi = process.env.MANGADEX_API_URL
    ? new URL(process.env.MANGADEX_API_URL)
    : null
  const localTestImage =
    mockApi &&
    ['localhost', '127.0.0.1', '[::1]'].includes(mockApi.hostname) &&
    base.origin === mockApi.origin
  if (
    (!localTestImage && base.protocol !== 'https:') ||
    base.username ||
    base.password ||
    !(
      localTestImage ||
      base.hostname.endsWith('.mangadex.network') ||
      base.hostname === 'uploads.mangadex.org'
    )
  )
    throw new Error('Invalid MangaDex image server')
  const useSaver =
    dataSaver && result.chapter.dataSaver?.length === result.chapter.data.length
  const files = useSaver ? result.chapter.dataSaver! : result.chapter.data
  return files.map((filename) => {
    if (
      !/^[a-zA-Z0-9_.-]+$/.test(filename) ||
      filename === '.' ||
      filename === '..'
    )
      throw new Error('Invalid MangaDex page')
    return `${result.baseUrl.replace(/\/$/, '')}/${useSaver ? 'data-saver' : 'data'}/${result.chapter.hash}/${filename}`
  })
}

export async function loadChapter(
  mangaId: string,
  chapterId: string,
  fresh = false,
) {
  const result = z
    .object({ data: chapterSchema })
    .parse(
      await request(
        `/chapter/${chapterId}?includes[]=scanlation_group`,
        60_000,
        fresh,
      ),
    )
  if (
    !result.data.relationships.some(
      (r) => r.type === 'manga' && r.id === mangaId,
    )
  )
    throw new Error('This chapter belongs to another manga.')
  const chapter = readerChapter(result.data)
  if (!chapter) throw new Error('This chapter is unavailable.')
  if (chapter.externalUrl) return { chapter, images: [] }
  const pages = await request(
    `/at-home/server/${chapterId}?forcePort443=true`,
    30_000,
    fresh,
  )
  return {
    chapter,
    images: chapterImages(pages),
    smallerImages: chapterImages(pages, true),
  }
}

export function readerError(error: unknown) {
  if (error instanceof z.ZodError)
    return 'MangaDex returned an unexpected response. Try again shortly.'
  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  )
    return 'MangaDex took too long to respond. Try again shortly.'
  if (
    error instanceof Error &&
    /^(MangaDex|This chapter|Invalid MangaDex)/.test(error.message)
  )
    return error.message
  return 'Could not connect to MangaDex. Try again shortly.'
}

/** Resolve identity on the server; never accept an arbitrary upstream image URL. */
export async function loadChapterPage(
  mangaId: string,
  chapterId: string,
  page: number,
) {
  // At-home nodes can expire or become unavailable between page requests.
  for (let attempt = 0; attempt < 2; attempt++) {
    const chapter = await loadChapter(mangaId, chapterId, attempt > 0)
    if (!Number.isInteger(page) || page < 0 || page >= chapter.images.length)
      throw new Error('This chapter page does not exist.')
    const sources = [
      ...new Set(
        [chapter.smallerImages?.[page], chapter.images[page]].filter(
          (url): url is string => Boolean(url),
        ),
      ),
    ]
    for (const source of sources) {
      try {
        const response = await fetch(source, {
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'Newarix/1.0 (MangaDex reader)' },
        })
        const type = response.headers.get('content-type')?.split(';')[0]
        if (
          !response.ok ||
          !response.body ||
          !type ||
          !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)
        )
          continue
        const maxBytes = 4 * 1024 * 1024
        if (Number(response.headers.get('content-length')) > maxBytes) {
          await response.body.cancel()
          continue
        }
        const reader = response.body.getReader()
        const parts: Uint8Array[] = []
        let size = 0
        while (size <= maxBytes) {
          const chunk = await reader.read()
          if (chunk.done) break
          size += chunk.value.byteLength
          parts.push(chunk.value)
        }
        if (size > maxBytes) {
          await reader.cancel()
          continue
        }
        if (!size) continue
        return { bytes: Buffer.concat(parts), type }
      } catch {
        /* Try the alternate image format before failing. */
      }
    }
  }
  throw new Error(
    'MangaDex could not deliver this page. Try another chapter or retry shortly.',
  )
}
