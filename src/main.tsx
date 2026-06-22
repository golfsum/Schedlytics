import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { ConnectionsProvider } from './components/Connections.tsx'
import { resolveShortLinkRedirect } from './lib/shortLinks.ts'
import './index.css'

// If this load is a client-side short link ({origin}/#/s/<slug>), redirect to
// the target instead of booting the app.
if (!resolveShortLinkRedirect()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <ConnectionsProvider>
          <App />
        </ConnectionsProvider>
      </ToastProvider>
    </StrictMode>,
  )
}
