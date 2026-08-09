import MonacoEditor from '@monaco-editor/react'
import { OCTAVE_LANGUAGE_ID, registerOctaveLanguage } from './octaveLanguage'

interface EditorProps {
  files: string[]
  activeFile: string
  contents: Record<string, string>
  dirtyFiles: Set<string>
  onSelectTab: (file: string) => void
  onChange: (file: string, content: string) => void
}

export function Editor({ files, activeFile, contents, dirtyFiles, onSelectTab, onChange }: EditorProps) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex border-b border-slate-700 bg-slate-900">
        {files.map((file) => (
          <button
            key={file}
            className={`border-r border-slate-700 border-t-2 px-3 py-1.5 text-sm ${
              file === activeFile
                ? 'border-t-cyan-400 bg-slate-950 text-slate-100'
                : 'border-t-transparent text-slate-400 hover:bg-slate-800'
            }`}
            onClick={() => onSelectTab(file)}
          >
            {file}
            {dirtyFiles.has(file) && <span className="ml-1.5 text-cyan-400">●</span>}
          </button>
        ))}
      </div>
      <div className="flex-1">
        <MonacoEditor
          path={activeFile}
          language={OCTAVE_LANGUAGE_ID}
          theme="vs-dark"
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
