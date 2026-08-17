import type { UnitCategory, UnitMeta } from '../units'

interface UnitIndexProps {
  units: UnitMeta[]
  scratchUnit: UnitMeta
  onSelect: (unitId: string) => void
}

const SECTION_ORDER: { category: UnitCategory; heading: string }[] = [
  { category: 'guided-practice', heading: 'Guided Practices' },
  { category: 'individual-assignment', heading: 'Individual Assignments' },
]

// Sort within a section by unit number (not by id -- once an id stops
// following the plain 'unitNN' pattern, e.g. 'u02-gp02-tensile', its string
// ordering no longer reliably matches unit number). Same unit number falls
// back to id so the order is still stable and deterministic.
function byUnitNumber(a: UnitMeta, b: UnitMeta): number {
  return a.unitNumber - b.unitNumber || a.id.localeCompare(b.id)
}

// key belongs on the <UnitButton key={unit.id} .../> call site (inside
// .map()), not here -- this <li> is just this component's single root
// element, not itself a list member.
function UnitButton({ unit, onSelect }: { unit: UnitMeta; onSelect: (unitId: string) => void }) {
  return (
    <li>
      <button
        className="w-full rounded border border-line bg-surface px-4 py-3 text-left hover:border-accent-hover"
        onClick={() => onSelect(unit.id)}
      >
        <div className="text-sm font-semibold text-primary">{unit.title}</div>
        <div className="mt-1 text-xs text-muted">{unit.description}</div>
      </button>
    </li>
  )
}

export function UnitIndex({ units, scratchUnit, onSelect }: UnitIndexProps) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-6">
      <h1 className="font-pixel mb-1 text-xl font-semibold text-primary">ENGR-183 Octave Playground</h1>
      <p className="mb-6 text-sm text-muted">Pick an exercise to open it.</p>
      {SECTION_ORDER.map(({ category, heading }, i) => {
        const sectionUnits = units.filter((u) => u.category === category).sort(byUnitNumber)
        if (sectionUnits.length === 0) return null
        return (
          <section key={category} className={i === 0 ? undefined : 'mt-6'}>
            <h2 className="font-pixel mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {heading}
            </h2>
            <ul className="flex flex-col gap-2">
              {sectionUnits.map((unit) => (
                <UnitButton key={unit.id} unit={unit} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        )
      })}
      <div className="mt-6 border-t border-line-subtle pt-4">
        <button
          className="w-full rounded border border-dashed border-line bg-surface px-4 py-3 text-left hover:border-accent-hover"
          onClick={() => onSelect(scratchUnit.id)}
        >
          <div className="text-sm font-semibold text-primary">{scratchUnit.title}</div>
          <div className="mt-1 text-xs text-muted">{scratchUnit.description}</div>
        </button>
      </div>
    </div>
  )
}
