interface CommandWindowProps {
  output: string
}

export function CommandWindow({ output }: CommandWindowProps) {
  return (
    <div className="flex h-56 flex-col border-t border-neutral-800 bg-black">
      <div className="border-b border-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-400">
        Command Window
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-green-400">
        {output || ' '}
      </pre>
    </div>
  )
}
