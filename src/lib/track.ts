/**
 * First-party visit beacon. Fires once per page load to /api/track so the admin
 * dashboard can show site traffic. Demo opens are flagged with ?type=demo. Uses
 * sendBeacon so it never blocks navigation, and fails silently.
 */
import { apiBase, demoMode } from './socialApi'

let sent = false

export function trackVisit(): void {
  if (sent) return
  // A backend exists in production, or in dev when an API base is configured.
  const hasBackend = import.meta.env.PROD || apiBase !== ''
  if (!hasBackend) return
  sent = true
  const url = `${apiBase}/api/track${demoMode ? '?type=demo' : ''}`
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url)
    } else {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
    }
  } catch {
    /* tracking must never break the app */
  }
}
