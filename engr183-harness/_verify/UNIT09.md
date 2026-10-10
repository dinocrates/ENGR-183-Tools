# Unit 9: interpolation, fitting and root finding

ENGR-183 Programming with MATLAB. Release these assignments through the
runbook's dev-first GitHub Pages workflow and verify the production kernel.

| Assignment | ID | Editable script | Canvas PNGs |
|---|---|---|---|
| GP-09: Cooling Data Explorer | `u09-gp09-cooling` | `U09_GP09_Cooling.m` | `GP09_fit_residuals.png`, `GP09_target.png` |
| APA-09: Pump Operating Point | `u09-apa09-pump` | `U09_APA09_Pump.m` | `APA09_fit_residuals.png`, `APA09_operating_point.png` |

Each project has one editable file, with all data embedded and no helper/data
dependencies. Metadata is discovered by the existing glob, unchanged. Canonical
source is `assignments/<id>/`; untouched copies are in `_verify/unsolved/<id>/`.
Personalized instructor references with interpretations stay in git-ignored
`_verify/solved/<id>/`. Do not publish those directories or copy references into
student assets. The public specification/wrapper names are the ID with hyphens
replaced by underscores, followed by `_tests` / `_check`. Both use
`tests/u09_numeric_check.m`.

## Student workflow

No matching Unit 9 Canvas HTML is maintained here. Canvas changes are outside
this release. Students use the following Playground/MATLAB workflow:

> Choose MATLAB or the Octave Playground. All data are included. In the Playground, open the assignment link, complete the preloaded script, use Run File to run it, and use Run Tests for feedback. In MATLAB, download the starter through Download File and run it there; browser tests are not required. Write your interpretation as comments in the script. Submit your completed .m file and both required PNG figures in Canvas. In the browser, select each saved figure, export it with its PNG or camera control, and rename the download to the required filename; in MATLAB, use print. Run Tests does not submit your work.

Production routes (open in a new tab, not a Canvas iframe):

- [GP-09](https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u09-gp09-cooling)
- [APA-09](https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u09-apa09-pump)

Existing download/upload controls remain available for moving student work.
Project switching preserves saved files. Neither MATLAB Grader nor Canvas
submission is connected. Submit exactly the script and two PNGs, without tests,
test-score screenshots or an extra report.

## Feedback and instructor review

There are twelve checks worth one practice point each. Untouched starters earn
2/12 (execution and preserved inputs); completed references earn 12/12 when all
inspectable criteria pass. These totals are separate from the final rubric:
Directions 30%, Compilation/syntax 15%, Runtime/input-output 30%, Correctness 25%.

Run Tests executes the actual saved script once in a disposable function
workspace and captures an explicit variable allowlist, console output and
graphics. `clear` is unmodified. Every specification invocation resets the cache,
including cached failures. Temporary copies and numbered figure isolation follow
Unit 8's implementation; cwd/path and unrelated figures are restored. Function
handles are evaluated inside Octave, never serialized through JavaScript.

Numerical checks use independent expected values, finite-real type/shape checks,
row/column equivalence and explicit `isnan` handling for the two out-of-domain
interpolations (Octave's `NA` is accepted). Curves are evaluated against independent
models on the plotted grids. Legend/colorbar axes are excluded; panel placement,
labels, units, grids, associated legends, ranges and reference lines are inspected.
Unavailable graphics associations fail with an explicit unverified/manual-review
message. No PNG file in the WASM filesystem is required for feedback.

APA roots and operating plots follow either valid `p_selected`; quadratic is the
reference choice, while the separately required linear/quadratic roots and
57 L/min decisions are both checked. Auxiliary decision/status/difference names
are unrestricted. Bisection must supply an estimate and a valid input error bound;
its exact midpoint count is not prescribed.

Review these in source and submitted images, regardless of a 12/12 score:

- Actual `interp1`, `polyfit`, `polyval`, bisection and `fzero` use; no hard-coded outputs.
- Bisection endpoint roots, finite-real validation, sign rejection, interval updates,
  input half-width stopping and iteration-exhaustion error.
- `fzero` uses the original bracket; success flags are checked for every solve.
- APA uses `if/else` and unrounded flows against the unchanged 57 L/min threshold.
- Model choice is defended using RMSE, residual shape and decreasing pump trend.
- Interpretations distinguish fitting residuals from the root residual, explain
  zero lines, model dependence and extrapolation limits, and discuss validation.
- Final exported images have readable labels/legends, full data and correct filenames.

An output-residual stopping rule, ignored comparison flags or rounding before
comparison may happen to reproduce the correct values here. The mutation suite
explicitly records these as source-review cases, not proof of a correct method.

## Focused verification commands

Use desktop Octave 11.3 for the harness; MATLAB R2026b separately verifies the
standalone reference scripts. On this
Windows installation, numbered figures select fltk despite a gnuplot default;
the test-only creation callback below selects headless gnuplot for native PNGs.
It is never added to student scripts or browser code. Run outside the restricted
filesystem if native Octave cannot discover assignment folders; set `COPYCMD=/Y`.

From `engr183-harness`, in separate processes for each ID/kind:

```matlab
set(0,'defaultfigurecreatefcn',@(h,e) graphics_toolkit(h,'gnuplot'));
set(0,'defaultfigurevisible','off'); setup;
runUnitFilter='u09-gp09-cooling'; run('_verify/run.m');
% Repeat with u09-apa09-pump.
```

```matlab
set(0,'defaultfigurecreatefcn',@(h,e) graphics_toolkit(h,'gnuplot'));
set(0,'defaultfigurevisible','off'); setup; addpath('_verify');
regression_u09('gp');  % separate process: regression_u09('apa')
```

The regression driver restores the incoming file on exit, counts actual script
executions, checks fixture totals/goldens, exercises the inline bisection branches
under controlled functions, and preserves an existing figure. Optional second
argument filters mutation names. After inspecting actual fixture reports:

```matlab
regenUnitFilter='u09-gp09-cooling'; run('_verify/regenerate_golden.m');
% Repeat with u09-apa09-pump; retain the same desktop graphics setup.
```

Wait for fixture processes to finish and confirm canonical starters equal their
untouched fixtures before syncing. From `octave-playground` with Node 24:

```text
python scripts/sync_harness.py
python scripts/rebuild-mount-from-vfs.py
npm run build
npm run lint
npm run preview -- --host 127.0.0.1 --port 4189
```

```text
node m0-spike-driver/u09-assignments.js http://127.0.0.1:4189/ workflow
node m0-spike-driver/u09-assignments.js http://127.0.0.1:4189/ switch
node m0-spike-driver/u09-assignments.js http://127.0.0.1:4189/ figures-checks
node m0-spike-driver/u09-graphics.js http://127.0.0.1:4189/
node m0-spike-driver/t134-plot-title.js http://127.0.0.1:4189/
python ../engr183-harness/_verify/audit_u09.py
```

The browser driver checks exact starter/download source, mounted checker SHA,
core routines, Run File, both saved figures and actual camera PNGs, formative
scores, edits, failure/correction, returning sessions and GP → APA → GP.
Evidence JSON/text/PNGs remain local. Visually inspect the exports.

The browser PNG adapter hands off standard PNG print requests to the existing
camera workflow because Ghostscript is unavailable. Figure Position dimensions
are carried by the existing title/graphics snapshot. No optional numerical
packages, browser-only student helpers or Octave-only student syntax are needed.

## Release verification

Follow the runbook's dev-first release process. Deployed dev shares main's
kernel; a visible route alone
does not establish that its mounted Unit 9 tests are current. Local mount hashes
must match current checkers, and fixtures must be absent from both public assets
and mount archives. Local build success is not production or MATLAB verification.

## Local verification record (2026-10-09 to 2026-10-10)

Desktop Octave 11.3.0: both untouched fixtures scored **2/12** and both complete
references scored **12/12**. Actual reports were inspected before generating the
four golden files; subsequent fixture comparisons matched. All **24 GP cases**
and **29 APA cases** produced their expected outcomes across the focused runs.
These include valid alternatives and explicitly identified source-review cases,
not 53 claimed detections of incorrect algorithms. Every case checked exactly
one script execution and restored cwd/path and incoming source.

The quadratic and permitted linear APA selections both earn 12/12. Renamed APA
auxiliary flags, decisions and solver-difference variables, row/column vectors,
and alternate dense plotting grids are accepted. The output-residual stopping
mutations fail the half-width check for these references. Unchecked comparison
status and rounded threshold mutations retain correct outputs and are explicitly
flagged for source review. Controlled executions of each actual inline loop pass
both endpoint roots, same-sign rejection, nonfinite/complex rejection and
iteration exhaustion. An unrelated existing figure survives each checker.

Both standalone references exited successfully and wrote four real native PNGs
in their private fixture directories (fit figures 1608×1125; second figures
871×654). The same reference source was copied privately to `notes/u09-matlab/`
and executed with the installed `C:/Program Files/MATLAB/R2026b/bin/matlab.exe`
using `-batch`. MATLAB **26.2.0.3386108 (R2026b)** exited 0 for both scripts;
assertions verified interpolation/NaN, selected roots/status/residual/head
balance, input half-width and solver agreement, and both pump decisions/flags.
All four standard native `print` calls wrote PNGs. This was actual MATLAB
execution, separate from the Octave feedback harness.

Node 24 production build/type checking passed. Lint passed with pre-existing
repository warnings. The existing browser title regression passed all five
groups, including subplot/legend preservation, multiple figures, clearing,
returned handles, property changes and `clear all`. The focused browser graphics
probe passed real camera PNG export, figure Position and later size updates,
invalid print-option rejection, and confirmation that no fake native PNG is
created by the adapter.

The asset audit confirms exact canonical/untouched/public/dist starter bytes,
one editable file per project, all five mounted Unit 9 checker/specification
files plus the report, and no instructor fixtures in either mount or served
assets. The verified shared checker SHA-256 is
`feeaf997904d3decea03fd1825b8816f037d57223c4c5ff30414f57f99b290fe`.
Generated assets are intentionally git-ignored; reproduce them in runbook order.

Browser Run File executed both complete references in the actual WASM runtime,
including `interp1`, `polyfit`, `polyval`, `fzero`, `isfinite`, anonymous functions,
subplots, legends and common limits. Both selected `fzero` solves returned status
1 and residuals below 1e-6. Both references earned **12/12**, and both untouched
starters earned **2/12**. Camera exports were visually inspected: all four images
are readable, with fit figures at 1000×700 and second figures at 560×420. The pump
root trace is a visible black square at approximately (55.883664, 14.368952).
Source downloads contain the student's edited script, without platform shims.
Unit 9 Run Tests filters its isolated checking figures' display events at the
viewer boundary, retaining numerical/graphics inspection and text/errors in
Octave. Hidden checking figures do not open empty student windows or enter Saved
figures. Earlier assignments and Run File retain their existing display behavior.
The final `figures-checks` regression exited 0 with no page errors: both references
still scored 12/12, no checking windows opened, exactly two saved student figures
remained per project, and each saved figure reopened and exported again after
Run Tests. This focused run used the final viewer-filter build.

The complete strict browser workflow exited 0 with **no page errors**. For each
assignment it verified starter 2/12, complete 12/12, a saved interpolation edit
11/12, deliberate execution failure 1/12 with the main filename/line, corrected
12/12, and returning-session 12/12. The final GP → APA → GP return also scored
12/12. Saved figures remained available in the returning project. Full evidence
is in the local `u09-workflow-results.json`; the additional APA export/trace probe
also exited 0 with no page errors.

The separate menu-switch driver verified GP → APA → GP with persisted completed
sources and 12/12 feedback on every project. Its initial strict run hit the
previously documented vendor malformed-JSON fault. A recovery-enabled run then
passed: the final GP check hit another malformed-JSON fault, and the existing
Stop/restart control recovered to 12/12 while preserving saved work. Evidence is
retained in `u09-switch-strict-results.json` and `u09-switch-results.json` locally.
Use `U09_RECOVER=1` to permit one recorded Stop/retry per check. This is verified
recovery, not an uninterrupted clean run or a fix to the upstream WASM runtime.
