import { createFileRoute } from '@tanstack/react-router'
import { finishGoogle } from '#/server/auth/google'

export const Route = createFileRoute('/api/auth/google/callback')({ server: { handlers: { GET: ({ request }) => finishGoogle(request) } } })
