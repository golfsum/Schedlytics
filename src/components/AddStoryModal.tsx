import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'
import { PLATFORM_LIST, WEEKDAYS } from '../data'
import type { PlatformId } from '../types'

export interface Story {
  id: string
  day: number
  platform: PlatformId
  time: string
  img: string
}

interface AddStoryModalProps {
  /** Day index (0-4) the story is being added to. */
  day: number
  onClose: () => void
  onAdd: (story: Story) => void
}

let sid = Date.now()

/** Captures the essentials for a planned story: platform + time (image optional later). */
export default function AddStoryModal({ day, onClose, onAdd }: AddStoryModalProps) {
  const [platform, setPlatform] = useState<PlatformId>('instagram')
  const [time, setTime] = useState('09:00')

  const save = () => {
    const label = formatTime(time)
    onAdd({ id: `story_${++sid}`, day, platform, time: label, img: '' })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-bold text-white">Add story · {WEEKDAYS[day]}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Platform</span>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_LIST.map((p) => {
                const { Icon } = p
                const on = platform === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      on
                        ? `border-transparent bg-gradient-to-r ${p.gradient} text-white shadow-md`
                        : 'border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark] focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-white/5 px-5 py-4">
          <button
            onClick={save}
            className="flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Check className="h-4 w-4" strokeWidth={2.6} />
            Add story
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** "09:00" -> "9:00 AM" */
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}
