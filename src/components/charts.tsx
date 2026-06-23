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

/** Map a 0–1 value to an orange→amber heat color. */
function heat(v: number): string {
  // low = pale teal, high = saturated orange
  if (v >= 0.7) return '#F97316'
  if (v >= 0.55) return '#FB923C'
  if (v >= 0.4) return '#FDBA74'
  if (v >= 0.25) return '#FED7AA'
  return '#FEF3E2'
}

export function CorrelationMatrix() {
  return (
    <div className="flex gap-3">
      {/* y-axis label */}
      <div className="flex flex-col items-center justify-center">
        <span className="rotate-180 text-[10px] font-medium tracking-wide text-slate-500 [writing-mode:vertical-rl]">
          Post Frequency
        </span>
      </div>

      {/* row labels */}
      <div className="grid grid-rows-5 gap-1 py-0.5">
        {CORRELATION_ROWS.map((r) => (
          <span key={r} className="flex items-center text-[10px] text-slate-500">
            {r}
          </span>
        ))}
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-5 gap-1">
          {CORRELATION_MATRIX.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                title={`${val.toFixed(2)}`}
                className="grid aspect-[1.7/1] place-items-center rounded-md text-[11px] font-bold text-navy-900 transition-transform hover:scale-105"
                style={{ backgroundColor: heat(val) }}
              >
                {val.toFixed(2)}
              </div>
            )),
          )}
        </div>
        {/* x-axis ticks */}
        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {CORRELATION_COLS.map((c) => (
            <span key={c} className="text-center text-[10px] text-slate-500">
              {c}
            </span>
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] font-medium tracking-wide text-slate-500">
          Post Frequency
        </p>
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

export function EngagementTrend() {
  return (
    <div>
      <InteractiveLine
        data={ENGAGEMENT_TREND}
        color="#22D3EE"
        gradientId="trendFill"
        className="h-24 w-full"
        format={(v) => `${v}`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {ENGAGEMENT_LABELS.map((l, i) => (
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

export function ConversionBars() {
  const max = Math.max(...CONVERSION_BARS.map((b) => b.value))
  return (
    <div className="flex h-28 items-end justify-around gap-3 px-2">
      {CONVERSION_BARS.map((b) => (
        <div key={b.label} className="group flex flex-1 flex-col items-center gap-2">
          <div className="relative flex h-20 w-full items-end justify-center">
            {/* hover value label */}
            <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-navy-950 px-2 py-0.5 text-[11px] font-semibold text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
              {b.value}%
            </span>
            <div
              className="w-8 cursor-pointer rounded-t-md transition-all group-hover:brightness-125"
              style={{
                height: `${(b.value / max) * 100}%`,
                background: `linear-gradient(to top, ${b.color}, ${b.color}99)`,
              }}
              title={`${b.label}: ${b.value}%`}
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
