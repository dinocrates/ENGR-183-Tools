export interface UnitMeta {
  id: string
  title: string
  description: string
  files: string[]
  // Ungraded free-play mode: no rubric/tests exist for it, so the Toolbar
  // hides Run Tests and UnitIndex lists it separately from the curriculum.
  isScratch?: boolean
  // Starter filenames this unit used to ship that a returning student's
  // browser drive may still have (e.g. from IndexedDB persisting across a
  // content revision). Excluded from extra-file discovery (T3.13's
  // UnitFiles.listExtraFiles) so they're hidden rather than resurfacing as
  // if the student had created them -- never deleted, just not shown.
  retiredFiles?: string[]
}

// Picks up every unitNN.json automatically -- dropping in a new one (via
// scripts/new_unit.py + sync_harness.py) needs no app code changes, per
// DESIGN.md Goal 6. scratch.json intentionally doesn't match this glob: it's
// not curriculum content, so it's kept out of `units` entirely and wired in
// separately below.
const modules = import.meta.glob('./unit*.json', { eager: true }) as Record<
  string,
  UnitMeta
>

export const units: UnitMeta[] = Object.values(modules).sort((a, b) =>
  a.id.localeCompare(b.id),
)

export const scratchUnit: UnitMeta = {
  id: 'scratch',
  title: 'Scratch Pad',
  description: 'Write and run any Octave code here. Nothing on this page is graded.',
  files: ['scratch.m'],
  isScratch: true,
}

export function getUnit(id: string): UnitMeta | undefined {
  if (id === scratchUnit.id) return scratchUnit
  return units.find((u) => u.id === id)
}
