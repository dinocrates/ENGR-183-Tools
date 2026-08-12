import { useEffect, useRef, useState } from 'react'
import { PanelHeader } from './PanelHeader'
import { FontSizeControls } from './FontSizeControls'
import { isBlockComplete, formatReplEcho } from '../kernel/replBlocks'

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
  // Lines already entered for a multi-line block that isn't complete yet
  // (e.g. typed `for i = 1:3`, still waiting for the matching `end`).
  // Transient/local only -- never written into Playground's persistent
  // `output`, so Escape can drop it cleanly with nothing to undo.
  const [bufferLines, setBufferLines] = useState<string[]>([])
  // Submitted commands, oldest first -- a multi-line block is stored as one
  // entry (joined with \n), not one entry per line.
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

  // Recall always replaces whatever's currently being composed, live
  // continuation or not -- simpler than a separate "disable history mid-
  // continuation" rule, and close enough to ordinary shell history
  // behavior (recall replaces the current line). A multi-line entry splits
  // back into lines: all but the last go into the pending preview, the
  // last lands in the input ready to edit or re-submit with Enter.
  function recallHistoryEntry(index: number) {
    setHistoryIndex(index)
    const lines = history[index].split('\n')
    setBufferLines(lines.slice(0, -1))
    setInputValue(lines[lines.length - 1])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const line = inputValue
      if (line.trim() === '' && bufferLines.length === 0) return
      const candidateLines = [...bufferLines, line]
      const candidate = candidateLines.join('\n')
      if (isBlockComplete(candidate)) {
        onSubmit(candidate)
        setHistory((prev) => [...prev, candidate])
        setHistoryIndex(null)
        setBufferLines([])
        setInputValue('')
      } else {
        setBufferLines(candidateLines)
        setInputValue('')
      }
    } else if (e.key === 'Escape') {
      if (bufferLines.length > 0) {
        e.preventDefault()
        setBufferLines([])
        setInputValue('')
      }
    } else if (e.key === 'ArrowUp') {
      if (history.length === 0) return
      e.preventDefault()
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1)
      recallHistoryEntry(next)
    } else if (e.key === 'ArrowDown') {
      if (historyIndex === null) return
      e.preventDefault()
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(null)
        setBufferLines([])
        setInputValue('')
      } else {
        recallHistoryEntry(next)
      }
    }
  }

  const continuing = bufferLines.length > 0

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
      {continuing && (
        <div
          className="flex-shrink-0 whitespace-pre-wrap border-t border-line-subtle bg-raised/40 px-3 py-1.5 font-mono text-muted"
          style={{ fontSize }}
        >
          {formatReplEcho(bufferLines.join('\n'))}
        </div>
      )}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-t border-line px-3 py-1.5">
        <span className="font-mono text-muted" style={{ fontSize }}>
          {continuing ? '..' : '>>'}
        </span>
        <input
          className="w-full rounded border border-line bg-app px-2 py-1 font-mono text-primary outline-none focus:border-accent-hover disabled:opacity-40"
          style={{ fontSize }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled ? 'Kernel busy…' : continuing ? 'Continue the block, or Esc to cancel…' : 'Type an Octave command…'
          }
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
