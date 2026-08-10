import MonacoEditor from '@monaco-editor/react'
import { OCTAVE_LANGUAGE_ID, registerOctaveLanguage } from './octaveLanguage'
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
} as const

export function Editor({ files, activeFile, contents, dirtyFiles, onSelectTab, onChange }: EditorProps) {
  const { theme } = useTheme()

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex border-b border-line bg-surface">
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
      </div>
      <div className="flex-1">
        <MonacoEditor
          path={activeFile}
          language={OCTAVE_LANGUAGE_ID}
          theme={MONACO_THEME[theme]}
          beforeMount={registerOctaveLanguage}
          value={contents[activeFile] ?? ''}
          onChange={(value) => onChange(activeFile, value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}
