import { useState } from 'react'
import { PanelHeader } from './PanelHeader'
import { normalizeFileName } from '../kernel/files'

interface FileBrowserProps {
  unitTitle: string
  files: string[]
  protectedFiles: string[]
  activeFile: string
  dirtyFiles: Set<string>
  onSelect: (file: string) => void
  onAddFile: (file: string) => void
  onDeleteRequest: (file: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function FileBrowser({
  unitTitle,
  files,
  protectedFiles,
  activeFile,
  dirtyFiles,
  onSelect,
  onAddFile,
  onDeleteRequest,
  collapsed,
  onToggleCollapse,
}: FileBrowserProps) {
  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function cancelAdd() {
    setAdding(false)
    setDraftName('')
    setError(null)
  }

  function commitAdd() {
    const normalized = normalizeFileName(draftName)
    if (!normalized) {
      setError('Names must be letters/numbers/underscores, e.g. helper.m')
      return
    }
    if (files.some((f) => f.toLowerCase() === normalized.toLowerCase())) {
      setError(`${normalized} already exists`)
      return
    }
    onAddFile(normalized)
    cancelAdd()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-900">
      <PanelHeader title="File Browser" collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-slate-500">{unitTitle}</span>
        <button
          className="rounded px-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          onClick={() => (adding ? cancelAdd() : setAdding(true))}
          title="Add a new file"
        >
          +
        </button>
      </div>
      <ul className="flex-1 overflow-auto">
        {files.map((file) => (
          <li key={file} className="group flex items-center">
            <button
              className={`flex flex-1 items-center gap-1.5 border-l-2 px-2.5 py-1 text-left text-sm ${
                file === activeFile
                  ? 'border-cyan-400 bg-slate-800 text-slate-100'
                  : 'border-transparent text-slate-300 hover:bg-slate-800/60'
              }`}
              onClick={() => onSelect(file)}
            >
              <span className="flex-1 truncate">{file}</span>
              {dirtyFiles.has(file) && <span className="text-cyan-400">●</span>}
            </button>
            {!protectedFiles.includes(file) && (
              <button
                className="mr-1.5 hidden rounded px-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-red-400 group-hover:block"
                onClick={() => onDeleteRequest(file)}
                title={`Delete ${file}`}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <div className="border-t border-slate-800 px-2.5 py-2">
          <input
            autoFocus
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-cyan-500"
            placeholder="newFile.m"
            value={draftName}
            onChange={(e) => {
              setDraftName(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd()
              else if (e.key === 'Escape') cancelAdd()
            }}
            onBlur={() => {
              if (draftName.trim().length === 0) cancelAdd()
            }}
          />
          {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
        </div>
      )}
    </div>
  )
}
