import { describe, expect, it, vi } from 'vitest'
import { MemoryStore } from '../kv'
import {
  CatalogError,
  TTL,
  backoffMs,
  cacheKey,
  createAniListClient,
} from './client'

type Reply =
  | { status: number; body?: unknown; headers?: Record<string, string> }
  | 'network-error'

const QUERY = 'query Test($id: Int) { Media(idMal: $id) { id } }'

/** An AniList client wired to a fake clock, fake fetch and instant sleeps. */
function setup(replies: Reply[]) {
  let now = 1_000_000
  const sleeps: number[] = []
  const bodies: {
    query: string
    variables: unknown
    operationName?: string
  }[] = []
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)))
    const reply = replies.shift()
    if (!reply) throw new Error('unexpected request')
    if (reply === 'network-error')
      return Promise.reject(new TypeError('fetch failed'))
    return Promise.resolve(
      new Response(JSON.stringify(reply.body ?? { data: {} }), {
        status: reply.status,
        headers: reply.headers,
      }),
    )
  })
  const client = createAniListClient({
    store: new MemoryStore(100, () => now),
    url: 'https://anilist.test/graphql',
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: (ms) => {
      sleeps.push(ms)
      now += ms
      return Promise.resolve()
    },
    now: () => now,
  })
  return { client, fetch, sleeps, bodies, advance: (ms: number) => (now += ms) }
}

const ok = (data: unknown): Reply => ({ status: 200, body: { data } })

describe('cacheKey', () => {
  it('ignores variable order and changes with the query', () => {
    expect(cacheKey(QUERY, { a: 1, b: 2 })).toBe(
      cacheKey(QUERY, { b: 2, a: 1 }),
    )
    expect(cacheKey(QUERY, { a: 1 })).not.toBe(cacheKey(QUERY, { a: 2 }))
    expect(cacheKey(QUERY, {})).not.toBe(cacheKey(`${QUERY} `, {}))
    expect(cacheKey(QUERY, {})).toMatch(/^Test:/)
  })
})

describe('backoffMs', () => {
  it('doubles per attempt with jitter', () => {
    expect(backoffMs(0, null, () => 0)).toBe(1000)
    expect(backoffMs(2, null, () => 0)).toBe(4000)
  })

  it('honors Retry-After, capped at 60 seconds', () => {
    expect(backoffMs(0, '3')).toBe(3000)
    expect(backoffMs(0, '600')).toBe(60_000)
  })
})

describe('anilist client', () => {
  it('posts the query, variables and operation name', async () => {
    const t = setup([ok({ Media: { id: 1 } })])
    expect(await t.client(QUERY, { id: 5 })).toEqual({ Media: { id: 1 } })
    expect(t.bodies[0]).toEqual({
      query: QUERY,
      variables: { id: 5 },
      operationName: 'Test',
    })
  })

  it('caches responses for the TTL', async () => {
    const t = setup([ok({ n: 1 }), ok({ n: 2 })])
    expect(await t.client(QUERY, {}, TTL.list)).toEqual({ n: 1 })
    expect(await t.client(QUERY, {}, TTL.list)).toEqual({ n: 1 })
    expect(t.fetch).toHaveBeenCalledTimes(1)
    t.advance(TTL.list)
    expect(await t.client(QUERY, {}, TTL.list)).toEqual({ n: 2 })
  })

  it('does not cache when the TTL is zero', async () => {
    const t = setup([ok({ n: 1 }), ok({ n: 2 })])
    await t.client(QUERY, {}, TTL.none)
    expect(await t.client(QUERY, {}, TTL.none)).toEqual({ n: 2 })
  })

  it('shares one request between identical concurrent calls', async () => {
    const t = setup([ok({ n: 'once' })])
    const [a, b] = await Promise.all([
      t.client(QUERY, { id: 1 }),
      t.client(QUERY, { id: 1 }),
    ])
    expect(a).toEqual(b)
    expect(t.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries 429 with backoff, honoring Retry-After', async () => {
    const t = setup([
      { status: 429, headers: { 'retry-after': '2' } },
      { status: 429 },
      ok({ n: 'ok' }),
    ])
    expect(await t.client(QUERY)).toEqual({ n: 'ok' })
    expect(t.fetch).toHaveBeenCalledTimes(3)
    expect(t.sleeps[0]).toBe(2000)
  })

  it('retries 5xx and gives up after four attempts with a readable error', async () => {
    const t = setup([
      { status: 500 },
      { status: 502 },
      { status: 503 },
      { status: 504 },
    ])
    const err = await t.client(QUERY).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CatalogError)
    expect((err as CatalogError).message).toMatch(/AniList\) isn't responding/)
    expect(t.fetch).toHaveBeenCalledTimes(4)
  })

  it('treats a GraphQL 404 as not found without retrying', async () => {
    const t = setup([
      {
        status: 404,
        body: {
          data: { Media: null },
          errors: [{ message: 'Not Found.', status: 404 }],
        },
      },
    ])
    await expect(t.client(QUERY)).rejects.toMatchObject({ status: 404 })
    expect(t.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a rejected query', async () => {
    const t = setup([
      {
        status: 400,
        body: { data: null, errors: [{ message: 'Unknown argument "foo"' }] },
      },
    ])
    await expect(t.client(QUERY)).rejects.toThrow(/rejected the request/)
    expect(t.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a network error only once', async () => {
    const t = setup(['network-error', 'network-error'])
    await expect(t.client(QUERY)).rejects.toMatchObject({ status: 503 })
    expect(t.fetch).toHaveBeenCalledTimes(2)
  })

  it('serves an expired copy when AniList fails', async () => {
    const t = setup([
      ok({ n: 'old' }),
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
    ])
    await t.client(QUERY, {}, TTL.list)
    t.advance(TTL.list + 1)
    expect(await t.client(QUERY, {}, TTL.list)).toEqual({ n: 'old' })
  })

  it('does not serve a stale copy for a 404', async () => {
    const t = setup([
      ok({ n: 'old' }),
      {
        status: 404,
        body: { errors: [{ message: 'Not Found.', status: 404 }] },
      },
    ])
    await t.client(QUERY, {}, TTL.list)
    t.advance(TTL.list + 1)
    await expect(t.client(QUERY, {}, TTL.list)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('spaces requests to stay under the rate limit', async () => {
    const t = setup([1, 2, 3].map((n) => ok({ n })))
    await Promise.all([1, 2, 3].map((id) => t.client(QUERY, { id })))
    expect(t.fetch).toHaveBeenCalledTimes(3)
    // Two requests per second at most, at least 400 ms apart.
    expect(t.sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1000)
  })
})

it('rejects a saturated upstream budget instead of waiting indefinitely', async () => {
  const memory = new MemoryStore()
  const client = createAniListClient({
    store: {
      get: memory.get.bind(memory),
      set: memory.set.bind(memory),
      hit: memory.hit.bind(memory),
      reserveSlot: async () => 60_000,
    },
    url: 'https://anilist.test/graphql',
    fetch: vi.fn(),
    sleep: vi.fn(),
    now: Date.now,
  })
  await expect(client(QUERY)).rejects.toMatchObject({ status: 503 })
})
