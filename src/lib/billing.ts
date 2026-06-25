/**
 * Stripe billing client. Talks to the backend billing routes, which carry the
 * signed-in user's Firebase ID token. Checkout and the portal return a Stripe
 * URL that we redirect the browser to.
 */
import { auth } from './firebase'
import { apiBase, backendEnabled } from './socialApi'
import type { PlanId } from '../components/Plan'

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const t = (await auth?.currentUser?.getIdToken()) ?? null
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

export interface PlanStatus {
  plan: PlanId
  status: string
  currentPeriodEnd?: number | null
  cancelAtPeriodEnd?: boolean
  /** False when the server has no Stripe key (Upgrade falls back to local). */
  billingEnabled?: boolean
}

/** The user's current plan from Stripe. Null when unavailable. */
export async function fetchPlanStatus(): Promise<PlanStatus | null> {
  if (!backendEnabled) return null
  try {
    const r = await fetch(`${apiBase}/api/billing/status`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}

/**
 * Start Stripe Checkout for a paid plan and redirect to it. Returns an error
 * string on failure (so the caller can fall back), or null on success.
 */
export async function startCheckout(plan: PlanId): Promise<string | null> {
  try {
    const r = await fetch(`${apiBase}/api/billing/checkout`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const body = await r.json().catch(() => ({}))
    if (r.ok && body.url) {
      window.location.href = body.url
      return null
    }
    return body.error || `Checkout failed (HTTP ${r.status})`
  } catch (e) {
    return e instanceof Error ? e.message : 'Checkout request failed'
  }
}

/** Open the Stripe Billing Portal to manage or cancel. Returns an error or null. */
export async function openBillingPortal(): Promise<string | null> {
  try {
    const r = await fetch(`${apiBase}/api/billing/portal`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await r.json().catch(() => ({}))
    if (r.ok && body.url) {
      window.location.href = body.url
      return null
    }
    return body.error || `Could not open billing portal (HTTP ${r.status})`
  } catch (e) {
    return e instanceof Error ? e.message : 'Billing portal request failed'
  }
}
