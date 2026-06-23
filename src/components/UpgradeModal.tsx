import { X, Check, Sparkles } from 'lucide-react'
import { useToast } from './Toast'
import { usePlan, type PlanId } from './Plan'

interface UpgradeModalProps {
  onClose: () => void
}

interface Plan {
  id: string
  name: string
  price: string
  blurb: string
  features: string[]
  recommended?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    blurb: 'For growing creators',
    features: ['Unlimited channels', 'AI caption assist', 'Advanced analytics', '5 team seats'],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$79',
    blurb: 'For teams and agencies',
    features: ['Everything in Pro', 'Unlimited team seats', 'Custom reports & exports', 'Priority support', 'API access'],
  },
]

/** Plan-comparison modal triggered by the Upgrade buttons. */
export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  const { addToast } = useToast()
  const { plan: current, setPlan } = usePlan()

  const choose = (plan: Plan) => {
    setPlan(plan.id as PlanId)
    addToast(`🎉 You're on the Schedlytics ${plan.name} plan!`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-cyan-accent">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Upgrade</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">Unlock more with Schedlytics</h2>
            <p className="text-sm text-slate-400">Choose the plan that fits how you grow.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* plans */}
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-5 ${
                plan.recommended
                  ? 'border-cyan-accent/40 bg-cyan-accent/5 ring-1 ring-cyan-accent/20'
                  : 'border-white/10 bg-navy-900/50'
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-2.5 left-5 rounded-full gradient-cyan px-2.5 py-0.5 text-[11px] font-bold text-navy-900">
                  Most popular
                </span>
              )}
              <div className="text-lg font-bold text-white">{plan.name}</div>
              <div className="text-xs text-slate-500">{plan.blurb}</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                <span className="mb-1 text-sm text-slate-500">/ month</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 shrink-0 text-cyan-accent" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choose(plan)}
                disabled={current === plan.id}
                className={`mt-5 rounded-lg py-2.5 text-sm font-bold transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100 ${
                  plan.recommended
                    ? 'gradient-cyan text-navy-900 shadow-glow'
                    : 'border border-white/15 bg-navy-800 text-white hover:bg-navy-700'
                }`}
              >
                {current === plan.id ? 'Current plan' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <p className="border-t border-white/5 px-6 py-4 text-center text-xs text-slate-500">
          Prices in USD. Payment checkout is not connected yet, so your plan changes here without a
          charge.
        </p>
      </div>
    </div>
  )
}
