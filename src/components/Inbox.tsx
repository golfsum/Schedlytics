import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { PlatformId } from '../types'
import { useToast } from './Toast'
import { useNotifications } from './Notifications'
import { useConnections } from './Connections'
import { backendEnabled, sampleData, fetchYouTubeComments } from '../lib/socialApi'
import { usePersistedState } from '../lib/usePersisted'

export interface Message {
  id: number
  platform: PlatformId
  name: string
  avatar: string
  text: string
  time: string
  unread: boolean
  /** Real YouTube comment id, set for live comments so we can reply to it. */
  commentId?: string
  /** Likes on the comment (read-only; YouTube has no like-a-comment API). */
  likeCount?: number
  /** The video the comment is on, for a deep link. */
  videoId?: string
  videoTitle?: string
}

/** YouTube comment text can contain HTML + entities; clean it for display. */
export function stripHtml(s: string) {
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

const SEED: Message[] = [
  { id: 1, platform: 'instagram', name: 'mia.styles', avatar: 'https://i.pravatar.cc/80?img=5', text: 'Loved the summer drop! When does it restock? 😍', time: '2m', unread: true },
  { id: 2, platform: 'tiktok', name: '@dancewithjay', avatar: 'https://i.pravatar.cc/80?img=8', text: 'Can we collab on the next reel?', time: '18m', unread: true },
  { id: 3, platform: 'facebook', name: 'Carlos M.', avatar: 'https://i.pravatar.cc/80?img=14', text: 'Is the discount code still valid?', time: '1h', unread: true },
  { id: 4, platform: 'instagram', name: 'theglowco', avatar: 'https://i.pravatar.cc/80?img=20', text: 'Shipping to Canada yet?', time: '3h', unread: false },
  { id: 5, platform: 'pinterest', name: 'home.edit', avatar: 'https://i.pravatar.cc/80?img=25', text: 'Pinned your fall lookbook, gorgeous!', time: '1d', unread: false },
]

interface InboxContextValue {
  messages: Message[]
  selectedId: number | null
  unreadCount: number
  loading: boolean
  source: 'demo' | 'youtube'
  ytConnected: boolean
  select: (id: number) => void
  markAllRead: () => void
  loadYouTube: () => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast()
  const { push } = useNotifications()
  const { accounts } = useConnections()
  const [messages, setMessages] = useState<Message[]>(sampleData ? SEED : [])
  const [selectedId, setSelectedId] = useState<number | null>(sampleData ? SEED[0].id : null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'demo' | 'youtube'>(sampleData ? 'demo' : 'youtube')
  // Persisted set of comment ids already read, so a refetch keeps them read.
  const [readIds, setReadIds] = usePersistedState<string[]>('sl_read_comments', [])

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
          avatar: c.avatar || '',
          text: stripHtml(c.text || ''),
          time: timeAgo(c.time),
          unread: c.id ? !readIds.includes(c.id) : true,
          commentId: c.id,
          likeCount: c.likeCount,
          videoId: c.videoId,
          videoTitle: c.videoTitle,
        }))
        setMessages(msgs)
        setSelectedId(msgs[0].id)
        setSource('youtube')
      } else {
        // No comments - show an inline empty state, not a popup.
        setMessages([])
        setSelectedId(null)
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      // A scope 403 means the connection predates the comment permission.
      const isScope = /scope|403/i.test(detail)
      if (isScope) {
        addToast('Reconnect YouTube in Settings to grant comment access.', 'info', 7000)
        push({
          type: 'error',
          title: 'Reconnect YouTube for comments',
          message: 'Your connection is missing the comments permission. Disconnect and reconnect YouTube in Settings.',
          detail,
        })
      } else {
        addToast('Could not load YouTube comments. See the bell for details.', 'info', 6000)
        push({ type: 'error', title: 'Could not load YouTube comments', message: 'Tap to see the full reason', detail })
      }
    } finally {
      setLoading(false)
    }
  }

  // Auto-load live YouTube comments when connected (backend mode only). When a
  // channel is disconnected, remove ONLY that channel's messages from the inbox
  // (others stay) instead of leaving its stale comments showing.
  useEffect(() => {
    if (!backendEnabled) return
    if (ytConnected) {
      loadYouTube()
      return
    }
    setMessages((prev) => {
      const next = prev.filter((m) => m.platform !== 'youtube')
      return next.length === prev.length ? prev : next
    })
    setSelectedId((cur) => (cur && messages.some((m) => m.id === cur && m.platform !== 'youtube') ? cur : null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytConnected])

  const unreadCount = messages.filter((m) => m.unread).length

  const rememberRead = (ids: (string | undefined)[]) => {
    const cids = ids.filter((c): c is string => Boolean(c))
    if (cids.length) setReadIds((r) => Array.from(new Set([...r, ...cids])).slice(-1000))
  }

  const select = (id: number) => {
    setSelectedId(id)
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, unread: false } : x)))
    rememberRead([messages.find((x) => x.id === id)?.commentId])
  }

  const markAllRead = () => {
    setMessages((m) => m.map((x) => ({ ...x, unread: false })))
    rememberRead(messages.map((x) => x.commentId))
    addToast('All messages marked as read')
  }

  return (
    <InboxContext.Provider
      value={{ messages, selectedId, unreadCount, loading, source, ytConnected, select, markAllRead, loadYouTube }}
    >
      {children}
    </InboxContext.Provider>
  )
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used within InboxProvider')
  return ctx
}
