import { useEffect, useState } from 'react'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { getGenres, searchCatalog } from '#/lib/catalog.functions'
import {
  animeStatuses,
  animeTypes,
  catalogSearchSchema,
  mangaStatuses,
  mangaTypes,
  orderByLabels,
  orderByOptions,
  statusLabels,
  typeLabels,
} from '#/lib/filters'
import { useDebounced } from '#/lib/hooks'
import { PosterGrid } from '#/components/media'
import {
  Container,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  btn,
  field,
} from '#/components/ui'
import type { CatalogSearch } from '#/lib/filters'

export const Route = createFileRoute('/search')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [results, genres] = await Promise.all([
      searchCatalog({ data: deps }).then(
        (r) => ({ ok: true as const, ...r }),
        (err: unknown) => ({
          ok: false as const,
          error: err instanceof Error ? err.message : 'Search failed',
        }),
      ),
      getGenres({ data: { kind: deps.kind } }).catch(() => []),
    ])
    return { results, genres }
  },
  staleTime: 5 * 60_000,
  head: () => ({ meta: [{ title: 'Search · Newarix' }] }),
  // No pendingComponent: it would unmount the search box while typing.
  // The previous results stay visible (dimmed) until new ones arrive.
  component: SearchPage,
})

const thisYear = new Date().getFullYear()
const years = Array.from(
  { length: thisYear + 2 - 1960 },
  (_, i) => thisYear + 1 - i,
)

function SearchPage() {
  const { results, genres } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const loading = useRouterState({ select: (s) => s.isLoading })
  const [q, setQ] = useState(search.q ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const debounced = useDebounced(q, 400)

  const update = (patch: Partial<CatalogSearch>, replace = false) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
      replace,
    })

  useEffect(() => {
    const next = debounced.trim() || undefined
    if (next !== search.q) void update({ q: next }, true)
  }, [debounced])

  // Keep the box in sync when the query changes from elsewhere (navbar search, back button).
  useEffect(() => {
    if ((search.q ?? '') !== q.trim()) setQ(search.q ?? '')
  }, [search.q])

  const selectedGenres = new Set(
    (search.genres ?? '').split(',').filter(Boolean),
  )
  const toggleGenre = (id: string) => {
    const next = new Set(selectedGenres)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    void update({ genres: [...next].join(',') || undefined })
  }

  const isAnime = search.kind === 'anime'
  const types = isAnime ? animeTypes : mangaTypes
  const statuses = isAnime ? animeStatuses : mangaStatuses
  const activeFilters =
    selectedGenres.size +
    [
      search.type,
      search.status,
      search.year,
      search.minScore,
      search.orderBy,
    ].filter(Boolean).length

  const filterPanel = (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-muted">
          Format
          <select
            className={`${field} mt-1`}
            value={search.type ?? ''}
            onChange={(e) => update({ type: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Status
          <select
            className={`${field} mt-1`}
            value={search.status ?? ''}
            onChange={(e) => update({ status: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Year
          <select
            className={`${field} mt-1`}
            value={search.year ?? ''}
            onChange={(e) =>
              update({
                year: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">Any</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Min score
          <select
            className={`${field} mt-1`}
            value={search.minScore ?? ''}
            onChange={(e) =>
              update({
                minScore: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">Any</option>
            {[9, 8, 7, 6, 5].map((s) => (
              <option key={s} value={s}>
                {s}+
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1 text-xs font-semibold text-muted">
          Sort by
          <select
            className={`${field} mt-1`}
            value={search.orderBy ?? ''}
            onChange={(e) =>
              update({
                orderBy: (e.target.value ||
                  undefined) as CatalogSearch['orderBy'],
              })
            }
          >
            <option value="">{search.q ? 'Best match' : 'Popularity'}</option>
            {orderByOptions.map((o) => (
              <option key={o} value={o}>
                {orderByLabels[o]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${btn.icon} size-[42px]`}
          onClick={() =>
            update({ sort: search.sort === 'asc' ? 'desc' : 'asc' })
          }
          aria-label={
            search.sort === 'asc'
              ? 'Sorted ascending. Switch to descending'
              : 'Sorted descending. Switch to ascending'
          }
        >
          {search.sort === 'asc' ? (
            <ArrowUpNarrowWide className="size-4" />
          ) : (
            <ArrowDownWideNarrow className="size-4" />
          )}
        </button>
      </div>
      {genres.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted">
            Genres
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => {
              const on = selectedGenres.has(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGenre(g.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${on ? 'bg-accent text-on-accent' : 'bg-surface text-muted ring-1 ring-line hover:text-text'}`}
                >
                  {g.name}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      {activeFilters > 0 && (
        <button
          type="button"
          className="self-start text-sm font-semibold text-muted hover:text-text"
          onClick={() =>
            navigate({ search: { kind: search.kind, q: search.q } })
          }
        >
          Clear filters
        </button>
      )}
    </div>
  )

  return (
    <Container className="py-10">
      <PageHeader title="Search" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div
          role="tablist"
          aria-label="Media type"
          className="flex shrink-0 rounded-lg bg-surface p-1 ring-1 ring-line"
        >
          {(['anime', 'manga'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={search.kind === k}
              onClick={() => navigate({ search: { kind: k, q: search.q } })}
              className={`rounded-md px-4 py-1.5 text-sm font-bold capitalize transition ${search.kind === k ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <label htmlFor="search-q" className="sr-only">
            Search {search.kind} by title
          </label>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            id="search-q"
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              isAnime
                ? 'Try “Frieren” or “Mob Psycho”'
                : 'Try “Vagabond” or “Chainsaw Man”'
            }
            className={`${field} h-11 pl-9`}
          />
        </div>
        <button
          type="button"
          className={`${btn.ghost} lg:hidden`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          {filtersOpen ? (
            <X className="size-4" aria-hidden />
          ) : (
            <SlidersHorizontal className="size-4" aria-hidden />
          )}
          Filters{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside
          aria-label="Filters"
          className={`${filtersOpen ? 'block' : 'hidden'} rounded-2xl border border-line bg-surface/50 p-4 lg:block lg:self-start lg:border-0 lg:bg-transparent lg:p-0`}
        >
          {filterPanel}
        </aside>
        <section
          aria-live="polite"
          aria-busy={loading}
          className={`transition-opacity ${loading ? 'opacity-50' : ''}`}
        >
          {!results.ok ? (
            <ErrorState
              title="Search isn't working right now"
              message={results.error}
            />
          ) : results.items.length === 0 ? (
            <EmptyState
              title={
                search.q
                  ? `No ${search.kind} matches “${search.q}”`
                  : 'Nothing matches these filters'
              }
              message="Check the spelling, try the original Japanese title, or remove a filter."
            />
          ) : (
            <>
              <PosterGrid items={results.items} />
              <Pagination
                {...results.pageInfo}
                to="/search"
                search={(page) => ({
                  ...search,
                  page: page > 1 ? page : undefined,
                })}
              />
            </>
          )}
        </section>
      </div>
    </Container>
  )
}
