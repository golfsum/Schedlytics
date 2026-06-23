import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, GripVertical, Check, ExternalLink } from 'lucide-react'

export interface BioLink {
  id: string
  label: string
  url: string
}

interface LinkInBioModalProps {
  title: string
  links: BioLink[]
  onClose: () => void
  onSave: (title: string, links: BioLink[]) => void
}

let bid = Date.now()
const newId = () => `bio_${++bid}`

/** Editor for the link-in-bio micro page: page title + an ordered list of link blocks. */
export default function LinkInBioModal({ title, links, onClose, onSave }: LinkInBioModalProps) {
  const [pageTitle, setPageTitle] = useState(title)
  const [draft, setDraft] = useState<BioLink[]>(links.length ? links : [{ id: newId(), label: '', url: '' }])

  const update = (id: string, patch: Partial<BioLink>) =>
    setDraft((d) => d.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const remove = (id: string) => setDraft((d) => d.filter((l) => l.id !== id))
  const add = () => setDraft((d) => [...d, { id: newId(), label: '', url: '' }])
  const move = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const i = d.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.length) return d
      const copy = [...d]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const save = () => {
    const cleaned = draft
      .map((l) => ({ ...l, label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label || l.url)
    onSave(pageTitle.trim() || 'My Links', cleaned)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-cyan-accent" />
            <h2 className="text-lg font-bold text-white">Link in Bio</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Page title</span>
            <input
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Schedlytics"
              className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-white">Link blocks</span>
            <div className="space-y-2.5">
              {draft.map((l, i) => (
                <div key={l.id} className="rounded-xl border border-white/5 bg-navy-900/50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        onClick={() => move(l.id, -1)}
                        disabled={i === 0}
                        className="text-slate-500 hover:text-white disabled:opacity-30"
                        title="Move up"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      value={l.label}
                      onChange={(e) => update(l.id, { label: e.target.value })}
                      placeholder="Button label (e.g. Shop My Feed)"
                      className="flex-1 rounded-lg border border-white/5 bg-navy-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                    />
                    <button
                      onClick={() => remove(l.id)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-rose-300"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={l.url}
                    onChange={(e) => update(l.id, { url: e.target.value })}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-white/5 bg-navy-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={add}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-accent/40 hover:text-cyan-accent"
            >
              <Plus className="h-4 w-4" /> Add link
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 px-5 py-4">
          <span className="text-xs text-slate-500">{draft.filter((l) => l.label || l.url).length} blocks</span>
          <button
            onClick={save}
            className="ml-auto flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Check className="h-4 w-4" strokeWidth={2.6} />
            Save page
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
