import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useRouter } from '@tanstack/react-router'
import {
  History,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Shuffle,
  Sun,
  User,
  X,
} from 'lucide-react'
import { logout } from '#/lib/auth.functions'
import { resetSession } from '#/lib/session'
import { useTheme } from '#/lib/theme'
import { QuickSearch } from './QuickSearch'
import { Img, btn } from './ui'
import type { SessionUser } from '#/lib/auth.functions'

const links = [
  { to: '/anime', label: 'Anime' },
  { to: '/manga', label: 'Manga' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/search', label: 'Search' },
] as const

export function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-md"
      aria-label="Newarix home"
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-accent font-display text-lg text-on-accent"
      >
        N
      </span>
      <span className="font-display text-lg tracking-wide">NEWARIX</span>
    </Link>
  )
}

function Avatar({
  user,
  className = 'size-8',
}: {
  user: SessionUser
  className?: string
}) {
  return user.avatarUrl ? (
    <Img src={user.avatarUrl} alt="" className={`${className} rounded-full`} />
  ) : (
    <span
      aria-hidden
      className={`${className} grid place-items-center rounded-full bg-raised font-display text-sm text-accent-text`}
    >
      {user.username.charAt(0).toUpperCase()}
    </span>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      className={btn.icon}
      aria-label={
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      }
    >
      {theme === 'dark' ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  )
}

function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === 'Escape'
          : !ref.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const signOut = async () => {
    await logout()
    resetSession()
    await router.invalidate()
    await router.navigate({ to: '/' })
  }

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-raised'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 ring-1 ring-line transition hover:ring-muted"
      >
        <Avatar user={user} />
        <span className="sr-only">Account menu for {user.username}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-card"
        >
          <p className="truncate px-3 py-2 text-xs text-muted">
            Signed in as{' '}
            <span className="font-semibold text-text">{user.username}</span>
          </p>
          <Link role="menuitem" to="/profile" className={item}>
            <User className="size-4" aria-hidden /> Profile
          </Link>
          <Link
            role="menuitem"
            to="/list"
            search={{ kind: 'anime' }}
            className={item}
          >
            <ListChecks className="size-4" aria-hidden /> My list
          </Link>
          <Link role="menuitem" to="/history" className={item}>
            <History className="size-4" aria-hidden /> History
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className={`${item} text-danger`}
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

export function Navbar({ user }: { user: SessionUser | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location.pathname])

  const navLink =
    'rounded-md px-3 py-2 text-sm font-semibold text-muted transition hover:text-text data-[status=active]:text-text data-[status=active]:shadow-[inset_0_-2px_0_var(--accent)]'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav
          aria-label="Main"
          className="ml-2 hidden items-center gap-1 md:flex"
        >
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={navLink}>
              {l.label}
            </Link>
          ))}
          <Link
            to="/random"
            className={`${navLink} flex items-center gap-1.5`}
            title="Open a random anime"
          >
            <Shuffle className="size-3.5" aria-hidden /> Random
          </Link>
        </nav>
        <div className="ml-auto hidden w-full max-w-xs lg:block">
          <QuickSearch />
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/login"
                search={{ redirect: location.href }}
                className={`${btn.ghost} py-2`}
              >
                Log in
              </Link>
              <Link to="/signup" className={`${btn.primary} py-2`}>
                Sign up
              </Link>
            </div>
          )}
          <button
            type="button"
            className={`${btn.icon} md:hidden`}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <X className="size-4" />
            ) : (
              <Menu className="size-4" />
            )}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="border-t border-line bg-bg px-4 pt-3 pb-5 md:hidden"
        >
          <QuickSearch onDone={() => setMobileOpen(false)} />
          <nav aria-label="Mobile" className="mt-3 grid grid-cols-2 gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className={`${navLink} bg-surface`}>
                {l.label}
              </Link>
            ))}
            <Link to="/random" className={`${navLink} bg-surface`}>
              Random anime
            </Link>
          </nav>
          {!user && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/login" className={btn.ghost}>
                Log in
              </Link>
              <Link to="/signup" className={btn.primary}>
                Sign up
              </Link>
            </div>
          )}
        </div>
      )}
      <div className="hidden border-t border-line px-4 py-2 sm:px-6 md:block lg:hidden">
        <QuickSearch />
      </div>
    </header>
  )
}
