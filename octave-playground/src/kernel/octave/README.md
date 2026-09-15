# Browser graphics compatibility

`title.m` fills a gap in xeus-octave 0.6.2's Plotly toolkit: the native
figure payload includes axis labels but omits the axes title object.

`session.ts` installs the shim at kernel startup (and restart), after saving
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
