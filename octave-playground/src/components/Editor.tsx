import { useEffect, useRef, useState } from 'react'
import MonacoEditor, { type Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { OCTAVE_LANGUAGE_ID, registerOctaveLanguage } from './octaveLanguage'
import { registerCustomMonacoThemes } from './monacoThemes'
import { FontSizeControls } from './FontSizeControls'
import { useTheme } from '../theme'

interface EditorProps {
  files: string[]
  activeFile: string
  contents: Record<string, string>
  dirtyFiles: Set<string>
  onSelectTab: (file: string) => void
  onChange: (file: string, content: string) => void
  // Breakpoint lines (1-indexed) for the active file, and a click-to-toggle
  // handler wired to the glyph margin.
  breakpoints?: number[]
  onToggleBreakpoint?: (file: string, line: number) => void
  // The line the debugger is currently paused on, if it's in the active
  // file -- highlighted full-width.
  debugLine?: number | null
}

const MONACO_THEME = {
  dark: 'vs-dark',
  light: 'vs',
  'high-contrast': 'hc-black',
  retro: 'nes-retro',
  matrix: 'matrix',
} as const

function handleBeforeMount(monaco: Monaco): void {
  registerOctaveLanguage(monaco)
  registerCustomMonacoThemes(monaco)
}

const FONT_SIZE_KEY = 'engr183-editor-font-size'
const DEFAULT_FONT_SIZE = 13

export function Editor({
  files,
  activeFile,
  contents,
  dirtyFiles,
  onSelectTab,
  onChange,
  breakpoints = [],
  onToggleBreakpoint,
  debugLine = null,
}: EditorProps) {
  const { theme } = useTheme()
  const [fontSize, setFontSize] = useState(() => {
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY))
    return stored > 0 ? stored : DEFAULT_FONT_SIZE
  })

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<MonacoEditorNS.IEditorDecorationsCollection | null>(null)
  const hoverDecoRef = useRef<MonacoEditorNS.IEditorDecorationsCollection | null>(null)
  // Keep the latest toggle handler / active file reachable from the
  // (once-registered) mouse-down listener without re-registering it.
  const toggleRef = useRef<((line: number) => void) | null>(null)
  toggleRef.current = onToggleBreakpoint ? (line) => onToggleBreakpoint(activeFile, line) : null
  const bpRef = useRef<number[]>(breakpoints)
  bpRef.current = breakpoints

  function updateFontSize(next: number) {
    setFontSize(next)
    localStorage.setItem(FONT_SIZE_KEY, String(next))
  }

  function handleMount(editor: MonacoEditorNS.IStandaloneCodeEditor, monaco: Monaco) {
    editorRef.current = editor
    monacoRef.current = monaco
    decorationsRef.current = editor.createDecorationsCollection()
    hoverDecoRef.current = editor.createDecorationsCollection()

    const GUTTER = new Set([
      monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
      monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS,
      monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS,
    ])
    editor.onMouseDown((e) => {
      if (GUTTER.has(e.target.type) && e.target.position && toggleRef.current) {
        toggleRef.current(e.target.position.lineNumber)
      }
    })
    // VS Code-style hover hint: a faint dot follows the pointer down the
    // gutter so it's discoverable that clicking there sets a breakpoint.
    editor.onMouseMove((e) => {
      const line =
        GUTTER.has(e.target.type) && e.target.position ? e.target.position.lineNumber : null
      hoverDecoRef.current?.set(
        line == null || bpRef.current.includes(line)
          ? []
          : [
              {
                range: new monaco.Range(line, 1, line, 1),
                options: {
                  glyphMarginClassName: 'engr183-bp-hover',
                  glyphMarginHoverMessage: { value: 'Click to set a breakpoint' },
                },
              },
            ],
      )
    })
    editor.onMouseLeave(() => hoverDecoRef.current?.set([]))
  }

  // Re-paint breakpoint dots + the paused-line highlight whenever any input
  // changes.
  useEffect(() => {
    const monaco = monacoRef.current
    const collection = decorationsRef.current
    if (!monaco || !collection) return
    const decos: MonacoEditorNS.IModelDeltaDecoration[] = breakpoints.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        glyphMarginClassName: 'engr183-bp-glyph',
        glyphMarginHoverMessage: { value: 'Breakpoint' },
      },
    }))
    if (debugLine != null) {
      decos.push({
        range: new monaco.Range(debugLine, 1, debugLine, 1),
        options: { isWholeLine: true, className: 'engr183-debug-line' },
      })
    }
    collection.set(decos)
  }, [breakpoints, debugLine, activeFile, contents])

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex items-center border-b border-line bg-surface">
        {files.map((file) => (
          <button
            key={file}
            className={`border-r border-line border-t-2 px-3 py-1.5 text-sm ${
              file === activeFile
                ? 'border-t-accent-fg bg-app text-primary'
                : 'border-t-transparent text-muted hover:bg-raised'
            }`}
            onClick={() => onSelectTab(file)}
          >
            {file}
            {dirtyFiles.has(file) && <span className="ml-1.5 text-accent-fg">●</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-2">
          <FontSizeControls size={fontSize} onChange={updateFontSize} />
        </div>
      </div>
      <div className="flex-1">
        <MonacoEditor
          path={activeFile}
          language={OCTAVE_LANGUAGE_ID}
          theme={MONACO_THEME[theme]}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          value={contents[activeFile] ?? ''}
          onChange={(value) => onChange(activeFile, value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize,
            automaticLayout: true,
            glyphMargin: true,
          }}
        />
      </div>
    </div>
  )
}
