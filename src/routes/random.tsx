import { createFileRoute, redirect } from '@tanstack/react-router'
import { getRandomAnimeId } from '#/lib/catalog.functions'
import { Container, ErrorState } from '#/components/ui'

export const Route = createFileRoute('/random')({
  loader: async () => {
    const id = await getRandomAnimeId()
    throw redirect({ to: '/anime/$id', params: { id: String(id) } })
  },
  // Each visit should pick a new title.
  staleTime: 0,
  gcTime: 0,
  errorComponent: () => (
    <Container className="py-16">
      <ErrorState
        title="Couldn't pick a random anime"
        message="The anime database didn't respond. Try again in a moment."
      />
    </Container>
  ),
})
