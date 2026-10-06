import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import {
  getResponseStatus,
  setResponseHeaders,
} from '@tanstack/react-start/server'
import { createNonce, isUnsafeMethod, securityHeaders } from './server/security'

/**
 * Rejects cross-site POSTs (server functions that change data) using
 * Sec-Fetch-Site, falling back to Origin/Referer. GET navigations from other
 * sites are still allowed, so links to Newarix keep working.
 */
const csrf = createCsrfMiddleware({
  filter: ({ request }) => isUnsafeMethod(request.method),
  failureResponse: () =>
    new Response(JSON.stringify({ error: 'Cross-site request blocked' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
})

const headers = createMiddleware().server(async ({ next, request }) => {
  const nonce = import.meta.env.PROD ? createNonce() : null
  const url = new URL(request.url)
  const https =
    url.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  setResponseHeaders(new Headers(securityHeaders({ nonce, https })))
  const result = await next({ context: { nonce } })
  // Router selects 500 for loader errors. Preserve the catalog's 503 for SSR.
  if (getResponseStatus() === 503 && result.response.status === 500) {
    result.response = new Response(result.response.body, {
      status: 503,
      headers: result.response.headers,
    })
    result.response.headers.set('Retry-After', '60')
  }
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, headers],
}))
