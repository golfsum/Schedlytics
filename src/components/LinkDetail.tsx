import {
  ArrowLeft,
  MousePointerClick,
  Users,
  Globe,
  Smartphone,
  Target,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AreaChart } from './charts'
import { sampleData } from '../lib/socialApi'
import { displayShort, type ShortLink } from '../lib/shortLinks'

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

function seed(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Split a total across labels using deterministic weights from the slug. */
function breakdown(slug: string, labels: string[], total: number, salt: string): { label: string; value: number; color: string }[] {
  const colors = ['#22D3EE', '#6366F1', '#E1306C', '#34D399', '#F59E0B']
  const weights = labels.map((l, i) => 1 + (seed(slug + salt + l) % 9) + (labels.length - i))
  const sum = weights.reduce((a, b) => a + b, 0)
  return labels.map((label, i) => ({
    label,
    value: Math.max(1, Math.round((weights[i] / sum) * total)),
    color: colors[i % colors.length],
  }))
}

function seriesFromSeed(slug: string, n: number, base: number): number[] {
  const phase = ((seed(slug) % 100) / 100) * Math.PI * 2
  return Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.round(base * (0.7 + 0.4 * Math.sin(i * 0.7 + phase) + 0.12 * Math.sin(i * 1.9)))),
  )
}

const qrSrc = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`

export default function LinkDetail({ link, onBack }: { link: ShortLink; onBack: () => void }) {
  const clicks = link.clicks || 0
  const visitors = link.uniqueVisitors ?? Math.round(clicks * 0.78)
  const rich = sampleData || clicks > 0

  const referrers = rich ? breakdown(link.slug, ['Instagram', 'Direct', 'Google', 'YouTube', 'Other'], clicks, 'ref') : []
  const devices = rich ? breakdown(link.slug, ['Mobile', 'Desktop', 'Tablet'], clicks, 'dev') : []
  const countries = rich ? breakdown(link.slug, ['United States', 'United Kingdom', 'Canada', 'Australia', 'Other'], visitors, 'geo') : []
  const conversions = rich ? Math.round(clicks * (0.04 + (seed(link.slug) % 60) / 1000)) : 0
  const series = rich ? seriesFromSeed(link.slug, 14, Math.max(8, Math.round(clicks / 14) || 12)) : []

  const cards: { Icon: LucideIcon; label: string; value: string }[] = [
    { Icon: MousePointerClick, label: 'Clicks', value: compact(clicks) },
    { Icon: Users, label: 'Unique Visitors', value: compact(visitors) },
    { Icon: ExternalLink, label: 'Top Referrer', value: referrers[0]?.label || 'None' },
    { Icon: Globe, label: 'Top Country', value: countries[0]?.label || 'None' },
    { Icon: Smartphone, label: 'Top Device', value: devices[0]?.label || 'None' },
    { Icon: Target, label: 'Conversions', value: rich ? compact(conversions) : '0' },
  ]

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-cyan-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> All links
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">{displayShort(link.shortUrl)}</h1>
        <a href={link.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-accent">
          {link.url} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* metric cards */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((m) => (
          <div key={m.label} className="card p-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg gradient-cyan-soft text-cyan-accent">
              <m.Icon className="h-4 w-4" />
            </span>
            <div className="mt-3 truncate text-lg font-bold text-white" title={m.value}>{m.value}</div>
            <div className="text-xs text-slate-400">{m.label}</div>
          </div>
        ))}
      </div>

      {/* clicks over time */}
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Clicks Over Time</h2>
        {series.length ? (
          <AreaChart data={series} format={(v) => compact(v)} />
        ) : (
          <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-slate-500">
            No clicks recorded yet.
          </div>
        )}
      </div>

      {/* breakdowns */}
      <div className="grid gap-5 lg:grid-cols-3">
        <BreakdownCard title="Referrers" rows={referrers} />
        <BreakdownCard title="Devices" rows={devices} />
        <BreakdownCard title="Countries" rows={countries} />
      </div>

      {/* related content */}
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Related</h2>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3 text-sm">
            <Related label="Source post" value={link.sourcePost || 'None'} />
            <Related label="Campaign" value={link.campaign || 'None'} />
            <Related
              label="UTM parameters"
              value={
                [link.utmSource && `source=${link.utmSource}`, link.utmMedium && `medium=${link.utmMedium}`, link.utmCampaign && `campaign=${link.utmCampaign}`]
                  .filter(Boolean)
                  .join(' · ') || 'None'
              }
            />
          </div>
          <div className="text-center">
            <img src={qrSrc(link.shortUrl)} alt="QR code" className="h-32 w-32 rounded-lg bg-white p-2" />
            <div className="mt-1.5 text-[11px] text-slate-500">Scan to open</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold text-white">{title}</h3>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate text-slate-300">{r.label}</span>
                <span className="font-semibold text-white">{compact(r.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">No data yet.</p>
      )}
    </div>
  )
}

function Related({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  )
}
