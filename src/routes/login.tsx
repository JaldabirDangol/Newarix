import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { safeRedirectPath } from '#/lib/redirect'
import { z } from 'zod'
import { getAuthOptions, login } from '#/lib/auth.functions'
import { AuthForm } from '#/components/AuthForm'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.user)
      throw redirect({
        href: safeRedirectPath(search.redirect),
      })
  },
  head: () => ({ meta: [{ title: 'Log in · Newarix' }] }),
  loader: () => getAuthOptions(),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const options = Route.useLoaderData()
  const oauthErrors: Record<string, string> = {
    google_failed: 'Google login could not be completed. Please try again.',
    google_cancelled: 'Google login was cancelled.',
    google_existing:
      'This email already has an account. Log in with your password, then connect Google from your profile.',
    google_link_failed:
      'Sign in to the matching account before connecting Google.',
    too_many: 'Too many login attempts. Try again in 15 minutes.',
  }
  return (
    <AuthForm
      title="Welcome back"
      google={options.google}
      initialError={search.error ? oauthErrors[search.error] : undefined}
      subtitle="Log in to pick up where you left off."
      submitLabel="Log in"
      redirectTo={search.redirect ?? '/'}
      fields={[
        { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          autoComplete: 'current-password',
        },
      ]}
      onSubmit={(values) =>
        login({ data: { email: values.email, password: values.password } })
      }
      footer={
        <>
          New here?{' '}
          <Link
            to="/signup"
            search={{ redirect: search.redirect }}
            className="font-semibold text-accent-text hover:underline"
          >
            Create an account
          </Link>
          <p className="mt-3">
            <Link
              to="/forgot-password"
              className="text-accent-text hover:underline"
            >
              Forgot your password?
            </Link>
          </p>
        </>
      }
    />
  )
}
