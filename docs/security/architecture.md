# Security architecture map

Audit date: 2026-10-06. Scope: this repository, installed dependency metadata, and isolated local tests. No requests to third-party application endpoints or live production were authorized as test targets.

Browser → TanStack Start request middleware (CSRF/security headers) → React SSR / server functions / four API routes → Drizzle parameterized queries → PostgreSQL. Redis shares catalog caches and rate counters; memory fallback exists. Nitro builds the Node server with Vite. Language: TypeScript/JavaScript; React 19, TanStack Router/Start, Tailwind.

Authentication: scrypt password hashes; HS256 JWT in HttpOnly, SameSite=Lax cookie, Secure in production, 30-day expiry. Every protected call reloads the user and compares tokenVersion. Password reset increments tokenVersion. Reset/verification tokens are random, hashed in SQL, expire and are deleted transactionally on consumption. Google OAuth uses state, nonce, PKCE and verified ID tokens; linking requires the same signed-in local account and matching email.

Authorization: single user role, no admin panel or suspension field. Lists, favorites, history, profile and playback use the authenticated user's ID; no client-provided owner IDs. Catalog functions optionally enrich results with private list status, so their responses are personalized too.

Public API: /api/img fetches exact HTTPS poster host/path allowlists with redirects disabled; /api/avatar/:id serves public normalized WebP avatars; /api/auth/google and callback initiate/complete OAuth. Other RPC endpoints are generated /_serverFn identifiers. Upload: authenticated profile multipart avatar, limited to JPEG/PNG/WebP, 5 MiB, 25 million pixels, normalized with Sharp, stored as base64 in users table. No filesystem/object-storage upload execution.

Outbound services: AniList GraphQL (fixed queries), two poster CDNs, Google token/JWKS endpoints, Resend email API. Browser loads Google Fonts, remote HTTPS images, sandboxed Megavid player and YouTube privacy-enhanced trailer. No payments, webhooks, custom GraphQL endpoint, WebSockets/SSE, cron jobs, background workers, file extraction, or object storage found.

Configuration names (values excluded): DATABASE_URL, JWT_SECRET, REDIS_URL, DB_POOL_MAX, DB_PREPARE, ANILIST_URL, APP_URL, RESEND_API_KEY, EMAIL_FROM, EMAIL_API_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Local .env is ignored. package-lock.json is the dependency lockfile. No checked-in CI/CD workflows, app Dockerfile, reverse proxy, WAF, DNS or production deployment manifests found. docker-compose.yml is a local PostgreSQL/Redis setup with development credentials.

Trust boundaries: browser input → server validation; session claims → current SQL account; application → cache and database; application → allowlisted image sources and fixed outbound APIs; embedded third-party origins → isolated iframe/postMessage validation. Proxy forwarding headers are not trusted for rate-limit client identity by default.

Infrastructure/provider controls (DNS, hosting, TLS, firewall, database roles/TLS, WAF, production secrets, log aggregation, backups and restore history): Not verified — requires infrastructure/provider access.
