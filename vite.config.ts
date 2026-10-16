/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // api mode: the dev server forwards /api to the COIN API (npm run dev:api)
  const api = env.VITE_DATA_MODE === 'api' ? env.VITE_API_PROXY || 'http://localhost:8787' : undefined
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 8742, strictPort: true, host: 'localhost', ...(api ? { proxy: { '/api': { target: api } } } : {}) },
    preview: { port: 8742, strictPort: true, ...(api ? { proxy: { '/api': { target: api } } } : {}) },
    // unit tests exercise the workflow engine in the browser store; the API has its own tests in server/test
    test: { env: { VITE_DATA_MODE: 'local' } },
  }
})
