import { createMiddleware } from '@tanstack/react-start'
import { tooManyAttempts } from './rate-limit'
import { getSessionUser } from './session'

export class UnauthorizedError extends Error {
  constructor() {
    super('You need to log in to do that.')
    this.name = 'UnauthorizedError'
  }
}

// Attach to any server function that touches a user's own data.
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const user = await getSessionUser()
    if (!user) throw new UnauthorizedError()
    if (await tooManyAttempts(`account:${user.id}`, 120, 60_000))
      throw new Error('Too many account requests. Try again shortly.')
    return next({ context: { user } })
  },
)
