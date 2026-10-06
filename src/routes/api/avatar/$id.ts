import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db, schema } from '#/server/db'

export const Route = createFileRoute('/api/avatar/$id')({ server: { handlers: {
  GET: async ({ params }) => {
    if (!/^[a-f0-9-]{36}$/.test(params.id)) return new Response('Not found', { status: 404 })
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, params.id), columns: { avatarData: true } })
    if (!row?.avatarData) return new Response('Not found', { status: 404 })
    return new Response(new Uint8Array(Buffer.from(row.avatarData, 'base64')), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } })
  },
} } })
