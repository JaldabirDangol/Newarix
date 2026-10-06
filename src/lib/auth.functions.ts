import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, eq, gt, or, sql } from 'drizzle-orm'
import { getCookie, getRequestIP } from '@tanstack/react-start/server'
import { db, schema } from '#/server/db'
import {
  hashPassword,
  verifyLoginPassword,
  needsPasswordRehash,
} from '#/server/auth/password'
import {
  endSession,
  getSessionUser,
  startSession,
  toSessionUser,
} from '#/server/auth/session'
import { authMiddleware } from '#/server/auth/middleware'
import { tooManyAttempts } from '#/server/auth/rate-limit'
import {
  emailConfigured,
  sendAccountEmail,
  tokenHash,
} from '#/server/auth/email'
import { env } from '#/server/env'
import { avatarImage } from '#/server/images'
import { securityEvent } from '#/server/security-events'
import { randomUUID } from 'node:crypto'
import type { SessionUser } from '#/server/auth/session'

export type Theme = 'dark' | 'light'
export type { SessionUser }

export type FormResult =
  { ok: true } | { ok: false; error: string; field?: string }

const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be 20 characters or fewer')
  .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores only')

const signupInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(254),
  username,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
})

const loginInput = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter your email').max(254),
  password: z.string().min(1, 'Enter your password').max(200),
})

function firstIssue(error: z.ZodError): FormResult {
  const issue = error.issues[0]
  return { ok: false, error: issue.message, field: String(issue.path[0]) }
}

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser()
    const theme: Theme = getCookie('nx_theme') === 'light' ? 'light' : 'dark'
    return { user, theme }
  },
)

export const signup = createServerFn({ method: 'POST' })
  .validator((data: unknown) => data as z.input<typeof signupInput>)
  .handler(async ({ data }): Promise<FormResult> => {
    if (await tooManyAttempts(`signup:${getRequestIP() ?? 'unknown'}`, 5)) {
      return {
        ok: false,
        error: 'Too many sign-up attempts. Try again in 15 minutes.',
      }
    }
    const parsed = signupInput.safeParse(data)
    if (!parsed.success) return firstIssue(parsed.error)
    const { email, password } = parsed.data

    const existing = await db.query.users.findFirst({
      where: or(
        eq(schema.users.email, email),
        eq(schema.users.username, parsed.data.username),
      ),
    })
    if (existing) {
      return {
        ok: false,
        error:
          'Could not create an account with those details. Try signing in or recovering your account.',
      }
    }

    const created = await db
      .insert(schema.users)
      .values({
        email,
        username: parsed.data.username,
        passwordHash: await hashPassword(password),
      })
      .onConflictDoNothing()
      .returning({ id: schema.users.id })
    const user = created.at(0)
    if (!user)
      return {
        ok: false,
        error:
          'Could not create an account with those details. Try signing in or recovering your account.',
      }
    await startSession(user.id)
    securityEvent('account_created')
    if (emailConfigured()) {
      await sendAccountEmail({ id: user.id, email }, 'verify').catch(() => {
        console.error('Could not deliver signup verification email')
      })
    }
    return { ok: true }
  })

export const login = createServerFn({ method: 'POST' })
  .validator((data: unknown) => data as z.input<typeof loginInput>)
  .handler(async ({ data }): Promise<FormResult> => {
    const parsed = loginInput.safeParse(data)
    if (!parsed.success) return firstIssue(parsed.error)
    const { email, password } = parsed.data

    if (
      (await tooManyAttempts(`login-ip:${getRequestIP() ?? 'unknown'}`, 30)) ||
      (await tooManyAttempts(`login:${getRequestIP() ?? 'unknown'}:${email}`))
    ) {
      return {
        ok: false,
        error: 'Too many login attempts. Try again in 15 minutes.',
      }
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    })
    // Same message for unknown email and wrong password, so the form
    // doesn't reveal which emails have accounts.
    const valid = await verifyLoginPassword(password, user?.passwordHash)
    if (!valid || !user?.passwordHash) {
      securityEvent('login_failed')
      return { ok: false, error: 'Email or password is incorrect' }
    }
    if (needsPasswordRehash(user.passwordHash)) {
      const upgraded = await hashPassword(password)
      // Do not overwrite a concurrently changed password.
      await db
        .update(schema.users)
        .set({ passwordHash: upgraded })
        .where(
          and(
            eq(schema.users.id, user.id),
            eq(schema.users.passwordHash, user.passwordHash),
          ),
        )
    }
    await startSession(user.id, user.tokenVersion)
    return { ok: true }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  endSession()
  return { ok: true }
})

const profileInput = z.object({
  username,
  avatarUrl: z
    .string()
    .trim()
    .url('Avatar must be a full image URL')
    .refine((value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password
      } catch {
        return false
      }
    }, 'Avatar must use HTTPS without credentials')
    .max(500)
    .or(z.literal(''))
    .or(z.string().regex(/^\/api\/avatar\/[a-f0-9-]{36}\?v=[a-f0-9-]{36}$/)),
  bio: z.string().trim().max(300, 'Bio must be 300 characters or fewer'),
})

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => data as z.input<typeof profileInput> | FormData)
  .handler(
    async ({ data, context }): Promise<FormResult & { user?: SessionUser }> => {
      if (await tooManyAttempts(`profile:${context.user.id}`, 10))
        return {
          ok: false,
          error: 'Too many profile updates. Try again in 15 minutes.',
        }
      const form = data instanceof FormData ? data : null
      const parsed = profileInput.safeParse(
        form ? Object.fromEntries(form) : data,
      )
      if (!parsed.success) return firstIssue(parsed.error)
      const taken = await db.query.users.findFirst({
        where: eq(schema.users.username, parsed.data.username),
      })
      if (taken && taken.id !== context.user.id) {
        return { ok: false, error: 'That username is taken', field: 'username' }
      }
      let avatar: { avatarData?: string | null; avatarUrl: string | null } = {
        avatarUrl: parsed.data.avatarUrl || null,
      }
      const file = form?.get('avatar')
      if (file instanceof File && file.size > 0) {
        try {
          avatar = {
            avatarData: await avatarImage(file),
            avatarUrl: `/api/avatar/${context.user.id}?v=${randomUUID()}`,
          }
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : 'Could not process that image.',
            field: 'avatar',
          }
        }
      } else if (parsed.data.avatarUrl !== context.user.avatarUrl) {
        avatar.avatarData = null
      }
      const [row] = await db
        .update(schema.users)
        .set({
          username: parsed.data.username,
          ...avatar,
          bio: parsed.data.bio || null,
        })
        .where(eq(schema.users.id, context.user.id))
        .returning()
      return { ok: true, user: toSessionUser(row) }
    },
  )

export const getAuthOptions = createServerFn({ method: 'GET' }).handler(() => ({
  google: Boolean(env.googleClientId && env.googleClientSecret),
  email: emailConfigured(),
}))

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator(
    z.object({ email: z.string().trim().toLowerCase().email().max(254) }),
  )
  .handler(async ({ data }): Promise<FormResult> => {
    if (
      (await tooManyAttempts(`reset-ip:${getRequestIP() ?? 'unknown'}`, 5)) ||
      (await tooManyAttempts(`reset-email:${data.email}`, 3))
    ) {
      return { ok: false, error: 'Too many requests. Try again in 15 minutes.' }
    }
    if (!emailConfigured())
      return {
        ok: false,
        error:
          'Password recovery is temporarily unavailable. Please try later.',
      }
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, data.email),
    })
    if (user) {
      try {
        await sendAccountEmail(user, 'reset')
      } catch {
        console.error('Password recovery email delivery failed')
      }
    }
    securityEvent('password_reset_requested')
    // Identical result even when no account exists or delivery fails.
    return { ok: true }
  })

const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })

export const resetPassword = createServerFn({ method: 'POST' })
  .validator(tokenInput.extend({ password: z.string().min(8).max(200) }))
  .handler(async ({ data }): Promise<FormResult> => {
    if (
      await tooManyAttempts(`reset-consume:${getRequestIP() ?? 'unknown'}`, 10)
    )
      return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' }
    const passwordHash = await hashPassword(data.password)
    const done = await db.transaction(async (tx) => {
      const tokens = await tx
        .delete(schema.authTokens)
        .where(
          and(
            eq(schema.authTokens.hash, tokenHash(data.token)),
            eq(schema.authTokens.purpose, 'reset'),
            gt(schema.authTokens.expiresAt, new Date()),
          ),
        )
        .returning()
      const token = tokens.at(0)
      if (!token) return false
      await tx
        .update(schema.users)
        .set({
          passwordHash,
          tokenVersion: sql`${schema.users.tokenVersion} + 1`,
        })
        .where(eq(schema.users.id, token.userId))
      await tx
        .delete(schema.authTokens)
        .where(
          and(
            eq(schema.authTokens.userId, token.userId),
            eq(schema.authTokens.purpose, 'reset'),
          ),
        )
      return true
    })
    if (!done)
      return {
        ok: false,
        error:
          'This reset link has expired or was already used. Request a new link.',
      }
    endSession()
    securityEvent('password_changed')
    return { ok: true }
  })

export const requestVerification = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FormResult> => {
    if (context.user.emailVerified) return { ok: true }
    if (await tooManyAttempts(`verify:${context.user.id}`, 3))
      return { ok: false, error: 'Too many requests. Try again in 15 minutes.' }
    try {
      await sendAccountEmail(context.user, 'verify')
      return { ok: true }
    } catch {
      return {
        ok: false,
        error: 'Could not send verification email. Please try later.',
      }
    }
  })

export const verifyEmail = createServerFn({ method: 'POST' })
  .validator(tokenInput)
  .handler(async ({ data }): Promise<FormResult> => {
    if (
      await tooManyAttempts(`verify-consume:${getRequestIP() ?? 'unknown'}`, 10)
    )
      return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' }
    const done = await db.transaction(async (tx) => {
      const tokens = await tx
        .delete(schema.authTokens)
        .where(
          and(
            eq(schema.authTokens.hash, tokenHash(data.token)),
            eq(schema.authTokens.purpose, 'verify'),
            gt(schema.authTokens.expiresAt, new Date()),
          ),
        )
        .returning()
      const token = tokens.at(0)
      if (!token) return false
      await tx
        .update(schema.users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(schema.users.id, token.userId))
      await tx
        .delete(schema.authTokens)
        .where(
          and(
            eq(schema.authTokens.userId, token.userId),
            eq(schema.authTokens.purpose, 'verify'),
          ),
        )
      return true
    })
    return done
      ? { ok: true }
      : {
          ok: false,
          error:
            'This verification link has expired or was already used. Request another from your profile.',
        }
  })
