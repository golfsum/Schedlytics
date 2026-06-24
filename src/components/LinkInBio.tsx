import { useState } from 'react'
import { Plus, Trash2, Copy, ExternalLink, Check } from 'lucide-react'
import { useToast } from './Toast'
import { useProfile, initialsOf } from './Profile'
import { usePersistedState } from '../lib/usePersisted'
import { sampleData } from '../lib/socialApi'
import { PLATFORMS } from '../data'
import type { PlatformId } from '../types'

interface BioButton {
  id: string
  label: string
  url: string
}
interface BioProfile {
  handle: string
  headline: string
  theme: string
  buttons: BioButton[]
  socials: Partial<Record<PlatformId, string>>
}

const THEMES = ['#22D3EE', '#6366F1', '#E1306C', '#34D399', '#F59E0B']
const SOCIALS: PlatformId[] = ['instagram', 'youtube', 'tiktok', 'pinterest']

const DEFAULT_PROFILE: BioProfile = {
  handle: 'yourname',
  headline: 'Creator, storyteller, and maker',
  theme: '#22D3EE',
  buttons: [
    { id: 'b1', label: 'Shop my favorites', url: 'https://yourstore.com' },
    { id: 'b2', label: 'Latest YouTube video', url: 'https://youtube.com' },
    { id: 'b3', label: 'Free newsletter', url: 'https://yoursite.com/newsletter' },
  ],
  socials: { instagram: 'yourname', youtube: 'yourname', tiktok: '', pinterest: '' },
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

/** Deterministic sample button analytics from the button id. */
function buttonStats(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  const a = Math.abs(h)
  const clicks = 120 + (a % 1800)
  const ctr = 8 + (a % 220) / 10
  const sources = ['Instagram', 'TikTok', 'YouTube', 'Direct']
  return { clicks, ctr: `${ctr.toFixed(1)}%`, topSource: sources[a % sources.length] }
}

export default function LinkInBio() {
  const { addToast } = useToast()
  const profile = useProfile()
  const [bio, setBio] = usePersistedState<BioProfile>('sl_bio_profile', DEFAULT_PROFILE)
  const [copied, setCopied] = useState(false)

  const publicUrl = `schedlytics.app/@${bio.handle || 'yourname'}`

  const update = (patch: Partial<BioProfile>) => setBio((b) => ({ ...b, ...patch }))
  const setButton = (id: string, patch: Partial<BioButton>) =>
    setBio((b) => ({ ...b, buttons: b.buttons.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const addButton = () =>
    setBio((b) => ({ ...b, buttons: [...b.buttons, { id: `b${Date.now()}`, label: 'New link', url: '' }] }))
  const removeButton = (id: string) =>
    setBio((b) => ({ ...b, buttons: b.buttons.filter((x) => x.id !== id) }))

  const copyUrl = () => {
    navigator.clipboard?.writeText(`https://${publicUrl}`).catch(() => {})
    setCopied(true)
    addToast('Profile link copied')
    setTimeout(() => setCopied(false), 1600)
  }

  const inputCls =
    'w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20'

  return (
    <div className="space-y-5">
      {/* public URL bar */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm text-slate-400">Your public profile</span>
        <span className="font-semibold text-cyan-accent">{publicUrl}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={copyUrl} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
          </button>
          <a href={`https://${publicUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* phone preview */}
        <div className="card flex justify-center p-6">
          <div className="w-60 rounded-[28px] border border-white/10 bg-navy-950 p-4 shadow-panel">
            <div className="flex flex-col items-center gap-2 text-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="h-16 w-16 rounded-full object-cover ring-2" style={{ '--tw-ring-color': bio.theme } as React.CSSProperties} />
              ) : (
                <span
                  className="grid h-16 w-16 place-items-center rounded-full text-lg font-bold text-navy-900 ring-2"
                  style={{ background: bio.theme }}
                >
                  {initialsOf(bio.handle, profile.email)}
                </span>
              )}
              <div className="text-sm font-bold text-white">@{bio.handle || 'yourname'}</div>
              <div className="text-xs text-slate-400">{bio.headline}</div>
              <div className="mt-1 flex gap-2">
                {SOCIALS.filter((s) => bio.socials[s]).map((s) => {
                  const { Icon } = PLATFORMS[s]
                  return (
                    <span key={s} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-slate-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  )
                })}
              </div>
              <div className="mt-2 w-full space-y-2">
                {bio.buttons.map((b) => (
                  <div
                    key={b.id}
                    className="truncate rounded-xl px-3 py-2 text-center text-xs font-bold text-navy-900"
                    style={{ background: bio.theme }}
                  >
                    {b.label || 'Untitled'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* editor */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold text-white">Profile</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Handle</span>
                <input value={bio.handle} onChange={(e) => update({ handle: e.target.value.replace(/[^a-z0-9_.]/gi, '') })} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Headline</span>
                <input value={bio.headline} onChange={(e) => update({ headline: e.target.value })} className={inputCls} />
              </label>
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Theme color</span>
              <div className="flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => update({ theme: t })}
                    className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-navy-900 ${bio.theme === t ? 'ring-white' : 'ring-transparent'}`}
                    style={{ background: t }}
                    aria-label={`Theme ${t}`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SOCIALS.map((s) => {
                const { Icon, name } = PLATFORMS[s]
                return (
                  <label key={s} className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <Icon className="h-3.5 w-3.5" /> {name}
                    </span>
                    <input
                      value={bio.socials[s] || ''}
                      onChange={(e) => update({ socials: { ...bio.socials, [s]: e.target.value } })}
                      placeholder="handle"
                      className={inputCls}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          {/* links + analytics */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Links</h2>
              <button onClick={addButton} className="flex items-center gap-1.5 rounded-lg gradient-cyan px-3 py-1.5 text-xs font-bold text-navy-900">
                <Plus className="h-3.5 w-3.5" /> Add link
              </button>
            </div>
            <div className="space-y-3">
              {bio.buttons.map((b) => {
                const st = buttonStats(b.id)
                return (
                  <div key={b.id} className="rounded-xl border border-white/5 bg-navy-900/50 p-3">
                    <div className="flex gap-2">
                      <input value={b.label} onChange={(e) => setButton(b.id, { label: e.target.value })} placeholder="Button label" className={`${inputCls} flex-1`} />
                      <button onClick={() => removeButton(b.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/5 text-slate-400 hover:text-rose-300" title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input value={b.url} onChange={(e) => setButton(b.id, { url: e.target.value })} placeholder="https://destination.com" className={`${inputCls} mt-2`} />
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      <span><span className="font-bold text-white">{sampleData ? compact(st.clicks) : '—'}</span> clicks</span>
                      <span>CTR <span className="font-bold text-white">{sampleData ? st.ctr : '—'}</span></span>
                      <span>Top source <span className="font-bold text-white">{sampleData ? st.topSource : '—'}</span></span>
                    </div>
                  </div>
                )
              })}
              {bio.buttons.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">No links yet. Add one to build your page.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
