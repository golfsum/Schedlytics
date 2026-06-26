import { useEffect, useState } from 'react'
import { Target, TrendingUp, MousePointerClick, Loader2, ArrowRight } from 'lucide-react'
import {
  fetchConversionSummary,
  money,
  type ConversionSummary,
  type ConversionBucket,
} from '../lib/conversions'
import type { NavId } from '../types'
import ManualRevenueModal from './ManualRevenueModal'

const SAMPLE: ConversionSummary = {
  total: 128,
  revenue: 4820,
  attributed: 116,
  unattributed: 12,
  byContent: [
    { key: 'a', label: 'Summer styling haul 2026', conversions: 38, revenue: 1284 },
    { key: 'b', label: 'Best budget cameras under $500', conversions: 31, revenue: 1490 },
    { key: 'c', label: 'Link in bio', conversions: 27, revenue: 980 },
    { key: 'd', label: 'Behind the shoot', conversions: 18, revenue: 640 },
    { key: 'e', label: 'Trending audio remix', conversions: 14, revenue: 426 },
  ],
  byCampaign: [
    { key: 'spring', label: 'Spring Launch', conversions: 61, revenue: 2310 },
    { key: 'evergreen', label: 'Evergreen', conversions: 44, revenue: 1620 },
    { key: 'collab', label: 'Creator Collab', conversions: 23, revenue: 890 },
  ],
  byPlatform: [
    { key: 'youtube', label: 'youtube', conversions: 72, revenue: 2980 },
    { key: 'pinterest', label: 'pinterest', conversions: 34, revenue: 1120 },
    { key: 'twitch', label: 'twitch', conversions: 22, revenue: 720 },
  ],
  recent: [],
}

type Lens = 'byContent' | 'byCampaign' | 'byPlatform'
const LENSES: { id: Lens; label: string }[] = [
  { id: 'byContent', label: 'Content' },
  { id: 'byCampaign', label: 'Campaign' },
  { id: 'byPlatform', label: 'Platform' },
]

/** Conversions + revenue attributed to each post, campaign, and platform. */
export default function ConversionsCard({
  sample,
  onNavigate,
}: {
  sample: boolean
  onNavigate?: (id: NavId) => void
}) {
  const [data, setData] = useState<ConversionSummary | null>(sample ? SAMPLE : null)
  const [loading, setLoading] = useState(!sample)
  const [lens, setLens] = useState<Lens>('byContent')
  const [revOpen, setRevOpen] = useState(false)

  const load = () => {
    if (sample) return
    fetchConversionSummary()
      .then((s) => setData(s))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample])

  const onAddRevenue = () => setRevOpen(true)
  const revenueModal = revOpen ? (
    <ManualRevenueModal onClose={() => setRevOpen(false)} onAdded={load} />
  ) : null

  if (loading) {
    return (
      <div className="card p-5">
        <Header />
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading conversions…
        </div>
      </div>
    )
  }

  // Empty state: no conversions yet (real account without the snippet installed).
  if (!data || data.total === 0) {
    return (
      <div className="card p-5">
        <Header onAddRevenue={onAddRevenue} />
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-navy-900/40 p-5 text-sm text-slate-400">
          <p className="text-slate-300">No conversions tracked yet.</p>
          <p className="mt-1">
            Add the Schedlytics tracking snippet to your website to track conversions automatically, or
            add revenue manually to attribute a sale to a campaign or piece of content.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('settings')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-cyan-accent/30 px-3 py-1.5 text-xs font-semibold text-cyan-accent hover:bg-cyan-accent/10"
            >
              Set up conversion tracking <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {revenueModal}
      </div>
    )
  }

  const rows = data[lens] || []

  return (
    <div className="card p-5">
      <Header onAddRevenue={onAddRevenue} />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile icon={<Target className="h-4 w-4" />} label="Conversions" value={String(data.total)} />
        <Tile icon={<TrendingUp className="h-4 w-4" />} label="Revenue tracked" value={money(data.revenue)} accent />
        <Tile
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Attributed"
          value={`${data.total ? Math.round((data.attributed / data.total) * 100) : 0}%`}
        />
      </div>

      {/* breakdown lens */}
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Top performing {lens === 'byContent' ? 'content' : lens === 'byCampaign' ? 'campaigns' : 'platforms'}</h3>
        <div className="flex rounded-lg border border-white/10 bg-navy-900/50 p-0.5">
          {LENSES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLens(l.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                lens === l.id ? 'bg-cyan-accent/15 text-cyan-accent' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No data for this breakdown yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.slice(0, 6).map((r) => (
            <Row key={r.key} row={r} max={rows[0].conversions || 1} />
          ))}
        </ul>
      )}
      {revenueModal}
    </div>
  )
}

function Header({ onAddRevenue }: { onAddRevenue?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-cyan-accent">
          <Target className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Conversions</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-white">What your content is worth</h2>
        <p className="text-sm text-slate-400">Signups and sales attributed back to the post that drove them.</p>
      </div>
      {onAddRevenue && (
        <button
          onClick={onAddRevenue}
          className="shrink-0 rounded-lg border border-cyan-accent/30 px-3 py-1.5 text-xs font-semibold text-cyan-accent hover:bg-cyan-accent/10"
        >
          + Add revenue
        </button>
      )}
    </div>
  )
}

function Tile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-navy-900/50 p-3">
      <div className={`flex items-center gap-1.5 ${accent ? 'text-cyan-accent' : 'text-slate-400'}`}>
        {icon}
      </div>
      <div className={`mt-1.5 text-xl font-bold ${accent ? 'text-cyan-accent' : 'text-white'}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

function Row({ row, max }: { row: ConversionBucket; max: number }) {
  const pct = Math.max(6, Math.round((row.conversions / max) * 100))
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate text-slate-200">{row.label}</span>
        <span className="shrink-0 font-semibold text-white">{row.conversions}</span>
        <span className="w-16 shrink-0 text-right text-cyan-accent">{money(row.revenue)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-900">
        <div className="h-full rounded-full gradient-cyan" style={{ width: `${pct}%` }} />
      </div>
    </li>
  )
}
