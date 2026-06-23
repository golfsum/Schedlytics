import { useEffect, useRef, useState } from 'react'
import { Clock, ChevronDown, ChevronLeft, ChevronRight, Zap } from 'lucide-react'

interface DateTimePickerProps {
  /** Selected moment, or null = "Publish now". */
  value: Date | null
  onChange: (value: Date | null) => void
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmt(value: Date | null) {
  if (!value) return 'Publish now'
  const date = value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

/** Themed date + time picker that opens in a popover. value=null means publish now. */
export default function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const base = value ?? new Date()
  const [viewMonth, setViewMonth] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const today = new Date()
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Current time-of-day for the <input type="time">; default 10:00.
  const timeStr = value
    ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    : '10:00'

  const pickDay = (day: number) => {
    const [h, m] = timeStr.split(':').map(Number)
    onChange(new Date(year, month, day, h, m))
  }

  const pickTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const d = value ? new Date(value) : new Date()
    d.setHours(h, m, 0, 0)
    onChange(d)
  }

  const quick = (kind: 'now' | '1h' | 'tomorrow') => {
    if (kind === 'now') {
      onChange(null)
    } else if (kind === '1h') {
      onChange(new Date(Date.now() + 60 * 60 * 1000))
    } else {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(10, 0, 0, 0)
      onChange(d)
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-8 text-left text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
      >
        <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {fmt(value)}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-[300px] rounded-2xl border border-white/10 bg-navy-800 p-4 shadow-panel animate-fade-in">
          {/* quick actions */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Quick label="Publish now" icon onClick={() => quick('now')} active={value === null} />
            <Quick label="In 1 hour" onClick={() => quick('1h')} />
            <Quick label="Tomorrow 10 AM" onClick={() => quick('tomorrow')} />
          </div>

          {/* month header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-white">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* day-of-week labels */}
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-500">
            {DOW.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          {/* day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={i} />
              const cellDate = new Date(year, month, day)
              const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isToday = sameDay(cellDate, today)
              const isSelected = value ? sameDay(cellDate, value) : false
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDay(day)}
                  className={`grid h-8 place-items-center rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? 'gradient-cyan font-bold text-navy-900'
                      : isPast
                        ? 'cursor-not-allowed text-slate-600'
                        : isToday
                          ? 'text-cyan-accent ring-1 ring-cyan-accent/40 hover:bg-white/5'
                          : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* time */}
          <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
            <Clock className="h-4 w-4 text-cyan-accent" />
            <span className="text-sm text-slate-300">Time</span>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => pickTime(e.target.value)}
              className="ml-auto rounded-lg border border-white/5 bg-navy-900/60 px-2.5 py-1.5 text-sm text-slate-200 [color-scheme:dark] focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg gradient-cyan py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.01]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

function Quick({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'gradient-cyan text-navy-900'
          : 'border border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
      }`}
    >
      {icon && <Zap className="h-3 w-3" />}
      {label}
    </button>
  )
}
