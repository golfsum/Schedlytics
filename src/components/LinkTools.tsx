import { useState } from 'react'
import {
  Link2,
  Scissors,
  Copy,
  ExternalLink,
  Check,
  BarChart3,
  Trash2,
} from 'lucide-react'
import { useToast } from './Toast'

interface ShortLink {
  id: number
  long: string
  short: string
  clicks: number
}

let linkId = 0

/* -------------------------------------------------------------------------- */
/*  Shared card: Link-in-bio builder + URL shortener                            */
/* -------------------------------------------------------------------------- */

export function LinkEngagementTools() {
  const { addToast } = useToast()
  const [longUrl, setLongUrl] = useState('')
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = () => {
    if (!longUrl.trim()) {
      addToast('Enter a URL to shorten first', 'info')
      return
    }
    const slug = Math.random().toString(36).slice(2, 8)
    setShortUrl(`sched.ly/${slug}`)
    setCopied(false)
    addToast('Short link generated! 🔗')
  }

  const copy = () => {
    if (!shortUrl) return
    navigator.clipboard?.writeText(`https://${shortUrl}`).catch(() => {})
    setCopied(true)
    addToast('Copied to clipboard')
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Link2 className="h-5 w-5 text-cyan-accent" />
        <h2 className="text-lg font-bold text-white">Link &amp; Engagement Tools</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Link in Bio Builder */}
        <div className="rounded-xl border border-white/5 bg-navy-900/50 p-4">
          <div className="flex items-start gap-4">
            <div className="w-32 shrink-0 rounded-2xl border border-white/10 bg-navy-950 p-2 shadow-panel">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex flex-col items-center gap-2 pb-1">
                <img
                  src="https://i.pravatar.cc/80?img=32"
                  alt=""
                  className="h-9 w-9 rounded-full ring-2 ring-cyan-accent/40"
                />
                <span className="text-[10px] font-semibold text-white">Schedlytics</span>
                {['Shop My Feed', 'Latest YouTube', 'Contact'].map((l) => (
                  <button
                    key={l}
                    onClick={() => addToast(`Opening "${l}" block editor`, 'info')}
                    className="w-full rounded-md gradient-cyan-soft py-1 text-center text-[9px] font-semibold text-cyan-accent transition-transform hover:scale-[1.03]"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">Link in Bio Builder</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                Customize a micro landing page for every platform.
              </p>
              <button
                onClick={() => addToast('Link-in-bio editor opened ✨')}
                className="mt-3 flex items-center gap-2 rounded-lg gradient-cyan px-3.5 py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
              >
                <ExternalLink className="h-4 w-4" />
                Manage Link in Bio
              </button>
            </div>
          </div>
        </div>

        {/* Shortened URL Generator */}
        <div className="rounded-xl border border-white/5 bg-navy-900/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-cyan-accent" />
            <h3 className="font-semibold text-white">Shortened URL Generator</h3>
          </div>

          <input
            type="text"
            value={longUrl}
            onChange={(e) => setLongUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="Enter long URL…"
            className="w-full rounded-lg border border-white/5 bg-navy-950/70 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          />

          <button
            onClick={generate}
            className="mt-3 w-full rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.01]"
          >
            Generate Short Link
          </button>

          {shortUrl && (
            <div className="mt-3 flex animate-fade-in items-center justify-between gap-2 rounded-lg border border-cyan-accent/20 bg-cyan-accent/5 px-3 py-2.5">
              <span className="truncate text-sm font-semibold text-cyan-accent">{shortUrl}</span>
              <button
                onClick={copy}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Full page (Link Tools route): shared card + a managed link table           */
/* -------------------------------------------------------------------------- */

export default function LinkToolsView() {
  const { addToast } = useToast()
  const [links, setLinks] = useState<ShortLink[]>([
    { id: ++linkId, long: 'instagram.com/p/summer-drop-2026', short: 'sched.ly/sum26', clicks: 1284 },
    { id: ++linkId, long: 'youtube.com/watch?v=styling-guide', short: 'sched.ly/style', clicks: 932 },
    { id: ++linkId, long: 'shop.mybrand.com/new-collection', short: 'sched.ly/newco', clicks: 2571 },
  ])
  const [draft, setDraft] = useState('')

  const add = () => {
    if (!draft.trim()) {
      addToast('Enter a URL first', 'info')
      return
    }
    const slug = Math.random().toString(36).slice(2, 7)
    setLinks((l) => [
      { id: ++linkId, long: draft.trim(), short: `sched.ly/${slug}`, clicks: 0 },
      ...l,
    ])
    setDraft('')
    addToast('Short link created! 🔗')
  }

  const copy = (short: string) => {
    navigator.clipboard?.writeText(`https://${short}`).catch(() => {})
    addToast('Copied to clipboard')
  }

  const remove = (id: number) => {
    setLinks((l) => l.filter((x) => x.id !== id))
    addToast('Link deleted', 'info')
  }

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Link Tools</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
          <BarChart3 className="h-3.5 w-3.5" />
          {totalClicks.toLocaleString()} total clicks
        </span>
      </div>

      <LinkEngagementTools />

      {/* managed links */}
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Your Links</h2>

        <div className="mb-4 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Paste a URL to shorten and track…"
            className="flex-1 rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          />
          <button
            onClick={add}
            className="rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
          >
            Shorten
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-cyan-accent">{l.short}</div>
                <div className="truncate text-xs text-slate-500">{l.long}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-white">{l.clicks.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500">clicks</div>
              </div>
              <button
                onClick={() => copy(l.short)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(l.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-400 hover:text-rose-300"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {links.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              No links yet — shorten one above to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
