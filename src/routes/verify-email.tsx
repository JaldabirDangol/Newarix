import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountRecovery } from '#/components/AccountRecovery'

export const Route = createFileRoute('/verify-email')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Verify email · Newarix' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: VerifyPage,
})
function VerifyPage() { return <AccountRecovery mode="verify" token={Route.useSearch().token} /> }
