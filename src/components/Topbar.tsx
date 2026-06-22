import { Search, Bell, ChevronDown, Menu } from 'lucide-react'

/** Global top bar — search, notifications, and the signed-in user. */
export default function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-navy-900/60 px-4 backdrop-blur-sm sm:px-6">
      {/* mobile menu */}
      <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search posts, channels, analytics…"
          className="w-full rounded-xl border border-white/5 bg-navy-800/70 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* notifications */}
        <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/5 bg-navy-800/70 text-slate-300 transition-colors hover:text-white">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-navy-900" />
        </button>

        {/* user */}
        <button className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-navy-800/70 py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-white/10">
          <img
            src="https://i.pravatar.cc/80?img=12"
            alt="Alex R."
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="hidden text-sm font-semibold text-slate-100 sm:block">Alex R.</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </header>
  )
}
