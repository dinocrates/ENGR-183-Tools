Playwright/Node scripts used to produce `../M0-FINDINGS.md`. Scratch, not shipped code.

Requires the M0 spike site built and served locally (see M0-FINDINGS.md T0.1) at
`http://localhost:8000`. `npm install && npx playwright install chromium` first.

- `explore.js` — loads the REPL app, dumps interesting `window` globals and console
  logs. Used for initial T0.1/T0.3 exploration (kernel version banner).
- `console-driver.js` — `runCell(page, code)` helper that types Octave into the REPL's
  console prompt and reads back output. Run directly for the T0.2/T0.3/T0.5/T0.7 smoke
  tests (arithmetic, matrix ops, for-loop, function-in-cell, printf/fprintf,
  try/catch, `version()`, `evalc`, `plot`).
- `t04-harness.js` / `t04-solved-run.js` — T0.4, the harness-parity test: mounts
  `+engr183` at `/engr183` (via `jupyter_lite_config.json`, see M0-FINDINGS.md) and
  runs `engr183.runTests('unit00')` unsolved and solved.
- `t06-coldload.js` — T0.6: measures total bytes fetched and time-to-kernel-ready, both
  unthrottled and under Chrome's "Fast 3G" emulation.
- `t08-final.js` — T0.8: creates and edits a `.m` file through the real file-browser +
  editor UI (not the build-time mount) and confirms the kernel picks it up live.
- `driver-entry.js` / `t09-rawws.js` — T0.9: two different attempts to drive a kernel
  from *outside* the site's own JS bundle (a fresh `@jupyterlab/services` client, and a
  raw WebSocket to the app's own kernel id). Both fail — see M0-FINDINGS.md T0.9 for
  why, and what it means for M1.

## T1.4 (M1 kernel session wrapper spike)

Requires `octave-playground` built and served locally (`npm run build && npm run
preview -- --port 5183`), with `public/xeus/` populated (`scripts/build-kernel-assets.sh`).

- `t14-spike.js` — first pass: start the kernel, check status only.
- `t14-full.js` — start the kernel and execute `1+1`, checking real output.
- `t14-netdebug.js` — traces every `/xeus/`-ish network request/response, used to find
  two upstream `@jupyterlite/xeus` + Vite bugs (see `../src/kernel/session.ts`'s header
  comment and `../scripts/vendor-worker-assets.mjs`): a hardcoded `{type: 'module'}`
  Worker option that breaks Emscripten's `importScripts()`-based glue (patched via
  `../patches/`), and two binary assets (`libz.so`, `unpack-*.wasm`) that Vite
  references by hashed URL but never actually copies into the build output.
- `t14-harness-run.js` — the full loop: write unsolved-stub Octave source directly into
  the mounted `/engr183/assignments/unit00/` path in the kernel filesystem, then run
  `engr183.runTests('unit00')` — validates the "write dirty buffers to the VFS, then
  execute" pattern DESIGN.md §4.2 and T1.5 (file bridge) depend on.

## T1.5-T1.7 (real UI: file bridge, File Browser/Editor, Command Window/Toolbar)

Same serving setup as T1.4 above.

- `t16-app.js` — loads the real app, screenshots it once the kernel reports ready.
- `t16-runtests.js` — clicks Run Tests against the unsolved starters, checks the
  report shown in the Command Window.
- `t16-solve-all.js` — types real solutions into all three files via the actual Monaco
  editor (tab-switching included), clicks Run Tests, expects 30/30.
- `t16-persist.js` — edits a file, reloads the page, confirms the edit is still there
  (`files.ts`'s `BrowserStorageDrive`-backed persistence).
- `t16-final-screenshot.js` — same as `t16-solve-all.js`, saved for a clean reference
  screenshot rather than debugging.

Note: `files.ts`'s `buildWriteFilesCode` originally used `base64_decode` to get file
content into the kernel without Octave string-escaping issues. That approach is
abandoned — `base64_decode` is broken in this xeus-octave build (fails even round-
tripping Octave's own `base64_encode` output, confirmed directly against the kernel).
It now writes raw `uint8` byte arrays via `fwrite` instead.
