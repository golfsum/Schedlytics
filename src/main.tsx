import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { NotificationsProvider } from './components/Notifications.tsx'
import { ConnectionsProvider } from './components/Connections.tsx'
import { InboxProvider } from './components/Inbox.tsx'
import { AuthProvider, AuthGate } from './components/Auth.tsx'
import { ProfileProvider } from './components/Profile.tsx'
import { PlanProvider } from './components/Plan.tsx'
import { resolveShortLinkRedirect } from './lib/shortLinks.ts'
import './index.css'

// If this load is a client-side short link ({origin}/#/s/<slug>), redirect to
// the target instead of booting the app.
if (!resolveShortLinkRedirect()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <ProfileProvider>
              <PlanProvider>
              <NotificationsProvider>
                <ConnectionsProvider>
                  <InboxProvider>
                    <App />
                  </InboxProvider>
                </ConnectionsProvider>
              </NotificationsProvider>
              </PlanProvider>
            </ProfileProvider>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </StrictMode>,
  )
}
