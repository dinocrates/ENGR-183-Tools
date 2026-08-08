import { PanelHeader } from './PanelHeader'

interface FileBrowserProps {
  unitTitle: string
  files: string[]
  activeFile: string
  dirtyFiles: Set<string>
  onSelect: (file: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function FileBrowser({
  unitTitle,
  files,
  activeFile,
  dirtyFiles,
  onSelect,
  collapsed,
  onToggleCollapse,
}: FileBrowserProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-900">
      <PanelHeader title="File Browser" collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <div className="px-3 py-2 text-xs text-slate-500">{unitTitle}</div>
      <ul className="flex-1 overflow-auto">
        {files.map((file) => (
          <li key={file}>
            <button
              className={`flex w-full items-center gap-1.5 border-l-2 px-2.5 py-1 text-left text-sm ${
                file === activeFile
                  ? 'border-cyan-400 bg-slate-800 text-slate-100'
                  : 'border-transparent text-slate-300 hover:bg-slate-800/60'
              }`}
              onClick={() => onSelect(file)}
            >
              <span className="flex-1 truncate">{file}</span>
              {dirtyFiles.has(file) && <span className="text-cyan-400">●</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
