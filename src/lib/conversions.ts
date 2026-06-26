/**
 * Conversion tracking client. Reports come from the backend, which joins each
 * conversion to the link, post, campaign, and platform that earned it. Calls
 * carry the signed-in user's Firebase ID token.
 */
import { auth } from './firebase'
import { apiBase, backendEnabled } from './socialApi'

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const t = (await auth?.currentUser?.getIdToken()) ?? null
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

export interface ConversionBucket {
  key: string
  label: string
  conversions: number
  revenue: number
}
export interface ConversionRow {
  id: string
  at: number
  event: string
  value: number
  currency: string
  attributed: boolean
  slug: string | null
  destination: string | null
  title: string | null
  campaign: string | null
  platform: string | null
  path: string | null
}
export interface ConversionSummary {
  total: number
  revenue: number
  attributed: number
  unattributed: number
  byContent: ConversionBucket[]
  byCampaign: ConversionBucket[]
  byPlatform: ConversionBucket[]
  recent: ConversionRow[]
}

export async function fetchConversionSummary(): Promise<ConversionSummary | null> {
  if (!backendEnabled) return null
  try {
    const r = await fetch(`${apiBase}/api/conversions/summary`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}

export interface ConversionGoal {
  pattern: string
  name: string
}
export interface GoalsResult {
  goals: ConversionGoal[]
  siteKey: string
  snippetUrl: string
}

export async function fetchConversionGoals(): Promise<GoalsResult | null> {
  if (!backendEnabled) return null
  try {
    const r = await fetch(`${apiBase}/api/conversions/goals`, { headers: await authHeaders() })
    return r.ok ? r.json() : null
  } catch {
    return null
  }
}

export async function saveConversionGoals(goals: ConversionGoal[]): Promise<ConversionGoal[] | null> {
  try {
    const r = await fetch(`${apiBase}/api/conversions/goals`, {
      method: 'PUT',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals }),
    })
    return r.ok ? (await r.json()).goals : null
  } catch {
    return null
  }
}

export interface ManualRevenueInput {
  value: number
  currency?: string
  date?: string
  campaign?: string
  contentId?: string
  contentTitle?: string
  platform?: string
  event?: string
  notes?: string
}

/** Record manual revenue / a conversion against a campaign or content item. */
export async function addManualRevenue(input: ManualRevenueInput): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/api/conversions/manual`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Format a currency amount for display (whole dollars, grouped). */
export function money(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0)
  } catch {
    return `$${Math.round(n || 0)}`
  }
}
