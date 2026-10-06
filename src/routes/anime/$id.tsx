import { createFileRoute, notFound } from '@tanstack/react-router'
import { getAnime, getExtras } from '#/lib/catalog.functions'
import { getTracking } from '#/lib/tracking.functions'
import { displayTitle } from '#/lib/media'
import { DetailPage, DetailSkeleton } from '#/components/Detail'

export const Route = createFileRoute('/anime/$id')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    const [media, tracking] = await Promise.all([
      getAnime({ data: { id } }),
      getTracking({ data: { kind: 'anime', id } }),
    ])
    if (!media) throw notFound()
    // Not awaited: characters and recommendations stream in afterwards.
    const extras = getExtras({ data: { id, kind: 'anime' } })
    return { media, tracking, extras }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${displayTitle(loaderData.media)} · Newarix` },
          {
            name: 'description',
            content: loaderData.media.synopsis?.slice(0, 160) ?? '',
          },
          { property: 'og:image', content: loaderData.media.imageLarge ?? '' },
        ]
      : [],
  }),
  pendingComponent: DetailSkeleton,
  component: AnimePage,
})

function AnimePage() {
  const { media, tracking, extras } = Route.useLoaderData()
  return <DetailPage media={media} tracking={tracking} extras={extras} />
}
