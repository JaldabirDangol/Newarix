import { createFileRoute } from '@tanstack/react-router'
import { beginGoogle } from '#/server/auth/google'

export const Route = createFileRoute('/api/auth/google/')({ server: { handlers: { GET: beginGoogle } } })
