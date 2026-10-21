/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-bundle every dependency the pages use at startup. Pages load on demand, and without this
  // the dev server finds new ones the first time a page opens and reloads that tab mid-load.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.tsx'],
  },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
