import { useState, useEffect, type ReactNode } from 'react'
import {
  Link2,
  Scissors,
  Copy,
  ExternalLink,
  Check,
  BarChart3,
  Trash2,
  Plus,
  QrCode,
  Pencil,
  FileText,
  X,
} from 'lucide-react'
import { useToast } from './Toast'
import { useProfile, initialsOf } from './Profile'
import { usePersistedState } from '../lib/usePersisted'
import { sampleData } from '../lib/socialApi'
import { SAMPLE_CAMPAIGNS, PLATFORMS } from '../data'
import { CONNECTABLE } from './Connections'
import type { PlatformId } from '../types'
import LinkInBioModal, { type BioLink } from './LinkInBioModal'
import LinkDetail from './LinkDetail'
import LinkInBio from './LinkInBio'
import { exportCsv } from '../lib/csv'
import {
  listShortLinks,
  createShortLink,
  deleteShortLink,
  displayShort,
  type ShortLink,
  type ShortLinkMeta,
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
/*  Full page (Links route): Tracked Links table + Create Link / QR modals      */
/* -------------------------------------------------------------------------- */

const ALL = 'All'
const linkStatus = (l: ShortLink) => (l.expiresAt && l.expiresAt < Date.now() ? 'Expired' : 'Active')
const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
const qrSrc = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}`

export default function LinkToolsView() {
  const { addToast } = useToast()
  const [items, setItems] = useState<ShortLink[]>([])
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [creating, setCreating] = useState<false | { qr: boolean }>(false)
  const [qrLink, setQrLink] = useState<ShortLink | null>(null)
  const [detailLink, setDetailLink] = useState<ShortLink | null>(null)
  const [view, setView] = useState<'links' | 'bio'>('links')

  // filters
  const [fCampaign, setFCampaign] = useState(ALL)
  const [fPlatform, setFPlatform] = useState(ALL)
  const [fStatus, setFStatus] = useState(ALL)
  const [query, setQuery] = useState('')

  // Load existing links (from the backend if configured, else localStorage).
  useEffect(() => {
    listShortLinks()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

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

  const onCreated = (created: ShortLink, showQr: boolean) => {
    setItems((l) => [created, ...l])
    setCreating(false)
    addToast('Tracked link created! 🔗')
    if (showQr) setQrLink(created)
  }

  // distinct campaign options present in the data
  const campaigns = [ALL, ...Array.from(new Set(items.map((l) => l.campaign).filter(Boolean) as string[]))]
  const filtered = items.filter(
    (l) =>
      (fCampaign === ALL || l.campaign === fCampaign) &&
      (fPlatform === ALL || l.platform === fPlatform) &&
      (fStatus === ALL || linkStatus(l) === fStatus) &&
      (!query.trim() ||
        l.url.toLowerCase().includes(query.toLowerCase()) ||
        l.slug.toLowerCase().includes(query.toLowerCase())),
  )

  const totalClicks = items.reduce((sum, l) => sum + (l.clicks || 0), 0)

  if (detailLink) {
    return <LinkDetail link={detailLink} onBack={() => setDetailLink(null)} />
  }

  return (
    <div className="space-y-6">
      {/* view switch */}
      <div className="flex rounded-xl border border-white/5 bg-navy-800/70 p-1">
        {(['links', 'bio'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              view === v ? 'gradient-cyan text-navy-900 shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {v === 'links' ? 'Tracked Links' : 'Link in Bio'}
          </button>
        ))}
      </div>

      {view === 'bio' && <LinkInBio />}

      {view === 'links' && (
       <>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Tracked Links</h1>
          <p className="mt-1 text-sm text-slate-400">
            Shorten links, add UTM tracking, and measure which content sends traffic.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
          <BarChart3 className="h-3.5 w-3.5" />
          {totalClicks.toLocaleString()} total clicks
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {items.length > 0 && (
            <button
              onClick={() =>
                exportCsv(
                  'tracked-links.csv',
                  items.map((l) => ({
                    'Short Link': displayShort(l.shortUrl),
                    Destination: l.url,
                    Campaign: l.campaign || '',
                    'Source Post': l.sourcePost || '',
                    Clicks: l.clicks || 0,
                    Visitors: l.uniqueVisitors ?? '',
                    Status: linkStatus(l),
                  })),
                )
              }
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
            >
              <FileText className="h-4 w-4" /> Export CSV
            </button>
          )}
          <button
            onClick={() => setCreating({ qr: false })}
            className="flex items-center gap-2 rounded-xl gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Create Link
          </button>
          <button
            onClick={() => setCreating({ qr: true })}
            className="flex items-center gap-2 rounded-xl border border-cyan-accent/30 px-4 py-2.5 text-sm font-semibold text-cyan-accent transition-colors hover:bg-cyan-accent/10"
          >
            <QrCode className="h-4 w-4" /> Create QR Code
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={fCampaign} onChange={setFCampaign} options={campaigns} label="Campaign" />
        <FilterSelect
          value={fPlatform}
          onChange={setFPlatform}
          options={[ALL, ...CONNECTABLE]}
          label="Platform"
          render={(v) => (v === ALL ? 'All platforms' : PLATFORMS[v as PlatformId]?.name || v)}
        />
        <FilterSelect value={fStatus} onChange={setFStatus} options={[ALL, 'Active', 'Expired']} label="Status" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search links…"
          className="ml-auto w-44 rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
        />
      </div>

      {/* links table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Short Link</th>
              <th className="px-4 py-3 font-semibold">Destination</th>
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 font-semibold">Source Post</th>
              <th className="px-4 py-3 text-right font-semibold">Clicks</th>
              <th className="px-4 py-3 text-right font-semibold">Visitors</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((l) => (
              <tr key={l.slug} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <a
                    href={l.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-cyan-accent hover:underline"
                  >
                    {displayShort(l.shortUrl)}
                  </a>
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-slate-400" title={l.url}>
                  {l.url.replace(/^https?:\/\//, '')}
                </td>
                <td className="px-4 py-3 text-slate-300">{l.campaign || 'None'}</td>
                <td className="px-4 py-3 text-slate-300">{l.sourcePost || 'None'}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{(l.clicks || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-300">
                  {l.uniqueVisitors != null ? l.uniqueVisitors.toLocaleString() : '0'}
                </td>
                <td className="px-4 py-3 text-slate-400">{fmtDate(l.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      linkStatus(l) === 'Active'
                        ? 'bg-emerald-400/10 text-emerald-300'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {linkStatus(l)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <RowAction Icon={copiedSlug === l.slug ? Check : Copy} title="Copy" onClick={() => copy(l)} />
                    <RowAction Icon={QrCode} title="QR code" onClick={() => setQrLink(l)} />
                    <RowAction Icon={BarChart3} title="Analytics" onClick={() => setDetailLink(l)} />
                    <RowAction Icon={Pencil} title="Edit" onClick={() => addToast('Link editing is coming soon', 'info')} />
                    <RowAction Icon={Trash2} title="Delete" danger onClick={() => remove(l.slug)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {items.length === 0
              ? 'No tracked links yet. Create one to start measuring traffic.'
              : 'No links match these filters.'}
          </p>
        )}
      </div>
      </>
      )}

      {creating && (
        <CreateLinkModal
          defaultQr={creating.qr}
          onClose={() => setCreating(false)}
          onCreated={onCreated}
        />
      )}
      {qrLink && <QrModal link={qrLink} onClose={() => setQrLink(null)} />}
    </div>
  )
}

/* --------------------------------- bits ---------------------------------- */

function FilterSelect({
  value,
  onChange,
  options,
  label,
  render,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  label: string
  render?: (v: string) => string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {render ? render(o) : o === ALL ? `All ${label.toLowerCase()}s` : o}
        </option>
      ))}
    </select>
  )
}

function RowAction({
  Icon,
  title,
  onClick,
  danger,
}: {
  Icon: typeof Copy
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-white/5 bg-navy-900/60 text-slate-300 hover:text-white ${
        danger ? 'hover:text-rose-300' : ''
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function QrModal({ link, onClose }: { link: ShortLink; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-white">QR Code</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <img
          src={qrSrc(link.shortUrl)}
          alt={`QR code for ${displayShort(link.shortUrl)}`}
          className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
        />
        <p className="mt-3 truncate text-xs text-slate-400">{displayShort(link.shortUrl)}</p>
      </div>
    </div>
  )
}

function CreateLinkModal({
  defaultQr,
  onClose,
  onCreated,
}: {
  defaultQr: boolean
  onClose: () => void
  onCreated: (link: ShortLink, showQr: boolean) => void
}) {
  const { addToast } = useToast()
  const [destination, setDestination] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [campaign, setCampaign] = useState('')
  const [platform, setPlatform] = useState('')
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [genQr, setGenQr] = useState(defaultQr)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!destination.trim()) {
      addToast('Enter a destination URL', 'info')
      return
    }
    setBusy(true)
    try {
      const meta: ShortLinkMeta = {
        customSlug: customSlug.trim() || undefined,
        campaign: campaign || undefined,
        platform: (platform as PlatformId) || undefined,
        utmSource: utmSource.trim() || undefined,
        utmMedium: utmMedium.trim() || undefined,
        utmCampaign: utmCampaign.trim() || undefined,
      }
      const created = await createShortLink(destination, meta)
      onCreated(created, genQr)
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not create link', 'info')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Create Tracked Link</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Destination URL">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="https://yourstore.com/summer-sale"
              className={inputCls}
            />
          </Field>
          <Field label="Custom short code (optional)">
            <input
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              placeholder="summer-sale"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Campaign">
              <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={inputCls}>
                <option value="">{sampleData ? 'None' : 'No campaigns yet'}</option>
                {sampleData && SAMPLE_CAMPAIGNS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Source platform">
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {CONNECTABLE.map((id) => (
                  <option key={id} value={id}>{PLATFORMS[id].name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="UTM source">
              <input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="instagram" className={inputCls} />
            </Field>
            <Field label="UTM medium">
              <input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="social" className={inputCls} />
            </Field>
            <Field label="UTM campaign">
              <input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="summer_sale" className={inputCls} />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={genQr} onChange={(e) => setGenQr(e.target.checked)} className="accent-cyan-accent" />
            Generate a QR code for this link
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02] disabled:opacity-70"
          >
            {busy ? 'Creating…' : 'Create Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-white/5 bg-navy-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  )
}
