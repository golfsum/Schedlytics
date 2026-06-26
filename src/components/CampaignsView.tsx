import { useState } from 'react'
import {
  Plus,
  Megaphone,
  ArrowLeft,
  Lightbulb,
  MousePointerClick,
  Users,
  Percent,
  DollarSign,
  Award,
  FileText,
  TrendingUp,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AreaChart } from './charts'
import { useToast } from './Toast'
import { useCampaigns } from './Campaigns'
import { exportCsv } from '../lib/csv'
import { PLATFORMS, type Campaign, type CampaignStatus } from '../data'

const STATUS_STYLE: Record<CampaignStatus, string> = {
  Active: 'bg-emerald-400/10 text-emerald-300',
  Scheduled: 'bg-cyan-accent/15 text-cyan-accent',
  Ended: 'bg-slate-500/15 text-slate-400',
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

/** Deterministic sample click series from a string seed (stable for screenshots). */
function seriesFromSeed(seed: string, n: number, base: number): number[] {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0
  const phase = ((h % 100) / 100) * Math.PI * 2
  return Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.round(base * (0.7 + 0.4 * Math.sin(i * 0.7 + phase) + 0.12 * Math.sin(i * 1.9)) * (1 + i / (n * 3)))),
  )
}

export default function CampaignsView() {
  const { addToast } = useToast()
  const { campaigns, addCampaign: addToStore } = useCampaigns()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const open = campaigns.find((c) => c.id === openId) || null

  const addCampaign = (c: Campaign) => {
    addToStore(c)
    setCreating(false)
    addToast('Campaign created 🎯')
  }

  if (open) {
    return <CampaignDetail campaign={open} onBack={() => setOpenId(null)} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">Track every post, link, and click by campaign.</p>
        </div>
        <div className="ml-auto flex gap-2">
          {campaigns.length > 0 && (
            <button
              onClick={() => exportCsv('campaigns.csv', campaigns.map((c) => ({
                Campaign: c.name, Status: c.status, Range: c.range, Posts: c.posts,
                Clicks: c.clicks, Visitors: c.visitors, Revenue: c.revenue, 'Best Platform': PLATFORMS[c.bestPlatform].name,
              })))}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
            >
              <FileText className="h-4 w-4" /> Export CSV
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} /> New Campaign
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl gradient-cyan-soft text-cyan-accent">
            <Megaphone className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-bold text-white">No campaigns yet</h2>
          <p className="max-w-md text-sm text-slate-400">
            Group your posts and trackable links into a campaign to measure a launch, sale, or
            newsletter push end to end.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-1 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900"
          >
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const plat = PLATFORMS[c.bestPlatform]
            const { Icon } = plat
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="card p-5 text-left transition-transform hover:scale-[1.01] hover:border-cyan-accent/30"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="truncate text-lg font-bold text-white">{c.name}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[c.status]}`}>
                    {c.status}
                  </span>
                </div>
                <div className="mb-4 text-xs text-slate-500">{c.range}</div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Metric label="Posts" value={String(c.posts)} />
                  <Metric label="Clicks" value={compact(c.clicks)} />
                  <Metric label="Visitors" value={compact(c.visitors)} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className={`grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br ${plat.gradient} text-white`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="text-slate-400">{plat.name}</span>
                  </span>
                  <span className="text-sm font-bold text-emerald-400">{c.revenue}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {creating && <CreateCampaignModal onClose={() => setCreating(false)} onCreate={addCampaign} />}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

/* ------------------------------- forecast -------------------------------- */

function CampaignForecast({ campaign: c }: { campaign: Campaign }) {
  const goal = c.goalClicks || 0
  const elapsed = c.elapsed ?? 0.5
  const started = elapsed > 0.05 && c.clicks > 0
  // Linear projection from clicks-so-far over the fraction of the window elapsed.
  const projected = started ? Math.round(c.clicks / elapsed) : 0
  const pct = goal ? Math.min(100, Math.round((c.clicks / goal) * 100)) : 0
  const willHit = started && projected >= goal
  const projPct = goal ? Math.min(140, Math.round((projected / goal) * 100)) : 0

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-lg font-bold text-white">Forecast</h2>
      {started ? (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="Goal" value={compact(goal)} />
            <Metric label="Current" value={`${compact(c.clicks)} (${pct}%)`} />
            <div>
              <div className={`text-lg font-bold ${willHit ? 'text-emerald-400' : 'text-amber-300'}`}>
                {compact(projected)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Projected by {c.goalDate}</div>
            </div>
          </div>
          {/* progress: current (solid) + projected (faded) toward the goal */}
          <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-cyan-accent/25" style={{ width: `${Math.min(100, projPct)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-cyan-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className={`mt-3 flex items-center gap-2 text-sm font-medium ${willHit ? 'text-emerald-400' : 'text-amber-300'}`}>
            <TrendingUp className="h-4 w-4" />
            {willHit
              ? `On pace to reach your goal of ${compact(goal)} clicks by ${c.goalDate}.`
              : `Projected to fall short of ${compact(goal)} clicks. Add more posts or links to close the gap.`}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          Goal: {compact(goal)} clicks. The projection appears once this campaign starts collecting
          clicks.
        </p>
      )}
    </div>
  )
}

/* ------------------------------ detail page ------------------------------- */

function CampaignDetail({ campaign: c, onBack }: { campaign: Campaign; onBack: () => void }) {
  const plat = PLATFORMS[c.bestPlatform]
  const series = c.clicks > 0 ? seriesFromSeed(c.id, 14, Math.max(40, Math.round(c.clicks / 14))) : []

  const cards: { Icon: LucideIcon; label: string; value: string }[] = [
    { Icon: FileText, label: 'Posts', value: String(c.posts) },
    { Icon: MousePointerClick, label: 'Clicks', value: compact(c.clicks) },
    { Icon: Users, label: 'Visitors', value: compact(c.visitors) },
    { Icon: Percent, label: 'CTR', value: c.ctr },
    { Icon: DollarSign, label: 'Revenue', value: c.revenue },
    { Icon: Award, label: 'Best Platform', value: plat.name },
  ]

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-cyan-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{c.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{c.range}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{c.status}</span>
        {c.postRows.length > 0 && (
          <button
            onClick={() => exportCsv(`${c.id}-posts.csv`, c.postRows.map((p) => ({
              Post: p.title, Platform: PLATFORMS[p.platform].name, Date: p.date,
              Views: p.views, Clicks: p.clicks, CTR: p.ctr, Revenue: p.revenue,
            })))}
            className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
          >
            <FileText className="h-4 w-4" /> Export CSV
          </button>
        )}
      </div>

      {/* metric cards */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((m) => (
          <div key={m.label} className="card p-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg gradient-cyan-soft text-cyan-accent">
              <m.Icon className="h-4 w-4" />
            </span>
            <div className="mt-3 text-xl font-bold text-white">{m.value}</div>
            <div className="text-xs text-slate-400">{m.label}</div>
          </div>
        ))}
      </div>

      {/* forecast */}
      {c.goalClicks ? <CampaignForecast campaign={c} /> : null}

      {/* clicks over time */}
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Campaign Clicks Over Time</h2>
        {series.length ? (
          <AreaChart data={series} format={(v) => compact(v)} />
        ) : (
          <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-slate-500">
            No clicks yet. Add tracked links to this campaign and share them, and traffic will show up
            here.
          </div>
        )}
      </div>

      {/* posts + links */}
      <div className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Posts in this campaign</h2>
        {c.postRows.length ? (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-semibold">Post</th>
                <th className="pb-2 font-semibold">Publish date</th>
                <th className="pb-2 text-right font-semibold">Views</th>
                <th className="pb-2 text-right font-semibold">Clicks</th>
                <th className="pb-2 text-right font-semibold">CTR</th>
                <th className="pb-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {c.postRows.map((p) => {
                const pp = PLATFORMS[p.platform]
                const { Icon } = pp
                return (
                  <tr key={p.title}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${pp.gradient} text-white`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate font-medium text-white">{p.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-400">{p.date}</td>
                    <td className="py-2.5 text-right text-slate-400">{compact(p.views)}</td>
                    <td className="py-2.5 text-right font-semibold text-white">{compact(p.clicks)}</td>
                    <td className="py-2.5 text-right text-slate-300">{p.ctr}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-400">{p.revenue}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">No posts added to this campaign yet.</p>
        )}
      </div>

      <div className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Links in this campaign</h2>
        {c.linkRows.length ? (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-semibold">Short link</th>
                <th className="pb-2 font-semibold">Destination</th>
                <th className="pb-2 text-right font-semibold">Clicks</th>
                <th className="pb-2 text-right font-semibold">Visitors</th>
                <th className="pb-2 font-semibold">Source</th>
                <th className="pb-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {c.linkRows.map((l) => (
                <tr key={l.short}>
                  <td className="py-2.5 font-semibold text-cyan-accent">{l.short}</td>
                  <td className="max-w-[160px] truncate py-2.5 text-slate-400">{l.destination}</td>
                  <td className="py-2.5 text-right font-semibold text-white">{compact(l.clicks)}</td>
                  <td className="py-2.5 text-right text-slate-300">{compact(l.visitors)}</td>
                  <td className="max-w-[140px] truncate py-2.5 text-slate-400">{l.source}</td>
                  <td className="py-2.5 text-slate-400">{l.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">No trackable links in this campaign yet.</p>
        )}
      </div>

      {/* AI insight */}
      <div className="card flex items-start gap-3 border-cyan-accent/20 bg-cyan-accent/5 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-cyan-soft text-cyan-accent">
          <Lightbulb className="h-5 w-5" />
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-accent">AI Insight</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">{c.insight}</p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ create modal ------------------------------ */

function CreateCampaignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Campaign) => void }) {
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [range, setRange] = useState('')

  const submit = () => {
    if (!name.trim()) {
      addToast('Enter a campaign name', 'info')
      return
    }
    onCreate({
      id: `c-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: name.trim(),
      status: 'Scheduled',
      range: range.trim() || 'Not scheduled',
      posts: 0,
      clicks: 0,
      visitors: 0,
      revenue: '$0',
      ctr: '0%',
      bestPlatform: 'instagram',
      insight: 'This campaign is new. Add posts and trackable links to start measuring performance.',
      postRows: [],
      linkRows: [],
    })
  }

  const inputCls =
    'w-full rounded-lg border border-white/5 bg-navy-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New Campaign</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Campaign name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday Sale" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Date range (optional)</span>
            <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="Dec 1 to Dec 24" className={inputCls} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">
            Cancel
          </button>
          <button onClick={submit} className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]">
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  )
}
