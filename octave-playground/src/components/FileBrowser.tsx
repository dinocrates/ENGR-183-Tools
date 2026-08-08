interface FileBrowserProps {
  unitTitle: string
  files: string[]
  activeFile: string
  dirtyFiles: Set<string>
  onSelect: (file: string) => void
}

export function FileBrowser({ unitTitle, files, activeFile, dirtyFiles, onSelect }: FileBrowserProps) {
  return (
    <div className="flex h-full w-56 flex-col border-r border-slate-700 bg-slate-900">
      <div className="border-b border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400">
        File Browser
      </div>
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
