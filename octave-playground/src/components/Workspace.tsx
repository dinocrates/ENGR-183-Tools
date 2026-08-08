import { PanelHeader } from './PanelHeader'

export interface WorkspaceVar {
  name: string
  size: string
  cls: string
}

interface WorkspaceProps {
  vars: WorkspaceVar[]
  collapsed: boolean
  onToggleCollapse: () => void
}

// Octave's own desktop GUI docks Workspace directly under File Browser, in
// the same left-hand column -- see FileBrowser's sibling Panel in
// Playground.tsx. Read-only: no variable editor (real Octave's double-click-
// to-edit is out of scope here).
export function Workspace({ vars, collapsed, onToggleCollapse }: WorkspaceProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-900">
      <PanelHeader title="Workspace" collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <div className="flex-1 overflow-auto">
        {vars.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-600">No variables</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-1 font-normal">Name</th>
                <th className="px-2 py-1 font-normal">Size</th>
                <th className="px-2 py-1 font-normal">Class</th>
              </tr>
            </thead>
            <tbody>
              {vars.map((v) => (
                <tr key={v.name} className="hover:bg-slate-800/60">
                  <td className="px-3 py-0.5 text-slate-200">{v.name}</td>
                  <td className="px-2 py-0.5 text-slate-400">{v.size}</td>
                  <td className="px-2 py-0.5 text-slate-400">{v.cls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
