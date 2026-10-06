import { useState } from 'react'
import { requestVerification } from '#/lib/auth.functions'
import { btn } from './ui'
import type { SessionUser } from '#/lib/auth.functions'

export function VerificationNotice({ user, emailAvailable }: { user: SessionUser; emailAvailable: boolean }) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  if (user.emailVerified) return <p className="mt-6 text-sm text-muted">Email verified · {user.email}</p>
  return <section aria-label="Email verification" className="mt-6 rounded-lg border border-line bg-surface p-4">
    <h2 className="text-sm font-bold">Verify your email</h2>
    <p className="mt-1 text-sm text-muted">Confirm {user.email} to verify your account.</p>
    {emailAvailable ? <button type="button" className={`${btn.ghost} mt-3`} disabled={pending} onClick={async () => {
      setPending(true)
      try { const result = await requestVerification(); setError(!result.ok); setMessage(result.ok ? 'Verification link sent. Check your inbox and spam folder.' : result.error) }
      catch { setError(true); setMessage('Could not send verification email. Try again.') }
      finally { setPending(false) }
    }}>{pending ? 'Sending…' : 'Send verification link'}</button> : <p className="mt-2 text-sm text-muted">Verification email is temporarily unavailable.</p>}
    {message && <p role={error ? 'alert' : 'status'} className={`mt-2 text-sm ${error ? 'text-danger' : 'text-muted'}`}>{message}</p>}
  </section>
}
