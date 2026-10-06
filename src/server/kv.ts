import Redis from 'ioredis'
import { env } from './env'

/**
 * Small key-value layer shared by the AniList cache and the rate limiters.
 *
 * With REDIS_URL set, state lives in Redis, so every server instance
 * (including serverless functions) shares one cache and one AniList request
 * budget. Without it, or while Redis is unreachable, a per-process memory
 * store is used so the app keeps working.
 */
export interface Store {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, ttlMs: number) => Promise<void>
  /** Fixed-window counter. Returns the count after this hit. */
  hit: (key: string, windowMs: number) => Promise<number>
  /**
   * Tries to reserve one request slot under a sliding-window limit.
   * Returns 0 when reserved, otherwise how many ms to wait before retrying.
   */
  reserveSlot: (key: string, limits: SlotLimits) => Promise<number>
}

export type SlotLimits = {
  perSecond: number
  perMinute: number
  minGapMs: number
}

export function slotWait(
  sent: number[],
  now: number,
  limits: SlotLimits,
): number {
  const lastMinute = sent.filter((t) => now - t < 60_000)
  const lastSecond = lastMinute.filter((t) => now - t < 1000)
  const last = lastMinute.at(-1)
  let wait = last === undefined ? 0 : last + limits.minGapMs - now
  if (lastSecond.length >= limits.perSecond) {
    wait = Math.max(wait, lastSecond[0] + 1000 - now)
  }
  if (lastMinute.length >= limits.perMinute) {
    wait = Math.max(wait, lastMinute[0] + 60_000 - now)
  }
  return Math.max(0, wait)
}

export class MemoryStore implements Store {
  private values = new Map<string, { value: string; expiresAt: number }>()
  private slots = new Map<string, number[]>()

  constructor(
    private maxEntries = 1000,
    private now: () => number = Date.now,
  ) {}

  get(key: string) {
    const entry = this.values.get(key)
    if (!entry) return Promise.resolve(null)
    if (entry.expiresAt <= this.now()) {
      this.values.delete(key)
      return Promise.resolve(null)
    }
    // Re-insert so eviction drops least-recently-used entries first.
    this.values.delete(key)
    this.values.set(key, entry)
    return Promise.resolve(entry.value)
  }

  set(key: string, value: string, ttlMs: number) {
    this.values.delete(key)
    this.values.set(key, { value, expiresAt: this.now() + ttlMs })
    while (this.values.size > this.maxEntries) {
      const oldest = this.values.keys().next().value
      if (oldest === undefined) break
      this.values.delete(oldest)
    }
    return Promise.resolve()
  }

  hit(key: string, windowMs: number) {
    const now = this.now()
    const entry = this.values.get(key)
    const count = entry && entry.expiresAt > now ? Number(entry.value) + 1 : 1
    this.values.set(key, {
      value: String(count),
      expiresAt:
        entry && entry.expiresAt > now ? entry.expiresAt : now + windowMs,
    })
    return Promise.resolve(count)
  }

  reserveSlot(key: string, limits: SlotLimits) {
    const now = this.now()
    const sent = (this.slots.get(key) ?? []).filter((t) => now - t < 60_000)
    const wait = slotWait(sent, now, limits)
    if (wait === 0) sent.push(now)
    this.slots.set(key, sent)
    return Promise.resolve(wait)
  }
}

// Same rules as slotWait(), run atomically in Redis so concurrent instances
// can't both take the last slot. Uses the Redis clock to avoid skew.
const RESERVE_SCRIPT = `
local key = KEYS[1]
local perSecond = tonumber(ARGV[1])
local perMinute = tonumber(ARGV[2])
local gap = tonumber(ARGV[3])
local member = ARGV[4]
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - 60000)
local wait = 0
local last = redis.call('ZRANGE', key, -1, -1, 'WITHSCORES')
if last[2] then wait = math.max(wait, tonumber(last[2]) + gap - now) end
if redis.call('ZCOUNT', key, now - 999, '+inf') >= perSecond then
  local first = redis.call('ZRANGEBYSCORE', key, now - 999, '+inf', 'WITHSCORES', 'LIMIT', 0, 1)
  wait = math.max(wait, tonumber(first[2]) + 1000 - now)
end
if redis.call('ZCARD', key) >= perMinute then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  wait = math.max(wait, tonumber(oldest[2]) + 60000 - now)
end
if wait <= 0 then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, 61000)
  return 0
end
return wait
`

export class RedisStore implements Store {
  constructor(private redis: Redis) {}

  get(key: string) {
    return this.redis.get(key)
  }

  async set(key: string, value: string, ttlMs: number) {
    await this.redis.set(key, value, 'PX', Math.max(1, Math.round(ttlMs)))
  }

  async hit(key: string, windowMs: number) {
    const [[, count]] = (await this.redis
      .multi()
      .incr(key)
      .pexpire(key, windowMs, 'NX')
      .exec()) as [[Error | null, number], [Error | null, number]]
    return count
  }

  async reserveSlot(key: string, limits: SlotLimits) {
    const member = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const wait = await this.redis.eval(
      RESERVE_SCRIPT,
      1,
      key,
      limits.perSecond,
      limits.perMinute,
      limits.minGapMs,
      member,
    )
    return Number(wait)
  }
}

/** Uses Redis, and falls back to memory for any call Redis fails. */
class FallbackStore implements Store {
  private lastWarning = 0

  constructor(
    private primary: Store,
    private fallback: Store,
  ) {}

  private async run<T>(op: (s: Store) => Promise<T>): Promise<T> {
    try {
      return await op(this.primary)
    } catch (err) {
      if (Date.now() - this.lastWarning > 60_000) {
        this.lastWarning = Date.now()
        console.warn(
          '[kv] Redis unavailable, using in-memory store:',
          (err as Error).message,
        )
      }
      return op(this.fallback)
    }
  }

  get = (key: string) => this.run((s) => s.get(key))
  set = (key: string, value: string, ttlMs: number) =>
    this.run((s) => s.set(key, value, ttlMs))
  hit = (key: string, windowMs: number) => this.run((s) => s.hit(key, windowMs))
  reserveSlot = (key: string, limits: SlotLimits) =>
    this.run((s) => s.reserveSlot(key, limits))
}

function createStore(): Store {
  const memory = new MemoryStore()
  if (!env.redisUrl) return memory
  const redis = new Redis(env.redisUrl, {
    // Fail fast instead of queueing commands while disconnected, so a Redis
    // outage degrades to the memory store rather than hanging requests.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: false,
  })
  redis.on('error', () => {
    // Reported by FallbackStore when a command fails; avoid log spam here.
  })
  return new FallbackStore(new RedisStore(redis), memory)
}

const g = globalThis as unknown as { __newarixStore?: Store }

export const store: Store = (g.__newarixStore ??= createStore())
