import { useState } from 'react'
import { Maximize2, MoreHorizontal, Settings2 } from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
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

function ChannelPerformance() {
  const { addToast } = useToast()
  const [synced, setSynced] = useState<Record<string, boolean>>(
    Object.fromEntries(CHANNEL_STATS.map((c) => [c.platform, c.synced])),
  )

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
      <p className="-mt-2 text-xs text-slate-500">Select platform by cross-correlation</p>

      <div className="mt-4 space-y-3">
        {CHANNEL_STATS.map((c, idx) => {
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
                      setSynced((s) => ({ ...s, [c.platform]: v }))
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
        <CorrelationMatrix />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Engagement Trend</h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">Oct 20 – 26</p>
          <EngagementTrend />
        </div>

        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Conversion by Platform</h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">Oct 20 – 26</p>
          <ConversionBars />
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
