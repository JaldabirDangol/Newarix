import { prepareTestDatabase } from './db'

export default async function setup() {
  await prepareTestDatabase()
}
