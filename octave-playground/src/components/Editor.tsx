import MonacoEditor from '@monaco-editor/react'

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
      <div className="flex border-b border-neutral-800 bg-neutral-900">
        {files.map((file) => (
          <button
            key={file}
            className={`border-r border-neutral-800 px-3 py-1.5 text-sm ${
              file === activeFile
                ? 'bg-neutral-950 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-800'
            }`}
            onClick={() => onSelectTab(file)}
          >
            {file}
            {dirtyFiles.has(file) && <span className="ml-1.5 text-neutral-500">●</span>}
          </button>
        ))}
      </div>
      <div className="flex-1">
        <MonacoEditor
          path={activeFile}
          language="matlab"
          theme="vs-dark"
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
