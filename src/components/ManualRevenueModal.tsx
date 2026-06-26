import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, DollarSign } from 'lucide-react'
import { useCampaigns } from './Campaigns'
import { useToast } from './Toast'
import { addManualRevenue } from '../lib/conversions'
import { sampleData } from '../lib/socialApi'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']

/** Add manual revenue against a campaign or content item (portaled to body). */
export default function ManualRevenueModal({
  onClose,
  onAdded,
  defaultCampaign,
  defaultContentTitle,
}: {
  onClose: () => void
  onAdded?: () => void
  defaultCampaign?: string
  defaultContentTitle?: string
}) {
  const { campaigns } = useCampaigns()
  const { addToast } = useToast()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [date, setDate] = useState(today())
  const [campaign, setCampaign] = useState(defaultCampaign || '')
  const [content, setContent] = useState(defaultContentTitle || '')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      addToast('Enter a revenue amount', 'info')
      return
    }
    // Demo mode has no backend; confirm without persisting.
    if (sampleData) {
      addToast('Revenue added 💰 (demo)')
      onAdded?.()
      onClose()
      return
    }
    setBusy(true)
    const ok = await addManualRevenue({
      value,
      currency,
      date,
      campaign: campaign || undefined,
      contentTitle: content || undefined,
      notes: notes || undefined,
      event: 'manual',
    })
    setBusy(false)
    if (ok) {
      addToast('Revenue added 💰')
      onAdded?.()
      onClose()
    } else {
      addToast('Could not add revenue', 'info')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-accent">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Revenue</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">Add revenue</h2>
            <p className="text-sm text-slate-400">
              Attribute a sale or payout to a campaign or piece of content.
            </p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Amount</Label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="425"
                inputMode="decimal"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label>Campaign</Label>
              <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={inputCls}>
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Content (optional)</Label>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Summer Sale Carousel"
              className={inputCls}
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Etsy sales"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add revenue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-slate-300">{children}</label>
}

function today(): string {
  try {
    return new Date().toISOString().slice(0, 10)
  } catch {
    return ''
  }
}
