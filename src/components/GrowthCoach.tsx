import {
  PartyPopper,
  TrendingUp,
  Award,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'
import { PLATFORMS, type GrowthScore, type WeeklyBrief } from '../data'
import { aiRecommendations } from '../lib/aiSuggest'
import type { NavId } from '../types'

/* ----------------------------- celebrate wins ---------------------------- */

export function WinBanner({ headline, detail }: { headline: string; detail: string }) {
  return (
    <div className="card flex items-center gap-3 border-emerald-400/25 bg-gradient-to-r from-emerald-400/10 to-cyan-accent/10 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
        <PartyPopper className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-white">{headline}</div>
        <div className="text-sm text-slate-300">{detail}</div>
      </div>
    </div>
  )
}

/* ------------------------------ growth score ----------------------------- */

const scoreColor = (n: number) => (n >= 80 ? '#34D399' : n >= 60 ? '#22D3EE' : n >= 40 ? '#F59E0B' : '#F87171')

export function GrowthScoreCard({ data, building }: { data: GrowthScore | null; building?: boolean }) {
  if (building || !data) {
    return (
      <div className="card flex flex-col justify-center p-5">
        <h2 className="text-lg font-bold text-white">Growth Score</h2>
        <p className="mt-2 text-sm text-slate-400">
          Building your score. Connect channels, schedule posts, and add trackable links, and your
          Growth Score appears here within a few days of activity.
        </p>
      </div>
    )
  }

  const { score, delta, factors } = data
  const color = scoreColor(score)
  // SVG ring geometry
  const r = 52
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Growth Score</h2>
        {delta !== 0 && (
          <span className={`flex items-center gap-1 text-sm font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <ArrowUpRight className={`h-4 w-4 ${delta < 0 ? 'rotate-90' : ''}`} />
            {delta > 0 ? '+' : ''}
            {delta} pts this week
          </span>
        )}
      </div>
      <div className="flex items-center gap-5">
        <div className="relative grid h-32 w-32 shrink-0 place-items-center">
          <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-3xl font-bold text-white">{score}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">/ 100</div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
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
      </div>
    </div>
  )
}

/* --------------------------- weekly growth brief ------------------------- */

export function WeeklyBriefCard({
  brief,
  building,
  onNavigate,
}: {
  brief: WeeklyBrief | null
  building?: boolean
  onNavigate?: (id: NavId) => void
}) {
  if (building || !brief) {
    return (
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-accent" />
          <h2 className="text-lg font-bold text-white">Your Week</h2>
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
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-accent" />
        <h2 className="text-lg font-bold text-white">Your Week</h2>
        <span className="ml-auto text-xs text-slate-500">Updated every Monday</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Traffic" value={brief.trafficDelta} accent />
        <Stat label="Best platform" value={plat.name} />
        <Stat label="Best content" value={brief.bestContent} />
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-cyan-accent/20 bg-cyan-accent/5 p-3">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
        <p className="text-sm leading-relaxed text-slate-200">{brief.recommendation}</p>
      </div>
      {onNavigate && (
        <button
          onClick={() => onNavigate('insights')}
          className="mt-3 text-sm font-semibold text-cyan-accent hover:underline"
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
