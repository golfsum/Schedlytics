import { useEffect, useState } from 'react'
import { Maximize2, MoreHorizontal, Settings2, Loader2, Eye, ThumbsUp, MessageCircle, RefreshCw, Play } from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { useConnections, CONNECTABLE } from './Connections'
import {
  backendEnabled,
  sampleData,
  fetchStats,
  fetchYouTubeRecentVideos,
  type RemoteStats,
  type YouTubeVideo,
} from '../lib/socialApi'
import { TrendingUp, LayoutGrid, Clock, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { CHANNEL_STATS, PLATFORMS, INSIGHTS, WEEKLY_BRIEF } from '../data'
import { aiRecommendations } from '../lib/aiSuggest'
import { realHighlights, topByClicks } from '../lib/growth'
import { listShortLinks, type ShortLink } from '../lib/shortLinks'
import { CoachHighlights } from './GrowthCoach'
import { CorrelationMatrix, EngagementTrend, ConversionBars } from './charts'
import type { PlatformId } from '../types'

export default function InsightsView() {
  // Real coach highlights for live accounts (sample in demo).
  const [links, setLinks] = useState<ShortLink[]>([])
  const [vids, setVids] = useState<YouTubeVideo[]>([])
  useEffect(() => {
    if (sampleData || !backendEnabled) return
    listShortLinks().then(setLinks).catch(() => {})
    fetchYouTubeRecentVideos(25).then((v) => setVids(Array.isArray(v) ? v : [])).catch(() => {})
  }, [])

  const realClicks = links.reduce((s, l) => s + (l.clicks || 0), 0)
  const realVisitors = links.reduce((s, l) => s + (l.uniqueVisitors || 0), 0)
  const bestPlatform = topByClicks(links, 'platform') as PlatformId | null
  const topCampaign = topByClicks(links, 'campaign')
  const topVid = [...vids].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
  const realHL = realHighlights(realClicks, realVisitors, bestPlatform, topCampaign, topVid?.title)
  const coachBuilding = !sampleData && realClicks === 0 && vids.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Insights</h1>
        <p className="mt-1 text-sm text-slate-400">
          Understand what is working and what to post next.
        </p>
      </div>

      {/* AI growth coach weekly brief */}
      <CoachHighlights highlights={sampleData ? WEEKLY_BRIEF.highlights : realHL} building={coachBuilding} />

      {/* insight-first summary */}
      <InsightSummary />

      {/* supporting charts */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">The data behind it</h2>
        <span className="rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
          Unified Correlation
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChannelPerformance />
        <div className="xl:col-span-2">
          <UnifiedCorrelation />
        </div>
      </div>

      <RecentVideos />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Insight-first summary (sample data in demo; gentle prompt for real)         */
/* -------------------------------------------------------------------------- */

function InsightSummary() {
  if (!sampleData) {
    return (
      <div className="card flex items-start gap-3 border-cyan-accent/20 bg-cyan-accent/5 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-cyan-soft text-cyan-accent">
          <TrendingUp className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-accent">Insights</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            Add trackable links to your posts and let a few days of clicks roll in. Schedlytics will
            surface your best platform, content type, and posting time here automatically.
          </p>
        </div>
      </div>
    )
  }

  const cards = [
    { Icon: TrendingUp, title: 'Best Platform', body: INSIGHTS.bestPlatform, tone: 'good' as const },
    { Icon: LayoutGrid, title: 'Best Content Type', body: INSIGHTS.bestContentType, tone: 'good' as const },
    { Icon: Clock, title: 'Best Posting Time', body: INSIGHTS.bestPostingTime, tone: 'good' as const },
    { Icon: AlertTriangle, title: 'Needs Attention', body: INSIGHTS.underperforming, tone: 'warn' as const },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        {cards.map((c) => (
          <div key={c.title} className="card p-5">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  c.tone === 'warn' ? 'bg-amber-400/10 text-amber-300' : 'gradient-cyan-soft text-cyan-accent'
                }`}
              >
                <c.Icon className="h-4 w-4" />
              </span>
              <h3 className="font-semibold text-white">{c.title}</h3>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-300">{c.body}</p>
          </div>
        ))}
      </div>

      {/* recommended next actions */}
      <RecommendedActions />
    </div>
  )
}

function RecommendedActions() {
  const [recs, setRecs] = useState<string[]>(INSIGHTS.recommendedActions)
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
        <h3 className="flex items-center gap-2 font-semibold text-white">
          Recommended Next Actions
          <span className="flex items-center gap-1 rounded-full bg-cyan-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-accent">
            <Sparkles className="h-3 w-3" /> AI
          </span>
        </h3>
        <button
          onClick={regenerate}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Regenerate
        </button>
      </div>
      <ul className="space-y-2.5">
        {recs.map((a) => (
          <li key={a} className="flex items-start gap-2.5 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Recent videos - LIVE per-video counts (Data API, no analytics lag)          */
/* -------------------------------------------------------------------------- */

const SAMPLE_VIDEOS: YouTubeVideo[] = [
  { id: 'sv1', title: 'Summer styling haul 2026', thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=320&q=60', publishedAt: '2026-06-20T12:00:00Z', views: 12480, likes: 842, comments: 96, url: '#' },
  { id: 'sv2', title: 'Behind the shoot', thumbnail: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=320&q=60', publishedAt: '2026-06-17T12:00:00Z', views: 8230, likes: 514, comments: 61, url: '#' },
  { id: 'sv3', title: 'Trending audio remix', thumbnail: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=320&q=60', publishedAt: '2026-06-14T12:00:00Z', views: 21950, likes: 1310, comments: 188, url: '#' },
]

function timeSince(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

function RecentVideos() {
  const { accounts } = useConnections()
  const ytConnected = Boolean(accounts.youtube?.connected)
  const live = backendEnabled && ytConnected
  const [videos, setVideos] = useState<YouTubeVideo[] | 'error' | null>(sampleData ? SAMPLE_VIDEOS : null)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(sampleData ? Date.now() : null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    if (!live) return
    setLoading(true)
    fetchYouTubeRecentVideos(6)
      .then((v) => {
        setVideos(v)
        setRefreshedAt(Date.now())
      })
      .catch(() => setVideos('error'))
      .finally(() => setLoading(false))
  }

  // Initial load + poll every 60s while the tab is visible (live counts).
  useEffect(() => {
    if (!live) return
    load()
    const t = window.setInterval(() => document.visibilityState === 'visible' && load(), 60000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytConnected])

  const list = Array.isArray(videos) ? videos : []

  return (
    <div className="card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Recent videos</h2>
          <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        {live && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {refreshedAt && <span>updated {timeSince(refreshedAt)}</span>}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-navy-900/60 px-2.5 py-1.5 font-medium text-slate-200 hover:text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-500">Current view, like, and comment counts (no reporting delay).</p>

      {videos === null ? (
        <ChartLoading />
      ) : videos === 'error' ? (
        <ChartNote>Could not load videos. Reconnect YouTube in Settings.</ChartNote>
      ) : !sampleData && !live ? (
        <ChartNote>Connect YouTube to see your latest videos with live counts.</ChartNote>
      ) : list.length === 0 ? (
        <ChartNote>No uploads yet. Publish a video and it'll show here with live stats.</ChartNote>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-white/5 bg-navy-900/50 transition-colors hover:border-cyan-accent/30"
            >
              <div className="relative aspect-video bg-navy-950">
                {v.thumbnail && <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />}
                <span className="absolute inset-0 grid place-items-center bg-navy-950/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-navy-900">
                    <Play className="h-4 w-4 translate-x-0.5 fill-navy-900" />
                  </span>
                </span>
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-semibold text-white" title={v.title}>
                  {v.title}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1" title="Views">
                    <Eye className="h-3.5 w-3.5" /> {compact(v.views)}
                  </span>
                  <span className="flex items-center gap-1" title="Likes">
                    <ThumbsUp className="h-3.5 w-3.5" /> {compact(v.likes)}
                  </span>
                  <span className="flex items-center gap-1" title="Comments">
                    <MessageCircle className="h-3.5 w-3.5" /> {compact(v.comments)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Channel Performance / Cross-Platform Sync                                   */
/* -------------------------------------------------------------------------- */

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function ChannelPerformance() {
  const { addToast } = useToast()
  const { accounts, connect } = useConnections()
  const [live, setLive] = useState<Record<string, RemoteStats | 'error'>>({})
  const [ytVideoViews, setYtVideoViews] = useState<number | null>(null)
  const [synced, setSynced] = useState<Record<string, boolean>>(
    Object.fromEntries(CHANNEL_STATS.map((c) => [c.platform, c.synced])),
  )

  // Live mode: pull real stats for each connected platform.
  useEffect(() => {
    if (!backendEnabled) return
    for (const id of CONNECTABLE) {
      if (accounts[id]?.connected && live[id] === undefined) {
        fetchStats(id)
          .then((s) => setLive((m) => ({ ...m, [id]: s })))
          .catch(() => setLive((m) => ({ ...m, [id]: 'error' })))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  // Fallback for YouTube: a channel can report 0 total views (hidden/new) even
  // when its videos have views. Sum live per-video views to fill that in.
  useEffect(() => {
    if (backendEnabled && accounts.youtube?.connected && ytVideoViews === null) {
      fetchYouTubeRecentVideos(25)
        .then((vs) => setYtVideoViews(vs.reduce((sum, v) => sum + (v.views || 0), 0)))
        .catch(() => setYtVideoViews(0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.youtube?.connected])

  return (
    <section className="card flex flex-col p-5">
      <ColumnHeader eyebrow="Channel Performance" title="Cross-Platform Sync">
        <div className="flex items-center gap-1">
          <IconBtn>
            <Maximize2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn>
            <MoreHorizontal className="h-4 w-4" />
          </IconBtn>
        </div>
      </ColumnHeader>
      <p className="-mt-2 text-xs text-slate-500">
        {backendEnabled ? 'Live stats from your connected channels' : 'Select platform by cross-correlation'}
      </p>

      <div className="mt-4 space-y-3">
        {backendEnabled
          ? CONNECTABLE.map((id) => {
              const p = PLATFORMS[id]
              const { Icon } = p
              const connected = accounts[id]?.connected
              const s = live[id]
              return (
                <div key={id} className="rounded-xl border border-white/5 bg-navy-900/50 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${p.gradient} text-white`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-semibold text-white">{p.name}</span>
                    {connected ? (
                      <span className="ml-auto truncate text-xs text-slate-400">{accounts[id]?.handle}</span>
                    ) : (
                      <button
                        onClick={() => connect(id)}
                        className="ml-auto rounded-md border border-cyan-accent/30 px-2.5 py-1 text-xs font-semibold text-cyan-accent hover:bg-cyan-accent/10"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  {connected && (
                    <div className="mt-3">
                      {s === undefined ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading stats…
                        </div>
                      ) : s === 'error' ? (
                        <div className="text-xs text-amber-300/80">
                          Stats unavailable. Make sure the platform's API is enabled.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {s.metrics.slice(0, 3).map((m, i) => {
                            // YouTube channels can report 0 total views; show the
                            // live per-video sum instead so it isn't blank.
                            const value =
                              id === 'youtube' && m.label === 'views' && m.value === 0 && ytVideoViews
                                ? ytVideoViews
                                : m.value
                            return <Stat key={m.label} value={compact(value)} label={m.label} accent={i === 0} />
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          : CHANNEL_STATS.map((c, idx) => {
              const p = PLATFORMS[c.platform]
              const { Icon } = p
              const isOn = synced[c.platform]
              return (
                <div
                  key={c.platform}
                  className={`rounded-xl border bg-navy-900/50 p-4 transition-all ${
                    idx === 0 ? 'border-cyan-accent/40 ring-1 ring-cyan-accent/20' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${p.gradient} text-white`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-semibold text-white">{p.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-slate-400">Synced</span>
                      <Toggle
                        checked={isOn}
                        onChange={(v) => {
                          setSynced((sx) => ({ ...sx, [c.platform]: v }))
                          addToast(`${p.name} ${v ? 'synced' : 'unsynced'}`, 'info')
                        }}
                        size="sm"
                        label={`Sync ${p.name}`}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat value={c.impressions} label="impressions" />
                    <Stat value={c.clicks} label="clicks" />
                    <Stat value={c.revenue} label="revenue" accent />
                  </div>
                </div>
              )
            })}
      </div>
    </section>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-bold ${accent ? 'text-cyan-accent' : 'text-white'}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Unified Correlation                                                         */
/* -------------------------------------------------------------------------- */

// Metrics correlated across the channel's recent videos (live counts, no lag).
const VIDEO_METRICS: [keyof YouTubeVideo, string][] = [
  ['views', 'Views'],
  ['likes', 'Likes'],
  ['comments', 'Comments'],
]

// Short codes for the per-platform audience bars.
const SHORT: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  tiktok: 'TT',
  youtube: 'YT',
  pinterest: 'PIN',
  twitch: 'TW',
  patreon: 'PAT',
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx
    const b = y[i] - my
    num += a * b
    dx2 += a * a
    dy2 += b * b
  }
  if (dx2 === 0 || dy2 === 0) return NaN // a flat metric can't be correlated
  return num / Math.sqrt(dx2 * dy2)
}

/** Correlate views/likes/comments across the channel's recent videos. */
function correlationFromVideos(videos: YouTubeVideo[]) {
  const series = VIDEO_METRICS.map(([key]) => videos.map((v) => Number(v[key] || 0)))
  return {
    labels: VIDEO_METRICS.map(([, label]) => label),
    matrix: series.map((a) => series.map((b) => Math.round(pearson(a, b) * 100) / 100)),
  }
}

interface AudienceBar {
  label: string
  value: number
  color: string
}

function UnifiedCorrelation() {
  const { accounts } = useConnections()
  const ytConnected = Boolean(accounts.youtube?.connected)
  const [videos, setVideos] = useState<YouTubeVideo[] | 'error' | null>(null)
  const [audience, setAudience] = useState<AudienceBar[] | 'loading'>('loading')

  // Recent videos with LIVE counts (no analytics lag) power the trend + matrix.
  useEffect(() => {
    if (backendEnabled && ytConnected && videos === null) {
      fetchYouTubeRecentVideos(20)
        .then(setVideos)
        .catch(() => setVideos('error'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytConnected])

  // Pull follower counts per connected platform for the audience bars.
  useEffect(() => {
    if (!backendEnabled) return
    const connected = CONNECTABLE.filter((id) => accounts[id]?.connected)
    if (!connected.length) {
      setAudience([])
      return
    }
    Promise.all(
      connected.map((id) =>
        fetchStats(id)
          .then((s) => ({ label: SHORT[id] || PLATFORMS[id].name, value: s.followers, color: PLATFORMS[id].color }))
          .catch(() => null),
      ),
    ).then((rows) => setAudience(rows.filter((r): r is AudienceBar => Boolean(r))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  const liveYouTube = backendEnabled && ytConnected
  // Oldest -> newest so the trend reads left to right.
  const vids = Array.isArray(videos)
    ? [...videos].sort((a, b) => Date.parse(a.publishedAt || '') - Date.parse(b.publishedAt || ''))
    : []
  const hasVids = vids.length > 0
  const corr = vids.length >= 3 ? correlationFromVideos(vids) : null

  return (
    <section className="flex flex-col gap-5">
      <div className="card p-5">
        <ColumnHeader eyebrow="Unified Correlation" title={sampleData ? 'Correlation Matrix' : 'Metric Correlation'}>
          <IconBtn>
            <Settings2 className="h-4 w-4" />
          </IconBtn>
        </ColumnHeader>
        <p className="-mt-2 mb-3 text-xs text-slate-500">
          {sampleData ? 'Post Frequency vs. Revenue' : 'How views, likes & comments move together across your videos'}
        </p>
        {/* Fixed min height so the empty/loading states match the filled matrix. */}
        <div className="flex min-h-[250px] flex-col justify-center">
          {sampleData ? (
            <CorrelationMatrix />
          ) : !liveYouTube ? (
            <EmptyChart />
          ) : videos === null ? (
            <ChartLoading />
          ) : videos === 'error' ? (
            <ChartNote>Could not load videos. Reconnect YouTube in Settings.</ChartNote>
          ) : corr ? (
            <CorrelationMatrix
              rows={corr.labels}
              cols={corr.labels}
              matrix={corr.matrix}
              rowAxis="Per video"
              colAxis="Per video"
            />
          ) : (
            <ChartNote>Need at least 3 videos to correlate. Publish a few and they'll show here.</ChartNote>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Engagement Trend</h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">
            {sampleData
              ? 'Oct 20 – 26'
              : liveYouTube
                ? 'Views per recent video · live counts, no delay'
                : 'Last 7 days'}
          </p>
          {sampleData ? (
            <EngagementTrend />
          ) : liveYouTube ? (
            videos === null ? (
              <ChartLoading />
            ) : videos === 'error' ? (
              <ChartNote>Could not load videos. Reconnect YouTube in Settings.</ChartNote>
            ) : hasVids ? (
              <EngagementTrend
                data={vids.map((v) => v.views)}
                labels={sparseLabels(vids.map((v) => (v.publishedAt || '').slice(0, 10)))}
              />
            ) : (
              <ChartNote>No videos yet. Publish one and its live views show up here.</ChartNote>
            )
          ) : (
            <EmptyChart />
          )}
        </div>

        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {sampleData ? 'Conversion by Platform' : 'Audience by Platform'}
            </h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">{sampleData ? 'Oct 20 – 26' : 'Followers per channel'}</p>
          {sampleData ? (
            <ConversionBars />
          ) : !backendEnabled ? (
            <EmptyChart />
          ) : audience === 'loading' ? (
            <ChartLoading />
          ) : audience.length ? (
            <ConversionBars bars={audience} format={compact} />
          ) : (
            <ChartNote>Connect channels to compare your audience across platforms.</ChartNote>
          )}
        </div>
      </div>
    </section>
  )
}

/** Build a sparse label row: just the first and last dates (M/D), rest blank. */
function sparseLabels(days: string[]): string[] {
  const fmt = (d: string) => {
    const parts = d.split('-')
    return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : d
  }
  return days.map((d, i) => (i === 0 || i === days.length - 1 ? fmt(d) : ''))
}

function ChartLoading() {
  return (
    <div className="grid h-28 place-items-center text-xs text-slate-500">
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
      </span>
    </div>
  )
}

function ChartNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-28 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-xs text-slate-500">
      {children}
    </div>
  )
}

/* ---------------------------------- bits ---------------------------------- */

function ColumnHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {eyebrow}
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
      {children}
    </button>
  )
}

function EmptyChart() {
  return (
    <div className="grid h-28 place-items-center rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500">
      No analytics yet. Connect channels and publish to see this.
    </div>
  )
}
