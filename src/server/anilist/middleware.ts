import {
  getRequestIP,
  setResponseHeader,
  setResponseStatus,
} from '@tanstack/react-start/server'
import { tooManyAttempts } from '../auth/rate-limit'
import { createMiddleware } from '@tanstack/react-start'
import { CatalogError } from './client'

/** Turns AniList outages into a 503 with Retry-After instead of a generic 500. */
export const catalogMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      if (
        await tooManyAttempts(
          `catalog:${getRequestIP() ?? 'unknown'}`,
          240,
          60_000,
        )
      ) {
        setResponseStatus(429)
        setResponseHeader('Retry-After', '60')
        throw new Error('Too many catalog requests. Try again shortly.')
      }
      return await next()
    } catch (error) {
      if (
        error instanceof CatalogError &&
        (error.status >= 500 || error.status === 429)
      ) {
        setResponseStatus(503)
        setResponseHeader('Retry-After', '60')
        throw new Error(error.message)
      }
      throw error
    }
  },
)
