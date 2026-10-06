import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestIP } from '@tanstack/react-start/server'
import { tooManyAttempts } from '#/server/auth/rate-limit'
import { eq } from 'drizzle-orm'
import { db, schema } from '#/server/db'

export const Route = createFileRoute('/api/avatar/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!z.uuid().safeParse(params.id).success)
          return new Response('Not found', { status: 404 })
        if (
          await tooManyAttempts(
            `avatar:${getRequestIP() ?? 'unknown'}`,
            240,
            60_000,
          )
        )
          return new Response('Too many avatar requests', {
            status: 429,
            headers: { 'Retry-After': '60' },
          })
        const row = await db.query.users.findFirst({
          where: eq(schema.users.id, params.id),
          columns: { avatarData: true },
        })
        if (!row?.avatarData) return new Response('Not found', { status: 404 })
        return new Response(
          new Uint8Array(Buffer.from(row.avatarData, 'base64')),
          {
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'public, max-age=3600',
              'X-Content-Type-Options': 'nosniff',
            },
          },
        )
      },
    },
  },
})
