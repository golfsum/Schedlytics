import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './Auth'
import { firebaseEnabled } from '../lib/firebase'
import { demoMode } from '../lib/socialApi'
import { pullSettings, pushSettings, snapshot, applySnapshot, clearLocalUserData } from '../lib/sync'

// Sync only matters for a real signed-in user (not demo / not local dev).
const syncActive = firebaseEnabled && !demoMode

/**
 * Hydrates localStorage from the user's server settings BEFORE the data
 * providers mount, then pushes local changes back on a debounce. Renders a
 * brief loader during the initial pull so the providers read the synced values.
 */
export function SyncGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const uid = user?.uid ?? null
  const [ready, setReady] = useState(!syncActive)
  const lastPushed = useRef('')

  // (Re)hydrate whenever the signed-in account changes. Showing the loader and
  // keying the children by uid forces every data provider to remount and read
  // the new account's data, so switching accounts never shows the old one.
  useEffect(() => {
    if (!syncActive || loading) return
    if (!uid) {
      setReady(true)
      return
    }
    let cancelled = false
    setReady(false)
    ;(async () => {
      // A different account on this browser: wipe the previous one's local data.
      const prev = localStorage.getItem('sl_uid')
      if (prev && prev !== uid) clearLocalUserData()

      const blob = await pullSettings()
      if (cancelled) return
      if (blob && Object.keys(blob).length) {
        applySnapshot(blob)
      } else {
        // First device for this account: seed the server from local data
        // (empty after a switch-wipe, so nothing leaks across accounts).
        void pushSettings(snapshot())
      }
      try {
        localStorage.setItem('sl_uid', uid)
      } catch {
        /* ignore */
      }
      lastPushed.current = JSON.stringify(snapshot())
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [uid, loading])

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
  }, [ready, uid])

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-navy-900 text-sm text-slate-400">
        Loading your workspace…
      </div>
    )
  }
  // Key by uid so the whole provider tree remounts on an account switch.
  return <Fragment key={uid ?? 'anon'}>{children}</Fragment>
}
