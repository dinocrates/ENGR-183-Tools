# Unit 8: solar-panel analysis and technical report

Activity: `u08-project-solar-station`, individual assignment, Unit 8.
Target route after deployment:
https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u08-project-solar-station

`SolarStation_Analysis.m` opens first, followed by `evaluate_system.m`.
`solar_station_measurements.csv` is preloaded as read-only data in the current
working directory. The existing course `readmatrix` shim supports the supplied
MATLAB import. No data download/upload is required. The CSV is excluded from
Download All; completed MATLAB sources and saved PNG/figure documents remain
included. Students submit their 3–4 page PDF and completed MATLAB files in Canvas.
Run Tests does not grade the report or submit work.

The in-app assignment guide links to
`public/project-guides/unit08/assignment.html`, with all equations, component
prices, shared cleaning rules, output contracts, figures and report requirements.
The adjacent overview page contains a video placeholder. Replace that placeholder
with the explainer and an accessible transcript link when the video is available.

## Feedback and reference files

Twelve one-point programming groups cover cleaning, power, summaries, helper
costs, helper decisions, required branching, helper integration, recommendation,
changed inputs, each figure, and output. Untouched starters earn **0/12**;
complete instructor fixtures earn **12/12**. These are separate from the report
weights: analysis 30%, MATLAB 20%, figures/tables 20%, interpretation/report 30%.

Exact starters live in `assignments/<id>/` and `_verify/unsolved/<id>/`.
Complete reference solutions are local, git-ignored `_verify/solved/<id>/` files.
They must never be copied into student assets. Sync only through
`scripts/sync_harness.py`; it does not include `_verify/`.

The exact supplied CSV has SHA-256
`38a8275a03a0ae81881405b2b62b2fee4527812bed7b14fa2ebef69c81158fda`.
Its first row is data, not a header. Do not regenerate or reorder observations.

The checker computes an independent oracle from the supplied CSV. It runs a
temporary copy of the student's main script and extra helpers, wraps the helper
to observe actual arguments and returned values, and captures variables/output
in a separate function workspace so `clear` cannot erase checker state.
Independent helper calls cover varied component lengths, quantities, prices,
all four outcomes, both threshold arguments and exact boundaries.

For the changed-input group, two further temporary runs lower C's panel unit
price to 100 and lower the budget to 400. The input declarations must remain as
supplied; selected_day may change. Original sources and CSV are never rewritten
by Run Tests. Standalone plotting calls can be omitted from these two temporary
probes, while preserving all calculations and statements after the plots. Code
with graphics dependencies or additional helpers uses the full script; a failed
shortened probe is retried with plotting before receiving feedback.

Temporary directories, paths and helper caches are restored. A temporary figure
wrapper isolates numbered figures from the student's existing plots. Desktop
test figures are deleted immediately. In the browser, test figures remain hidden
until the next Run Tests retires them, allowing deferred native graphics events
to finish first. Saved student figures and their export controls are preserved.

`u08_source.m` blanks comments and strings while retaining source positions.
The technique check examines executable branches and follows simple predicate
aliases, then checks independent behavior. This is a heuristic, not a proof of
meaningful control flow or academic integrity. Review branching and actual use
of returned values when grading. Console checks verify labels, units and values;
review their associations and readability manually. Review report reasoning,
limitations, captions and final exported figures separately.

## Focused verification

From `engr183-harness/`, in separate Octave processes:

```matlab
set(0,'defaultfigurevisible','off'); setup;
runUnitFilter='u08-project-solar-station'; run('_verify/run.m');
```

```matlab
set(0,'defaultfigurevisible','off'); setup; addpath('_verify');
regression_u08();
```

`u08-cases.json` defines targeted regressions and valid alternatives. Additional
synthetic CSV cases exercise exactly 100 W/80%, zero power and Inf, multiple bad
sensors in one row, negative non-sentinel temperatures, no retained rows,
percentages just below 80%, and equal-cost tie order. The driver restores all
three original files on success or failure. An optional regular-expression
argument selects mutations, e.g. `regression_u08('rounded before decision')`.
Fixture/golden and synthetic checks still run; a second argument of `false`
skips only the synthetic cases. On Windows use `COPYCMD=/Y` and
run outside the restricted sandbox if Octave's absolute-path `dir` fails.

Only after inspecting fixture reports, regenerate the selected goldens:

```matlab
set(0,'defaultfigurevisible','off'); setup;
regenUnitFilter='u08-project-solar-station'; run('_verify/regenerate_golden.m');
```

From `octave-playground/`, follow RUNBOOK.md's order:

```text
python scripts/sync_harness.py
python scripts/rebuild-mount-from-vfs.py
npm run build
npm run lint
npm run preview -- --host 127.0.0.1 --port 4188
```

From `octave-playground/m0-spike-driver/`:

```text
node u08-project.js http://127.0.0.1:4188/
node u08-bar-probe.js http://127.0.0.1:4188/
```

The browser driver verifies route discovery, exact source/data preloading,
assignment guide, mounted checker hash, untouched/solved feedback, actual Run
File figures, camera PNGs, ZIP sources and figure documents, returning sessions,
edited-helper recovery, dynamic recommendation checks, and per-file reset.
Inspect both exported PNGs. Evidence files remain local.
The driver is strict by default. Setting `U08_RECOVER=1` permits one Stop/retry
per check after a known JSON or WASM-memory fault, and records the fault and
recovery separately. This is recovery verification, not an error-free run.

The pinned browser toolkit emits empty traces for native bar groups and patches.
A browser-only compatibility adapter reads the native rectangle geometry and
includes it in the existing Plotly figure, so percentage bars appear in saved
figures and PNG exports. Native handles and helper/grading behavior are retained.
See `octave-playground/src/kernel/octave/README.md` for scope and limitations.

The browser's existing intermittent malformed-JSON and WASM memory errors can
still interrupt startup or repeated executions. Preserve the driver evidence
when this happens; use Stop to restart the kernel or reload, then retry. A route
loading successfully does not prove the kernel or every subsequent run is healthy.
The project does not replace or upgrade the pinned xeus-octave runtime.

## Local verification record (2026-10-04)

Desktop Octave 11.3.0: all 28 mutation/alternative cases passed, both exact golden
reports matched (starter 0/12, reference 12/12), and all synthetic data/threshold,
empty-data, tie-order and existing-figure checks passed. The process exited 0.
TypeScript/production build and lint passed with existing repository/vendor
warnings. The final asset audit matched all three supplied files byte-for-byte
in harness, public starters and dist; both mounts contained the current checker
and no instructor fixtures. Instructor references remain git-ignored.

Final production-build browser workflow: starter Run File and 0/12 feedback,
reference Run File and 12/12 feedback, exact mounted checker/CSV hashes, both
readable camera PNG exports, ZIP/source downloads, per-file reset and returning
saved sources/figures passed. Returning reference feedback was also 12/12.
The strict-percentage mutation earned 10/12, the hard-coded recommendation 11/12,
and correction returned to 12/12. Each of those last three repeated checks hit
`memory access out of bounds` on its first attempt and passed after Stop/restart.
The recovery-enabled driver exited 0; this was not an uninterrupted clean-kernel
run. Earlier fresh/reloaded runs also encountered the known malformed-JSON error.
Do not report the upstream runtime limitation as fixed.

The focused bar probe passed native handle updates, negative values, clearing
and grouped rectangles without page errors. Both project PNGs were visually
inspected: complete labels, readable legend, visible bars and reference lines.

Deployment is not part of adding this project. Deploy app and harness together
using the existing dev-first workflow. The deployed dev site shares main's
kernel: a newly visible route alone does not establish that its checks are live.
