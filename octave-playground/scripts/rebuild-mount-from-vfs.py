#!/usr/bin/env python3
"""LOCAL-ONLY: rebuild public/xeus/.../mount_0.tar.gz from vfs/engr183.

Not part of the build (CI runs build-kernel-assets.sh, which produces this
tarball properly via `jupyter lite build`). On a box that can't run that
-- native Windows, where fetch-kernel-assets-from-deploy.sh mirrors the
kernel image from a live deploy -- mount_0.tar.gz is the *deployed*
vfs/engr183 and won't reflect local engr183-harness edits. Run
scripts/sync_harness.py then this to test a harness change against a
locally-served `npm run build && npm run preview`.

Mimics the jupyterlite-xeus tarball closely enough for the in-browser
extractor: file entries only (no directory members), POSIX ustar format,
stable owner/mtime. A plain `tar czf` (GNU format, with directory
entries) is rejected and the kernel hangs on boot.
"""
import gzip
import io
import os
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "vfs" / "engr183"
TARGETS = [
    ROOT / "public" / "xeus" / "xeus-kernel" / "kernel_packages" / "mount_0.tar.gz",
    ROOT / "dist" / "xeus" / "xeus-kernel" / "kernel_packages" / "mount_0.tar.gz",
]

if not SRC.is_dir():
    sys.exit(f"{SRC} missing -- run scripts/sync_harness.py first.")

files = sorted(p for p in SRC.rglob("*") if p.is_file())
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w", format=tarfile.USTAR_FORMAT) as tar:
    for p in files:
        arc = "engr183/" + str(p.relative_to(SRC)).replace(os.sep, "/")
        ti = tarfile.TarInfo(arc)
        ti.size = p.stat().st_size
        ti.mtime = 1700000000
        ti.mode = 0o644
        ti.uid = ti.gid = 1001
        ti.uname = ti.gname = "runner"
        with open(p, "rb") as fh:
            tar.addfile(ti, fh)

data = gzip.compress(buf.getvalue(), mtime=0)
for t in TARGETS:
    if t.parent.is_dir():
        t.write_bytes(data)
        print(f"wrote {t.relative_to(ROOT)} ({len(data)} bytes, {len(files)} files)")
