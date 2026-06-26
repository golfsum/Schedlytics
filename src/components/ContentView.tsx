import { useEffect, useMemo, useState } from 'react'
import { Plus, Link2, Search, FileText } from 'lucide-react'
import { sampleData } from '../lib/socialApi'
import { listShortLinks } from '../lib/shortLinks'
import { PLATFORMS } from '../data'
import type { CalendarPost, NavId, PlatformId } from '../types'

interface ContentRow {
  id: string
  title: string
  platform?: PlatformId
  campaign?: string
  views: number | null
  clicks: number | null
  ctr: string | null
  conversions: number | null
  revenue: string | null
  status: string
  post?: CalendarPost
}

const SAMPLE: ContentRow[] = [
  { id: 's1', title: '5 Tips to Improve Your Swing', platform: 'youtube', campaign: 'Summer Sale', views: 12481, clicks: 742, ctr: '5.9%', conversions: 61, revenue: '$1,482', status: 'High performer' },
  { id: 's2', title: 'Summer drop carousel', platform: 'instagram', campaign: 'Summer Sale', views: 48200, clicks: 3120, ctr: '6.5%', conversions: 88, revenue: '$2,140', status: 'High performer' },
  { id: 's3', title: 'Planner launch trailer', platform: 'youtube', campaign: 'Planner Launch', views: 31900, clicks: 2280, ctr: '7.1%', conversions: 54, revenue: '$1,860', status: 'High performer' },
  { id: 's4', title: 'Pin board refresh', platform: 'pinterest', campaign: 'Evergreen', views: 18700, clicks: 1510, ctr: '8.1%', conversions: 27, revenue: '$980', status: 'Tracking' },
  { id: 's5', title: 'Behind the scenes', platform: 'tiktok', campaign: 'Creator Collab', views: 54100, clicks: 1290, ctr: '2.4%', conversions: 14, revenue: '$410', status: 'Tracking' },
  { id: 's6', title: 'Styling reel', platform: 'reels', campaign: 'Evergreen', views: 62400, clicks: 1740, ctr: '2.8%', conversions: 9, revenue: '$640', status: 'Tracking' },
]

/** Full list of every post, video, pin, and tracked link with its performance. */
export default function ContentView({
  posts,
  onNavigate,
  onOpenPost,
}: {
  posts: CalendarPost[]
  onNavigate: (id: NavId) => void
  onOpenPost: (p: CalendarPost) => void
}) {
  const [rows, setRows] = useState<ContentRow[]>(sampleData ? SAMPLE : [])
  const [loading, setLoading] = useState(!sampleData)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (sampleData) return
    let cancelled = false
    listShortLinks()
      .then((links) => {
        if (cancelled) return
        const linkRows: ContentRow[] = links.map((l) => ({
          id: `link-${l.slug}`,
          title: l.campaign || l.url.replace(/^https?:\/\//, ''),
          platform: l.platform,
          campaign: l.campaign,
          views: null,
          clicks: l.clicks ?? 0,
          ctr: null,
          conversions: null,
          revenue: null,
          status: (l.clicks ?? 0) > 100 ? 'High performer' : (l.clicks ?? 0) > 0 ? 'Tracking' : 'Live',
        }))
        const postRows: ContentRow[] = posts.map((p) => ({
          id: `post-${p.id}`,
          title: p.label,
          platform: p.platform,
          campaign: p.campaign,
          views: null,
          clicks: null,
          ctr: null,
          conversions: null,
          revenue: null,
          status: 'Scheduled',
          post: p,
        }))
        setRows([...linkRows, ...postRows])
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [posts])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(
      (r) => r.title.toLowerCase().includes(t) || (r.campaign || '').toLowerCase().includes(t),
    )
  }, [rows, q])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Content</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every post, video, pin, and link, with the clicks, conversions, and revenue behind it.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('calendar')}
            className="flex items-center gap-2 rounded-xl gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow-soft transition-transform hover:scale-[1.03]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Create Post
          </button>
          <button
            onClick={() => onNavigate('links')}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Link2 className="h-4 w-4" /> Create Link
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search content or campaign"
          className="w-full rounded-lg border border-white/10 bg-navy-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-slate-500">Loading your content…</div>
      ) : filtered.length === 0 ? (
        <EmptyState onNavigate={onNavigate} hasQuery={Boolean(q.trim())} />
      ) : (
        <>
          {/* desktop table */}
          <div className="card hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Content</th>
                  <th className="px-3 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 text-right font-semibold">Views</th>
                  <th className="px-3 py-3 text-right font-semibold">Clicks</th>
                  <th className="px-3 py-3 text-right font-semibold">CTR</th>
                  <th className="px-3 py-3 text-right font-semibold">Conversions</th>
                  <th className="px-3 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => r.post && onOpenPost(r.post)}
                    className={`border-b border-white/5 last:border-0 ${r.post ? 'cursor-pointer hover:bg-white/5' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <PlatformDot platform={r.platform} />
                        <span className="font-medium text-white">{r.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{r.campaign || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{num(r.views)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{num(r.clicks)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{r.ctr ?? '—'}</td>
                    <td className="px-3 py-3 text-right">{conv(r.conversions)}</td>
                    <td className="px-3 py-3 text-right">{rev(r.revenue)}</td>
                    <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => r.post && onOpenPost(r.post)}
                className={`card p-4 ${r.post ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <PlatformDot platform={r.platform} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{r.title}</span>
                  <StatusPill status={r.status} />
                </div>
                {r.campaign && <div className="mt-1 text-xs text-slate-500">{r.campaign}</div>}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Clicks" value={num(r.clicks)} />
                  <Mini label="Conversions" value={r.conversions == null ? 'Not yet' : String(r.conversions)} />
                  <Mini label="Revenue" value={r.revenue == null ? 'Not set' : r.revenue} accent />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PlatformDot({ platform }: { platform?: PlatformId }) {
  if (!platform || !PLATFORMS[platform]) {
    return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-700 text-slate-400"><FileText className="h-3.5 w-3.5" /></span>
  }
  const p = PLATFORMS[platform]
  const { Icon } = p
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${p.gradient} text-white`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'High performer'
      ? 'bg-emerald-400/10 text-emerald-400'
      : status === 'Tracking' || status === 'Live'
        ? 'bg-cyan-accent/10 text-cyan-accent'
        : 'bg-white/5 text-slate-400'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{status}</span>
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-bold ${accent ? 'text-cyan-accent' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}

function EmptyState({ onNavigate, hasQuery }: { onNavigate: (id: NavId) => void; hasQuery: boolean }) {
  if (hasQuery) {
    return <div className="card p-8 text-center text-sm text-slate-500">No content matches your search.</div>
  }
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-accent/10 text-cyan-accent">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-3 text-lg font-bold text-white">No content yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
        Create a post or a tracked link and it will show up here with its performance once people start
        clicking.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={() => onNavigate('calendar')} className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow">
          Create a post
        </button>
        <button onClick={() => onNavigate('links')} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
          Create a tracked link
        </button>
      </div>
    </div>
  )
}

/* numbers + not-tracked placeholders */
function num(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  return String(n)
}
function conv(n: number | null) {
  if (n == null)
    return (
      <span className="text-slate-500" title="Add the Schedlytics tracking script or a manual goal to track conversions.">
        Not tracking yet
      </span>
    )
  return <span className="font-semibold text-white">{n}</span>
}
function rev(v: string | null) {
  if (v == null)
    return (
      <span className="text-slate-500" title="Connect your website, Stripe, Shopify, or add manual revenue to measure revenue from this content.">
        Not connected
      </span>
    )
  return <span className="font-semibold text-cyan-accent">{v}</span>
}
