import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
// In production the app is served under /app (marketing lives at /), so assets
// must resolve under /app/. In dev it stays at the root for a simple workflow.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  plugins: [
    react(),
    // Installable PWA for the dashboard (scope /app/). autoUpdate keeps the
    // installed app fresh: a new deploy's service worker activates and reloads.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Schedlytics',
        short_name: 'Schedlytics',
        description: 'Schedule posts, track clicks, and see which content drives traffic.',
        id: '/app/',
        scope: '/app/',
        start_url: '/app/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F172A',
        theme_color: '#0F172A',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // SPA: serve the app shell for client-side routes. Keep the API and
        // OAuth/short-link paths off the SW so those requests pass through.
        navigateFallback: '/app/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/s\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    // Honor an injected PORT (used by tooling); fall back to a fixed dev port.
    port: process.env.PORT ? Number(process.env.PORT) : 5185,
    open: false,
  },
}))
