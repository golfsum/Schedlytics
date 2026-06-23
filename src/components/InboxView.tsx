import { useState, useEffect } from 'react'
import { Send, CheckCheck, Circle, RefreshCw, Loader2 } from 'lucide-react'
import { PLATFORMS } from '../data'
import type { PlatformId } from '../types'
import { useToast } from './Toast'
import { useNotifications } from './Notifications'
import { useConnections } from './Connections'
import { backendEnabled, fetchYouTubeComments } from '../lib/socialApi'

/** YouTube comment text can contain HTML + entities; clean it for display. */
function stripHtml(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()
}

function timeAgo(iso: string) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface Message {
  id: number
  platform: PlatformId
  name: string
  avatar: string
  text: string
  time: string
  unread: boolean
}

const SEED: Message[] = [
  { id: 1, platform: 'instagram', name: 'mia.styles', avatar: 'https://i.pravatar.cc/80?img=5', text: 'Loved the summer drop! When does it restock? 😍', time: '2m', unread: true },
  { id: 2, platform: 'tiktok', name: '@dancewithjay', avatar: 'https://i.pravatar.cc/80?img=8', text: 'Can we collab on the next reel?', time: '18m', unread: true },
  { id: 3, platform: 'facebook', name: 'Carlos M.', avatar: 'https://i.pravatar.cc/80?img=14', text: 'Is the discount code still valid?', time: '1h', unread: true },
  { id: 4, platform: 'instagram', name: 'theglowco', avatar: 'https://i.pravatar.cc/80?img=20', text: 'Shipping to Canada yet?', time: '3h', unread: false },
  { id: 5, platform: 'pinterest', name: 'home.edit', avatar: 'https://i.pravatar.cc/80?img=25', text: 'Pinned your fall lookbook — gorgeous!', time: '1d', unread: false },
]

export default function InboxView() {
  const { addToast } = useToast()
  const { push } = useNotifications()
  const { accounts } = useConnections()
  const [messages, setMessages] = useState<Message[]>(SEED)
  const [selectedId, setSelectedId] = useState<number | null>(SEED[0].id)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'demo' | 'youtube'>('demo')

  const ytConnected = Boolean(accounts.youtube?.connected)

  const loadYouTube = async () => {
    setLoading(true)
    try {
      const comments = await fetchYouTubeComments(25)
      if (comments.length) {
        const msgs: Message[] = comments.map((c, i) => ({
          id: i + 1,
          platform: 'youtube',
          name: c.author || 'YouTube viewer',
          avatar: c.avatar || 'https://i.pravatar.cc/80?img=15',
          text: stripHtml(c.text || ''),
          time: timeAgo(c.time),
          unread: true,
        }))
        setMessages(msgs)
        setSelectedId(msgs[0].id)
        setSource('youtube')
      } else {
        addToast('No YouTube comments found yet', 'info')
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      addToast('Could not load YouTube comments. See the bell for details.', 'info', 6000)
      push({ type: 'error', title: 'Could not load YouTube comments', message: 'Tap to see the full reason', detail })
    } finally {
      setLoading(false)
    }
  }

  // Auto-load live YouTube comments when connected (backend mode only).
  useEffect(() => {
    if (backendEnabled && ytConnected) loadYouTube()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytConnected])

  const selected = messages.find((m) => m.id === selectedId) ?? null
  const unreadCount = messages.filter((m) => m.unread).length

  const select = (id: number) => {
    setSelectedId(id)
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, unread: false } : x)))
  }

  const markAllRead = () => {
    setMessages((m) => m.map((x) => ({ ...x, unread: false })))
    addToast('All messages marked as read')
  }

  const send = () => {
    if (!reply.trim() || !selected) return
    addToast(`Reply sent to ${selected.name} 📨`)
    setReply('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
        {source === 'youtube' && (
          <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
            Live YouTube comments
          </span>
        )}
        {unreadCount > 0 && (
          <span className="rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
            {unreadCount} unread
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {backendEnabled && ytConnected && (
            <button
              onClick={loadYouTube}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-navy-800/70 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Loading…' : 'Refresh comments'}
            </button>
          )}
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-navy-800/70 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* conversation list */}
        <div className="card overflow-hidden">
          <div className="divide-y divide-white/5">
            {messages.map((m) => {
              const p = PLATFORMS[m.platform]
              const { Icon } = p
              const active = m.id === selectedId
              return (
                <button
                  key={m.id}
                  onClick={() => select(m.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    active ? 'bg-cyan-accent/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={m.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br ${p.gradient} ring-2 ring-navy-800`}
                    >
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{m.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-500">{m.time}</span>
                    </div>
                    <p className={`truncate text-xs ${m.unread ? 'text-slate-200' : 'text-slate-500'}`}>
                      {m.text}
                    </p>
                  </div>
                  {m.unread && <Circle className="h-2 w-2 shrink-0 fill-cyan-accent text-cyan-accent" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* conversation detail */}
        <div className="card flex min-h-[420px] flex-col">
          {selected ? (
            <>
              {/* header */}
              <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
                <img src={selected.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-white">{selected.name}</div>
                  <div className="text-xs text-slate-500">
                    via {PLATFORMS[selected.platform].name}
                  </div>
                </div>
              </div>

              {/* thread */}
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-navy-900/70 px-4 py-2.5 text-sm text-slate-200">
                    {selected.text}
                    <div className="mt-1 text-[10px] text-slate-500">{selected.time} ago</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm gradient-cyan px-4 py-2.5 text-sm font-medium text-navy-900">
                    Thanks for reaching out! 💛
                    <div className="mt-1 text-[10px] text-navy-900/60">just now</div>
                  </div>
                </div>
              </div>

              {/* reply */}
              <div className="flex items-center gap-2 border-t border-white/5 p-4">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={`Reply to ${selected.name}…`}
                  className="flex-1 rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                />
                <button
                  onClick={send}
                  className="flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-slate-500">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
