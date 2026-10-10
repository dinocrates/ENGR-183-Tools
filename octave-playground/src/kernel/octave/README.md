# Browser graphics compatibility

## PNG print and figure dimensions (Unit 9)

The WASM runtime has no Ghostscript. `print.m` intercepts only no-return-value
PNG calls on Plotly figures with a `.png` filename, `-dpng`, and optional numeric
`-r...`. It prints a handoff to Saved figures / PNG / camera with the requested
filename and explicitly states that no native file was written. It never
creates a placeholder image. Other devices/options and invalid calls go to the
original `print` for normal validation. Desktop Octave and downloaded student
scripts do not use this adapter. Browser downloads must be renamed to the
assignment's required filenames; final PNG quality is instructor review.

The existing title snapshot also carries figure pixel dimensions. The viewer
uses these until manually resized, and saved PNGs retain them. This supports
ordinary `set(gcf,'Position',[100 100 1000 700])` without crowding four-panel
labels into the toolkit's fixed 560-by-420 payload. No student-only commands
or helper dependencies are introduced.

Regression: `m0-spike-driver/u09-assignments.js` exercises the unmodified
reference print/Position calls and real camera exports; `t134-plot-title.js`
checks existing title/figure behavior. Native PNG printing is checked separately
in the private desktop reference directories.

## Titles

`title.m` fills a gap in xeus-octave 0.6.2's Plotly toolkit: the native
figure payload includes axis labels but omits the axes title object.

`graphicsCompatibility.ts` installs the shim at kernel startup (and restart), after saving
a handle to Octave's original `title`. The shim calls that original function,
so argument validation, explicit axes handles and the returned text handle
still belong to Octave. Property listeners publish title snapshots under a
private MIME type, keyed by the figure's `__plot_stream__` identifier.
`plotTitles.ts` merges those snapshots into native Plotly figures as paper
annotations, preserving the toolkit's existing legend annotations. Nothing
is added to the desktop grading harness or student files.

The bridge supports plain and multiline text, font size, color, bold/italic,
visibility, replacement/removal, and updates through the returned handle.
Titles stay centered above their axes during browser zoom and resize.
Custom title positions/rotation and TeX/LaTeX interpretation are not translated
by this bridge; their properties remain on the native Octave text object.

The WASM build lacks `jsonencode`, so the shim serializes its small fixed
payload directly and escapes JSON strings, including control characters.

Regression: build the app, serve it with `vite preview`, then run
`node m0-spike-driver/t134-plot-title.js http://127.0.0.1:4173/` from a working
directory where test PNGs may be written. The test runs the reported example,
exports a PNG, and checks updates, styling, subplots, legends, clearing,
multiple figures and `clear all` in the real browser kernel.

## Legend cleanup

The Octave 10.3.0 WASM kernel can defer `beingdeleted` property listeners
until its final `drawnow`, after the graphics handles have been destroyed.
Running a script with `close all` and a legend again can then report
`getappdata: H must be a scalar or vector of graphic handles` from
`legend>delete_legend_cb`, or crash while processing further stale callbacks.

At startup, `installLegendCompatibility.m` copies the bundled `legend.m` into the
browser's temporary graphics directory and adjusts its cleanup hooks and marker
visibility (described below).
The legend and its icons remove their property listeners synchronously through
`DeleteFcn`. Standalone callback files avoid a second WASM problem where a
callback cannot resolve legend's private helper functions during removal.
Legend creation, placement, rendering, and live updates still use Octave's
implementation. The installer checks each replacement's expected count so
kernel upgrades cannot silently omit part of the fix. No kernel archive,
desktop harness, or student script is modified.

Callbacks supplied with the initial `legend(..., 'DeleteFcn', callback)` call
are preserved. Replacing the legend's `DeleteFcn` afterward replaces the
browser cleanup hook too; code doing so must retain and call the old callback.

This is a fix for removing an already-rendered legend between runs. Separate
upstream problems remain when `cla` and replotting a legend, or creating and
closing several legends, happen in a single execution before the kernel has
flushed its graphics events. The former also crashes the unmodified bundled
kernel; simply guarding the reported `getappdata` call does not fix it.

Regression: `node m0-spike-driver/t140-legend-repeat.js http://127.0.0.1:4184/`
against a production build served by `vite preview`. It uploads a sample CSV
and runs the reported cooling example repeatedly in one kernel, then checks
legend removal, `clf`, multiple figures, custom callbacks, and Stop/restart.
The example uses `fprintf`, correcting the separate `fprint` typo in the report.

## Legend marker samples

Octave draws a line's legend sample using two objects: the main line and a
separate marker with `HandleVisibility = 'off'`. The Plotly toolkit traverses
handle-visible axes children, so it omits the marker entirely. Marker-only
entries therefore have a label but no sample; line-plus-marker entries lose
their marker too.

The compatibility installer exposes these auxiliary marker handles to the
toolkit. `__engr183_legend_children__.m` filters them back out of the three
places where `legend.m` reads its own children, using the native
`markertruesize` property to identify them. This preserves the text/icon pairs
expected by layout, item reuse, and the returned legend object handles.
Position, symbol, color, size, and property listeners still come from Octave;
no guessed trace-to-label matching or additional frontend drawing is needed.
New saved figure snapshots and PNG exports receive the same complete payload.
Previously saved figures need to be regenerated by running their source again.

Regression: `node m0-spike-driver/t141-legend-markers.js http://127.0.0.1:4184/`
runs the two-point load-sensor calibration and checks actual SVG markers,
saved figure reopening, PNG/ZIP exports, property updates, reordered
legends, horizontal placement, returned handles, recreation, and repeated runs.

## Bar rectangles

The pinned toolkit emits empty traces for native bar hggroups and their patches.
`bar.m` calls the saved native function, preserving its handles and multiple-output
geometry form. Property listeners publish the actual patch rectangles through
`__engr183_bar_snapshot__.m`. `plotBars.ts` matches the native axes domains and
adds Plotly bar traces below reference lines. Late geometry updates refresh the
existing figure; saved figures and PNG/ZIP exports receive those same traces.

The adapter covers ordinary vertical `bar` calls, grouped/stacked native rectangle
geometry, negative values, widths, bases, RGB colors, opacity and property updates.
It does not wrap `barh` separately. Per-vertex CData and interpolated colors are
not reproduced; flat/interpolated colors fall back to the axes palette. Native
Octave graphics objects are unchanged. The existing WASM JSON/graphics lifecycle
limitations described above remain.

Regression: `node m0-spike-driver/u08-bar-probe.js http://127.0.0.1:4188/`
checks actual rectangles, returned handles, changed ydata, negative values,
clearing and grouped bars. `u08-project.js` additionally checks the three project
percentages, native reference lines, saved figures and real PNG/ZIP downloads.
