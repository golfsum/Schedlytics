import { useState } from 'react'
import {
  UploadCloud,
  Clock,
  ChevronDown,
  Maximize2,
  MoreHorizontal,
  Settings2,
  FlaskConical,
} from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { useImageUpload } from './ImageUpload'
import { CHANNEL_STATS, PLATFORMS } from '../data'
import { CorrelationMatrix, EngagementTrend, ConversionBars } from './charts'

export default function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Media Studio &amp; Analytics</h1>
        <span className="rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
          Unified Correlation
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <MediaStudio />
        <ChannelPerformance />
        <UnifiedCorrelation />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Column 1 — Media Studio                                                     */
/* -------------------------------------------------------------------------- */

function MediaStudio() {
  const { addToast } = useToast()
  const [abTest, setAbTest] = useState(true)
  const [variantA, setVariantA] = useState('Get ready for cozy layers!')
  const [variantB, setVariantB] = useState('Shop the new season now!')
  const [published, setPublished] = useState(false)
  const media = useImageUpload(undefined, () => addToast('Image uploaded'))

  return (
    <section className="card flex flex-col p-5">
      <ColumnHeader eyebrow="Media Studio" title="Post Image" />

      {/* upload + preview */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={media.open}
          className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-navy-900/50 text-slate-400 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
        >
          {media.preview ? (
            <img src={media.preview} alt="Uploaded" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="h-7 w-7" />
              <span className="text-xs font-medium">Upload here</span>
            </div>
          )}
        </button>
        {media.input}
        <div className="overflow-hidden rounded-xl border border-white/10">
          <img
            src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=70"
            alt="Fall collection"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* title */}
      <Field label="Title" className="mt-5">
        <input
          defaultValue="Fall Collection Teaser"
          className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
        />
      </Field>

      {/* multi-variant captions */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            Multi-variant Captions
          </span>
          <span className="text-xs font-medium text-cyan-accent">Multi-variant</span>
        </div>
        <div className="mt-2 space-y-2">
          <VariantInput letter="A" value={variantA} onChange={setVariantA} />
          <VariantInput letter="B" value={variantB} onChange={setVariantB} disabled={!abTest} />
        </div>
      </div>

      {/* A/B toggle */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-white/5 bg-navy-900/50 px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <FlaskConical className="h-4 w-4 text-cyan-accent" /> A/B Test
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-cyan-accent">A/B</span>
          <Toggle
            checked={abTest}
            onChange={(v) => {
              setAbTest(v)
              addToast(v ? 'A/B testing enabled' : 'A/B testing disabled', 'info')
            }}
            size="sm"
            label="A/B Test"
          />
        </div>
      </div>

      {/* scheduled time */}
      <Field label="Scheduled Time" className="mt-5">
        <div className="relative">
          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select className="w-full appearance-none rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-8 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20">
            <option>Oct 26, 10:00 AM PST</option>
            <option>Oct 27, 9:00 AM PST</option>
            <option>Oct 28, 2:00 PM PST</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </Field>

      <button
        onClick={() => {
          setPublished(true)
          addToast(
            abTest ? 'A/B post published — tracking both variants! 🚀' : 'Post published successfully! 🚀',
          )
          setTimeout(() => setPublished(false), 1400)
        }}
        className="mt-5 w-full rounded-lg gradient-cyan py-3 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01]"
      >
        {published ? 'Published ✓' : 'Publish'}
      </button>
    </section>
  )
}

function VariantInput({
  letter,
  value,
  onChange,
  disabled,
}: {
  letter: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-white/5 bg-navy-900/60 pl-2.5 transition-opacity ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-md gradient-cyan-soft text-xs font-bold text-cyan-accent">
        {letter}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-transparent py-2.5 pr-3 text-sm text-slate-200 focus:outline-none"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Column 2 — Channel Performance / Cross-Platform Sync                        */
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
                idx === 0
                  ? 'border-cyan-accent/40 ring-1 ring-cyan-accent/20'
                  : 'border-white/5'
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
      <div className={`text-lg font-bold ${accent ? 'text-cyan-accent' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Column 3 — Unified Correlation                                              */
/* -------------------------------------------------------------------------- */

function UnifiedCorrelation() {
  return (
    <section className="flex flex-col gap-5">
      {/* correlation matrix */}
      <div className="card p-5">
        <ColumnHeader eyebrow="Unified Correlation" title="Correlation Matrix">
          <IconBtn>
            <Settings2 className="h-4 w-4" />
          </IconBtn>
        </ColumnHeader>
        <p className="-mt-2 mb-3 text-xs text-slate-500">Post Frequency vs. Revenue</p>
        <CorrelationMatrix />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {/* engagement trend */}
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Engagement Trend</h3>
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mb-2 text-xs text-slate-500">Oct 20 – 26</p>
          <EngagementTrend />
        </div>

        {/* conversion by platform */}
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

function Field({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <span className="mb-2 block text-sm font-semibold text-white">{label}</span>
      {children}
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
