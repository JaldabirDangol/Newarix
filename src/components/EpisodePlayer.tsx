import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { btn, field } from './ui'

export function EpisodePlayer({
  id,
  title,
  total,
  episode,
  onEpisode,
}: {
  id: number
  title: string
  total: number | null
  episode: number | null
  onEpisode: (episode: number | null) => void
}) {
  const [language, setLanguage] = useState<'sub' | 'dub'>('sub')
  const [reload, setReload] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const frame = useRef<HTMLIFrameElement>(null)
  const section = useRef<HTMLElement>(null)
  const source =
    episode === null
      ? null
      : `https://megavid.buzz/mal/${id}/${episode}/${language}?autoplay=true&refresh=${reload ? 1 : 0}&_r=${reload}`

  useEffect(() => {
    setStatus('loading')
    if (!source) return
    section.current?.scrollIntoView({ block: 'nearest' })
    // An iframe load does not prove playback. The provider reports actual
    // playback failures through postMessage; reject other windows and origins.
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://megavid.buzz' ||
        event.source !== frame.current?.contentWindow
      )
        return
      try {
        const message =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (message?.channel !== 'kisskh') return
        if (message.event === 'error') setStatus('error')
        if (message.event === 'time') setStatus('ready')
      } catch {
        /* Ignore unrelated provider messages. */
      }
    }
    window.addEventListener('message', onMessage)
    const timeout = window.setTimeout(
      () => setStatus((s) => (s === 'loading' ? 'error' : s)),
      25_000,
    )
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timeout)
    }
  }, [source])

  return (
    <section ref={section} className="mt-10" aria-label="Watch episodes">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Watch {title}</h2>
        {episode !== null && (
          <button
            type="button"
            className={btn.ghost}
            onClick={() => onEpisode(null)}
          >
            Close player
          </button>
        )}
      </div>
      {source && episode !== null ? (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const value = Number(
                  new FormData(event.currentTarget).get('episode'),
                )
                if (
                  Number.isInteger(value) &&
                  value > 0 &&
                  value <= (total ?? 10_000)
                )
                  onEpisode(value)
              }}
            >
              <label className="text-sm font-semibold">
                Episode
                <input
                  key={episode}
                  name="episode"
                  type="number"
                  min={1}
                  max={total ?? 10_000}
                  required
                  defaultValue={episode}
                  className={`${field} mt-1 w-24`}
                />
              </label>
              <button type="submit" className={btn.ghost}>
                Go
              </button>
            </form>
            <label className="text-sm font-semibold">
              Audio
              <select
                className={`${field} mt-1`}
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as 'sub' | 'dub')
                }
              >
                <option value="sub">Subtitled</option>
                <option value="dub">Dubbed</option>
              </select>
            </label>
          </div>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              ref={frame}
              key={source}
              src={source}
              title={`${title} · Episode ${episode} · ${language === 'sub' ? 'Subtitled' : 'Dubbed'}`}
              className="h-full w-full border-0"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setStatus((s) => (s === 'loading' ? 'ready' : s))}
              onError={() => setStatus('error')}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <nav className="flex gap-2" aria-label="Playback episodes">
              <button
                type="button"
                className={btn.ghost}
                disabled={episode <= 1}
                onClick={() => onEpisode(episode - 1)}
              >
                Previous episode
              </button>
              <button
                type="button"
                className={btn.ghost}
                disabled={total !== null && episode >= total}
                onClick={() => onEpisode(episode + 1)}
              >
                Next episode
              </button>
            </nav>
            <button
              type="button"
              className={btn.ghost}
              onClick={() => setReload((n) => n + 1)}
            >
              Reload player
            </button>
          </div>
          <p
            className={`mt-3 text-sm ${status === 'error' ? 'text-danger' : 'text-muted'}`}
            role="status"
          >
            {status === 'loading'
              ? 'Loading the player…'
              : status === 'error'
                ? 'This episode could not be played. Reload the player or try another episode or audio option.'
                : `Episode ${episode}${total ? ` of ${total}` : ''} · Player provided by Megavid`}
          </p>
          <p className="mt-2 text-xs text-muted">
            Availability and subtitles depend on the provider. If the video does
            not start, try Reload player.
          </p>
        </>
      ) : total === 0 ? (
        <p className="text-sm text-muted">No episodes are available yet.</p>
      ) : (
        <div className="rounded-lg bg-raised p-5">
          <p className="mb-3 text-sm text-muted">
            Start with episode 1, or choose an episode below. Playback opens
            here.
          </p>
          <button
            type="button"
            className={btn.primary}
            onClick={() => onEpisode(1)}
          >
            <Play className="size-4" aria-hidden />
            Play episode 1
          </button>
        </div>
      )}
    </section>
  )
}
