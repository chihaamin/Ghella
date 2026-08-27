import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * The EU agri-food price API answers with an EMPTY Access-Control-Allow-Origin
 * header, so browsers refuse it cross-origin. The app therefore calls it via
 * this same-origin path; any production host must map the same prefix (one
 * nginx/Netlify/Vercel rewrite). Every other data source is CORS-open and
 * fetched directly.
 */
const EU_AGRIFOOD_PROXY = {
  '/eu-agrifood': {
    target: 'https://api.tech.ec.europa.eu/agrifood/api',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/eu-agrifood/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy: EU_AGRIFOOD_PROXY },
  preview: { proxy: EU_AGRIFOOD_PROXY },
})
