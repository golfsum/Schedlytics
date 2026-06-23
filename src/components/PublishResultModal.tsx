import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, ExternalLink, Copy, PartyPopper } from 'lucide-react'
import { PLATFORMS } from '../data'
import type { PlatformId } from '../types'

interface PublishResultModalProps {
  platform: PlatformId
  url?: string
  note?: string
  onClose: () => void
  /** Clear the composer to start a fresh post. */
  onNewPost: () => void
}

/** Success confirmation shown after a post publishes, with the live link. */
export default function PublishResultModal({
  platform,
  url,
  note,
  onClose,
  onNewPost,
}: PublishResultModalProps) {
  const [copied, setCopied] = useState(false)
  const plat = PLATFORMS[platform]
  const { Icon } = plat

  const copy = () => {
    if (!url) return
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col items-center gap-3 px-6 pb-5 pt-8 text-center">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* platform badge with a success check */}
          <div className="relative">
            <span className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${plat.gradient} text-white shadow-glow`}>
              <Icon className="h-8 w-8" />
            </span>
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-emerald-400 ring-4 ring-navy-800">
              <Check className="h-4 w-4 text-navy-900" strokeWidth={3.5} />
            </span>
          </div>

          <div>
            <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-white">
              <PartyPopper className="h-5 w-5 text-cyan-accent" />
              Published to {plat.name}
            </h2>
            {note && <p className="mt-1 text-sm text-slate-400">{note}</p>}
          </div>

          {/* link row */}
          {url ? (
            <div className="mt-2 flex w-full items-center gap-2 rounded-xl border border-white/5 bg-navy-900/60 px-3 py-2.5">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-left text-sm font-medium text-cyan-accent hover:underline"
              >
                {url}
              </a>
              <button
                onClick={copy}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              It may take a moment to appear on your profile.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 px-6 py-4">
          <button
            onClick={onNewPost}
            className="rounded-lg border border-white/10 bg-navy-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:text-white"
          >
            New post
          </button>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="ml-auto flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
            >
              <ExternalLink className="h-4 w-4" />
              View on {plat.name}
            </a>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
