import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { sampleData } from '../lib/socialApi'

export type NotificationType = 'success' | 'info' | 'error'

export interface AppNotification {
  id: number
  type: NotificationType
  title: string
  message: string
  /** Optional long text (e.g. a raw error) shown under "Show details". */
  detail?: string
  time: string
  unread: boolean
}

interface NotificationsValue {
  notifications: AppNotification[]
  unreadCount: number
  push: (n: { type?: NotificationType; title: string; message?: string; detail?: string }) => void
  markRead: (id: number) => void
  markAllRead: () => void
  remove: (id: number) => void
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider')
  return ctx
}

let nid = 100

// Sample notifications — only seeded in demo mode / when auth is off.
const SEED: AppNotification[] = [
  { id: 1, type: 'success', title: 'Reel performing well', message: '“Styling reel” hit 12.4K views', time: '2m ago', unread: true },
  { id: 2, type: 'info', title: 'New comment', message: 'From @mia.styles on your latest post', time: '18m ago', unread: true },
  { id: 3, type: 'success', title: 'Post published', message: 'Published to Instagram', time: '1h ago', unread: true },
  { id: 4, type: 'info', title: 'Weekly report ready', message: 'Your performance report is ready to view', time: '1d ago', unread: false },
]

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(sampleData ? SEED : [])

  const push = useCallback(
    ({ type = 'info', title, message = '', detail }: { type?: NotificationType; title: string; message?: string; detail?: string }) => {
      setNotifications((list) => [
        { id: ++nid, type, title, message, detail, time: 'just now', unread: true },
        ...list,
      ])
    },
    [],
  )

  const markRead = useCallback(
    (id: number) => setNotifications((l) => l.map((n) => (n.id === id ? { ...n, unread: false } : n))),
    [],
  )
  const markAllRead = useCallback(
    () => setNotifications((l) => l.map((n) => ({ ...n, unread: false }))),
    [],
  )
  const remove = useCallback((id: number) => setNotifications((l) => l.filter((n) => n.id !== id)), [])

  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, push, markRead, markAllRead, remove }}>
      {children}
    </NotificationsContext.Provider>
  )
}
