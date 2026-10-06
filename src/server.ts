import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import type { RequestHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'
import { boundedRequest, RequestLimitError } from './server/request-limits'
import { createNonce, securityHeaders } from './server/security'

const handle = createStartHandler(defaultStreamHandler)
const fetch: RequestHandler<Register> = async (request, ...args) => {
  try {
    const response = await handle(await boundedRequest(request), ...args)
    const secured = new Headers(response.headers)
    const baseline = securityHeaders({
      nonce: null,
      https: new URL(request.url).protocol === 'https:',
    })
    for (const [name, value] of Object.entries(baseline))
      if (!secured.has(name)) secured.set(name, value)
    if (!secured.has('Cache-Control'))
      secured.set('Cache-Control', 'private, no-store')
    secured.set('Referrer-Policy', 'no-referrer')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: secured,
    })
  } catch (error) {
    const limited = error instanceof RequestLimitError
    if (!limited) console.error('[security] Request processing failed')
    return new Response(limited ? error.message : 'Internal server error', {
      status: limited ? error.status : 500,
      headers: {
        ...securityHeaders({
          nonce: import.meta.env.PROD ? createNonce() : null,
          https: new URL(request.url).protocol === 'https:',
        }),
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}
export default { fetch }
