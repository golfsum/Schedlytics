import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useSeededState } from '../lib/usePersisted'
import { sampleData, backendEnabled } from '../lib/socialApi'
import { auth } from '../lib/firebase'
import { fetchPlanStatus, confirmCheckout } from '../lib/billing'

export type PlanId = 'free' | 'pro' | 'business'

export interface PlanInfo {
  id: PlanId
  name: string
  price: string
  /** Annual price (omitted for Free). */
  priceAnnual?: string
}

export const PLAN_INFO: Record<PlanId, PlanInfo> = {
  free: { id: 'free', name: 'Free', price: '$0' },
  pro: { id: 'pro', name: 'Creator', price: '$9' },
  business: { id: 'business', name: 'Business', price: '$24' },
}

interface PlanContextValue {
  plan: PlanId
  setPlan: (plan: PlanId) => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

/**
 * The account's current plan. Demo mode shows Creator; real accounts read their
 * live plan from Stripe (and fall back to the locally stored value while that
 * loads or when billing is not configured on the server).
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useSeededState<PlanId>('sl_plan', 'pro', 'free')

  // Reconcile with the real subscription once the user is signed in. Runs on
  // load and whenever auth state changes (e.g. returning from Stripe Checkout).
  useEffect(() => {
    if (sampleData || !backendEnabled || !auth) return
    let cancelled = false

    // When Stripe sends us back with ?billing=success&session_id=..., confirm
    // the purchase directly so the plan updates immediately (the webhook may be
    // delayed or not set up). Strip the params afterwards either way.
    const params = new URLSearchParams(window.location.search)
    const justPaid = params.get('billing') === 'success'
    const sessionId = params.get('session_id')
    const cleanUrl = () => {
      if (!params.has('billing') && !params.has('session_id')) return
      params.delete('billing')
      params.delete('session_id')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }

    const sync = async () => {
      if (justPaid && sessionId) {
        const confirmed = await confirmCheckout(sessionId)
        if (!cancelled && confirmed && confirmed.plan) {
          setPlan(confirmed.plan)
          cleanUrl()
          return
        }
      }
      const status = await fetchPlanStatus()
      if (!cancelled && status && status.plan) setPlan(status.plan)
      cleanUrl()
    }
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) sync()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [setPlan])

  return <PlanContext.Provider value={{ plan, setPlan }}>{children}</PlanContext.Provider>
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider')
  return ctx
}
