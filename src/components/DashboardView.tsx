import {
  Users,
  DollarSign,
  Percent,
  MousePointerClick,
  Award,
  Megaphone,
  Link2,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Plug,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AreaChart } from './charts'
import { useConnections, CONNECTABLE } from './Connections'
import { useAuth } from './Auth'
import {
  backendEnabled,
  sampleData,
  fetchStats,
  fetchYouTubeDaily,
  fetchYouTubeRecentVideos,
  type DailyMetric,
  type YouTubeVideo,
} from '../lib/socialApi'
import {
  PLATFORMS,
  WEEKDAYS,
  TIME_SLOTS,
  GROWTH_METRICS,
  TOP_POSTS,
  PLATFORM_PERFORMANCE,
  DASHBOARD_INSIGHT,
  isComingSoon,
} from '../data'
import { listShortLinks, type ShortLink } from '../lib/shortLinks'
import { realGrowthScore, realWeeklyBrief, topByClicks } from '../lib/growth'
import { GROWTH_SCORE, WEEKLY_BRIEF, SAMPLE_OPPORTUNITIES, type Opportunity } from '../data'
import { GrowthScoreCard, ThisWeekCard, OpportunitiesCard } from './GrowthCoach'
import type { CalendarPost, NavId, PlatformId } from '../types'

/** Icon per growth-metric key (data lives in GROWTH_METRICS). */
const METRIC_ICONS: Record<string, LucideIcon> = {
  clicks: MousePointerClick,
  visitors: Users,
  platform: Award,
  campaign: Megaphone,
  revenue: DollarSign,
  ctr: Percent,
}

/** Actionable growth opportunities derived from real connection + link state, ranked by impact. */
function realOpportunities(accounts: Record<string, { connected: boolean }>, links: ShortLink[]): Opportunity[] {
  const opps: Opportunity[] = []
  if (links.length < 3) {
    opps.push({ tier: 'Highest Impact', label: 'Add trackable links to more posts', potential: 22, nav: 'links' })
  } else if (!links.some((l) => l.utmSource)) {
    opps.push({ tier: 'Highest Impact', label: 'Add UTM tags to your links', potential: 18, nav: 'links' })
  }
  if (!links.some((l) => l.campaign)) {
    opps.push({ tier: 'Easy Win', label: 'Create your first campaign', potential: 15, nav: 'campaigns' })
  }
  if (links.length >= 1 && links.length < 6) {
    opps.push({ tier: 'Easy Win', label: 'Add a QR code to a printed touchpoint', potential: 9, nav: 'links' })
  }
  const notConnected = CONNECTABLE.filter((id) => !accounts[id]?.connected && !isComingSoon(id))
  notConnected.slice(0, 3).forEach((id, i) => {
    opps.push({ tier: 'Missing Data', label: `Connect ${PLATFORMS[id].name}`, potential: 8 - i, nav: 'settings' })
  })
  return opps.slice(0, 6)
}

/** Compact number formatting (12345 -> "12.3K"). */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Relative time for activity rows ("3h ago", "2d ago"). */
function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  const d = Math.floor(s / 86_400)
  if (d >= 1) return `${d}d ago`
  const h = Math.floor(s / 3_600)
  if (h >= 1) return `${h}h ago`
  const m = Math.floor(s / 60)
  return m >= 1 ? `${m}m ago` : 'just now'
}

/** Real follower totals + YouTube daily metrics + tracked links for the dashboard. */
function useDashboardStats() {
  const { accounts } = useConnections()
  const [followers, setFollowers] = useState<number | null>(null)
  const [daily, setDaily] = useState<DailyMetric[] | null>(null)
  const [videos, setVideos] = useState<YouTubeVideo[] | null>(null)
  const [links, setLinks] = useState<ShortLink[]>([])
  const connectedKey = CONNECTABLE.filter((id) => accounts[id]?.connected).join(',')
  const ytConnected = Boolean(accounts.youtube?.connected)

  // Tracked links carry real click/visitor counts (local or backend), so the
  // growth metrics reflect actual traffic even before the analytics backend.
  useEffect(() => {
    listShortLinks().then(setLinks).catch(() => setLinks([]))
  }, [])

  useEffect(() => {
    if (!backendEnabled) return
    const connected = CONNECTABLE.filter((id) => accounts[id]?.connected)
    if (!connected.length) {
      setFollowers(0)
      return
    }
    Promise.all(connected.map((id) => fetchStats(id).then((s) => s.followers).catch(() => 0))).then((arr) =>
      setFollowers(arr.reduce((a, b) => a + b, 0)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedKey])

  useEffect(() => {
    if (!backendEnabled || !ytConnected) return
    // Daily analytics lags 1-3 days; live per-video counts fill the gap meanwhile.
    fetchYouTubeDaily().then(setDaily).catch(() => setDaily([]))
    fetchYouTubeRecentVideos(25).then(setVideos).catch(() => setVideos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytConnected])

  return { followers, daily, videos, links }
}

interface DashboardViewProps {
  posts: CalendarPost[]
  onQuickCreate: () => void
  onNavigate: (id: NavId) => void
}

const FOLLOWER_GROWTH = [120, 126, 131, 129, 138, 145, 151, 149, 158, 167, 175, 182]

export default function DashboardView({ posts, onQuickCreate, onNavigate }: DashboardViewProps) {
  const { user } = useAuth()
  const firstName = (user?.name || '').trim().split(' ')[0] || 'there'
  const { followers, daily, videos, links } = useDashboardStats()
  const { accounts } = useConnections()

  // Real aggregates from the user's tracked links (works without a backend).
  const realClicks = links.reduce((s, l) => s + (l.clicks || 0), 0)
  const trackedVisitors = links.reduce((s, l) => s + (l.uniqueVisitors || 0), 0)
  const hasRealClicks = realClicks > 0
  // The local/backend click counter does not dedupe visitors, so when no real
  // unique-visitor data exists we show a conservative estimate (<= clicks).
  const visitorsEstimated = trackedVisitors === 0 && hasRealClicks
  const realVisitors = trackedVisitors > 0 ? trackedVisitors : visitorsEstimated ? Math.max(1, Math.round(realClicks * 0.7)) : 0
  const bestLinkPlatform = topByClicks(links, 'platform') as PlatformId | null
  const topLinkCampaign = topByClicks(links, 'campaign')

  // Real value + caption per growth-metric card (used when not in demo).
  const realMetric: Record<string, { value: string; delta: string }> = {
    clicks: hasRealClicks
      ? { value: compact(realClicks), delta: `across ${links.length} link${links.length === 1 ? '' : 's'}` }
      : { value: '—', delta: 'No clicks yet' },
    visitors: realVisitors > 0
      ? { value: compact(realVisitors), delta: visitorsEstimated ? 'estimated unique' : 'unique, from your links' }
      : { value: '—', delta: 'No data yet' },
    campaign: topLinkCampaign
      ? { value: topLinkCampaign, delta: 'top campaign' }
      : { value: '—', delta: 'No campaigns yet' },
    revenue: { value: '—', delta: 'Revenue tracking soon' },
    ctr: { value: '—', delta: 'Needs impression data' },
  }

  // Upcoming posts derived from the live calendar state.
  const upcoming = [...posts]
    .sort((a, b) => a.day - b.day || a.slot - b.slot)
    .slice(0, 4)

  // Daily analytics (lags 1-3 days): cumulative subscriber growth for the chart.
  const dailyRows = daily || []
  let cum = 0
  const growth = dailyRows.map((d) => (cum += (d.subscribersGained || 0) - (d.subscribersLost || 0)))
  const netSubs = growth.length ? growth[growth.length - 1] : 0

  // Live per-video counts (no lag) - drive the audience trend + recent activity
  // for real accounts, mirroring the Insights view's live-first approach.
  const vids = Array.isArray(videos) ? videos : []
  const vidsChrono = [...vids].sort(
    (a, b) => Date.parse(a.publishedAt || '') - Date.parse(b.publishedAt || ''),
  )
  const loading = daily === null && videos === null

  // Audience-growth card: only plot the subscriber series when it actually
  // varies (a flat all-zero series would draw a misleading flat line at 0).
  // Otherwise fall back to a live "views per recent upload" trend.
  const showSubGrowth = growth.length >= 2 && Math.max(...growth) !== Math.min(...growth)
  const showLiveTrend = !showSubGrowth && vidsChrono.length >= 2

  // Recent Activity: the latest uploads with their live counts (newest first).
  const recentActivity = [...vids]
    .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
    .slice(0, 4)

  // Growth Coach: sample in demo; computed from real signals for live accounts.
  const realScore = realGrowthScore(realClicks, vids, posts.length, links)
  const realBrief = realWeeklyBrief(realClicks, realVisitors, bestLinkPlatform, topLinkCampaign, vids, links)
  const opportunities = sampleData ? SAMPLE_OPPORTUNITIES : realOpportunities(accounts, links)

  // 30-day traffic sparkline for "This Week": a stable demo shape, or the real
  // click total distributed across the range. Omitted when there is no traffic.
  const weekTrend = sampleData
    ? sampleSeries('clicks', '30D')
    : hasRealClicks
      ? scaleToTotal(sampleSeries('clicks', '30D'), realClicks)
      : undefined

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Growth Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            {firstName !== 'there' ? `${firstName}, see ` : 'See '}which posts, platforms, and
            campaigns are driving traffic.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={onQuickCreate}
            className="flex items-center gap-2 rounded-xl gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.03]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
            Create Post
          </button>
          <button
            onClick={() => onNavigate('links')}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Link2 className="h-4 w-4" />
            Create Link
          </button>
          <button
            onClick={() => onNavigate('campaigns')}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Megaphone className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* hero: Growth Level (enlarged) + This Week */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <GrowthScoreCard data={sampleData ? GROWTH_SCORE : realScore} building={!sampleData && !realScore} hero />
        </div>
        <div className="lg:col-span-2">
          <ThisWeekCard
            brief={sampleData ? WEEKLY_BRIEF : realBrief}
            building={!sampleData && !realBrief}
            trend={weekTrend}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* actionable roadmap: top move + expandable list */}
      <OpportunitiesCard opportunities={opportunities} onNavigate={onNavigate} />

      {/* growth metric cards */}
      {!sampleData && !hasRealClicks && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-accent/20 bg-cyan-accent/5 px-4 py-3 text-sm text-slate-300">
          <Lightbulb className="h-4 w-4 shrink-0 text-cyan-accent" />
          <span>Add trackable links to your posts to start measuring clicks, visitors, and revenue.</span>
          <button
            onClick={() => onNavigate('links')}
            className="ml-auto shrink-0 rounded-lg gradient-cyan px-3 py-1.5 text-xs font-bold text-navy-900"
          >
            Start tracking
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROWTH_METRICS.map((m) => (
          <StatCard
            key={m.key}
            Icon={METRIC_ICONS[m.key] || MousePointerClick}
            label={m.label}
            value={sampleData ? m.value : realMetric[m.key]?.value ?? '—'}
            delta={sampleData ? m.delta : realMetric[m.key]?.delta ?? 'No data yet'}
            up={sampleData ? m.up : undefined}
          />
        ))}
      </div>

      {/* clicks over time */}
      <ClicksOverTime
        sample={sampleData}
        onNavigate={onNavigate}
        real={hasRealClicks ? { clicks: realClicks, visitors: realVisitors } : null}
      />

      {/* top posts + best platforms */}
      <div className="grid gap-5 xl:grid-cols-2">
        <TopPostsCard sample={sampleData} />
        <BestPlatformsCard sample={sampleData} />
      </div>

      {/* headline insight */}
      <InsightCallout sample={sampleData} onNavigate={onNavigate} />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* audience growth */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {!sampleData && showLiveTrend ? 'Recent Upload Views' : 'Audience Growth'}
            </h2>
            {sampleData ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
                <ArrowUpRight className="h-4 w-4" /> +51.6K this year
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-semibold text-cyan-accent">
                <Users className="h-4 w-4" />
                {followers == null
                  ? '…'
                  : `${compact(followers)} subscriber${followers === 1 ? '' : 's'}`}
                {showSubGrowth && netSubs !== 0 && (
                  <span className={netSubs > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {' '}
                    ({netSubs > 0 ? '+' : ''}
                    {compact(netSubs)} 30d)
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-slate-500">
            {sampleData
              ? 'Followers across all connected channels'
              : showLiveTrend
                ? 'Views per recent upload · live counts, no delay'
                : 'YouTube subscribers gained over the last 30 days'}
          </p>
          {sampleData ? (
            <>
              <AreaChart data={FOLLOWER_GROWTH} format={(v) => `${v}K`} />
              <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </>
          ) : showSubGrowth ? (
            <AreaChart data={growth} format={(v) => String(v)} />
          ) : showLiveTrend ? (
            <AreaChart data={vidsChrono.map((v) => v.views)} format={(v) => compact(v)} />
          ) : (
            <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-slate-500">
              {loading
                ? 'Loading…'
                : 'No upload data yet. Publish a video and stats appear here within minutes.'}
            </div>
          )}
        </div>

        {/* connected accounts */}
        <ConnectedAccountsCard onNavigate={onNavigate} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* upcoming posts */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Upcoming Posts</h2>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-sm font-medium text-cyan-accent hover:underline"
            >
              View calendar
            </button>
          </div>
          <div className="space-y-2">
            {upcoming.map((p) => {
              const plat = PLATFORMS[p.platform]
              const { Icon } = plat
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-3"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${plat.gradient} text-white`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{p.label}</div>
                    <div className="text-xs text-slate-500">
                      {WEEKDAYS[p.day]} · {TIME_SLOTS[p.slot]} AM
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-cyan-accent/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-accent">
                    Scheduled
                  </span>
                </div>
              )
            })}
            {upcoming.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No posts scheduled yet.</p>
            )}
          </div>
        </div>

        {/* recent activity */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-white">Recent Activity</h2>
          {sampleData ? (
            <div className="space-y-4">
              <Activity color="#22D3EE" text="Reel “Styling reel” hit 12.4K views" time="2h ago" />
              <Activity color="#E1306C" text="New milestone: 128K Instagram followers" time="5h ago" />
              <Activity color="#22C55E" text="Revenue goal 80% reached for June" time="Yesterday" />
              <Activity color="#8B5CF6" text="A/B test on “Fall Teaser” concluded" time="2d ago" />
            </div>
          ) : recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((v) => (
                <Activity
                  key={v.id}
                  color="#22D3EE"
                  text={`“${v.title}” · ${compact(v.views)} views, ${compact(v.likes)} likes`}
                  time={timeAgo(v.publishedAt)}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">
              {loading ? 'Loading…' : 'No activity yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- bits ---------------------------------- */

function StatCard({
  Icon,
  label,
  value,
  delta,
  up,
}: {
  Icon: LucideIcon
  label: string
  value: string
  delta: string
  up?: boolean
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl gradient-cyan-soft text-cyan-accent">
          <Icon className="h-5 w-5" />
        </span>
        {up !== undefined ? (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              up ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {delta}
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-500">{delta}</span>
        )}
      </div>
      <div className="mt-4 text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  )
}

function ConnectedAccountsCard({ onNavigate }: { onNavigate: (id: NavId) => void }) {
  const { accounts, connect } = useConnections()

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Connected Accounts</h2>
        <button
          onClick={() => onNavigate('settings')}
          className="text-sm font-medium text-cyan-accent hover:underline"
        >
          Manage
        </button>
      </div>
      <div className="space-y-2.5">
        {CONNECTABLE.map((id) => {
          const plat = PLATFORMS[id]
          const { Icon } = plat
          const acct = accounts[id]
          const soon = isComingSoon(id)
          return (
            <div key={id} className={`flex items-center gap-3 ${soon ? 'opacity-60' : ''}`} title={soon ? 'Coming soon' : undefined}>
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${plat.gradient} text-white ${soon ? 'grayscale' : ''}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{plat.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {soon ? 'Coming soon' : acct.connected ? acct.handle || 'Connected' : 'Not connected'}
                </div>
              </div>
              {soon ? (
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Soon</span>
              ) : acct.connected ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Synced
                </span>
              ) : acct.connecting ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-cyan-accent">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
                </span>
              ) : (
                <button
                  onClick={() => connect(id as PlatformId)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-accent/30 px-2.5 py-1.5 text-xs font-semibold text-cyan-accent transition-colors hover:bg-cyan-accent/10"
                >
                  <Plug className="h-3.5 w-3.5" /> Connect
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg gradient-cyan-soft px-3 py-2.5 text-xs text-slate-300">
        <Sparkles className="h-4 w-4 shrink-0 text-cyan-accent" />
        Connect more channels to cross-post automatically.
      </div>
    </div>
  )
}

function Activity({ color, text, time }: { color: string; text: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">{text}</p>
        <p className="text-xs text-slate-500">{time}</p>
      </div>
    </div>
  )
}

/* ----------------------------- growth sections ---------------------------- */

type ClicksTab = 'clicks' | 'visitors' | 'revenue'
type ClicksRange = '7D' | '30D' | '90D' | 'Year'

/** Deterministic sample series so demo screenshots are stable (no randomness). */
function sampleSeries(tab: ClicksTab, range: ClicksRange): number[] {
  const counts: Record<ClicksRange, number> = { '7D': 7, '30D': 16, '90D': 12, Year: 12 }
  const mag: Record<ClicksTab, number> = { clicks: 620, visitors: 410, revenue: 300 }
  const n = counts[range]
  let h = 0
  for (const ch of tab + range) h = (h * 31 + ch.charCodeAt(0)) | 0
  const seed = ((h % 100) / 100) * Math.PI * 2
  const base = mag[tab]
  return Array.from({ length: n }, (_, i) =>
    Math.max(
      1,
      Math.round(base * (0.7 + 0.45 * Math.sin(i * 0.6 + seed) + 0.12 * Math.sin(i * 1.7)) * (1 + i / (n * 3))),
    ),
  )
}

const CLICKS_TABS: { id: ClicksTab; label: string }[] = [
  { id: 'clicks', label: 'Clicks' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'revenue', label: 'Revenue' },
]
const CLICKS_RANGES: ClicksRange[] = ['7D', '30D', '90D', 'Year']

/** Reshape a sample series so it sums to a known real total (keeps the shape). */
function scaleToTotal(shape: number[], total: number): number[] {
  const sum = shape.reduce((a, b) => a + b, 0) || 1
  return shape.map((v) => Math.max(0, Math.round((v / sum) * total)))
}

function ClicksOverTime({
  sample,
  onNavigate,
  real,
}: {
  sample: boolean
  onNavigate: (id: NavId) => void
  real?: { clicks: number; visitors: number } | null
}) {
  const [tab, setTab] = useState<ClicksTab>('clicks')
  const [range, setRange] = useState<ClicksRange>('30D')
  const fmt = (v: number) => (tab === 'revenue' ? `$${compact(v)}` : compact(v))

  // Real mode: distribute the real link total across the range (no per-day
  // backend yet). Revenue has no real source, so it shows the empty prompt.
  const realTotal = real ? (tab === 'clicks' ? real.clicks : tab === 'visitors' ? real.visitors : 0) : 0
  const series = sample
    ? sampleSeries(tab, range)
    : real && realTotal > 0
      ? scaleToTotal(sampleSeries(tab, range), realTotal)
      : []
  const showChart = series.length > 0

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-white">Clicks Over Time</h2>
        {/* metric tabs */}
        <div className="flex rounded-lg border border-white/5 bg-navy-900/60 p-0.5">
          {CLICKS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id ? 'gradient-cyan text-navy-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* range filters */}
        <div className="ml-auto flex rounded-lg border border-white/5 bg-navy-900/60 p-0.5">
          {CLICKS_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                range === r ? 'bg-cyan-accent/15 text-cyan-accent' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'Year' ? 'This Year' : r}
            </button>
          ))}
        </div>
      </div>

      {showChart ? (
        <AreaChart data={series} format={fmt} />
      ) : (
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-slate-500">
          <div>
            {tab === 'revenue' && real
              ? 'Revenue tracking is coming soon.'
              : (
                <>
                  No click data yet.
                  <button onClick={() => onNavigate('links')} className="ml-1 font-semibold text-cyan-accent hover:underline">
                    Create a trackable link
                  </button>{' '}
                  to see clicks over time.
                </>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

function TopPostsCard({ sample }: { sample: boolean }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 text-lg font-bold text-white">Top Performing Posts</h2>
      {sample ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-semibold">Post</th>
                <th className="pb-2 text-right font-semibold">Views</th>
                <th className="pb-2 text-right font-semibold">Clicks</th>
                <th className="pb-2 text-right font-semibold">CTR</th>
                <th className="pb-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {TOP_POSTS.map((p) => {
                const plat = PLATFORMS[p.platform]
                const { Icon } = plat
                return (
                  <tr key={p.title}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${plat.gradient} text-white`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate font-medium text-white">{p.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-slate-400">{compact(p.views)}</td>
                    <td className="py-2.5 text-right font-semibold text-white">{compact(p.clicks)}</td>
                    <td className="py-2.5 text-right text-slate-300">{p.ctr}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-400">{p.revenue}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">
          No tracked posts yet. Add a trackable link to a post to rank it here.
        </p>
      )}
    </div>
  )
}

function BestPlatformsCard({ sample }: { sample: boolean }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 text-lg font-bold text-white">Best Platforms</h2>
      {sample ? (
        <div className="space-y-2.5">
          {PLATFORM_PERFORMANCE.map((row) => {
            const plat = PLATFORMS[row.platform]
            const { Icon } = plat
            return (
              <div
                key={row.platform}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-3"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${plat.gradient} text-white`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="w-20 shrink-0 truncate text-sm font-semibold text-white">{plat.name}</span>
                <div className="ml-auto flex items-center gap-4 text-right text-xs">
                  <Stat label="Views" value={row.views} />
                  <Stat label="Clicks" value={row.clicks} />
                  <Stat label="CTR" value={row.ctr} />
                  <Stat label="Revenue" value={row.revenue} accent />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">
          Connect channels and add trackable links to compare platform performance.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[44px]">
      <div className={`font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

function InsightCallout({ sample, onNavigate }: { sample: boolean; onNavigate: (id: NavId) => void }) {
  return (
    <div className="card flex items-start gap-3 border-cyan-accent/20 bg-cyan-accent/5 p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-cyan-soft text-cyan-accent">
        <Lightbulb className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-cyan-accent">Schedlytics Insight</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-200">
          {sample
            ? DASHBOARD_INSIGHT
            : 'Connect your channels and add trackable links to unlock automatic growth insights.'}
        </p>
      </div>
      <button
        onClick={() => onNavigate('insights')}
        className="shrink-0 rounded-lg border border-cyan-accent/30 px-3 py-1.5 text-xs font-semibold text-cyan-accent transition-colors hover:bg-cyan-accent/10"
      >
        View insights
      </button>
    </div>
  )
}
