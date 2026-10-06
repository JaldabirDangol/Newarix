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
  return (
    <li className="relative flex items-center gap-3 py-2.5 pl-6">
      <span
        className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full ring-4 ring-bg"
        style={{ background: dotColor[h.action] }}
        aria-hidden
      />
      <Link {...detailLink(h.mediaType, h.malId)} aria-label={`View ${h.title}`} className="shrink-0 rounded">
        <Img src={h.imageUrl} alt="" className="h-12 w-8 rounded" />
      </Link>
      <p className="min-w-0 flex-1 text-sm">
        <span className="text-muted">{describe(h)}</span>{' '}
        <Link
          {...detailLink(h.mediaType, h.malId)}
          className="font-semibold hover:text-accent-text"
        >
          {h.title}
        </Link>
      </p>
      {showTime && (
        <time
          dateTime={h.createdAt}
          className="shrink-0 font-mono text-xs text-muted"
        >
          {mounted ? formatTime(h.createdAt) : ''}
        </time>
      )}
    </li>
  )
}
