import { createPortal } from 'react-dom'
import {
  X,
  Pencil,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  MousePointerClick,
  Percent,
  DollarSign,
  Copy,
  QrCode,
  BarChart3,
  Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useToast } from './Toast'
import { sampleData } from '../lib/socialApi'
import { PLATFORMS, WEEKDAYS, TIME_SLOTS } from '../data'
import type { CalendarPost } from '../types'

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

/** Deterministic sample performance from the post id (stable per post). */
function samplePerf(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  const r = (n: number) => Math.abs(h % n)
  const views = 8000 + r(54000)
  const ctr = 2 + r(60) / 10 // 2.0 - 8.0
  const clicks = Math.round((views * ctr) / 100)
  return {
    views,
    likes: Math.round(views * (0.03 + r(40) / 1000)),
    comments: Math.round(views * 0.004) + r(40),
    shares: Math.round(views * 0.002) + r(20),
    clicks,
    ctr: `${ctr.toFixed(1)}%`,
    revenue: `$${compact(Math.round(clicks * (0.4 + r(30) / 100)))}`,
  }
}

const qrSrc = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(url)}`

export default function PostDetailDrawer({
  post,
  onClose,
  onEdit,
}: {
  post: CalendarPost
  onClose: () => void
  onEdit: () => void
}) {
  const { addToast } = useToast()
  const plat = PLATFORMS[post.platform]
  const { Icon } = plat
  const published = (post.week ?? 0) < 0
  const status = published ? 'Published' : 'Scheduled'
  const perf = sampleData ? samplePerf(post.id) : null

  const shortUrl =
    post.destinationUrl || post.trackClicks || sampleData
      ? `ashrt.link/${(post.label || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 12)}`
      : null

  const copy = () => {
    if (!shortUrl) return
    navigator.clipboard?.writeText(`https://${shortUrl}`).catch(() => {})
    addToast('Link copied')
  }

  const stats: { Icon: LucideIcon; label: string; value: string }[] = perf
    ? [
        { Icon: Eye, label: 'Views', value: compact(perf.views) },
        { Icon: ThumbsUp, label: 'Likes', value: compact(perf.likes) },
        { Icon: MessageCircle, label: 'Comments', value: compact(perf.comments) },
        { Icon: Share2, label: 'Shares', value: compact(perf.shares) },
        { Icon: MousePointerClick, label: 'Clicks', value: compact(perf.clicks) },
        { Icon: Percent, label: 'CTR', value: perf.ctr },
        { Icon: DollarSign, label: 'Revenue', value: perf.revenue },
      ]
    : []

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md animate-slide-in-right flex-col overflow-y-auto border-l border-white/5 bg-navy-850/95 backdrop-blur-md">
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-navy-850/95 px-5 py-4">
          <h2 className="text-lg font-bold text-white">Post Details</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          {/* summary */}
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${plat.gradient} text-white`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold text-white">{post.label || 'Untitled post'}</div>
              <div className="text-xs text-slate-500">
                {plat.name} · {WEEKDAYS[post.day]} at {TIME_SLOTS[post.slot]} AM
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                published ? 'bg-emerald-400/10 text-emerald-300' : 'bg-cyan-accent/15 text-cyan-accent'
              }`}
            >
              {status}
            </span>
          </div>

          {/* performance */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">Performance</h3>
            {perf ? (
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/5 bg-navy-900/50 p-3">
                    <s.Icon className="h-4 w-4 text-cyan-accent" />
                    <div className="mt-1.5 text-base font-bold text-white">{s.value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                {published
                  ? 'Performance will appear here once stats are reported.'
                  : 'This post is scheduled. Performance appears after it publishes.'}
              </p>
            )}
          </div>

          {/* tracked links */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">Tracked Links</h3>
            {shortUrl ? (
              <div className="rounded-xl border border-white/5 bg-navy-900/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-cyan-accent">{shortUrl}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn Icon={Copy} title="Copy" onClick={copy} />
                    <IconBtn Icon={QrCode} title="QR code" onClick={() => window.open(qrSrc(`https://${shortUrl}`), '_blank', 'noopener')} />
                    <IconBtn Icon={BarChart3} title="Link analytics" onClick={() => addToast('Open the Links page for full link analytics', 'info')} />
                  </div>
                </div>
                {post.destinationUrl && (
                  <div className="mt-1.5 truncate text-xs text-slate-500">to {post.destinationUrl}</div>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                No trackable link on this post. Enable "Track clicks" when scheduling to add one.
              </p>
            )}
          </div>

          {/* AI recommendation */}
          <div className="rounded-xl border border-cyan-accent/20 bg-cyan-accent/5 p-4">
            <div className="flex items-center gap-2 text-cyan-accent">
              <Lightbulb className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">AI Recommendation</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              {perf && parseFloat(perf.ctr) < 4
                ? 'This post has strong engagement but a low click rate. Try adding a clearer call to action and putting the link earlier.'
                : 'Solid performer. Consider turning this into a campaign and reusing the link in your newsletter.'}
            </p>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

function IconBtn({ Icon, title, onClick }: { Icon: LucideIcon; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
