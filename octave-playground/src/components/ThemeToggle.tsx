import { useTheme } from '../theme'

// Fixed at the app level (not inside Toolbar) because UnitIndex has no
// header/chrome of its own to host a control -- this needs to be reachable
// from both the unit index and an open unit. z-40: above ordinary content
// and FloatingFigure windows (z-index 1+, incrementing on focus), below
// StartupOverlay (z-50) and PersistenceWarning (z-[60]) so it never
// competes with a modal for clicks.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      className="fixed top-3 right-3 z-40 flex h-8 w-8 items-center justify-center rounded border border-line bg-surface text-sm text-secondary hover:bg-raised"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
