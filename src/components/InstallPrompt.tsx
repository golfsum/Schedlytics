import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, X, Share, Plus } from 'lucide-react'
import { useToast } from './Toast'
import { canInstall, promptInstall, onInstallChange, isStandalone, isIOS } from '../lib/pwa'

const DISMISS_KEY = 'sl_pwa_dismissed'
const VISITS_KEY = 'sl_visits'

/**
 * Permanent install button for the top bar (next to notifications). Hidden once
 * the app is installed; on desktop/Android it triggers the native prompt, on
 * iOS it shows the Add-to-Home-Screen steps.
 */
export function TopbarInstallButton() {
  const { addToast } = useToast()
  const [installable, setInstallable] = useState(canInstall())
  const [installed, setInstalled] = useState(isStandalone())
  useEffect(
    () =>
      onInstallChange(() => {
        setInstallable(canInstall())
        setInstalled(isStandalone())
      }),
    [],
  )
  const ios = isIOS()
  if (installed || (!installable && !ios)) return null

  const click = async () => {
    if (installable) await promptInstall()
    else addToast('On iPhone: tap the Share button, then "Add to Home Screen".', 'info', 6000)
  }

  return (
    <button
      onClick={click}
      title="Install Schedlytics"
      aria-label="Install Schedlytics"
      className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-accent/30 bg-cyan-accent/10 text-cyan-accent transition-colors hover:bg-cyan-accent/20"
    >
      <Download className="h-[18px] w-[18px]" />
    </button>
  )
}

/** Settings card showing install status with an Install action when available. */
export function InstallAppCard() {
  const [installable, setInstallable] = useState(canInstall())
  const [installed, setInstalled] = useState(isStandalone())
  useEffect(
    () =>
      onInstallChange(() => {
        setInstallable(canInstall())
        setInstalled(isStandalone())
      }),
    [],
  )
  const ios = isIOS()

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Download className="h-5 w-5 text-cyan-accent" />
        <h2 className="text-lg font-bold text-white">Install App</h2>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Install Schedlytics for faster access. No app store needed.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            installed ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-400'
          }`}
        >
          {installed ? 'Installed' : 'Browser version'}
        </span>
        {!installed && installable && (
          <button
            onClick={() => promptInstall()}
            className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow-soft"
          >
            Install Schedlytics
          </button>
        )}
        {!installed && !installable && ios && (
          <span className="text-xs text-slate-400">
            On iPhone: tap Share, then Add to Home Screen.
          </span>
        )}
        {!installed && !installable && !ios && (
          <span className="text-xs text-slate-500">
            Use your browser menu to install, or open in Chrome/Edge.
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Prompts the user to install Schedlytics as an app. Desktop/Android use the
 * native beforeinstallprompt; iOS Safari gets Add-to-Home-Screen instructions.
 * Shows once the user has opened the app at least twice, and never again after
 * it is dismissed or installed.
 */
export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [installable, setInstallable] = useState(canInstall())

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), [])

  useEffect(() => {
    if (isStandalone()) return
    let dismissed = false
    let visits = 0
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
      visits = Number(localStorage.getItem(VISITS_KEY) || '0') + 1
      localStorage.setItem(VISITS_KEY, String(visits))
    } catch {
      /* storage unavailable */
    }
    if (dismissed || visits < 2) return
    // Give the app a moment to settle before prompting.
    const t = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const close = (remember: boolean) => {
    setShow(false)
    if (remember) {
      try {
        localStorage.setItem(DISMISS_KEY, '1')
      } catch {
        /* ignore */
      }
    }
  }

  const install = async () => {
    const ok = await promptInstall()
    if (ok) close(true)
  }

  const ios = isIOS()
  if (!show || isStandalone() || (!installable && !ios)) return null

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 sm:bottom-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-800 p-4 shadow-panel animate-fade-in">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-cyan text-navy-900">
            <Download className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {ios && !installable ? (
              <>
                <p className="text-sm font-bold text-white">Install Schedlytics on iPhone</p>
                <ol className="mt-2 space-y-1 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    1. Tap the <Share className="inline h-3.5 w-3.5 text-cyan-accent" /> Share button.
                  </li>
                  <li className="flex items-center gap-1.5">
                    2. Tap <Plus className="inline h-3.5 w-3.5 text-cyan-accent" /> Add to Home Screen.
                  </li>
                  <li>3. Tap Add.</li>
                </ol>
                <button
                  onClick={() => close(true)}
                  className="mt-3 w-full rounded-lg border border-white/15 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Got it
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">Install Schedlytics</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Get faster access on desktop and mobile, and keep your workspace one tap away.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={install}
                    className="flex-1 rounded-lg gradient-cyan py-2 text-sm font-bold text-navy-900 shadow-glow-soft"
                  >
                    Install
                  </button>
                  <button
                    onClick={() => close(true)}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
                  >
                    Not now
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => close(true)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
