/**
 * Per-user settings sync. Mirrors the localStorage keys the app persists to the
 * backend (keyed by Firebase UID) so a user's data follows them across devices.
 * Only active when Firebase is configured and we are not in demo mode.
 */
import { auth } from './firebase'
import { apiBase, backendEnabled } from './socialApi'

/** The localStorage keys that make up a user's portable workspace. */
export const SYNC_KEYS = [
  'sl_profile',
  'sl_plan',
  'sl_posts',
  'sl_stories',
  'sl_reels',
  'sl_bio_title',
  'sl_bio_links',
  'sl_default_descriptions',
  'sl_notif_prefs',
  'sl_demo_pref',
]

/**
 * Every per-account localStorage key (synced plus local-only). Wiped when a
 * different account signs in on the same browser, so one account never shows
 * another's data.
 */
export const PURGE_KEYS = [
  ...SYNC_KEYS,
  'sl_campaigns',
  'sl_onboarding',
  'sl_billing_snap',
  'sl_growth_level',
  'sl_bio_profile',
  'sl_branded_domain',
  'sl_read_comments',
  'sl_recurring_slot',
  'schedlytics_links_v1',
]

/** Remove all per-account local data (on logout or account switch). */
export function clearLocalUserData() {
  for (const key of PURGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

export type Snapshot = Record<string, unknown>

/** Read the synced keys out of localStorage into a plain object. */
export function snapshot(): Snapshot {
  const out: Snapshot = {}
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      try {
        out[key] = JSON.parse(raw)
      } catch {
        /* skip malformed entry */
      }
    }
  }
  return out
}

/** Write a server snapshot back into localStorage. */
export function applySnapshot(blob: Snapshot) {
  for (const key of SYNC_KEYS) {
    if (key in blob) {
      try {
        localStorage.setItem(key, JSON.stringify(blob[key]))
      } catch {
        /* storage full / blocked - ignore */
      }
    }
  }
}

async function idToken(): Promise<string | null> {
  try {
    return (await auth?.currentUser?.getIdToken()) ?? null
  } catch {
    return null
  }
}

// When the server isn't configured for sync (501), stop trying for this session.
let syncUnavailable = false
export function isSyncAvailable() {
  return !syncUnavailable
}

/** Fetch the user's stored settings, or null if none / unavailable. */
export async function pullSettings(): Promise<Snapshot | null> {
  if (!backendEnabled || syncUnavailable) return null
  const token = await idToken()
  if (!token) return null
  try {
    const res = await fetch(`${apiBase}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 501) {
      syncUnavailable = true
      return null
    }
    if (!res.ok) return null
    const data = (await res.json()) as { settings?: Snapshot | null }
    return data.settings ?? null
  } catch {
    return null
  }
}

/** Push the current snapshot to the backend. Returns whether it succeeded. */
export async function pushSettings(blob: Snapshot): Promise<boolean> {
  if (!backendEnabled || syncUnavailable) return false
  const token = await idToken()
  if (!token) return false
  try {
    const res = await fetch(`${apiBase}/api/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: blob }),
      keepalive: true,
    })
    if (res.status === 501) syncUnavailable = true
    return res.ok
  } catch {
    return false
  }
}
