import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles, Clock, Plus as PlusIcon, Trash2 } from 'lucide-react'
import PostBlock from './PostBlock'
import { LinkEngagementTools } from './LinkTools'
import { useToast } from './Toast'
import { useSeededState } from '../lib/usePersisted'
import AddStoryModal, { type Story } from './AddStoryModal'
import AddReelModal, { type Reel, type ReelStatus } from './AddReelModal'
import { WEEKDAYS, TIME_SLOTS, PLATFORMS } from '../data'
import type { CalendarPost } from '../types'

/** Story/reel images may be an Unsplash photo id (samples) or empty (user-added). */
function mediaUrl(img: string, w: number) {
  if (!img) return ''
  if (/^(https?:|data:|blob:)/.test(img)) return img
  return `https://images.unsplash.com/${img}?auto=format&fit=crop&w=${w}&q=60`
}

interface CalendarViewProps {
  posts: CalendarPost[]
  setPosts: React.Dispatch<React.SetStateAction<CalendarPost[]>>
  onCreateNew: () => void
  onEditPost: (post: CalendarPost) => void
}

const TABS = ['Visual Grid', 'Stories', 'Reels Planner'] as const

// June 22 2026 is the Monday of the "current" week shown in the demo.
const BASE_MONDAY = new Date(2026, 5, 22)

/** Human label for the Mon–Fri range of a given week offset. */
function weekLabel(offset: number): string {
  const mon = new Date(BASE_MONDAY)
  mon.setDate(mon.getDate() + offset * 7)
  const fri = new Date(mon)
  fri.setDate(fri.getDate() + 4)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(mon)} – ${fmt(fri)}, ${fri.getFullYear()}`
}

export default function CalendarView({
  posts,
  setPosts,
  onCreateNew,
  onEditPost,
}: CalendarViewProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Visual Grid')
  const [weekOffset, setWeekOffset] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCell, setHoverCell] = useState<string | null>(null)

  /** Move the dragged post into the dropped cell (within the viewed week). */
  const handleDrop = (day: number, slot: number) => {
    if (!draggingId) return
    setPosts((prev) =>
      prev.map((p) => (p.id === draggingId ? { ...p, day, slot, week: weekOffset } : p)),
    )
    setDraggingId(null)
    setHoverCell(null)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Content Calendar</h1>

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

      {/* Visual Grid */}
      {tab === 'Visual Grid' && (
        <div className="card overflow-hidden">
          {/* toolbar with working week navigation */}
          <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-200">
              {weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `In ${weekOffset} week${weekOffset > 1 ? 's' : ''}` : `${-weekOffset} week${weekOffset < -1 ? 's' : ''} ago`}
            </span>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="rounded-md border border-cyan-accent/30 px-2 py-0.5 text-xs font-medium text-cyan-accent hover:bg-cyan-accent/10"
              >
                Today
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">{weekLabel(weekOffset)}</span>
          </div>

          {/* grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[64px_repeat(5,1fr)] border-b border-white/5">
                <div />
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-3 py-3 text-center text-sm font-semibold text-slate-300">
                    {d}
                  </div>
                ))}
              </div>

              {TIME_SLOTS.map((time, slot) => (
                <div
                  key={time}
                  className="grid grid-cols-[64px_repeat(5,1fr)] border-b border-white/5 last:border-b-0"
                >
                  <div className="relative px-2 py-1 text-right">
                    <span className="text-[11px] font-medium text-slate-500">{time}</span>
                  </div>

                  {WEEKDAYS.map((_, day) => {
                    const cellKey = `${day}-${slot}`
                    const cellPosts = posts.filter(
                      (p) => (p.week ?? 0) === weekOffset && p.day === day && p.slot === slot,
                    )
                    const isHover = hoverCell === cellKey
                    return (
                      <div
                        key={cellKey}
                        data-cell={cellKey}
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

          <div className="flex items-center gap-2 border-t border-white/5 px-5 py-3 text-xs text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-cyan-accent" />
            {weekOffset === 0
              ? 'Drag any post block to reschedule, or click it to edit.'
              : 'Use the arrows to browse weeks. Drag a post here to schedule it in this week.'}
          </div>
        </div>
      )}

      {/* Stories */}
      {tab === 'Stories' && <StoriesView />}

      {/* Reels Planner */}
      {tab === 'Reels Planner' && <ReelsPlanner />}

      <LinkEngagementTools />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Stories lane                                                                */
/* -------------------------------------------------------------------------- */

const SAMPLE_STORIES: Story[] = [
  { id: 's1', day: 0, platform: 'instagram', time: '9:00 AM', img: 'photo-1483985988355-763728e1935b' },
  { id: 's2', day: 1, platform: 'instagram', time: '11:00 AM', img: 'photo-1469334031218-e382a71b716b' },
  { id: 's3', day: 1, platform: 'facebook', time: '4:00 PM', img: 'photo-1441986300917-64674bd600d8' },
  { id: 's4', day: 3, platform: 'instagram', time: '10:30 AM', img: 'photo-1487412720507-e7ab37603c6f' },
  { id: 's5', day: 4, platform: 'facebook', time: '2:00 PM', img: 'photo-1445205170230-053b83016050' },
]

function StoriesView() {
  const { addToast } = useToast()
  const [stories, setStories] = useSeededState<Story[]>('sl_stories', SAMPLE_STORIES, [])
  const [addingDay, setAddingDay] = useState<number | null>(null)

  const add = (story: Story) => {
    setStories((prev) => [...prev, story])
    setAddingDay(null)
    addToast('Story added 📸')
  }
  const remove = (id: string) => {
    setStories((prev) => prev.filter((s) => s.id !== id))
    addToast('Story removed', 'info')
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-lg font-bold text-white">Stories</h2>
      <p className="mb-4 text-xs text-slate-500">Plan vertical stories for each day of the week.</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {WEEKDAYS.map((day, i) => (
          <div key={day} className="space-y-3">
            <div className="text-center text-sm font-semibold text-slate-300">{day}</div>
            {stories
              .filter((s) => s.day === i)
              .map((s) => {
                const plat = PLATFORMS[s.platform]
                const { Icon } = plat
                const src = mediaUrl(s.img, 240)
                return (
                  <div
                    key={s.id}
                    className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10"
                  >
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br ${plat.gradient} opacity-80`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 to-transparent" />
                    <span
                      className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br ${plat.gradient} text-white`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <button
                      onClick={() => remove(s.id)}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-navy-950/70 text-slate-300 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                      title="Remove story"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-medium text-white">
                      <Clock className="h-3 w-3" /> {s.time}
                    </span>
                  </div>
                )
              })}
            {/* add slot */}
            <button
              onClick={() => setAddingDay(i)}
              className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-slate-500 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
            >
              <PlusIcon className="h-5 w-5" />
              <span className="text-[11px] font-medium">Add story</span>
            </button>
          </div>
        ))}
      </div>

      {addingDay !== null && (
        <AddStoryModal day={addingDay} onClose={() => setAddingDay(null)} onAdd={add} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Reels planner                                                               */
/* -------------------------------------------------------------------------- */

const SAMPLE_REELS: Reel[] = [
  { id: 'r1', title: 'Summer styling in 30s', platform: 'reels', when: 'Mon, 9:00 AM', status: 'Scheduled', img: 'photo-1490481651871-ab68de25d43d' },
  { id: 'r2', title: 'Trending audio remix', platform: 'tiktok', when: 'Tue, 12:00 PM', status: 'Draft', img: 'photo-1516280440614-37939bbacd81' },
  { id: 'r3', title: 'Behind the shoot', platform: 'reels', when: 'Thu, 5:00 PM', status: 'In review', img: 'photo-1469334031218-e382a71b716b' },
  { id: 'r4', title: 'Product unboxing', platform: 'youtube', when: 'Fri, 10:00 AM', status: 'Scheduled', img: 'photo-1441984904996-e0b6ba687e04' },
]

const STATUS_STYLE: Record<ReelStatus, string> = {
  Scheduled: 'bg-cyan-accent/15 text-cyan-accent',
  Draft: 'bg-slate-500/20 text-slate-300',
  'In review': 'bg-amber-500/15 text-amber-300',
}

function ReelsPlanner() {
  const { addToast } = useToast()
  const [reels, setReels] = useSeededState<Reel[]>('sl_reels', SAMPLE_REELS, [])
  const [adding, setAdding] = useState(false)

  const add = (reel: Reel) => {
    setReels((prev) => [...prev, reel])
    setAdding(false)
    addToast('Reel planned 🎬')
  }
  const remove = (id: string) => {
    setReels((prev) => prev.filter((r) => r.id !== id))
    addToast('Reel removed', 'info')
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-lg font-bold text-white">Reels Planner</h2>
      <p className="mb-4 text-xs text-slate-500">Storyboard and schedule your short-form video.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reels.map((r) => {
          const plat = PLATFORMS[r.platform]
          const { Icon } = plat
          const src = mediaUrl(r.img, 320)
          return (
            <div key={r.id} className="group overflow-hidden rounded-xl border border-white/5 bg-navy-900/50">
              <div className="relative aspect-video">
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className={`h-full w-full bg-gradient-to-br ${plat.gradient} opacity-80`} />
                )}
                <span className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br ${plat.gradient} text-white`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <button
                  onClick={() => remove(r.id)}
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-navy-950/70 text-slate-300 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                  title="Remove reel"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-semibold text-white">{r.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{r.when}</div>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              </div>
            </div>
          )
        })}

        {/* plan new */}
        <button
          onClick={() => setAdding(true)}
          className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-slate-500 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
        >
          <PlusIcon className="h-6 w-6" />
          <span className="text-sm font-medium">Plan a Reel</span>
        </button>
      </div>

      {adding && <AddReelModal onClose={() => setAdding(false)} onAdd={add} />}
    </div>
  )
}
