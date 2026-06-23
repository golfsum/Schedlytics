import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './Auth'
import { firebaseEnabled } from '../lib/firebase'
import { demoMode } from '../lib/socialApi'
import { pullSettings, pushSettings, snapshot, applySnapshot } from '../lib/sync'

// Sync only matters for a real signed-in user (not demo / not local dev).
const syncActive = firebaseEnabled && !demoMode

/**
 * Hydrates localStorage from the user's server settings BEFORE the data
 * providers mount, then pushes local changes back on a debounce. Renders a
 * brief loader during the initial pull so the providers read the synced values.
 */
export function SyncGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [ready, setReady] = useState(!syncActive)
  const lastPushed = useRef('')

  // Initial pull once the user is known.
  useEffect(() => {
    if (!syncActive || loading) return
    if (!user) {
      setReady(true)
      return
    }
    let cancelled = false
    ;(async () => {
      const blob = await pullSettings()
      if (cancelled) return
      if (blob && Object.keys(blob).length) {
        applySnapshot(blob)
      } else {
        // First device for this account: seed the server from local data.
        void pushSettings(snapshot())
      }
      lastPushed.current = JSON.stringify(snapshot())
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user, loading])

  // Debounced background push of local changes while signed in.
  useEffect(() => {
    if (!syncActive || !ready || !user) return
    const flush = () => {
      const json = JSON.stringify(snapshot())
      if (json !== lastPushed.current) {
        lastPushed.current = json
        void pushSettings(JSON.parse(json))
      }
    }
    const timer = window.setInterval(flush, 4000)
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [ready, user])

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-navy-900 text-sm text-slate-400">
        Loading your workspace…
      </div>
    )
  }
  return <>{children}</>
}
