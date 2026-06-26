import { useEffect, useRef, useState } from 'react'
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
  Repeat,
  Megaphone,
  Link2,
  Copy,
  Clock,
  Gauge,
  AlertTriangle,
  Star,
} from 'lucide-react'
import Toggle from './Toggle'
import ThumbnailPicker from './ThumbnailPicker'
import DateTimePicker from './DateTimePicker'
import PublishResultModal from './PublishResultModal'
import TikTokPostModal, { type TikTokPostSettings } from './TikTokPostModal'
import { useToast } from './Toast'
import { useNotifications } from './Notifications'
import { useConnections } from './Connections'
import { useCampaigns } from './Campaigns'
import { usePersistedState } from '../lib/usePersisted'
import { backendEnabled, publishYouTubeVideo, publishYouTubeFile, publishPost, publishMedia, schedulePost } from '../lib/socialApi'
import { aiTitles, aiCaptions, aiHashtags, aiAnalyze, aiStatus, type Suggestion } from '../lib/aiSuggest'
import { createShortLink, displayShort, normalizeUrl, type ShortLink } from '../lib/shortLinks'
import { reportError } from '../lib/reportError'
import { PLATFORM_LIST, PLATFORMS, isComingSoon } from '../data'
import TikTokSandboxNotice from './TikTokSandboxNotice'
import type { CalendarPost, PlatformId } from '../types'

interface MediaStudioViewProps {
  /** Add a scheduled post to the shared calendar. */
  onSchedule: (post: Omit<CalendarPost, 'id'>) => void
  /** Called after a successful schedule (e.g. to jump to the calendar). */
  onScheduled: () => void
}

/** Per-platform thumbnail capabilities. */
const THUMB_CAPS: Record<string, { custom: boolean; frame: boolean; note: string }> = {
  youtube: { custom: true, frame: true, note: 'Auto-generated from your video, or upload a custom one.' },
  reels: { custom: true, frame: true, note: 'Pick a cover frame or upload a custom cover.' },
  instagram: { custom: false, frame: true, note: 'Instagram uses a cover frame from the video.' },
  tiktok: { custom: false, frame: true, note: 'TikTok uses a cover frame from the video.' },
  facebook: { custom: true, frame: true, note: 'Auto-generated from your video, or upload a custom one.' },
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

interface RecurringSlot {
  weekday: number // 0 = Sunday
  time: string // "HH:MM"
}

interface MediaMeta {
  duration?: number
  width?: number
  height?: number
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Next date/time matching a weekly slot (e.g. next Friday 20:00). */
function nextWeeklyOccurrence({ weekday, time }: RecurringSlot): Date {
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  let add = (weekday - now.getDay() + 7) % 7
  if (add === 0 && d.getTime() <= now.getTime()) add = 7 // today's slot passed -> next week
  d.setDate(d.getDate() + add)
  return d
}

/** The "best time" suggestion: next Tuesday at 9:15 AM (your best click window). */
function nextBestTime(): Date {
  const now = new Date()
  const d = new Date()
  d.setHours(9, 15, 0, 0)
  let add = (2 - now.getDay() + 7) % 7 // 2 = Tuesday
  if (add === 0 && d.getTime() <= now.getTime()) add = 7
  d.setDate(d.getDate() + add)
  return d
}

/** Format a video duration as m:ss. */
function fmtDuration(sec?: number): string {
  if (!sec || !isFinite(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Friendly resolution label (1080p, 4K, …) from a pixel height. */
function fmtResolution(meta: MediaMeta): string {
  const h = meta.height || 0
  if (!h) return '—'
  if (h >= 2160) return '4K'
  if (h >= 1440) return '1440p'
  if (h >= 1080) return '1080p'
  if (h >= 720) return '720p'
  return `${h}p`
}

/** One-click title variations (instant, local). Keeps "no typing" snappy. */
function rewriteTitle(t: string, style: 'better' | 'shorter' | 'clicks' | 'seo'): string {
  const base = t.trim()
  if (!base) return base
  const titleCase = base.replace(/\b\w/g, (c) => c.toUpperCase())
  switch (style) {
    case 'shorter':
      return base.split(/\s+/).slice(0, 6).join(' ')
    case 'better':
      return titleCase
    case 'clicks':
      return `${titleCase}: What Nobody Tells You`
    case 'seo':
      return `${titleCase} (2026 Guide)`
  }
}

/** Content categories that ground the AI so titles match the video. */
const CONTENT_CATEGORIES = [
  'Tutorial',
  'Product review',
  'Ambient / sleep / meditation',
  'Gaming',
  'Podcast',
  'Educational',
  'Short-form entertainment',
  'Business / marketing',
  'Music / visualizer',
  'Other',
]

const REWRITES: { key: 'better' | 'shorter' | 'clicks' | 'seo'; label: string }[] = [
  { key: 'better', label: 'Better' },
  { key: 'shorter', label: 'Shorter' },
  { key: 'clicks', label: 'More clicks' },
  { key: 'seo', label: 'SEO' },
]

export default function MediaStudioView({ onSchedule, onScheduled }: MediaStudioViewProps) {
  const { addToast } = useToast()
  const { push } = useNotifications()
  const { accounts } = useConnections()
  const { campaigns } = useCampaigns()
  const [platform, setPlatform] = useState<PlatformId>('youtube')
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | undefined>()
  const [mediaMeta, setMediaMeta] = useState<MediaMeta>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const [thumbnail, setThumbnail] = useState<string | undefined>()
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [abTest, setAbTest] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [published, setPublished] = useState<{ platform: PlatformId; url?: string; note: string } | null>(null)
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null)
  const [tiktokOpen, setTiktokOpen] = useState(false)
  const [chapters, setChapters] = useState<Chapter[]>([{ time: '0:00', label: 'Intro' }])
  const [videoUrl, setVideoUrl] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')
  // Campaign + automatic tracked link.
  const [campaign, setCampaign] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [trackedLink, setTrackedLink] = useState<ShortLink | null>(null)
  const [creatingLink, setCreatingLink] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  // Cover frames lifted from ThumbnailPicker (used for vision + auto-select).
  const [frames, setFrames] = useState<string[]>([])
  // Content category the user picks to ground the AI (empty = let AI infer).
  const [category, setCategory] = useState('')
  // Whether the server has a real Claude AI backend (vs offline samples).
  const [aiOn, setAiOn] = useState<boolean | null>(null)
  // Persisted weekly upload slot (e.g. "every Friday 8 PM").
  const [recurring, setRecurring] = usePersistedState<RecurringSlot | null>('sl_recurring_slot', null)

  // Per-platform default description (boilerplate: links, socials) that persists.
  const [defaults, setDefaults] = usePersistedState<Partial<Record<PlatformId, string>>>(
    'sl_default_descriptions',
    {},
  )
  const defaultDescription = defaults[platform] || ''
  const setDefaultDescription = (text: string) =>
    setDefaults((d) => ({ ...d, [platform]: text }))

  // Ask the server once whether a real AI backend is configured, so we can show
  // an honest indicator instead of silently using offline samples.
  useEffect(() => {
    let alive = true
    aiStatus().then((s) => alive && setAiOn(s.enabled))
    return () => {
      alive = false
    }
  }, [])

  const supportsTimestamps = Boolean(TIMESTAMP_PLATFORMS[platform])
  const ytConnected = Boolean(accounts.youtube?.connected)
  const connected = Boolean(accounts[platform]?.connected)
  const canUploadYouTube = platform === 'youtube' && backendEnabled && ytConnected
  const hasVideoFile = Boolean(mediaFile && mediaFile.type.startsWith('video/'))
  // Large uploads (10-20 min videos) need a heads-up: they take longer and the
  // tab must stay open while the bytes upload. 250 MB is the warning threshold.
  const largeFile = Boolean(mediaFile && mediaFile.size > 250 * 1024 * 1024)

  // Clear the per-post fields for a fresh post (keeps the saved default description).
  const resetComposer = () => {
    setTitle('')
    setCaption('')
    setTags([])
    setTagInput('')
    setMediaFile(null)
    setMediaPreview(undefined)
    setMediaMeta({})
    setThumbnail(undefined)
    setFrames([])
    setVideoUrl('')
    setChapters([{ time: '0:00', label: 'Intro' }])
    setScheduleAt(null)
    setCampaign('')
    setDestinationUrl('')
    setTrackedLink(null)
    setCategory('')
  }

  const openFilePicker = () => fileRef.current?.click()
  const removeMedia = () => {
    setMediaFile(null)
    setMediaPreview(undefined)
    setMediaMeta({})
    setThumbnail(undefined)
    setFrames([])
  }
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
    setMediaMeta({})
    setThumbnail(undefined)
    // Read duration + resolution off a throwaway video element.
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      const url = URL.createObjectURL(file)
      v.onloadedmetadata = () => {
        setMediaMeta({ duration: v.duration, width: v.videoWidth, height: v.videoHeight })
        URL.revokeObjectURL(url)
      }
      v.src = url
    }
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

  /**
   * Fill Title + Description + Hashtags in one click, and push the publishing
   * score as high as possible. When we have cover frames, Claude's vision model
   * analyzes the actual video so the copy is about THIS video, not a template.
   */
  const generateEverything = async () => {
    setGeneratingAll(true)
    try {
      // Vision path: analyze the real frames (only when frames + real AI exist).
      const analysis = frames.length
        ? await aiAnalyze(frames, {
            platform,
            topic: title,
            category,
            filename: mediaFile?.name,
            durationSec: mediaMeta.duration,
          })
        : null
      if (analysis && (analysis.titles.length || analysis.description || analysis.hashtags.length)) {
        if (analysis.titles[0]) setTitle(analysis.titles[0])
        if (analysis.description) setCaption(analysis.description)
        if (analysis.hashtags.length)
          setTags((prev) => Array.from(new Set([...prev, ...analysis.hashtags.slice(0, 6)])))
        setTitleSugs(analysis.titles.map((text, i) => ({ text, trend: Math.max(60, 96 - i * 4) })))
        setTagSugs(analysis.hashtags.map((text, i) => ({ text, trend: Math.max(60, 94 - i * 3) })))
        // Auto-pick a cover so the thumbnail box of the score is covered too.
        if (!thumbnail && frames[0]) setThumbnail(frames[0])
        addToast('AI analyzed your video and filled everything ✨')
        return
      }
      // Text path: no frames (or AI off) - generate from the topic.
      const [t, c, h] = await Promise.all([aiTitles(title), aiCaptions(title), aiHashtags(title)])
      if (t[0]) setTitle(t[0].text)
      if (c[0]) setCaption(c[0].text)
      if (h.length) setTags((prev) => Array.from(new Set([...prev, ...h.slice(0, 6).map((s) => s.text)])))
      setTitleSugs(t)
      setCaptionSugs(c)
      setTagSugs(h)
      if (!thumbnail && frames[0]) setThumbnail(frames[0])
      addToast(
        frames.length
          ? 'AI filled your title, description, and hashtags ✨'
          : 'AI filled your fields. Upload a video so AI can tailor them to it ✨',
      )
    } finally {
      setGeneratingAll(false)
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

  // Chapter helpers.
  const setChapter = (i: number, patch: Partial<Chapter>) =>
    setChapters((c) => c.map((ch, idx) => (idx === i ? { ...ch, ...patch } : ch)))
  const addChapter = () => setChapters((c) => [...c, { time: '', label: '' }])
  const removeChapter = (i: number) => setChapters((c) => c.filter((_, idx) => idx !== i))

  /** Create a tracked short link from the destination URL (auto-attributed). */
  const createTrackedLink = async () => {
    const url = normalizeUrl(destinationUrl)
    if (!url) return
    setCreatingLink(true)
    try {
      const link = await createShortLink(url, {
        campaign: campaign || undefined,
        platform,
        sourcePost: title.trim() || undefined,
        utmSource: platform,
        utmMedium: 'social',
        utmCampaign: campaign ? campaign.toLowerCase().replace(/[^a-z0-9]+/g, '_') : undefined,
      })
      setTrackedLink(link)
      addToast('Tracked link created automatically 🔗')
    } catch {
      addToast('Could not create a tracked link right now', 'info')
    } finally {
      setCreatingLink(false)
    }
  }

  const copyTracked = () => {
    if (!trackedLink) return
    navigator.clipboard?.writeText(trackedLink.shortUrl).then(
      () => addToast('Tracked link copied'),
      () => undefined,
    )
  }

  /** Assemble the full description: caption + chapters + tags + tracked link + default. */
  const composeDescription = () => {
    const blocks: string[] = []
    if (caption.trim()) blocks.push(caption.trim())
    if (supportsTimestamps) {
      const lines = chapters
        .filter((c) => c.time.trim() && c.label.trim())
        .map((c) => `${c.time.trim()} ${c.label.trim()}`)
      if (lines.length) blocks.push(['Chapters:', ...lines].join('\n'))
    }
    if (trackedLink) blocks.push(trackedLink.shortUrl)
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
      campaign: campaign || undefined,
      destinationUrl: destinationUrl.trim() || undefined,
      trackClicks: Boolean(trackedLink),
    }
  }

  // Instagram posts from a public media URL (its API can't take raw bytes), so
  // it reuses the URL field. TikTok uploads the picked video file.
  const showMediaUrlField =
    (canUploadYouTube && !hasVideoFile) ||
    (platform === 'instagram' && backendEnabled && connected) ||
    (platform === 'tiktok' && Boolean(scheduleAt) && backendEnabled && connected)

  // What's ready to post on the selected platform.
  const ytReady = platform === 'youtube' && (hasVideoFile || Boolean(videoUrl.trim()))
  const fbReady = platform === 'facebook'
  const tkReady = platform === 'tiktok' && hasVideoFile
  const igReady = platform === 'instagram' && Boolean(videoUrl.trim())

  // Native scheduling (future time) is only supported by YouTube (publishAt) and
  // Facebook (scheduled_publish_time). Everything else can only publish now.
  // IG/TikTok have no native scheduling, so they're queued for the cron worker
  // and need a public media URL (entered in the Media URL field).
  const queueScheduleReady = (platform === 'instagram' || platform === 'tiktok') && Boolean(videoUrl.trim())
  const nativeScheduleCapable = platform === 'youtube' || platform === 'facebook'
  const canPublishNow = backendEnabled && connected && (ytReady || fbReady || tkReady || igReady)
  const canSchedule = backendEnabled && connected && (ytReady || fbReady || queueScheduleReady)
  const willActReal = scheduleAt ? canSchedule : canPublishNow

  const fmtWhen = (d: Date) =>
    d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  // Describe the privacy YouTube actually applied (it may force private on
  // unverified apps regardless of the chosen visibility).
  const youtubePrivacyNote = (actual?: string) => {
    if (actual === 'public') return 'Live on YouTube now.'
    if (actual === 'unlisted') return 'Uploaded as unlisted. Anyone with the link can watch.'
    if (privacy === 'private') return 'Uploaded as a private video.'
    return `You chose ${privacy}, but YouTube keeps uploads private until your Google app is verified for public posting.`
  }

  // Surface a clear success modal (and keep a bell entry as a record).
  const showPublished = (url: string | undefined, note: string) => {
    setPublished({ platform, url, note })
    if (url) {
      push({ type: 'success', title: `Published to ${plat.name}`, message: 'View the post', detail: url })
    }
  }

  // TikTok requires the creator to confirm the post (privacy + interaction
  // settings) before it goes to the Content Posting API. For an immediate
  // TikTok post we open that confirmation modal and finish in publishTikTok().
  const publishTikTok = async (settings: TikTokPostSettings) => {
    if (!mediaFile) return
    setTiktokOpen(false)
    setPublishing(true)
    try {
      const result = await publishMedia('tiktok', mediaFile, {
        title: title.trim() || caption.trim(),
        privacyLevel: settings.privacyLevel,
        disableComment: settings.disableComment,
        disableDuet: settings.disableDuet,
        disableStitch: settings.disableStitch,
      })
      showPublished(
        result.url,
        settings.privacyLevel === 'SELF_ONLY'
          ? 'Posted to TikTok as private. Only you can see it.'
          : 'Posted to your TikTok.',
      )
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      addToast('Could not publish. See the bell for details.', 'info', 6000)
      reportError(`media-studio:publish:${platform}`, detail, platform)
      push({ type: 'error', title: 'Publish failed', message: 'Tap to see the full reason', detail })
    } finally {
      setPublishing(false)
    }
  }

  const publish = async () => {
    if (!title.trim() && !caption.trim()) {
      addToast('Add a title or caption first', 'info')
      return
    }
    // Auto-create the tracked link if a destination was entered but not yet made.
    if (destinationUrl.trim() && !trackedLink) await createTrackedLink()
    // Immediate TikTok post: confirm privacy + interaction settings first.
    if (willActReal && platform === 'tiktok' && !scheduleAt && mediaFile) {
      setTiktokOpen(true)
      return
    }
    setPublishing(true)
    const publishAt = scheduleAt ? scheduleAt.toISOString() : undefined
    const fbScheduleSec = scheduleAt ? Math.floor(scheduleAt.getTime() / 1000) : undefined
    try {
      if (willActReal && scheduleAt && (platform === 'instagram' || platform === 'tiktok')) {
        // No native scheduling - queue it for the cron worker (publishes from URL).
        const cap = [title.trim(), composeDescription()].filter(Boolean).join('\n\n')
        await schedulePost({
          platform,
          caption: cap,
          mediaUrl: videoUrl.trim(),
          publishAt: scheduleAt.getTime(),
        })
        showPublished(
          videoUrl.trim(),
          `Scheduled on ${plat.name} for ${fmtWhen(scheduleAt)}. We'll publish it automatically.`,
        )
      } else if (willActReal && platform === 'youtube') {
        if (hasVideoFile && mediaFile) {
          setUploadPct(0)
          const result = await publishYouTubeFile(
            mediaFile,
            { title: title.trim() || 'Untitled', description: composeDescription(), tags, privacyStatus: privacy, publishAt },
            (f) => setUploadPct(f),
          )
          showPublished(
            result.url,
            scheduleAt
              ? `Uploaded privately. YouTube will make it public on ${fmtWhen(scheduleAt)}.`
              : youtubePrivacyNote(result.privacyStatus),
          )
        } else {
          const result = await publishYouTubeVideo({
            videoUrl: videoUrl.trim(),
            title: title.trim() || 'Untitled',
            description: composeDescription(),
            tags,
            privacyStatus: privacy,
            publishAt,
          })
          const r = result as { id?: string; status?: { privacyStatus?: string } }
          const watchUrl = r.id ? `https://www.youtube.com/watch?v=${r.id}` : undefined
          showPublished(
            watchUrl,
            scheduleAt
              ? `Uploaded privately. YouTube will make it public on ${fmtWhen(scheduleAt)}.`
              : youtubePrivacyNote(r.status?.privacyStatus),
          )
          setVideoUrl('')
        }
      } else if (willActReal && platform === 'facebook') {
        const message = [title.trim(), composeDescription()].filter(Boolean).join('\n\n')
        const result = mediaFile
          ? await publishMedia('facebook', mediaFile, { message, scheduledPublishTime: fbScheduleSec })
          : await publishPost('facebook', { text: message, scheduledPublishTime: fbScheduleSec })
        showPublished(
          result.url,
          scheduleAt ? `Scheduled on Facebook for ${fmtWhen(scheduleAt)}.` : 'Posted to your Facebook Page.',
        )
      } else if (willActReal && platform === 'instagram') {
        const igCaption = [title.trim(), composeDescription()].filter(Boolean).join('\n\n')
        const result = await publishPost('instagram', { mediaUrl: videoUrl.trim(), caption: igCaption })
        showPublished(result.url, 'Posted to your Instagram.')
      } else {
        // No real publish path here (platform can't schedule natively, or not
        // connected): keep it as a calendar plan.
        onSchedule(buildPost())
        addToast(`Added to your calendar (${plat.name}, ${scheduleAt ? fmtWhen(scheduleAt) : 'now'}) 🗓️`)
        onScheduled()
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      addToast('Could not publish. See the bell for details.', 'info', 6000)
      reportError(`media-studio:publish:${platform}`, detail, platform)
      push({ type: 'error', title: 'Publish failed', message: 'Tap to see the full reason', detail })
    } finally {
      setPublishing(false)
      setUploadPct(0)
    }
  }

  /* ---------------------- live publishing checklist + score ---------------- */
  const descLen = composeDescription().length
  const thumbnailRelevant = caps.frame || caps.custom
  const checklist = [
    { label: 'Media uploaded', done: Boolean(mediaFile || videoUrl.trim()), weight: 20, hint: 'Add a video or image' },
    {
      label: 'Thumbnail selected',
      done: !thumbnailRelevant || Boolean(thumbnail),
      weight: 15,
      hint: 'Pick a cover frame or upload one',
    },
    { label: 'Title written', done: title.trim().length >= 10, weight: 15, hint: 'Aim for 10+ characters' },
    { label: 'Description (100+ chars)', done: descLen >= 100, weight: 15, hint: 'Add more detail and a CTA' },
    { label: '3+ hashtags', done: tags.length >= 3, weight: 10, hint: 'Add a few relevant hashtags' },
    { label: 'Campaign selected', done: Boolean(campaign), weight: 10, hint: 'Group this post into a campaign' },
    { label: 'Tracked link', done: Boolean(trackedLink), weight: 10, hint: 'Add a destination URL to track clicks' },
    { label: 'Scheduled time', done: Boolean(scheduleAt), weight: 5, hint: 'Pick a publish time or best time' },
  ]
  const score = checklist.reduce((s, c) => s + (c.done ? c.weight : 0), 0)
  const reach = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-cyan-accent' : 'text-amber-400'

  const bestTime = nextBestTime()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Media Studio</h1>
        {aiOn === false ? (
          <span
            title="Set ANTHROPIC_API_KEY on the server to enable real AI. Until then, suggestions use offline samples."
            className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" /> AI offline (samples)
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
            <Sparkles className="h-3.5 w-3.5" /> {aiOn ? 'AI ready' : 'AI assisted'}
          </span>
        )}
      </div>

      {/* platform selector */}
      <div className="card p-4">
        <span className="mb-2 block text-sm font-semibold text-white">Publishing to</span>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_LIST.map((p) => {
            const { Icon } = p
            const on = platform === p.id
            const soon = isComingSoon(p.id)
            return (
              <button
                key={p.id}
                onClick={() => !soon && setPlatform(p.id)}
                disabled={soon}
                title={soon ? `${p.name} (coming soon)` : p.name}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  on
                    ? `border-transparent bg-gradient-to-r ${p.gradient} text-white shadow-md`
                    : soon
                      ? 'cursor-not-allowed border-white/5 bg-navy-900/40 text-slate-600'
                      : 'border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {p.name}
                {soon && <span className="rounded-full bg-white/5 px-1.5 text-[10px] font-semibold text-slate-400">Soon</span>}
              </button>
            )
          })}
        </div>
        {platform === 'tiktok' && <TikTokSandboxNotice className="mt-3" />}
      </div>

      {/* campaign + automatic tracked link (the attribution backbone) */}
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <Megaphone className="h-4 w-4 text-cyan-accent" /> Campaign
          </span>
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          >
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {campaigns.length
              ? 'Everything you create here is tracked under this campaign.'
              : 'No campaigns yet. Create one on the Campaigns page to group posts.'}
          </p>
        </div>
        <div>
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <Link2 className="h-4 w-4 text-cyan-accent" /> Destination URL
          </span>
          <div className="flex gap-2">
            <input
              value={destinationUrl}
              onChange={(e) => {
                setDestinationUrl(e.target.value)
                setTrackedLink(null)
              }}
              onBlur={() => destinationUrl.trim() && !trackedLink && createTrackedLink()}
              placeholder="https://yoursite.com/landing"
              className="min-w-0 flex-1 rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
            <button
              onClick={createTrackedLink}
              disabled={!destinationUrl.trim() || creatingLink}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-accent/30 px-3 py-2 text-xs font-semibold text-cyan-accent transition-colors hover:bg-cyan-accent/10 disabled:opacity-50"
            >
              {creatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Track
            </button>
          </div>
          {trackedLink ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="truncate font-medium text-emerald-300">{displayShort(trackedLink.shortUrl)}</span>
              <span className="shrink-0 text-[10px] text-slate-500">Auto generated</span>
              <button onClick={copyTracked} className="ml-auto shrink-0 text-slate-400 hover:text-white" title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Add a link and we create a trackable short link automatically.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
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

            {mediaPreview ? (
              /* Preview card: instantly confirms the uploaded file. */
              <div className="overflow-hidden rounded-xl border border-white/10 bg-navy-900/50">
                {mediaMode === 'image' ? (
                  <img src={mediaPreview} alt="Post" className="aspect-video w-full object-contain" />
                ) : (
                  <video src={mediaPreview} controls playsInline className="aspect-video w-full bg-black object-contain" />
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 px-3 py-2 text-[11px] text-slate-400">
                  {hasVideoFile && (
                    <>
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="h-3 w-3" /> {fmtDuration(mediaMeta.duration)}
                      </span>
                      <span>{fmtResolution(mediaMeta)}</span>
                    </>
                  )}
                  {mediaFile && <span>{(mediaFile.size / 1_000_000).toFixed(1)} MB</span>}
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={openFilePicker} className="font-semibold text-cyan-accent hover:underline">
                      Replace
                    </button>
                    <button onClick={removeMedia} className="font-semibold text-slate-400 hover:text-rose-300">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={openFilePicker}
                className="grid aspect-video w-full place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-navy-900/50 text-slate-400 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
              >
                <span className="flex flex-col items-center gap-2">
                  <UploadCloud className="h-7 w-7" />
                  <span className="text-xs font-medium">
                    Upload {mediaMode === 'video' ? 'a video' : 'an image'}
                  </span>
                </span>
              </button>
            )}
            {mediaFile && <p className="mt-2 truncate text-[11px] text-slate-500">{mediaFile.name}</p>}
            {largeFile && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Large video detected ({(mediaFile!.size / 1_000_000).toFixed(0)} MB). It uploads directly and
                  securely to {plat.name}; keep this tab open until it finishes. Progress is shown on the publish
                  button, and your title and description are kept if anything fails.
                </span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={mediaMode === 'video' ? 'video/*' : 'image/*'}
              className="hidden"
              onChange={onPickFile}
            />
          </div>

          {/* thumbnail: frames auto-generated from the video uploaded above */}
          <ThumbnailPicker
            allowCustom={caps.custom}
            allowFrames={caps.frame && mediaMode === 'video'}
            note={caps.note}
            videoSrc={hasVideoFile ? mediaPreview : undefined}
            selected={thumbnail}
            onFrames={setFrames}
            onRequestVideo={() => {
              setMediaMode('video')
              openFilePicker()
            }}
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

        {/* MIDDLE: AI title, caption, hashtags + schedule + publish */}
        <section className="card flex flex-col gap-5 p-5">
          {/* Generate Everything */}
          <button
            onClick={generateEverything}
            disabled={generatingAll}
            className="flex items-center justify-center gap-2 rounded-lg border border-cyan-accent/30 bg-cyan-accent/5 py-2.5 text-sm font-bold text-cyan-accent transition-colors hover:bg-cyan-accent/10 disabled:opacity-60"
          >
            {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generatingAll
              ? frames.length
                ? 'Analyzing your video…'
                : 'Generating…'
              : frames.length
                ? 'Generate everything from video'
                : 'Generate everything'}
          </button>

          {/* Content category - grounds the AI so titles match the video */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">
              What kind of video is this? <span className="font-normal text-slate-500">(helps AI)</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            >
              <option value="">Let AI figure it out</option>
              {CONTENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {frames.length > 0 && !category && !title.trim() && (
              <p className="mt-1.5 text-[11px] text-amber-300/80">
                Tip: pick a category or type a topic so AI describes this video accurately instead of guessing.
              </p>
            )}
          </div>

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
            {/* One-click rewrite variations */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REWRITES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setTitle((t) => rewriteTitle(t, r.key))}
                  disabled={!title.trim()}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-navy-900/60 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-accent/30 hover:text-white disabled:opacity-40"
                >
                  <Wand2 className="h-3 w-3 text-cyan-accent" /> {r.label}
                </button>
              ))}
            </div>
            <Suggestions items={titleSugs} onPick={(s) => setTitle(s)} />
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

          {/* Default description that persists per platform */}
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

          {/* A/B test */}
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-navy-900/50 px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <FlaskConical className="h-4 w-4 text-cyan-accent" /> A/B test variants
            </span>
            <Toggle checked={abTest} onChange={setAbTest} size="sm" label="A/B test" />
          </div>

          {platform === 'youtube' && (
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">Visibility</span>
              <div className="flex rounded-lg border border-white/5 bg-navy-900/60 p-0.5 text-xs">
                {(['public', 'unlisted', 'private'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setPrivacy(v)}
                    className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
                      privacy === v ? 'gradient-cyan text-navy-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                New uploads stay private until your Google app is verified, then this setting applies.
              </p>
            </div>
          )}

          {/* Best time suggestion (ties into Growth Coach windows) */}
          <button
            onClick={() => setScheduleAt(bestTime)}
            className="flex items-center justify-between rounded-lg border border-cyan-accent/20 bg-cyan-accent/5 px-3.5 py-2.5 text-left transition-colors hover:bg-cyan-accent/10"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Star className="h-4 w-4 text-cyan-accent" />
              Best time
              <span className="text-xs text-slate-400">{fmtWhen(bestTime)}</span>
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              +18% est.
            </span>
          </button>

          {/* Recurring weekly slot - e.g. "every Friday 8 PM". */}
          <div className="rounded-lg border border-white/5 bg-navy-900/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Repeat className="h-4 w-4 text-cyan-accent" /> Recurring slot
              </span>
              <Toggle
                checked={Boolean(recurring)}
                onChange={(v) => setRecurring(v ? { weekday: 5, time: '20:00' } : null)}
                size="sm"
                label="Recurring slot"
              />
            </div>
            {recurring && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Every</span>
                  <select
                    value={recurring.weekday}
                    onChange={(e) => setRecurring({ ...recurring, weekday: Number(e.target.value) })}
                    className="rounded-lg border border-white/5 bg-navy-900/60 px-2.5 py-1.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                  >
                    {WEEK_DAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">at</span>
                  <input
                    type="time"
                    value={recurring.time}
                    onChange={(e) => setRecurring({ ...recurring, time: e.target.value })}
                    className="rounded-lg border border-white/5 bg-navy-900/60 px-2.5 py-1.5 text-sm text-slate-200 [color-scheme:dark] focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                  />
                </div>
                <button
                  onClick={() => setScheduleAt(nextWeeklyOccurrence(recurring))}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-accent/30 px-3 py-2 text-sm font-semibold text-cyan-accent transition-colors hover:bg-cyan-accent/10"
                >
                  <Repeat className="h-4 w-4" />
                  Use next slot ({fmtWhen(nextWeeklyOccurrence(recurring))})
                </button>
              </>
            )}
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Scheduled time</span>
            <DateTimePicker value={scheduleAt} onChange={setScheduleAt} />
            {scheduleAt && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                {!connected
                  ? `Connect ${plat.name} to publish automatically. For now this is saved to your calendar.`
                  : nativeScheduleCapable
                    ? platform === 'facebook'
                      ? 'Facebook publishes this automatically (schedule at least 10 minutes out).'
                      : 'Uploaded now as private; YouTube makes it public at this time.'
                    : queueScheduleReady
                      ? `We'll publish this to ${plat.name} automatically at the scheduled time.`
                      : `Add a public media URL above to schedule this on ${plat.name}.`}
              </p>
            )}
          </div>

          {/* Media URL: YouTube can use it instead of a file; Instagram requires it. */}
          {showMediaUrlField && (
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">
                {platform === 'youtube' ? 'Video URL' : 'Media URL'}{' '}
                <span className="font-normal text-slate-500">
                  {platform === 'youtube' ? '(optional, instead of a file)' : '(public image or video)'}
                </span>
              </span>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://… public link to your media"
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                {platform === 'youtube'
                  ? 'Upload a video above to publish it directly, or paste a public URL for large files.'
                  : platform === 'tiktok'
                    ? 'TikTok scheduling pulls from a public URL, so host your video and paste the link.'
                    : 'Instagram publishes from a public URL, so host your photo/video and paste the link.'}
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
              if (publishing) {
                if (willActReal) {
                  if (scheduleAt) return 'Scheduling…'
                  return uploadPct > 0 && uploadPct < 1
                    ? `Uploading… ${Math.round(uploadPct * 100)}%`
                    : 'Publishing…'
                }
                return 'Adding…'
              }
              if (willActReal) return scheduleAt ? `Schedule on ${plat.name}` : `Publish to ${plat.name}`
              return scheduleAt ? 'Add to calendar' : `Add ${plat.name} post`
            })()}
          </button>
        </section>

        {/* RIGHT: live publishing score + checklist */}
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-accent" />
              <span className="text-sm font-semibold text-white">Publishing score</span>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className={`text-4xl font-extrabold tabular-nums ${scoreColor}`}>{score}</span>
              <span className="pb-1 text-sm text-slate-500">/ 100</span>
              <span className="ml-auto pb-1 text-right">
                <span className="block text-[11px] text-slate-500">Estimated reach</span>
                <span className={`text-sm font-bold ${scoreColor}`}>{reach}</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-900/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-accent to-emerald-400 transition-all"
                style={{ width: `${score}%` }}
              />
            </div>

            <ul className="mt-4 space-y-2">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  {c.done ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <span className="flex-1">
                    <span className={c.done ? 'text-slate-300' : 'text-slate-200'}>{c.label}</span>
                    {!c.done && <span className="block text-[11px] text-slate-500">{c.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 border-t border-white/5 pt-3 text-[11px] text-slate-500">
              Your score updates live as you prepare the post. Higher scores tend to reach more people.
            </p>
          </div>
        </aside>
      </div>

      {tiktokOpen && (
        <TikTokPostModal
          videoPreview={mediaPreview}
          caption={title.trim() || caption.trim()}
          onConfirm={publishTikTok}
          onClose={() => setTiktokOpen(false)}
        />
      )}

      {published && (
        <PublishResultModal
          platform={published.platform}
          url={published.url}
          note={published.note}
          onClose={() => setPublished(null)}
          onNewPost={() => {
            setPublished(null)
            resetComposer()
          }}
        />
      )}
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
