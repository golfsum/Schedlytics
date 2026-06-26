import { useMemo } from 'react'
import { Sparkles, PartyPopper, Check } from 'lucide-react'
import { PLAN_INFO, type Celebration } from './Plan'
import { formatPlanDate } from '../lib/billing'

const COLORS = ['#22d3ee', '#0ea5e9', '#a78bfa', '#34d399', '#f472b6', '#ffffff']

/**
 * Full-screen celebration shown after a successful upgrade or plan change
 * (with a confetti burst), or a calmer confirmation when a plan is canceled.
 */
export default function PlanCelebration({
  celebration,
  onClose,
}: {
  celebration: Celebration | null
  onClose: () => void
}) {
  // Build the confetti once per celebration so it does not reshuffle on rerender.
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.2 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.round(Math.random() * 6),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [celebration?.kind, celebration?.plan],
  )

  if (!celebration) return null
  const canceled = celebration.kind === 'canceled'
  const planName = PLAN_INFO[celebration.plan]?.name ?? 'Schedlytics'
  const date = formatPlanDate(celebration.periodEnd)

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {!canceled && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {pieces.map((p, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                top: '-5%',
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.4,
                background: p.color,
                borderRadius: 2,
                animation: `sl-confetti ${p.duration}s linear ${p.delay}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-navy-800 p-7 text-center shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
            canceled ? 'bg-white/5 text-slate-300' : 'gradient-cyan text-navy-900 shadow-glow'
          }`}
        >
          {canceled ? <Check className="h-7 w-7" /> : <PartyPopper className="h-7 w-7" />}
        </div>

        {canceled ? (
          <>
            <h2 className="mt-4 text-xl font-bold text-white">Subscription canceled</h2>
            <p className="mt-2 text-sm text-slate-400">
              You are unsubscribed from {planName}.{' '}
              {date ? (
                <>
                  You keep full access until <span className="font-semibold text-white">{date}</span>,
                  then your account moves to the Free plan.
                </>
              ) : (
                <>You keep access until the end of your current billing period.</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-center gap-2 text-cyan-accent">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {celebration.kind === 'changed' ? 'Plan updated' : 'Welcome aboard'}
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-white">You are on {planName}!</h2>
            <p className="mt-2 text-sm text-slate-400">
              Your {planName} features are unlocked. Time to grow.
            </p>
          </>
        )}

        <button
          onClick={onClose}
          className={`mt-6 w-full rounded-lg py-2.5 text-sm font-bold transition-transform ${
            canceled
              ? 'border border-white/15 bg-navy-900/60 text-white hover:bg-navy-900/90'
              : 'gradient-cyan text-navy-900 shadow-glow hover:scale-[1.02]'
          }`}
        >
          {canceled ? 'Got it' : "Let's go"}
        </button>
      </div>

      <style>{`@keyframes sl-confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}`}</style>
    </div>
  )
}
