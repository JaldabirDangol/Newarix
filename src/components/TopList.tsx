import { Link } from '@tanstack/react-router'
import { PosterGrid } from './media'
import {
  Container,
  EmptyState,
  GridSkeleton,
  PageHeader,
  Pagination,
  field,
} from './ui'
import {
  animeTopFilters,
  animeTypes,
  mangaTopFilters,
  mangaTypes,
  topFilterLabels,
  typeLabels,
} from '#/lib/filters'
import type { MediaCard, MediaKind } from '#/lib/media'
import type { PageInfo } from '#/lib/catalog.functions'

type TopSearch = { type?: string; filter?: string; page?: number }

export function TopList({
  kind,
  search,
  items,
  pageInfo,
  onTypeChange,
}: {
  kind: MediaKind
  search: TopSearch
  items: MediaCard[]
  pageInfo: PageInfo
  onTypeChange: (type: string | undefined) => void
}) {
  const filters = [
    '',
    ...(kind === 'anime' ? animeTopFilters : mangaTopFilters),
  ]
  const types = kind === 'anime' ? animeTypes : mangaTypes
  const to = kind === 'anime' ? '/anime' : '/manga'
  const current = search.filter ?? ''
  const startRank = (pageInfo.page - 1) * 24 + 1

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow={kind === 'anime' ? 'Anime' : 'Manga'}
        title={`${topFilterLabels[current] ?? 'Top'} ${kind}`}
      />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Ranking"
          className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {filters.map((f) => (
            <Link
              key={f || 'top'}
              to={to}
              search={{ type: search.type, filter: f || undefined }}
              aria-current={current === f ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${current === f ? 'bg-accent text-on-accent' : 'bg-surface text-muted hover:text-text'}`}
            >
              {topFilterLabels[f]}
            </Link>
          ))}
        </nav>
        <label className="flex items-center gap-2 text-sm text-muted">
          Format
          <select
            value={search.type ?? ''}
            onChange={(e) => onTypeChange(e.target.value || undefined)}
            className={`${field} w-40 py-2`}
          >
            <option value="">All formats</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {items.length ? (
        <PosterGrid
          items={items}
          ranked={!current || current === 'bypopularity'}
          startRank={startRank}
        />
      ) : (
        <EmptyState
          title="No titles found"
          message="Try another format or ranking."
        />
      )}
      <Pagination
        {...pageInfo}
        to={to}
        search={(page) => ({ ...search, page: page > 1 ? page : undefined })}
      />
    </Container>
  )
}

export function TopListSkeleton() {
  return (
    <Container className="py-10">
      <div className="skeleton mb-3 h-3 w-16 rounded" />
      <div className="skeleton mb-8 h-10 w-64 rounded" />
      <div className="skeleton mb-8 h-9 w-full max-w-lg rounded-full" />
      <GridSkeleton />
    </Container>
  )
}
