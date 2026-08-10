import { useTheme } from '../theme'

interface ThemeToggleProps {
  // 'fixed' floats at the viewport corner -- used on UnitIndex, which has
  // no header/chrome of its own to host a control. 'inline' renders as an
  // ordinary flex child instead -- used inside Toolbar, where a fixed
  // corner position collided with the Toolbar's own status pill (also
  // pinned to the top-right via ml-auto): both are near the viewport edge,
  // but only one of them actually participates in the Toolbar's layout, so
  // they overlapped instead of sitting side by side.
  variant?: 'fixed' | 'inline'
}

export function ThemeToggle({ variant = 'fixed' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      className={`flex h-8 w-8 items-center justify-center rounded border border-line bg-surface text-sm text-secondary hover:bg-raised ${
        variant === 'fixed' ? 'fixed top-3 right-3 z-40' : ''
      }`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
