import { useState, useRef, useEffect } from 'react'
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  Check,
  TrendingUp,
  MessageSquare,
  BarChart3,
  User,
  Settings as SettingsIcon,
  Sparkles,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useToast } from './Toast'
import type { NavId } from '../types'

interface TopbarProps {
  onNavigate: (id: NavId) => void
  onUpgrade: () => void
}

interface Notification {
  id: number
  Icon: LucideIcon
  title: string
  time: string
  unread: boolean
}

const SEED_NOTIFS: Notification[] = [
  { id: 1, Icon: TrendingUp, title: 'Your Reel "Styling reel" hit 12.4K views', time: '2m ago', unread: true },
  { id: 2, Icon: MessageSquare, title: 'New comment from @mia.styles', time: '18m ago', unread: true },
  { id: 3, Icon: Check, title: 'Post published to Instagram', time: '1h ago', unread: true },
  { id: 4, Icon: BarChart3, title: 'Your weekly performance report is ready', time: '1d ago', unread: false },
]

/** Global top bar with working search, notifications, and account menu. */
export default function Topbar({ onNavigate, onUpgrade }: TopbarProps) {
  const { addToast } = useToast()
  const [notifs, setNotifs] = useState<Notification[]>(SEED_NOTIFS)
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => n.unread).length

  // Close either dropdown when clicking outside it.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const openNotifs = () => {
    setMenuOpen(false)
    setNotifOpen((o) => !o)
  }
  const openMenu = () => {
    setNotifOpen(false)
    setMenuOpen((o) => !o)
  }

  const markAllRead = () => {
    setNotifs((n) => n.map((x) => ({ ...x, unread: false })))
    addToast('All notifications marked as read')
  }

  const goto = (id: NavId) => {
    setMenuOpen(false)
    onNavigate(id)
  }

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-navy-900/60 px-4 backdrop-blur-sm sm:px-6">
      {/* mobile menu */}
      <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* search */}
      <form
        className="relative flex-1 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get('q')?.toString().trim()
          if (q) addToast(`Searching for "${q}"…`, 'info')
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          name="q"
          type="text"
          placeholder="Search posts, channels, analytics…"
          className="w-full rounded-xl border border-white/5 bg-navy-800/70 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
        />
      </form>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifs}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/5 bg-navy-800/70 text-slate-300 transition-colors hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-navy-900" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 animate-fade-in overflow-hidden rounded-2xl border border-white/10 bg-navy-800 shadow-panel">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <span className="text-sm font-bold text-white">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium text-cyan-accent hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() =>
                      setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))
                    }
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                      n.unread ? 'bg-cyan-accent/5' : ''
                    }`}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-cyan-soft text-cyan-accent">
                      <n.Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-100">{n.title}</span>
                      <span className="block text-xs text-slate-500">{n.time}</span>
                    </span>
                    {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-accent" />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setNotifOpen(false)
                  addToast('Opened notification center', 'info')
                }}
                className="block w-full border-t border-white/5 px-4 py-2.5 text-center text-xs font-medium text-cyan-accent hover:bg-white/5"
              >
                View all
              </button>
            </div>
          )}
        </div>

        {/* account menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={openMenu}
            className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-navy-800/70 py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-white/10"
          >
            <img
              src="https://i.pravatar.cc/80?img=12"
              alt="Alex R."
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="hidden text-sm font-semibold text-slate-100 sm:block">Alex R.</span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-white/10 bg-navy-800 shadow-panel">
              <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                <img
                  src="https://i.pravatar.cc/80?img=12"
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">Alex Rivera</div>
                  <div className="truncate text-xs text-slate-500">alex@schedlytics.io</div>
                </div>
              </div>
              <div className="py-1.5">
                <MenuItem Icon={User} label="View profile" onClick={() => goto('settings')} />
                <MenuItem Icon={SettingsIcon} label="Settings" onClick={() => goto('settings')} />
                <MenuItem
                  Icon={Sparkles}
                  label="Upgrade to Pro"
                  accent
                  onClick={() => {
                    setMenuOpen(false)
                    onUpgrade()
                  }}
                />
              </div>
              <div className="border-t border-white/5 py-1.5">
                <MenuItem
                  Icon={LogOut}
                  label="Sign out"
                  onClick={() => {
                    setMenuOpen(false)
                    addToast('You have been signed out', 'info')
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({
  Icon,
  label,
  onClick,
  accent,
}: {
  Icon: LucideIcon
  label: string
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 ${
        accent ? 'text-cyan-accent' : 'text-slate-200'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </button>
  )
}
