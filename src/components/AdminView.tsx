import { useEffect, useState } from 'react'
import { FileText, Loader2, Check, Inbox as InboxIcon, KeyRound, Ban, ShieldCheck } from 'lucide-react'
import { useToast } from './Toast'
import {
  fetchEarlyAccess,
  downloadEarlyAccessCsv,
  fetchSupport,
  setTicketStatus,
  fetchUsers,
  sendPasswordReset,
  setUserDisabled,
  type EAData,
  type Ticket,
  type AdminUser,
} from '../lib/admin'

const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

type Tab = 'early' | 'support' | 'users'
const TABS: { id: Tab; label: string }[] = [
  { id: 'early', label: 'Early Access' },
  { id: 'support', label: 'Support' },
  { id: 'users', label: 'Users' },
]

export default function AdminView() {
  const [tab, setTab] = useState<Tab>('early')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Sign-ups, support tickets, and user accounts.</p>
      </div>

      <div className="flex rounded-xl border border-white/5 bg-navy-800/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              tab === t.id ? 'gradient-cyan text-navy-900 shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'early' && <EarlyAccessPanel />}
      {tab === 'support' && <SupportPanel />}
      {tab === 'users' && <UsersPanel />}
    </div>
  )
}

function EarlyAccessPanel() {
  const [data, setData] = useState<EAData | null | 'loading'>('loading')
  useEffect(() => {
    fetchEarlyAccess().then((d) => setData(d))
  }, [])

  if (data === 'loading') return <Loading />
  if (!data) return <ErrorCard label="Could not load early-access sign-ups." />

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total sign-ups" value={String(data.total)} />
        <Stat label={`Accepted (cap ${data.cap})`} value={String(data.accepted)} accent />
        <Stat label="Waitlist" value={String(data.waitlist)} />
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold text-white">Sign-ups</h2>
          <button
            onClick={() => downloadEarlyAccessCsv()}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <FileText className="h-4 w-4" /> Export CSV
          </button>
        </div>
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Signed up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.signups.map((s) => (
              <tr key={s.email}>
                <td className="px-4 py-2.5 font-medium text-white">{s.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      s.status === 'accepted' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">{fmtDate(s.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.signups.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No sign-ups yet.</p>}
      </div>
    </div>
  )
}

function SupportPanel() {
  const { addToast } = useToast()
  const [tickets, setTickets] = useState<Ticket[] | 'loading'>('loading')

  useEffect(() => {
    fetchSupport().then(setTickets)
  }, [])

  const toggle = async (t: Ticket) => {
    const next = t.status === 'open' ? 'resolved' : 'open'
    if (await setTicketStatus(t.id, next)) {
      setTickets((cur) => (cur === 'loading' ? cur : cur.map((x) => (x.id === t.id ? { ...x, status: next } : x))))
    } else {
      addToast('Could not update ticket', 'info')
    }
  }

  if (tickets === 'loading') return <Loading />
  if (tickets.length === 0)
    return (
      <div className="card grid place-items-center gap-2 p-12 text-center">
        <InboxIcon className="h-8 w-8 text-slate-500" />
        <p className="text-sm text-slate-400">No support tickets yet.</p>
      </div>
    )

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <div key={t.id} className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{t.subject || '(no subject)'}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                t.status === 'resolved' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-cyan-accent/15 text-cyan-accent'
              }`}
            >
              {t.status}
            </span>
            <span className="ml-auto text-xs text-slate-500">{fmtDate(t.at)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            from <a href={`mailto:${t.email}`} className="text-cyan-accent hover:underline">{t.email}</a>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{t.message}</p>
          <div className="mt-3 flex gap-2">
            <a
              href={`mailto:${t.email}?subject=${encodeURIComponent('Re: ' + (t.subject || 'your message'))}`}
              className="rounded-lg gradient-cyan px-3 py-1.5 text-xs font-bold text-navy-900"
            >
              Reply by email
            </a>
            <button
              onClick={() => toggle(t)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Check className="h-3.5 w-3.5" /> Mark {t.status === 'open' ? 'resolved' : 'open'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UsersPanel() {
  const { addToast } = useToast()
  const [state, setState] = useState<'loading' | 'error' | 'unconfigured' | AdminUser[]>('loading')
  const [errDetail, setErrDetail] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers().then((r) => {
      if (!r) return setState('error')
      if (r.error) {
        setErrDetail(r.error)
        return setState('error')
      }
      if (!r.configured) return setState('unconfigured')
      setState(r.users)
    })
  }, [])

  const reset = async (u: AdminUser) => {
    setBusy(u.uid)
    const r = await sendPasswordReset(u.email)
    setBusy(null)
    if (!r) return addToast('Could not create reset link', 'info')
    if (r.emailed) addToast(`Reset link emailed to ${u.email} ✅`)
    else {
      await navigator.clipboard?.writeText(r.link).catch(() => {})
      addToast('Reset link copied to clipboard (no SMTP configured)')
    }
  }

  const toggleDisabled = async (u: AdminUser) => {
    setBusy(u.uid)
    const ok = await setUserDisabled(u.uid, !u.disabled)
    setBusy(null)
    if (!ok) return addToast('Could not update user', 'info')
    setState((cur) => (Array.isArray(cur) ? cur.map((x) => (x.uid === u.uid ? { ...x, disabled: !u.disabled } : x)) : cur))
    addToast(`${u.email} ${u.disabled ? 'enabled' : 'disabled'}`)
  }

  if (state === 'loading') return <Loading />
  if (state === 'error')
    return (
      <div className="card space-y-2 p-6">
        <p className="text-sm font-semibold text-rose-300">Could not load users.</p>
        {errDetail && (
          <p className="rounded-lg bg-navy-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-400">{errDetail}</p>
        )}
        <p className="text-xs text-slate-500">
          This is usually a service-account problem: a malformed{' '}
          <code className="text-cyan-accent">FIREBASE_SERVICE_ACCOUNT</code> key, or the account missing the Firebase
          Authentication Admin role. Fix it in Vercel env and redeploy.
        </p>
      </div>
    )
  if (state === 'unconfigured')
    return (
      <div className="card space-y-3 p-6">
        <div className="flex items-center gap-2 text-white">
          <KeyRound className="h-5 w-5 text-cyan-accent" />
          <h2 className="text-lg font-bold">User management is not configured yet</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Listing users and sending password resets needs a Firebase{' '}
          <span className="font-semibold text-slate-200">service account</span>. In the Firebase console open Project
          Settings, Service accounts, and generate a new private key. Then set its JSON as the{' '}
          <code className="rounded bg-navy-900 px-1.5 py-0.5 text-cyan-accent">FIREBASE_SERVICE_ACCOUNT</code> environment
          variable (raw JSON or base64) and redeploy. Early Access and Support work without it.
        </p>
      </div>
    )

  const users = state
  return (
    <div className="card overflow-x-auto p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold text-white">Users</h2>
        <span className="text-xs text-slate-500">{users.length} total</span>
      </div>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-semibold">User</th>
            <th className="px-4 py-2 font-semibold">Sign-in</th>
            <th className="px-4 py-2 font-semibold">Created</th>
            <th className="px-4 py-2 font-semibold">Last seen</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map((u) => (
            <tr key={u.uid}>
              <td className="px-4 py-2.5">
                <div className="font-medium text-white">{u.email || '(no email)'}</div>
                {u.displayName && <div className="text-xs text-slate-500">{u.displayName}</div>}
              </td>
              <td className="px-4 py-2.5 text-slate-400">{u.providers.map(providerLabel).join(', ') || '—'}</td>
              <td className="px-4 py-2.5 text-slate-400">{fmtDate(u.createdAt || 0)}</td>
              <td className="px-4 py-2.5 text-slate-400">{fmtDate(u.lastSignInAt || 0)}</td>
              <td className="px-4 py-2.5">
                {u.disabled ? (
                  <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">disabled</span>
                ) : (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">active</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => reset(u)}
                    disabled={busy === u.uid || !u.email}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
                    title="Send password reset"
                  >
                    {busy === u.uid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    Reset
                  </button>
                  <button
                    onClick={() => toggleDisabled(u)}
                    disabled={busy === u.uid}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      u.disabled
                        ? 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'
                        : 'border-rose-400/20 text-rose-300 hover:bg-rose-400/10'
                    }`}
                  >
                    {u.disabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                    {u.disabled ? 'Enable' : 'Disable'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No users yet.</p>}
    </div>
  )
}

const providerLabel = (id: string) =>
  ({ 'google.com': 'Google', password: 'Email', 'facebook.com': 'Facebook', 'github.com': 'GitHub' }[id] || id)

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className={`text-2xl font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  )
}

function Loading() {
  return (
    <div className="card grid place-items-center p-12">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-accent" />
    </div>
  )
}
function ErrorCard({ label }: { label: string }) {
  return <div className="card p-6 text-center text-sm text-slate-400">{label}</div>
}
