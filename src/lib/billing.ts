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

/** Format a subscription period-end timestamp (ms) as e.g. "June 25, 2026". */
export function formatPlanDate(ms?: number | null): string | null {
  if (!ms) return null
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return null
  }
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

/**
 * Confirm a finished Checkout Session on return from Stripe, so the plan
 * updates immediately without waiting on the webhook. Returns the new plan
 * status, or null if it could not be confirmed.
 */
export async function confirmCheckout(sessionId: string): Promise<PlanStatus | null> {
  try {
    const r = await fetch(`${apiBase}/api/billing/confirm`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    return r.ok ? r.json() : null
  } catch {
    return null
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
