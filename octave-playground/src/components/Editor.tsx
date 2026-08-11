import { useState } from 'react'
import MonacoEditor, { type Monaco } from '@monaco-editor/react'
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

export function Editor({ files, activeFile, contents, dirtyFiles, onSelectTab, onChange }: EditorProps) {
  const { theme } = useTheme()
  const [fontSize, setFontSize] = useState(() => {
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY))
    return stored > 0 ? stored : DEFAULT_FONT_SIZE
  })

  function updateFontSize(next: number) {
    setFontSize(next)
    localStorage.setItem(FONT_SIZE_KEY, String(next))
  }

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
          value={contents[activeFile] ?? ''}
          onChange={(value) => onChange(activeFile, value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}
