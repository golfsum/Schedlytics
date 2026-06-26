import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSeededState } from '../lib/usePersisted'
import { sampleData, backendEnabled } from '../lib/socialApi'
import { auth } from '../lib/firebase'
import { fetchPlanStatus, confirmCheckout, openBillingPortal, type PlanStatus } from '../lib/billing'
import { useToast } from './Toast'
import { AlertTriangle, Loader2 } from 'lucide-react'
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

/** Plan ranking for gating: free < pro (Creator) < business. */
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2 }

/** Premium features and the minimum plan that unlocks each (single source of
 *  truth for paywall checks across the app). */
export type Feature =
  | 'unlimited-links'
  | 'unlimited-campaigns'
  | 'ai-publishing'
  | 'link-in-bio'
  | 'qr-tools'
  | 'branded-domain'
  | 'team'
  | 'revenue-tracking'
  | 'advanced-reports'
  | 'csv-export'

export const FEATURE_MIN_PLAN: Record<Feature, PlanId> = {
  'unlimited-links': 'pro',
  'unlimited-campaigns': 'pro',
  'ai-publishing': 'pro',
  'link-in-bio': 'pro',
  'qr-tools': 'pro',
  'branded-domain': 'business',
  team: 'business',
  'revenue-tracking': 'business',
  'advanced-reports': 'business',
  'csv-export': 'business',
}

/** Whether a plan unlocks a feature. */
export const planAllows = (plan: PlanId, feature: Feature) =>
  PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]]

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
  /** Whether the current plan unlocks a premium feature. */
  can: (feature: Feature) => boolean
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
  const { addToast } = useToast()
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

    const justCanceled = params.get('billing') === 'cancel'

    const sync = async () => {
      // Returned from Checkout without paying.
      if (justCanceled) {
        addToast('Checkout canceled. No changes were made.')
        cleanUrl()
        const s = await fetchPlanStatus()
        if (!cancelled && s && s.plan) apply(s, false)
        return
      }
      // After Checkout, confirm the session directly so the plan (and the
      // celebration) appear immediately without waiting on the webhook.
      if (justPaid && sessionId) {
        const confirmed = await confirmCheckout(sessionId)
        if (!cancelled && confirmed && isPaidPlan(confirmed.plan)) {
          apply(confirmed, true)
          cleanUrl()
          return
        }
        // Payment likely went through but the plan is not active yet (webhook /
        // confirm lag). Reassure the user, then poll briefly for activation.
        if (!cancelled) addToast('Payment received. Your plan is being activated. This usually takes a few seconds.')
        cleanUrl()
        for (let i = 0; i < 4 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 2500))
          const s = await fetchPlanStatus()
          if (!cancelled && s && isPaidPlan(s.plan)) {
            apply(s, true)
            return
          }
        }
        return
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
    <PlanContext.Provider
      value={{ plan, setPlan, status, can: (f) => planAllows(plan, f), celebrate: (c) => setCelebration(c) }}
    >
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

/**
 * Persistent banner shown when the subscription payment failed (Stripe
 * `past_due`). The plan is NOT downgraded silently; we explain the issue and
 * link to the Billing Portal to fix the card.
 */
export function BillingBanner() {
  const { status } = usePlan()
  const { addToast } = useToast()
  const [busy, setBusy] = useState(false)
  if (!status || status.status !== 'past_due') return null

  const manage = async () => {
    setBusy(true)
    const err = await openBillingPortal()
    if (err) {
      setBusy(false)
      addToast(err)
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-200">Payment issue</p>
        <p className="text-sm text-amber-100/80">
          Your subscription payment needs attention. Update billing to keep premium features active.
        </p>
      </div>
      <button
        onClick={manage}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-navy-900 hover:bg-amber-300 disabled:opacity-70 sm:w-auto"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Manage Billing
      </button>
    </div>
  )
}
