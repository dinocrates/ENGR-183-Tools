// UnitIndex groups the landing page by this, not by title-prefix parsing
// (OR-/APA-/GP-) -- explicit and typo-checked, rather than fragile string
// sniffing.
export type UnitCategory = 'guided-practice' | 'individual-assignment'

export interface UnitMeta {
  id: string
  title: string
  description: string
  files: string[]
  // Which landing-page section this belongs in. Required for every real
  // curriculum unit; the Scratch Pad (defined below, not part of `units`)
  // doesn't need one since it's never in either section.
  category: UnitCategory
  // The "Unit N" this exercise belongs to, e.g. 2 for both unit02 (APA-02)
  // and u02-gp02-tensile (GP-02) -- UnitIndex sorts each category's list by
  // this rather than by `id` (whose string ordering doesn't reliably match
  // unit number once ids stop following the plain 'unitNN' pattern, e.g.
  // 'u02-gp02-tensile' sorts before 'unit01' alphabetically).
  unitNumber: number
  // Ungraded free-play mode: no rubric/tests exist for it, so the Toolbar
  // hides Run Tests and UnitIndex lists it separately from the curriculum.
  isScratch?: boolean
  // Starter filenames this unit used to ship that a returning student's
  // browser drive may still have (e.g. from IndexedDB persisting across a
  // content revision). Excluded from extra-file discovery (T3.13's
  // UnitFiles.listExtraFiles) so they're hidden rather than resurfacing as
  // if the student had created them -- never deleted, just not shown.
  retiredFiles?: string[]
  // Optional short note shown under the description in ProblemStatement
  // (e.g. attributing a dataset's source). Absent for every unit that
  // doesn't need one -- no visual change when omitted.
  note?: string
  // Optional external link (e.g. to the dataset's original source) shown
  // alongside `note` in ProblemStatement. Absent for every unit that
  // doesn't need one -- no visual change when omitted.
  sourceUrl?: string
  // Filenames excluded from Download All (.zip)'s output -- e.g. APA-03's
  // supplied public-check tab, which is part of the five-tab working
  // project but must not appear in the four-file Canvas submission ZIP.
  // Absent (or omitted) for every unit whose zip should still contain
  // every tab, which is most of them -- no behavior change when omitted.
  submissionExclude?: string[]
}

// Picks up every unitNN.json automatically -- dropping in a new one (via
// scripts/new_unit.py + sync_harness.py) needs no app code changes, per
// DESIGN.md Goal 6. scratch.json intentionally doesn't match either glob:
// it's not curriculum content, so it's kept out of `units` entirely and
// wired in separately below.
//
// A second and third pattern pick up guided-practice and individual-
// assignment exercises that have their own route key (e.g.
// 'u02-gp02-tensile.json', 'u03-apa03-processor-cooling.json'), which
// don't fit the unitNN naming convention since their id also has to
// survive as a URL query param and an assignments/ folder name distinct
// from that unit's other exercise(s) -- see
// engr183-harness/tests/u02_gp02_tensile_check.m's header comment for why
// the id itself keeps its hyphens even though the underlying Octave
// function name can't.
const modules = {
  ...(import.meta.glob('./unit*.json', { eager: true }) as Record<string, UnitMeta>),
  ...(import.meta.glob('./u0*-gp*.json', { eager: true }) as Record<string, UnitMeta>),
  ...(import.meta.glob('./u0*-apa*.json', { eager: true }) as Record<string, UnitMeta>),
}

export const units: UnitMeta[] = Object.values(modules).sort((a, b) =>
  a.id.localeCompare(b.id),
)

export const scratchUnit: UnitMeta = {
  id: 'scratch',
  title: 'Scratch Pad',
  description: 'Write and run any Octave code here. Nothing on this page is graded.',
  files: ['scratch.m'],
  isScratch: true,
  // Never actually read: UnitIndex renders scratchUnit through its own
  // dedicated block, not the category-grouped sections, so these two
  // fields are just here to satisfy UnitMeta's required shape.
  category: 'individual-assignment',
  unitNumber: 0,
}

export function getUnit(id: string): UnitMeta | undefined {
  if (id === scratchUnit.id) return scratchUnit
  return units.find((u) => u.id === id)
}
