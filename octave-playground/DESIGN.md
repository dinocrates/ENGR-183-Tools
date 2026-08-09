# ENGR-183 Octave Playground — Design Document

**Status:** Draft for implementation
**Owner:** Stephen Hamrick, MSJC
**Implementer:** Claude Code
**Target repo:** `dinocrates/ENGR-183-Tools`, path `octave-playground/`
**Deploy target:** GitHub Pages. Reached from Canvas via a link/module item that opens in a new tab — **not** an iframe embed (see T4.1: iframe embedding is architecturally impossible here, discovered and reverted during T4.1's own verification work).

`ENGR-183-Tools` is a monorepo hosting multiple course tools (this playground, visualizers, calculators, graphing tools). Everything below that refers to "the repo" or gives root-relative paths (`src/`, `starters/`, `.github/workflows/`, etc.) means `octave-playground/` within that monorepo, not the repo root — see §6. The multi-tool GitHub Pages layout (shared workflow, URL structure, whether tools share a build step) is an open question deferred to T1.1; M0 has no deploy step and isn't blocked by it.

---

## 1. Context

ENGR-183 (Programming with MATLAB for Engineers and Scientists) is a fully asynchronous online course. MATLAB licenses were not ordered before the term, so the course runs on **GNU Octave**. 32 enrolled, 20 waitlisted.

Students install Octave locally in Week 1. This project is **not** a replacement for that install — it is the fallback and the consistency layer:

- Students on Chromebooks, locked-down work machines, or tablets who cannot install
- Students whose install breaks mid-semester
- Embedded per-unit exercises inside Canvas pages, zero friction
- A known-good environment for reproducing "it works on my machine" reports

A working rubric harness exists at `engr183-harness/` (`+engr183` package, a sibling top-level folder in this monorepo — see §9.3), verified locally under Octave 11.3.0 — not yet against the 8.4 students actually install; see M0-FINDINGS.md T0.3. **That harness is the contract.** This project wraps it in a browser runtime. It does not reimplement it.

## 2. Prior art — the CSIS-118B NASM playground

Last semester's x86-64 NASM playground is the model. Feature parity target:

| NASM playground | ENGR-183 equivalent |
|---|---|
| Browser IDE, no install | JupyterLite + xeus-octave (WASM) |
| Custom `csis118b.inc` library on include path | `+engr183` package mounted into kernel VFS |
| Preloaded starter code per assignment | Per-unit `.m` starter files seeded into the drive |
| Built-in unit tests, immediate feedback | `engr183.runTests('unitNN')` |
| MSJC branding | Custom JupyterLab theme, dark blueprint |
| GitHub Pages hosting | Same |
| — (new) | Persistence + export, reset-to-starter |

**Confirmed by inspecting the actual repo (`dinocrates/x86-64-CSIS-118`, `webapp/src/`)
during M1 planning:** its runtime — `blink`, a general x86-64 emulator compiled to WASM,
bound via raw memory-struct access, with a bespoke sentinel-injection test harness — is
architecturally unrelated to JupyterLite + xeus-octave and not something to replicate,
in runtime or in UX. M1's UI instead mirrors the actual GNU Octave desktop GUI as
closely as possible (Command Window, Editor, file browser) — see §4 and M1's plan.

## 3. Goals and non-goals

### Goals

1. A student opens a URL and is running Octave in under 60 seconds, no install, no account.
2. Each unit opens with its `.m` starter files already present, the problem statement visible, and Run Tests working immediately.
3. `engr183.runTests('unitNN')` produces **byte-identical rubric output** to local Octave. Same harness, same result. No second standard.
4. Student work survives a browser refresh and can be exported as `.m` files for Canvas submission.
5. Reachable from a Canvas link/module item that opens in a new tab. Not iframe-embedded — see T4.1: the app can never be `crossOriginIsolated` inside a cross-origin iframe (that requires the *top-level* page to send COOP/COEP, which Canvas doesn't and can't be made to), so an iframe embed silently falls back to a broken code path. A new tab is its own top-level browsing context, which sidesteps the problem entirely rather than working around it.
6. Instructor can add a new unit by dropping in files and rebuilding — no code changes.
7. **The browser environment matches the local one.** Students edit `.m` files, one function per file, in a unit folder — the same mental model, the same filenames, and the same files they submit to Canvas. No notebooks, no cells, no Jupyter vocabulary anywhere in the student-facing product.

### Non-goals

- **Not an autograder.** No submission, no grade passback, no LTI. Students still submit files to Canvas. Grading stays local.
- **Not an authentication system.** No accounts, no server-side state, no PII. Anonymous, client-side only.
- **Not a MATLAB emulator.** Where Octave and MATLAB diverge, we teach the portable subset and flag differences in course material.
- **Not the primary environment.** Local Octave is primary. This is the fallback.

## 4. Architecture

The student sees files. There is no notebook UI anywhere in the product. The UI mirrors
the real GNU Octave desktop GUI as closely as possible — same panel names, same default
arrangement — so a student who has only used desktop Octave recognizes it immediately:

```
GitHub Pages (static, no server)
└── octave-playground  (Vite + React + TypeScript app)
    ├── UI shell — modeled on the actual Octave desktop GUI
    │   ├── File Browser (left)     assignments/unit03/  →  addTwo.m, circleArea.m …
    │   ├── Editor (top-right)      Monaco, one tab per .m file, tabbed like Octave's own
    │   ├── Command Window (bottom-right)   rubric report + Octave stdout
    │   └── Toolbar                 Run Tests · Run File · Reset · Download
    │
    ├── @jupyterlite/services  ──►  JupyterLite kernel manager
    │                               └── xeus-octave (WebAssembly)
    │                                   └── Emscripten virtual filesystem
    │                                       ├── /engr183/+engr183/   harness (build-time mount, read-only)
    │                                       ├── /engr183/tests/      specs (build-time mount, read-only)
    │                                       └── /drive/unitNN/*.m    student files (IndexedDB-backed)
    │
    └── No notebook. No cells. No Jupyter chrome.
```

We use JupyterLite for its kernel plumbing — the WASM build, the kernel lifecycle, the contents drive — and discard its frontend entirely. Kernels are driven directly through `@jupyterlite/services`, imported into our own app bundle, by sending execute requests and reading the reply stream (see M0-FINDINGS.md T0.9 for why it has to be built in from app-startup rather than attached after the fact).

### 4.1 Why files, not notebooks

Students install Octave locally in Week 1, write one function per `.m` file, and submit those files to Canvas. A notebook UI diverges from that model in ways that surface constantly: cells are not files, cell execution order is not script order, and error messages reference cell indices that do not exist on the student's disk.

Making a notebook *look* like files was considered and rejected. A disguise has to hold everywhere — every error message, every keyboard shortcut, every autosave prompt — and the first leak costs more trust than the mismatch would have. Since the kernel already exposes a real filesystem, the files can simply be real.

This also simplifies two downstream features. **Export** becomes a direct download of the exact files the kernel ran, with no packaging step and no chance of divergence. **Reset** becomes a file copy.

### 4.2 Execution model

- **Run Tests** — write dirty buffers to the VFS, then execute `engr183.runTests('unitNN')` and stream stdout into the console pane verbatim. The rubric report is rendered as plain preformatted text, exactly as it appears in a local terminal. No re-parsing, no custom rendering, no second presentation of the same data.
- **Run File** — write dirty buffers, then execute the active file as a script for quick experimentation.
- **Kernel restart** — offered when the kernel wedges (infinite loop, `input()` call). Student files are untouched by a restart because they live in the contents drive, not kernel memory.

## 5. Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | `xeus-octave` compiled to `emscripten-wasm32` | Only maintained path to real Octave in-browser |
| Frontend | Vite + React + TypeScript + Tailwind, Monaco editor | Matches the actual sibling-tool stack (`web-demos`, `engr-120-tools`); full control over the file-based UI |
| Kernel plumbing | JupyterLite + `@jupyterlite/services` | Kernel lifecycle and contents drive without the notebook frontend. M0/T0.9: must be imported into our own app bundle at startup, not attached externally after the fact — a bare `@jupyterlab/services` client doesn't work against a running jupyterlite site |
| Package source | `emscripten-forge-dev` + `conda-forge` | Where the WASM build is published |
| Build tool | `jupyterlite-xeus` (PyPI, 4.0.5) | Handles env solve + VFS mounting |
| Hosting | GitHub Pages via Actions | Matches existing course tooling |
| Persistence | JupyterLite contents drive (IndexedDB) | No server; accept the limits, mitigate with export |

### Known risks — read before starting

**R1 — the WASM kernel may not be production-ready.** `xeus-octave` for `emscripten-wasm32` sits at 0.6.2 on the **dev** channel (`emscripten-forge-dev`), and the listing was roughly nine months stale when surveyed. It is not on the stable channel. This is the single largest risk in the project and is why M0 exists as a hard gate.

**R2 — Octave version skew.** Students install Octave 8.4+ locally. The WASM build is whatever version xeus-octave pinned. If the harness or student code hits a behavioral difference, the "identical output" guarantee in Goal 3 breaks. M0 must record the WASM Octave version and diff it against 8.4.

**R3 — bundle size and first load.** A full Octave WASM build is large. On a phone or rural DSL this could be a multi-minute first load. Measure it in M0; if it's bad, that changes the Canvas embedding strategy (lazy load behind a click, not an autoloading iframe).

**R4 — plotting is unproven.** Native Octave graphics under Emscripten may not work at all. Units 8+ involve plotting. If plots don't render, this playground cannot cover the back half of the course and its scope narrows to Units 0–7.

**R6 — the contents-drive-to-kernel bridge is load-bearing.** The file-based design assumes files written to the JupyterLite contents drive are visible to the xeus-octave kernel's filesystem. If that bridge does not work, every student edit must instead be pushed into the VFS by generating and executing Octave file-writing code before each run — workable, but slower and more fragile. Verify in M0 (T0.8).

**R5 — IndexedDB is not durable.** Clearing browser data destroys student work. Mitigated by prominent export, never by promising persistence.

### Fallbacks if M0 fails

- **F1:** Server-side Octave via JupyterHub/Binder. Real infrastructure cost and maintenance, but a known-good runtime.
- **F2:** Ship local Octave only. The harness already works today; this project is shelved. Acceptable outcome — the course is not blocked on it.
- **F3:** Raw `rwl/octave-wasm` with a custom Vite shell. Much more work, no Jupyter layer, but full control.

## 6. Repository layout

This project lives at `octave-playground/` inside the `ENGR-183-Tools` monorepo, alongside sibling tools (visualizers, calculators, graphing tools — each in their own top-level folder) and alongside `engr183-harness/`, the source-of-truth `+engr183` package students run locally under plain Octave. Everything below is relative to `octave-playground/` unless noted:

```
ENGR-183-Tools/
└── octave-playground/
    ├── .github/build-environment.yml    # the *build tool* env (jupyterlite-xeus itself) -- not the kernel
    ├── environment.yml                  # kernel env spec (pinned, T1.3)
    ├── jupyter_lite_config.json         # mounts, addon config
    ├── src/                             # the Vite + React + TS application
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── kernel/                      # @jupyterlite/services wrapper
    │   │   ├── session.ts               # start, restart, execute, stream stdout
    │   │   └── files.ts                 # contents drive <-> editor buffers
    │   ├── components/                 # named after their real Octave GUI counterparts
    │   │   ├── FileBrowser.tsx          # left panel
    │   │   ├── Editor.tsx               # top-right, Monaco, tabbed
    │   │   ├── CommandWindow.tsx        # bottom-right
    │   │   └── Toolbar.tsx
    │   ├── units/                       # per-unit metadata (id, title, description, file list)
    │   │   └── unit01.json
    │   └── styles/                      # MSJC dark blueprint tokens (Tailwind)
    ├── public/
    │   ├── starters/                    # seed files fetched at runtime to seed the drive per unit
    │   │   └── unit01/  U01_OctaveSetupCheck.m
    │   └── xeus/                        # kernel assets, built not committed (T1.3/T1.4)
    ├── vfs/                             # build-time mount into kernel FS
    │   └── engr183/
    │       ├── +engr183/                # harness — VENDORED, see below
    │       └── tests/
    ├── scripts/
    │   ├── sync_harness.py              # pull harness from ../engr183-harness
    │   ├── build-kernel-assets.sh       # runs jupyter lite build -> public/xeus/
    │   ├── vendor-worker-assets.mjs     # Vite/@jupyterlite/xeus asset workaround, see T1.4
    │   └── new_unit.py                  # scaffold a unit
    └── DESIGN.md
```

`.github/workflows/pages.yml` actually lives at the `ENGR-183-Tools` repo root, not here — GitHub only triggers workflows defined at the repo root. It's `paths`-filtered to `octave-playground/**` and `engr183-harness/**`, and handles the full pipeline: sync harness, `npm ci`, build kernel assets, `vite build`, assemble into `_site/octave-playground/`.

Note the split between `vfs/` and `public/starters/`. The harness and test specs are **build-time mounts** — read-only, identical for every student, never editable. Starter files are **seeds** the app fetches at runtime to seed the student's writable contents drive on first visit to a unit. Students can break their own files freely; they cannot break the harness or edit the tests.

**On vendoring the harness:** `vfs/engr183/` is a *copy* of `../engr183-harness/` (`+engr183/` and `tests/`), and `public/starters/` is a copy of `../engr183-harness/assignments/`, both synced by script, never hand-edited. The source of truth is `engr183-harness/` — same monorepo, own top-level folder, so it stays independently clone/download-able for students who never touch the browser (§9.3). If the two drift, students get different rubric results in browser vs. local, which destroys the core guarantee. `sync_harness.py` must fail loudly on local modification.

**Getting the real GitHub Pages deploy working (not just `npm run preview`) surfaced three bugs every prior local test was structurally blind to:**

1. `scripts/build-kernel-assets.sh` was committed without the executable bit (created on Windows) — `ubuntu-latest` got exit 126. Fixed the bit and, as defense in depth, the workflow now invokes it via `bash scripts/...` regardless of the bit.
2. Kernel asset URLs resolved to the domain root instead of the actual deployed subpath. Root cause: something in the jupyterlite/jupyterlab import graph reads `@jupyterlab/coreutils`'s `PageConfig` at module-init time, before any of our own code runs — and `PageConfig` memoizes on first read, permanently locking in an empty `baseUrl`. Local dev serves from origin root, where a missing baseUrl and the correct one are indistinguishable, so this was invisible until actually deployed under `/ENGR-183-Tools/octave-playground/`. Fixed by injecting the config via an inline script in `index.html`, before the module script tag, so it always wins the race.
3. With that fixed, the kernel booted but every Run Tests/Run File failed with `unable to find current directory`. Root cause: GitHub Pages can't set custom response headers, so the page never becomes `crossOriginIsolated`, which forces `@jupyterlite/xeus` onto its `comlink.worker.js` transport instead of `coincident.worker.js` (SharedArrayBuffer-based) — every prior test in this project, including all of M0 and M1's local verification, had only ever exercised the `coincident` path (`vite preview` sets COOP/COEP directly). Fixed by vendoring `public/coi-serviceworker.js` (gzuidhof/coi-serviceworker, MIT, unmodified), loaded first in `index.html`: it injects COOP/COEP on the page's own responses via a service worker and reloads once to pick them up.
4. That fix was itself intermittent: the vendored script only ever attempts one reload per session (its own `shouldRegister()` guard), and on some timing that reload doesn't land on a load the service worker actually controls — confirmed live, `navigator.serviceWorker.controller` stayed `false` and the main document's own response never got COOP/COEP even though the registration showed `active`. It then silently gives up for the rest of the session. Fixed with a small guarded retry in `index.html`: if still not isolated ~1.5s after load, force one more reload ourselves, once (sessionStorage-guarded, so an environment that fundamentally can't isolate doesn't loop — it just falls back to `comlink.worker.js`, which is at least a defined, if broken, failure mode rather than a silent hang). Verified with 5 repeated fresh-profile runs live, all isolated and all passing.

Both service-worker fixes share one visible side effect worth carrying into M3 polish: a genuinely first-ever visitor sees one (occasionally two) automatic page reloads a couple seconds in, before the kernel starts for real. Not explained anywhere in the UI yet — a bare reload with no context could look like a glitch to a student.

**Dev/staging environment.** Local `npm run preview` has repeatedly failed to catch bugs that only show up on the real deployed site (the four bugs directly above are all examples) — so "test locally before pushing to main" was never a complete safety net for this project. `.github/workflows/pages.yml` now builds and deploys *both* `main` and a `dev` branch on every run, regardless of which one triggered it, publishing `main` to the real student-facing `octave-playground/` path and `dev` to a separate `octave-playground-dev/` path in the same deploy. GitHub Pages via `deploy-pages` publishes one full-site snapshot per deploy — building both refs every time is what keeps a `dev` push from ever silently wiping out `main`'s last published output (or vice versa). Kernel assets (the slow part — the Octave WASM build) are built once from `main`'s pinned `environment.yml` and reused for `dev`'s build too, so staging only varies the thing actually being staged (app code), not the kernel environment as well.

Two real setup issues surfaced getting this working, worth remembering if it's ever rebuilt from scratch:
1. `build-kernel-assets.sh`'s own last step calls `vendor-worker-assets.mjs`, which reads `node_modules/@emscripten-forge/mambajs-core` — it must run *after* `npm ci`, not before. Confirmed by reproducing the exact CI failure locally in WSL (no `gh` CLI available and GitHub's Actions log UI is client-rendered enough that `WebFetch` couldn't extract per-step detail, so direct reproduction was the reliable path).
2. The `github-pages` deployment environment has a branch protection rule, set by default when Pages is first configured, that only allows the original source branch to deploy to it. `dev`'s build succeeded but its deploy was rejected until `dev` was added under **Settings → Environments → github-pages → Deployment branches and tags**.

Also: an `--allow-empty` commit does not trigger this workflow. The `paths:` filter only matches pushes that actually touch matching files, so an empty commit is invisible to it — needed a trivial real change to retrigger during testing.

## 7. Milestones

- **M0 — Feasibility spike (GATE). DONE.** Prove the kernel works. See `M0-FINDINGS.md` — recommendation: proceed to M1, no scope cuts.
- **M1 — Minimum viable playground. DONE.** Unit 1, harness running, verified end to end both locally and live on GitHub Pages at `dinocrates.github.io/ENGR-183-Tools/octave-playground/` (30/30, byte-identical report, confirmed reliable across 5 repeated fresh-profile runs). Getting the real deploy working surfaced four production-only bugs invisible in local testing — see the note below §6.
- **M2 — Course content.** All units, scaffolding tooling.
- **M3 — Student experience.** Persistence, export, reset, branding.
- **M4 — Canvas integration.** Embedding, per-unit deep links.

---

## 8. Tickets

### M0 — Feasibility spike (GATE) — DONE

> **Do not start M1 until M0 is complete and the go/no-go is recorded.** Every downstream ticket assumes the kernel works. If it doesn't, we want to know in a day, not a fortnight. Timebox: 1 day.

**Complete — see `M0-FINDINGS.md` for the full per-ticket writeup.** T0.1–T0.9 all done; recommendation is to proceed to M1 with no scope reduction. Two new, non-blocking findings surfaced: native Windows can't run the build (needs WSL2/CI), and the harness prints two extra cosmetic warnings under WASM worth suppressing.

**T0.1 — Stand up a bare JupyterLite + xeus-octave build**
Build locally from the `jupyterlite/xeus-lite-demo` template. `environment.yml` targets `emscripten-forge-dev` and `conda-forge`, dependency `xeus-octave`.
*Acceptance:* `jupyter lite build` completes; site serves locally; an Octave kernel appears in the launcher.

**T0.2 — Verify the kernel executes**
Exercise: arithmetic, matrix ops, a `for` loop, a `function` defined in a file, `printf`/`fprintf`, `error()` and try/catch.
*Acceptance:* All execute correctly. Record failures verbatim in `M0-FINDINGS.md`.

**T0.3 — Record the Octave version (R2)**
Run `version()` in the kernel.
*Acceptance:* Version recorded in `M0-FINDINGS.md` alongside the locally-installed 8.4. Note any major-version gap explicitly.

**T0.4 — Mount and run the real harness (the critical test)**
Mount `+engr183`, `tests/`, and `assignments/unit01/` via `--XeusAddon.mount`. Run `engr183.runTests('unit01')` with (a) unsolved stubs and (b) correct solutions.
*Acceptance:* Report output is **character-for-character identical** to local Octave 8.4 for both cases. Any diff is documented. This ticket is the whole project in miniature — if it fails, nothing else matters.

**T0.5 — Verify `evalc` under WASM**
The harness depends on `evalc` to capture student stdout. Confirm it captures output and assigns results in the kernel.
*Acceptance:* Confirmed working, or documented as broken with a proposed workaround.

**T0.6 — Measure bundle size and cold load (R3)**
Total deployed size; cold-load time on throttled Fast 3G and on desktop broadband.
*Acceptance:* Both numbers in `M0-FINDINGS.md`. Flag if cold load exceeds 30s on throttled.

**T0.7 — Test plotting (R4)**
`plot([1 2 3],[4 5 6])`, `figure`, `xlabel`, `hold on`. Try any available graphics toolkits.
*Acceptance:* Documented as working, partially working, or broken. If broken, note that project scope narrows to Units 0–7.

**T0.8 — Verify the contents drive reaches the kernel filesystem (R6)**
Write a `.m` file through the JupyterLite contents API, then from the kernel confirm the file exists, is on the path, and is callable. Then modify it and confirm the kernel sees the new version without a restart.
*Acceptance:* Round trip works, or documented as broken with the fallback (generate Octave `fopen`/`fprintf` writes) costed out. This gates the entire file-based UI.

**T0.9 — Drive a kernel headlessly via `@jupyterlab/services`**
Minimal script: start a kernel, send an execute request, capture the stdout stream. No notebook UI involved.
*Acceptance:* Arbitrary Octave executes and stdout is captured programmatically. This proves the notebook frontend is genuinely optional.

**T0.10 — Go/no-go writeup**
Summarize T0.1–T0.9 into a recommendation: proceed to M1, proceed with reduced scope, or fall back to F1/F2/F3.
*Acceptance:* `M0-FINDINGS.md` ends with an explicit recommendation and rationale. **Stop here and wait for Stephen's decision.**

---

### M1 — Minimum viable playground

**T1.1 — Repo scaffold and CI**
Layout per §6, under `octave-playground/` in the `ENGR-183-Tools` monorepo. Vite + TypeScript app. Decide and implement the multi-tool Pages strategy: a workflow at the monorepo root, `paths`-filtered to `octave-playground/**`, that builds this tool into its own subdirectory of the published site (e.g. `/octave-playground/`) without clobbering sibling tools' output.
*Acceptance:* Push to main touching `octave-playground/**` publishes a working site at `<pages-url>/octave-playground/`, and does not disturb other tools already on Pages.

**T1.2 — `sync_harness.py`**
Copies `+engr183/` and `tests/` from `../engr183-harness/` into `vfs/engr183/`, and `../engr183-harness/assignments/` into `public/starters/`. Records the source commit SHA (same monorepo, so this is `git log -1 --format=%H -- engr183-harness/`) in `vfs/engr183/HARNESS_VERSION`. Refuses to overwrite locally-modified files without `--force`.
*Acceptance:* Sync works; drift is detected and reported; SHA recorded.

**T1.3 — Pin the kernel environment**
Lock exact versions in `environment.yml`. Do not float on a dev channel — a silent upstream change must not break the course mid-semester.
*Acceptance:* Two builds a week apart produce the same kernel version.

**T1.4 — Kernel session wrapper (`src/kernel/session.ts`)**
Start a xeus-octave kernel via `@jupyterlite/services`, imported directly into the app bundle (see M0-FINDINGS.md T0.9 — a bare `@jupyterlab/services` client doesn't work against jupyterlite from outside its own bundle). Expose `execute(code)` returning streamed stdout/stderr, plus `restart()`. Handle kernel-not-ready and kernel-died states with actionable messages. Treat this ticket as the M1 risk spike: validate it standalone before building the file tree/editor/console on top of it.
*Acceptance:* Unit-testable module; arbitrary Octave runs and returns output; restart recovers a wedged kernel; zero notebook/lab frontend needed to make it work.

**T1.5 — File bridge (`src/kernel/files.ts`)**
Read and write `.m` files through the contents drive. Seed a unit's starters on first visit. Track dirty buffers and flush them before any execution. Implements the R6 fallback path if T0.8 failed.
*Acceptance:* A file edited in the browser is what the kernel executes, every time, with no manual save step.

**T1.6 — File Browser and Editor**
Monaco with Octave/MATLAB syntax highlighting, named and arranged after Octave's own GUI (File Browser left, Editor top-right, tabbed). Tree lists the current unit's `.m` files. Tabs, dirty indicators, keyboard save.
*Acceptance:* A student can open, edit, and switch between the three Unit 1 files.

**T1.7 — Command Window and Run Tests**
Toolbar button executes `engr183.runTests('unitNN')`. Stdout renders as monospace preformatted text, unmodified, in the Command Window panel (bottom-right, matching Octave's own layout). Also wire Run File.
*Acceptance:* Rubric report in the browser is **character-for-character identical** to the same report in a local terminal.

**T1.8 — Unit 1 end to end**
Wire the existing Unit 1 starters and specs through the whole stack.
*Acceptance:* A student opens the URL, edits three files, clicks Run Tests, and reaches 30/30 without ever seeing a notebook, a cell, or the word Jupyter.

**T1.9 — Harness-parity smoke test in CI — DONE**
`ENGR-183-Tools/.github/workflows/harness-ci.yml` installs Octave on `ubuntu-latest` and runs `engr183-harness/_verify/check_golden.m`, which runs `runTests('unit01')` for both the unsolved and solved cases and diffs the exact output against committed golden files (`_verify/golden/*.txt`, refreshed via `_verify/regenerate_golden.m` after any deliberate report-format change).
*Acceptance:* CI fails if harness output changes unexpectedly. This is the guardrail on Goal 3.

Building this caught a real bug, not a hypothetical one: Octave caches a function by the path it first loaded it from, and overwriting the file on disk does **not** invalidate that cache — `rehash` doesn't help, only `clear <name>` does. Without it, a student who runs Tests once, fixes their code, and runs again in the *same* kernel session would silently see the stale first-run result. Fixed in both `check_golden.m`/`regenerate_golden.m` and, more importantly, in `octave-playground/src/kernel/files.ts`'s `buildWriteFilesCode` (verified directly: run unsolved → fix `circleArea.m` → rerun in the same session → correctly shows PASS, not the stale FAIL).

### M2 — Course content

**T2.1 — `new_unit.py` scaffolder — DONE**
`octave-playground/scripts/new_unit.py` generates `engr183-harness/assignments/unitNN/*.m` stubs, `_verify/unsolved+solved/unitNN/*.m`, `tests/unitNN_tests.m`, and `octave-playground/src/units/unitNN.json` from a template.
*Acceptance:* `python scripts/new_unit.py 03 --functions foo,bar` produces a working unit skeleton requiring no app code changes. Verified end to end with a throwaway `unit99` (cleaned up before committing) — required no changes to any `.tsx`/`.ts` app code, since `src/units/index.ts`'s glob import (T2.5) picks up any `unitNN.json` automatically.

**T2.2 — Problem statement panel — DONE**
`src/components/ProblemStatement.tsx` renders each unit's title and description from `units/unitNN.json` above the editor, with a Hide/Show toggle. This replaces what a notebook's markdown cells would have carried.
*Acceptance:* Problem statement is readable alongside code without switching context; collapsible at narrow widths. Verified via `m0-spike-driver/t23-problem-statement.js` and `t23-collapse.js`.

**T2.3 — Author Units 01–07**
Following the 15-unit course plan.
*Acceptance:* Each unit loads, starter code runs, tests execute. Content review is Stephen's, not Claude Code's.

**T2.4 — Units 08–14, contingent on T0.7**
Only if plotting works. Otherwise raise for a scope decision.
*Acceptance:* Same as T2.2, or a written scope-change proposal.

**T2.5 — Unit index / landing page — DONE**
`src/units/index.ts` auto-discovers every `unitNN.json` via `import.meta.glob` (no hardcoded unit list — adding a unit via T2.1's scaffolder needs no app code changes, per Goal 6). `src/components/UnitIndex.tsx` is the table-of-contents landing page (title + description per unit, links via `?unit=` in the URL). `App.tsx` became a thin router in front of it; the previous single-unit app body was extracted unchanged into `src/Playground.tsx`.
*Acceptance:* Landing page is the entry point students reach from a Canvas link (T4.1: opened as its own tab, not an iframe target) and links every published unit. Verified via `m0-spike-driver/t24-unit-index.js` (index → select → Ready → back-to-index) and `t24b-deeplink-runtests.js` (direct `?unit=unit01` load skips the index; Run Tests still produces the correct report through the extracted `Playground` component).

Building this on top of `?unit=` in the URL (needed just to make the back button and page refresh behave sanely) turned out to already satisfy T4.2's "per-unit deep links" requirement — see T4.2 below.

**T2.6 — Plot rendering in the Command Window — DONE**
M0/T0.7 confirmed the kernel emits Plotly-shaped output (`application/vnd.plotly.v1+json`, no PNG fallback) but the M1 Command Window discarded it — only `stream`/`error`/`execute_reply` were handled. `session.ts`'s `execute()` now also routes `display_data`, `execute_result`, and `update_display_data` messages through the output callback as a `{kind: 'display', displayId, mimeBundle}` chunk. `Playground.tsx` holds output as an ordered array of text/plot blocks (`CommandWindow.tsx`'s `OutputBlock`) instead of a single string, so a plot renders inline in the right position relative to surrounding stdout. `src/components/PlotOutput.tsx` dynamically imports `plotly.js-dist-min` (~1MB, code-split into its own chunk — confirmed in the build output — so units that never plot don't pay for it) and calls `Plotly.newPlot` with a dark-theme-matched layout merged under the figure's own.
Real bug found building this: xeus-octave's `plot()` doesn't send one `display_data` message with the figure. It sends an *empty* `display_data` first (reserving a `display_id`), then the actual figure moments later as `update_display_data` with the same `display_id` — confirmed by dumping raw message types (`m0-spike-driver/t26c-msgdump.js`, since removed). `execute()` originally ignored `update_display_data` entirely, so plots silently rendered as nothing. Fixed by handling all three message types the same way and having `Playground.tsx` patch the existing block in place by matching `displayId` rather than always appending.
*Acceptance:* `plot(x, y)` executed via Run File/Run Tests renders a chart inline in the Command Window, in the correct position relative to any `disp`/`printf` output before and after it. Verified via `m0-spike-driver/t26-plot-render.js`, both in the Scratch Pad and inside a regular unit.

**T2.7 — Scratch Pad (free-play mode) — DONE**
A place for students to write and run arbitrary Octave with nothing graded, requested directly (not from the original 15-unit plan). Modeled as an ungraded `UnitMeta` (`src/units/scratchUnit`, `id: 'scratch'`, `isScratch: true`) rather than a separate app mode, so it reuses the entire Playground stack (File Browser, Editor, Command Window, persistence, plotting) for free — the only special-casing is `Toolbar.tsx` hiding the Run Tests button when `unit.isScratch` (there's no rubric to run against free-form code) and `UnitIndex.tsx` listing it in its own section below the graded units, visually distinct (dashed border) so it doesn't read as course content. Deliberately kept *outside* `src/units/index.ts`'s `unit*.json` auto-discovery glob (T2.1/T2.5) — it isn't curriculum, so it shouldn't compete with real units in sort order or get swept up by `new_unit.py`. Starter content lives at `public/starters/scratch/scratch.m`, following the same starter-fetch path every graded unit already uses, so persistence (browser-storage drive, autosave, reset) needed zero new code.
*Acceptance:* Reachable from the landing page and via `?unit=scratch`; Run Tests is absent; Run File executes freely, including plots; edits persist across a reload exactly like a graded unit. Verified via `m0-spike-driver/t27-scratch.js`.

Toolboxes (octave-forge packages like `signal`, `image`, `statistics`) were raised alongside this but deliberately not pursued yet: `environment.yml` only pins `xeus-octave`/`octave`/`xeus`, and whether any given octave-forge package even has a working WASM build on the `emscripten-forge-dev` channel is unknown and unverified. Rather than speculatively bundling packages against units that don't exist yet (T2.3/T2.4), the plan is to check availability for a specific package only once specific unit content actually calls for it.

---

### M3 — Student experience

**T3.1 — MSJC dark blueprint theme — DONE**
Confirmed with Stephen: keep the dark palette shared with the other MSJC tools rather than literally replicating Octave's own (light, Qt-default) desktop GUI colors, but add real desktop-app chrome so it reads as an application, not a themed web page. Re-skinned every panel onto a consistent slate/cyan system (`bg-slate-950/900/800`, `border-slate-700`, `text-slate-100/400`, cyan-400/600 for accents and primary actions) in place of the prior ad hoc `neutral`-palette classes. Chrome additions: an app-level title bar above the Toolbar (`ENGR-183 Octave Playground — <unit title>`, with a status dot), Run Tests/Run File promoted to solid cyan primary buttons with Download File/Download All demoted to outlined secondary buttons, a cyan left-border accent on the active file in the File Browser and a cyan top-border on the active Editor tab (both closer to how a real IDE marks "the thing that's open" than a flat background swap), and a status dot next to the Toolbar's status text (slate while starting, pulsing cyan while running, steady cyan when ready, red on error).
Caveat: built from DESIGN.md's own textual description of the target palette ("dark ground, cyan/white technical linework, monospace for code, restrained"), not by inspecting the actual recursion visualizer/PHY-201 sims source — no local access to those tools' code from this repo. If their actual palette differs in specifics (exact hex values, accent color), a follow-up pass to align exactly would be cheap, since colors are just Tailwind utility classes throughout, not a custom design-token system.
*Acceptance:* File tree, editor, console, and toolbar are themed coherently. Legible at typical browser widths (T4.1: opened as its own tab, not embedded at Canvas iframe dimensions). Full regression pass (unit index, deep links, Scratch Pad, download, floating figures) confirmed no functional breakage from the re-skin.

**T3.6 — Floating figure windows (added, not in original plan)**
Plots rendering inline in the Command Window's scrolling text (T2.6's original implementation) wasn't a parity experience with desktop Octave, where `plot()` opens a separate floating Figure window. `src/components/FloatingFigure.tsx` is a draggable (mousedown on its title bar + window-level mousemove/mouseup), closable window rendering `PlotOutput` (unchanged) inside; `Playground.tsx` now tracks figures in their own `figures` state, keyed by the kernel's `display_id` (same correlation mechanism T2.6 built for the placeholder → real-figure update), completely separate from the Command Window's plain-text `output` string — a plot never enters the console text flow at all now. Each new figure is labeled sequentially ("Figure 1", "Figure 2", ...) and cascades its initial position so multiple plots from one run don't stack exactly on top of each other; clicking a figure brings it to front via a monotonic z-index counter. Figures reset (all windows close) at the start of each new Run Tests/Run File, matching how console output already reset per run.
*Acceptance:* Multiple plots in one run open as separate labeled, draggable, closable windows; the Command Window shows only text output; closing a figure removes just that window. Verified via `m0-spike-driver/t31-floating-figures.js`.

Found and fixed two real bugs in Stephen's first review pass: (1) the Figure window's size didn't match the plot's actual rendered size, because xeus-octave's own default Plotly layout JSON carries an explicit pixel `width`/`height` (e.g. 560×420) which was overriding our container-fit intent. (2) the plot background wasn't white — the kernel's own `plot_bgcolor` (transparent) was winning over ours, so the dark app chrome showed through. `FloatingFigure.tsx`'s content area also lost its padding so the white canvas goes edge-to-edge like a real Figure window, and sized to 560×420 to match the kernel's own default plot proportions — real Octave/MATLAB figures render on white regardless of the surrounding app's theme, that's the authentic look being matched, not something to re-skin dark.

A second review pass caught two more bugs, one of which unwound part of the first fix:

- **Toolbar occlusion.** The cascade's starting position (24, 24) put every new Figure window directly on top of Run Tests/Run File — a click there was silently intercepted by the figure window, never reaching the button underneath. Reported as "weird" re-run behavior; it looked like a kernel/data problem but wasn't (confirmed via `m0-spike-driver/t36b-rerun-debug.js`: re-running the exact same code after closing the blocking figure produced a fresh `display_id` and rendered correctly every time). Fixed by starting the cascade past the app title bar + Toolbar and the File Browser column (`x: 240, y: 90` instead of `24, 24`).
- **Doubled legend.** Octave's `legend()` turns out to be implemented by xeus-octave via Plotly *annotations* (text + leader lines) rather than Plotly's native legend object, with `showlegend: false` set deliberately at the layout level to suppress Plotly's own redundant legend underneath its hand-drawn one. The first review's fix (forcing `showlegend: true` and a custom `legend` position, to solve what looked like a legend clipped past the window edge) was built on a wrong premise — it re-enabled Plotly's real legend rendering *on top of* the kernel's own, producing a visibly doubled/offset legend box. Root-caused by dumping every SVG text node containing "sin"/"cos" (`m0-spike-driver/t37i-alltraces.js`): two pairs existed, one classed `legendtext` (Plotly's native legend, wrongly re-enabled) and one classed `annotation-text` (the kernel's own). Fixed by reverting to trust the kernel's own `showlegend`/`legend`/`margin` values entirely — once `FloatingFigure`'s fixed 560×420 size (from the *first* fix) already matches the canvas the kernel's annotations were positioned for, no size-mismatch-driven clipping happens either, so nothing else needed forcing.
- Also fixed in the same pass, found while chasing the above: `PlotOutput.tsx`'s cleanup and setup both did `import('plotly.js-dist-min').then(...)` independently, with nothing guaranteeing a purge from the old effect run resolved before newPlot from the new one — a figure that updates twice in quick succession (`plot(x,sin(x)); hold on; plot(x,cos(x))` sends two `update_display_data` messages for the same figure) could theoretically draw on top of itself. Fixed by caching the resolved `plotly.js-dist-min` module at module scope so cleanup can call `purge()` synchronously once loaded, restoring React's cleanup-before-next-effect ordering guarantee.

Verified via `m0-spike-driver/t37-overlap-legend.js` (no Toolbar overlap, a direct re-run click succeeds with the figure still open, exactly one `annotation-text` pair and zero native-legend `legendtext` nodes) and a full regression pass of every other test in the suite.

**T3.7 — Workspace panel (added, not in original plan)**
Desktop Octave's default layout docks a Workspace panel (variable Name/Size/Class) directly under File Browser, in the same left-hand column — missing from this tool entirely until now. `src/components/Workspace.tsx` renders that table; `src/kernel/workspace.ts`'s `WHOS_QUERY` is a small Octave snippet run as its own `execute()` call after every Run Tests/Run File completes (via `Playground.tsx`'s `refreshWorkspace`), using a *separate* local callback so its output never touches the Command Window or opens a stray Figure window — it isn't wired to `handleExecuteChunk` at all. Parses `whos()`'s name/size/class into a `1×91`-style table, using Octave's own temp variable names (`__ws__`, `__i__`) which it `clear`s at the end so they don't show up as leftover variables in a later query. `buildWriteFilesCode` (`files.ts`) now also `clear`s its own internal `fid` bookkeeping variable for the same reason — previously invisible since nothing displayed the workspace at all.
Correctly reflects real Octave semantics, not just a plausible imitation: graded units' `.m` files are function files, so `run()`-ing one populates nothing (calling a function doesn't leak its internals into the base workspace) — the Workspace panel is empty for those, exactly like real Octave. The Scratch Pad's plain scripts (top-level assignments) populate it correctly, including auto-`ans` from a bare unassigned function call like `plot(x, y)` — confirmed as authentic Octave behavior, not a bug, when it showed up unprompted during testing.
*Acceptance:* Workspace panel shows Name/Size/Class after a run, empty for pure-function units, populated for Scratch Pad scripts, no internal bookkeeping variables leak through. Verified via `m0-spike-driver/t34-workspace.js` (Scratch Pad run producing `x`, `y`, `name`, and auto-`ans`; `fid` absent; a graded unit's function-file run leaves the Workspace panel empty, matching real Octave).

**T3.8 — Always-visible Figure toolbar (added, not in original plan)**
Plotly's modebar (zoom/pan/box-select/reset/camera icons, top-right of the plot canvas) defaults to hover-reveal — invisible until a student happens to mouse over the chart, easy to never discover. Desktop Octave's own Figure window toolbar is always visible, no hover required. `PlotOutput.tsx`'s `Plotly.newPlot` config now sets `displayModeBar: true`.
*Acceptance:* Modebar icons are visible immediately on a rendered figure, mouse nowhere near it. Verified via `m0-spike-driver/t39-modebar.js` (reads the `.modebar` element's computed style after moving the mouse away from the plot).

**T3.9 — Resizable and minimizable Figure windows (added, not in original plan)**
Real desktop windows resize from an edge/corner and minimize down to just a title bar; `FloatingFigure.tsx` only supported drag-to-move and close. Added a resize handle (bottom-right corner, standard OS convention) and a minimize button that collapses the window to its title bar — the same button becomes the expand affordance once minimized (icon and tooltip both flip), rather than a separate always-visible expand control, since there's nothing to expand *from* until something is minimized.
Resizing updates the window's on-screen size continuously (cheap, just CSS) but only commits the new size to `PlotOutput`'s `width`/`height` props — triggering an actual Plotly redraw — once the drag ends. Firing a full `Plotly.newPlot()` purge-and-rebuild (see `PlotOutput.tsx`) on every `mousemove` during a fast drag risked both visible jank and reintroducing the render-ordering bugs already found and fixed once for this exact code path (T3.6 follow-up: the doubled-legend investigation). Minimizing conditionally unmounts `PlotOutput` rather than hiding it with CSS, for the same reason — Plotly's SVG sizing can misbehave inside a `display:none` container, and unmount/remount is the same clean lifecycle already used when a figure is closed and a new one opens.
*Acceptance:* Drag the corner handle to resize; the plot redraws at the new size; a minimum size is enforced so the window can't be shrunk to nothing; minimize collapses to the title bar and hides the plot; the same button expands it back, redrawing the plot correctly. Verified via `m0-spike-driver/t49-resize-minimize.js`.

**T3.10 — Resizable and collapsible layout panes (added, not in original plan)**
T3.9 covered Figure windows; this is the same idea applied to the fixed-layout panes (File Browser, Workspace, Editor, Command Window), which previously had a hardcoded sidebar width and Command Window height with no way to adjust either. Unlike Figure windows (independently-positioned, hand-rolled drag logic was reasonable), these panes are part of the flexbox layout itself, where hand-rolling three separate resize dividers with correct min/max/collapse behavior was judged more error-prone under time pressure than integrating a purpose-built library — used `react-resizable-panels` (already flagged in this doc's earlier M1 planning notes as the intended tool for this). Structure: an outer horizontal `Group` (sidebar | main content), a nested vertical `Group` inside the sidebar (File Browser / Workspace), and a vertical `Group` inside main content (Editor / Command Window) — three independent `Separator` drag handles. `src/components/PanelHeader.tsx` is a small shared header (title + collapse button, reusing the same `─`/`▢` glyph convention as `FloatingFigure`'s minimize/expand) used by File Browser, Workspace, and Command Window; Editor has no header and isn't collapsible, since there's no obvious reason to hide the primary work surface.
Each collapsible `Panel` sets `collapsedSize` to roughly its header's own pixel height (not 0) — collapsing to literally 0px would hide the header too, with no way back except dragging the (now invisible) separator. `PanelHeader` is `flex-shrink-0` inside each pane's content column, so when the Panel shrinks to `collapsedSize`, the header is what survives and everything below it clips via the pane's own `overflow-hidden` — no conditional rendering needed, the existing flex layout does it for free. Collapse state is tracked in local `Playground.tsx` state (so each header button's icon can reflect it) but re-derived from `panelRef.current.isCollapsed()` inside each `Panel`'s `onResize` callback, so state stays correct whether a pane was collapsed via its button or by dragging a separator past `minSize`.
One real bug on the way: `Panel`'s size props (`defaultSize`/`minSize`/`maxSize`) interpret a bare *number* as **pixels**, not percent — percentages need an explicit string (`defaultSize="18"` or `"18%"`). Passed raw numbers everywhere on the first pass, rendering a sidebar a few pixels wide; caught immediately via a local screenshot, not a live deploy.
*Acceptance:* Each divider drags smoothly and resizes its two neighboring panes; File Browser, Workspace, and Command Window each collapse to just their header via their own button and expand back correctly; a collapsed pane's content is genuinely clipped (verified geometrically — the content's position falls below the collapsed pane's visible bottom edge — not just via `isVisible()`, which doesn't account for flex/overflow clipping and gave a false positive during testing); collapsing Command Window gives Editor the reclaimed space; Run Tests still works correctly after resizing/collapsing panes mid-session. Verified via `m0-spike-driver/t52-panel-resize-collapse.js`.

**Bug fix — phantom Figure windows for non-plot output**
Stephen reported two symptoms: an empty Figure window popping up with no plot in the code, and "two or more figures doesn't work." Root-caused both to the same place. `session.ts`'s `execute()` routes `display_data`, `execute_result`, *and* `update_display_data` through the same `kind: 'display'` chunk — but `execute_result` fires for *any unsuppressed statement* (`x = 5` with no trailing `;`, extremely common beginner code, not just plots), carrying `text/plain` content with no `display_id`. `Playground.tsx`'s `handleExecuteChunk` treated every `'display'` chunk as a plot unconditionally, so an ordinary unsuppressed assignment popped up an empty "Figure N" window showing "(unsupported output type: text/plain)". Reproduced directly (`x = 5` alone, no `plot()` anywhere in the code, still opened a Figure window) before touching anything.
The "two figures doesn't work" report didn't reproduce as an actual failure in isolation — a script with exactly two `plot()`/`figure` calls and nothing else completed and rendered both correctly, just needed slightly more time than an initial premature check allowed (the kernel's execute_reply and React's status update take a moment after the last `disp()` text lands, which one early test broke out of its polling loop before). But realistic student code mixes unsuppressed statements *with* multiple plots, and every one of those statements was also popping a phantom window — with several phantom windows piling up alongside the real ones, "the figures don't work" is exactly how that looks and feels, even though each individual plot was rendering fine underneath the clutter.
Fixed in `Playground.tsx`: a `'display'` chunk is only treated as a plot if its `mimeBundle` actually contains `application/vnd.plotly.v1+json`, or it's the empty two-phase placeholder (`displayId` present, empty bundle) that precedes a real plot update — anything else with `text/plain` content gets appended to the Command Window's text output instead, exactly like real Octave printing an unsuppressed statement's value.
*Acceptance:* A script with unsuppressed statements and no `plot()` calls shows their values in the Command Window (e.g. `x = 5`) and opens zero Figure windows. A script mixing unsuppressed statements with two `plot()` calls opens exactly two Figure windows, both rendering correctly, with the unsuppressed output correctly interleaved in the Command Window text. Verified via `m0-spike-driver/t54-nofigure-bug.js`, `t54f-render-check.js`, `t54g-textoutput-check.js`, and `t54h-combined-scenario.js` (the realistic mixed case). Full regression pass of the existing suite shows zero other breakage.

**T3.12 — Rendering spinner for slow plots (added, not in original plan)**
Stephen: plots can take a while to appear (the first plot of a session downloads `plotly.js-dist-min`, ~1MB, over the network — deliberately deferred until actually needed rather than bundled upfront; a large figure's `Plotly.newPlot()` itself can also take a moment) and a blank white Figure window with no feedback during that wait looks broken rather than "still working." `PlotOutput.tsx` now tracks a `rendering` boolean spanning both waits — set the moment a real figure is available and the effect starts, cleared only once `Plotly.newPlot()`'s own returned promise resolves (not just once the dynamic import resolves) — and shows a spinner + "Rendering…" overlaid on the plot area while true. The *empty* two-phase placeholder (waiting on the kernel, before any figure data exists at all) shows the identical spinner rather than a blank box, since a student can't tell "waiting on the kernel" and "kernel data arrived, still drawing" apart anyway and shouldn't need to.
*Acceptance:* The spinner is visible for the whole gap between a Figure window appearing and its chart actually rendering, and gone the instant it's genuinely ready. Verified via `m0-spike-driver/t57-rendering-spinner.js`, which uses Playwright route interception to artificially delay the `plotly.min-*.js` network response by 3s (real rendering is normally too fast on localhost to reliably observe the spinner window otherwise) and confirms: the spinner is visible and no chart exists yet during that delay, then the spinner disappears once the chart actually appears.

**T3.13 — Student-added/removed files (added, not in original plan)**
Stephen: can students add and remove their own files? Investigation found most of the plumbing already existed by accident: `buildWriteFilesCode` (`kernel/files.ts`) already writes *every* key in `Playground.tsx`'s `contents` state to the kernel filesystem, not just `unit.files` — so a new file added at runtime needed zero changes there. `downloadZip` already zips whatever's in `contents` for the same reason. `ContentsManager` (from `@jupyterlab/services`, already wired for T1.5's file bridge) supports `delete(path)` and, for a directory model fetched with `content: true`, returns its child entries — so extra files can be rediscovered on reload by listing the unit's drive directory (`UnitFiles.listExtraFiles`), with no separate manifest file needed; the directory itself is the source of truth.
`unit.files` (from each `unitNN.json` / the `scratchUnit` const) stays the protected/original list — used for "Reset unit"'s iteration and to decide which files can't be deleted, since `Run Tests`/`Run File` depend on them existing. A new `fileList` state in `Playground.tsx`, seeded on startup from `unit.files` plus discovered extras, now drives both `FileBrowser` and `Editor`'s tabs. `FileBrowser.tsx` gained a "+" button that opens an inline filename input, and a hover-revealed delete (×) icon per row, shown only for files not in `unit.files`; delete routes through the same `ConfirmDialog` pattern as Reset File/Reset Unit (T3.3). Toolbar's "Reset File" is now disabled (with an explanatory tooltip) while an extra file is active, since `resetToStarter` has nothing to fetch for a file with no starter — calling it unconditionally would throw an unhandled rejection.
One real gap surfaced by this: `buildWriteFilesCode` interpolates the filename directly into a single-quoted Octave string literal (`fopen('.../${name}', 'w')`) and into a bare `clear <name>` statement, with no escaping — always safe before, since names only ever came from static JSON. Student-entered names are now validated (`normalizeFileName` in `kernel/files.ts`) before ever reaching that code generation, which simultaneously keeps it injection-safe, blocks path traversal, and matches what Octave would actually accept as a function/script name. Duplicate names (case-insensitive) are rejected inline in the File Browser before the request ever reaches `Playground.tsx`.
*Acceptance:* A student can add a new file, write code in it, and run it via Run File; delete an added file; original unit files show no delete affordance and can't be removed; an added-then-kept file survives a page reload, a deleted one stays gone. Verified via `m0-spike-driver/t59-add-remove-files.js`: add (appears in File Browser + becomes the active editor tab), duplicate name rejected inline, invalid name (`../evil`) rejected inline, added file's content actually reaches and runs in the kernel, protected file has no delete icon while the added file does, Reset File is disabled while the added file is active, delete removes it from the File Browser, and a second added file persists across a full page reload via directory rediscovery.

**Edge-case sweep — found and fixed a case-sensitivity bug in name normalization**
Requested follow-up: run a broader edge-case pass against the deployed dev build, not just the happy path. `m0-spike-driver/t60-prod-dev-edgecases.js` covers invalid-name variants (leading digit, embedded space, path traversal, `!`, double extension, empty), blur/Escape-cancel of the add input, case-insensitive duplicate detection against both an extra file and a protected file, Cancel-vs-confirm on the delete dialog, deleting a non-active file (active tab/content must stay untouched), Reset Unit leaving extra files alone, Scratch Pad getting the feature with no cross-unit leakage, and reload persistence of both an add and a delete.
It caught a real bug: `normalizeFileName`'s "does this already end in `.m`?" check was case-sensitive (`endsWith('.m')`), so typing `HELPER.M` didn't register as already-suffixed and got double-appended into `HELPER.M.m`, which then failed validation for the wrong reason (looked like garbage input) instead of being correctly caught as a duplicate of `helper.m`. Fixed by stripping a case-insensitively-matched `.m`/`.M` suffix before re-validating the base name and re-appending a lowercase `.m` — so the extension's case no longer affects whether normalization or duplicate-detection is reached. Two of the sweep's own checks also had ambiguous Playwright selectors (`addTwo.m` matching both its File Browser row and its Editor tab; "Reset unit" matching both the Toolbar button and the confirm dialog's button) — test-script bugs, not app bugs, fixed by scoping to more specific locators.
*Acceptance:* All 24 checks in `t60-prod-dev-edgecases.js` pass against both a local `npm run preview` build and the deployed dev URL.

**T3.14 — Octave syntax highlighting (added, not in original plan)**
Stephen: called this a must-have. Investigation before writing anything found the editor actually had *zero* syntax highlighting today, not approximate MATLAB highlighting as the original T1.6 plan assumed: `Editor.tsx` passes `language="matlab"` to Monaco, but checking the installed `monaco-editor` package's own language registry directly (`node_modules/monaco-editor/esm/vs/basic-languages/monaco.contribution.js`, which explicitly imports each of its ~65 bundled languages) shows MATLAB isn't among them — it's been dropped from Monaco at some point since T1.6 was planned, and nothing had caught it since. `language="matlab"` was silently falling back to plaintext.
Added `src/components/octaveLanguage.ts`: a real Octave Monarch tokenizer (`registerOctaveLanguage`, called from `Editor.tsx`'s `beforeMount`), covering keywords (`function`/`end`/`if`/`for`/`while`/`switch`/`try`/`classdef`/etc. and their `end*` closers), line comments (`%` and `#`) and block comments (`%{ %}`, `#{ #}`, own-line only), single- and double-quoted strings, line continuation (`...`), and numbers (int/float/hex/binary/exponent/imaginary suffix).
The one genuinely tricky part: Octave's `'` is both the string-quote and the transpose operator (`A'`), disambiguated only by adjacency (immediately after an identifier/closing-bracket/`.` = transpose, otherwise starts a string). The obvious approach — a regex lookbehind checking the preceding character — doesn't work in this Monaco version: read `monarchLexer.js` directly and confirmed it matches each rule against `line.substr(pos)`, a substring starting at the current position, so a lookbehind has no prior characters to see. Worked around it the way the substr-based matching actually supports: the identifier and closing-bracket rules each consume a trailing run of `'` characters as part of the *same* match, splitting the result into two tokens via Monarch's multi-capture-group action arrays, rather than relying on lookbehind context.
*Acceptance:* Comments, keywords, strings, and numbers are visibly colored, and `A'` (transpose) is never colored as a string while `'text'`/`"text"` always are. Verified via `m0-spike-driver/t61-syntax-highlighting.js`, which reads Monaco's actual rendered token spans (`span[class^="mtk"]`) and their computed colors directly rather than eyeballing a screenshot — confirms comment/keyword/string/number each get a color distinct from plain text, `end` is recognized as a keyword (not just `function`), single- and double-quoted strings share the same color, and specifically that `B = A';` renders the `A'` as plain/operator-colored text with no string span opened, while `s = 'text';` does open one. (The test script itself hit two of its own red herrings before landing on that: Monaco merges adjacent same-token characters into one span rather than one per identifier, and renders spaces in `.view-line` DOM text as U+00A0 rather than a plain ASCII space — both are just how Monaco renders, not app bugs, and the script accounts for them now.)

**Known limitation — xeus-octave's auto-display formatting for structs/matrices/cells diverges from desktop Octave**
Stephen: full production smoke test, looking for anything inconsistent with real Octave/MATLAB. Ran a battery of language-correctness probes (`m0-spike-driver/t63-prod-octave-probes.js`) covering string/char class semantics, integer saturation, broadcasting, printf/sprintf formatting, error identifiers, `regexp`/`strsplit` delimiter-collapsing, closures, complex numbers, `containers.Map`, multiple return values, and more — all correct, including places Octave deliberately differs from MATLAB (e.g. `"text"` is `class 'char'` in Octave, not MATLAB's `'string'`).
One real divergence found: for **non-scalar auto-display** (a struct, matrix, or cell shown by typing its name without a trailing `;`), the browser kernel omits formatting real desktop Octave always includes. Confirmed via a direct side-by-side against a real Octave 10.3.0 install: desktop Octave prints `varname =`, a blank line, then the content (and for structs, a `scalar structure containing the fields:` banner) — the browser kernel prints `varname = ` immediately followed by the content on the same line, and skips the struct banner entirely. Scalars are unaffected (`a = 2.5000` renders identically either way — there's no separator to lose).
Investigated whether a newer xeus-octave build fixes it before concluding it doesn't: the WASM platform's `0.6.2` (pinned in `environment.yml`) is already the newest version `emscripten-forge-dev` offers, so there's nothing to bump to there. Installed **native** (non-WASM) xeus-octave via conda-forge instead, to separate "xeus-octave kernel bug" from "WASM/Emscripten packaging artifact" — both `0.6.2` (matching the pin) and `0.7.0` (the newest version available anywhere, native or WASM) reproduce the identical formatting loss when driven through a real Jupyter kernel session (`jupyter_client`, not just raw `octave-cli`). Spanning the full available version range with no change rules out a version bump as a fix; this is a stable, long-standing characteristic of how xeus-octave relays Octave's display output to Jupyter's rich-display protocol, not a regression or a WASM-specific issue.
*Disposition:* Documented as a known limitation (this entry, plus a student-facing note in `engr183-harness/README.md`) rather than building a client-side reformatting workaround. Doesn't affect grading — the harness's own rubric reports are built from explicit `fprintf`/`disp` calls, not auto-display — but is visible to students who inspect a struct/matrix/cell interactively by typing its name, a workflow this app explicitly supports.

**T3.2 — Download files — DONE**
Bumped ahead of the rest of M3: with LTI/grade-passback confirmed out of scope for now (§7 — "Not an autograder... Grading stays local"), manual download-then-upload-to-Canvas is the actual submission path, not a placeholder for something else. `src/kernel/download.ts`'s `downloadFile`/`downloadZip` read straight from `Playground.tsx`'s live `contents` state (not the browser-persisted drive), so a download is never stale relative to unsaved autosave debounce. `downloadZip` (via `jszip`) writes files flat, no folders — matching the local Octave mental model of one working directory per unit. Toolbar gained "Download File" and "Download All (.zip)" buttons, available in every unit including the Scratch Pad.
*Acceptance:* Downloaded files run unmodified under local Octave 8.4 — no packaging/transformation is applied (plain UTF-8 text in, plain UTF-8 text out), so this reduces to "is the content byte-identical to the editor buffer," verified directly via `m0-spike-driver/t29-download.js` (single-file and zipped copies both reflect a live in-editor edit, not the original starter).

**T3.3 — Reset to starter — DONE**
Per-file ("Reset File", primary Toolbar action) and per-unit ("Reset unit", smaller/secondary) restore, both behind `src/components/ConfirmDialog.tsx` — a themed modal (not a native `confirm()`, to match the rest of the app) naming exactly what will be lost: the specific filename for a file reset, or every filename in the unit for a unit reset. Both reuse `UnitFiles.resetToStarter` (already existed, built for first-visit seeding — T1.5), which fetches the original starter, persists it to the browser drive, and returns the content; `Playground.tsx`'s `doResetFile`/`doResetUnit` apply that to `contents` state and clear the corresponding dirty flag(s). Disabled while the kernel is busy, matching Run Tests/Run File.
*Acceptance:* Reset restores starters without touching other units' or other files' work. Verified via `m0-spike-driver/t41-reset.js`: Cancel leaves the edit untouched, confirming restores starter content, resetting one file leaves a different edited file in the same unit untouched (isolation), the unit-level confirmation names every file in the unit, resetting the unit resets all of them, and the reset survives a page reload (persisted to the browser drive, not just in-memory state).

**T3.4 — Persistence warning (R5) — implemented, copy awaiting review**
`src/components/PersistenceWarning.tsx` is a themed modal (matching `StartupOverlay`/`ConfirmDialog`, not a native `confirm()`), shown once per browser via a `localStorage` flag (`engr183-persistence-ack`) that `App.tsx` checks on mount — separate from the browser-storage drive used for file content, since a student who's actually experienced what this warns about (cleared storage) should see it again as a fresh-looking visitor. Rendered as an overlay above whichever view is current (`UnitIndex` or `Playground`), so it appears "before a student invests work" regardless of whether they land on the index or deep-link straight into a unit — and above `StartupOverlay` (`z-[60]` vs `z-50`) for the deep-link case where both could show at once. Not dismissable by clicking the backdrop or pressing Escape, only by reading it and clicking "Got it." States R5's mitigation directly (per DESIGN.md §5: "prominent export, never by promising persistence") by pointing at the Download File/Download All buttons already built in T3.2.
*Acceptance:* Visible before a student invests work — verified via `m0-spike-driver/t43-persistence-warning.js` (shown on first visit, survives backdrop-click and Escape attempts, dismissed only by "Got it," does not reappear after reload once acknowledged) and `t43b-deeplink.js` (same, landing directly on a unit URL, correctly layered above the startup overlay, kernel proceeds normally after dismissal). Copy itself is a first draft, not yet reviewed by Stephen per this ticket's own acceptance line — flagging that explicitly rather than treating the wording as final.

**T3.5 — First-run onboarding**
Brief orientation on first visit: where the files are, what Run Tests does, how to read the rubric report, how to download work for submission. Frame it in the same vocabulary the course uses locally — files and functions, not cells and kernels.
*Acceptance:* A student who has only ever used local Octave can complete Unit 1 unaided and recognizes everything they see.

---

### M4 — Canvas integration

**T4.1 — Verify Canvas delivery (iframe embedding ruled out) — DONE**
Set out to verify iframe embedding; found during that verification that it's architecturally impossible, and pivoted the deploy plan instead of trying to work around it.

GitHub Pages sends no `X-Frame-Options`/CSP `frame-ancestors` (confirmed via `curl -I`), so nothing blocks a Canvas iframe from loading the page at the HTTP level. But the app requires `crossOriginIsolated` for its fast kernel worker (`coincident.worker.js`, SharedArrayBuffer-based); GitHub Pages sends no COOP/COEP either, which is why `public/coi-serviceworker.js` exists — it fakes those headers via a service worker, and that trick works fine for a direct, top-level visit (confirmed: `crossOriginIsolated: true`). Built a genuine cross-origin test harness (a local page on a different origin than `github.io`, iframing the live production site — not same-origin nesting) to test the real scenario, and found the service worker registers and controls the framed page correctly (`controller: true`) but `crossOriginIsolated` still comes back `false`. Root cause, confirmed by spec: cross-origin isolation requires the **top-level** browsing context to send COOP+COEP — inside an iframe, no amount of cleverness in the embedded page's own service worker can produce that, because the isolation status is gated by the top-level document (Canvas), which we don't control and which will not adopt strict cross-origin isolation (it embeds far too many third-party tools for that to be viable for Instructure). Without isolation, the app silently falls back to `comlink.worker.js` — and that fallback still has the exact filesystem bug M0/M1 already found and never fixed (only routed around, by achieving isolation instead): `Run Tests` fails with `unable to find current directory`, confirmed reproducing inside the iframe harness. This is not an edge case — it's the *only* code path a real Canvas iframe embed could ever reach, so it would have broken the tool's core function for every student, every time, the moment it shipped inside Canvas.

Reported this rather than unilaterally starting on the alternative fix (rewriting `comlink.worker.js`'s filesystem handling directly — unknown scope/risk this close to the deadline). Stephen's call: skip iframe embedding entirely — a Canvas link/module item that opens the tool in a new tab (`target="_blank"`, e.g. Canvas's "External URL" module item type with "Load in a new tab" checked). A new tab is its own top-level browsing context, so it gets the exact same `crossOriginIsolated: true` + working `coincident.worker.js` path that's been verified all session on the live production site — nothing to fix, no new code path, the problem is sidestepped rather than patched around. Verified directly: a fake-Canvas page (`target="_blank"` link, different origin than `github.io`) opened in a new tab reaches `crossOriginIsolated: true` and produces a correct, character-perfect rubric report with no filesystem error.
*Acceptance (revised):* Opens correctly from a Canvas link/module item configured to open in a new tab; works identically to direct top-level access (already verified extensively all session). Storage is standard same-origin persistence in that model — no third-party/cross-origin partitioning caveat to document, since the tool is never embedded as a subframe. Verified via `m0-spike-driver/t45-iframe.js`/`t45b-iframe-runtests.js`/`t45c-header-check.js` (iframe embedding fails, root cause) and `t46-newtab-flow.js`/`t46b-debug.js` (new-tab flow fully works).

**T4.2 — Per-unit deep links — DONE (landed as a side effect of T2.5)**
URL parameters that open directly to a given unit.
*Acceptance:* `?unit=03` opens Unit 03 directly. `App.tsx`'s router reads `?unit=` on mount and renders straight into `Playground` when it names a known unit, skipping `UnitIndex` entirely — this was the natural way to make the T2.5 landing page's back button and page-refresh behavior correct, not separate work. Verified via `m0-spike-driver/t24b-deeplink-runtests.js`.

**T4.3 — Mobile and small-viewport pass**
Usable at typical phone/tablet browser widths — opened as its own tab (T4.1), not an iframe, but still needs to work on the small screens students actually show up with.
*Acceptance:* No horizontal scroll; controls reachable; text legible.

**T4.4 — Instructor runbook**
`RUNBOOK.md`: adding a unit, syncing the harness, rolling back a bad deploy, what to tell a student whose work vanished, and how to link a unit into Canvas (T4.1: an "External URL" module item or plain link with "Load in a new tab" checked — not the iframe-embed LTI/redirect flow Canvas defaults to for some content types).
*Acceptance:* Stephen can add a unit and link it into Canvas from the runbook alone.

---

## 9. Decisions needed from Stephen

1. ~~**Notebook cells vs. file-based editing.**~~ **RESOLVED — file-based.** Students have zero tolerance for divergence from the local workflow, so the notebook layer is dropped entirely rather than disguised. See §4.1. This raises M1 cost meaningfully; see §11 for the interim plan.
2. ~~**Scope if plotting fails (R4).**~~ **RESOLVED — moot.** M0/T0.7 confirmed plotting works under Emscripten. No fallback needed; Units 8+ are in scope.
3. ~~**Repo split.**~~ **RESOLVED — monorepo, own top-level folder.** `engr183-harness/` sits alongside `octave-playground/` in `ENGR-183-Tools`, not a separate GitHub repo. Same rationale as the original recommendation (independently usable by students who never touch the browser) without the overhead of two repos to keep in sync.
4. **Theme reuse.** Should the theme derive tokens from the existing visualizer suite's design system, or stand alone?

## 10. Interim coverage while M1 is built

The file-based frontend is more work than a stock JupyterLite deploy, and it will not be ready in Week 1. Meanwhile a handful of students — realistically two or three out of 32 — will fail to install Octave locally and need something immediately.

Plan:

1. **Week 1 diagnostic.** Unit 1 submissions identify exactly who cannot install. Handle them individually first: most install failures are fixable in one message.
2. **Unbranded stopgap, if needed.** A stock JupyterLite deploy with the harness mounted can be stood up in hours from the M0 spike artifacts. Share it privately with affected students as a temporary workaround, explicitly labeled as such.
3. **Do not launch the stopgap course-wide.** Showing 32 students a notebook interface, then replacing it mid-semester with a file interface, creates exactly the mismatch this design exists to avoid. The stopgap is triage for a named handful, not a product.
4. **Ship M1 when it is genuinely ready**, and migrate the stopgap users over.

## 11. Appendix — verified facts

Confirmed during design research (August 2026):

- `xeus-octave` is published for `emscripten-wasm32` on `emscripten-forge-dev`, latest **0.6.2**, GPL-3.0-only.
- `jupyterlite-xeus` **4.0.5** on PyPI; requires JupyterLab ≥ 4.0.0. Install via conda/mamba, or pip with micromamba 2.0.5.
- `--XeusAddon.mount` takes `host_path:vfs_path` pairs to copy files into the kernel VFS.
- `environment.yml` channels: `https://prefix.dev/emscripten-forge-4x` and `https://prefix.dev/conda-forge`.
- Blocking stdin supported from `jupyterlite-xeus` v4.0.0a8 with JupyterLite 0.6.0.
- Template repo: `jupyterlite/xeus-lite-demo` (GitHub Pages quickstart).
- Upstream caveat: adding custom conda packages is documented as supported for `xeus-python`; other kernels may be more limited. File mounting is separate and should be unaffected.

Resolved by M0 (see `M0-FINDINGS.md` for full detail):

- **R6/T0.8 — contents drive → kernel filesystem:** confirmed working, both directions, live, no kernel restart needed. No fallback required.
- **T0.9 — driving a kernel with no notebook frontend:** confirmed the kernel itself needs zero notebook-*cell* UI, but a generic external `@jupyterlab/services` client can't attach to a running kernel from outside the site's own JS bundle — `@jupyterlite/services` must be part of the same app bundle M1 builds (as already planned).
- **R2/T0.3 — kernel Octave version:** 10.3.0, vs. 11.3.0 on the dev machine used for local comparison, vs. 8.4+ students actually install. A true 8.4 baseline is still outstanding — action item before signing off Goal 3.
- **R4/T0.7 — graphics under Emscripten:** confirmed working (Plotly-backed `plot()`, verified visually). Units 8+ are not blocked. Only basic line plots tested so far; `subplot`/`hold on`/3D/image display are unverified.

Confirmed by direct testing (`engr183-harness/_verify/run.m`, local Octave 11.3.0, and in-kernel via M0's T0.4):

- The `+engr183` harness passes and fails correctly for the solved and unsolved cases, with byte-identical report output between local Octave and the WASM kernel.
- `evalc` captures student stdout while assigning results — used to stop missing semicolons flooding the rubric report. Confirmed under both local Octave and the WASM kernel (T0.5).
- `onCleanup` path restoration used to trigger extra `warning()` lines under the WASM kernel not seen locally (xeus-octave's own `pause.m` gets shadowed during cleanup, plus a downstream `__have_gnuplot__` warning). **Fixed in M1**: `+engr183/restorePathQuietly.m` wraps the restore in `warning('off'/'on', 'all')`. Verified clean (zero extra output) in both local Octave and the browser kernel.
- **Not yet verified:** the wrong-answer, missing-file, unset-output, and syntax-error report paths (`compare.m`/`runTests.m` support them structurally, but only the solved/unsolved paths have actually been exercised). Worth a quick pass before M1 ships Unit 1.
