import { store } from '../kv'

/**
 * Counts login/signup attempts per key in a fixed window. Backed by the
 * shared store, so the limit holds across server instances when Redis is set.
 */
export async function tooManyAttempts(
  key: string,
  max = 10,
  windowMs = 15 * 60_000,
) {
  const count = await store.hit(`nx:rl:${key}`, windowMs)
  return count > max
}
