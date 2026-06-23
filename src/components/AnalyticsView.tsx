import { useEffect, useState } from 'react'
import { Maximize2, MoreHorizontal, Settings2, Loader2 } from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { useConnections, CONNECTABLE } from './Connections'
import { backendEnabled, sampleData, fetchStats, type RemoteStats } from '../lib/socialApi'
import { CHANNEL_STATS, PLATFORMS } from '../data'
import { CorrelationMatrix, EngagementTrend, ConversionBars } from './charts'

export default function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
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
                          {s.metrics.slice(0, 3).map((m, i) => (
                            <Stat key={m.label} value={compact(m.value)} label={m.label} accent={i === 0} />
                          ))}
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

function UnifiedCorrelation() {
  return (
    <section className="flex flex-col gap-5">
      <div className="card p-5">
        <ColumnHeader eyebrow="Unified Correlation" title="Correlation Matrix">
          <IconBtn>
            <Settings2 className="h-4 w-4" />
          </IconBtn>
        </ColumnHeader>
        <p className="-mt-2 mb-3 text-xs text-slate-500">Post Frequency vs. Revenue</p>
        {sampleData ? <CorrelationMatrix /> : <EmptyChart />}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Engagement Trend</h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">{sampleData ? 'Oct 20 – 26' : 'Last 7 days'}</p>
          {sampleData ? <EngagementTrend /> : <EmptyChart />}
        </div>

        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Conversion by Platform</h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">{sampleData ? 'Oct 20 – 26' : 'Last 7 days'}</p>
          {sampleData ? <ConversionBars /> : <EmptyChart />}
        </div>
      </div>
    </section>
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
