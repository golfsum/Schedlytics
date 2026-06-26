import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Plus, Plug } from 'lucide-react'
import { usePersistedState } from '../lib/usePersisted'
import { useToast } from './Toast'

type DemoPref = 'on' | 'off' | null

interface DemoWorkspaceValue {
  /** User preference: 'on' force demo, 'off' removed, null = auto (default on). */
  pref: DemoPref
  removeDemo: () => void
  enableDemo: () => void
}

const Ctx = createContext<DemoWorkspaceValue | null>(null)

/**
 * Per-user Demo Workspace preference. The dashboard combines this with real
 * activity to decide whether to show the labeled sample workspace, so a fresh
 * account never lands on an empty dashboard but real data always wins.
 */
export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = usePersistedState<DemoPref>('sl_demo_pref', null)
  return (
    <Ctx.Provider value={{ pref, removeDemo: () => setPref('off'), enableDemo: () => setPref('on') }}>
      {children}
    </Ctx.Provider>
  )
}

export function useDemoWorkspace() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDemoWorkspace must be used within a DemoWorkspaceProvider')
  return ctx
}

/**
 * Persistent, clearly labeled banner shown while the demo workspace is active.
 * Removal is right here (not buried in Settings) with a confirm step.
 */
export function DemoBanner({
  onCreateLink,
  onConnect,
}: {
  onCreateLink: () => void
  onConnect: () => void
}) {
  const { removeDemo } = useDemoWorkspace()
  const { addToast } = useToast()
  const [confirm, setConfirm] = useState(false)

  const doRemove = () => {
    removeDemo()
    setConfirm(false)
    addToast('Demo data removed. You can turn it back on from the dashboard.')
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-cyan-accent/30 bg-cyan-accent/[0.07] px-4 py-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-accent/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cyan-accent">
        <Sparkles className="h-3.5 w-3.5" /> Demo data
      </span>
      <p className="min-w-0 flex-1 text-sm text-slate-300">
        You are viewing a sample workspace. Remove it anytime, or create your first tracked link to
        start collecting real results.
      </p>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
        <button
          onClick={onCreateLink}
          className="inline-flex items-center gap-1.5 rounded-lg gradient-cyan px-3 py-1.5 text-xs font-bold text-navy-900 shadow-glow-soft"
        >
          <Plus className="h-3.5 w-3.5" /> Create tracked link
        </button>
        <button
          onClick={onConnect}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
        >
          <Plug className="h-3.5 w-3.5" /> Connect platform
        </button>
        <button
          onClick={() => setConfirm(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
        >
          Remove demo data
        </button>
      </div>

      {confirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
            onClick={() => setConfirm(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy-800 p-6 shadow-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-bold text-white">Remove demo data?</h2>
                <button onClick={() => setConfirm(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                This hides the sample campaigns, links, insights, and analytics. Your real campaigns,
                links, and platform connections are not affected, and you can turn the demo back on
                anytime.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setConfirm(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
                  Cancel
                </button>
                <button onClick={doRemove} className="rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500">
                  Remove demo data
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
