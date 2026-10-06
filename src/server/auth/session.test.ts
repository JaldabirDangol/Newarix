import { setCookie } from '@tanstack/react-start/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'
import { env } from '../env'
import { getSessionUser, signSession, startSession } from './session'

const state = vi.hoisted(() => ({
  cookie: '',
  row: null as Record<string, unknown> | null,
  cleared: false,
}))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: () => state.cookie,
  deleteCookie: () => {
    state.cleared = true
  },
  setCookie: vi.fn(),
}))
vi.mock('../db', () => ({
  db: { query: { users: { findFirst: () => state.row } } },
  schema: { users: { id: 'id' } },
}))
beforeEach(() => {
  state.cookie = ''
  state.row = null
  state.cleared = false
})
it('rejects deleted users and sessions revoked through tokenVersion', async () => {
  state.cookie = await signSession('test-user', 0)
  expect(await getSessionUser()).toBeNull()
  expect(state.cleared).toBe(true)
  state.row = { tokenVersion: 1 }
  expect(await getSessionUser()).toBeNull()
})
it('accepts only current user claims and excludes sensitive database fields', async () => {
  state.cookie = await signSession('test-user', 2)
  state.row = {
    id: 'test-user',
    tokenVersion: 2,
    username: 'viewer',
    email: 'test@example.com',
    avatarUrl: null,
    bio: null,
    createdAt: new Date(),
    emailVerifiedAt: null,
    googleId: null,
    passwordHash: 'must-not-escape',
    avatarData: 'must-not-escape',
  }
  const user = await getSessionUser()
  expect(user?.id).toBe('test-user')
  expect(user).not.toHaveProperty('passwordHash')
  expect(user).not.toHaveProperty('avatarData')
})
it('rejects expired, wrong issuer and wrong algorithm tokens', async () => {
  const key = new TextEncoder().encode(env.jwtSecret)
  for (const [issuer, algorithm, expiry] of [
    ['other', 'HS256', '1h'],
    ['newarix', 'HS384', '1h'],
    ['newarix', 'HS256', '0s'],
  ]) {
    state.cookie = await new SignJWT({ version: 0 })
      .setProtectedHeader({ alg: algorithm })
      .setSubject('test-user')
      .setIssuer(issuer)
      .setExpirationTime(expiry)
      .sign(key)
    expect(await getSessionUser()).toBeNull()
  }
})

it('rejects stale credential versions at session issuance and sets protected cookies', async () => {
  state.row = { tokenVersion: 1 }
  await expect(startSession('test-user', 0)).rejects.toThrow(
    'credentials changed',
  )
  await startSession('test-user', 1)
  expect(setCookie).toHaveBeenCalledWith(
    'nx_session',
    expect.any(String),
    expect.objectContaining({
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      path: '/',
    }),
  )
})
