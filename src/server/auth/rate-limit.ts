import { createHash } from 'node:crypto'
import { securityEvent } from '../security-events'
import { store } from '../kv'

/**
 * Counts login/signup attempts per key in a fixed window. Backed by the
 * memory store, so the limit holds within one server process.
 */
export async function tooManyAttempts(
  key: string,
  max = 10,
  windowMs = 15 * 60_000,
) {
  // Fixed-size opaque keys keep emails and other identifiers out of store keys.
  const digest = createHash('sha256').update(key).digest('hex')
  const count = await store.hit(`nx:rl:${digest}`, windowMs)
  if (count > max) securityEvent('rate_limited')
  return count > max
}
