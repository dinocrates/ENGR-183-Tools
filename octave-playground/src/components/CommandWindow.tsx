import { useState } from 'react'
import { PanelHeader } from './PanelHeader'
import { FontSizeControls } from './FontSizeControls'

interface CommandWindowProps {
  output: string
  collapsed: boolean
  onToggleCollapse: () => void
}

const FONT_SIZE_KEY = 'engr183-console-font-size'
const DEFAULT_FONT_SIZE = 12

export function CommandWindow({ output, collapsed, onToggleCollapse }: CommandWindowProps) {
  const [fontSize, setFontSize] = useState(() => {
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY))
    return stored > 0 ? stored : DEFAULT_FONT_SIZE
  })

  function updateFontSize(next: number) {
    setFontSize(next)
    localStorage.setItem(FONT_SIZE_KEY, String(next))
  }

  return (
    <div className="flex h-full flex-col bg-app">
      <PanelHeader
        title="Command Window"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        extra={<FontSizeControls size={fontSize} onChange={updateFontSize} />}
      />
      <pre
        className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-primary"
        style={{ fontSize }}
      >
        {output || ' '}
      </pre>
    </div>
  )
}
