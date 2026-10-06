import { createFileRoute, notFound } from '@tanstack/react-router'
import { getManga, getExtras } from '#/lib/catalog.functions'
import { getTracking } from '#/lib/tracking.functions'
import { displayTitle } from '#/lib/media'
import { DetailPage, DetailSkeleton } from '#/components/Detail'

export const Route = createFileRoute('/manga/$id')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    const [media, tracking] = await Promise.all([
      getManga({ data: { id } }),
      getTracking({ data: { kind: 'manga', id } }),
    ])
    if (!media) throw notFound()
    // Not awaited: characters and recommendations stream in afterwards.
    const extras = getExtras({ data: { id, kind: 'manga' } })
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
  component: MangaPage,
})

function MangaPage() {
  const { media, tracking, extras } = Route.useLoaderData()
  return <DetailPage media={media} tracking={tracking} extras={extras} />
}
