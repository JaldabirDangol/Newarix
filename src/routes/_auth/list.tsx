import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getMyList } from '#/lib/tracking.functions'
import { listStatuses, statusColor, statusLabel } from '#/lib/status'
import { timeAgo } from '#/lib/format'
import { EpisodeRibbon, detailLink } from '#/components/media'
import { ContinueCard, StatusPill } from '#/components/tracking'
import { QuickEdit } from '#/components/QuickEdit'
import {
  Container,
  EmptyState,
  Img,
  PageHeader,
  btn,
  field,
} from '#/components/ui'
import type { EntryDTO } from '#/lib/tracking.functions'

export const Route = createFileRoute('/_auth/list')({
  validateSearch: z.object({
    kind: z.enum(['anime', 'manga']).catch('anime'),
    status: z.enum(listStatuses).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getMyList({ data: deps }),
  head: () => ({ meta: [{ title: 'My list · Newarix' }] }),
  pendingComponent: () => (
    <Container className="py-10">
      <div className="skeleton mb-8 h-10 w-48 rounded" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton mb-3 h-20 rounded-xl" />
      ))}
    </Container>
  ),
  component: ListPage,
})

const sorts = {
  updated: {
    label: 'Last updated',
    fn: (a: EntryDTO, b: EntryDTO) => b.updatedAt.localeCompare(a.updatedAt),
  },
  title: {
    label: 'Title',
    fn: (a: EntryDTO, b: EntryDTO) => a.title.localeCompare(b.title),
  },
  score: {
    label: 'Your score',
    fn: (a: EntryDTO, b: EntryDTO) => (b.score ?? 0) - (a.score ?? 0),
  },
  progress: {
    label: 'Progress',
    fn: (a: EntryDTO, b: EntryDTO) => b.progress - a.progress,
  },
}

function ListPage() {
  const { entries, counts, total } = Route.useLoaderData()
  const search = Route.useSearch()
  const [sort, setSort] = useState<keyof typeof sorts>('updated')
  const [filter, setFilter] = useState('')
  const kind = search.kind
  const unit = kind === 'anime' ? 'eps' : 'ch'

  const shown = entries
    .filter((e) => e.title.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort(sorts[sort].fn)

  const tab = (
    status: (typeof listStatuses)[number] | undefined,
    label: string,
    n: number,
  ) => (
    <Link
      key={status ?? 'all'}
      to="/list"
      search={{ kind, status }}
      aria-current={search.status === status ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${search.status === status ? 'bg-text text-bg' : 'bg-surface text-muted hover:text-text'}`}
    >
      {status && (
        <span
          className="size-2 rounded-full"
          style={{ background: statusColor[status] }}
          aria-hidden
        />
      )}
      {label}
      <span className="font-mono text-xs opacity-70">{n}</span>
    </Link>
  )

  return (
    <Container className="py-10">
      <PageHeader title="My list">
        <div
          role="tablist"
          aria-label="Media type"
          className="mt-5 inline-flex rounded-lg bg-surface p-1 ring-1 ring-line"
        >
          {(['anime', 'manga'] as const).map((k) => (
            <Link
              key={k}
              role="tab"
              aria-selected={kind === k}
              to="/list"
              search={{ kind: k }}
              className={`rounded-md px-4 py-1.5 text-sm font-bold capitalize ${kind === k ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'}`}
            >
              {k}
            </Link>
          ))}
        </div>
      </PageHeader>

      {total === 0 ? (
        <EmptyState
          title={`Your ${kind} list is empty`}
          message={`Open any ${kind} and choose “Add to list” to start tracking it.`}
          action={
            <Link
              to={kind === 'anime' ? '/anime' : '/manga'}
              className={btn.primary}
            >
              Browse top {kind}
            </Link>
          }
        />
      ) : (
        <>
          <nav
            aria-label="Status"
            className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          >
            {tab(undefined, 'All', total)}
            {listStatuses.map((s) => tab(s, statusLabel(s, kind), counts[s]))}
          </nav>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Filter your list by title</span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by title"
                className={field}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as keyof typeof sorts)}
                className={`${field} w-44`}
              >
                {Object.entries(sorts).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {search.status === 'current' && shown.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => (
                <li key={e.id}>
                  <ContinueCard initial={e} />
                  <div className="mt-2">
                    <QuickEdit entry={e} />
                  </div>
                </li>
              ))}
            </ul>
          ) : shown.length === 0 ? (
            <EmptyState
              title={
                filter
                  ? `Nothing matches “${filter}”`
                  : `No ${search.status ? statusLabel(search.status, kind).toLowerCase() : ''} ${kind} yet`
              }
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {shown.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-4 p-3 transition hover:bg-raised/50"
                >
                  <Link
                    {...detailLink(kind, e.malId)}
                    aria-label={`View ${e.title}`}
                    className="shrink-0 rounded-md"
                  >
                    <Img
                      src={e.imageUrl}
                      alt=""
                      className="h-16 w-11 rounded-md"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      {...detailLink(kind, e.malId)}
                      className="line-clamp-1 font-semibold hover:text-accent-text"
                    >
                      {e.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusPill status={e.status} kind={kind} />
                      <span className="text-xs text-muted">
                        Updated {timeAgo(e.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-2 max-w-sm">
                      <EpisodeRibbon
                        progress={e.progress}
                        total={e.total}
                        kind={kind}
                        size="sm"
                        color={statusColor[e.status]}
                      />
                    </div>
                  </div>
                  <div className="hidden w-24 text-right font-mono text-sm sm:block">
                    {e.progress}
                    <span className="text-muted">
                      /{e.total ?? '?'} {unit}
                    </span>
                  </div>
                  <div className="w-12 text-right font-mono text-sm font-semibold">
                    {e.score ? (
                      <span className="text-accent-text">{e.score}</span>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                    <span className="sr-only"> out of 10</span>
                  </div>
                  <div className="w-full sm:w-auto">
                    <QuickEdit entry={e} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Container>
  )
}
