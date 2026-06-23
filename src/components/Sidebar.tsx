import { Sparkles } from 'lucide-react'
import Logo from './Logo'
import { NAV_ITEMS } from '../data'
import { useInbox } from './Inbox'
import type { NavId } from '../types'

interface SidebarProps {
  active: NavId
  onNavigate: (id: NavId) => void
  onUpgrade: () => void
}

/** Left-hand primary navigation rail. */
export default function Sidebar({ active, onNavigate, onUpgrade }: SidebarProps) {
  const { unreadCount } = useInbox()
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-white/5 bg-navy-950/80 px-4 py-6 md:flex">
      {/* Brand */}
      <div className="px-2">
        <Logo />
      </div>

      {/* Nav */}
      <nav className="mt-9 flex flex-1 flex-col gap-1.5">
        {NAV_ITEMS.map(({ id, label, Icon, badge }) => {
          const isActive = id === active
          // Inbox badge reflects the live unread count, not a static number.
          const count = id === 'inbox' ? unreadCount : badge
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-accent/10 text-white ring-1 ring-cyan-accent/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              {/* active indicator bar */}
              <span
                className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full transition-all ${
                  isActive ? 'w-1 gradient-cyan' : 'w-0'
                }`}
              />
              <Icon
                className={`h-[18px] w-[18px] ${isActive ? 'text-cyan-accent' : ''}`}
                strokeWidth={2}
              />
              <span>{label}</span>
              {count ? (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-cyan-accent px-1.5 text-[11px] font-bold text-navy-900">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* Upgrade card */}
      <div className="mt-4 rounded-2xl border border-white/5 gradient-cyan-soft p-4">
        <div className="flex items-center gap-2 text-cyan-accent">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Pro plan</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">
          Unlock unlimited channels, AI captions &amp; deep analytics.
        </p>
        <button
          onClick={onUpgrade}
          className="mt-3 w-full rounded-lg gradient-cyan py-2 text-xs font-bold text-navy-900 transition-transform hover:scale-[1.02]"
        >
          Upgrade
        </button>
      </div>
    </aside>
  )
}
