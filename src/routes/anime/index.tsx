import { createFileRoute } from '@tanstack/react-router'
import { getTopList } from '#/lib/catalog.functions'
import { topSearchSchema } from '#/lib/filters'
import { TopList, TopListSkeleton } from '#/components/TopList'

export const Route = createFileRoute('/anime/')({
  validateSearch: topSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getTopList({
      data: {
        kind: 'anime',
        type: deps.type,
        filter: deps.filter,
        page: deps.page ?? 1,
      },
    }),
  staleTime: 5 * 60_000,
  head: () => ({ meta: [{ title: 'Top anime · Newarix' }] }),
  pendingComponent: TopListSkeleton,
  component: TopAnime,
})

function TopAnime() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TopList
      kind="anime"
      search={search}
      items={data.items}
      pageInfo={data.pageInfo}
      onTypeChange={(type) =>
        navigate({ search: { ...search, type, page: undefined } })
      }
    />
  )
}
