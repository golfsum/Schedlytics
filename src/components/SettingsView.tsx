import { useState, useEffect } from 'react'
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
  Globe,
  Lock,
  Sparkles,
  LifeBuoy,
  Send,
  Target,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { useImageUpload } from './ImageUpload'
import { useConnections, CONNECTABLE } from './Connections'
import { useProfile, initialsOf } from './Profile'
import { useAuth } from './Auth'
import { usePlan, PLAN_INFO } from './Plan'
import UpgradeModal from './UpgradeModal'
import { InstallAppCard } from './InstallPrompt'
import { openBillingPortal, formatPlanDate } from '../lib/billing'
import { fetchConversionGoals, saveConversionGoals } from '../lib/conversions'
import { sampleData } from '../lib/socialApi'
import { subscribeWeeklyBrief, backendEnabled } from '../lib/socialApi'
import { submitSupport } from '../lib/admin'
import { useSeededState } from '../lib/usePersisted'
import { PLATFORMS, isComingSoon } from '../data'
import type { PlatformId } from '../types'

const SECTIONS = [
  { id: 'accounts', label: 'Connected Accounts', Icon: Link2 },
  { id: 'domain', label: 'Branded Domain', Icon: Globe },
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'tracking', label: 'Conversion Tracking', Icon: Target },
  { id: 'billing', label: 'Billing', Icon: CreditCard },
  { id: 'support', label: 'Support', Icon: LifeBuoy },
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
          {section === 'accounts' && (
            <div className="space-y-5">
              <AccountsSection />
              <InstallAppCard />
            </div>
          )}
          {section === 'domain' && <BrandedDomainSection />}
          {section === 'profile' && <ProfileSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'tracking' && <ConversionTrackingSection />}
          {section === 'billing' && <BillingSection />}
          {section === 'support' && <SupportSection />}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- support --------------------------------- */

function SupportSection() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    const ok = await submitSupport(user?.email || '', subject.trim(), message.trim())
    setSending(false)
    if (ok) {
      setSent(true)
      setSubject('')
      setMessage('')
      addToast('Message sent. We will get back to you soon ✅')
    } else {
      addToast('Could not send right now. Email us instead.', 'info')
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <LifeBuoy className="h-5 w-5 text-cyan-accent" />
        <h2 className="text-lg font-bold text-white">Support</h2>
      </div>
      <p className="mb-5 text-sm text-slate-400">
        Run into a problem or have a request? Send us a message and we will reply by email.
      </p>

      {!backendEnabled ? (
        <p className="rounded-xl border border-white/5 bg-navy-800/60 p-4 text-sm text-slate-400">
          Email us at{' '}
          <a href="mailto:nd82soft@gmail.com" className="font-semibold text-cyan-accent hover:underline">
            nd82soft@gmail.com
          </a>{' '}
          and we will get back to you.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Reply to
            </label>
            <input
              value={user?.email || ''}
              readOnly
              className="w-full rounded-lg border border-white/10 bg-navy-800/60 px-3 py-2 text-sm text-slate-300"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this about?"
              maxLength={200}
              className="w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              placeholder="Tell us what is going on…"
              maxLength={5000}
              className="w-full resize-y rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sent ? 'Send another' : 'Send message'}
          </button>
        </form>
      )}
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
          const soon = isComingSoon(id)
          return (
            <div
              key={id}
              title={soon ? 'Coming soon' : undefined}
              className={`flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-4 ${soon ? 'opacity-60' : ''}`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${plat.gradient} text-white ${soon ? 'grayscale' : ''}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{plat.name}</span>
                  {soon ? (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      Coming soon
                    </span>
                  ) : (
                    acct.connected && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Connected
                      </span>
                    )
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {soon
                    ? 'This integration is in review and will be available soon.'
                    : acct.connected
                      ? acct.handle
                        ? `${acct.handle}${acct.followers ? ` · ${acct.followers} followers` : ''}`
                        : 'Connected'
                      : 'Authorize Schedlytics to post on your behalf'}
                </div>
              </div>

              {soon ? (
                <button
                  disabled
                  title="Coming soon"
                  className="flex shrink-0 cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-500"
                >
                  Coming soon
                </button>
              ) : acct.connecting ? (
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
          We connect through OAuth, so Schedlytics never sees or stores your password. The demo
          just simulates the handshake. In production we exchange the login code on the server and
          keep only an access token you can revoke any time.
        </span>
      </div>
    </div>
  )
}

/* ----------------------------- branded domain ----------------------------- */

interface BrandedDomain {
  domain: string
  verified: boolean
}

function BrandedDomainSection() {
  const { addToast } = useToast()
  const { can } = usePlan()
  const [bd, setBd] = useSeededState<BrandedDomain>(
    'sl_branded_domain',
    { domain: 'go.mystore.com', verified: true },
    { domain: '', verified: false },
  )
  const [draft, setDraft] = useState(bd.domain)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const allowed = can('branded-domain')

  if (!allowed) {
    return (
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Globe className="h-5 w-5 text-cyan-accent" />
          <h2 className="text-lg font-bold text-white">Branded Domain</h2>
        </div>
        <p className="mb-5 text-sm text-slate-400">
          Send short links from your own domain like <span className="text-slate-200">go.yourbrand.com</span>{' '}
          instead of the default. Available on the Business plan.
        </p>
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-white/10 bg-navy-900/40 p-4 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy-800 text-slate-500">
            <Lock className="h-5 w-5" />
          </span>
          <div className="flex-1 text-sm text-slate-400">
            Upgrade to <span className="font-semibold text-white">Business</span> to connect a custom
            branded domain for your tracked links.
          </div>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="shrink-0 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow-soft"
          >
            Upgrade to Business
          </button>
        </div>
        {upgradeOpen && (
          <UpgradeModal
            onClose={() => setUpgradeOpen(false)}
            reason="Upgrade to Business to use a custom branded domain for your tracked links."
          />
        )}
      </div>
    )
  }

  const save = () => {
    const clean = draft.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    setBd({ domain: clean, verified: clean === bd.domain ? bd.verified : false })
    addToast(clean ? 'Branded domain saved' : 'Branded domain cleared')
  }
  const verify = () => {
    setBd((d) => ({ ...d, verified: true }))
    addToast('Domain verified ✓')
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Globe className="h-5 w-5 text-cyan-accent" />
        <h2 className="text-lg font-bold text-white">Branded Domain</h2>
      </div>
      <p className="mb-5 text-sm text-slate-400">
        New tracked links will use this domain. Point a CNAME record at{' '}
        <span className="text-slate-200">cname.schedlytics.app</span> to finish setup.
      </p>

      <Labeled label="Custom domain">
        <div className="flex flex-wrap gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="go.yourbrand.com"
            className="min-w-[200px] flex-1 rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
          />
          <button
            onClick={save}
            className="rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
          >
            Save
          </button>
        </div>
      </Labeled>

      {bd.domain && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-4">
          <span className="font-mono text-sm text-cyan-accent">{bd.domain}/abc123</span>
          {bd.verified ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <Check className="h-3 w-3" /> Verified
            </span>
          ) : (
            <button
              onClick={verify}
              className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/20"
            >
              Verify DNS
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- profile -------------------------------- */

function ProfileSection() {
  const { addToast } = useToast()
  const profile = useProfile()
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [bio, setBio] = useState(profile.bio)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const avatar = useImageUpload(profile.photoURL || undefined, (_, file) => {
    setPhotoFile(file)
    addToast('Photo selected')
  })

  const handleSave = async () => {
    let photoURL = profile.photoURL
    // A freshly picked file is a blob URL; convert to a data URL so it persists.
    if (photoFile) {
      try {
        photoURL = await fileToDataUrl(photoFile)
      } catch {
        /* keep existing photo on failure */
      }
    }
    profile.save({ name: name.trim(), email: email.trim(), bio: bio.trim(), photoURL })
    setPhotoFile(null)
    addToast('Profile saved ✓')
  }

  return (
    <div className="card p-5">
      <h2 className="mb-5 text-lg font-bold text-white">Profile</h2>

      <div className="mb-6 flex items-center gap-4">
        {avatar.preview ? (
          <img
            src={avatar.preview}
            alt="Avatar"
            className="h-16 w-16 rounded-2xl object-cover ring-2 ring-cyan-accent/30"
          />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-cyan text-xl font-bold text-navy-900 ring-2 ring-cyan-accent/30">
            {initialsOf(name, email)}
          </div>
        )}
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
          onClick={handleSave}
          className="rounded-lg gradient-cyan px-5 py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.02]"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}

/* ------------------------------ notifications ----------------------------- */

const DEFAULT_NOTIF_PREFS = {
  digest: true,
  comments: true,
  published: true,
  weekly: false,
  mentions: true,
}

function NotificationsSection() {
  const { addToast } = useToast()
  const { user } = useAuth()
  const [prefs, setPrefs] = useSeededState('sl_notif_prefs', DEFAULT_NOTIF_PREFS, DEFAULT_NOTIF_PREFS)

  // Keep the weekly-brief email subscription in sync with the toggle + account.
  useEffect(() => {
    if (user?.email) subscribeWeeklyBrief(user.email, prefs.weekly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, prefs.weekly])

  const set = (key: keyof typeof prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    addToast(`${value ? 'Enabled' : 'Disabled'} ${LABELS[key]}`, 'info')
    if (key === 'weekly' && user?.email) subscribeWeeklyBrief(user.email, value)
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

/* ---------------------------- conversion tracking ------------------------- */

function ConversionTrackingSection() {
  const { addToast } = useToast()
  const [siteKey, setSiteKey] = useState<string>('YOUR_SITE_KEY')
  const [snippetUrl, setSnippetUrl] = useState<string>(
    typeof window !== 'undefined' ? `${window.location.origin}/sl.js` : '/sl.js',
  )
  const [goals, setGoals] = useState<{ pattern: string; name: string }[]>([])
  const [loading, setLoading] = useState(!sampleData)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (sampleData || !backendEnabled) return
    let cancelled = false
    fetchConversionGoals()
      .then((res) => {
        if (cancelled || !res) return
        setSiteKey(res.siteKey)
        setSnippetUrl(res.snippetUrl)
        setGoals(res.goals)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const snippet = `<script async src="${snippetUrl}" data-site="${siteKey}"></script>`

  const copy = (text: string) => {
    try {
      navigator.clipboard?.writeText(text)
      addToast('Copied to clipboard')
    } catch {
      addToast('Could not copy', 'info')
    }
  }

  const addGoal = () => setGoals((g) => [...g, { pattern: '', name: '' }])
  const removeGoal = (i: number) => setGoals((g) => g.filter((_, idx) => idx !== i))
  const editGoal = (i: number, field: 'pattern' | 'name', value: string) =>
    setGoals((g) => g.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  const save = async () => {
    if (sampleData) {
      addToast('Sign in to a real account to save goals', 'info')
      return
    }
    setSaving(true)
    const cleaned = goals.map((g) => ({ pattern: g.pattern.trim(), name: g.name.trim() })).filter((g) => g.pattern)
    const result = await saveConversionGoals(cleaned)
    setSaving(false)
    if (result) {
      setGoals(result)
      addToast('Conversion goals saved')
    } else {
      addToast('Could not save goals', 'info')
    }
  }

  if (loading) {
    return (
      <div className="card p-5 text-sm text-slate-500">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="text-lg font-bold text-white">Install the tracking snippet</h2>
        <p className="mt-1 text-sm text-slate-400">
          Add this once to your website, just before the closing body tag. It connects the clicks your
          posts drive to the signups and sales they produce.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-navy-900/70 p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-cyan-accent">{snippet}</code>
          <button
            onClick={() => copy(snippet)}
            className="shrink-0 rounded-md border border-white/15 bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
          >
            <Copy className="mr-1 inline h-3.5 w-3.5" /> Copy
          </button>
        </div>
        {sampleData && (
          <p className="mt-2 text-xs text-amber-300/80">
            This is a preview. Sign in to a real account to get your live site key.
          </p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-bold text-white">Track a sale with a value</h2>
        <p className="mt-1 text-sm text-slate-400">
          For purchases, call this where the sale completes so the revenue is attributed to the post
          that drove it.
        </p>
        <div className="mt-3 rounded-xl border border-white/10 bg-navy-900/70 p-3">
          <code className="block break-all font-mono text-xs text-slate-200">
            schedlytics('conversion', {'{'} event: 'purchase', value: 49.0 {'}'})
          </code>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Goal pages</h2>
            <p className="mt-1 text-sm text-slate-400">
              Pages that count as a conversion when reached, like a thank you or confirmation page. The
              snippet fires automatically when the path contains your pattern.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {goals.length === 0 && (
            <p className="text-sm text-slate-500">No goal pages yet. Add one below.</p>
          )}
          {goals.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={g.pattern}
                onChange={(e) => editGoal(i, 'pattern', e.target.value)}
                placeholder="/thank-you"
                className="flex-1 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
              />
              <input
                value={g.name}
                onChange={(e) => editGoal(i, 'name', e.target.value)}
                placeholder="Signup (label)"
                className="w-40 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
              />
              <button
                onClick={() => removeGoal(i)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-rose-300"
                aria-label="Remove goal"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={addGoal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-navy-900/40 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-900/70"
          >
            <Plus className="h-4 w-4" /> Add goal page
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save goals
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- billing -------------------------------- */

function BillingSection() {
  const { plan, status } = usePlan()
  const { addToast } = useToast()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const info = PLAN_INFO[plan]
  const isFree = plan === 'free'
  const canceling = !isFree && Boolean(status?.cancelAtPeriodEnd)
  const endDate = canceling ? formatPlanDate(status?.currentPeriodEnd) : null

  const manageBilling = async () => {
    setManaging(true)
    const err = await openBillingPortal()
    if (err) {
      setManaging(false)
      addToast(err)
    }
  }

  // Per-plan limits shown in the summary strip.
  const limits: [string, string][] = isFree
    ? [
        ['Channels', '2'],
        ['Scheduled posts', '30'],
        ['Team seats', '1'],
      ]
    : [
        ['Channels', 'Unlimited'],
        ['Scheduled posts', '∞'],
        ['Team seats', plan === 'business' ? 'Unlimited' : '5'],
      ]

  return (
    <div className="space-y-5">
      {canceling && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          Your <span className="font-semibold">{info.name}</span> plan is canceled and ends on{' '}
          <span className="font-semibold">{endDate ?? 'the end of your billing period'}</span>. You keep
          full access until then, then your account moves to Free. You can resume any time from Manage
          billing.
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="gradient-cyan-soft p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-cyan-accent">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Current plan</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{info.name}</div>
              <div className="text-sm text-slate-300">
                {isFree
                  ? 'No payment due. Upgrade any time.'
                  : `${info.price} / month${info.priceAnnual ? ` or ${info.priceAnnual} / year` : ''}`}
              </div>
            </div>
            <button
              onClick={() => setUpgradeOpen(true)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.02] ${
                isFree
                  ? 'gradient-cyan text-navy-900 shadow-glow'
                  : 'border border-white/15 bg-navy-900/40 text-white hover:bg-navy-900/70'
              }`}
            >
              {isFree ? 'Upgrade' : 'Change plan'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5">
          {limits.map(([k, v]) => (
            <div key={k} className="p-4 text-center">
              <div className="text-lg font-bold text-white">{v}</div>
              <div className="text-xs text-slate-500">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Payment Method</h2>
        {isFree ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 bg-navy-900/40 p-4">
            <span className="grid h-10 w-14 place-items-center rounded-lg bg-navy-800 text-slate-500">
              <CreditCard className="h-5 w-5" />
            </span>
            <div className="flex-1 text-sm text-slate-400">
              No payment method on file. You only need one when you upgrade to a paid plan.
            </div>
          </div>
        ) : sampleData ? (
          <div className="rounded-xl border border-white/5 bg-navy-900/50 p-4 text-sm text-slate-300">
            This is a preview account, so no card is stored. Your{' '}
            <span className="font-semibold text-white">{info.name}</span> plan is active for the demo.
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-300">
              Your <span className="font-semibold text-white">{info.name}</span> plan is billed
              securely through Stripe. Update your card, see invoices, or cancel any time.
            </div>
            <button
              onClick={manageBilling}
              disabled={managing}
              className="shrink-0 rounded-lg border border-white/15 bg-navy-900/60 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900/90 disabled:opacity-60"
            >
              {managing ? 'Opening…' : 'Manage billing'}
            </button>
          </div>
        )}
      </div>

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  )
}

/* ---------------------------------- bits ---------------------------------- */

/** Read a File as a base64 data URL so an uploaded avatar survives a reload. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

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
