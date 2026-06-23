import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// In production the app is served under /app (marketing lives at /), so assets
// must resolve under /app/. In dev it stays at the root for a simple workflow.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  plugins: [react()],
  server: {
    // Honor an injected PORT (used by tooling); fall back to a fixed dev port.
    port: process.env.PORT ? Number(process.env.PORT) : 5185,
    open: false,
  },
}))
