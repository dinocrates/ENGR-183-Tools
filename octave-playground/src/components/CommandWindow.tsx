import { useEffect, useRef, useState } from 'react'
import { PanelHeader } from './PanelHeader'
import { FontSizeControls } from './FontSizeControls'

interface CommandWindowProps {
  output: string
  collapsed: boolean
  onToggleCollapse: () => void
  onSubmit: (command: string) => void
  disabled: boolean
  onClear: () => void
}

const FONT_SIZE_KEY = 'engr183-console-font-size'
const DEFAULT_FONT_SIZE = 12

export function CommandWindow({
  output,
  collapsed,
  onToggleCollapse,
  onSubmit,
  disabled,
  onClear,
}: CommandWindowProps) {
  const [fontSize, setFontSize] = useState(() => {
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY))
    return stored > 0 ? stored : DEFAULT_FONT_SIZE
  })
  const [inputValue, setInputValue] = useState('')
  // Typed commands, oldest first. historyIndex is null while composing a
  // new (not-yet-submitted) command; Up/Down walk backward/forward through
  // history the same way a real terminal does.
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output])

  function updateFontSize(next: number) {
    setFontSize(next)
    localStorage.setItem(FONT_SIZE_KEY, String(next))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const command = inputValue
      if (command.trim() === '') return
      onSubmit(command)
      setHistory((prev) => [...prev, command])
      setHistoryIndex(null)
      setInputValue('')
    } else if (e.key === 'ArrowUp') {
      if (history.length === 0) return
      e.preventDefault()
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setInputValue(history[next])
    } else if (e.key === 'ArrowDown') {
      if (historyIndex === null) return
      e.preventDefault()
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(null)
        setInputValue('')
      } else {
        setHistoryIndex(next)
        setInputValue(history[next])
      }
    }
  }

  return (
    <div className="flex h-full flex-col bg-app">
      <PanelHeader
        title="Command Window"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        extra={
          <>
            <button
              className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-raised hover:text-secondary"
              onClick={onClear}
              title="Clear the console (same as typing clc)"
            >
              Clear
            </button>
            <FontSizeControls size={fontSize} onChange={updateFontSize} />
          </>
        }
      />
      <pre
        ref={outputRef}
        className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-primary"
        style={{ fontSize }}
      >
        {output || ' '}
      </pre>
      <div className="flex flex-shrink-0 items-center gap-1.5 border-t border-line px-3 py-1.5">
        <span className="font-mono text-muted" style={{ fontSize }}>
          {'>>'}
        </span>
        <input
          className="w-full rounded border border-line bg-app px-2 py-1 font-mono text-primary outline-none focus:border-accent-hover disabled:opacity-40"
          style={{ fontSize }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Kernel busy…' : 'Type an Octave command…'}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
