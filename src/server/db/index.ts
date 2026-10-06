import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  __newarixSql?: ReturnType<typeof postgres>
}

function createClient() {
  // Serverless platforms run many instances at once, each with its own pool,
  // so keep each pool tiny and rely on the provider's pooled connection URL.
  // Transaction-mode poolers (PgBouncer, Neon/Supabase pooled URLs) don't
  // support prepared statements, so those are off there too.
  const max = Number(process.env.DB_POOL_MAX) || (env.isServerless ? 1 : 10)
  return postgres(env.databaseUrl, {
    max,
    prepare: process.env.DB_PREPARE
      ? process.env.DB_PREPARE === 'true'
      : !env.isServerless,
    idle_timeout: env.isServerless ? 5 : 30,
    connect_timeout: 10,
  })
}

// Reuse one connection pool across dev-server reloads and warm invocations.
const client = (globalForDb.__newarixSql ??= createClient())

export const db = drizzle(client, { schema })
export { schema }
