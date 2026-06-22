import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor an injected PORT (used by tooling); fall back to a fixed dev port.
    port: process.env.PORT ? Number(process.env.PORT) : 5185,
    open: false,
  },
})
