import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'
import { RouteError, RouteNotFound } from './components/RouteStates'

/** The per-request CSP nonce: from middleware on the server, from the page on the client. */
function cspNonce(): string | undefined {
  if (typeof document !== 'undefined') {
    return (
      document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')
        ?.content || undefined
    )
  }
  // Set by the headers middleware in src/start.ts.
  const context = getGlobalStartContext() as
    { nonce?: string | null } | undefined
  return context?.nonce ?? undefined
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Show skeletons only when a load takes long enough to notice.
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    ssr: { nonce: cspNonce() },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
