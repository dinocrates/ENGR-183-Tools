# Unit 6 plotting assignments

This document records implementation and local verification; deployment status is
reported by the repository's GitHub Pages workflow.

| Item | Route ID | Editable MATLAB script | Camera download name |
| --- | --- | --- | --- |
| GP-06 | `u06-gp06-cooling` | `U06_GP06_CoolingPlots.m` | `GP06_cooling_comparison.png` |
| APA-06 | `u06-apa06-battery-discharge` | `U06_APA06_BatteryPlots.m` | `APA06_battery_comparison.png` |

Canvas links, once this code and its harness are deployed together:

- https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u06-gp06-cooling
- https://dinocrates.github.io/ENGR-183-Tools/octave-playground/?unit=u06-apa06-battery-discharge

The assignment source and pristine unsolved fixtures contain the supplied starters
verbatim. Each entry has one editable file with embedded data and no `dataFiles`.
Solutions stay in git-ignored directories under `_verify/solved/`, which
`sync_harness.py` does not publish. They remain instructor-only local files and
are not committed to this public repository. Full Unit 6 fixture verification
requires those local solutions; CI skips Unit 6 when they are absent.
Existing metadata discovery, saved-file seeding, source download, camera export,
and confirmed reset flows are reused without migrations or saved-file overwrites.

## Feedback and coverage

Both spec builders reset their unit's snapshot explicitly. The first criterion
that needs execution runs the script in a disposable function workspace using
`source`, preserving source filename/line error feedback. The student's `clear`
cannot erase the cache or cleanup objects. Remaining criteria use copied numeric,
stdout, and graphics properties from that single run, including after a failure.
The completed figure remains available; inspection never activates a figure.
Before a new execution, old figures are deleted by handle (Octave's `close`
reactivates figures). No polling, sleeps, external data I/O, or kernel PNG export
are part of the checker.

All ten criteria are supported by the current browser graphics API. A focused
browser probe confirmed axes positions, line X/Y data, styles/markers/colors,
titles, labels, X/Y grid properties, limits, and legend `__peer_objects__` paired
with legend strings. Legends/colorbars are excluded from plotting-axis counts.
Series are matched using every actual X/Y sample, and axes are ordered by their
position. Row and column vectors are equivalent; nonfinite values and matrices
are rejected. The reference accepts endpoints or a constant sampled vector.

Both untouched starters earn **2/10** (valid execution and given data). Solved
fixtures earn **10/10** code-check feedback. The Unit 6 report explicitly separates
this feedback from Canvas and does not say a full automated score proves the
submission is complete. Existing units retain their report wording.

Graphics checks cannot prove PNG rendering/readability or semantic quality of
titles, interpretation, and claims. On a toolkit without reliable legend
associations, the checker reports that visual review is needed; it does not
silently pass the association. The tested browser supports this inspection, so
its advertised maximum is ten.

## Reproduce verification

Use desktop Octave from `engr183-harness/`, one unit at a time. The local run used
Octave 11.3.0 with invisible desktop figures to avoid opening desktop windows.

```matlab
set(0, 'defaultfigurevisible', 'off');
setup;
runUnitFilter = 'u06-gp06-cooling';  % repeat in a fresh process for APA's ID
run('_verify/run.m');
addpath('_verify');
regression_u06('gp');              % 'apa' for the other assignment
```

`regression_u06` uses the shared `u06-cases.json` mutations, restores the exact
incoming assignment source even if an assertion fails, checks one execution per
invocation with a root-appdata counter, records elapsed seconds, and checks the
two existing golden reports without rewriting them. The cases cover incorrect
interior values, matrix shapes, time indices, missing/wrong references, swapped
legends/styles/panels, extra figures, absent titles/units/panels, clipped limits,
missing output, runtime errors, valid alternatives, and recovery after edits.

Generate golden files only after reviewing the results:

```matlab
regenUnitFilter = 'u06-gp06-cooling';  % repeat for APA's ID
run('_verify/regenerate_golden.m');
```

On native Windows, set `COPYCMD=/Y` in the **verification process** environment
before using the runbook's existing copyfile-based scripts; this Octave build
otherwise prompts while copying over fixture files. The focused regression
writes/restores its single file directly and does not need this setting.

From `octave-playground/`, after desktop verification has finished restoring
starters (do not sync concurrently with fixture mutation):

```text
python scripts/sync_harness.py
python scripts/rebuild-mount-from-vfs.py
npm run build
npm run preview -- --host 127.0.0.1 --port 4186
```

Use Node 24 (the CI version). The Windows mount-only rebuild assumes the kernel
packages are already present, as documented in the root runbook. The browser
driver verifies SHA-256 of `/engr183/tests/u06_plot_check.m` against the local
source, as well as resolving the unit-specific spec function. A new starter alone
does not establish that the new checker is mounted; deployed dev reuses main's
kernel until main is updated.

From `octave-playground/m0-spike-driver/`:

```text
node u06-assignments.js gp http://127.0.0.1:4186/
node u06-assignments.js apa http://127.0.0.1:4186/
node u06-graphics-probe.js http://127.0.0.1:4186/
```

Each command starts a fresh browser context. It checks the exact preloaded starter,
baseline score, mounted checker hash, real Run File output, rendered panel text,
camera PNG download, saved-source reload, canceled and confirmed Reset File, and
preservation of another file. It then runs mutations consecutively, verifies the
specific failing criteria and one-execution counter, and records wall time.
Its 60-second completion check has not been increased to conceal kernel hangs.
Camera exports and screenshots stay local under the driver directory.

`U06_BROWSER_MODE=isolated` explicitly reloads the page/kernel before **each**
mutation. This diagnostic mode measures graphics/grading compatibility, **not**
consecutive-run reliability or cache freshness. `U06_CASE_FILTER` optionally
selects mutation names by regex. Evidence filenames include the mode.

## Manual Canvas review

Keep the existing rubric: Directions 30%, Compilation/syntax 15%, Runtime/input-output
30%, Correctness 25%. Canvas supplies totals and due dates.

- Review source calculation methods: element-wise multiplication for APA, final
  element indexing for both, and absence of hard-coded answers. Matching arrays
  alone do not prove those methods; no brittle source-pattern checks award credit.
- Evaluate GP's 2–3 sentences and APA's 50–100 words for numerical evidence,
  threshold reasoning, and a limitation. No interpretation keyword or word-count
  points are awarded, and starter instructions are never counted as an explanation.
- Distinguish a first supplied sample strictly beyond a threshold from an exact
  between-sample crossing time. No named cutoff-index variables are required.
- Inspect the downloaded PNG for both panels, visible data, readable text/legends,
  appropriate scale, and readable line widths. Exact GP widths and APA colors,
  legend locations, titles, and particular inclusive Y limits are not required.
- Check the two required filenames and complete `.m` plus PNG submission. The
  camera and source download are separate actions; rename the camera download to
  the assigned PNG filename. Run Tests neither submits to Canvas nor requires a
  PNG inside the kernel filesystem.

## Local verification record

Desktop: both targeted runbook starter/solved checks passed (2/10 and 10/10).
The 22 GP and 26 APA regression cases passed, including exactly one script
execution per invocation, repeated calls, changed values, and recovery after a
runtime error. The four generated golden reports were inspected for their
criterion results, baseline/full scores, and Canvas separation wording.

Browser: both direct links loaded their exact starters and scored 2/10. Both
solved examples rendered one figure with two titled/labeled panels, exported
560-by-420 PNGs through the actual camera, and scored 10/10 in completed initial
Run Tests invocations. Both PNGs were visually inspected. Verification used the
locally rebuilt mount, not deployed dev's shared main mount.

**Open browser blocker:** consecutive Run Tests calls can print a complete 10/10
report but then fail to return to Ready within 60 seconds, with
`getappdata: H must be a scalar or vector of graphic handles` from
`legend>delete_legend_cb` and a new figure left at Rendering. This was reproduced
for both GP and APA. Direct figure deletion, ordered legend deletion, and removal
of departing legend teardown listeners did not resolve it; the unsuccessful
legend workarounds are not shipped. No renderer, title shim, execution control,
or execution limit was changed. A printed report alone is not a passing browser
completion check. Consecutive browser freshness/completion remains unverified
until this kernel lifecycle problem is fixed; the sequence driver intentionally
fails on it. A separate temporary `drawnow` flush experiment also failed and was
not shipped.

Final isolated browser diagnostics (fresh kernel for each mutation):

| Verification | GP-06 | APA-06 |
| --- | --- | --- |
| Desktop regression cases / golden reports | 22/22; both match | 26/26; both match |
| Completed browser mutation checks | 21/22 | 24/26 |
| Browser cases failing completion | Missing panel | Different valid presentation; missing panel |
| Desktop solved Run Tests elapsed | 2.983 s | 3.507 s |
| Completed browser solved Run Tests elapsed | 17.983 s | 21.437 s |
| Completed browser mutation elapsed range | 10.496–21.122 s | 12.957–26.126 s |

Each completed mutation check confirmed exactly one student execution. Browser
timings include file synchronization, feedback and return to Ready; timeout cases
are excluded from the successful timing ranges and explicitly remain failures.
The valid alternate APA presentation printed 10/10 but failed completion.
The missing-panel runs printed 1/10 after a browser legend-deletion runtime
error (desktop correctly reports 4/10 for GP and 5/10 for APA), then failed
completion. WASM `memory access out of bounds`
errors were also observed, and one GP diagnostic page reload failed startup.
These are additional browser blockers, not failing MATLAB solutions and not
grounds to narrow the APA style/limit contract. Isolated runs were split into
recorded initial and filtered continuation sessions after these failures; they
are not a claim of one fully passing browser suite.

Both assignments passed saved-source reload, canceled/confirmed Reset File,
preservation of another file's content, and navigation to the other Unit 6 entry
and back with fresh 2/10 starter feedback. The explicit legend-handle ordering
probe passed. Raw JSON reports, browser-error messages, screenshots, and camera
PNGs remain local in `octave-playground/m0-spike-driver/u06-*` and the two named
PNG files. Monaco's `Canceled` navigation diagnostics are retained separately
from execution failures; memory errors and timeouts fail verification.

The final harness was synced, its mount repacked, and the app rebuilt with Node
24. Build and lint exited successfully (lint warnings were in existing files).
Both public and built starters match source byte-for-byte, and instructor
fixtures are absent from the mount. The browser-verified checker SHA-256 is
`c1fa2e3f3f99dffbfbeb392966fb05aeebee9cb3e9aa47fd19c74d0580aaa4a2`.
An existing Unit 1 report also matches its previous golden after normalizing
Windows checkout line endings; no unrelated golden files were regenerated.

These results were collected locally before deployment. Resolve the browser
graphics/completion failures and rerun the consecutive and full browser checks
before treating Unit 6 as ready for student use. A successful Pages deployment
does not establish that those browser failures are resolved.
