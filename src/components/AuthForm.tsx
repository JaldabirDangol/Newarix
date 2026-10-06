import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { resetSession } from '#/lib/session'
import { Logo } from './Navbar'
import { btn, field } from './ui'
import type { FormResult } from '#/lib/auth.functions'

type Field = {
  name: string
  label: string
  type: string
  autoComplete: string
  hint?: string
}

export function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  onSubmit,
  redirectTo,
  footer,
  google = false,
  initialError,
}: {
  title: string
  subtitle: string
  fields: Field[]
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<FormResult>
  redirectTo: string
  footer: React.ReactNode
  google?: boolean
  initialError?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{
    message: string
    field?: string
  } | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >
    setPending(true)
    setError(null)
    try {
      const result = await onSubmit(values)
      if (!result.ok) {
        setError({ message: result.error, field: result.field })
        return
      }
      resetSession()
      await router.invalidate()
      // Only follow same-site paths to avoid open redirects.
      const safe =
        redirectTo.startsWith('/') && !redirectTo.startsWith('//')
          ? redirectTo
          : '/'
      await router.history.push(safe)
    } catch {
      setError({
        message: 'Something went wrong. Check your connection and try again.',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-4 py-14 sm:py-20">
      <div className="mb-8">
        <Logo />
        <h1 className="mt-8 font-display text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
      {initialError && <p role="alert" className="mb-4 text-sm text-danger">{initialError}</p>}
      {google && <><a href="/api/auth/google" className={`${btn.ghost} mb-4`}>Continue with Google</a><p className="mb-4 text-center text-xs text-muted">or use your email</p></>}
      <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {fields.map((f) => {
          const invalid = error?.field === f.name
          return (
            <div key={f.name}>
              <label
                htmlFor={f.name}
                className="mb-1.5 block text-sm font-semibold"
              >
                {f.label}
              </label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                required
                aria-invalid={invalid}
                aria-describedby={
                  invalid ? 'form-error' : f.hint ? `${f.name}-hint` : undefined
                }
                className={`${field} ${invalid ? 'border-danger' : ''}`}
              />
              {f.hint && (
                <p id={`${f.name}-hint`} className="mt-1 text-xs text-muted">
                  {f.hint}
                </p>
              )}
            </div>
          )
        })}
        {error && (
          <p
            id="form-error"
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error.message}
          </p>
        )}
        <button
          type="submit"
          className={`${btn.primary} mt-2 cursor-pointer py-3 enabled:hover:brightness-110 disabled:cursor-not-allowed`}
          disabled={pending}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-muted">{footer}</div>
    </div>
  )
}
