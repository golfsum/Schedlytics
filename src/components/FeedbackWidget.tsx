import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, X, Bug, Lightbulb, HelpCircle, MessageCircle, Loader2, Check } from 'lucide-react'
import { useAuth } from './Auth'
import { useToast } from './Toast'
import { submitFeedback, type FeedbackInput, type FeedbackMeta } from '../lib/admin'
import { getLastError } from '../lib/reportError'

type Category = FeedbackInput['category']

const TYPES: { id: Category; label: string; Icon: typeof Bug }[] = [
  { id: 'bug', label: 'Report bug', Icon: Bug },
  { id: 'feature', label: 'Feature request', Icon: Lightbulb },
  { id: 'confusing', label: 'Something confusing', Icon: HelpCircle },
  { id: 'general', label: 'General feedback', Icon: MessageCircle },
]

/** Parse a short browser name + version from the user agent. */
function browserInfo(): { browser: string; version: string } {
  const ua = navigator.userAgent
  let m
  if ((m = ua.match(/Edg\/(\d+)/))) return { browser: 'Edge', version: m[1] }
  if ((m = ua.match(/OPR\/(\d+)/))) return { browser: 'Opera', version: m[1] }
  if ((m = ua.match(/Chrome\/(\d+)/)) && !/Edg|OPR/.test(ua)) return { browser: 'Chrome', version: m[1] }
  if ((m = ua.match(/Version\/(\d+).*Safari/))) return { browser: 'Safari', version: m[1] }
  if ((m = ua.match(/Firefox\/(\d+)/))) return { browser: 'Firefox', version: m[1] }
  return { browser: 'Browser', version: '' }
}

/** Rough device class from the user agent + viewport. */
function deviceType(): string {
  const ua = navigator.userAgent
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'Tablet'
  if (/Mobi|iPhone|Android/.test(ua)) return 'Mobile'
  return 'Desktop'
}

/**
 * Global feedback button: a floating action on every app page that opens a
 * "Send Feedback" modal. Auto-attaches page + device context so you do not have
 * to chase users for it.
 */
export default function FeedbackWidget({ page }: { page: string }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [includeContext, setIncludeContext] = useState(true)
  const [busy, setBusy] = useState(false)

  const openModal = () => {
    setEmail(user?.email || '')
    setCategory('general')
    setMessage('')
    setIncludeContext(true)
    setOpen(true)
  }

  const buildMeta = (): FeedbackMeta | null => {
    if (!includeContext) return null
    const { browser, version } = browserInfo()
    const err = getLastError()
    return {
      page,
      url: typeof location !== 'undefined' ? location.pathname + location.hash : '',
      browser,
      version,
      platform: navigator.platform || '',
      device: deviceType(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      lastError: err ? `${err.context}: ${err.message}` : null,
    }
  }

  const submit = async () => {
    if (!message.trim()) {
      addToast('Add a short message first', 'info')
      return
    }
    setBusy(true)
    const ok = await submitFeedback({
      category,
      message: message.trim(),
      email: email.trim() || undefined,
      userId: user?.uid,
      meta: buildMeta(),
    })
    setBusy(false)
    if (ok) {
      setOpen(false)
      addToast('Thanks. Your feedback was sent.')
    } else {
      addToast('Could not send feedback. Please try again.', 'info', 6000)
    }
  }

  return (
    <>
      {/* Floating button - visible on every app page, above the mobile safe area. */}
      <button
        onClick={openModal}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full gradient-cyan px-4 py-3 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.03] sm:bottom-6 sm:right-6"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        title="Send feedback"
        aria-label="Send feedback"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] grid place-items-end bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in sm:place-items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <MessageSquare className="h-5 w-5 text-cyan-accent" /> Send feedback
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {/* type */}
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(({ id, label, Icon }) => {
                    const on = category === id
                    return (
                      <button
                        key={id}
                        onClick={() => setCategory(id)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          on
                            ? 'border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent'
                            : 'border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    )
                  })}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder={
                    category === 'bug'
                      ? 'What happened? What did you expect?'
                      : category === 'feature'
                        ? 'What would you like to be able to do?'
                        : 'Tell us what is on your mind'
                  }
                  className="w-full resize-none rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                />

                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Email (optional, so we can reply)"
                  className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                />

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={includeContext}
                    onChange={(e) => setIncludeContext(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-navy-900 accent-cyan-accent"
                  />
                  Include page and device info (helps us reproduce issues)
                </label>

                <button
                  onClick={submit}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Send feedback
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
