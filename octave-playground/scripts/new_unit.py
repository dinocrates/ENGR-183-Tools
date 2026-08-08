#!/usr/bin/env python3
"""Scaffold a new unit: harness stubs, test spec, and playground metadata.

    python scripts/new_unit.py 02 --functions sumRange,isPrime \
        --title "Loops and Conditionals" \
        --description "Practice writing loops and conditional logic."

Generates (source of truth lives in engr183-harness/, same monorepo):
    engr183-harness/assignments/unitNN/<fn>.m        student-facing unsolved stub
    engr183-harness/_verify/unsolved/unitNN/<fn>.m    identical copy (see _verify/README.md)
    engr183-harness/_verify/solved/unitNN/<fn>.m      placeholder for YOUR reference solution
    engr183-harness/tests/unitNN_tests.m              placeholder rubric criteria
    octave-playground/src/units/unitNN.json           unit metadata for the app UI

Deliberately does not touch vfs/, public/starters/, or golden files -- run
scripts/sync_harness.py to vendor the new unit into the playground once
you've reviewed it, and _verify/regenerate_golden.m (with regenUnitFilter
set to this unit) once you've written a real solved reference and want CI
to start checking it.

Refuses to overwrite an existing unit unless --force is given.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MONOREPO_ROOT = ROOT.parent
HARNESS = MONOREPO_ROOT / "engr183-harness"

UNSOLVED_STUB_TEMPLATE = """function varargout = {fn}(varargin)
%{FN}  TODO: one-line description of what this function does.
%
%   Examples:
%       {fn}(...)  ->  ...

  % TODO: replace the line below with your solution.
  error('{fn} is not implemented yet. Open {fn}.m and write your code.');

end
"""

SOLVED_PLACEHOLDER_TEMPLATE = """function varargout = {fn}(varargin)
%{FN}  Reference solution, used only to verify the harness locally --
%   never shipped to students. See ../../README.md.

  % TODO: write a working reference solution so run.m/regenerate_golden.m
  % can verify this unit's rubric criteria.
  error('{fn} solved reference not written yet.');

end
"""

TESTS_TEMPLATE = """function specs = {unit}_tests()
%{UNIT}_TESTS  Rubric criteria for Unit {n}: {title}.
%
%   TODO: describe what this unit teaches.

  S = @engr183.spec;   % shorthand: name, fn, args, expected, points [, tol]

  specs = {{ ...
{spec_lines}
  }};
end
"""

SPEC_LINE_TEMPLATE = """    S('TODO: describe what {fn} should do', ...
      '{fn}', {{}}, [], 5), ..."""


def unit_id(n: str) -> str:
    if not n.isdigit():
        print(f"Error: unit number must be numeric, got {n!r}", file=sys.stderr)
        sys.exit(1)
    return f"unit{int(n):02d}"


def write_new(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        print(f"Error: {path} already exists. Re-run with --force to overwrite.", file=sys.stderr)
        sys.exit(1)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"wrote {path.relative_to(MONOREPO_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("number", help="unit number, e.g. 02")
    parser.add_argument("--functions", required=True, help="comma-separated function names, e.g. sumRange,isPrime")
    parser.add_argument("--title", default=None, help='e.g. "Loops and Conditionals" (default: "Unit N")')
    parser.add_argument("--description", default=None, help="one-line problem statement (default: TODO placeholder)")
    parser.add_argument("--force", action="store_true", help="overwrite an existing unit")
    args = parser.parse_args()

    unit = unit_id(args.number)
    n = int(args.number)
    fns = [f.strip() for f in args.functions.split(",") if f.strip()]
    if not fns:
        print("Error: --functions must list at least one function name.", file=sys.stderr)
        sys.exit(1)

    title = args.title or f"Unit {n}"
    description = args.description or "TODO: write the problem statement for this unit."

    for fn in fns:
        write_new(
            HARNESS / "assignments" / unit / f"{fn}.m",
            UNSOLVED_STUB_TEMPLATE.format(fn=fn, FN=fn.upper()),
            args.force,
        )
        write_new(
            HARNESS / "_verify" / "unsolved" / unit / f"{fn}.m",
            UNSOLVED_STUB_TEMPLATE.format(fn=fn, FN=fn.upper()),
            args.force,
        )
        write_new(
            HARNESS / "_verify" / "solved" / unit / f"{fn}.m",
            SOLVED_PLACEHOLDER_TEMPLATE.format(fn=fn, FN=fn.upper()),
            args.force,
        )

    spec_lines = "\n".join(SPEC_LINE_TEMPLATE.format(fn=fn) for fn in fns)
    write_new(
        HARNESS / "tests" / f"{unit}_tests.m",
        TESTS_TEMPLATE.format(unit=unit, UNIT=unit.upper(), n=n, title=title, spec_lines=spec_lines),
        args.force,
    )

    unit_json = {
        "id": unit,
        "title": f"Unit {n} — {title}" if args.title else title,
        "description": description,
        "files": [f"{fn}.m" for fn in fns],
    }
    write_new(
        ROOT / "src" / "units" / f"{unit}.json",
        json.dumps(unit_json, indent=2, ensure_ascii=False) + "\n",
        args.force,
    )

    print(f"\n{unit} scaffolded. Next steps:")
    print(f"  1. Edit assignments/{unit}/*.m (signatures, docs) and tests/{unit}_tests.m (real criteria).")
    print(f"  2. Write real solutions in _verify/solved/{unit}/*.m.")
    print(f"  3. Verify: octave-cli --eval \"setup; runUnitFilter='{unit}'; run('_verify/run.m')\"")
    print(f"  4. Once happy: octave-cli --eval \"setup; regenUnitFilter='{unit}'; run('_verify/regenerate_golden.m')\"")
    print("  5. python scripts/sync_harness.py (from octave-playground/) to vendor it into the app.")
    print(f"  6. Add \"{unit}\" wherever the app's unit list lives once that exists (see M2 T2.5, unit index).")


if __name__ == "__main__":
    main()
