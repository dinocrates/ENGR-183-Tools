# Browser graphics compatibility

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

At startup, `installLegendCleanup.m` copies the bundled `legend.m` into the
browser's temporary graphics directory and replaces only its cleanup hooks.
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
