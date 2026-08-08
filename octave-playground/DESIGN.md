# ENGR-183 Octave Playground — Design Document

**Status:** Draft for implementation
**Owner:** Stephen Hamrick, MSJC
**Implementer:** Claude Code
**Target repo:** `dinocrates/ENGR-183-Tools`, path `octave-playground/`
**Deploy target:** GitHub Pages, embedded in Canvas via iframe

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
5. Embeddable in a Canvas page via iframe.
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
    │   │   └── unit01/  addTwo.m  circleArea.m  greet.m
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
*Acceptance:* Landing page is the iframe target and links every published unit. Verified via `m0-spike-driver/t24-unit-index.js` (index → select → Ready → back-to-index) and `t24b-deeplink-runtests.js` (direct `?unit=unit01` load skips the index; Run Tests still produces the correct report through the extracted `Playground` component).

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
*Acceptance:* File tree, editor, console, and toolbar are themed coherently. Legible at Canvas iframe widths. Full regression pass (unit index, deep links, Scratch Pad, download, floating figures) confirmed no functional breakage from the re-skin.

**T3.6 — Floating figure windows (added, not in original plan)**
Plots rendering inline in the Command Window's scrolling text (T2.6's original implementation) wasn't a parity experience with desktop Octave, where `plot()` opens a separate floating Figure window. `src/components/FloatingFigure.tsx` is a draggable (mousedown on its title bar + window-level mousemove/mouseup), closable window rendering `PlotOutput` (unchanged) inside; `Playground.tsx` now tracks figures in their own `figures` state, keyed by the kernel's `display_id` (same correlation mechanism T2.6 built for the placeholder → real-figure update), completely separate from the Command Window's plain-text `output` string — a plot never enters the console text flow at all now. Each new figure is labeled sequentially ("Figure 1", "Figure 2", ...) and cascades its initial position so multiple plots from one run don't stack exactly on top of each other; clicking a figure brings it to front via a monotonic z-index counter. Figures reset (all windows close) at the start of each new Run Tests/Run File, matching how console output already reset per run.
*Acceptance:* Multiple plots in one run open as separate labeled, draggable, closable windows; the Command Window shows only text output; closing a figure removes just that window. Verified via `m0-spike-driver/t31-floating-figures.js`.

Found and fixed two real bugs while Stephen was reviewing this: (1) the Figure window's size didn't match the plot's actual rendered size, because xeus-octave's own default Plotly layout JSON carries an explicit pixel `width`/`height` (e.g. 560×420) which was overriding our `responsive: true` container-fit intent — `figure.layout` was being spread *after* our own layout defaults, so the kernel's fixed size always won. (2) the plot background wasn't white — same root cause, the kernel's own `plot_bgcolor` (transparent) was winning over ours, so the dark app chrome showed through. Both fixed in `PlotOutput.tsx` by spreading `figure.layout` *first* and applying our own `paper_bgcolor`/`plot_bgcolor`/`margin`/`autosize` afterward (so ours always wins), and explicitly deleting `width`/`height` from the merged layout so `autosize` + `responsive` genuinely drive the size. Real Octave/MATLAB figures render on white regardless of the surrounding app's theme — that's the authentic look being matched here, not something to re-skin dark. `FloatingFigure.tsx`'s content area also lost its padding so the white canvas goes edge-to-edge like a real Figure window, and widened to 560×420 to match the kernel's own default plot proportions. Verified via `m0-spike-driver/t34b-sizing.js` (plot bounding box within 15px of its window, `paper_bgcolor`/`plot_bgcolor` both `#ffffff` read directly off Plotly's `_fullLayout`).

**T3.7 — Workspace panel (added, not in original plan)**
Desktop Octave's default layout docks a Workspace panel (variable Name/Size/Class) directly under File Browser, in the same left-hand column — missing from this tool entirely until now. `src/components/Workspace.tsx` renders that table; `src/kernel/workspace.ts`'s `WHOS_QUERY` is a small Octave snippet run as its own `execute()` call after every Run Tests/Run File completes (via `Playground.tsx`'s `refreshWorkspace`), using a *separate* local callback so its output never touches the Command Window or opens a stray Figure window — it isn't wired to `handleExecuteChunk` at all. Parses `whos()`'s name/size/class into a `1×91`-style table, using Octave's own temp variable names (`__ws__`, `__i__`) which it `clear`s at the end so they don't show up as leftover variables in a later query. `buildWriteFilesCode` (`files.ts`) now also `clear`s its own internal `fid` bookkeeping variable for the same reason — previously invisible since nothing displayed the workspace at all.
Correctly reflects real Octave semantics, not just a plausible imitation: graded units' `.m` files are function files, so `run()`-ing one populates nothing (calling a function doesn't leak its internals into the base workspace) — the Workspace panel is empty for those, exactly like real Octave. The Scratch Pad's plain scripts (top-level assignments) populate it correctly, including auto-`ans` from a bare unassigned function call like `plot(x, y)` — confirmed as authentic Octave behavior, not a bug, when it showed up unprompted during testing.
*Acceptance:* Workspace panel shows Name/Size/Class after a run, empty for pure-function units, populated for Scratch Pad scripts, no internal bookkeeping variables leak through. Verified via `m0-spike-driver/t34-workspace.js` (Scratch Pad run producing `x`, `y`, `name`, and auto-`ans`; `fid` absent; a graded unit's function-file run leaves the Workspace panel empty, matching real Octave).

**T3.2 — Download files — DONE**
Bumped ahead of the rest of M3: with LTI/grade-passback confirmed out of scope for now (§7 — "Not an autograder... Grading stays local"), manual download-then-upload-to-Canvas is the actual submission path, not a placeholder for something else. `src/kernel/download.ts`'s `downloadFile`/`downloadZip` read straight from `Playground.tsx`'s live `contents` state (not the browser-persisted drive), so a download is never stale relative to unsaved autosave debounce. `downloadZip` (via `jszip`) writes files flat, no folders — matching the local Octave mental model of one working directory per unit. Toolbar gained "Download File" and "Download All (.zip)" buttons, available in every unit including the Scratch Pad.
*Acceptance:* Downloaded files run unmodified under local Octave 8.4 — no packaging/transformation is applied (plain UTF-8 text in, plain UTF-8 text out), so this reduces to "is the content byte-identical to the editor buffer," verified directly via `m0-spike-driver/t29-download.js` (single-file and zipped copies both reflect a live in-editor edit, not the original starter).

**T3.3 — Reset to starter**
Per-file and per-unit restore from `starters/`, with confirmation naming what will be lost.
*Acceptance:* Reset restores starters without touching other units' or other files' work.

**T3.4 — Persistence warning (R5)**
Prominent, non-dismissable-on-first-visit notice that work lives in browser storage and clearing data destroys it. Direct, not alarming — follow the empty-state and error-copy conventions: say what happens and what to do about it.
*Acceptance:* Visible before a student invests work. Copy reviewed by Stephen.

**T3.5 — First-run onboarding**
Brief orientation on first visit: where the files are, what Run Tests does, how to read the rubric report, how to download work for submission. Frame it in the same vocabulary the course uses locally — files and functions, not cells and kernels.
*Acceptance:* A student who has only ever used local Octave can complete Unit 1 unaided and recognizes everything they see.

---

### M4 — Canvas integration

**T4.1 — Iframe embedding**
Verify the site loads in a Canvas iframe. Check frame-ancestors headers, storage partitioning, and third-party cookie behavior — browser storage inside a cross-origin iframe is a common failure point and may interact badly with R5.
*Acceptance:* Loads and persists inside a real Canvas page. Any storage caveat documented.

**T4.2 — Per-unit deep links — DONE (landed as a side effect of T2.5)**
URL parameters that open directly to a given unit.
*Acceptance:* `?unit=03` opens Unit 03 directly. `App.tsx`'s router reads `?unit=` on mount and renders straight into `Playground` when it names a known unit, skipping `UnitIndex` entirely — this was the natural way to make the T2.5 landing page's back button and page-refresh behavior correct, not separate work. Verified via `m0-spike-driver/t24b-deeplink-runtests.js`.

**T4.3 — Mobile and small-viewport pass**
Usable at Canvas iframe dimensions and on tablets.
*Acceptance:* No horizontal scroll; controls reachable; text legible.

**T4.4 — Instructor runbook**
`RUNBOOK.md`: adding a unit, syncing the harness, rolling back a bad deploy, what to tell a student whose work vanished.
*Acceptance:* Stephen can add a unit from the runbook alone.

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
