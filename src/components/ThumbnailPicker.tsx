import { useEffect, useRef, useState } from 'react'
import { Film, ImagePlus, Loader2, Check, Clapperboard, Sparkles } from 'lucide-react'

interface ThumbnailPickerProps {
  /** Platform allows uploading a custom thumbnail image. */
  allowCustom: boolean
  /** Platform allows choosing a cover frame from the video. */
  allowFrames: boolean
  /** Short note about what this platform supports. */
  note?: string
  /**
   * Object URL of the video already uploaded in the Media section. When set, we
   * extract cover frames from it automatically so the user never uploads twice.
   */
  videoSrc?: string
  onSelect: (dataUrl: string) => void
}

/**
 * Pick a thumbnail by extracting frames from the uploaded video (drawn to a
 * canvas, fully client-side) or by uploading a custom image. When the parent
 * already has a video (videoSrc), frames are grabbed automatically on upload so
 * there is no second video upload. Which options show depends on the platform.
 */
export default function ThumbnailPicker({
  allowCustom,
  allowFrames,
  note,
  videoSrc,
  onSelect,
}: ThumbnailPickerProps) {
  // Legacy local video (only used when the parent has no video to share).
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null)
  const [frames, setFrames] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  // The video we draw frames from: the parent's upload takes priority.
  const effectiveSrc = videoSrc ?? localVideoUrl

  const seek = (v: HTMLVideoElement, t: number) =>
    new Promise<void>((res) => {
      const h = () => {
        v.removeEventListener('seeked', h)
        res()
      }
      v.addEventListener('seeked', h)
      v.currentTime = t
    })

  const extractFrames = async () => {
    const v = videoRef.current
    if (!v || !v.duration || !isFinite(v.duration)) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth || 640
      canvas.height = v.videoHeight || 360
      const ctx = canvas.getContext('2d')
      const out: string[] = []
      for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        await seek(v, p * v.duration)
        ctx?.drawImage(v, 0, 0, canvas.width, canvas.height)
        out.push(canvas.toDataURL('image/jpeg', 0.82))
      }
      setFrames(out)
    } finally {
      setBusy(false)
    }
  }

  // Auto-grab cover frames whenever the source video changes. This is the whole
  // point of the rework: the user uploads the video once and gets thumbnails.
  useEffect(() => {
    setFrames([])
    setSelected(null)
    if (!effectiveSrc || !allowFrames) return
    const v = videoRef.current
    if (!v) return
    const onReady = () => {
      if (v.duration && isFinite(v.duration)) extractFrames()
    }
    if (v.readyState >= 1 && v.duration && isFinite(v.duration)) {
      onReady()
    } else {
      v.addEventListener('loadedmetadata', onReady, { once: true })
      return () => v.removeEventListener('loadedmetadata', onReady)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSrc, allowFrames])

  const choose = (url: string) => {
    setSelected(url)
    onSelect(url)
  }

  const onLocalVideoChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setLocalVideoUrl(URL.createObjectURL(f))
    e.target.value = ''
  }
  const localVideoInput = useRef<HTMLInputElement>(null)

  const onCustomChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) choose(URL.createObjectURL(f))
    e.target.value = ''
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Choose thumbnail</span>
        {note && <span className="text-[11px] text-slate-500">{note}</span>}
      </div>

      {/* Hidden video used only to draw frames to a canvas. */}
      {effectiveSrc && allowFrames && (
        <video ref={videoRef} src={effectiveSrc} muted playsInline preload="metadata" className="hidden" />
      )}

      {/* Empty state: frames come from the Media video. If none yet, hint that. */}
      {allowFrames && !effectiveSrc && (
        <p className="rounded-lg border border-dashed border-white/10 bg-navy-900/40 px-3 py-2.5 text-[11px] text-slate-500">
          Upload a video above and cover frames appear here automatically.
        </p>
      )}

      {/* Extracting */}
      {busy && (
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-navy-900/40 px-3 py-2.5 text-xs text-slate-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-accent" /> Generating thumbnails from your video…
        </div>
      )}

      {/* frame grid (auto-generated cover options) */}
      {frames.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => choose(f)}
              title={`Frame ${i + 1}`}
              className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${
                selected === f ? 'border-cyan-accent' : 'border-transparent hover:border-white/20'
              }`}
            >
              <img src={f} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5 pt-2 text-left text-[9px] font-semibold text-white/90">
                Frame {i + 1}
              </span>
              {selected === f && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full gradient-cyan text-navy-900">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* actions row */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Re-grab frames (the auto pass already ran, but allow a manual retry). */}
        {allowFrames && effectiveSrc && (
          <button
            onClick={extractFrames}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white disabled:opacity-60"
          >
            <Clapperboard className="h-4 w-4 text-cyan-accent" /> Regenerate frames
          </button>
        )}
        {/* Fallback: if the parent has no video, let them pick one here too. */}
        {allowFrames && !effectiveSrc && (
          <button
            onClick={() => localVideoInput.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white"
          >
            <Film className="h-4 w-4 text-cyan-accent" /> Upload video for frames
          </button>
        )}
        {allowCustom && (
          <button
            onClick={() => imageInput.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white"
          >
            <ImagePlus className="h-4 w-4 text-cyan-accent" /> Upload custom
          </button>
        )}
        {/* AI thumbnail generation is on the roadmap; the slot is here already. */}
        <button
          disabled
          title="AI thumbnail generation is coming soon"
          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-cyan-accent/25 bg-cyan-accent/5 px-3 py-2 text-sm font-medium text-cyan-accent/70"
        >
          <Sparkles className="h-4 w-4" /> Generate AI thumbnail
          <span className="rounded-full bg-white/5 px-1.5 text-[10px] font-semibold text-slate-400">Soon</span>
        </button>
        <input ref={localVideoInput} type="file" accept="video/*" className="hidden" onChange={onLocalVideoChosen} />
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={onCustomChosen} />
      </div>

      {/* selected custom (no frames) preview */}
      {selected && frames.length === 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border-2 border-cyan-accent">
          <img src={selected} alt="Selected thumbnail" className="max-h-40 w-full object-cover" />
        </div>
      )}
    </div>
  )
}
