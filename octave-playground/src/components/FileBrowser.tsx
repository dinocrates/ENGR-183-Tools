import { useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent } from 'react'
import { PanelHeader } from './PanelHeader'
import { normalizeFileName } from '../kernel/files'

interface FileBrowserProps {
  unitTitle: string
  files: string[]
  // Bundled read-only data files -- listed in their own group below the
  // editable files, selectable (opens read-only) but never deletable.
  dataFiles?: string[]
  // Student-uploaded read-only data files ("My files") -- selectable,
  // removable, never in a Canvas submission.
  uploads?: string[]
  protectedFiles: string[]
  activeFile: string
  dirtyFiles: Set<string>
  onSelect: (file: string) => void
  onAddFile: (file: string) => void
  onDeleteRequest: (file: string) => void
  // Called with the files a student chose or dropped (individual files or a
  // Download All .zip). Playground decides what to do with each.
  onUpload: (files: FileList | File[]) => void
  onDeleteUpload: (name: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const UPLOAD_ACCEPT = '.m,.csv,.txt,.tsv,.dat,.json,.log,.zip'

export function FileBrowser({
  unitTitle,
  files,
  dataFiles = [],
  uploads = [],
  protectedFiles,
  activeFile,
  dirtyFiles,
  onSelect,
  onAddFile,
  onDeleteRequest,
  onUpload,
  onDeleteUpload,
  collapsed,
  onToggleCollapse,
}: FileBrowserProps) {
  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function handlePicked(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) onUpload(e.target.files)
    e.target.value = '' // let the same file be picked again later
  }

  function handleDrop(e: ReactDragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <PanelHeader title="File Browser" collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-muted">{unitTitle}</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded px-1.5 text-xs text-muted hover:bg-raised hover:text-secondary"
            onClick={() => fileInputRef.current?.click()}
            title="Upload a file (CSV, text, or a Download All .zip)"
          >
            ↑
          </button>
          <button
            className="rounded px-1.5 text-xs text-muted hover:bg-raised hover:text-secondary"
            onClick={() => (adding ? cancelAdd() : setAdding(true))}
            title="Add a new file"
          >
            +
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={handlePicked}
      />
      <div
        className={`flex-1 overflow-auto ${dragging ? 'bg-accent/10 outline-dashed outline-1 outline-accent-fg' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!dragging) setDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
        onDrop={handleDrop}
      >
        <ul>
          {files.map((file) => (
            <li key={file} className="group flex items-center">
              <button
                className={`flex flex-1 items-center gap-1.5 border-l-2 px-2.5 py-1 text-left text-sm ${
                  file === activeFile
                    ? 'border-accent-fg bg-raised text-primary'
                    : 'border-transparent text-secondary hover:bg-raised/60'
                }`}
                onClick={() => onSelect(file)}
              >
                <span className="flex-1 truncate">{file}</span>
                {dirtyFiles.has(file) && <span className="text-accent-fg">●</span>}
              </button>
              {!protectedFiles.includes(file) && (
                <button
                  className="mr-1.5 hidden rounded px-1 text-xs text-muted hover:bg-raised hover:text-danger-fg group-hover:block"
                  onClick={() => onDeleteRequest(file)}
                  title={`Delete ${file}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {dataFiles.length > 0 && (
          <>
            <div
              className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-faint"
              title="Bundled with the unit. Read-only — open them from your code with engr183.data('name')."
            >
              Data
            </div>
            <ul>
              {dataFiles.map((file) => (
                <li key={file}>
                  <button
                    className={`flex w-full items-center gap-1.5 border-l-2 px-2.5 py-1 text-left text-sm ${
                      file === activeFile
                        ? 'border-accent-fg bg-raised text-primary'
                        : 'border-transparent text-muted hover:bg-raised/60'
                    }`}
                    onClick={() => onSelect(file)}
                    title="Bundled data file — read-only"
                  >
                    <span aria-hidden>🔒</span>
                    <span className="flex-1 truncate">{file}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {uploads.length > 0 && (
          <>
            <div
              className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-faint"
              title="Files you uploaded. Read-only here — read them from your code by name, e.g. csvread('name.csv'). Not included in Download All."
            >
              My files
            </div>
            <ul>
              {uploads.map((file) => (
                <li key={file} className="group flex items-center">
                  <button
                    className={`flex flex-1 items-center gap-1.5 border-l-2 px-2.5 py-1 text-left text-sm ${
                      file === activeFile
                        ? 'border-accent-fg bg-raised text-primary'
                        : 'border-transparent text-muted hover:bg-raised/60'
                    }`}
                    onClick={() => onSelect(file)}
                    title="Your uploaded file — read-only"
                  >
                    <span aria-hidden>📎</span>
                    <span className="flex-1 truncate">{file}</span>
                  </button>
                  <button
                    className="mr-1.5 hidden rounded px-1 text-xs text-muted hover:bg-raised hover:text-danger-fg group-hover:block"
                    onClick={() => onDeleteUpload(file)}
                    title={`Remove ${file}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {adding && (
        <div className="border-t border-line-subtle px-2.5 py-2">
          <input
            autoFocus
            className="w-full rounded border border-line bg-app px-2 py-1 text-sm text-primary outline-none focus:border-accent-hover"
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
          {error && <div className="mt-1 text-xs text-danger-fg">{error}</div>}
        </div>
      )}
    </div>
  )
}
