import { useRef, useState } from 'react'
import { Film, ImagePlus, Loader2, Check, Clapperboard } from 'lucide-react'

interface ThumbnailPickerProps {
  /** Platform allows uploading a custom thumbnail image. */
  allowCustom: boolean
  /** Platform allows choosing a cover frame from the video. */
  allowFrames: boolean
  /** Short note about what this platform supports. */
  note?: string
  onSelect: (dataUrl: string) => void
}

/**
 * Pick a thumbnail by extracting frames from an uploaded video (drawn to a
 * canvas, fully client-side) or by uploading a custom image. Which options
 * show depends on the platform's capabilities.
 */
export default function ThumbnailPicker({ allowCustom, allowFrames, note, onSelect }: ThumbnailPickerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [frames, setFrames] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  const onVideoChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setVideoUrl(URL.createObjectURL(f))
    setFrames([])
    setSelected(null)
    e.target.value = ''
  }

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

  const choose = (url: string) => {
    setSelected(url)
    onSelect(url)
  }

  const onCustomChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) choose(URL.createObjectURL(f))
    e.target.value = ''
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Thumbnail</span>
        {note && <span className="text-[11px] text-slate-500">{note}</span>}
      </div>

      {/* source buttons */}
      <div className="flex flex-wrap gap-2">
        {allowFrames && (
          <button
            onClick={() => videoInput.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white"
          >
            <Film className="h-4 w-4 text-cyan-accent" /> {videoUrl ? 'Replace video' : 'Upload video'}
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
        <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={onVideoChosen} />
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={onCustomChosen} />
      </div>

      {/* video + extract */}
      {videoUrl && allowFrames && (
        <div className="mt-3 space-y-3">
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            className="max-h-40 w-full rounded-lg border border-white/10 bg-black object-contain"
          />
          <button
            onClick={extractFrames}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg gradient-cyan px-3.5 py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02] disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
            {busy ? 'Grabbing frames…' : 'Pick from frames'}
          </button>
        </div>
      )}

      {/* frame grid */}
      {frames.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => choose(f)}
              className={`relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${
                selected === f ? 'border-cyan-accent' : 'border-transparent hover:border-white/20'
              }`}
            >
              <img src={f} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
              {selected === f && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full gradient-cyan text-navy-900">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* selected custom (no frames) preview */}
      {selected && frames.length === 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border-2 border-cyan-accent">
          <img src={selected} alt="Selected thumbnail" className="max-h-40 w-full object-cover" />
        </div>
      )}
    </div>
  )
}
