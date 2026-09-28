# Unit 7: linear systems in MATLAB

| Assignment | Route ID | Main script | Camera export |
| --- | --- | --- | --- |
| GP-07: Solving a Resistor Network | `u07-gp07-circuit` | `U07_GP07_Circuit.m` | `GP07_node_voltages.png` |
| APA-07: Recovering Forces from Coupled Sensor Readings | `u07-apa07-force-recovery` | `U07_APA07_ForceRecovery.m` | `APA07_force_comparison.png` |

Each project has its own `solve_checked_system.m`: unfinished for GP, completed
for APA. All four starters and both metadata objects reproduce the assignment
prompt. Main files open first, with all inputs embedded and no data files or
editable checks. Existing metadata globs register both routes; the local
verification runner discovers both directories and their `.m` files.

Target production links, requiring app and harness deployment together:

- https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u07-gp07-circuit
- https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u07-apa07-force-recovery

Run the main script, inspect the figure, then use Run Tests for feedback.
Download each completed source with Download File and export the figure with
the camera; rename its PNG as above. Submit those three files in Canvas.
Tests, public checks, screenshots of tests, and transcripts are not submissions.
Run Tests never submits to Canvas. The older Unit 7 lecture's closing GP sentence
should refer to solving a three-node resistor network, not repeat load-sensor
calibration. Canvas materials are already authored; no Canvas publishing is
part of this implementation.

## Models and units

GP has six equal 1000-ohm resistors: supply to V1, V1 to V2, V2 to V3, and
each node to common 0 V ground. Unknown order is `[V1;V2;V3]`. Supplied equations:

| Node | Current balance | After multiplying by R |
| --- | --- | --- |
| V1 | `(V1-Vs)/R + V1/R + (V1-V2)/R = 0` | `3*V1 - V2 + 0*V3 = Vs` |
| V2 | `(V2-V1)/R + V2/R + (V2-V3)/R = 0` | `-V1 + 3*V2 - V3 = 0` |
| V3 | `(V3-V2)/R + V3/R = 0` | `0*V1 - V2 + 2*V3 = 0` |

A is dimensionless. Equation residuals are in V; branch currents and node
balances are separately in mA. Supply change is signed, while voltage-vector
2-norm change is a magnitude. The independent 13 V known right side must not
be generated from the student's A. Interpretation: 3–4 sentences including
a numerical result, supply effect, residual meaning, and ideal-model limitation.

APA uses synthetic coupled channels, force order `[Fx;Fy;Fz]`:

```text
s1 = 1.00*Fx + 0.200*Fy + 0.10*Fz
s2 = 1.00*Fx + 0.201*Fy + 0.10*Fz
s3 = 0.05*Fx + 0.150*Fy + 0.90*Fz
```

C is in mV/N, forces in N, readings/residuals in mV. Keep 0.200 and 0.201
distinct and all force/reading vectors as columns. Negative forces are valid.
The supplied known readings are independent. Both percent changes use whole
vectors and 2-norms, multiplied by 100. Full rank and small residuals do not
guarantee low sensitivity; conditioning depends on scaling. Interpretation:
100–150 words covering original/changed forces, both percent changes, residuals,
rank, conditioning, `0.001*Fy = s2-s1`, known-load evidence and physical validation.

## Feedback and fixtures

Twelve one-point checks in order: personalization, execution, inputs, matrix,
helper, baseline, residual, known, application, change, plot, output.
Untouched GP: **2/12**; untouched APA: **3/12**; both references: **12/12**.
These are practice scores, separate from Canvas's Directions 30%,
Compilation/Syntax 15%, Runtime/IO 30%, Correctness 25%. Source algorithms,
interpretation, meaningful titles, and final PNG need instructor review.

Each specification resets its cached snapshot. Main execution occurs once in
a separate function workspace, capturing an explicit variable allowlist, output,
and existing graphics handles. Failures are cached with source location;
variables available before a failure still support useful early feedback.
Path/directory restoration and helper cache invalidation isolate the projects.
Helper checks include general/scalar/zero/sensitive systems and invalid inputs;
a singular warning is insufficient. Numeric checks enforce shapes, finite real
values, strict residual thresholds, and agreement of norms and independent errors.
Console checks associate numbers with labels/units and allow engineering rounding;
unusual presentation may need instructor review.

Graphics checks read handles without activating figures, filter legend/colorbar
axes, match series by data, and inspect legend peer associations, styles, ticks,
labels, grid and ranges. Unsupported legend association requests explicit visual
review. Desktop correctness alone does not establish browser/camera behavior.

Solutions remain in git-ignored `_verify/solved/<id>/`, like Unit 6's answer keys
in this public repository. They are not synced into starters or kernel assets.
Full verification requires these local instructor files; CI skips units without
solved fixtures. `_verify/unsolved/<id>/` contains exact starter copies.

## Verification commands

From `engr183-harness/`, use separate Octave processes for each assignment:

```matlab
set(0,'defaultfigurevisible','off'); setup;
runUnitFilter='u07-gp07-circuit'; % repeat for u07-apa07-force-recovery
run('_verify/run.m');
```

After inspecting reports, regenerate only the selected golden in a fresh process:

```matlab
set(0,'defaultfigurevisible','off'); setup;
regenUnitFilter='u07-gp07-circuit'; % repeat for APA
run('_verify/regenerate_golden.m');
```

Mutations/goldens and the session check, each in a separate invocation:

```matlab
set(0,'defaultfigurevisible','off'); setup; addpath('_verify');
regression_u07('gp'); % separately: regression_u07('apa')
% separately: regression_u07_session()
```

`u07-cases.json` supplies both desktop and browser mutations. Regression restores
both incoming files even on failure, counts exactly one main execution, verifies
path/directory restoration, and checks goldens without rewriting them. The session
test checks GP → APA → GP and edited/failing/corrected helpers without the driver
clearing their cache. On native Windows set `$env:COPYCMD='/Y'` for the existing
runner's noninteractive fixture copies. Run Octave outside a restricted Windows
sandbox if absolute-path `dir`/`copyfile` fails there.

From `octave-playground/`, follow RUNBOOK.md's rebuild order:

```text
python scripts/sync_harness.py
python scripts/rebuild-mount-from-vfs.py
npm run build
npm run lint
npm run preview -- --host 127.0.0.1 --port 4187
```

From `octave-playground/m0-spike-driver/`:

```text
node u07-assignments.js gp http://127.0.0.1:4187/
node u07-assignments.js apa http://127.0.0.1:4187/
```

The browser driver checks both exact starter downloads, fresh/returning deep links,
independent helpers, real Run File/Tests, mounted checker SHA/version, camera PNGs,
file resets and failure recovery. Set `U07_BROWSER_MODE=mutations` for shared
mutations; optionally select names with `U07_CASE_FILTER`. Evidence stays local.
A printed score without returning Ready fails acceptance. Visually inspect both
named camera images. Release is dev-first; deployed dev shares main's baked
kernel, so UI registration alone cannot verify the mounted tests.

## Local verification record (2026-09-27)

- Octave 11.3.0: both independent runbook fixture runs produced the required
  2/12 GP, 3/12 APA, and 12/12 solved totals. All four generated reports were
  inspected and subsequently matched fresh golden checks. The existing Unit 1
  report also matched its previous golden after normalizing checkout line endings.
- Desktop mutations: 30 GP cases and 33 APA cases passed, including wrong
  coefficients, row/wrong-length right sides, fabricated known flags, missing
  rank rejection, hard-coded helpers, incorrect current units, percentage/norm
  mistakes, changed residuals using original inputs, false output labels/numbers,
  swapped/clipped plots, nonfinite/complex results, and valid alternate formatting.
  Each mutation executed the main exactly once; repeated, failing and corrected
  runs restored path/directory. GP → APA → GP and edited helper isolation passed.
- Build/type check and lint passed (existing dependency/build/lint warnings).
  Sync completed without drift overrides; the mount was repacked before building.
  Source, pristine fixtures, public starters and built starters match. All five
  Unit 7 test adapters are in the generated mount; solved fixtures are absent.
- Both local browser routes loaded exact two-file starters with their independent
  helpers. Both complete projects rendered and exported actual 560-by-420 camera
  PNGs; images were visually inspected for labels, correct legends and visible
  values, including negative Fy. Reference plots use margins so endpoint markers
  are visible. Source downloads, returning sessions, project switching, canceled
  and confirmed reset, helper edits, runtime failures and corrected runs passed.
- On the final mount, six consecutive APA browser cases passed: complete
  reference, percent fractions, per-component percentage, changed residual
  using original readings, clipped negative Fy, and corrected reference. Each
  confirmed one main execution, returned Ready, and reported no page errors.
  Both projects' browser probes matched the final checker hash below.
- The first APA workflow attempt hit a browser JSON parsing error after reload
  and timed out before a report. Its evidence is retained locally in
  `notes/u07-apa-first-browser-failure.json`. An independent complete retry passed;
  the intermittent parsing fault was not reproduced or claimed fixed. A separate
  path-normalization issue found during development was fixed by avoiding an
  unnecessary WASM toolkit path reload. Successful browser runs had no page errors.

Use `regression_u07('gp','^$')` / `regression_u07('apa','^$')` for fixture/golden
checks without rerunning all mutations; the optional second argument filters
case names. Browser evidence and timing reports are in `m0-spike-driver/u07-*`.
The final checker SHA-256 is
`c6b08f46340580429ccf092e0dbcc8bda458310442d72460f1b8eaa2cadc3233`.
The mount's HARNESS_VERSION records the last committed harness revision; the
content hash identifies these local changes more precisely before commit.

This record describes local verification on `dev` before deployment. Release
status is tracked by the GitHub Pages workflow. During the runbook's dev-first
release, repeat mounted-hash verification on production before directing students
to the links above. No Canvas page was changed.
