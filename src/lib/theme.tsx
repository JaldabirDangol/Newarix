import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Theme } from './auth.functions'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function useThemeState(initial: Theme) {
  const [theme, setTheme] = useState<Theme>(initial)
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      // A cookie (not localStorage) so the server renders the right theme.
      document.cookie = `nx_theme=${next}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }, [])
  return { theme, toggle }
}

export function ThemeProvider({
  value,
  children,
}: {
  value: { theme: Theme; toggle: () => void }
  children: ReactNode
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
