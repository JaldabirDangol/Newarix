import Redis from 'ioredis'
import { prepareTestDatabase } from '../tests/db'

export default async function setup() {
  await prepareTestDatabase(
    process.env.E2E_DATABASE_URL ??
      'postgres://newarix:newarix@localhost:15434/newarix_e2e',
  )
  // Fresh rate-limit counters and AniList cache for each run.
  const redis = new Redis(
    process.env.E2E_REDIS_URL ?? 'redis://localhost:16379/14',
    {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    },
  )
  try {
    await redis.connect()
    await redis.flushdb()
  } catch {
    // No Redis: the app falls back to its in-memory store.
  } finally {
    redis.disconnect()
  }
}
