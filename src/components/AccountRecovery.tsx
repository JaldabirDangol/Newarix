import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { requestPasswordReset, resetPassword, verifyEmail } from '#/lib/auth.functions'
import { resetSession } from '#/lib/session'
import { btn, field } from './ui'

export function AccountRecovery({ mode, token }: { mode: 'forgot' | 'reset' | 'verify'; token?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const title = mode === 'forgot' ? 'Forgot your password?' : mode === 'reset' ? 'Choose a new password' : 'Verify your email'
  const validToken = mode === 'forgot' || Boolean(token && /^[A-Za-z0-9_-]{43}$/.test(token))
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const password = String(values.get('password') ?? '')
    if (mode === 'reset' && password !== values.get('confirm')) return setError('The passwords do not match.')
    setPending(true)
    setError('')
    try {
      const result = mode === 'forgot' ? await requestPasswordReset({ data: { email: String(values.get('email')) } }) : mode === 'reset' ? await resetPassword({ data: { token: token!, password } }) : await verifyEmail({ data: { token: token! } })
      if (!result.ok) return setError(result.error)
      setDone(true)
      resetSession()
      await router.invalidate()
    } catch { setError('Could not complete this request. Please try again.') }
    finally { setPending(false) }
  }
  return <div className="mx-auto max-w-sm px-4 py-14">
    <h1 className="font-display text-3xl">{title}</h1>
    {done ? <p role="status" className="mt-6 text-sm leading-relaxed">{mode === 'forgot' ? 'If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.' : mode === 'reset' ? 'Your password has been reset and all previous sessions have ended. Log in with your new password.' : 'Your email is verified.'}</p> : !validToken ? <p role="alert" className="mt-6 text-sm text-danger">This link is missing a valid token. Request a new link.</p> : <form onSubmit={submit} className="mt-6 grid gap-4" aria-busy={pending}>
      {mode === 'forgot' ? <label className="text-sm font-semibold">Email<input name="email" type="email" autoComplete="email" required className={`${field} mt-1.5`} /></label> : mode === 'reset' ? <>
        <label className="text-sm font-semibold">New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required className={`${field} mt-1.5`} aria-describedby="password-hint" /></label><p id="password-hint" className="text-xs text-muted">At least 8 characters.</p>
        <label className="text-sm font-semibold">Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={200} required className={`${field} mt-1.5`} /></label>
      </> : <p className="text-sm text-muted">Confirm that this email address belongs to you.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" className={btn.primary} disabled={pending}>{pending ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Reset password' : 'Verify email'}</button>
    </form>}
    <div className="mt-6 flex flex-wrap gap-4 text-sm"><Link to="/login" className="text-accent-text hover:underline">Back to login</Link>{mode === 'reset' && <Link to="/forgot-password" className="text-accent-text hover:underline">Request another link</Link>}</div>
  </div>
}
