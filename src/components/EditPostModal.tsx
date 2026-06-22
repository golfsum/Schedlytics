import { useState } from 'react'
import { X, Trash2, Check } from 'lucide-react'
import { PLATFORM_LIST, WEEKDAYS, TIME_SLOTS } from '../data'
import type { CalendarPost, PlatformId } from '../types'

interface EditPostModalProps {
  post: CalendarPost
  onClose: () => void
  onSave: (post: CalendarPost) => void
  onDelete: (id: string) => void
}

/** Centered modal for editing or deleting a scheduled calendar post. */
export default function EditPostModal({
  post,
  onClose,
  onSave,
  onDelete,
}: EditPostModalProps) {
  const [platform, setPlatform] = useState<PlatformId>(post.platform)
  const [label, setLabel] = useState(post.label)
  const [day, setDay] = useState(post.day)
  const [slot, setSlot] = useState(post.slot)

  const handleSave = () => onSave({ ...post, platform, label, day, slot })

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-bold text-white">Edit Post</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* platform */}
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

          {/* label */}
          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Caption / Title</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
          </div>

          {/* day + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">Day</span>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">Time</span>
              <select
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              >
                {TIME_SLOTS.map((t, i) => (
                  <option key={t} value={i}>
                    {t} AM
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center gap-3 border-t border-white/5 px-5 py-4">
          <button
            onClick={() => onDelete(post.id)}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={handleSave}
            className="ml-auto flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Check className="h-4 w-4" strokeWidth={2.6} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
