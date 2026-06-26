/**
 * PWA install helpers. We capture the `beforeinstallprompt` event at module
 * load (it can fire before React mounts) and expose a tiny API so the install
 * banner and the Settings status can react to it.
 */
interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // stop Chrome's mini-infobar; we show our own prompt
    deferred = e as BIPEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/** True when the browser has offered a native install (Chrome/Edge/Android). */
export function canInstall(): boolean {
  return Boolean(deferred)
}

/** Show the native install prompt. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  if (outcome === 'accepted') deferred = null
  return outcome === 'accepted'
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Already running as an installed app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** iOS Safari, which has no beforeinstallprompt and needs manual instructions. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
