import { createContext, useContext, type ReactNode } from 'react'
import { useSeededState } from '../lib/usePersisted'

export type PlanId = 'free' | 'pro' | 'business'

export interface PlanInfo {
  id: PlanId
  name: string
  price: string
}

export const PLAN_INFO: Record<PlanId, PlanInfo> = {
  free: { id: 'free', name: 'Free', price: '$0' },
  pro: { id: 'pro', name: 'Pro', price: '$29' },
  business: { id: 'business', name: 'Business', price: '$79' },
}

interface PlanContextValue {
  plan: PlanId
  setPlan: (plan: PlanId) => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

/**
 * The account's current plan. Demo mode shows Pro; real accounts start on Free
 * and persist any change. (Payment checkout is not wired in this project.)
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useSeededState<PlanId>('sl_plan', 'pro', 'free')
  return <PlanContext.Provider value={{ plan, setPlan }}>{children}</PlanContext.Provider>
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider')
  return ctx
}
