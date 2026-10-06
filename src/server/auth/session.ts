import { SignJWT, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { db, schema } from '../db'
import { env } from '../env'

export const SESSION_COOKIE = 'nx_session'
const SESSION_DAYS = 30
const ISSUER = 'newarix'

export type SessionUser = {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string | null
  createdAt: string
  emailVerified: boolean
  googleConnected: boolean
}

function secretKey() {
  return new TextEncoder().encode(env.jwtSecret)
}

export async function signSession(userId: string, tokenVersion: number): Promise<string> {
  return new SignJWT({ version: tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey())
}

export async function startSession(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  if (!user) throw new Error('Account does not exist')
  const token = await signSession(userId, user.tokenVersion)
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function endSession() {
  deleteCookie(SESSION_COOKIE, { path: '/' })
}

async function userIdFromCookie(): Promise<{ id: string; version: number } | null> {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      algorithms: ['HS256'],
    })
    return payload.sub && typeof payload.version === 'number' ? { id: payload.sub, version: payload.version } : null
  } catch {
    return null
  }
}

export function toSessionUser(row: typeof schema.users.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    createdAt: row.createdAt.toISOString(),
    emailVerified: Boolean(row.emailVerifiedAt),
    googleConnected: Boolean(row.googleId),
  } satisfies SessionUser
}

// Verifies the JWT, then loads the user so deleted accounts lose access
// immediately rather than when the token expires.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await userIdFromCookie()
  if (!session) return null
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, session.id),
  })
  if (!row || row.tokenVersion !== session.version) {
    endSession()
    return null
  }
  return toSessionUser(row)
}
