import { PanelHeader } from './PanelHeader'

interface CommandWindowProps {
  output: string
  collapsed: boolean
  onToggleCollapse: () => void
}

export function CommandWindow({ output, collapsed, onToggleCollapse }: CommandWindowProps) {
  return (
    <div className="flex h-full flex-col bg-app">
      <PanelHeader title="Command Window" collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-primary">
        {output || ' '}
      </pre>
    </div>
  )
}
