#!/usr/bin/env bash
# Populate public/xeus/ by mirroring the already-built kernel assets from a
# live deploy, instead of building them locally with micromamba +
# `jupyter lite build` (scripts/build-kernel-assets.sh).
#
# Use this when you can't run the real build -- e.g. native Windows, where
# build-kernel-assets.sh refuses to run (the emscripten-forge packages
# contain Unix symlinks Windows can't extract) and WSL isn't available.
#
# The kernel assets are versioned/pinned (environment.yml -> the deploy that
# built them), so mirroring a deploy gives byte-identical WASM to what CI
# builds. The one caveat: kernel_packages/mount_0.tar.gz is the *deployed*
# vfs/engr183 snapshot, so `Run Tests` inside a locally-served build runs
# the harness as it exists on that deploy, NOT your local edits to
# engr183-harness/. For testing app code (src/) that's irrelevant; for
# testing harness changes, use the deploy pipeline or desktop Octave.
#
#   scripts/fetch-kernel-assets-from-deploy.sh [BASE_URL]
#
# BASE_URL defaults to production. Pass the -dev URL to mirror staging.
set -euo pipefail

BASE="${1:-https://dinocrates.github.io/ENGR-183-Tools/octave-playground}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

KDIR="public/xeus/xeus-kernel"
mkdir -p "$KDIR/bin" "$KDIR/xoctave" "$KDIR/kernel_packages"

# Fixed set of runtime-fetched files, confirmed by capturing every network
# request during a full kernel boot + Run Tests against the live deploy.
FILES=(
  "xeus-kernel/bin/xoctave.js"
  "xeus-kernel/bin/xoctave.wasm"
  "xeus-kernel/libxeus.so"
  "xeus-kernel/xoctave/libz.so"
  "xeus-kernel/empack_env_meta.json"
)

# kernel_packages/* -- the 11 conda packages named in empack_env_meta.json,
# plus mount_0.tar.gz (the vfs mount).
PKGS=(
  emscripten-abi-3.1.73-h267e887_12
  narwhals-2.25.0-pyhcf101f3_0
  nlohmann_json-abi-3.12.0-h0f90c79_2
  octave-10.3.0-pl5321h9022273_3
  packaging-26.3-pyhc364b38_0
  plotly-6.9.0-pyhd8ed1ab_0
  python-3.13.1-h_c8de616_6_cp313
  python_abi-3.13.1-1_cp313
  xeus-5.2.8-h2072262_0
  xeus-octave-0.6.2-h597c0b5_2
  zlib-1.3.1-h4e94343_2
)
for p in "${PKGS[@]}"; do FILES+=("xeus-kernel/kernel_packages/${p}.tar.gz"); done
FILES+=("xeus-kernel/kernel_packages/mount_0.tar.gz")

for f in "${FILES[@]}"; do
  dest="public/xeus/${f}"
  echo "  $f"
  curl -fsSL "${BASE}/xeus/${f}" -o "$dest"
done

echo "Fetched $(( ${#FILES[@]} )) files into public/xeus/."
node scripts/vendor-worker-assets.mjs
echo "done."
