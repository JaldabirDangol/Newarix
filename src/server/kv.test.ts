import { describe, expect, it } from 'vitest'
import { MemoryStore, slotWait } from './kv'

const limits = { perSecond: 3, perMinute: 5, minGapMs: 100 }

describe('slotWait', () => {
  it('allows the first request immediately', () => {
    expect(slotWait([], 10_000, limits)).toBe(0)
  })

  it('enforces the minimum gap between requests', () => {
    expect(slotWait([10_000], 10_040, limits)).toBe(60)
  })

  it('waits for the per-second window to roll over', () => {
    const sent = [10_000, 10_200, 10_400]
    expect(slotWait(sent, 10_600, limits)).toBe(400)
  })

  it('waits for the per-minute window to roll over', () => {
    const sent = [0, 10_000, 20_000, 30_000, 40_000]
    expect(slotWait(sent, 50_000, limits)).toBe(10_000)
  })

  it('ignores requests older than a minute', () => {
    expect(slotWait([0, 1, 2, 3, 4], 70_000, limits)).toBe(0)
  })
})

describe('MemoryStore', () => {
  it('expires values after their TTL', async () => {
    let now = 0
    const store = new MemoryStore(10, () => now)
    await store.set('a', '1', 1000)
    expect(await store.get('a')).toBe('1')
    now = 1000
    expect(await store.get('a')).toBeNull()
  })

  it('evicts the least recently used entry when full', async () => {
    const store = new MemoryStore(2)
    await store.set('a', '1', 60_000)
    await store.set('b', '2', 60_000)
    await store.get('a') // a is now most recent
    await store.set('c', '3', 60_000)
    expect(await store.get('a')).toBe('1')
    expect(await store.get('b')).toBeNull()
    expect(await store.get('c')).toBe('3')
  })

  it('counts hits within a fixed window', async () => {
    let now = 0
    const store = new MemoryStore(10, () => now)
    expect(await store.hit('k', 1000)).toBe(1)
    expect(await store.hit('k', 1000)).toBe(2)
    now = 1000
    expect(await store.hit('k', 1000)).toBe(1)
  })

  it('reserves slots only when the limits allow', async () => {
    let now = 0
    const store = new MemoryStore(10, () => now)
    expect(await store.reserveSlot('s', limits)).toBe(0)
    expect(await store.reserveSlot('s', limits)).toBe(100)
    now = 100
    expect(await store.reserveSlot('s', limits)).toBe(0)
  })
})
