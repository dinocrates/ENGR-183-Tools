import type { UnitMeta } from '../units'

interface UnitIndexProps {
  units: UnitMeta[]
  onSelect: (unitId: string) => void
}

export function UnitIndex({ units, onSelect }: UnitIndexProps) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">ENGR-183 Octave Playground</h1>
      <p className="mb-6 text-sm text-neutral-400">Pick a unit to open it.</p>
      <ul className="flex flex-col gap-2">
        {units.map((unit) => (
          <li key={unit.id}>
            <button
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-3 text-left hover:border-neutral-500"
              onClick={() => onSelect(unit.id)}
            >
              <div className="text-sm font-semibold text-neutral-100">{unit.title}</div>
              <div className="mt-1 text-xs text-neutral-400">{unit.description}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
