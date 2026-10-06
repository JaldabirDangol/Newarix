import { createMiddleware } from '@tanstack/react-start'
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
    return next({ context: { user } })
  },
)
