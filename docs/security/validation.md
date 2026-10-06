# Security validation

Date: 2026-10-06. Controlled local checks only; no production/third-party exploit or stress tests.

| Check                                     | Result                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| npm test                                  | 108 tests passed in 14 files, including PostgreSQL/Redis integration tests                                            |
| npm run test:e2e                          | 62 Chromium browser tests passed, including 32 accessibility checks and account/tracking/recovery/upload/player flows |
| npm run typecheck                         | Passed                                                                                                                |
| npm run lint                              | Passed                                                                                                                |
| Production build                          | Passed as part of browser-server startup; production CSP/hydration verified                                           |
| npm audit --json                          | Zero reported vulnerabilities; 566 dependency entries including optional/dev                                          |
| Drizzle CLI --help                        | Passed                                                                                                                |
| Drizzle migration generation              | Passed against the existing schema into isolated /tmp output; no project migrations or database changed               |
| git diff --check                          | Passed                                                                                                                |
| Secret heuristic scan                     | 141 reachable historical blobs and current project/artifacts; only known synthetic fixture candidates identified      |
| Exact local .env values vs browser assets | No matches; values never printed                                                                                      |
| Browser source maps                       | None emitted                                                                                                          |
| Runtime local service bindings            | Existing DB/Redis containers still expose all host interfaces; config changes not applied to running services         |

New regression coverage: streamed/chunked oversized input, false Content-Length, read timeouts, compressed-body rejection, Nitro Request proxy handling, cache byte limits, security-counter eviction/capacity, production Redis fail-closed behavior, processing admission/release, catalog saturation, expired/wrong JWT claims, deleted/revoked sessions, stale tokenVersion session issuance, protected cookie flags, DTO exclusions, legacy password compatibility, dummy KDF, safe external links and redirect normalization, concurrent progress creation and two-account isolation. Built-server tests verify no-store/referrer/error headers, CSRF origin rejection, body limits and rejection of internal image targets without fetching them. Existing OAuth/reset/verification/upload tests supply additional coverage.

Earlier failures were resolved: Nitro native-Request copying, server env imports in client hydration, missing headers on direct/error responses, and two stale gallery selectors. A fast isolated browser subset exhausted the deliberately conservative upstream catalog budget; the full suite warms catalog caches and completed normally. No limiter was disabled to make tests pass. Upstream saturation still returns a retryable failure by design.

Build warnings about bundled module-level "use client" directives remain in dependencies; final production browser tests reported no script/CSP errors. Framework logs may still contain protected internal stack traces for invalid function IDs or intentionally simulated provider failures. They are not proof of client stack-trace disclosure; provider log access/redaction must be verified separately.

Infrastructure controls, production DNS/TLS/WAF/CI permissions, production DB roles/network/TLS, log aggregation and backup/restore evidence: **Not verified — requires infrastructure/provider access.**
