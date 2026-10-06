import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { LoadingBar } from '#/components/LoadingBar'
import { Navbar } from '#/components/Navbar'
import { RouteError, RouteNotFound } from '#/components/RouteStates'
import { Container } from '#/components/ui'
import { loadSession } from '#/lib/session'
import { ThemeProvider, useThemeState } from '#/lib/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  beforeLoad: async () => {
    const { user, theme } = await loadSession()
    return { user, theme }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Newarix · Track anime and manga' },
      {
        name: 'description',
        content:
          'Discover anime and manga, follow the weekly schedule, and track every episode and chapter.',
      },
      { name: 'theme-color', content: '#11121b' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Hanken+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap',
      },
      { rel: 'preconnect', href: 'https://cdn.myanimelist.net' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: RouteNotFound,
  errorComponent: RouteError,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = Route.useRouteContext()
  const themeState = useThemeState(theme)
  return (
    <html lang="en" data-theme={themeState.theme}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider value={themeState}>{children}</ThemeProvider>
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const { user } = Route.useRouteContext()
  return (
    <div className="flex min-h-dvh flex-col">
      <LoadingBar />
      <Navbar user={user} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-20 border-t border-line">
        <Container className="flex flex-col gap-2 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-display text-sm text-text">NEWARIX</span> ·
            Track what you watch and read.
          </p>
          <p>
            Data from{' '}
            <a
              className="underline hover:text-text"
              href="https://anilist.co"
              target="_blank"
              rel="noreferrer"
            >
              AniList
            </a>
            . Not affiliated with AniList or MyAnimeList.
          </p>
        </Container>
      </footer>
    </div>
  )
}
