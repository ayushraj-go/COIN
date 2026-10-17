import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // build stamp: a tab running an older build reloads itself when a newer one opens (src/main.tsx)
  define: { __BUILD__: JSON.stringify(String(Date.now())) },
  server: { port: 8742, strictPort: true, host: 'localhost' },
  preview: { port: 8742, strictPort: true },
})
