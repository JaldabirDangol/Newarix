import { useEffect, useRef, useState } from 'react'
import { getEpisodes, getPictures } from '#/lib/catalog.functions'
import { Img, RowSkeleton, btn } from './ui'
import { EpisodePlayer } from './EpisodePlayer'
import type { MediaKind } from '#/lib/media'

type Episodes = Awaited<ReturnType<typeof getEpisodes>>

export function DetailTabs({
  id,
  kind,
  title,
  total = null,
}: {
  id: number
  kind: MediaKind
  title: string
  total?: number | null
}) {
  const [playing, setPlaying] = useState<number | null>(null)
  const [tab, setTab] = useState<'episodes' | 'pictures'>(
    kind === 'anime' ? 'episodes' : 'pictures',
  )
  const [page, setPage] = useState(1)
  const [episodes, setEpisodes] = useState<Episodes | null>(null)
  const [pictures, setPictures] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    let active = true
    setError('')
    if (tab === 'episodes') {
      setEpisodes(null)
      void getEpisodes({ data: { id, page } })
        .then((data) => {
          if (active) setEpisodes(data)
        })
        .catch(() => {
          if (active) setError('Episodes could not be loaded. Try again.')
        })
    } else if (!pictures) {
      void getPictures({ data: { id, kind } })
        .then((data) => {
          if (active) setPictures(data)
        })
        .catch(() => {
          if (active) setError('Pictures could not be loaded. Try again.')
        })
    }
    return () => {
      active = false
    }
  }, [id, kind, page, tab, retry, pictures])
  const tabs =
    kind === 'anime'
      ? (['episodes', 'pictures'] as const)
      : (['pictures'] as const)
  return (
    <>
      {kind === 'anime' && (
        <EpisodePlayer
          id={id}
          title={title}
          total={total}
          episode={playing}
          onEpisode={setPlaying}
        />
      )}
      <section className="mt-10" aria-label="Episodes and pictures">
        <h2 className="mb-3 text-lg font-extrabold">Explore {title}</h2>
        <div
          role="tablist"
          aria-label="Detail extras"
          className="mb-4 flex gap-2"
        >
          {tabs.map((name) => (
            <button
              type="button"
              key={name}
              id={`${name}-tab`}
              role="tab"
              aria-selected={tab === name}
              aria-controls="detail-extra-panel"
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={(e) => {
                if (
                  ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
                ) {
                  e.preventDefault()
                  const next =
                    e.key === 'Home'
                      ? tabs[0]
                      : e.key === 'End'
                        ? tabs[tabs.length - 1]
                        : (tabs.find((x) => x !== name) ?? name)
                  setTab(next)
                  document.getElementById(`${next}-tab`)?.focus()
                }
              }}
              className={`${tab === name ? btn.primary : btn.ghost} capitalize`}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          id="detail-extra-panel"
          role="tabpanel"
          aria-labelledby={`${tab}-tab`}
          tabIndex={0}
        >
          {error ? (
            <div role="alert">
              <p className="text-sm text-danger">{error}</p>
              <button
                className={`${btn.ghost} mt-3`}
                onClick={() => setRetry((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : tab === 'episodes' ? (
            episodes ? (
              episodes.items.length ? (
                <>
                  <ol
                    className="divide-y divide-line"
                    start={(page - 1) * 100 + 1}
                  >
                    {episodes.items.map((episode) => (
                      <li key={episode.id}>
                        <button
                          type="button"
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg py-3 text-left transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${playing === episode.id ? 'bg-raised text-accent-text' : ''}`}
                          aria-label={`Watch episode ${episode.id}`}
                          aria-pressed={playing === episode.id}
                          onClick={() => setPlaying(episode.id)}
                        >
                          <span className="w-10 shrink-0 font-mono text-sm text-muted">
                            {episode.id}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                              {episode.title}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                              {episode.aired && (
                                <time dateTime={episode.aired}>
                                  {new Date(episode.aired).toLocaleDateString(
                                    'en-US',
                                    { timeZone: 'UTC' },
                                  )}
                                </time>
                              )}
                              {episode.filler && (
                                <span className="rounded bg-raised px-2">
                                  Filler
                                </span>
                              )}
                              {episode.recap && (
                                <span className="rounded bg-raised px-2">
                                  Recap
                                </span>
                              )}
                              {episode.score && (
                                <span>Score {episode.score.toFixed(2)}</span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <nav
                    aria-label="Episode pages"
                    className="mt-4 flex items-center gap-3"
                  >
                    <button
                      className={btn.ghost}
                      disabled={page === 1}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      Previous
                    </button>
                    <span className="text-sm">Page {page}</span>
                    <button
                      className={btn.ghost}
                      disabled={!episodes.pageInfo.hasNext}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      Next
                    </button>
                  </nav>
                </>
              ) : (
                <p className="text-sm text-muted">
                  No episodes are listed yet.
                </p>
              )
            ) : (
              <RowSkeleton />
            )
          ) : pictures ? (
            pictures.length ? (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {pictures.map((url, i) => (
                  <li key={url}>
                    <button
                      type="button"
                      aria-label={`Open picture ${i + 1} of ${title}`}
                      onClick={() => {
                        setSelected(i)
                        dialog.current?.showModal()
                      }}
                      className="w-full rounded-lg"
                    >
                      <Img
                        src={url}
                        alt=""
                        className="aspect-[2/3] w-full rounded-lg"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                No pictures are available yet.
              </p>
            )
          ) : (
            <RowSkeleton />
          )}
        </div>
        <dialog
          ref={dialog}
          aria-label={`${title} picture gallery`}
          className="fixed inset-0 m-auto max-h-[95dvh] w-[min(95vw,800px)] rounded-xl bg-surface p-4 text-text backdrop:bg-black/80"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm">
              Picture {selected + 1} of {pictures?.length ?? 0}
            </p>
            <button
              className={btn.ghost}
              onClick={() => dialog.current?.close()}
            >
              Close
            </button>
          </div>
          {pictures?.[selected] && (
            <Img
              src={pictures[selected]}
              alt={`${title}, gallery picture ${selected + 1}`}
              className="max-h-[70dvh] w-full object-contain"
            />
          )}
          <div className="mt-3 flex justify-between">
            <button
              className={btn.ghost}
              disabled={selected === 0}
              onClick={() => setSelected((i) => i - 1)}
            >
              Previous
            </button>
            <button
              className={btn.ghost}
              disabled={selected >= (pictures?.length ?? 0) - 1}
              onClick={() => setSelected((i) => i + 1)}
            >
              Next
            </button>
          </div>
        </dialog>
      </section>
    </>
  )
}
