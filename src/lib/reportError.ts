/**
 * Fire-and-forget error reporter. Sends errors a user hit to /api/track-error
 * so they show up in the admin Errors tab. Never throws and never blocks.
 */
import { auth } from './firebase'
import { apiBase } from './socialApi'

// Noisy browser errors that are not actionable.
const IGNORE = /ResizeObserver loop|Script error\.?$|Load failed$/i

// The most recent reported error, so the Feedback widget can attach context.
let lastError: { context: string; message: string; at: number } | null = null
export function getLastError() {
  return lastError
}

export function reportError(context: string, detail?: string, platform?: string): void {
  const hasBackend = import.meta.env.PROD || apiBase !== ''
  if (!hasBackend) return
  const message = String(detail || '').trim()
  if (IGNORE.test(message) || IGNORE.test(context)) return
  lastError = { context: String(context || 'app'), message: message.slice(0, 200), at: Date.now() }

  let email: string | null = null
  try {
    email = auth?.currentUser?.email ?? null
  } catch {
    /* auth not ready */
  }

  const body = JSON.stringify({
    context: String(context || 'app').slice(0, 200),
    message: message.slice(0, 1000),
    email,
    platform: platform || null,
    url: typeof location !== 'undefined' ? location.pathname + location.hash : '',
  })

  try {
    fetch(`${apiBase}/api/track-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* reporting must never break the app */
  }
}
