import { useState } from 'react'
import {
  CORRELATION_MATRIX,
  CORRELATION_ROWS,
  CORRELATION_COLS,
  ENGAGEMENT_TREND,
  ENGAGEMENT_LABELS,
  CONVERSION_BARS,
} from '../data'

/* -------------------------------------------------------------------------- */
/*  Correlation matrix heatmap                                                  */
/* -------------------------------------------------------------------------- */

/** Map correlation strength (|v|, 0–1) to an orange→amber heat color. */
function heat(v: number): string {
  if (Number.isNaN(v)) return '#1E293B' // no variation -> neutral
  const a = Math.abs(v)
  if (a >= 0.7) return '#F97316'
  if (a >= 0.55) return '#FB923C'
  if (a >= 0.4) return '#FDBA74'
  if (a >= 0.25) return '#FED7AA'
  return '#FEF3E2'
}

export function CorrelationMatrix({
  rows = CORRELATION_ROWS,
  cols = CORRELATION_COLS,
  matrix = CORRELATION_MATRIX,
  rowAxis = 'Post Frequency',
  colAxis = 'Post Frequency',
}: {
  rows?: string[]
  cols?: string[]
  matrix?: number[][]
  rowAxis?: string
  colAxis?: string
} = {}) {
  const n = rows.length
  return (
    <div className="flex gap-3">
      {/* y-axis label */}
      <div className="flex flex-col items-center justify-center">
        <span className="rotate-180 text-[10px] font-medium tracking-wide text-slate-500 [writing-mode:vertical-rl]">
          {rowAxis}
        </span>
      </div>

      {/* row labels */}
      <div className="grid gap-1 py-0.5" style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <span key={r} className="flex items-center text-[10px] text-slate-500">
            {r}
          </span>
        ))}
      </div>

      <div className="flex-1">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {matrix.map((row, r) =>
            row.map((val, c) => {
              const undef = Number.isNaN(val)
              return (
                <div
                  key={`${r}-${c}`}
                  title={
                    undef
                      ? `${rows[r]} vs ${cols[c]}: no variation in this window`
                      : `${rows[r]} vs ${cols[c]}: ${val.toFixed(2)}`
                  }
                  className={`grid aspect-[1.7/1] place-items-center rounded-md text-[11px] font-bold transition-transform hover:scale-105 ${
                    undef ? 'text-slate-600' : 'text-navy-900'
                  }`}
                  style={{ backgroundColor: heat(val) }}
                >
                  {undef ? '—' : val.toFixed(2)}
                </div>
              )
            }),
          )}
        </div>
        {/* x-axis ticks */}
        <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((c) => (
            <span key={c} className="truncate text-center text-[10px] text-slate-500" title={c}>
              {c}
            </span>
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] font-medium tracking-wide text-slate-500">{colAxis}</p>
      </div>

      {/* legend */}
      <div className="flex flex-col items-center justify-between py-1">
        <span className="text-[9px] text-slate-500">high</span>
        <div
          className="my-1 w-2.5 flex-1 rounded-full"
          style={{ background: 'linear-gradient(to bottom, #F97316, #FEF3E2)' }}
        />
        <span className="text-[9px] text-slate-500">low</span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Engagement trend - line/area chart                                          */
/* -------------------------------------------------------------------------- */

export function EngagementTrend({
  data = ENGAGEMENT_TREND,
  labels = ENGAGEMENT_LABELS,
}: {
  data?: number[]
  labels?: string[]
} = {}) {
  return (
    <div>
      <InteractiveLine
        data={data}
        color="#22D3EE"
        gradientId="trendFill"
        className="h-24 w-full"
        format={(v) => `${v}`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Shared interactive line/area with hover tooltips                            */
/* -------------------------------------------------------------------------- */

function InteractiveLine({
  data,
  color,
  gradientId,
  className,
  format,
}: {
  data: number[]
  color: string
  gradientId: string
  className: string
  format: (v: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const w = 300
  const h = 120
  const pad = 8
  const max = Math.max(...data)
  const min = Math.min(...data)
  const stepX = (w - pad * 2) / (data.length - 1)

  const points = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const area = `${line} L${points[points.length - 1][0]},${h - pad} L${points[0][0]},${h - pad} Z`

  // percentage positions for the HTML overlay (matches the stretched svg box)
  const pct = points.map(([x, y]) => ({ left: (x / w) * 100, top: (y / h) * 100 }))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={pad}
            x2={w - pad}
            y1={pad + g * (h - pad * 2)}
            y2={pad + g * (h - pad * 2)}
            stroke="#ffffff"
            strokeOpacity="0.05"
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* hover dots + hit areas */}
      {pct.map((p, i) => (
        <div
          key={i}
          className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${p.left}%`, top: `${p.top}%` }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <span
            className={`rounded-full transition-all ${
              hover === i
                ? 'h-2.5 w-2.5 ring-4 ring-cyan-accent/20'
                : i === pct.length - 1
                  ? 'h-1.5 w-1.5'
                  : 'h-0 w-0'
            }`}
            style={{ backgroundColor: color }}
          />
        </div>
      ))}

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-navy-950 px-2 py-1 text-[11px] font-semibold text-white shadow"
          style={{ left: `${pct[hover].left}%`, top: `${pct[hover].top}%`, marginTop: '-8px' }}
        >
          {format(data[hover])}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Generic area chart (reused on the Dashboard for audience growth)            */
/* -------------------------------------------------------------------------- */

export function AreaChart({
  data,
  color = '#22D3EE',
  className = 'h-40 w-full',
  gradientId = 'areaFill',
  format = (v: number) => `${v}`,
}: {
  data: number[]
  color?: string
  className?: string
  gradientId?: string
  format?: (v: number) => string
}) {
  return (
    <InteractiveLine
      data={data}
      color={color}
      gradientId={gradientId}
      className={className}
      format={format}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Conversion by platform - bar chart                                          */
/* -------------------------------------------------------------------------- */

export function ConversionBars({
  bars = CONVERSION_BARS,
  format = (v: number) => `${v}%`,
}: {
  bars?: { label: string; value: number; color: string }[]
  format?: (v: number) => string
} = {}) {
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <div className="flex h-28 items-end justify-around gap-3 px-2">
      {bars.map((b) => (
        <div key={b.label} className="group flex flex-1 flex-col items-center gap-2">
          <div className="relative flex h-20 w-full items-end justify-center">
            {/* hover value label */}
            <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-navy-950 px-2 py-0.5 text-[11px] font-semibold text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
              {format(b.value)}
            </span>
            <div
              className="w-8 cursor-pointer rounded-t-md transition-all group-hover:brightness-125"
              style={{
                height: `${Math.max((b.value / max) * 100, 4)}%`,
                background: `linear-gradient(to top, ${b.color}, ${b.color}99)`,
              }}
              title={`${b.label}: ${format(b.value)}`}
            />
          </div>
          <span className="text-[11px] font-medium text-slate-400 transition-colors group-hover:text-white">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  )
}
