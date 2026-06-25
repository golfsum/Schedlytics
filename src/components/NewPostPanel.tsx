import { useState } from 'react'
import {
  X,
  Check,
  ChevronDown,
  ImagePlus,
  Play,
  MapPin,
  Tag,
  Type,
  Clock,
  CalendarDays,
  Send,
  Lock,
  Link2,
} from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { useImageUpload } from './ImageUpload'
import { useConnections } from './Connections'
import { sampleData } from '../lib/socialApi'
import { PLATFORM_LIST, PLATFORMS, SAMPLE_CAMPAIGNS, isComingSoon } from '../data'
import type { CalendarPost, PlatformId } from '../types'

interface NewPostPanelProps {
  onClose: () => void
  onSchedule: (post: Omit<CalendarPost, 'id'>) => void
}

const CONTENT_TYPES = ['Reel', 'Post', 'Story', 'Carousel'] as const

export default function NewPostPanel({ onClose, onSchedule }: NewPostPanelProps) {
  const [selected, setSelected] = useState<PlatformId[]>(sampleData ? ['youtube', 'tiktok'] : [])
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]>('Reel')
  const [caption, setCaption] = useState(sampleData ? 'New summer look! #fashion #summer ☀️' : '')
  const [geotag, setGeotag] = useState(sampleData)
  const [shopping, setShopping] = useState(sampleData)
  const [altText, setAltText] = useState(sampleData)
  const [day, setDay] = useState(0)
  const [time, setTime] = useState('10:00')
  const [scheduled, setScheduled] = useState(false)
  // Link tracking / attribution
  const [trackClicks, setTrackClicks] = useState(sampleData)
  const [destinationUrl, setDestinationUrl] = useState(sampleData ? 'https://yourstore.com/summer-sale' : '')
  const [campaign, setCampaign] = useState(sampleData ? 'Summer Sale' : '')
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const { addToast } = useToast()
  const { accounts } = useConnections()
  const media = useImageUpload(
    sampleData
      ? 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=640&q=70'
      : undefined,
    () => addToast('Media updated'),
  )

  const anyConnected = PLATFORM_LIST.some((p) => p.id !== 'reels' && accounts[p.id]?.connected)
  const platformHint = anyConnected
    ? 'Locked platforms are not connected. Manage them in Settings.'
    : 'No accounts connected yet. Connect one in Settings to start posting.'

  const togglePlatform = (id: PlatformId) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )

  const handleSchedule = () => {
    if (selected.length === 0) {
      addToast('Select at least one platform', 'info')
      return
    }
    const primary = selected[0] ?? 'instagram'
    const platform: PlatformId = contentType === 'Reel' ? 'reels' : primary
    onSchedule({
      platform,
      label: caption.slice(0, 22) || 'New post',
      day,
      slot: Math.max(0, ['9:00', '10:00', '11:00', '12:00', '1:00', '2:00'].indexOf(time)),
      span: 1,
      trackClicks,
      campaign: trackClicks && campaign ? campaign : undefined,
      destinationUrl: trackClicks && destinationUrl ? destinationUrl : undefined,
      utmSource: trackClicks && utmSource ? utmSource : undefined,
      utmMedium: trackClicks && utmMedium ? utmMedium : undefined,
      utmCampaign: trackClicks && utmCampaign ? utmCampaign : undefined,
    })
    addToast('Post Scheduled! 🎉')
    setScheduled(true)
    setTimeout(() => {
      setScheduled(false)
      onClose()
    }, 1200)
  }

  return (
    <aside className="flex h-full w-full animate-slide-in-right flex-col overflow-y-auto border-l border-white/5 bg-navy-850/95 backdrop-blur-md">
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-navy-850/95 px-5 py-4 backdrop-blur">
        <h2 className="text-lg font-bold text-white">New Post</h2>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-6 p-5">
        {/* Platform + content type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Platform Selector</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORM_LIST.filter((p) => p.id !== 'reels').map((p) => {
                const soon = isComingSoon(p.id)
                const connected = Boolean(accounts[p.id]?.connected)
                const isOn = connected && !soon && selected.includes(p.id)
                const { Icon } = p
                return (
                  <button
                    key={p.id}
                    onClick={() => !soon && connected && togglePlatform(p.id)}
                    disabled={!connected || soon}
                    title={soon ? `${p.name} (coming soon)` : connected ? p.name : `${p.name} (not connected, connect in Settings)`}
                    className={`relative grid h-11 w-11 place-items-center rounded-xl border transition-all ${
                      isOn
                        ? `border-transparent bg-gradient-to-br ${p.gradient} text-white shadow-md`
                        : !soon && connected
                          ? 'border-white/10 bg-navy-900/60 text-slate-400 hover:text-white'
                          : 'cursor-not-allowed border-white/5 bg-navy-900/40 text-slate-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {isOn && (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 ring-2 ring-navy-850">
                        <Check className="h-2.5 w-2.5 text-navy-900" strokeWidth={3.5} />
                      </span>
                    )}
                    {(soon || !connected) && !isOn && (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-navy-800 text-slate-400 ring-2 ring-navy-850">
                        <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{platformHint}</p>
          </div>

          <div>
            <Label>Content Type</Label>
            <div className="relative mt-2">
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as (typeof CONTENT_TYPES)[number])}
                className="w-full appearance-none rounded-xl border border-white/5 bg-navy-900/60 px-3.5 py-3 text-sm font-medium text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              >
                {CONTENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Visual upload */}
        <div>
          <Label>Visual Upload</Label>
          {media.preview ? (
            <button
              type="button"
              onClick={media.open}
              className="group relative mt-2 block w-full overflow-hidden rounded-xl border border-white/10"
            >
              <img src={media.preview} alt="Post preview" className="h-40 w-full object-cover" />
              <div className="absolute inset-0 grid place-items-center bg-navy-950/30 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex items-center gap-2 rounded-lg bg-navy-900/80 px-3 py-1.5 text-xs font-medium text-white">
                  <ImagePlus className="h-4 w-4" /> Replace media
                </span>
              </div>
              <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 shadow-lg transition-transform group-hover:scale-110">
                <Play className="h-5 w-5 translate-x-0.5 fill-navy-900" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={media.open}
              className="mt-2 flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-slate-400 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">Upload a photo or video</span>
            </button>
          )}
          {media.input}
        </div>

        {/* Caption */}
        <div>
          <Label>Caption</Label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/5 bg-navy-900/60 px-3.5 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          />
          <div className="mt-1 text-right text-[11px] text-slate-500">
            {caption.length}/2200
          </div>
        </div>

        {/* Tagging tools */}
        <div>
          <Label>Tagging Tools</Label>
          <div className="mt-2 space-y-1">
            <TagRow
              icon={<MapPin className="h-4 w-4 text-cyan-accent" />}
              label="Add Geotag"
              checked={geotag}
              onChange={setGeotag}
            />
            <TagRow
              icon={<Tag className="h-4 w-4 text-cyan-accent" />}
              label="Tag Products"
              hint="Shopping Tags"
              checked={shopping}
              onChange={setShopping}
            />
            <TagRow
              icon={<Type className="h-4 w-4 text-cyan-accent" />}
              label="Add Alt Text"
              checked={altText}
              onChange={setAltText}
            />
          </div>
        </div>

        {/* Link tracking / attribution */}
        <div>
          <Label>Link Tracking</Label>
          <div className="mt-2 space-y-3 rounded-xl border border-white/5 bg-navy-900/40 p-3">
            <TagRow
              icon={<Link2 className="h-4 w-4 text-cyan-accent" />}
              label="Track clicks"
              hint="Auto short link"
              checked={trackClicks}
              onChange={setTrackClicks}
            />
            {trackClicks && (
              <div className="space-y-3 border-t border-white/5 pt-3">
                <input
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="Destination URL (https://…)"
                  className="w-full rounded-lg border border-white/5 bg-navy-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                />
                <div className="relative">
                  <select
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/5 bg-navy-950/70 px-3 py-2 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none"
                  >
                    <option value="">{sampleData ? 'No campaign' : 'No campaigns yet'}</option>
                    {sampleData && SAMPLE_CAMPAIGNS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="utm_source" className="rounded-lg border border-white/5 bg-navy-950/70 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none" />
                  <input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="utm_medium" className="rounded-lg border border-white/5 bg-navy-950/70 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none" />
                  <input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="utm_campaign" className="rounded-lg border border-white/5 bg-navy-950/70 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scheduling */}
        <div>
          <Label>Scheduling &amp; Time</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <SelectField
              icon={<CalendarDays className="h-4 w-4 text-slate-400" />}
              value={day}
              onChange={(v) => setDay(Number(v))}
              options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
                (d, i) => ({ label: i === 0 ? 'Tomorrow' : d, value: i }),
              )}
            />
            <SelectField
              icon={<Clock className="h-4 w-4 text-slate-400" />}
              value={time}
              onChange={(v) => setTime(String(v))}
              options={['9:00', '10:00', '11:00', '12:00', '1:00', '2:00'].map((t) => ({
                label: `${t} AM`,
                value: t,
              }))}
            />
          </div>
        </div>
      </div>

      {/* schedule button */}
      <div className="sticky bottom-0 mt-auto border-t border-white/5 bg-navy-850/95 p-5 backdrop-blur">
        <button
          onClick={handleSchedule}
          disabled={scheduled}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-cyan py-3.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-80"
        >
          {scheduled ? (
            <>
              <Check className="h-4 w-4" strokeWidth={3} /> Scheduled!
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Schedule Post
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Posting to{' '}
          <span className="text-slate-300">
            {selected.map((s) => PLATFORMS[s].name).join(', ') || 'no platforms'}
          </span>
        </p>
      </div>
    </aside>
  )
}

/* ---------------------------------- bits ---------------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-semibold text-white">{children}</span>
  )
}

function TagRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1.5">
      {icon}
      <span className="text-sm text-slate-200">{label}</span>
      <div className="ml-auto flex items-center gap-2.5">
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
        <Toggle checked={checked} onChange={onChange} size="sm" label={label} />
      </div>
    </div>
  )
}

function SelectField({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode
  value: string | number
  onChange: (v: string) => void
  options: { label: string; value: string | number }[]
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-white/5 bg-navy-900/60 py-3 pl-9 pr-7 text-sm font-medium text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}
