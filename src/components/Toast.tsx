import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, X } from 'lucide-react'

type ToastType = 'success' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Access the toast dispatcher. Must be used under <ToastProvider>. */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

// Simple monotonic id source (avoids relying on timestamps).
let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  )

  const addToast = useCallback(
    // duration 0 = sticky (stays until manually dismissed)
    (message: string, type: ToastType = 'success', duration = 3200) => {
      const id = ++nextId
      setToasts((t) => [...t, { id, message, type }])
      if (duration > 0) setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* viewport */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-xl border border-white/10 bg-navy-800/95 p-3.5 shadow-panel backdrop-blur"
          >
            <span className="mt-0.5 shrink-0 text-cyan-accent">
              {t.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Info className="h-5 w-5" />
              )}
            </span>
            <p className="flex-1 text-sm font-medium text-slate-100">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 text-slate-500 transition-colors hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
