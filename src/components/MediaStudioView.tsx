import { useState } from 'react'
import {
  Sparkles,
  Wand2,
  Loader2,
  Check,
  TrendingUp,
  Hash,
  Image as ImageIcon,
  Film,
  Clock,
  ChevronDown,
  FlaskConical,
  Send,
  UploadCloud,
} from 'lucide-react'
import Toggle from './Toggle'
import ThumbnailPicker from './ThumbnailPicker'
import { useToast } from './Toast'
import { useImageUpload } from './ImageUpload'
import { aiTitles, aiCaptions, aiHashtags, type Suggestion } from '../lib/aiSuggest'
import { PLATFORM_LIST, PLATFORMS } from '../data'
import type { PlatformId } from '../types'

/** Per-platform thumbnail capabilities. */
const THUMB_CAPS: Record<string, { custom: boolean; frame: boolean; note: string }> = {
  youtube: { custom: true, frame: true, note: 'Upload a custom thumbnail or pick a frame.' },
  reels: { custom: true, frame: true, note: 'Pick a cover frame or upload a custom cover.' },
  instagram: { custom: false, frame: true, note: 'Instagram uses a cover frame from the video.' },
  tiktok: { custom: false, frame: true, note: 'TikTok uses a cover frame from the video.' },
  facebook: { custom: true, frame: true, note: 'Upload a custom thumbnail or pick a frame.' },
  pinterest: { custom: true, frame: false, note: 'Pinterest pins use a still image.' },
  twitch: { custom: true, frame: false, note: 'Upload a custom thumbnail for the VOD.' },
  patreon: { custom: true, frame: false, note: 'Upload a cover image for the post.' },
}

export default function MediaStudioView() {
  const { addToast } = useToast()
  const [platform, setPlatform] = useState<PlatformId>('youtube')
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video')
  const image = useImageUpload(undefined, () => addToast('Image added'))
  const [thumbnail, setThumbnail] = useState<string | undefined>()
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [abTest, setAbTest] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // AI suggestion state
  const [titleSugs, setTitleSugs] = useState<Suggestion[]>([])
  const [captionSugs, setCaptionSugs] = useState<Suggestion[]>([])
  const [tagSugs, setTagSugs] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState<'title' | 'caption' | 'tags' | null>(null)

  const caps = THUMB_CAPS[platform] || { custom: true, frame: true, note: '' }
  const plat = PLATFORMS[platform]

  const run = async (
    kind: 'title' | 'caption' | 'tags',
    fn: () => Promise<Suggestion[]>,
    set: (s: Suggestion[]) => void,
  ) => {
    setLoading(kind)
    try {
      set(await fn())
    } finally {
      setLoading(null)
    }
  }

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const publish = () => {
    setPublishing(true)
    addToast(`Scheduled to ${plat.name}! 🚀`)
    setTimeout(() => setPublishing(false), 1400)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Media Studio</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
          <Sparkles className="h-3.5 w-3.5" /> AI assisted
        </span>
      </div>

      {/* platform selector */}
      <div className="card p-4">
        <span className="mb-2 block text-sm font-semibold text-white">Publishing to</span>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_LIST.map((p) => {
            const { Icon } = p
            const on = platform === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  on
                    ? `border-transparent bg-gradient-to-r ${p.gradient} text-white shadow-md`
                    : 'border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* LEFT: media + thumbnail */}
        <section className="card flex flex-col gap-5 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Media</span>
              <div className="flex rounded-lg border border-white/5 bg-navy-900/60 p-0.5 text-xs">
                {(['video', 'image'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMediaMode(m)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
                      mediaMode === m ? 'gradient-cyan text-navy-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m === 'video' ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {mediaMode === 'image' ? (
              <button
                onClick={image.open}
                className="grid aspect-video w-full place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-navy-900/50 text-slate-400 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
              >
                {image.preview ? (
                  <img src={image.preview} alt="Post" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2">
                    <UploadCloud className="h-7 w-7" />
                    <span className="text-xs font-medium">Upload an image</span>
                  </span>
                )}
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                Upload your video below and pick a cover frame for {plat.name}.
              </p>
            )}
            {image.input}
          </div>

          {/* thumbnail (relevant for video; for image platforms still allow custom cover) */}
          <ThumbnailPicker
            allowCustom={caps.custom}
            allowFrames={caps.frame && mediaMode === 'video'}
            note={caps.note}
            onSelect={(url) => {
              setThumbnail(url)
              addToast('Thumbnail set')
            }}
          />
          {thumbnail && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Thumbnail selected
            </div>
          )}
        </section>

        {/* RIGHT: AI title, caption, hashtags + publish */}
        <section className="card flex flex-col gap-5 p-5">
          {/* Title */}
          <Field
            label="Title"
            loading={loading === 'title'}
            onGenerate={() => run('title', () => aiTitles(title), setTitleSugs)}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Type a topic, then let AI optimize it"
              className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
            <Suggestions items={titleSugs} onPick={(s) => setTitle(s)} />
          </Field>

          {/* Caption */}
          <Field
            label="Caption"
            loading={loading === 'caption'}
            onGenerate={() => run('caption', () => aiCaptions(title), setCaptionSugs)}
          >
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Write a caption or generate one tuned for engagement"
              className="w-full resize-none rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
            <Suggestions items={captionSugs} onPick={(s) => setCaption(s)} />
          </Field>

          {/* Hashtags */}
          <Field
            label="Trending hashtags"
            loading={loading === 'tags'}
            generateLabel="Suggest trending"
            onGenerate={() => run('tags', () => aiHashtags(title), setTagSugs)}
          >
            {tagSugs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tagSugs.map((s) => {
                  const on = tags.includes(s.text)
                  return (
                    <button
                      key={s.text}
                      onClick={() => toggleTag(s.text)}
                      title={`${s.trend}% trend potential`}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        on
                          ? 'gradient-cyan text-navy-900'
                          : 'border border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
                      }`}
                    >
                      {s.trend >= 90 && <TrendingUp className="h-3 w-3" />}
                      {s.text}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2">
              <Hash className="h-4 w-4 shrink-0 text-cyan-accent" />
              {tags.length === 0 ? (
                <span className="text-sm text-slate-500">Picked hashtags appear here</span>
              ) : (
                <span className="text-sm text-cyan-accent">{tags.join(' ')}</span>
              )}
            </div>
          </Field>

          {/* A/B + schedule + publish */}
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-navy-900/50 px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <FlaskConical className="h-4 w-4 text-cyan-accent" /> A/B test variants
            </span>
            <Toggle checked={abTest} onChange={setAbTest} size="sm" label="A/B test" />
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Scheduled time</span>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-8 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20">
                <option>Tomorrow, 10:00 AM</option>
                <option>Tomorrow, 2:00 PM</option>
                <option>Saturday, 9:00 AM</option>
                <option>Publish now</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <button
            onClick={publish}
            disabled={publishing}
            className="mt-auto flex items-center justify-center gap-2 rounded-lg gradient-cyan py-3 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-80"
          >
            {publishing ? <Check className="h-4 w-4" strokeWidth={3} /> : <Send className="h-4 w-4" />}
            {publishing ? 'Scheduled!' : `Schedule to ${plat.name}`}
          </button>
        </section>
      </div>
    </div>
  )
}

/* ---------------------------------- bits ---------------------------------- */

function Field({
  label,
  loading,
  onGenerate,
  generateLabel = 'Generate with AI',
  children,
}: {
  label: string
  loading: boolean
  onGenerate: () => void
  generateLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{label}</span>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-accent/30 px-2.5 py-1 text-xs font-semibold text-cyan-accent transition-colors hover:bg-cyan-accent/10 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {loading ? 'Thinking…' : generateLabel}
        </button>
      </div>
      {children}
    </div>
  )
}

function Suggestions({ items, onPick }: { items: Suggestion[]; onPick: (text: string) => void }) {
  if (items.length === 0) return null
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((s, i) => (
        <button
          key={i}
          onClick={() => onPick(s.text)}
          className="group flex w-full items-center gap-2 rounded-lg border border-white/5 bg-navy-900/40 px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:border-cyan-accent/30 hover:bg-cyan-accent/5"
        >
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              s.trend >= 90
                ? 'bg-emerald-500/20 text-emerald-300'
                : s.trend >= 80
                  ? 'bg-cyan-accent/20 text-cyan-accent'
                  : 'bg-white/10 text-slate-400'
            }`}
            title="Trend potential"
          >
            {s.trend}
          </span>
          <span className="flex-1">{s.text}</span>
          <span className="shrink-0 text-[11px] text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
            Use
          </span>
        </button>
      ))}
    </div>
  )
}
