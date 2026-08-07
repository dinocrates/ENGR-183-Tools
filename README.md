# ENGR-183 Tools

Tools for ENGR-183 (Programming with MATLAB for Engineers and Scientists) at MSJC. Each tool lives in its own top-level folder and can be built/deployed independently.

## Tools

- [`engr183-harness/`](engr183-harness/README.md) — the `+engr183` rubric-checking package students run locally under plain Octave (`engr183.runTests('unitNN')`). Source of truth for grading; vendored (never hand-edited) into `octave-playground/`.
- [`octave-playground/`](octave-playground/DESIGN.md) — in-browser Octave playground (JupyterLite + xeus-octave), fallback and consistency layer for students who can't run a local Octave install. Wraps `engr183-harness/` in a browser runtime rather than reimplementing it. See its `DESIGN.md` for the full design and milestone tickets.

More tools (visualizers, calculators, graphing tools) will be added here as their own folders.
