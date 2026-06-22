import {
  Users,
  Heart,
  CalendarClock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Plug,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AreaChart } from './charts'
import { useConnections, CONNECTABLE } from './Connections'
import { PLATFORMS, WEEKDAYS, TIME_SLOTS } from '../data'
import type { CalendarPost, NavId, PlatformId } from '../types'

interface DashboardViewProps {
  posts: CalendarPost[]
  onQuickCreate: () => void
  onNavigate: (id: NavId) => void
}

const FOLLOWER_GROWTH = [120, 126, 131, 129, 138, 145, 151, 149, 158, 167, 175, 182]

export default function DashboardView({ posts, onQuickCreate, onNavigate }: DashboardViewProps) {
  // Upcoming posts derived from the live calendar state.
  const upcoming = [...posts]
    .sort((a, b) => a.day - b.day || a.slot - b.slot)
    .slice(0, 4)

  return (
    <div className="space-y-6">
      {/* greeting */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Alex 👋</h1>
          <p className="mt-1 text-sm text-slate-400">
            Here's how your content is performing this week.
          </p>
        </div>
        <button
          onClick={onQuickCreate}
          className="ml-auto flex items-center gap-2 rounded-xl gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          Create New Post
        </button>
      </div>

      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          Icon={Users}
          label="Total Followers"
          value="182.4K"
          delta="+4.2%"
          up
        />
        <StatCard Icon={Heart} label="Engagement Rate" value="6.8%" delta="+0.9%" up />
        <StatCard
          Icon={CalendarClock}
          label="Scheduled Posts"
          value={String(posts.length)}
          delta="this week"
        />
        <StatCard Icon={DollarSign} label="Revenue (30d)" value="$12.6k" delta="+18%" up />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* audience growth */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Audience Growth</h2>
            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
              <ArrowUpRight className="h-4 w-4" /> +51.6K this year
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-500">Followers across all connected channels</p>
          <AreaChart data={FOLLOWER_GROWTH} />
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
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
          <div className="space-y-4">
            <Activity color="#22D3EE" text="Reel “Styling reel” hit 12.4K views" time="2h ago" />
            <Activity color="#E1306C" text="New milestone: 128K Instagram followers" time="5h ago" />
            <Activity color="#22C55E" text="Revenue goal 80% reached for June" time="Yesterday" />
            <Activity color="#8B5CF6" text="A/B test on “Fall Teaser” concluded" time="2d ago" />
          </div>
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
          return (
            <div key={id} className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${plat.gradient} text-white`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{plat.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {acct.connected ? acct.handle : 'Not connected'}
                </div>
              </div>
              {acct.connected ? (
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
