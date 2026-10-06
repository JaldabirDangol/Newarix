import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { deleteCookie, getCookie, getRequestIP, setCookie } from '@tanstack/react-start/server'
import { env } from '../env'
import { db, schema } from '../db'
import { getSessionUser, startSession } from './session'
import { tooManyAttempts } from './rate-limit'

const COOKIE = 'nx_google_oauth'
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const secret = () => new TextEncoder().encode(env.jwtSecret)
const callbackUrl = () => `${env.appUrl}/api/auth/google/callback`
const loginError = (error: string) => new Response(null, { status: 303, headers: { Location: `/login?error=${error}`, 'Cache-Control': 'no-store' } })
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function beginGoogle() {
  if (!env.googleClientId || !env.googleClientSecret) return new Response('Google login is not configured', { status: 503 })
  if (await tooManyAttempts(`google:${getRequestIP() ?? 'unknown'}`, 15)) return loginError('too_many')
  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const user = await getSessionUser()
  const cookie = await new SignJWT({ state, nonce, verifier, linkUserId: user?.id ?? null }).setProtectedHeader({ alg: 'HS256' }).setIssuer('newarix-google').setIssuedAt().setExpirationTime('10m').sign(secret())
  setCookie(COOKIE, cookie, { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/api/auth/google', maxAge: 600 })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return new Response(null, { status: 302, headers: { Location: url.href, 'Cache-Control': 'no-store' } })
}

export async function finishGoogle(request: Request) {
  const cookie = getCookie(COOKIE)
  deleteCookie(COOKIE, { path: '/api/auth/google' })
  if (!env.googleClientId || !env.googleClientSecret || !cookie) return loginError('google_failed')
  const query = new URL(request.url).searchParams
  try {
    const { payload: flow } = await jwtVerify(cookie, secret(), { algorithms: ['HS256'], issuer: 'newarix-google' })
    const state = query.get('state') ?? ''
    if (typeof flow.state !== 'string' || !safeEqual(state, flow.state) || typeof flow.verifier !== 'string' || typeof flow.nonce !== 'string') return loginError('google_failed')
    if (query.get('error')) return loginError('google_cancelled')
    const code = query.get('code')
    if (!code || code.length > 4096) return loginError('google_failed')
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: env.googleClientId, client_secret: env.googleClientSecret, redirect_uri: callbackUrl(), grant_type: 'authorization_code', code_verifier: flow.verifier }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return loginError('google_failed')
    const tokens = await response.json() as { id_token?: string }
    if (!tokens.id_token) return loginError('google_failed')
    const { payload } = await jwtVerify(tokens.id_token, GOOGLE_KEYS, { algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.googleClientId })
    if (payload.nonce !== flow.nonce || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) return loginError('google_failed')
    const email = payload.email.toLowerCase().trim()
    if (email.length > 254) return loginError('google_failed')
    const loggedIn = await getSessionUser()
    let user = await db.query.users.findFirst({ where: eq(schema.users.googleId, payload.sub) })
    if (flow.linkUserId) {
      // Linking is allowed only while the same local account remains signed in.
      if (!loggedIn || loggedIn.id !== flow.linkUserId || loggedIn.email !== email || (user && user.id !== loggedIn.id)) return loginError('google_link_failed')
      const [linked] = await db.update(schema.users).set({ googleId: payload.sub, emailVerifiedAt: new Date() }).where(eq(schema.users.id, loggedIn.id)).returning()
      user = linked
    } else if (!user) {
      const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) })
      // Avoid silently linking a password account just because emails match.
      if (existing) return loginError('google_existing')
      const name = (typeof payload.name === 'string' ? payload.name : email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12) || 'viewer'
      const created = (await db.insert(schema.users).values({ email, username: `${name}_${randomBytes(3).toString('hex')}`, googleId: payload.sub, emailVerifiedAt: new Date() }).onConflictDoNothing().returning()).at(0)
      user = created ?? await db.query.users.findFirst({ where: eq(schema.users.googleId, payload.sub) })
    }
    if (!user) return loginError('google_failed')
    await startSession(user.id)
    return new Response(null, { status: 303, headers: { Location: flow.linkUserId ? '/profile' : '/', 'Cache-Control': 'no-store' } })
  } catch { return loginError('google_failed') }
}
