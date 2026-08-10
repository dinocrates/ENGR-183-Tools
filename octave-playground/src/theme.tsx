import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light' | 'high-contrast'

const STORAGE_KEY = 'engr183-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (next: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// index.html's inline script already set document.documentElement's
// data-theme attribute (or left it unset for the dark default) before this
// module ever runs, specifically to avoid a flash of the wrong theme.
// Reading it back here -- rather than re-reading localStorage -- keeps
// that FOUC-prevention logic in exactly one place.
function initialTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  return attr === 'light' || attr === 'high-contrast' ? attr : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    if (next === 'dark') {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = next
    }
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
