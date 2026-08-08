import { PlotOutput } from './PlotOutput'

export type OutputBlock =
  | { kind: 'text'; text: string }
  | { kind: 'plot'; displayId?: string; mimeBundle: Record<string, unknown> }

interface CommandWindowProps {
  output: OutputBlock[]
}

export function CommandWindow({ output }: CommandWindowProps) {
  return (
    <div className="flex h-56 flex-col border-t border-neutral-800 bg-black">
      <div className="border-b border-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-400">
        Command Window
      </div>
      <div className="flex-1 overflow-auto p-3">
        {output.length === 0 ? (
          <pre className="whitespace-pre-wrap font-mono text-xs text-green-400"> </pre>
        ) : (
          output.map((block, i) =>
            block.kind === 'text' ? (
              <pre key={i} className="whitespace-pre-wrap font-mono text-xs text-green-400">
                {block.text}
              </pre>
            ) : (
              <PlotOutput key={i} mimeBundle={block.mimeBundle} />
            ),
          )
        )}
      </div>
    </div>
  )
}
