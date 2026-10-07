import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
} from 'lucide-react'
import {
  findReaderManga,
  getReaderChapter,
  getReaderChapters,
} from '#/lib/manga.functions'
import { btn, field } from './ui'
import type { MangaDetail } from '#/lib/media'
import type { ReaderChapter } from '#/server/mangadex'

type Match = NonNullable<Awaited<ReturnType<typeof findReaderManga>>>
type Reading = Extract<
  Awaited<ReturnType<typeof getReaderChapter>>,
  { ok: true }
>
type Bookmark = { chapterId: string; language: string; page: number }

function readBookmark(id: number): Bookmark | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(`newarix:manga:${id}`) ?? 'null',
    ) as Bookmark | null
    return value &&
      typeof value.chapterId === 'string' &&
      /^[a-z]{2}(-[a-z]{2})?$/.test(value.language) &&
      Number.isInteger(value.page) &&
      value.page >= 0
      ? value
      : null
  } catch {
    return null
  }
}

function languageName(code: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

function chapterLabel(chapter: ReaderChapter) {
  return `${chapter.number ? `Chapter ${chapter.number}` : 'One-shot'}${chapter.title ? ` · ${chapter.title}` : ''}`
}

export function MangaReader({ media }: { media: MangaDetail }) {
  const [match, setMatch] = useState<Match | null>(null)
  const [matched, setMatched] = useState(false)
  const [language, setLanguage] = useState('en')
  const [chapters, setChapters] = useState<ReaderChapter[]>([])
  const [offset, setOffset] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [chapterError, setChapterError] = useState('')
  const [page, setPage] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [bookmark, setBookmark] = useState<Bookmark | null>(null)
  const [chapterRetry, setChapterRetry] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const resumePage = useRef(0)

  useEffect(() => {
    setBookmark(readBookmark(media.id))
  }, [media.id])
  useEffect(() => {
    if (match) return
    let active = true
    setLoading(true)
    setError('')
    setMatched(false)
    void findReaderManga({
      data: {
        malId: media.id,
        anilistId:
          Number(media.siteUrl.match(/\/manga\/(\d+)/)?.[1]) || undefined,
        titles: [media.title, media.titleEnglish, media.titleJapanese]
          .filter((t): t is string => Boolean(t))
          .map((t) => t.slice(0, 300)),
      },
    })
      .then((data) => {
        if (!active) return
        setMatch(data)
        setMatched(true)
        if (data) {
          const saved = readBookmark(media.id)
          setLanguage(
            data.languages.includes(saved?.language ?? '')
              ? saved!.language
              : data.languages.includes('en')
                ? 'en'
                : (data.languages[0] ?? 'en'),
          )
        }
      })
      .catch(() => {
        if (active)
          setError('MangaDex could not be reached. Try again shortly.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [
    match,
    media.id,
    media.title,
    media.titleEnglish,
    media.titleJapanese,
    media.siteUrl,
    retry,
  ])

  useEffect(() => {
    if (!match) return
    let active = true
    setLoading(true)
    setError('')
    void getReaderChapters({ data: { mangaId: match.id, language, offset } })
      .then((data) => {
        if (!active) return
        setChapters((previous) =>
          offset === 0
            ? data.chapters
            : [
                ...previous,
                ...data.chapters.filter(
                  (c) => !previous.some((p) => p.id === c.id),
                ),
              ],
        )
        setNextOffset(data.nextOffset)
        setHasMore(data.hasMore)
      })
      .catch(() => {
        if (active) setError('Chapters could not be loaded. Try again shortly.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [match, language, offset, retry])

  useEffect(() => {
    if (!selected || !match) return
    let active = true
    setReading(null)
    setChapterError('')
    void getReaderChapter({
      data: { mangaId: match.id, chapterId: selected, fresh: chapterRetry > 0 },
    })
      .then((data) => {
        if (!active) return
        if (!data.ok) {
          setChapterError(data.error)
          return
        }
        setReading(data)
        setPage(
          Math.min(resumePage.current, Math.max(0, data.images.length - 1)),
        )
        resumePage.current = 0
      })
      .catch(() => {
        if (active)
          setChapterError(
            'This chapter could not be opened. It may have been removed or MangaDex may be unavailable.',
          )
      })
    return () => {
      active = false
    }
  }, [selected, match, chapterRetry])

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal()
    if (!selected && dialog.current?.open) dialog.current.close()
  }, [selected])

  useEffect(() => {
    setImageFailed(false)
    setImageLoaded(false)
    dialog.current?.scrollTo({ top: 0 })
    if (!reading || reading.chapter.externalUrl || !reading.images.length)
      return
    const saved = { chapterId: reading.chapter.id, language, page }
    setBookmark(saved)
    try {
      localStorage.setItem(`newarix:manga:${media.id}`, JSON.stringify(saved))
    } catch {
      /* Reading still works when storage is disabled. */
    }
  }, [page, reading, language, media.id])

  // Lock background scrolling while the native dialog is open.
  useEffect(() => {
    if (!selected) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [selected])

  function openChapter(id: string, savedPage = 0) {
    resumePage.current = savedPage
    setReading(null)
    setPage(0)
    setSelected(id)
    if (id === selected) setChapterRetry((value) => value + 1)
  }

  const currentIndex = chapters.findIndex((chapter) => chapter.id === selected)
  const previousChapter =
    currentIndex > 0
      ? chapters
          .slice(0, currentIndex)
          .reverse()
          .find((chapter) => chapter.number !== chapters[currentIndex].number)
      : null
  const nextChapter =
    currentIndex >= 0
      ? chapters
          .slice(currentIndex + 1)
          .find((chapter) => chapter.number !== chapters[currentIndex].number)
      : null

  return (
    <section className="mt-10" aria-labelledby="manga-reader-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="manga-reader-heading" className="text-lg font-extrabold">
          Read manga
        </h2>
        <a
          href={
            match
              ? `https://mangadex.org/title/${match.id}`
              : 'https://mangadex.org'
          }
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
        >
          Powered by MangaDex <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
      <div className="mt-4">
        {match && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="min-w-40 text-sm font-semibold">
              Chapter language
              <select
                className={`${field} mt-1`}
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value)
                  setOffset(0)
                  setChapters([])
                  setHasMore(false)
                }}
              >
                {[...new Set([...match.languages, 'en'])].sort().map((code) => (
                  <option value={code} key={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </label>
            {bookmark && bookmark.language === language && (
              <button
                type="button"
                className={btn.primary}
                disabled={loading}
                onClick={() => openChapter(bookmark.chapterId, bookmark.page)}
              >
                Continue reading · page {bookmark.page + 1}
              </button>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 text-sm">
            <p>{error}</p>
            <button
              type="button"
              className={`${btn.ghost} mt-3`}
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {loading && (
          <div
            role="status"
            aria-label="Loading manga chapters"
            className="space-y-2"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        )}
        {!loading && !error && matched && !match && (
          <p className="py-4 text-sm text-muted">
            This title could not be matched on MangaDex. You can still track
            your reading here.
          </p>
        )}
        {!loading && !error && match && !chapters.length && (
          <p className="py-4 text-sm text-muted">
            No readable chapters were found in {languageName(language)}. Try
            another language.
          </p>
        )}
        <ul className="max-h-96 overflow-y-auto divide-y divide-line">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => openChapter(chapter.id)}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold break-words">
                    {chapterLabel(chapter)}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {chapter.groups.map((g) => g.name).join(' · ') ||
                      'Uploader on MangaDex'}
                    {chapter.externalUrl
                      ? ' · Read on publisher site'
                      : ` · ${chapter.pages} pages`}
                  </span>
                </span>
                {chapter.externalUrl ? (
                  <ExternalLink className="mt-1 size-4 shrink-0" aria-hidden />
                ) : (
                  <BookOpen className="mt-1 size-4 shrink-0" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
        {hasMore && (
          <button
            type="button"
            className={`${btn.ghost} mt-4`}
            disabled={loading}
            onClick={() => setOffset(nextOffset)}
          >
            Load more chapters
          </button>
        )}
        {match && (
          <p className="mt-3 text-xs text-muted">
            Multiple versions of a chapter may be available from different
            groups. Reading positions are saved in this browser.
          </p>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="reader-title"
        onClose={() => setSelected(null)}
        className="fixed inset-0 m-auto h-[100dvh] max-h-none w-full max-w-none bg-bg p-0 text-text backdrop:bg-black/80"
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).tagName === 'SELECT') return
          if (
            event.key === 'ArrowRight' &&
            reading &&
            page < reading.images.length - 1
          ) {
            event.preventDefault()
            setPage((p) => p + 1)
          }
          if (event.key === 'ArrowLeft' && page > 0) {
            event.preventDefault()
            setPage((p) => p - 1)
          }
        }}
      >
        <div className="sticky top-0 z-10 border-b border-line bg-bg px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="reader-title" className="truncate text-sm font-bold">
                {media.titleEnglish || media.title}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {reading ? chapterLabel(reading.chapter) : 'Opening chapter…'}
              </p>
            </div>
            <button
              type="button"
              className={btn.icon}
              aria-label="Close reader"
              onClick={() => setSelected(null)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {reading && reading.images.length > 0 && (
            <nav
              aria-label="Manga pages"
              className="mx-auto mt-3 flex max-w-4xl flex-wrap items-center justify-center gap-2"
            >
              <button
                type="button"
                className={btn.ghost}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden /> Previous page
              </button>
              <label className="text-sm">
                <span className="sr-only">Page</span>
                <select
                  className={field}
                  value={page}
                  onChange={(event) => setPage(Number(event.target.value))}
                >
                  {reading.images.map((_, index) => (
                    <option key={index} value={index}>
                      Page {index + 1} of {reading.images.length}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={btn.primary}
                disabled={page >= reading.images.length - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next page <ChevronRight className="size-4" aria-hidden />
              </button>
            </nav>
          )}
        </div>
        <div className="mx-auto max-w-4xl px-4 py-5">
          {chapterError ? (
            <div role="alert">
              <p>{chapterError}</p>
              <button
                type="button"
                className={`${btn.ghost} mt-4`}
                onClick={() => setChapterRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : !reading ? (
            <div
              className="skeleton mx-auto aspect-[2/3] max-w-2xl rounded-lg"
              role="status"
              aria-label="Loading chapter"
            />
          ) : reading.chapter.externalUrl ? (
            <div className="py-10 text-center">
              <p className="mb-4 text-sm text-muted">
                This chapter is available on an external reading site.
              </p>
              <a
                className={btn.primary}
                href={reading.chapter.externalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open reading site{' '}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          ) : !reading.images.length ? (
            <p className="py-10 text-center text-muted">
              This chapter has no readable pages.
            </p>
          ) : (
            <div>
              {imageFailed ? (
                <div role="alert" className="py-10 text-center">
                  <p>
                    This page could not load. Refresh the chapter to request a
                    fresh image source.
                  </p>
                  <button
                    type="button"
                    className={`${btn.ghost} mt-4`}
                    onClick={() => {
                      resumePage.current = page
                      setChapterRetry((value) => value + 1)
                    }}
                  >
                    Refresh chapter
                  </button>
                </div>
              ) : (
                <>
                  {!imageLoaded && (
                    <p
                      role="status"
                      className="py-3 text-center text-sm text-muted"
                    >
                      Loading page {page + 1}…
                    </p>
                  )}
                  <img
                    key={reading.images[page]}
                    src={`${reading.images[page]}&refresh=${chapterRetry}`}
                    alt={`${chapterLabel(reading.chapter)}, page ${page + 1}`}
                    className="mx-auto h-auto w-full max-w-3xl"
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    onLoad={() => setImageLoaded(true)}
                  />
                </>
              )}
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className={btn.ghost}
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous page
                </button>
                <button
                  type="button"
                  className={btn.primary}
                  disabled={page >= reading.images.length - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next page
                </button>
              </div>
            </div>
          )}
          {reading && (
            <footer className="mt-8 border-t border-line pt-4 text-center text-sm">
              <div className="mb-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className={btn.ghost}
                  disabled={!previousChapter}
                  onClick={() =>
                    previousChapter && openChapter(previousChapter.id)
                  }
                >
                  Previous chapter
                </button>
                <button
                  type="button"
                  className={btn.ghost}
                  disabled={!nextChapter}
                  onClick={() => nextChapter && openChapter(nextChapter.id)}
                >
                  Next chapter
                </button>
                {!nextChapter && hasMore && (
                  <button
                    type="button"
                    className={btn.ghost}
                    disabled={loading}
                    onClick={() => setOffset(nextOffset)}
                  >
                    {loading ? 'Loading chapters…' : 'Load more chapters'}
                  </button>
                )}
              </div>
              <p className="text-muted">
                Pages provided by{' '}
                <a
                  className="underline hover:text-text"
                  href={`https://mangadex.org/chapter/${reading.chapter.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  MangaDex
                </a>
                .
              </p>
              <p className="mt-2 text-muted">
                Translation:{' '}
                {reading.chapter.groups.length
                  ? reading.chapter.groups.map((group, index) => (
                      <span key={group.id}>
                        {index > 0 && ' · '}
                        <a
                          className="underline hover:text-text"
                          href={`https://mangadex.org/group/${group.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {group.name}
                        </a>
                      </span>
                    ))
                  : 'Uploader on MangaDex'}
              </p>
            </footer>
          )}
        </div>
      </dialog>
    </section>
  )
}
