import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountRecovery } from '#/components/AccountRecovery'

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Reset password · Newarix' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: ResetPage,
})
function ResetPage() { return <AccountRecovery mode="reset" token={Route.useSearch().token} /> }
