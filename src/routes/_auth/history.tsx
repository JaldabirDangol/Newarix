import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { getHistory } from '#/lib/tracking.functions'
import { formatDay } from '#/lib/format'
import { useMounted } from '#/lib/hooks'
import { HistoryItem } from '#/components/HistoryItem'
import { Container, EmptyState, PageHeader, btn } from '#/components/ui'
import type { HistoryDTO } from '#/lib/tracking.functions'

export const Route = createFileRoute('/_auth/history')({
  validateSearch: z.object({
    kind: z.enum(['anime', 'manga']).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getHistory({ data: { kind: deps.kind } }),
  head: () => ({ meta: [{ title: 'History · Newarix' }] }),
  pendingComponent: () => (
    <Container className="py-10">
      <div className="skeleton mb-8 h-10 w-48 rounded" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton mb-3 h-14 rounded-xl" />
      ))}
    </Container>
  ),
  component: HistoryPage,
})

function HistoryPage() {
  const first = Route.useLoaderData()
  const search = Route.useSearch()
  const mounted = useMounted()
  const [items, setItems] = useState(first.items)
  const [hasMore, setHasMore] = useState(first.hasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setItems(first.items)
    setHasMore(first.hasMore)
  }, [first])

  const loadMore = async () => {
    setLoading(true)
    setError(false)
    try {
      const next = await getHistory({
        data: { kind: search.kind, before: items.at(-1)?.createdAt },
      })
      setItems((prev) => [...prev, ...next.items])
      setHasMore(next.hasMore)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // Group by local calendar day; before hydration, group by UTC day so the
  // server and browser render the same markup.
  const groups = new Map<string, HistoryDTO[]>()
  for (const h of items) {
    const key = mounted
      ? new Date(h.createdAt).toDateString()
      : h.createdAt.slice(0, 10)
    groups.set(key, [...(groups.get(key) ?? []), h])
  }

  const filters = [
    { kind: undefined, label: 'All' },
    { kind: 'anime', label: 'Anime' },
    { kind: 'manga', label: 'Manga' },
  ] as const

  return (
    <Container narrow className="py-10">
      <PageHeader title="History">
        <nav aria-label="Filter history" className="mt-5 flex gap-1.5">
          {filters.map((f) => (
            <Link
              key={f.label}
              to="/history"
              search={{ kind: f.kind }}
              aria-current={search.kind === f.kind ? 'page' : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${search.kind === f.kind ? 'bg-text text-bg' : 'bg-surface text-muted hover:text-text'}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          message="Each episode or chapter you log, and each title you finish, will show up here."
          action={
            <Link to="/anime" className={btn.primary}>
              Find something to watch
            </Link>
          }
        />
      ) : (
        <>
          {[...groups.entries()].map(([day, list]) => (
            <section
              key={day}
              className="mb-8"
              aria-label={formatDay(list[0].createdAt)}
            >
              <h2 className="sticky top-16 z-10 -mx-2 mb-1 bg-bg/90 px-2 py-2 text-xs font-bold tracking-wider text-muted uppercase backdrop-blur">
                {mounted ? formatDay(list[0].createdAt) : day}
              </h2>
              <ol className="relative before:absolute before:top-0 before:bottom-0 before:left-[4px] before:w-px before:bg-line">
                {list.map((h) => (
                  <HistoryItem key={h.id} h={h} />
                ))}
              </ol>
            </section>
          ))}
          {hasMore && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className={btn.ghost}
              >
                {loading && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Load older activity
              </button>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  Couldn't load more. Try again.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Container>
  )
}
