import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// COOP/COEP headers enable crossOriginIsolated, which the xeus-octave kernel
// needs to use its SharedArrayBuffer-based worker transport (coincident)
// instead of the comlink fallback, which is broken under Vite -- see
// session.ts's header comment. GitHub Pages can't set these headers directly;
// production needs a COOP/COEP-injecting service worker (T1.1 follow-up).
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
  worker: { format: 'iife' },
})
