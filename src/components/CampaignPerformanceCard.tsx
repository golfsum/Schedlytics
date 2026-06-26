import { Megaphone, ArrowRight } from 'lucide-react'
import { useCampaigns } from './Campaigns'
import { PLATFORMS } from '../data'
import type { Campaign } from '../data'
import type { NavId } from '../types'

/** Rolled-up performance per campaign, shown after Top Performing Content. */
export default function CampaignPerformanceCard({ onNavigate }: { onNavigate?: (id: NavId) => void }) {
  const { campaigns } = useCampaigns()

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-cyan-accent">
            <Megaphone className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Campaigns</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">Campaign Performance</h2>
          <p className="text-sm text-slate-400">
            Track launches, promotions, and content series across every post and link.
          </p>
        </div>
        {campaigns.length > 0 && onNavigate && (
          <button
            onClick={() => onNavigate('campaigns')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-accent hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-navy-900/40 p-5 text-sm text-slate-400">
          <p className="text-slate-300">No campaigns yet.</p>
          <p className="mt-1">
            Create your first campaign to group posts, links, and results around a launch or promotion,
            then measure the whole push in one place.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('campaigns')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-cyan-accent/30 px-3 py-1.5 text-xs font-semibold text-cyan-accent hover:bg-cyan-accent/10"
            >
              Create a campaign <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.slice(0, 3).map((c) => (
            <CampaignTile key={c.id} c={c} onOpen={() => onNavigate?.('campaigns')} />
          ))}
        </div>
      )}
    </div>
  )
}

function CampaignTile({ c, onOpen }: { c: Campaign; onOpen: () => void }) {
  const pct = c.goalClicks ? Math.min(100, Math.round((c.clicks / c.goalClicks) * 100)) : null
  const best = c.postRows?.[0]?.title || PLATFORMS[c.bestPlatform]?.name
  const statusColor =
    c.status === 'Active'
      ? 'text-emerald-400 bg-emerald-400/10'
      : c.status === 'Scheduled'
        ? 'text-cyan-accent bg-cyan-accent/10'
        : 'text-slate-400 bg-white/5'

  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-xl border border-white/5 bg-navy-900/50 p-4 text-left transition-colors hover:border-cyan-accent/30"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-white">{c.name}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor}`}>
          {c.status}
        </span>
      </div>
      <span className="mt-0.5 text-xs text-slate-500">{c.range}</span>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={String(c.posts)} label="posts" />
        <Stat value={compact(c.clicks)} label="clicks" />
        <Stat value={c.revenue} label="revenue" accent />
      </div>

      {pct !== null && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-slate-500">
            <span>Goal {compact(c.goalClicks!)} clicks</span>
            <span className="text-cyan-accent">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-navy-900">
            <div className="h-full rounded-full gradient-cyan" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>
      )}

      {best && (
        <div className="mt-3 truncate text-xs text-slate-500">
          Best content: <span className="text-slate-300">{best}</span>
        </div>
      )}
    </button>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-bold ${accent ? 'text-cyan-accent' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  return String(n)
}
