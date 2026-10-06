import { Link } from '@tanstack/react-router'
import { Container, EmptyState, ErrorState, btn } from './ui'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function RouteError({ error }: ErrorComponentProps) {
  return (
    <Container className="py-16">
      <ErrorState
        title="This page couldn't load"
        message={
          error instanceof Error
            ? error.message
            : 'An unexpected error happened.'
        }
      />
    </Container>
  )
}

export function RouteNotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        title="This page doesn't exist"
        message="The link may be broken, or the title isn't in the AniList catalog."
        action={
          <Link to="/" className={btn.primary}>
            Go to the home page
          </Link>
        }
      />
    </Container>
  )
}
