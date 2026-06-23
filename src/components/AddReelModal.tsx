import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'
import { PLATFORM_LIST } from '../data'
import type { PlatformId } from '../types'

export type ReelStatus = 'Scheduled' | 'Draft' | 'In review'

export interface Reel {
  id: string
  title: string
  platform: PlatformId
  when: string
  status: ReelStatus
  img: string
}

const STATUSES: ReelStatus[] = ['Scheduled', 'Draft', 'In review']

interface AddReelModalProps {
  onClose: () => void
  onAdd: (reel: Reel) => void
}

let rid = Date.now()

/** Captures a planned reel: title, platform, when, and status. */
export default function AddReelModal({ onClose, onAdd }: AddReelModalProps) {
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState<PlatformId>('reels')
  const [when, setWhen] = useState('')
  const [status, setStatus] = useState<ReelStatus>('Draft')

  const save = () => {
    onAdd({
      id: `reel_${++rid}`,
      title: title.trim() || 'Untitled reel',
      platform,
      when: when.trim() || 'Unscheduled',
      status,
      img: '',
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-bold text-white">Plan a Reel</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer styling in 30s"
              className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">When</span>
              <input
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                placeholder="Mon, 9:00 AM"
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              />
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReelStatus)}
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-white/5 px-5 py-4">
          <button
            onClick={save}
            className="flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Check className="h-4 w-4" strokeWidth={2.6} />
            Add reel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
