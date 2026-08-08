#!/usr/bin/env python3
"""Vendor engr183-harness/ into octave-playground/vfs and public/starters.

Source of truth is ../engr183-harness (same monorepo). This script copies:
    engr183-harness/+engr183/    -> vfs/engr183/+engr183/
    engr183-harness/tests/       -> vfs/engr183/tests/
    engr183-harness/assignments/ -> public/starters/

public/starters/ (not a bare starters/) because the React app fetches
starter content at runtime to seed the browser drive on first visit --
it has to be under public/ to be servable as a static asset.

and records the source commit SHA in vfs/engr183/HARNESS_VERSION.

Refuses to overwrite a destination that was hand-modified since the last
sync (tracked via scripts/.sync_manifest.json) unless --force is given.
"""

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MONOREPO_ROOT = ROOT.parent
HARNESS_SRC = MONOREPO_ROOT / "engr183-harness"
MANIFEST_PATH = ROOT / "scripts" / ".sync_manifest.json"

# public/starters/scratch/ is hand-authored (the Scratch Pad's starter, see
# src/units/index.ts's scratchUnit) -- it has no engr183-harness counterpart,
# so it's excluded from both the wipe-and-resync and the drift manifest,
# leaving it untouched by every sync run.
SYNC_PAIRS = [
    (HARNESS_SRC / "+engr183", ROOT / "vfs" / "engr183" / "+engr183", frozenset()),
    (HARNESS_SRC / "tests", ROOT / "vfs" / "engr183" / "tests", frozenset()),
    (HARNESS_SRC / "assignments", ROOT / "public" / "starters", frozenset({"scratch"})),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def collect_files(base: Path, exclude: frozenset[str] = frozenset()) -> dict[str, str]:
    if not base.exists():
        return {}
    result: dict[str, str] = {}
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(base)
        if rel.parts and rel.parts[0] in exclude:
            continue
        result[str(rel)] = sha256_file(p)
    return result


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {}


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True))


def check_for_local_drift(manifest: dict, force: bool) -> None:
    drifted = []
    for _src, dest, preserve in SYNC_PAIRS:
        key = str(dest.relative_to(ROOT))
        recorded = manifest.get(key, {})
        current = collect_files(dest, exclude=preserve)
        for rel_path, recorded_hash in recorded.items():
            current_hash = current.get(rel_path)
            if current_hash != recorded_hash:
                drifted.append(f"{key}/{rel_path}")
    if drifted and not force:
        print("Refusing to sync: local modifications detected since the last sync:", file=sys.stderr)
        for path in drifted:
            print(f"  - {path}", file=sys.stderr)
        print("\nRe-run with --force to overwrite, or revert these files yourself first.", file=sys.stderr)
        sys.exit(1)


def get_harness_sha() -> str:
    result = subprocess.run(
        ["git", "log", "-1", "--format=%H", "--", "engr183-harness"],
        cwd=MONOREPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    sha = result.stdout.strip()
    if not sha:
        return "uncommitted"
    return sha


def sync_dir(src: Path, dest: Path, preserve: frozenset[str] = frozenset()) -> None:
    if not src.exists():
        print(f"Warning: source {src} does not exist, skipping.", file=sys.stderr)
        return
    dest.mkdir(parents=True, exist_ok=True)
    for entry in dest.iterdir():
        if entry.name in preserve:
            continue
        shutil.rmtree(entry) if entry.is_dir() else entry.unlink()
    for entry in src.iterdir():
        target = dest / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target)
        else:
            shutil.copy2(entry, target)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="overwrite local modifications")
    args = parser.parse_args()

    if not HARNESS_SRC.exists():
        print(f"Error: {HARNESS_SRC} not found.", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest()
    check_for_local_drift(manifest, args.force)

    new_manifest: dict[str, dict[str, str]] = {}
    for src, dest, preserve in SYNC_PAIRS:
        sync_dir(src, dest, preserve=preserve)
        key = str(dest.relative_to(ROOT))
        new_manifest[key] = collect_files(dest, exclude=preserve)
        print(f"synced {src.relative_to(MONOREPO_ROOT)} -> {dest.relative_to(ROOT)} ({len(new_manifest[key])} files)")

    sha = get_harness_sha()
    version_file = ROOT / "vfs" / "engr183" / "HARNESS_VERSION"
    version_file.parent.mkdir(parents=True, exist_ok=True)
    version_file.write_text(sha + "\n")
    print(f"recorded HARNESS_VERSION: {sha}")

    save_manifest(new_manifest)
    print("done.")


if __name__ == "__main__":
    main()
