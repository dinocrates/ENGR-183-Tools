#!/usr/bin/env bash
# Builds the xeus-octave WASM kernel assets and populates public/xeus/.
#
# Must run on Linux or macOS -- native Windows can't extract the
# emscripten-forge-dev packages (they contain Unix symlinks Windows can't
# create without Developer Mode/admin). On Windows, run this from WSL2. See
# octave-playground/M0-FINDINGS.md T0.1.
#
# Requires micromamba on PATH. Run scripts/sync_harness.py first so vfs/
# and starters/ are populated -- this build mounts vfs/engr183 into the
# kernel image.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d vfs/engr183 ]; then
  echo "vfs/engr183 is missing -- run scripts/sync_harness.py first." >&2
  exit 1
fi

BUILD_ENV_ROOT="${BUILD_ENV_ROOT:-$HOME/micromamba}"
export MAMBA_ROOT_PREFIX="$BUILD_ENV_ROOT"

if ! micromamba env list | grep -q "octave-playground-build"; then
  micromamba create -y -n octave-playground-build -f "$ROOT/.github/build-environment.yml"
fi

rm -rf dist-kernel-build
mkdir -p dist-kernel-build/content
micromamba run -n octave-playground-build jupyter lite build \
  --contents dist-kernel-build/content \
  --output-dir dist-kernel-build/dist

rm -rf public/xeus
cp -r dist-kernel-build/dist/xeus public/xeus
rm -rf dist-kernel-build

node scripts/vendor-worker-assets.mjs

echo "done. public/xeus/ populated."
