import Redis from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { RedisStore } from '#/server/kv'

// Uses database 15 of the docker-compose Redis so dev data is untouched.
const url = process.env.TEST_REDIS_URL ?? 'redis://localhost:16379/15'
const redisTarget = new URL(url)
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(redisTarget.hostname) ||
  redisTarget.pathname !== '/15'
)
  throw new Error('Redis tests require an isolated local test database')
const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
const store = new RedisStore(redis)
let available = true

beforeAll(async () => {
  try {
    await redis.connect()
  } catch {
    available = false
  }
})
beforeEach(async () => {
  if (available) await redis.flushdb()
})
afterAll(() => redis.quit().catch(() => {}))

const limits = { perSecond: 3, perMinute: 5, minGapMs: 0 }

describe('RedisStore', () => {
  it('stores values with a TTL', async ({ skip }) => {
    if (!available) skip()
    await store.set('k', 'v', 1000)
    expect(await store.get('k')).toBe('v')
    expect(await redis.pttl('k')).toBeGreaterThan(0)
  })

  it('counts hits in a fixed window', async ({ skip }) => {
    if (!available) skip()
    expect(await store.hit('rl', 60_000)).toBe(1)
    expect(await store.hit('rl', 60_000)).toBe(2)
    expect(await redis.pttl('rl')).toBeGreaterThan(59_000)
  })

  it('enforces the per-second limit atomically across concurrent callers', async ({
    skip,
  }) => {
    if (!available) skip()
    // Ten instances racing for slots: only three may get one this second.
    const waits = await Promise.all(
      Array.from({ length: 10 }, () => store.reserveSlot('slots', limits)),
    )
    expect(waits.filter((w) => w === 0)).toHaveLength(3)
    expect(waits.filter((w) => w > 0).every((w) => w <= 1000)).toBe(true)
  })

  it('enforces the minimum gap', async ({ skip }) => {
    if (!available) skip()
    expect(await store.reserveSlot('gap', { ...limits, minGapMs: 350 })).toBe(0)
    const wait = await store.reserveSlot('gap', { ...limits, minGapMs: 350 })
    expect(wait).toBeGreaterThan(300)
    expect(wait).toBeLessThanOrEqual(350)
  })
})
