export interface UnitMeta {
  id: string
  title: string
  description: string
  files: string[]
}

// Picks up every unitNN.json automatically -- dropping in a new one (via
// scripts/new_unit.py + sync_harness.py) needs no app code changes, per
// DESIGN.md Goal 6.
const modules = import.meta.glob('./unit*.json', { eager: true }) as Record<
  string,
  UnitMeta
>

export const units: UnitMeta[] = Object.values(modules).sort((a, b) =>
  a.id.localeCompare(b.id),
)

export function getUnit(id: string): UnitMeta | undefined {
  return units.find((u) => u.id === id)
}
