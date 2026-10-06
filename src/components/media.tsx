import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Img, ScoreBadge } from './ui'
import { displayTitle } from '#/lib/media'
import { typeLabels } from '#/lib/filters'
import { statusColor, statusLabel } from '#/lib/status'
import type { MediaCard, MediaKind } from '#/lib/media'
import type { ReactNode } from 'react'

export function detailLink(kind: MediaKind, id: number) {
  return kind === 'anime'
    ? ({ to: '/anime/$id', params: { id: String(id) } } as const)
    : ({ to: '/manga/$id', params: { id: String(id) } } as const)
}

function metaLine(m: MediaCard) {
  const unit = m.kind === 'anime' ? 'ep' : 'ch'
  return [
    m.type
      ? (typeLabels[m.type.toLowerCase().replace(/[\s-]/g, '')] ?? m.type)
      : null,
    m.year,
    m.count ? `${m.count} ${unit}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function PosterCard({
  media,
  eager = false,
  rank,
}: {
  media: MediaCard
  eager?: boolean
  rank?: number
}) {
  const title = displayTitle(media)
  return (
    <Link
      {...detailLink(media.kind, media.id)}
      className="group block rounded-xl focus-visible:outline-offset-4"
    >
      <div className="relative overflow-hidden rounded-xl shadow-card ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-accent motion-reduce:group-hover:translate-y-0">
        <Img
          src={media.image}
          srcSet={
            media.image && media.imageLarge
              ? `${media.image} 225w, ${media.imageLarge} 450w`
              : undefined
          }
          sizes="(min-width: 1280px) 200px, (min-width: 640px) 25vw, 45vw"
          alt=""
          eager={eager}
          className="aspect-[2/3] w-full transition duration-500 group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-10 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          {media.genres.slice(0, 3).map((g) => (
            <span
              key={g}
              className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"
            >
              {g}
            </span>
          ))}
        </div>
        <ScoreBadge
          score={media.score}
          className="absolute top-2 right-2 shadow"
        />
        {rank !== undefined && (
          <span className="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">
            #{rank}
          </span>
        )}
        {media.listStatus && (
          <span className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-md bg-bg px-2 py-1 text-xs font-semibold text-text">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: statusColor[media.listStatus] }}
            />
            {statusLabel(media.listStatus, media.kind)}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm leading-snug font-bold transition group-hover:text-accent-text">
        {title}
      </h3>
      <p className="mt-0.5 truncate text-xs text-muted">{metaLine(media)}</p>
    </Link>
  )
}

export function PosterGrid({
  items,
  ranked = false,
  startRank = 1,
}: {
  items: MediaCard[]
  ranked?: boolean
  startRank?: number
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((m, i) => (
        <li
          key={`${m.kind}-${m.id}`}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
        >
          <PosterCard
            media={m}
            eager={i < 6}
            rank={ranked ? (m.rank ?? startRank + i) : undefined}
          />
        </li>
      ))}
    </ul>
  )
}

/** Horizontally scrolling row with arrow buttons on wider screens. */
export function Shelf({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLUListElement>(null)
  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (el)
      el.scrollBy({
        left: dir * el.clientWidth * 0.85,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
  }
  return (
    <div className="group/shelf relative">
      <ul
        ref={ref}
        aria-label={label}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
      >
        {children}
      </ul>
      {(['left', 'right'] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-label={`Scroll ${label} ${side}`}
          onClick={() => scroll(side === 'left' ? -1 : 1)}
          className={`absolute top-[38%] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/95 text-text opacity-0 shadow-card transition group-hover/shelf:opacity-100 hover:bg-raised focus-visible:opacity-100 md:flex ${side === 'left' ? '-left-3' : '-right-3'}`}
        >
          {side === 'left' ? (
            <ChevronLeft className="size-5" />
          ) : (
            <ChevronRight className="size-5" />
          )}
        </button>
      ))}
    </div>
  )
}

export function PosterShelf({
  items,
  label,
}: {
  items: MediaCard[]
  label: string
}) {
  return (
    <Shelf label={label}>
      {items.map((m) => (
        <li
          key={`${m.kind}-${m.id}`}
          className="w-36 shrink-0 snap-start sm:w-44"
        >
          <PosterCard media={m} />
        </li>
      ))}
    </Shelf>
  )
}

/**
 * The episode ribbon: one cell per episode (or chapter), filled as you go.
 * Long series are grouped so the ribbon never exceeds 50 cells; a group
 * fills partially. Unknown totals show open cells after the progress.
 */
export function EpisodeRibbon({
  progress,
  total,
  kind,
  size = 'md',
  color = 'var(--accent)',
}: {
  progress: number
  total: number | null
  kind: MediaKind
  size?: 'sm' | 'md'
  color?: string
}) {
  const unit = kind === 'anime' ? 'episode' : 'chapter'
  const known = total !== null && total > 0
  const maxCells = size === 'sm' ? 26 : 50
  const span = known ? Math.max(total, 1) : Math.max(progress + 4, 12)
  const cells = Math.min(span, maxCells)
  const per = span / cells
  const label = known
    ? `${progress} of ${total} ${unit}s`
    : `${progress} ${unit}s, total not announced`

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={known ? total : undefined}
      aria-valuenow={progress}
      className={`flex w-full ${size === 'sm' ? 'h-1.5 gap-[2px]' : 'h-3 gap-[3px]'}`}
    >
      {Array.from({ length: cells }, (_, i) => {
        const start = i * per
        const fill = Math.max(0, Math.min(1, (progress - start) / per))
        const open = !known && start >= progress
        return (
          <span
            key={i}
            className={`relative flex-1 overflow-hidden rounded-[2px] ${open ? 'border border-dashed border-line' : 'bg-raised'}`}
          >
            {fill > 0 && (
              <span
                className="absolute inset-y-0 left-0 transition-[width] duration-300"
                style={{ width: `${fill * 100}%`, background: color }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
