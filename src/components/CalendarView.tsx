import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import PostBlock from './PostBlock'
import { LinkEngagementTools } from './LinkTools'
import { WEEKDAYS, TIME_SLOTS } from '../data'
import type { CalendarPost } from '../types'

interface CalendarViewProps {
  posts: CalendarPost[]
  setPosts: React.Dispatch<React.SetStateAction<CalendarPost[]>>
  onCreateNew: () => void
  onEditPost: (post: CalendarPost) => void
}

const TABS = ['Visual Grid', 'Stories', 'Reels Planner'] as const

export default function CalendarView({
  posts,
  setPosts,
  onCreateNew,
  onEditPost,
}: CalendarViewProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Visual Grid')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCell, setHoverCell] = useState<string | null>(null)

  /** Move the dragged post into the dropped cell. */
  const handleDrop = (day: number, slot: number) => {
    if (!draggingId) return
    setPosts((prev) =>
      prev.map((p) => (p.id === draggingId ? { ...p, day, slot } : p)),
    )
    setDraggingId(null)
    setHoverCell(null)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Content Calendar</h1>

        {/* tabs */}
        <div className="flex items-center rounded-xl border border-white/5 bg-navy-800/70 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                tab === t
                  ? 'gradient-cyan text-navy-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={onCreateNew}
          className="ml-auto flex items-center gap-2 rounded-xl gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          Create New Post
        </button>
      </div>

      {/* Calendar card */}
      <div className="card overflow-hidden">
        {/* calendar toolbar */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <button className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-200">Weekly View</span>
          <span className="ml-auto text-xs text-slate-500">Jun 22 – Jun 26, 2026</span>
        </div>

        {/* grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* day header row */}
            <div className="grid grid-cols-[64px_repeat(5,1fr)] border-b border-white/5">
              <div />
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-3 py-3 text-center text-sm font-semibold text-slate-300"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* time-slot rows */}
            {TIME_SLOTS.map((time, slot) => (
              <div
                key={time}
                className="grid grid-cols-[64px_repeat(5,1fr)] border-b border-white/5 last:border-b-0"
              >
                {/* time label */}
                <div className="relative px-2 py-1 text-right">
                  <span className="text-[11px] font-medium text-slate-500">{time}</span>
                </div>

                {/* day cells */}
                {WEEKDAYS.map((_, day) => {
                  const cellKey = `${day}-${slot}`
                  const cellPosts = posts.filter((p) => p.day === day && p.slot === slot)
                  const isHover = hoverCell === cellKey
                  return (
                    <div
                      key={cellKey}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setHoverCell(cellKey)
                      }}
                      onDragLeave={() => setHoverCell((c) => (c === cellKey ? null : c))}
                      onDrop={() => handleDrop(day, slot)}
                      className={`min-h-[58px] space-y-1 border-l border-white/5 p-1.5 transition-colors ${
                        isHover ? 'bg-cyan-accent/10 ring-1 ring-inset ring-cyan-accent/40' : ''
                      }`}
                    >
                      {cellPosts.map((p) => (
                        <PostBlock
                          key={p.id}
                          post={p}
                          dragging={draggingId === p.id}
                          onDragStart={setDraggingId}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setHoverCell(null)
                          }}
                          onClick={onEditPost}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* hint */}
        <div className="flex items-center gap-2 border-t border-white/5 px-5 py-3 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-cyan-accent" />
          Drag any post block to reschedule, or click it to edit.
        </div>
      </div>

      {/* Link & Engagement Tools */}
      <LinkEngagementTools />
    </div>
  )
}
