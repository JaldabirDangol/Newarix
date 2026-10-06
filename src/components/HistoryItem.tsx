import { Link } from '@tanstack/react-router'
import { statusLabel } from '#/lib/status'
import { formatTime } from '#/lib/format'
import { useMounted } from '#/lib/hooks'
import { detailLink } from './media'
import { Img } from './ui'
import type { HistoryDTO } from '#/lib/tracking.functions'

/** Sentence for one history event, e.g. "Watched episode 5 of" + title. */
export function describe(h: HistoryDTO) {
  const anime = h.mediaType === 'anime'
  switch (h.action) {
    case 'progress':
      return anime
        ? `Watched episode ${h.progress} of`
        : `Read chapter ${h.progress} of`
    case 'completed':
      return 'Completed'
    case 'added':
      return `Added to ${h.status ? statusLabel(h.status, h.mediaType).toLowerCase() : 'list'}:`
    case 'status':
      return h.status
        ? `Moved to ${statusLabel(h.status, h.mediaType).toLowerCase()}:`
        : 'Updated'
    case 'scored':
      return `Scored ${h.score}/10:`
    case 'removed':
      return 'Removed from list:'
  }
}

const dotColor: Record<HistoryDTO['action'], string> = {
  progress: 'var(--st-current)',
  completed: 'var(--st-completed)',
  added: 'var(--st-planned)',
  status: 'var(--muted)',
  scored: 'var(--accent)',
  removed: 'var(--st-dropped)',
}

export function HistoryItem({
  h,
  showTime = true,
}: {
  h: HistoryDTO
  showTime?: boolean
}) {
  const mounted = useMounted()
  const playback =
    h.mediaType === 'anime' && h.action === 'progress' && h.progress
      ? { episode: h.progress, position: h.positionSeconds ?? undefined }
      : undefined
  return (
    <li>
      <Link
        {...detailLink(h.mediaType, h.malId)}
        search={playback}
        className="relative flex cursor-pointer items-center gap-3 rounded-lg py-2.5 pl-6 hover:bg-raised"
        aria-label={
          playback
            ? `Continue episode ${h.progress} of ${h.title}`
            : `View ${h.title}`
        }
      >
        <span
          className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full ring-4 ring-bg"
          style={{ background: dotColor[h.action] }}
          aria-hidden
        />
        <span className="shrink-0 rounded">
          <Img src={h.imageUrl} alt="" className="h-12 w-8 rounded" />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="text-muted">{describe(h)}</span>{' '}
          <span className="font-semibold">{h.title}</span>
          {h.positionSeconds !== null && h.positionSeconds > 0 && (
            <span className="ml-2 text-xs text-muted">
              {Math.floor(h.positionSeconds / 60)}:
              {String(h.positionSeconds % 60).padStart(2, '0')}
            </span>
          )}
        </p>
        {showTime && (
          <time
            dateTime={h.createdAt}
            className="shrink-0 font-mono text-xs text-muted"
          >
            {mounted ? formatTime(h.createdAt) : ''}
          </time>
        )}
      </Link>
    </li>
  )
}
