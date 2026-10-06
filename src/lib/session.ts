import { getSession } from './auth.functions'

type Session = Awaited<ReturnType<typeof getSession>>

// On the client, the session is fetched once and reused across navigations.
// Call resetSession() after logging in, logging out, or editing the profile.
let cached: Promise<Session> | null = null

export function loadSession(): Promise<Session> {
  if (typeof window === 'undefined') return getSession()
  cached ??= getSession().catch((err) => {
    cached = null
    throw err
  })
  return cached
}

export function resetSession() {
  cached = null
}
