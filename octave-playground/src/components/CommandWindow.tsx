interface CommandWindowProps {
  output: string
}

export function CommandWindow({ output }: CommandWindowProps) {
  return (
    <div className="flex h-56 flex-col border-t border-slate-700 bg-slate-950">
      <div className="border-b border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
        Command Window
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-slate-100">
        {output || ' '}
      </pre>
    </div>
  )
}
