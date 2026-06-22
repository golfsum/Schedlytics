import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { ConnectionsProvider } from './components/Connections.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ConnectionsProvider>
        <App />
      </ConnectionsProvider>
    </ToastProvider>
  </StrictMode>,
)
