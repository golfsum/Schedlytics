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
