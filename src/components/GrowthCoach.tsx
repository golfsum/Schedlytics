import {
  PartyPopper,
  TrendingUp,
  Award,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Zap, Target, Database, ArrowRight, HelpCircle, X } from 'lucide-react'
import { AreaChart } from './charts'
import { PLATFORMS, type GrowthScore, type WeeklyBrief, type Opportunity } from '../data'
import { aiRecommendations } from '../lib/aiSuggest'
import { levelFor } from '../lib/growth'
import type { NavId } from '../types'

/* ------------------------------ growth score ----------------------------- */

const scoreColor = (n: number) => (n >= 80 ? '#34D399' : n >= 60 ? '#22D3EE' : n >= 40 ? '#F59E0B' : '#F87171')
const clampPct = (n: number) => Math.max(0, Math.min(100, n))

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Animate a number from 0 to `target` (easeOutCubic) on mount / when target
 * changes. Uses an elapsed-time interval rather than requestAnimationFrame so it
 * still completes when the tab is backgrounded (rAF is paused while hidden).
 */
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(prefersReducedMotion() ? target : 0)
  const startRef = useRef(0)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(target)
      return
    }
    setVal(0)
    startRef.current = performance.now()
    const id = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - startRef.current) / duration)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p >= 1) window.clearInterval(id)
    }, 32)
    return () => window.clearInterval(id)
  }, [target, duration])
  return val
}

export function GrowthScoreCard({
  data,
  building,
  hero,
}: {
  data: GrowthScore | null
  building?: boolean
  /** Enlarged "hero" treatment for the top of the dashboard. */
  hero?: boolean
}) {
  // Hooks must run on every render (before any early return), so the count-up
  // and ring-fill use a safe target when the score is still building.
  const target = data?.score ?? 0
  const count = useCountUp(target)
  const [showInfo, setShowInfo] = useState(false)
  // Ring fills from empty on mount: start at full offset, then transition in.
  const [filled, setFilled] = useState(prefersReducedMotion())
  useEffect(() => {
    setFilled(prefersReducedMotion())
    const id = window.setTimeout(() => setFilled(true), 40)
    return () => window.clearTimeout(id)
  }, [target])

  if (building || !data) {
    return (
      <div className="card flex flex-col justify-center p-5">
        <h2 className="text-lg font-bold text-white">Growth Level</h2>
        <p className="mt-2 text-sm text-slate-400">
          Building your score. Connect channels, schedule posts, and add trackable links, and your
          Growth Level appears here within a few days of activity.
        </p>
      </div>
    )
  }

  const { score, delta, factors } = data
  const color = scoreColor(score)
  const { current, next } = levelFor(score)
  // Progress from the current level threshold to the next one.
  const span = next ? next.min - current.min : 1
  const pct = next ? clampPct(((score - current.min) / span) * 100) : 100
  // SVG ring geometry
  const r = 52
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c

  return (
    <div className={`card p-5 ${hero ? 'shadow-glow ring-1 ring-cyan-accent/20' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-bold text-white">Growth Level</h2>
          <button
            onClick={() => setShowInfo(true)}
            className="text-slate-500 transition-colors hover:text-cyan-accent"
            title="How is this scored?"
            aria-label="How is the Growth Level scored?"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        {delta !== 0 && (
          <span
            className={`flex animate-slide-in-up items-center gap-1 text-sm font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            style={{ animationDelay: '0.75s' }}
          >
            <ArrowUpRight className={`h-4 w-4 ${delta < 0 ? 'rotate-90' : ''}`} />
            {delta > 0 ? '+' : ''}
            {delta} pts this week
          </span>
        )}
      </div>
      <div className={`flex items-center ${hero ? 'gap-7' : 'gap-5'}`}>
        <div className={`relative grid shrink-0 place-items-center ${hero ? 'h-40 w-40' : 'h-32 w-32'}`}>
          <svg viewBox="0 0 120 120" className={`-rotate-90 ${hero ? 'h-40 w-40' : 'h-32 w-32'}`}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={filled ? c - dash : c}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute text-center">
            <div className={`font-bold text-white ${hero ? 'text-5xl' : 'text-3xl'}`}>{count}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">/ 100</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-bold text-white ${hero ? 'text-2xl' : 'text-xl'}`}>{current.name}</div>
          {next ? (
            <>
              <div className="mt-1 text-xs text-slate-400">
                Next level: <span className="font-semibold text-cyan-accent">{next.name}</span> at {next.min}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{next.min - score} points to go</div>
            </>
          ) : (
            <div className="mt-1 text-xs font-semibold text-cyan-accent">Top level reached</div>
          )}
        </div>
      </div>
      {/* factor breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 border-t border-white/5 pt-4">
        {factors.map((f) => (
          <div key={f.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-300">{f.label}</span>
              <span className="font-semibold text-white">{f.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full" style={{ width: `${f.value}%`, background: scoreColor(f.value) }} />
            </div>
          </div>
        ))}
      </div>
      {showInfo && <GrowthScoreModal data={data} onClose={() => setShowInfo(false)} />}
    </div>
  )
}

/* explainer for how the Growth Level is calculated */
const SCORE_FACTORS: { label: string; weight: string; what: string; improve: string }[] = [
  {
    label: 'Traffic',
    weight: '35%',
    what: 'How many clicks your tracked links drive. The more real clicks your content sends, the higher this goes.',
    improve: 'Add trackable links to more posts and video descriptions.',
  },
  {
    label: 'Engagement',
    weight: '25%',
    what: 'Likes and comments relative to reach on your connected channels.',
    improve: 'Post content that earns replies, and add a clear call to action.',
  },
  {
    label: 'Consistency',
    weight: '20%',
    what: 'How regularly you publish. A steady cadence beats occasional bursts.',
    improve: 'Schedule posts so you publish on a steady rhythm.',
  },
  {
    label: 'Campaigns',
    weight: '20%',
    what: 'Whether you group content into campaigns with tracked links and goals.',
    improve: 'Run a campaign and tag your posts and links to it.',
  },
]

function GrowthScoreModal({ data, onClose }: { data: GrowthScore; onClose: () => void }) {
  const valueFor = (label: string) => data.factors.find((f) => f.label === label)?.value
  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-accent">
              <Award className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Growth Level</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">How your score works</h2>
            <p className="text-sm text-slate-400">
              Your Growth Level is one number out of 100, built from four parts.
            </p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {SCORE_FACTORS.map((f) => {
            const v = valueFor(f.label)
            return (
              <div key={f.label} className="rounded-xl border border-white/5 bg-navy-900/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{f.label}</span>
                  <span className="text-xs text-slate-500">
                    {f.weight} of your score{v != null ? ` · now ${v}/100` : ''}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">{f.what}</p>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-cyan-accent">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {f.improve}
                </p>
              </div>
            )
          })}
          <p className="text-xs text-slate-500">
            Your level name (Starter through Growth Legend) is based on the total score. Reach the next
            threshold to level up.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* --------------------------- growth opportunities ------------------------ */

const TIER_META: Record<Opportunity['tier'], { Icon: typeof Zap; color: string; bg: string }> = {
  'Highest Impact': { Icon: Zap, color: 'text-emerald-300', bg: 'bg-emerald-400/10' },
  'Easy Win': { Icon: Target, color: 'text-cyan-accent', bg: 'bg-cyan-accent/10' },
  'Missing Data': { Icon: Database, color: 'text-amber-300', bg: 'bg-amber-400/10' },
}

function OpportunityTile({
  o,
  prominent,
  onNavigate,
}: {
  o: Opportunity
  prominent?: boolean
  onNavigate?: (id: NavId) => void
}) {
  const meta = TIER_META[o.tier]
  return (
    <button
      onClick={() => o.nav && onNavigate?.(o.nav)}
      className={`group flex flex-col rounded-xl border border-white/5 bg-navy-900/50 text-left transition-colors hover:border-cyan-accent/30 ${
        prominent ? 'p-5' : 'p-4'
      }`}
    >
      <span className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
        <meta.Icon className="h-3 w-3" /> {o.tier}
      </span>
      <span className={`font-semibold text-white ${prominent ? 'text-lg' : ''}`}>{o.label}</span>
      <span className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-400">Potential +{o.potential} Growth Score</span>
        {o.nav && <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-accent" />}
      </span>
    </button>
  )
}

export function OpportunitiesCard({
  opportunities,
  onNavigate,
}: {
  opportunities: Opportunity[]
  onNavigate?: (id: NavId) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!opportunities.length) return null
  const [top, ...rest] = opportunities

  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold text-white">Growth Opportunities</h2>
      <p className="mb-4 mt-1 text-sm text-slate-400">
        {expanded
          ? 'Ranked by impact on your Growth Level.'
          : 'Your single highest-impact move right now.'}
      </p>
      {expanded ? (
        <div className="grid gap-3 md:grid-cols-3">
          {opportunities.map((o) => (
            <OpportunityTile key={o.label} o={o} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <OpportunityTile o={top} prominent onNavigate={onNavigate} />
      )}
      {rest.length > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 flex items-center gap-1 text-sm font-semibold text-cyan-accent hover:underline"
        >
          {expanded ? 'Show less' : `View ${rest.length} more opportunit${rest.length === 1 ? 'y' : 'ies'}`}
          <ArrowRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}

/* --------------------------- weekly growth brief ------------------------- */

/**
 * "This Week" — folds the win celebration and the weekly brief into one card:
 * a headline win line, the key stats, a 30-day traffic sparkline, and the AI
 * recommendation. `trend` is an optional 30-day click series for the sparkline.
 */
export function ThisWeekCard({
  brief,
  building,
  trend,
  onNavigate,
}: {
  brief: WeeklyBrief | null
  building?: boolean
  trend?: number[]
  onNavigate?: (id: NavId) => void
}) {
  if (building || !brief) {
    return (
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-accent" />
          <h2 className="text-lg font-bold text-white">This Week</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Your weekly growth brief will appear here once a few days of clicks and posts roll in. It
          highlights your best platform, top content, and what to do next.
        </p>
      </div>
    )
  }

  const plat = PLATFORMS[brief.bestPlatform]
  return (
    <div className="card flex flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-accent" />
        <h2 className="text-lg font-bold text-white">This Week</h2>
        <span className="ml-auto text-xs text-slate-500">Updated every Monday</span>
      </div>

      {brief.bestWeek && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-400/10 to-cyan-accent/10 px-3 py-2.5">
          <PartyPopper className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="text-sm font-semibold text-white">
            Best week yet. Traffic {brief.trafficDelta} this week
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Traffic" value={brief.trafficDelta} accent />
        <Stat label="Best platform" value={plat.name} />
        <Stat label="Best content" value={brief.bestContent} />
      </div>

      {trend && trend.length >= 2 && (
        <div className="mt-4">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Traffic · last 30 days</div>
          <AreaChart data={trend} className="h-20 w-full" gradientId="weekTrend" format={(v) => String(v)} />
        </div>
      )}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-cyan-accent/20 bg-cyan-accent/5 p-3">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
        <p className="text-sm leading-relaxed text-slate-200">{brief.recommendation}</p>
      </div>
      {onNavigate && (
        <button
          onClick={() => onNavigate('insights')}
          className="mt-3 self-start text-sm font-semibold text-cyan-accent hover:underline"
        >
          See the full growth brief
        </button>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-navy-900/50 p-3">
      <div className={`text-lg font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

/* --------------------- AI growth coach narrative ------------------------- */

export function CoachHighlights({ highlights, building }: { highlights: string[]; building?: boolean }) {
  const [recs, setRecs] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const regenerate = async () => {
    setBusy(true)
    try {
      setRecs(await aiRecommendations(4))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Award className="h-5 w-5 text-cyan-accent" />
          Growth Coach
          <span className="flex items-center gap-1 rounded-full bg-cyan-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-accent">
            <Sparkles className="h-3 w-3" /> AI
          </span>
        </h2>
        {!building && (
          <button
            onClick={regenerate}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            New tips
          </button>
        )}
      </div>
      {building ? (
        <p className="text-sm text-slate-400">
          Your weekly growth brief is being assembled. Keep posting and tracking links, and your
          coach will start surfacing what is working and what to do next.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {(recs || highlights).map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-sm text-slate-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
