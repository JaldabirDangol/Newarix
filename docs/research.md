# Research notes

> Historical notes from the Redis-enabled main branch. On `no-redis`, Redis is removed; caches and rate limits use bounded process memory, reset on restart, and are independent across instances. See the branch README for current setup.

## Jikan API v4

Source: the official OpenAPI spec (`jikan-me/jikan-rest`, `storage/api-docs/api-docs.json`), which backs https://docs.api.jikan.moe/.

**Basics**

- Base URL `https://api.jikan.moe/v4`. GET only, read-only, no accounts or user lists, so Newarix owns auth and tracking.
- Rate limits: **3 requests/second, 60/minute**, no daily cap. MyAnimeList can also rate-limit Jikan upstream, which shows up as a 429 or 5xx.
- Jikan caches responses for 24 h on its side (`Expires`, `Last-Modified`, `X-Request-Fingerprint` headers).

**Errors**

- Every error has a JSON body with `status`, `type`, `message` and `error`. Codes: 400 (validation), 404 (not found / MAL 404), 405, 429 (`RateLimitException`), 500 (upstream/parser; may include a `report_url`), and 503 (maintenance).
- Missing scalars come back `null`, missing arrays come back `[]`, and a missing `score` comes back `0`. Newarix maps a score of 0 to "no score".

**Pagination**

- Paginated responses look like `{ pagination: { last_visible_page, has_next_page, current_page, items: { count, total, per_page } }, data: [] }`.
- `limit` is capped at 25. Pages can contain duplicate entries, which Newarix removes.

**Endpoints used**

| Endpoint                                                     | Params that matter                                                                                                                  | Used for                                                                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/top/anime`                                                 | `type` (tv, movie, ova, special, ona, music), `filter` (airing, upcoming, bypopularity, favorite), `rating`, `sfw`, `page`, `limit` | Top anime page, home shelves                                                                                                                                                           |
| `/top/manga`                                                 | `type` (manga, novel, lightnovel, oneshot, doujin, manhwa, manhua), `filter` (publishing, upcoming, bypopularity, favorite)         | Top manga page                                                                                                                                                                         |
| `/anime/{id}/full`, `/manga/{id}/full`                       | —                                                                                                                                   | Detail pages and list snapshots. Includes relations, streaming links, and the trailer (`youtube_id` is sometimes null even when `embed_url` is set, so the id is parsed from the URL). |
| `/anime/{id}/characters`, `/manga/{id}/characters`           | —                                                                                                                                   | Characters, with voice actors for anime                                                                                                                                                |
| `/anime/{id}/recommendations`, `/manga/{id}/recommendations` | —                                                                                                                                   | "If you like this" shelf                                                                                                                                                               |
| `/anime`, `/manga` (search)                                  | `q`, `genres` (comma ids), `type`, `status`, `min_score`, `start_date`/`end_date`, `order_by`, `sort`, `sfw`, `page`                | Search page and navbar suggestions                                                                                                                                                     |
| `/seasons/now`, `/seasons/upcoming`                          | `filter`, `sfw`, `page`, `limit`                                                                                                    | Hero, "Popular this season", "Coming soon". Returned unsorted, so Newarix sorts by members.                                                                                            |
| `/schedules`                                                 | `filter` = weekday, `kids`, `sfw`, `page`                                                                                           | Weekly schedule. Broadcast times are JST.                                                                                                                                              |
| `/genres/anime`, `/genres/manga`                             | `filter` (genres, explicit_genres, themes, demographics)                                                                            | Search genre chips                                                                                                                                                                     |
| `/random/anime`                                              | —                                                                                                                                   | Random button                                                                                                                                                                          |

Not used yet: `/episodes` (per-episode titles and filler flags) and `/pictures`. Both would fit an Episodes tab on the detail page.

## Reference sites

These notes come from my existing knowledge of each site's UX. I did not browse them during this build.

| Site            | Strong                                                                                                                                                    | Weak                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **MyAnimeList** | Deepest data (rank, popularity, members, relations, staff); the canonical scoring scale                                                                   | Dated, dense layout; many clicks to update an entry                               |
| **AniList**     | Poster-first grids, a clean dark theme, and a strong list editor. Hovering a card shows its details. Profiles have stats (genre breakdown, score spread). | The list editor is a modal, so logging one episode is heavier than it needs to be |
| **Kitsu**       | Friendly library with inline +1 progress on cards                                                                                                         | Social feed adds noise                                                            |
| **Simkl**       | Unified "watch history" timeline; up-next rows                                                                                                            | Busy UI, lots of upsell                                                           |
| **Anichart**    | Season chart with countdowns; airing day/time front and centre                                                                                            | Discovery only, no tracking                                                       |
| **Crunchyroll** | "Continue watching" shelf as the first thing you see; cinematic hero                                                                                      | Catalog-only, no ranking info                                                     |

**What Newarix adopted**

- AniList's poster grid and hover reveal, plus its profile stats (genre breakdown and score distribution).
- MyAnimeList's stat strip on detail pages (score, rank, popularity, members, favorites) and its relations list.
- Kitsu's and Crunchyroll's one-tap **+1** on a Continue Watching row, so the most common action takes one click.
- Simkl's day-grouped history timeline.
- Anichart's schedule shown as time slots, with your local time next to JST.
- Status tracking inline on the detail page instead of in a modal. The **episode ribbon** (one cell per episode) shows progress at a glance on cards, lists and the tracker.

## Future features

- **Import from MAL / AniList:** parse a MAL XML export, or use the AniList GraphQL API, and bulk-insert entries plus synthetic history rows.
- **Notifications for new episodes:** a cron job reads `/schedules` and `broadcast` for each user's Watching list, then sends web push or email at air time.
- **Reviews and ratings:** a `reviews` table; show community scores next to the MAL score.
- **Social:** public profiles at `/u/$username`, follows, a friends' activity feed (already modeled by `watch_history`), and list privacy settings.
- **Episode-level tracking:** an `/episodes` tab with filler/recap flags and per-episode check-off on the ribbon.
- **Rewatch counts** and start/finish date editing.
- **Custom lists and tags**, e.g. "Comfort shows" or "Watch with friends".
- **Shared cache:** Redis/Upstash for the Jikan cache and limiter once the app runs on several instances; a nightly prefetch of top lists.
- **Session hardening:** a `token_version` on users so "log out everywhere" can invalidate JWTs early; password reset by email; optional Google OAuth.
- **Seasonal chart page** in the Anichart style, with countdowns to the next episode.
