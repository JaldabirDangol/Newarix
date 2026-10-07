import { prepareTestDatabase } from '../tests/db'

export default async function setup() {
  await prepareTestDatabase(
    process.env.E2E_DATABASE_URL ??
      'postgres://newarix:newarix@localhost:15434/newarix_e2e',
  )
}
