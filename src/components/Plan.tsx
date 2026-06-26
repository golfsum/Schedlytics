import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSeededState } from '../lib/usePersisted'
import { sampleData, backendEnabled } from '../lib/socialApi'
import { auth } from '../lib/firebase'
import { fetchPlanStatus, confirmCheckout, type PlanStatus } from '../lib/billing'
import PlanCelebration from './PlanCelebration'

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

/** A one-off plan event to celebrate or confirm in the UI. */
export interface Celebration {
  kind: 'upgraded' | 'changed' | 'canceled'
  plan: PlanId
  periodEnd?: number | null
}

interface PlanContextValue {
  plan: PlanId
  setPlan: (plan: PlanId) => void
  /** Full billing status from Stripe (cancel date etc.), when available. */
  status: PlanStatus | null
  /** Trigger the celebration overlay (used by the demo upgrade path). */
  celebrate: (c: Celebration) => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

// Remembers the last seen plan + cancel flag so we can detect changes between
// loads (upgrade, plan switch, cancellation) and celebrate them once.
const SNAP_KEY = 'sl_billing_snap'

const isPaidPlan = (p: PlanId) => p === 'pro' || p === 'business'

/**
 * The account's current plan. Demo mode shows Creator; real accounts read their
 * live plan from Stripe (and fall back to the locally stored value while that
 * loads or when billing is not configured on the server). Plan changes since
 * the last visit are surfaced with a celebration or a cancellation notice.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useSeededState<PlanId>('sl_plan', 'pro', 'free')
  const [status, setStatus] = useState<PlanStatus | null>(null)
  const [celebration, setCelebration] = useState<Celebration | null>(null)

  useEffect(() => {
    if (sampleData || !backendEnabled || !auth) return
    let cancelled = false

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

    const readSnap = (): { plan: PlanId; cancel: boolean } | null => {
      try {
        const raw = localStorage.getItem(SNAP_KEY)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    }
    const writeSnap = (p: PlanId, cancel: boolean) => {
      try {
        localStorage.setItem(SNAP_KEY, JSON.stringify({ plan: p, cancel }))
      } catch {
        /* storage unavailable - ignore */
      }
    }

    // Reconcile fetched status into state, and decide whether to celebrate.
    const apply = (s: PlanStatus, paid: boolean) => {
      if (cancelled) return
      setPlan(s.plan)
      setStatus(s)
      const snap = readSnap()
      const cancel = Boolean(s.cancelAtPeriodEnd)
      let celeb: Celebration | null = null
      if (paid && isPaidPlan(s.plan)) {
        // Came back from a successful Checkout.
        const switched = Boolean(snap && snap.plan !== 'free' && snap.plan !== s.plan)
        celeb = { kind: switched ? 'changed' : 'upgraded', plan: s.plan, periodEnd: s.currentPeriodEnd }
      } else if (snap) {
        if (cancel && !snap.cancel) {
          celeb = { kind: 'canceled', plan: s.plan, periodEnd: s.currentPeriodEnd }
        } else if (isPaidPlan(s.plan) && !cancel && snap.plan !== 'free' && snap.plan !== s.plan) {
          celeb = { kind: 'changed', plan: s.plan, periodEnd: s.currentPeriodEnd }
        }
      }
      if (celeb) setCelebration(celeb)
      writeSnap(s.plan, cancel)
    }

    const sync = async () => {
      // After Checkout, confirm the session directly so the plan (and the
      // celebration) appear immediately without waiting on the webhook.
      if (justPaid && sessionId) {
        const confirmed = await confirmCheckout(sessionId)
        if (!cancelled && confirmed && confirmed.plan) {
          apply(confirmed, true)
          cleanUrl()
          return
        }
      }
      const s = await fetchPlanStatus()
      if (!cancelled && s && s.plan) apply(s, false)
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

  return (
    <PlanContext.Provider value={{ plan, setPlan, status, celebrate: (c) => setCelebration(c) }}>
      {children}
      <PlanCelebration celebration={celebration} onClose={() => setCelebration(null)} />
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider')
  return ctx
}
