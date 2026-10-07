# Newarix handoff

> Historical notes from the Redis-enabled main branch. On `no-redis`, Redis is removed; caches and rate limits use bounded process memory, reset on restart, and are independent across instances. See the branch README for current setup.

Read `README.md` first (setup, structure, how the Jikan layer and tracking rules work). Run with:

```bash
npm run db:up && npm run db:migrate && npm run dev   # port 3000 may be taken; Vite picks the next free one
npm run typecheck && npm run lint && npm run build    # all three currently pass
```

## Done

**Setup**

- TanStack Start + Tailwind v4 + Postgres 17 (Docker, port 15434) + Drizzle ORM. Migration in `drizzle/0000_init.sql`.
- `.env` / `.env.example` (`DATABASE_URL`, `JWT_SECRET`, optional `JIKAN_BASE_URL`), env validation in `src/server/env.ts`.

**Database**

- Tables: `users`, `list_entries`, `watch_history`, `favorites`, with enums, foreign keys (cascade), a unique (user, media, mal_id) index, and check constraints on score (1–10) and progress (≥0).

**Auth**

- Email/password signup, login and logout. scrypt hashing, HS256 JWT in an httpOnly cookie (30 days).
- `authMiddleware` on private server functions; `_auth` layout route redirects to `/login?redirect=…` (same-site paths only).
- In-memory rate limit on login and signup; edit profile (username, avatar URL, bio).

**Jikan layer** (`src/server/jikan/client.ts`)

- Server-side proxy only.
- Queue limited to 3/s and 55/min with a 350 ms gap between requests.
- Retry with backoff on 429/5xx (honors Retry-After); one retry on timeout.
- In-memory TTL cache: lists 1 h, details 24 h, search 15 min, genres 7 d. Shares identical in-flight requests and serves stale data when Jikan is down.
- Payloads are trimmed in `src/lib/media.ts`.

**Pages**

- Home: hero, Continue Watching with +1, Popular this season, Top airing, Top all time, Coming soon, Popular manga.
- Top anime / Top manga: ranking tabs, format filter, pagination.
- Search: anime/manga, debounced URL-driven query; filters for genre, format, status, year, minimum score, sort and direction.
- Navbar quick search: combobox with keyboard navigation.
- Anime and manga detail pages: stats, info, synopsis, trailer (click-to-load), relations, streaming links. Characters and recommendations stream in after the main content.
- Schedule: day tabs, JST time slots plus the viewer's local time.
- Random anime.
- My List: status tabs with counts, title filter, sort.
- History: day-grouped timeline, anime/manga filter, "load older" cursor pagination.
- Profile: stats per media type, status bar, genre chart, score distribution, favorites, recent activity.

**Tracking**

- Status, episode/chapter counter (+1/−1 or typed), manga volumes, score 1–10, notes, favorite, remove.
- Automatic rules: planned→watching on progress, last episode→completed, and −1 removes the mistaken history event.

**Polish**

- Dark default with a light toggle (cookie, so no flash).
- Skeletons, error and empty states, app-wide error and not-found pages, top loading bar.
- Responsive, skip link, focus rings, reduced motion respected, lazy images.
- Status colors checked for colorblind separation.

**Verified (first pass)**

- Full browser end-to-end flow against a mock Jikan.
- 429 retry, failure page, recovery and caching.
- Production build boots; no server code in the client bundle.

## Remaining

### Already handled (P0 1–3, P1 4–6)

- ✅ **CSRF** (`src/start.ts`): cross-site POSTs return 403. Covered by e2e.
- ✅ **Security headers + nonce CSP** (`src/server/security.ts`). Covered by unit tests and e2e, including a no-console-errors check under the production CSP.
- ✅ **Redis** (`src/server/kv.ts`): Jikan cache, a shared request budget (atomic Lua script) and login/signup limits, with an automatic memory fallback.
- ✅ **Tests:** `npm test` (51 unit and integration tests), `npm run test:e2e` (20 Playwright tests against the production build), `npm run test:live` (real-Jikan contract test).
- ✅ **Serverless DB pool:** pool of 1 and prepared statements off when `VERCEL` is set. The Vercel build output was verified locally, and e2e passes with `VERCEL=1`.

### Blocked on outside access — finish these first

1. **Run `npm run test:live` once api.jikan.moe is reachable.** It was unreachable from the dev machine for the whole build. If a schema check fails, fix the mapper in `src/lib/media.ts` or the types in `src/server/jikan/types.ts`. Then click through the app with `JIKAN_BASE_URL` unset and check that real posters from `cdn.myanimelist.net` load under the CSP.
2. **Do the real Vercel deploy.** This needs the owner's Vercel account, a pooled Postgres (Neon/Supabase) and Upstash Redis; follow "Deploying to Vercel" in the README. Afterwards, confirm the CSP and HSTS headers with `curl -I`, and do one signup → track → logout run on the live URL.

### P1: production hardening

7. **Session revocation.** Add a `token_version` column checked in `getSessionUser`, so "log out everywhere" and password changes invalidate JWTs.
8. **Password reset and email verification** (needs an email provider).
9. **Return 503 instead of 500** when an error page is caused by Jikan being unavailable.
10. **Run an accessibility audit** (axe or Lighthouse) on every page and fix any findings. No automated a11y run has been done.

### P2: UX gaps

11. **Show list status on poster cards and search results.** One query for the visible ids, then a small status dot on the card.
12. **Quick edit on My List rows:** change status and score inline, instead of only on the detail page or via +1 in the Watching tab.
13. **Stream home sections.** Each shelf should render as it arrives (`Await`) rather than awaiting all five Jikan calls; a cold cache takes about 2 s for the first render.
14. **Recommendation cards have no score or metadata,** because that endpoint doesn't return them. Consider a compact card variant.
15. **Avatar upload.** Currently it only accepts a URL.
16. **Episodes tab** on anime detail (`/anime/{id}/episodes`: titles, filler/recap flags) and a pictures gallery (`/pictures`).
17. **Image optimization:** proxy and resize posters (e.g. `/api/img?url=&w=`) instead of loading MAL's full-size images.
18. **Google login** (deferred by the product owner).

### P3: future features

Listed at the end of `docs/research.md`: MAL/AniList import, new-episode notifications, reviews, public profiles and social features, rewatch counts, custom lists and tags, a seasonal chart.

## Notes

- Nothing is committed yet. Git is on `master`; the intended main branch is `main`.
- `list_entries` and `favorites` store a snapshot (title, image, total, genres) in addition to `mal_id`. This is deliberate, because of Jikan's 60/min limit (see README). Don't remove it without replacing it.
- TanStack JSON-encodes numeric-looking search params (`genres=%221%22`). This is expected.
