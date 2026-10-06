import { createFileRoute } from '@tanstack/react-router'
import { AccountRecovery } from '#/components/AccountRecovery'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Forgot password · Newarix' }] }),
  component: () => <AccountRecovery mode="forgot" />,
})
