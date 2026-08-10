import { useTheme, type Theme } from '../theme'

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

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  'high-contrast': 'High Contrast',
}

// A native <select>, not a click-to-cycle button: cycling through 3 states
// hides the third option behind repeated clicks, which undercuts the point
// of an accessibility feature (high-contrast mode) needing to be genuinely
// discoverable. <select> is keyboard-navigable and screen-reader labeled
// with zero custom ARIA plumbing needed.
export function ThemeToggle({ variant = 'fixed' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  return (
    <select
      className={`rounded border border-line bg-surface px-1.5 py-1 text-xs text-secondary hover:bg-raised ${
        variant === 'fixed' ? 'fixed top-3 right-3 z-40' : ''
      }`}
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="Theme"
      title="Theme"
    >
      {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
        <option key={t} value={t}>
          {THEME_LABELS[t]}
        </option>
      ))}
    </select>
  )
}
