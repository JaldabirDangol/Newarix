/**
 * Bounded, per-process memory cache and rate-limit counters.
 * State is shared within this process and resets when the process restarts.
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
  private counters = new Map<string, { count: number; expiresAt: number }>()
  private bytes = 0

  constructor(
    private maxEntries = 1000,
    private now: () => number = Date.now,
    private maxBytes = 32 * 1024 * 1024,
  ) {}

  get(key: string) {
    const entry = this.values.get(key)
    if (!entry) return Promise.resolve(null)
    if (entry.expiresAt <= this.now()) {
      this.bytes -= Buffer.byteLength(entry.value)
      this.values.delete(key)
      return Promise.resolve(null)
    }
    // Re-insert so eviction drops least-recently-used entries first.
    this.values.delete(key)
    this.values.set(key, entry)
    return Promise.resolve(entry.value)
  }

  set(key: string, value: string, ttlMs: number) {
    const previous = this.values.get(key)
    if (previous) this.bytes -= Buffer.byteLength(previous.value)
    this.values.delete(key)
    const size = Buffer.byteLength(value)
    if (size > this.maxBytes) return Promise.resolve()
    this.values.set(key, { value, expiresAt: this.now() + ttlMs })
    this.bytes += size
    while (this.values.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.values.keys().next().value
      if (oldest === undefined) break
      this.bytes -= Buffer.byteLength(this.values.get(oldest)!.value)
      this.values.delete(oldest)
    }
    return Promise.resolve()
  }

  hit(key: string, windowMs: number) {
    const now = this.now()
    for (const [name, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(name)
    }
    const entry = this.counters.get(key)
    // Never evict active security counters to make room for attacker keys.
    if (!entry && this.counters.size >= this.maxEntries)
      return Promise.resolve(Infinity)
    const count = (entry?.count ?? 0) + 1
    this.counters.set(key, {
      count,
      expiresAt: entry?.expiresAt ?? now + windowMs,
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

const g = globalThis as unknown as { __newarixStore?: Store }

export const store: Store = (g.__newarixStore ??= new MemoryStore())
