interface FileBrowserProps {
  unitTitle: string
  files: string[]
  activeFile: string
  dirtyFiles: Set<string>
  onSelect: (file: string) => void
}

export function FileBrowser({ unitTitle, files, activeFile, dirtyFiles, onSelect }: FileBrowserProps) {
  return (
    <div className="flex h-full w-56 flex-col border-r border-neutral-800 bg-neutral-900">
      <div className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-400">
        File Browser
      </div>
      <div className="px-3 py-2 text-xs text-neutral-500">{unitTitle}</div>
      <ul className="flex-1 overflow-auto">
        {files.map((file) => (
          <li key={file}>
            <button
              className={`flex w-full items-center gap-1.5 px-3 py-1 text-left text-sm ${
                file === activeFile
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
              onClick={() => onSelect(file)}
            >
              <span className="flex-1 truncate">{file}</span>
              {dirtyFiles.has(file) && <span className="text-neutral-400">●</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
