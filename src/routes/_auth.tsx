import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

// Pathless layout: every route under _auth/ requires a logged-in user.
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { user: context.user }
  },
  component: Outlet,
})
