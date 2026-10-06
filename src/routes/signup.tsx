import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getAuthOptions, signup } from '#/lib/auth.functions'
import { AuthForm } from '#/components/AuthForm'

export const Route = createFileRoute('/signup')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Sign up · Newarix' }] }),
  loader: () => getAuthOptions(),
  component: SignupPage,
})

function SignupPage() {
  const search = Route.useSearch()
  return (
    <AuthForm
      title="Create your account"
      google={Route.useLoaderData().google}
      subtitle="Track every episode and chapter, and keep a history of what you've watched."
      submitLabel="Create account"
      redirectTo={search.redirect ?? '/'}
      fields={[
        { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
        {
          name: 'username',
          label: 'Username',
          type: 'text',
          autoComplete: 'username',
          hint: '3–20 letters, numbers or underscores.',
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          autoComplete: 'new-password',
          hint: 'At least 8 characters.',
        },
      ]}
      onSubmit={(values) =>
        signup({
          data: {
            email: values.email,
            username: values.username,
            password: values.password,
          },
        })
      }
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            search={{ redirect: search.redirect }}
            className="font-semibold text-accent-text hover:underline"
          >
            Log in
          </Link>
        </>
      }
    />
  )
}
