import { useState } from 'react'
import {
  Plug,
  Check,
  Loader2,
  Unplug,
  ShieldCheck,
  User,
  Bell,
  CreditCard,
  Link2,
  Sparkles,
} from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { useImageUpload } from './ImageUpload'
import { useConnections, CONNECTABLE } from './Connections'
import { PLATFORMS } from '../data'
import type { PlatformId } from '../types'

const SECTIONS = [
  { id: 'accounts', label: 'Connected Accounts', Icon: Link2 },
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'billing', label: 'Billing', Icon: CreditCard },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export default function SettingsView() {
  const [section, setSection] = useState<SectionId>('accounts')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* section nav */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all lg:w-full ${
                section === id
                  ? 'bg-cyan-accent/10 text-white ring-1 ring-cyan-accent/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${section === id ? 'text-cyan-accent' : ''}`} />
              {label}
            </button>
          ))}
        </nav>

        <div>
          {section === 'accounts' && <AccountsSection />}
          {section === 'profile' && <ProfileSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'billing' && <BillingSection />}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- accounts -------------------------------- */

function AccountsSection() {
  const { accounts, connect, disconnect, connectedCount } = useConnections()

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Connected Accounts</h2>
        <span className="rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
          {connectedCount} of {CONNECTABLE.length} connected
        </span>
      </div>
      <p className="mb-5 text-sm text-slate-400">
        Link your social accounts to schedule and cross-post automatically.
      </p>

      <div className="space-y-3">
        {CONNECTABLE.map((id) => {
          const plat = PLATFORMS[id]
          const { Icon } = plat
          const acct = accounts[id]
          return (
            <div
              key={id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-4"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${plat.gradient} text-white`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{plat.name}</span>
                  {acct.connected && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {acct.connected
                    ? `${acct.handle} · ${acct.followers} followers`
                    : 'Authorize Schedlytics to post on your behalf'}
                </div>
              </div>

              {acct.connecting ? (
                <button
                  disabled
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-cyan-accent"
                >
                  <Loader2 className="h-4 w-4 animate-spin" /> Authorizing…
                </button>
              ) : acct.connected ? (
                <button
                  onClick={() => disconnect(id as PlatformId)}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-rose-500/30 hover:text-rose-300"
                >
                  <Unplug className="h-4 w-4" /> Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connect(id as PlatformId)}
                  className="flex shrink-0 items-center gap-2 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
                >
                  <Plug className="h-4 w-4" /> Connect
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/5 bg-navy-900/40 p-4 text-xs leading-relaxed text-slate-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
        <span>
          Connections use OAuth — Schedlytics never stores your password. In this demo the
          handshake is simulated; a production build exchanges the auth code server-side and
          stores only a revocable access token.
        </span>
      </div>
    </div>
  )
}

/* --------------------------------- profile -------------------------------- */

function ProfileSection() {
  const { addToast } = useToast()
  const [name, setName] = useState('Alex Rivera')
  const [email, setEmail] = useState('alex@schedlytics.io')
  const [bio, setBio] = useState('Creator & marketer. Fashion, lifestyle, and a little chaos.')
  const avatar = useImageUpload('https://i.pravatar.cc/120?img=12', () => addToast('Photo updated'))

  return (
    <div className="card p-5">
      <h2 className="mb-5 text-lg font-bold text-white">Profile</h2>

      <div className="mb-6 flex items-center gap-4">
        <img
          src={avatar.preview}
          alt="Avatar"
          className="h-16 w-16 rounded-2xl object-cover ring-2 ring-cyan-accent/30"
        />
        <button
          onClick={avatar.open}
          className="rounded-lg border border-white/10 bg-navy-900/60 px-3.5 py-2 text-sm font-medium text-slate-200 hover:text-white"
        >
          Change photo
        </button>
        {avatar.input}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          />
        </Labeled>
        <Labeled label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          />
        </Labeled>
      </div>
      <Labeled label="Bio" className="mt-4">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
        />
      </Labeled>

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => addToast('Profile saved ✓')}
          className="rounded-lg gradient-cyan px-5 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}

/* ------------------------------ notifications ----------------------------- */

function NotificationsSection() {
  const { addToast } = useToast()
  const [prefs, setPrefs] = useState({
    digest: true,
    comments: true,
    published: true,
    weekly: false,
    mentions: true,
  })

  const set = (key: keyof typeof prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    addToast(`${value ? 'Enabled' : 'Disabled'} ${LABELS[key]}`, 'info')
  }

  const LABELS: Record<keyof typeof prefs, string> = {
    digest: 'Daily email digest',
    comments: 'New comment alerts',
    published: 'Post-published alerts',
    weekly: 'Weekly performance report',
    mentions: 'Mention notifications',
  }

  return (
    <div className="card p-5">
      <h2 className="mb-5 text-lg font-bold text-white">Notifications</h2>
      <div className="divide-y divide-white/5">
        {(Object.keys(prefs) as (keyof typeof prefs)[]).map((key) => (
          <div key={key} className="flex items-center justify-between py-3.5">
            <span className="text-sm text-slate-200">{LABELS[key]}</span>
            <Toggle checked={prefs[key]} onChange={(v) => set(key, v)} label={LABELS[key]} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- billing -------------------------------- */

function BillingSection() {
  const { addToast } = useToast()

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="gradient-cyan-soft p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-accent">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Current plan</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-white">Pro</div>
              <div className="text-sm text-slate-300">$29 / month · renews Jul 21, 2026</div>
            </div>
            <button
              onClick={() => addToast('Plan management opened', 'info')}
              className="rounded-lg border border-white/15 bg-navy-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900/70"
            >
              Manage plan
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5">
          {[
            ['Channels', 'Unlimited'],
            ['Scheduled posts', '∞'],
            ['Team seats', '5'],
          ].map(([k, v]) => (
            <div key={k} className="p-4 text-center">
              <div className="text-lg font-bold text-white">{v}</div>
              <div className="text-xs text-slate-500">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Payment Method</h2>
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-4">
          <span className="grid h-10 w-14 place-items-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 text-xs font-bold text-white">
            VISA
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">•••• •••• •••• 4242</div>
            <div className="text-xs text-slate-500">Expires 09/27</div>
          </div>
          <button
            onClick={() => addToast('Card update form opened', 'info')}
            className="rounded-lg border border-white/10 bg-navy-800 px-3.5 py-2 text-sm font-medium text-slate-200 hover:text-white"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- bits ---------------------------------- */

function Labeled({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-white">{label}</span>
      {children}
    </label>
  )
}
