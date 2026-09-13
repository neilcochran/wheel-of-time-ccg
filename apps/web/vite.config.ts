/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  // The card scans are the app's only static assets and already live under
  // data/images, one directory per set. Serving that directory as the public
  // root means a card's image URL is `/<setId>/<image>` in dev and in the
  // build, with nothing copied into the repo twice. The app therefore has no
  // public/ directory of its own; the favicon is inlined in index.html.
  publicDir: fileURLToPath(new URL('../../data/images', import.meta.url)),

  build: {
    // The whole card database is bundled rather than fetched, which is what
    // pushes the main chunk past Vite's default 500 kB warning threshold.
    chunkSizeWarningLimit: 1000,
  },

  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
