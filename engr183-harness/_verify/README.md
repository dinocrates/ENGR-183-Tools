Scratch-only. Not part of the shipped harness, not mounted into the WASM VFS.

`solved/<unit>/` and `unsolved/<unit>/` hold reference solutions and pristine unsolved
stubs for each unit, used to record the intended starter baseline in
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

Unit 6 uses a **2/10** untouched-starter baseline (execution and supplied data),
and **10/10** solved code-check feedback, separate from the Canvas grade.
See [UNIT06.md](UNIT06.md) for the focused desktop/browser verification,
coverage, and manual submission checks. `u06-cases.json` describes mutations of
the instructor solved fixtures; `regression_u06.m` and the browser driver use
the same cases. The regression restores the exact incoming assignment source
on success or failure, and asserts one student execution per invocation.
