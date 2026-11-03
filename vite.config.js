import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// Kindle (and other old e-reader) browsers can't run modern ES module bundles.
// The legacy plugin builds an ES5-compatible bundle plus polyfills and serves
// it via a nomodule fallback, so old browsers get working JS while modern
// browsers keep the normal fast build.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        low: 'low.html',
      },
    },
  },
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'ie >= 11', 'android >= 4.4', 'safari >= 8', 'ios >= 8'],
      modernPolyfills: true,
    }),
  ],
})
