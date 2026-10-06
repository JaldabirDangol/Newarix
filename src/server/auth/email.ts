import { randomBytes, createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db'
import { env } from '../env'

export const emailConfigured = () => Boolean(env.emailApiKey && env.emailFrom)
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

export async function sendAccountEmail(user: { id: string; email: string }, purpose: 'reset' | 'verify') {
  if (!emailConfigured()) throw new Error('Email delivery is not configured')
  const token = randomBytes(32).toString('base64url')
  const hash = tokenHash(token)
  const link = new URL(purpose === 'reset' ? '/reset-password' : '/verify-email', env.appUrl)
  link.searchParams.set('token', token)
  const minutes = purpose === 'reset' ? 60 : 24 * 60
  await db.transaction(async (tx) => {
    await tx.delete(schema.authTokens).where(and(eq(schema.authTokens.userId, user.id), eq(schema.authTokens.purpose, purpose)))
    await tx.insert(schema.authTokens).values({ hash, userId: user.id, purpose, expiresAt: new Date(Date.now() + minutes * 60_000) })
  })
  try {
    const response = await fetch(env.emailApiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.emailApiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `account-${hash}` },
      body: JSON.stringify({ from: env.emailFrom, to: [user.email], subject: purpose === 'reset' ? 'Reset your Newarix password' : 'Verify your Newarix email', text: `${purpose === 'reset' ? 'Reset your password' : 'Verify your email'}: ${link.href}\n\nThis link expires in ${purpose === 'reset' ? 'one hour' : '24 hours'}. If you did not request this, ignore this email.` }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error('Email provider rejected delivery')
  } catch (error) {
    await db.delete(schema.authTokens).where(eq(schema.authTokens.hash, hash))
    throw error
  }
}
