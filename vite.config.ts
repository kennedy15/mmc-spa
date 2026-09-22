import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /<repo>/, so the base is the repo name.
// Override with VITE_BASE=/ for a local build served from the root.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/maple-tracker/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1500 },
})
