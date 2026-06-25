/**
 * Admin + support API client. Admin calls carry the signed-in user's Firebase
 * ID token; the server checks the verified email against ADMIN_EMAILS.
 */
import { auth } from './firebase'
import { apiBase, backendEnabled } from './socialApi'

async function token(): Promise<string | null> {
  try {
    return (await auth?.currentUser?.getIdToken()) ?? null
  } catch {
    return null
  }
}
async function authHeaders(): Promise<Record<string, string>> {
  const t = await token()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** Whether the signed-in user may open the Admin page. */
export async function fetchAdminMe(): Promise<boolean> {
  if (!backendEnabled) return false
  try {
    const r = await fetch(`${apiBase}/api/admin/me`, { headers: await authHeaders() })
    return r.ok ? Boolean((await r.json()).admin) : false
  } catch {
    return false
  }
}

export interface TrafficStat {
  views: number
  uniques: number
  /** View counts split by source. */
  site: number
  app: number
  demo: number
}
export interface AnalyticsData {
  today: TrafficStat
  week: TrafficStat
  month: TrafficStat
  series: { day: string; views: number; uniques: number; demo: number }[]
  driver: string
}
export async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/analytics`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}

export interface Banner {
  message: string
  type: 'info' | 'warning'
  active: boolean
  at: number
}
/** Public: the active broadcast banner (no auth). */
export async function fetchBanner(): Promise<Banner | null> {
  if (!backendEnabled) return null
  try {
    const r = await fetch(`${apiBase}/api/banner`)
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}
export async function setBanner(message: string, type: 'info' | 'warning'): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/admin/banner`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, type }),
    })
    return r.ok
  } catch {
    return false
  }
}
export async function clearBanner(): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/admin/banner`, { method: 'DELETE', headers: await authHeaders() })
    return r.ok
  } catch {
    return false
  }
}

export interface OverviewData {
  viewsToday: number
  uniquesToday: number
  demoToday: number
  signups: number
  accepted: number
  waitlist: number
  openTickets: number
  totalTickets: number
  errors24h: number
  errorsTotal: number
}
export async function fetchOverview(): Promise<OverviewData | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/overview`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}

export interface HealthCheck {
  name: string
  category: string
  ok: boolean
  status: number
  latencyMs?: number
  detail?: string
}
export interface HealthData {
  checks: HealthCheck[]
  at: number
}
export async function fetchHealth(): Promise<HealthData | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/health`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}
export async function sendTestEmail(): Promise<{ ok: boolean; to?: string; error?: string }> {
  try {
    const r = await fetch(`${apiBase}/api/admin/send-test-email`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await r.json().catch(() => ({}))
    return r.ok ? { ok: true, to: body.to } : { ok: false, error: body.error || `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'request failed' }
  }
}

export interface ErrorGroup {
  context: string
  message: string
  count: number
  lastAt: number
  users: number
  acked: boolean
}
export async function ackError(context: string, message: string, acked: boolean): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/admin/errors/ack`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, message, acked }),
    })
    return r.ok
  } catch {
    return false
  }
}
export interface ErrorEvent {
  id: string
  at: number
  context: string
  message: string
  email: string | null
  platform: string | null
  url: string | null
  source: string
}
export interface ErrorsData {
  total: number
  last24h: number
  affectedUsers: number
  topGroups: ErrorGroup[]
  topUsers: { email: string; count: number }[]
  recent: ErrorEvent[]
  driver: string
}
export async function fetchErrors(): Promise<ErrorsData | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/errors`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}
export async function clearErrors(): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/admin/errors`, { method: 'DELETE', headers: await authHeaders() })
    return r.ok
  } catch {
    return false
  }
}
export async function downloadErrorsCsv(): Promise<void> {
  const r = await fetch(`${apiBase}/api/admin/errors?format=csv`, { headers: await authHeaders() })
  if (!r.ok) return
  const blob = new Blob([await r.text()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'errors.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface EASignup {
  email: string
  status: 'accepted' | 'waitlist'
  at: number
}
export interface EAData {
  total: number
  accepted: number
  waitlist: number
  cap: number
  signups: EASignup[]
}
export async function fetchEarlyAccess(): Promise<EAData | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/early-access`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}
export async function downloadEarlyAccessCsv(): Promise<void> {
  const r = await fetch(`${apiBase}/api/admin/early-access?format=csv`, { headers: await authHeaders() })
  if (!r.ok) return
  const blob = new Blob([await r.text()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'early-access.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface Ticket {
  id: string
  email: string
  subject: string
  message: string
  status: 'open' | 'resolved'
  at: number
}
export async function fetchSupport(): Promise<Ticket[]> {
  try {
    const r = await fetch(`${apiBase}/api/admin/support`, { headers: await authHeaders() })
    return r.ok ? (await r.json()).tickets : []
  } catch {
    return []
  }
}
export async function setTicketStatus(id: string, status: 'open' | 'resolved'): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/admin/support/${id}`, {
      method: 'PATCH',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    return r.ok
  } catch {
    return false
  }
}

export interface AdminUser {
  uid: string
  email: string
  displayName: string
  photoURL: string
  disabled: boolean
  emailVerified: boolean
  providers: string[]
  createdAt: number | null
  lastSignInAt: number | null
}
export interface UsersResult {
  configured: boolean
  users: AdminUser[]
  /** Server-side failure detail (e.g. a bad service-account key), when present. */
  error?: string
}
/** List Firebase Auth users (needs a service account on the server). */
export async function fetchUsers(): Promise<UsersResult | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/users`, { headers: await authHeaders() })
    if (r.ok) return r.json()
    const body = await r.json().catch(() => ({}))
    return { configured: true, users: [], error: body.detail || body.error || `HTTP ${r.status}` }
  } catch {
    return null
  }
}
/** Send a password-reset link to a user. Returns the link (and whether it was emailed). */
export async function sendPasswordReset(email: string): Promise<{ link: string; emailed: boolean } | null> {
  try {
    const r = await fetch(`${apiBase}/api/admin/users/reset-link`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}
/** Enable or disable a user account. */
export async function setUserDisabled(uid: string, disabled: boolean): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/admin/users/${uid}`, {
      method: 'PATCH',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled }),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Submit a support ticket (any signed-in user). */
export async function submitSupport(email: string, subject: string, message: string): Promise<boolean> {
  if (!backendEnabled) return false
  try {
    const r = await fetch(`${apiBase}/api/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, subject, message }),
    })
    return r.ok
  } catch {
    return false
  }
}
