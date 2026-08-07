// @jupyterlite/xeus's worker code references a couple of binary assets by
// their exact filename (libz.so, and mambajs-core's unpack-*.wasm), but
// Vite's worker-bundling pipeline doesn't actually copy them into the
// build output -- see M1's kernel session wrapper notes. Vendoring them
// into public/assets/ (unhashed, matching the path the worker requests)
// is the workaround, run before dev/build so it's never stale.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS_DIR = join(ROOT, 'public', 'assets');

mkdirSync(ASSETS_DIR, { recursive: true });

// libz.so: any per-kernel copy works, they're identical; grab the xoctave one.
copyFileSync(
  join(ROOT, 'public', 'xeus', 'xeus-kernel', 'xoctave', 'libz.so'),
  join(ASSETS_DIR, 'libz.so'),
);

// unpack-*.wasm: filename is content-hashed by mambajs-core's own build, so
// find it rather than hardcoding the hash.
const mambaCoreLib = join(ROOT, 'node_modules', '@emscripten-forge', 'mambajs-core', 'lib');
const unpackWasm = readdirSync(mambaCoreLib).find((f) => /^unpack-.*\.wasm$/.test(f));
if (!unpackWasm) {
  throw new Error(`Could not find unpack-*.wasm in ${mambaCoreLib}`);
}
copyFileSync(join(mambaCoreLib, unpackWasm), join(ASSETS_DIR, unpackWasm));

console.log(`vendored libz.so and ${unpackWasm} into public/assets/`);
