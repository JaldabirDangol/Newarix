const mangaId = '58be6aa6-06cb-4ca5-bd20-f1392ce451fb'
const groupId = 'e8123dbe-b228-4a8a-b38a-40aacfeb2682'
const chapterId = (number) =>
  `ff4f79de-6102-4610-8327-${String(number).padStart(12, '0')}`
const chapter = (number) => ({
  id: chapterId(number),
  attributes: {
    title: `Test chapter ${number}`,
    chapter: String(number),
    translatedLanguage: 'en',
    pages: number === 3 ? 0 : 2,
    externalUrl:
      number === 3 ? 'https://mangaplus.shueisha.co.jp/viewer/test' : null,
  },
  relationships: [
    { id: mangaId, type: 'manga' },
    {
      id: groupId,
      type: 'scanlation_group',
      attributes: { name: 'Reader test group' },
    },
  ],
})

export function answerMangaDex(url, json, res) {
  if (!url.pathname.startsWith('/mangadex/')) return false
  const path = url.pathname.slice('/mangadex'.length)
  if (path === '/manga') {
    json(200, {
      data: url.searchParams.get('title')?.includes('Blue Lantern')
        ? [
            {
              id: mangaId,
              attributes: {
                links: { mal: '2' },
                availableTranslatedLanguages: ['en', 'fr'],
              },
            },
          ]
        : [],
    })
  } else if (path.endsWith('/feed')) {
    const offset = Number(url.searchParams.get('offset'))
    json(200, {
      data:
        url.searchParams.get('translatedLanguage[]') === 'fr'
          ? []
          : offset === 0
            ? [chapter(1), chapter(2), chapter(3)]
            : [chapter(4)],
      total: url.searchParams.get('translatedLanguage[]') === 'fr' ? 0 : 4,
      limit: 100,
    })
  } else if (path.startsWith('/chapter/')) {
    const number = Number(path.split('/').at(-1).slice(-12))
    json(200, { data: chapter(number) })
  } else if (path.startsWith('/at-home/server/')) {
    json(200, {
      baseUrl: `${url.origin}/mangadex/images`,
      chapter: { hash: 'a'.repeat(32), data: ['page-1.png', 'page-2.png'] },
    })
  } else if (path.startsWith('/images/')) {
    res.writeHead(200, { 'content-type': 'image/png' })
    res.end(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        'base64',
      ),
    )
  } else json(404, { result: 'error' })
  return true
}
