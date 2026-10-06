// Runs the dev server against the local mock AniList (e2e/mock-anilist.mjs).
// Useful offline, or when AniList is down or rate limiting you.
import { spawn } from 'node:child_process'

const mockPort = process.env.MOCK_PORT ?? '4545'
const mock = spawn(process.execPath, ['e2e/mock-anilist.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, MOCK_PORT: mockPort },
})
const app = spawn('npx', ['vite', 'dev', '--port', process.env.PORT ?? '3000'], {
  stdio: 'inherit',
  env: { ...process.env, ANILIST_URL: `http://localhost:${mockPort}/graphql` },
})

const stop = () => {
  mock.kill()
  app.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
app.on('exit', (code) => {
  mock.kill()
  process.exit(code ?? 0)
})
