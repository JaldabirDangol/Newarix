# Newarix

Discover anime and manga, follow the weekly airing schedule, and track every episode and chapter you get through.

Catalog data comes from [Jikan](https://jikan.moe) (an unofficial MyAnimeList API). Accounts, lists, history and favorites live in your own Postgres database.

- **Stack:** TanStack Start (React 19, file-based routing, server functions) · Tailwind CSS v4 · Postgres 17 · Redis · Drizzle ORM · JWT sessions (`jose`) · Zod · Vitest · Playwright
- **Research notes and future ideas:** [`docs/research.md`](docs/research.md)

## Episode playback

Anime detail pages include a click-to-load Megavid embedded player, episode selection, subtitled/dubbed audio, and previous/next controls. The embed uses the same MyAnimeList IDs as the catalog URLs, so no additional API key or Miruro deployment is needed. The player only loads when a viewer clicks Play or Watch. Manga pages do not show it.

The production CSP permits `https://megavid.buzz` frames. The iframe is sandboxed without popup or top-level navigation permissions. Availability, subtitle languages, and ads are controlled by the third-party provider; catalog episode listings do not guarantee a playable stream. Reload player requests a fresh source. Playback does not automatically update watch history.

The embed URL format was checked against [MiruroAPI's provider implementation](https://github.com/Shineii86/MiruroAPI/blob/main/src/helpers/pipe.js). `e2e/streaming.spec.ts` exercises the controls and provider error messages using an intercepted player response; it does not verify live provider uptime.

## Quick start

Requirements: Node 22+, Docker.

```bash
cp .env.example .env          # then set JWT_SECRET (command is in the file)
npm install
npm run db:up                 # Postgres on localhost:15434, Redis on localhost:16379
npm run db:migrate            # applies drizzle/*.sql
npm run dev                   # http://localhost:3000 (or the next free port)
```

### Environment variables

| Name             | Required | Notes                                                                                                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | yes      | `postgres://newarix:newarix@localhost:15434/newarix` for the Docker DB                                                                                |
| `JWT_SECRET`     | yes      | Signs session tokens. At least 32 random characters in production.                                                                                    |
| `JIKAN_BASE_URL` | no       | Defaults to `https://api.jikan.moe/v4`. Point it at a self-hosted Jikan if you run one.                                                               |
| `REDIS_URL`      | no       | Shared Jikan cache and rate limits. `redis://localhost:16379` for the Docker Redis; Upstash works too (`rediss://…`). Unset means per-process memory. |
| `DB_POOL_MAX`    | no       | Postgres pool size. Defaults to 1 on Vercel, 10 elsewhere.                                                                                            |
| `DB_PREPARE`     | no       | `true`/`false` for prepared statements. Defaults to off on Vercel (needed for transaction-mode poolers).                                              |

### Scripts

| Script                               | What it does                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `npm run dev`                        | Dev server with HMR                                            |
| `npm run build` / `npm run preview`  | Production build (Nitro) and local preview                     |
| `npm run db:up`                      | Start the Postgres and Redis containers                        |
| `npm run db:generate`                | Create a new migration after editing `src/server/db/schema.ts` |
| `npm run db:migrate`                 | Apply pending migrations                                       |
| `npm run db:studio`                  | Browse the database in Drizzle Studio                          |
| `npm run typecheck` / `npm run lint` | Type and lint checks                                           |
| `npm test`                           | Unit + integration tests (needs the Docker Postgres and Redis) |
| `npm run test:e2e`                   | Playwright tests against a production build and a mock Jikan   |
| `npm run test:live`                  | Contract test against the real Jikan API                       |

## Project structure

```
src/
  routes/                     file-based routes (URL = file path)
    __root.tsx                html shell, navbar, session + theme
    index.tsx                 home: hero, continue watching, shelves
    anime/index.tsx           top anime (ranking tabs, format, pagination)
    anime/$id.tsx             anime detail
    manga/index.tsx           top manga
    manga/$id.tsx             manga detail
    search.tsx                search with filters (debounced, URL-driven)
    schedule.tsx              weekly schedule (JST + your local time)
    random.tsx                redirects to a random anime
    login.tsx, signup.tsx
    _auth.tsx                 guard: everything under _auth/ needs login
    _auth/list.tsx            your list by status
    _auth/history.tsx         activity timeline
    _auth/profile.tsx         stats, genre chart, favorites
  components/                 UI (poster cards, tracker panel, detail page…)
  lib/
    *.functions.ts            server functions, callable from loaders/components
    media.ts                  trims Jikan payloads into small UI shapes
    filters.ts, status.ts     shared enums, labels, search-param schemas
  server/                     server-only code (never shipped to the browser)
    env.ts                    env validation
    kv.ts                     Redis store (memory fallback): cache, rate limits
    security.ts               CSP and security headers
    db/schema.ts, db/index.ts Drizzle schema + pooled client
    auth/                     scrypt hashing, JWT cookie session, middleware, rate limit
    jikan/client.ts           Jikan proxy: rate limit, retry, cache
    tracking.ts               list-entry rules + history recording
  start.ts                    global middleware: CSRF check, security headers
tests/integration/            tracking rules (real Postgres), Redis store
tests/live/                   Jikan contract test (opt-in)
e2e/                          Playwright specs + mock Jikan server
drizzle/                      generated SQL migrations (0000_init.sql is the full schema)
docker-compose.yml            local Postgres + Redis
```

## How it works

### Jikan layer (`src/server/jikan/client.ts`)

The browser never calls Jikan directly. Every request goes through server functions to one server-side client that:

- **Throttles** every call: at most 3 per second and 55 per minute (Jikan allows 60), with at least 350 ms between requests. The request log lives in Redis and is updated by an atomic Lua script, so all server instances share one budget.
- **Retries** 429 and 5xx responses with exponential backoff (1 s, 2 s, 4 s plus jitter), honoring `Retry-After`. Timeouts get one retry, so a hung Jikan fails in seconds rather than a minute.
- **Caches** in Redis with a TTL per endpoint: top lists, seasons and schedules for 1 hour, detail pages for 24 hours, searches for 15 minutes, and genres for 7 days. Identical in-flight requests are shared. When Jikan is down, an expired copy is served instead of an error.
- **Degrades** to a per-process memory store if Redis is unset or unreachable, so a Redis outage never takes the site down.
- **Trims** responses (`src/lib/media.ts`) so pages only carry the fields they render.

Detail pages render as soon as the main record arrives. Characters and recommendations stream in afterwards, so a slow sub-request never blocks the page.

### Auth

- Passwords are hashed with Node's built-in `scrypt` (N=2^15, per-user salt) and compared in constant time.
- On login, the server issues an HS256 JWT (30 days) in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- Each request verifies the token, then loads the user, so a deleted account loses access immediately.
- `authMiddleware` guards every server function that reads or writes a user's own data. The `_auth` layout route redirects logged-out visitors to `/login?redirect=…`, and the redirect only follows same-site paths.
- Login and signup are rate-limited per IP (and per email for login), with counters in Redis.

### Security (`src/start.ts`, `src/server/security.ts`)

- **CSRF:** every POST/PUT/PATCH/DELETE (all server functions that change data) must come from the same origin. This is checked with `Sec-Fetch-Site`, falling back to `Origin`/`Referer`; cross-site requests get a 403. Cross-site GET navigations still work, so links into the site are fine.
- **Content-Security-Policy** in production, with a fresh nonce per request. Scripts must be same-origin or carry the nonce, so no `unsafe-inline` or `unsafe-eval` for scripts. Images may come from any `https:` source (MAL's CDN, user avatar URLs). Embeds are limited to `youtube-nocookie.com`. The CSP is off in `npm run dev` because Vite injects inline scripts.
- **Always sent:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`, plus HSTS over https.

### Tracking rules (`src/server/tracking.ts`)

- The database stores the MAL id plus your tracking data. It also keeps a small snapshot of the title, image, episode/chapter total and genres, refreshed from Jikan on save. That snapshot lets list, history and stats pages render without one Jikan call per row, which the rate limit would otherwise make impossible past a few dozen entries.
- Raising progress on a "plan to watch" entry moves it to Watching. Reaching the last episode marks it Completed. Marking it Completed fills progress to the total.
- Each change writes `watch_history` rows in the same transaction. Pressing −1 right after +1 removes the mistaken "watched episode N" event, so history stays accurate.

## Testing

```bash
npm run db:up                         # Postgres + Redis
npm test                              # 51 unit + integration tests
npx playwright install chromium       # once (or PW_CHANNEL=chrome to use installed Chrome)
npm run test:e2e                      # 20 browser tests
npm run test:live                     # real Jikan API; run when it's reachable
```

- **Unit:** rate-limit maths, memory store, Jikan client (cache, retry/backoff, Retry-After, stale-on-error, 404 handling, request spacing), security headers, password hashing, and the Jikan mappers.
- **Integration:** tracking rules against a real `newarix_test` database (created and migrated automatically), and the Redis store, including atomic slot reservation under concurrent callers.
- **End-to-end:** builds the production server and runs it against `e2e/mock-jikan.mjs` and a `newarix_e2e` database. It covers signup, tracking, history, profile, search, schedule, theme, mobile overflow and logout. It also checks that CSP produces no console errors and that cross-site POSTs get a 403.
- **Live contract:** calls the real Jikan endpoints and validates every field the mappers read (with Zod), so API drift shows up as a clear failure.

The mock Jikan also works for offline development: run `node e2e/mock-jikan.mjs` and set `JIKAN_BASE_URL=http://localhost:4545/v4`.

## Deploying to Vercel

The Vercel build is verified locally (`NITRO_PRESET=vercel npm run build` produces `.vercel/output` with a Node 24 streaming function), and the full e2e suite passes with `VERCEL=1` (serverless DB pool settings).

1. **Database:** create a managed Postgres (Neon, Supabase…). Use its **pooled** connection string as `DATABASE_URL`. The app uses a pool of 1 and no prepared statements on Vercel, which suits transaction-mode poolers.
2. **Redis:** create an Upstash Redis database and set `REDIS_URL` to its `rediss://…` URL. This shares the cache and rate limits across instances. Without it, each instance has its own memory cache and its own Jikan budget.
3. **Migrations:** run them from your machine with `DATABASE_URL=<prod url> npm run db:migrate`.
4. **Project:** import the repo in Vercel. Nitro detects Vercel automatically; if it doesn't, set `NITRO_PRESET=vercel`.
5. **Environment:** set `DATABASE_URL`, `JWT_SECRET` (48+ random characters) and `REDIS_URL`.
6. **Check:** after deploying, run `curl -I https://<your-app>/` and confirm the `content-security-policy` and `strict-transport-security` headers are present.

Elsewhere (Render, Fly, a VPS): `npm run build && node .output/server/index.mjs`.
