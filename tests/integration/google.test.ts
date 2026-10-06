import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT, generateKeyPair } from 'jose'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '#/server/db'
import { env } from '#/server/env'
import { beginGoogle, finishGoogle } from '#/server/auth/google'
import type { SessionUser } from '#/server/auth/session'
import type * as Jose from 'jose'

const state = vi.hoisted(() => ({ cookie: '', user: null as SessionUser | null, publicKey: undefined as CryptoKey | undefined, sessions: [] as string[] }))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: () => state.cookie,
  setCookie: (_name: string, cookie: string) => { state.cookie = cookie },
  deleteCookie: () => { state.cookie = '' },
  getRequestIP: () => 'google-test',
}))
vi.mock('#/server/auth/session', () => ({
  getSessionUser: () => Promise.resolve(state.user),
  startSession: (id: string) => { state.sessions.push(id); return Promise.resolve() },
}))
vi.mock('#/server/auth/rate-limit', () => ({ tooManyAttempts: () => Promise.resolve(false) }))
vi.mock('jose', async (importOriginal) => {
  const original = await importOriginal<typeof Jose>()
  return { ...original, createRemoteJWKSet: () => () => state.publicKey }
})

const emails: string[] = []
let privateKey: CryptoKey
beforeAll(async () => {
  const keys = await generateKeyPair('RS256')
  privateKey = keys.privateKey
  state.publicKey = keys.publicKey
  env.googleClientId = 'google-test-client'
  env.googleClientSecret = 'google-test-secret'
})
beforeEach(() => { state.cookie = ''; state.user = null; state.sessions = []; vi.unstubAllGlobals() })
afterAll(async () => { vi.unstubAllGlobals(); if (emails.length) await db.delete(schema.users).where(inArray(schema.users.email, emails)) })

async function callback(email: string, sub: string, overrides: Record<string, unknown> = {}) {
  const start = await beginGoogle()
  const url = new URL(start.headers.get('location')!)
  const token = await new SignJWT({ email, email_verified: true, nonce: url.searchParams.get('nonce'), name: 'Google Viewer', ...overrides }).setProtectedHeader({ alg: 'RS256' }).setSubject(sub).setIssuer('https://accounts.google.com').setAudience(env.googleClientId!).setIssuedAt().setExpirationTime('5m').sign(privateKey)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id_token: token })))
  return finishGoogle(new Request(`http://localhost:3000/api/auth/google/callback?${new URLSearchParams({ state: url.searchParams.get('state')!, code: 'test-code' })}`))
}

describe('Google account identity', () => {
  it('creates a verified Google account and signs it in after JWT validation', async () => {
    const email = `google-new-${crypto.randomUUID()}@example.com`; emails.push(email)
    const response = await callback(email, crypto.randomUUID())
    expect(response.headers.get('location')).toBe('/')
    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) })
    expect(user?.emailVerifiedAt).toBeTruthy()
    expect(user?.passwordHash).toBeNull()
    expect(state.sessions).toEqual([user?.id])
  })

  it('does not silently link an existing password account', async () => {
    const email = `google-existing-${crypto.randomUUID()}@example.com`; emails.push(email)
    await db.insert(schema.users).values({ email, username: `g${crypto.randomUUID().slice(0, 16)}`, passwordHash: 'existing-password-hash' })
    const response = await callback(email, crypto.randomUUID())
    expect(response.headers.get('location')).toBe('/login?error=google_existing')
    expect(state.sessions).toEqual([])
    expect((await db.query.users.findFirst({ where: eq(schema.users.email, email) }))?.googleId).toBeNull()
  })

  it('links Google only from a matching signed-in local account', async () => {
    const email = `google-link-${crypto.randomUUID()}@example.com`; emails.push(email)
    const [user] = await db.insert(schema.users).values({ email, username: `g${crypto.randomUUID().slice(0, 16)}`, passwordHash: 'existing-password-hash' }).returning()
    state.user = { id: user.id, email, username: user.username, avatarUrl: null, bio: null, createdAt: user.createdAt.toISOString(), emailVerified: false, googleConnected: false }
    const sub = crypto.randomUUID()
    const response = await callback(email, sub)
    expect(response.headers.get('location')).toBe('/profile')
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, user.id) }))?.googleId).toBe(sub)
  })

  it.each([{ nonce: 'wrong-nonce' }, { email_verified: false }])('rejects invalid identity claims %j', async (claims) => {
    const email = `google-invalid-${crypto.randomUUID()}@example.com`; emails.push(email)
    const response = await callback(email, crypto.randomUUID(), claims)
    expect(response.headers.get('location')).toBe('/login?error=google_failed')
    expect(state.sessions).toEqual([])
    expect(await db.query.users.findFirst({ where: eq(schema.users.email, email) })).toBeUndefined()
  })
})
