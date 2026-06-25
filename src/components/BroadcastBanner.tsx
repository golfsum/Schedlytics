import { useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { fetchBanner, type Banner } from '../lib/admin'

/** Site-wide message the admin can broadcast to every app user. Dismissible. */
export default function BroadcastBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    fetchBanner().then((b) => {
      if (!b?.active) return
      // A new banner (different timestamp) re-shows even if a previous one was dismissed.
      if (String(b.at) !== localStorage.getItem('sl_banner_dismissed')) setBanner(b)
    })
  }, [])

  if (!banner) return null
  const warn = banner.type === 'warning'

  return (
    <div
      className={`flex items-center gap-2 border-b px-4 py-2 text-sm sm:px-6 ${
        warn ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-cyan-accent/20 bg-cyan-accent/10 text-cyan-accent'
      }`}
    >
      <Megaphone className="h-4 w-4 shrink-0" />
      <span className="font-medium">{banner.message}</span>
      <button
        onClick={() => {
          localStorage.setItem('sl_banner_dismissed', String(banner.at))
          setBanner(null)
        }}
        className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-white/10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
