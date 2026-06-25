import { useEffect, useState } from 'react'
import { FileText, Loader2, Check, Inbox as InboxIcon, KeyRound, Ban, ShieldCheck, Users, Eye, AlertTriangle, Trash2 } from 'lucide-react'
import { useToast } from './Toast'
import {
  fetchEarlyAccess,
  downloadEarlyAccessCsv,
  fetchSupport,
  setTicketStatus,
  fetchUsers,
  sendPasswordReset,
  setUserDisabled,
  fetchAnalytics,
  fetchErrors,
  clearErrors,
  downloadErrorsCsv,
  fetchConnections,
  fetchOverview,
  type EAData,
  type Ticket,
  type AdminUser,
  type AnalyticsData,
  type ErrorsData,
  type ConnectionHealth,
  type OverviewData,
} from '../lib/admin'

const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

type Tab = 'overview' | 'traffic' | 'errors' | 'connections' | 'early' | 'support' | 'users'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'errors', label: 'Errors' },
  { id: 'connections', label: 'Connections' },
  { id: 'early', label: 'Early Access' },
  { id: 'support', label: 'Support' },
  { id: 'users', label: 'Users' },
]

export default function AdminView() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Traffic, sign-ups, support tickets, and user accounts.</p>
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

      {tab === 'overview' && <OverviewPanel onGo={setTab} />}
      {tab === 'traffic' && <TrafficPanel />}
      {tab === 'errors' && <ErrorsPanel />}
      {tab === 'connections' && <ConnectionsPanel />}
      {tab === 'early' && <EarlyAccessPanel />}
      {tab === 'support' && <SupportPanel />}
      {tab === 'users' && <UsersPanel />}
    </div>
  )
}

function OverviewPanel({ onGo }: { onGo: (t: Tab) => void }) {
  const [data, setData] = useState<OverviewData | null | 'loading'>('loading')
  useEffect(() => {
    fetchOverview().then((d) => setData(d))
  }, [])

  if (data === 'loading') return <Loading />
  if (!data) return <ErrorCard label="Could not load the overview." />

  const cards: { label: string; value: string; sub: string; go: Tab; accent?: boolean }[] = [
    { label: 'Views today', value: data.viewsToday.toLocaleString(), sub: `${data.uniquesToday.toLocaleString()} unique`, go: 'traffic' },
    { label: 'Demo opens today', value: data.demoToday.toLocaleString(), sub: 'people trying the demo', go: 'traffic' },
    { label: 'Sign-ups', value: data.signups.toLocaleString(), sub: `${data.accepted} accepted, ${data.waitlist} waitlist`, go: 'early' },
    { label: 'Open tickets', value: data.openTickets.toLocaleString(), sub: `${data.totalTickets} total`, go: 'support', accent: data.openTickets > 0 },
    { label: 'Errors (24h)', value: data.errors24h.toLocaleString(), sub: `${data.errorsTotal} logged`, go: 'errors', accent: data.errors24h > 0 },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={() => onGo(c.go)}
          className="card p-5 text-left transition-colors hover:border-cyan-accent/30"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
          <div className={`mt-2 text-3xl font-bold ${c.accent ? 'text-amber-300' : 'text-white'}`}>{c.value}</div>
          <div className="mt-1 text-sm text-slate-400">{c.sub}</div>
        </button>
      ))}
    </div>
  )
}

function TrafficPanel() {
  const [data, setData] = useState<AnalyticsData | null | 'loading'>('loading')
  useEffect(() => {
    fetchAnalytics().then((d) => setData(d))
  }, [])

  if (data === 'loading') return <Loading />
  if (!data) return <ErrorCard label="Could not load traffic." />

  const periods: { label: string; s: AnalyticsData['today'] }[] = [
    { label: 'Today', s: data.today },
    { label: 'Last 7 days', s: data.week },
    { label: 'Last 30 days', s: data.month },
  ]
  const maxViews = Math.max(1, ...data.series.map((d) => d.views))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {periods.map((p) => (
          <div key={p.label} className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.label}</div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{p.s.views.toLocaleString()}</span>
              <span className="mb-1 text-sm text-slate-400">views</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-300">
              <Users className="h-4 w-4 text-cyan-accent" />
              <b className="text-white">{p.s.uniques.toLocaleString()}</b> unique visitors
            </div>
            {/* source breakdown */}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-center">
              <Breakdown label="Marketing" value={p.s.site} />
              <Breakdown label="App" value={p.s.app} />
              <Breakdown label="Demo" value={p.s.demo} accent />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-accent" />
          <h2 className="text-lg font-bold text-white">Last 14 days</h2>
          <div className="ml-auto flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-accent/30" /> Views</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-accent" /> Unique</span>
          </div>
        </div>
        <div className="mt-4 flex h-40 items-end gap-1.5">
          {data.series.map((d) => (
            <div
              key={d.day}
              className="group relative flex flex-1 flex-col justify-end"
              title={`${d.day}: ${d.views} views, ${d.uniques} unique${d.demo ? `, ${d.demo} demo` : ''}`}
            >
              <div
                className="relative w-full rounded-t bg-cyan-accent/25"
                style={{ height: `${Math.max(2, (d.views / maxViews) * 100)}%` }}
              >
                <div
                  className="absolute bottom-0 w-full rounded-t bg-cyan-accent"
                  style={{ height: `${d.views ? (d.uniques / d.views) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
          <span>{data.series[0]?.day.slice(5)}</span>
          <span>{data.series[data.series.length - 1]?.day.slice(5)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Counts page loads on the marketing site and app. "Unique" de-duplicates visitors per day; weekly and
        monthly uniques merge across days. Bots and excluded IPs are filtered out.
      </p>
    </div>
  )
}

function ErrorsPanel() {
  const { addToast } = useToast()
  const [data, setData] = useState<ErrorsData | null | 'loading'>('loading')

  const load = () => fetchErrors().then((d) => setData(d))
  useEffect(() => {
    load()
  }, [])

  const onClear = async () => {
    if (!window.confirm('Clear the whole error log? This cannot be undone.')) return
    if (await clearErrors()) {
      addToast('Error log cleared')
      load()
    } else {
      addToast('Could not clear the log', 'info')
    }
  }

  if (data === 'loading') return <Loading />
  if (!data) return <ErrorCard label="Could not load errors." />

  if (data.total === 0)
    return (
      <div className="card grid place-items-center gap-2 p-12 text-center">
        <ShieldCheck className="h-8 w-8 text-emerald-400" />
        <p className="text-sm text-slate-400">No errors logged. Everything looks healthy.</p>
      </div>
    )

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Errors logged" value={data.total.toLocaleString()} />
        <Stat label="Last 24 hours" value={data.last24h.toLocaleString()} accent />
        <Stat label="Users affected" value={data.affectedUsers.toLocaleString()} />
      </div>

      {/* most frequent errors */}
      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <AlertTriangle className="h-4 w-4 text-amber-300" /> Most frequent
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => downloadErrorsCsv()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear log
            </button>
          </div>
        </div>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-semibold">Error</th>
              <th className="px-4 py-2 text-right font-semibold">Count</th>
              <th className="px-4 py-2 text-right font-semibold">Users</th>
              <th className="px-4 py-2 text-right font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.topGroups.map((g, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5">
                  <span className="mr-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">{g.context}</span>
                  <span className="text-slate-200">{g.message || '(no message)'}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-white">{g.count}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{g.users}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{fmtDate(g.lastAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* most affected users */}
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold text-white">Most affected users</h2>
          <div className="space-y-2">
            {data.topUsers.map((u) => (
              <div key={u.email} className="flex items-center justify-between text-sm">
                {u.email === 'anonymous' ? (
                  <span className="text-slate-400">Signed-out / unknown</span>
                ) : (
                  <a href={`mailto:${u.email}`} className="font-medium text-cyan-accent hover:underline">{u.email}</a>
                )}
                <span className="font-semibold text-white">{u.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* recent occurrences */}
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold text-white">Recent</h2>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {data.recent.map((e) => (
              <div key={e.id} className="border-b border-white/5 pb-2 last:border-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 font-semibold text-slate-400">{e.context}</span>
                  {e.platform && <span className="text-cyan-accent">{e.platform}</span>}
                  <span className="ml-auto">{fmtDate(e.at)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-200">{e.message || '(no message)'}</p>
                <p className="text-xs text-slate-500">{e.email || 'signed-out'}{e.url ? ` · ${e.url}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConnectionsPanel() {
  const [data, setData] = useState<ConnectionHealth[] | null | 'loading'>('loading')
  useEffect(() => {
    fetchConnections().then((d) => setData(d))
  }, [])

  if (data === 'loading') return <Loading />
  if (!data) return <ErrorCard label="Could not load connections." />

  const expiresIn = (ms: number | null) => {
    if (!ms) return ''
    const diff = ms - Date.now()
    if (diff <= 0) return 'expired'
    const h = Math.round(diff / 3_600_000)
    if (h < 48) return `in ${h}h`
    return `in ${Math.round(h / 24)}d`
  }

  return (
    <div className="card overflow-x-auto p-0">
      <div className="px-4 py-3">
        <h2 className="text-lg font-bold text-white">Connected accounts</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Platform tokens are currently shared at the account level. Token values are never shown.
        </p>
      </div>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-semibold">Platform</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2 font-semibold">Token expires</th>
            <th className="px-4 py-2 font-semibold">Last updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2.5 font-medium text-white">{c.name}</td>
              <td className="px-4 py-2.5">
                {!c.connected ? (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Not connected</span>
                ) : c.expired ? (
                  <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Token expired</span>
                ) : (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Connected</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-400">{c.connected ? expiresIn(c.expiresAt) || 'no expiry' : ''}</td>
              <td className="px-4 py-2.5 text-slate-400">{c.updatedAt ? fmtDate(c.updatedAt) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  // Recent errors keyed by email, so a ticket shows what broke for that user.
  const [errsByUser, setErrsByUser] = useState<Record<string, ErrorsData['recent']>>({})

  useEffect(() => {
    fetchSupport().then(setTickets)
    fetchErrors().then((d) => {
      if (!d) return
      const map: Record<string, ErrorsData['recent']> = {}
      for (const e of d.recent) {
        if (!e.email) continue
        ;(map[e.email] ||= []).push(e)
      }
      setErrsByUser(map)
    })
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

          {/* recent errors from this user, to give support context */}
          {(errsByUser[t.email]?.length ?? 0) > 0 && (
            <details className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/5 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-amber-200">
                {errsByUser[t.email].length} recent error{errsByUser[t.email].length === 1 ? '' : 's'} from this user
              </summary>
              <div className="mt-2 space-y-1.5">
                {errsByUser[t.email].slice(0, 6).map((e) => (
                  <div key={e.id} className="text-xs text-slate-400">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-semibold text-slate-300">{e.context}</span>{' '}
                    {e.message} <span className="text-slate-600">({fmtDate(e.at)})</span>
                  </div>
                ))}
              </div>
            </details>
          )}

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
      <div className="card space-y-3 p-6">
        <div className="flex items-center gap-2 text-white">
          <KeyRound className="h-5 w-5 text-amber-300" />
          <h2 className="text-base font-bold">We couldn't load users right now</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Your account is fine. This is a configuration issue on the server side, not something you did. Try again in a
          moment. If it keeps happening, the Firebase connection needs a quick look in the server settings.
        </p>
        {errDetail && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer select-none font-medium hover:text-slate-300">Technical details</summary>
            <p className="mt-2 break-all rounded-lg bg-navy-900 px-3 py-2 font-mono leading-relaxed text-slate-400">
              {errDetail}
            </p>
          </details>
        )}
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
              <td className="px-4 py-2.5 text-slate-400">{u.providers.map(providerLabel).join(', ') || 'None'}</td>
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

function Breakdown({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

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
