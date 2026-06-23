import { useRef, useState } from 'react'
import {
  Sparkles,
  Wand2,
  Loader2,
  Check,
  TrendingUp,
  Hash,
  Image as ImageIcon,
  Film,
  FlaskConical,
  Send,
  UploadCloud,
  Plus,
  Trash2,
  ListOrdered,
  X,
} from 'lucide-react'
import Toggle from './Toggle'
import ThumbnailPicker from './ThumbnailPicker'
import DateTimePicker from './DateTimePicker'
import { useToast } from './Toast'
import { useNotifications } from './Notifications'
import { useConnections } from './Connections'
import { usePersistedState } from '../lib/usePersisted'
import { backendEnabled, publishYouTubeVideo, publishPost, publishMedia } from '../lib/socialApi'
import { aiTitles, aiCaptions, aiHashtags, type Suggestion } from '../lib/aiSuggest'
import { PLATFORM_LIST, PLATFORMS } from '../data'
import type { CalendarPost, PlatformId } from '../types'

interface MediaStudioViewProps {
  /** Add a scheduled post to the shared calendar. */
  onSchedule: (post: Omit<CalendarPost, 'id'>) => void
  /** Called after a successful schedule (e.g. to jump to the calendar). */
  onScheduled: () => void
}

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

/** Platforms whose descriptions render timestamps as clickable chapters. */
const TIMESTAMP_PLATFORMS: Partial<Record<PlatformId, string>> = {
  youtube: 'YouTube turns these into chapters (first must be 0:00).',
  facebook: 'Facebook shows these as video chapters.',
}

interface Chapter {
  time: string
  label: string
}

export default function MediaStudioView({ onSchedule, onScheduled }: MediaStudioViewProps) {
  const { addToast } = useToast()
  const { push } = useNotifications()
  const { accounts } = useConnections()
  const [platform, setPlatform] = useState<PlatformId>('youtube')
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)
  const [thumbnail, setThumbnail] = useState<string | undefined>()
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [abTest, setAbTest] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([{ time: '0:00', label: 'Intro' }])
  const [videoUrl, setVideoUrl] = useState('')

  // Per-platform default description (boilerplate: links, socials) that persists.
  const [defaults, setDefaults] = usePersistedState<Partial<Record<PlatformId, string>>>(
    'sl_default_descriptions',
    {},
  )
  const defaultDescription = defaults[platform] || ''
  const setDefaultDescription = (text: string) =>
    setDefaults((d) => ({ ...d, [platform]: text }))

  const supportsTimestamps = Boolean(TIMESTAMP_PLATFORMS[platform])
  const ytConnected = Boolean(accounts.youtube?.connected)
  const connected = Boolean(accounts[platform]?.connected)
  const canUploadYouTube = platform === 'youtube' && backendEnabled && ytConnected
  const hasVideoFile = Boolean(mediaFile && mediaFile.type.startsWith('video/'))

  const openFilePicker = () => fileRef.current?.click()
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
    addToast(`${file.type.startsWith('video/') ? 'Video' : 'Image'} added`)
    e.target.value = '' // allow re-picking the same file
  }

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

  const addTags = (raw: string) => {
    const parts = raw
      .split(/[\s,]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean)
      .map((t) => `#${t}`)
    if (parts.length) setTags((prev) => Array.from(new Set([...prev, ...parts])))
    setTagInput('')
  }

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      if (tagInput.trim()) addTags(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  // Chapter helpers (item 5).
  const setChapter = (i: number, patch: Partial<Chapter>) =>
    setChapters((c) => c.map((ch, idx) => (idx === i ? { ...ch, ...patch } : ch)))
  const addChapter = () => setChapters((c) => [...c, { time: '', label: '' }])
  const removeChapter = (i: number) => setChapters((c) => c.filter((_, idx) => idx !== i))

  /** Assemble the full description: video caption + chapters + saved default. */
  const composeDescription = () => {
    const blocks: string[] = []
    if (caption.trim()) blocks.push(caption.trim())
    if (supportsTimestamps) {
      const lines = chapters
        .filter((c) => c.time.trim() && c.label.trim())
        .map((c) => `${c.time.trim()} ${c.label.trim()}`)
      if (lines.length) blocks.push(['Chapters:', ...lines].join('\n'))
    }
    if (tags.length) blocks.push(tags.join(' '))
    if (defaultDescription.trim()) blocks.push(defaultDescription.trim())
    return blocks.join('\n\n')
  }

  /** Map the chosen date/time onto the calendar's weekday + slot grid. */
  const buildPost = (): Omit<CalendarPost, 'id'> => {
    const d = scheduleAt ?? new Date()
    const jsDay = d.getDay() // 0 Sun .. 6 Sat
    const day = jsDay === 0 || jsDay === 6 ? 0 : jsDay - 1 // weekend falls back to Monday
    const hourToSlot: Record<number, number> = { 9: 0, 10: 1, 11: 2, 12: 3, 13: 4, 14: 5 }
    const slot = hourToSlot[d.getHours()] ?? 0
    return {
      platform,
      label: (title.trim() || caption.trim() || 'Untitled post').slice(0, 40),
      day,
      slot,
      span: 1,
    }
  }

  // We can publish right now (vs. schedule) when connected, posting now, and the
  // platform supports it: YouTube needs a video file or URL; Facebook can post a
  // file or text.
  const willPublishNow =
    backendEnabled &&
    connected &&
    !scheduleAt &&
    ((platform === 'youtube' && (hasVideoFile || Boolean(videoUrl.trim()))) ||
      platform === 'facebook')

  const notifyResult = (url?: string) => {
    if (url) {
      push({ type: 'success', title: `Published to ${plat.name}`, message: 'View the post', detail: url })
    }
  }

  const publish = async () => {
    if (!title.trim() && !caption.trim()) {
      addToast('Add a title or caption first', 'info')
      return
    }
    setPublishing(true)
    try {
      if (willPublishNow && platform === 'youtube') {
        if (hasVideoFile && mediaFile) {
          // Stream the picked video file straight to YouTube (private).
          const result = await publishMedia('youtube', mediaFile, {
            title: title.trim() || 'Untitled',
            description: composeDescription(),
            tags,
            privacyStatus: 'private',
          })
          addToast('Uploaded your video to YouTube (private)! 🚀')
          notifyResult(result.url)
        } else {
          // Fall back to uploading from a public URL.
          const result = await publishYouTubeVideo({
            videoUrl: videoUrl.trim(),
            title: title.trim() || 'Untitled',
            description: composeDescription(),
            tags,
            privacyStatus: 'private',
          })
          addToast('Uploaded to YouTube as a private video! 🚀')
          notifyResult((result as { url?: string }).url)
          setVideoUrl('')
        }
      } else if (willPublishNow && platform === 'facebook') {
        const message = [title.trim(), composeDescription()].filter(Boolean).join('\n\n')
        // Post the picked photo/video if there is one, otherwise a text post.
        const result = mediaFile
          ? await publishMedia('facebook', mediaFile, { message })
          : await publishPost('facebook', { text: message })
        addToast(`Posted to ${plat.name}! 🚀`)
        notifyResult(result.url)
      } else {
        // Schedule onto the calendar (no direct publishing for this platform,
        // or the user chose a future time).
        onSchedule(buildPost())
        const when = scheduleAt
          ? scheduleAt.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'now'
        addToast(`Added to your calendar (${plat.name}, ${when}) 🗓️`)
        onScheduled()
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      addToast('Could not publish. See the bell for details.', 'info', 6000)
      push({ type: 'error', title: 'Publish failed', message: 'Tap to see the full reason', detail })
    } finally {
      setPublishing(false)
    }
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

            <button
              onClick={openFilePicker}
              className="grid aspect-video w-full place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-navy-900/50 text-slate-400 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
            >
              {mediaPreview && mediaMode === 'image' ? (
                <img src={mediaPreview} alt="Post" className="h-full w-full object-cover" />
              ) : mediaPreview && mediaMode === 'video' ? (
                <video src={mediaPreview} className="h-full w-full object-cover" muted />
              ) : (
                <span className="flex flex-col items-center gap-2">
                  <UploadCloud className="h-7 w-7" />
                  <span className="text-xs font-medium">
                    Upload {mediaMode === 'video' ? 'a video' : 'an image'}
                  </span>
                </span>
              )}
            </button>
            {mediaFile && (
              <p className="mt-2 truncate text-[11px] text-slate-500">
                {mediaFile.name} · {(mediaFile.size / 1_000_000).toFixed(1)} MB
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={mediaMode === 'video' ? 'video/*' : 'image/*'}
              className="hidden"
              onChange={onPickFile}
            />
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

          {/* Caption / Description */}
          <Field
            label="Caption / Description"
            loading={loading === 'caption'}
            onGenerate={() => run('caption', () => aiCaptions(title), setCaptionSugs)}
          >
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="What this specific post is about"
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
            <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2 focus-within:border-cyan-accent/40 focus-within:ring-2 focus-within:ring-cyan-accent/20">
              <Hash className="h-4 w-4 shrink-0 text-cyan-accent" />
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full bg-cyan-accent/15 py-0.5 pl-2 pr-1 text-xs font-medium text-cyan-accent"
                >
                  {t}
                  <button
                    onClick={() => toggleTag(t)}
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-cyan-accent/20"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={() => tagInput.trim() && addTags(tagInput)}
                placeholder={tags.length === 0 ? 'Type a hashtag and press Enter' : 'Add more…'}
                className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </Field>

          {/* Timestamps / Chapters (platforms that support it) */}
          {supportsTimestamps && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-cyan-accent" />
                <span className="text-sm font-semibold text-white">Timestamps / Chapters</span>
              </div>
              <div className="space-y-2">
                {chapters.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={c.time}
                      onChange={(e) => setChapter(i, { time: e.target.value })}
                      placeholder="0:00"
                      className="w-20 rounded-lg border border-white/5 bg-navy-900/60 px-2.5 py-2 text-center text-sm tabular-nums text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                    />
                    <input
                      value={c.label}
                      onChange={(e) => setChapter(i, { label: e.target.value })}
                      placeholder="Chapter title"
                      className="flex-1 rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                    />
                    <button
                      onClick={() => removeChapter(i)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-rose-300"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addChapter}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add timestamp
              </button>
              <p className="mt-1.5 text-[11px] text-slate-500">{TIMESTAMP_PLATFORMS[platform]}</p>
            </div>
          )}

          {/* Default description that persists per platform (item 4) */}
          <Field
            label="Default description (saved)"
            loading={false}
            generateLabel={defaultDescription ? 'Saved ✓' : 'Auto-saves'}
            onGenerate={() => addToast('Your default description saves automatically')}
          >
            <textarea
              value={defaultDescription}
              onChange={(e) => setDefaultDescription(e.target.value)}
              rows={3}
              placeholder={`Boilerplate added to every ${plat.name} post: links, socials, business email…`}
              className="w-full resize-none rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Appended to the end of every {plat.name} post and remembered next time.
            </p>
          </Field>

          {/* Combined description preview */}
          {composeDescription() && (
            <details className="rounded-lg border border-white/5 bg-navy-900/40 px-3.5 py-2.5">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Preview full description
              </summary>
              <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                {composeDescription()}
              </pre>
            </details>
          )}

          {/* A/B + schedule + publish */}
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-navy-900/50 px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <FlaskConical className="h-4 w-4 text-cyan-accent" /> A/B test variants
            </span>
            <Toggle checked={abTest} onChange={setAbTest} size="sm" label="A/B test" />
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Scheduled time</span>
            <DateTimePicker value={scheduleAt} onChange={setScheduleAt} />
          </div>

          {/* Optional alternative to uploading a file: a public video URL.
              Useful for large files that exceed the server's upload limit. */}
          {canUploadYouTube && !hasVideoFile && (
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">
                Video URL <span className="font-normal text-slate-500">(optional, instead of a file)</span>
              </span>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://… direct link to your video file"
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Upload a video above to publish it directly, or paste a public URL here for large
                files.
              </p>
            </div>
          )}

          <button
            onClick={publish}
            disabled={publishing}
            className="mt-auto flex items-center justify-center gap-2 rounded-lg gradient-cyan py-3 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-80"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {(() => {
              if (publishing) return willPublishNow ? 'Publishing…' : scheduleAt ? 'Scheduling…' : 'Adding…'
              if (willPublishNow) return `Publish to ${plat.name}`
              return scheduleAt ? `Schedule to ${plat.name}` : `Add ${plat.name} post`
            })()}
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
