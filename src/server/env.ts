import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.`)
  return value
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL')
  },
  get jwtSecret() {
    const secret = required('JWT_SECRET')
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production')
    }
    return secret
  },
  anilistUrl: process.env.ANILIST_URL ?? 'https://graphql.anilist.co',
  get appUrl() {
    const value =
      process.env.APP_URL ??
      (this.isProd ? required('APP_URL') : 'http://localhost:3000')
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (this.isProd && url.protocol !== 'https:' && url.hostname !== 'localhost')
    )
      throw new Error('APP_URL must be an HTTPS app origin')
    return url.origin
  },
  emailApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || null,
  emailApiUrl: process.env.EMAIL_API_URL ?? 'https://api.resend.com/emails',
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  /** True on Vercel and similar platforms that run many short-lived instances. */
  isServerless: Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  ),
  isProd: process.env.NODE_ENV === 'production',
}
