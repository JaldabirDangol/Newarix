import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://newarix:newarix@localhost:15434/newarix_test'

/** Creates the test database if needed and applies all migrations. */
export async function prepareTestDatabase(url = TEST_DB_URL) {
  const target = new URL(url)
  const name = target.pathname.slice(1)
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^[a-zA-Z0-9_]+_(test|e2e)$/.test(name)
  ) {
    throw new Error(
      'Tests require an isolated local database ending in _test or _e2e',
    )
  }
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const adminSql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  try {
    const exists =
      await adminSql`select 1 from pg_database where datname = ${name}`
    if (!exists.length) await adminSql.unsafe(`create database "${name}"`)
  } finally {
    await adminSql.end()
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' })
  } finally {
    await sql.end()
  }
}
