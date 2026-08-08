Scratch-only. Not part of the shipped harness, not mounted into the WASM VFS.

`solved/<unit>/` and `unsolved/<unit>/` hold reference solutions and pristine unsolved
stubs for each unit, used to prove the harness reports zero on the unsolved stubs in
`../assignments/<unit>/` and full marks once solved. `new_unit.py` scaffolds both when
it creates a unit.

- `run.m` — quick interactive check, prints the report for every unit (or one, via
  `runUnitFilter`). Run from Octave with the repo root on the path (after `setup`).
- `check_golden.m` — CI guardrail: same idea, but diffs the exact output against
  `golden/<unit>_unsolved.txt` / `golden/<unit>_solved.txt` and fails on drift. Units
  without golden files yet are skipped, not failed.
- `regenerate_golden.m` — rewrites the golden files from current output. Run after a
  deliberate, reviewed change to a unit's solved reference or the report format (or the
  first time a new unit's content is finished) -- not to paper over a regression.
- `discoverUnits.m` / `unitFunctionFiles.m` — shared helpers the three scripts above use
  to find units and their function files without hardcoding unit numbers.
