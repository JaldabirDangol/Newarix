import { createMiddleware } from '@tanstack/react-start'
import { setResponseHeader, setResponseStatus } from '@tanstack/react-start/server'
import { CatalogError } from './client'

/** Turns AniList outages into a 503 with Retry-After instead of a generic 500. */
export const catalogMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof CatalogError && (error.status >= 500 || error.status === 429)) {
        setResponseStatus(503)
        setResponseHeader('Retry-After', '60')
        throw new Error(error.message)
      }
      throw error
    }
  },
)
