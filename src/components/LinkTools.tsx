import { useState, useEffect } from 'react'
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
import { useProfile, initialsOf } from './Profile'
import { usePersistedState } from '../lib/usePersisted'
import LinkInBioModal, { type BioLink } from './LinkInBioModal'
import {
  listShortLinks,
  createShortLink,
  deleteShortLink,
  displayShort,
  type ShortLink,
} from '../lib/shortLinks'

const DEFAULT_BIO_LINKS: BioLink[] = [
  { id: 'bio_shop', label: 'Shop My Feed', url: '' },
  { id: 'bio_yt', label: 'Latest YouTube', url: '' },
  { id: 'bio_contact', label: 'Contact', url: '' },
]

/* -------------------------------------------------------------------------- */
/*  Shared card: Link-in-bio builder + URL shortener                            */
/* -------------------------------------------------------------------------- */

export function LinkEngagementTools() {
  const { addToast } = useToast()
  const profile = useProfile()
  const [longUrl, setLongUrl] = useState('')
  const [link, setLink] = useState<ShortLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [bioTitle, setBioTitle] = usePersistedState('sl_bio_title', profile.name || 'My Links')
  const [bioLinks, setBioLinks] = usePersistedState<BioLink[]>('sl_bio_links', DEFAULT_BIO_LINKS)
  const [editingBio, setEditingBio] = useState(false)

  const openBioLink = (l: BioLink) => {
    if (l.url) {
      window.open(l.url, '_blank', 'noopener,noreferrer')
    } else {
      addToast(`Add a URL for "${l.label}" in the editor`, 'info')
      setEditingBio(true)
    }
  }

  const generate = async () => {
    if (!longUrl.trim()) {
      addToast('Enter a URL to shorten first', 'info')
      return
    }
    setBusy(true)
    try {
      const created = await createShortLink(longUrl)
      setLink(created)
      setCopied(false)
      addToast('Short link generated! 🔗')
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not create link', 'info')
    } finally {
      setBusy(false)
    }
  }

  const copy = () => {
    if (!link) return
    navigator.clipboard?.writeText(link.shortUrl).catch(() => {})
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
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-cyan-accent/40"
                  />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full gradient-cyan text-[11px] font-bold text-navy-900 ring-2 ring-cyan-accent/40">
                    {initialsOf(bioTitle, profile.email)}
                  </span>
                )}
                <span className="max-w-full truncate text-[10px] font-semibold text-white">{bioTitle}</span>
                {(bioLinks.length ? bioLinks : DEFAULT_BIO_LINKS).slice(0, 4).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => openBioLink(l)}
                    className="w-full truncate rounded-md gradient-cyan-soft px-1 py-1 text-center text-[9px] font-semibold text-cyan-accent transition-transform hover:scale-[1.03]"
                    title={l.url || 'No URL set yet'}
                  >
                    {l.label || 'Untitled'}
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
                onClick={() => setEditingBio(true)}
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
            disabled={busy}
            className="mt-3 w-full rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.01] disabled:opacity-70"
          >
            {busy ? 'Generating…' : 'Generate Short Link'}
          </button>

          {link && (
            <div className="mt-3 flex animate-fade-in items-center justify-between gap-2 rounded-lg border border-cyan-accent/20 bg-cyan-accent/5 px-3 py-2.5">
              <a
                href={link.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm font-semibold text-cyan-accent hover:underline"
                title={`Redirects to ${link.url}`}
              >
                {displayShort(link.shortUrl)}
              </a>
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

      {editingBio && (
        <LinkInBioModal
          title={bioTitle}
          links={bioLinks}
          onClose={() => setEditingBio(false)}
          onSave={(t, links) => {
            setBioTitle(t)
            setBioLinks(links)
            setEditingBio(false)
            addToast('Link in bio saved ✨')
          }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Full page (Link Tools route): shared card + a managed link table           */
/* -------------------------------------------------------------------------- */

export default function LinkToolsView() {
  const { addToast } = useToast()
  const [items, setItems] = useState<ShortLink[]>([])
  const [draft, setDraft] = useState('')
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  // Load existing links (from the backend if configured, else localStorage).
  useEffect(() => {
    listShortLinks()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const add = async () => {
    if (!draft.trim()) {
      addToast('Enter a URL first', 'info')
      return
    }
    try {
      const created = await createShortLink(draft)
      setItems((l) => [created, ...l])
      setDraft('')
      addToast('Short link created! 🔗')
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not create link', 'info')
    }
  }

  const copy = (l: ShortLink) => {
    navigator.clipboard?.writeText(l.shortUrl).catch(() => {})
    setCopiedSlug(l.slug)
    addToast('Copied to clipboard')
    setTimeout(() => setCopiedSlug((s) => (s === l.slug ? null : s)), 1600)
  }

  const remove = async (slug: string) => {
    await deleteShortLink(slug)
    setItems((l) => l.filter((x) => x.slug !== slug))
    addToast('Link deleted', 'info')
  }

  const totalClicks = items.reduce((sum, l) => sum + (l.clicks || 0), 0)

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
          {items.map((l) => (
            <div key={l.slug} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <a
                  href={l.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-semibold text-cyan-accent hover:underline"
                >
                  {displayShort(l.shortUrl)}
                </a>
                <div className="truncate text-xs text-slate-500">{l.url}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-white">{(l.clicks || 0).toLocaleString()}</div>
                <div className="text-[11px] text-slate-500">clicks</div>
              </div>
              <button
                onClick={() => copy(l)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white"
                title="Copy"
              >
                {copiedSlug === l.slug ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={() => remove(l.slug)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-400 hover:text-rose-300"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              No links yet. Shorten one above to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
