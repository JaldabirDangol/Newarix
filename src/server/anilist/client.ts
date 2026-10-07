import { createHash } from 'node:crypto'
import { env } from '../env'
import { store as defaultStore } from '../kv'
import type { SlotLimits, Store } from '../kv'

/**
 * Server-side AniList GraphQL client (https://docs.anilist.co).
 *
 * - Every request reserves a slot under AniList's rate limit. AniList allows
 *   90 requests/minute normally and 30 while in degraded mode, so the budget
 *   stays under 30. The slot log lives in memory, so callers in one server
 *   process share a budget.
 * - 429 and 5xx responses are retried with exponential backoff, honoring
 *   Retry-After. Timeouts get one retry.
 * - Responses are cached in the process memory store with a TTL per query. If AniList
 *   is down, an expired copy is served instead of an error.
 * - Identical in-flight requests within one process are shared.
 */

export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'CatalogError'
  }
}

export const LIMITS: SlotLimits = { perSecond: 2, perMinute: 25, minGapMs: 400 }
const MAX_ATTEMPTS = 4
const TIMEOUT_MS = 10_000
// How long an expired entry may still be served when AniList is failing.
const STALE_GRACE_MS = 7 * 24 * 60 * 60_000
const SLOT_KEY = 'nx:anilist:slots'
const CACHE_PREFIX = 'nx:anilist:c:'

export const TTL = {
  list: 60 * 60_000, // top lists, seasons, schedules: 1 hour
  detail: 24 * 60 * 60_000, // anime/manga detail: 24 hours
  search: 15 * 60_000,
  meta: 7 * 24 * 60 * 60_000, // genre lists
  none: 0,
} as const

const MESSAGES = {
  busy: 'The anime database (AniList) is busy right now. Try again in a minute.',
  down: "The anime database (AniList) isn't responding. Try again shortly.",
  unreachable:
    "Couldn't reach the anime database (AniList). Try again shortly.",
}

export type Variables = Record<string, unknown>

type GraphQLResponse = {
  data?: unknown
  errors?: { message: string; status?: number }[] | null
}

/** Stable cache key: the operation name for readability, plus a hash of query and variables. */
export function cacheKey(query: string, variables: Variables) {
  const name = /\b(?:query)\s+(\w+)/.exec(query)?.[1] ?? 'query'
  const sorted = JSON.stringify(variables, Object.keys(variables).sort())
  const hash = createHash('sha1')
    .update(query)
    .update(sorted)
    .digest('hex')
    .slice(0, 20)
  return `${name}:${hash}`
}

export function backoffMs(
  attempt: number,
  retryAfter: string | null,
  random = Math.random,
) {
  const seconds = retryAfter ? Number(retryAfter) : NaN
  if (Number.isFinite(seconds) && seconds > 0)
    return Math.min(seconds, 60) * 1000
  return 1000 * 2 ** attempt + random() * 400
}

type CacheEntry = { data: unknown; expiresAt: number }

export type ClientDeps = {
  store: Store
  url: string
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  now: () => number
}

export function createAniListClient(deps: ClientDeps) {
  const inflight = new Map<string, Promise<unknown>>()
  // Serializes slot reservations within this process so callers are served in order.
  let queue = Promise.resolve()

  function acquireSlot(): Promise<void> {
    const deadline = deps.now() + 15_000
    const turn = queue.then(async () => {
      for (;;) {
        if (deps.now() >= deadline) throw new CatalogError(MESSAGES.busy, 503)
        const wait = await deps.store.reserveSlot(SLOT_KEY, LIMITS)
        if (wait <= 0) return
        if (deps.now() + wait >= deadline)
          throw new CatalogError(MESSAGES.busy, 503)
        await deps.sleep(wait)
      }
    })
    queue = turn.catch(() => {})
    return turn
  }

  async function send(query: string, variables: Variables): Promise<unknown> {
    let lastError: CatalogError | null = null
    let retryAfter: string | null = null
    const operationName = /\bquery\s+(\w+)/.exec(query)?.[1]
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await deps.sleep(backoffMs(attempt - 1, retryAfter))
      retryAfter = null
      await acquireSlot()
      let res: Response
      try {
        res = await deps.fetch(deps.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables, operationName }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch {
        // Timeouts and network errors: one retry is enough.
        lastError = new CatalogError(MESSAGES.unreachable, 503)
        if (attempt >= 1) break
        continue
      }
      if (res.status === 429 || res.status >= 500) {
        retryAfter = res.headers.get('retry-after')
        lastError = new CatalogError(
          res.status === 429 ? MESSAGES.busy : MESSAGES.down,
          res.status,
        )
        continue
      }
      let body: GraphQLResponse
      try {
        body = (await res.json()) as GraphQLResponse
      } catch {
        lastError = new CatalogError(MESSAGES.down, 502)
        continue
      }
      const errors = body.errors ?? []
      if (errors.some((e) => e.status === 404) || res.status === 404) {
        throw new CatalogError('Not found', 404)
      }
      if (!res.ok || (errors.length && !body.data)) {
        // Bad query or variables: retrying won't help.
        throw new CatalogError(
          'The anime database rejected the request.',
          res.status || 400,
        )
      }
      return body.data
    }
    throw lastError ?? new CatalogError(MESSAGES.unreachable, 503)
  }

  async function readCache(key: string): Promise<CacheEntry | null> {
    const raw = await deps.store.get(CACHE_PREFIX + key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as CacheEntry
    } catch {
      return null
    }
  }

  return async function anilist<T>(
    query: string,
    variables: Variables = {},
    ttl: number = TTL.list,
  ): Promise<T> {
    const key = cacheKey(query, variables)
    const cached = ttl > 0 ? await readCache(key) : null
    if (cached && cached.expiresAt > deps.now()) return cached.data as T

    const pending = inflight.get(key)
    if (pending) return pending as Promise<T>

    // Do not grow an unlimited queue of distinct cache misses.
    if (inflight.size >= 32) throw new CatalogError(MESSAGES.busy, 503)
    const request = send(query, variables)
      .then(async (data) => {
        if (ttl > 0) {
          const entry: CacheEntry = { data, expiresAt: deps.now() + ttl }
          // Keep it past expiry so it can be served while AniList is down.
          await deps.store.set(
            CACHE_PREFIX + key,
            JSON.stringify(entry),
            ttl + STALE_GRACE_MS,
          )
        }
        return data
      })
      .catch((err: unknown) => {
        const isNotFound = err instanceof CatalogError && err.status === 404
        if (!isNotFound && cached) return cached.data
        throw err
      })
      .finally(() => inflight.delete(key))

    inflight.set(key, request)
    return request as Promise<T>
  }
}

export const anilist = createAniListClient({
  store: defaultStore,
  url: env.anilistUrl,
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: Date.now,
})
