import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Copy,
  ExternalLink,
  PartyPopper,
  Rocket,
} from 'lucide-react'
import { usePersistedState } from '../lib/usePersisted'
import { sampleData, startConnect } from '../lib/socialApi'
import { PLATFORMS, isComingSoon } from '../data'
import { createShortLink } from '../lib/shortLinks'
import { useCampaigns, buildCampaign } from './Campaigns'
import { useToast } from './Toast'
import { useAuth } from './Auth'
import Confetti from './Confetti'
import { logActivity } from '../lib/admin'
import type { PlatformId } from '../types'

/* ------------------------------- state ----------------------------------- */

export interface OnboardingState {
  goal?: string
  userType?: string
  firstPlatform?: PlatformId | null
  firstCampaignId?: string
  firstCampaignName?: string
  firstTrackedLinkId?: string
  firstTrackedUrl?: string
  /** Step keys the user has finished. */
  completed: string[]
  setupComplete: boolean
  /** They closed or skipped the wizard (do not auto-open again). */
  dismissed: boolean
}

const EMPTY: OnboardingState = { completed: [], setupComplete: false, dismissed: false }

interface OnboardingContextValue {
  state: OnboardingState
  update: (patch: Partial<OnboardingState>) => void
  markDone: (step: string) => void
  open: () => void
  close: () => void
  isOpen: boolean
}

const Ctx = createContext<OnboardingContextValue | null>(null)

export function useOnboarding() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider')
  return ctx
}

/** Steps that count toward the setup checklist (connect is optional but listed). */
export const SETUP_STEPS = [
  { key: 'platform', label: 'Connect a platform' },
  { key: 'campaign', label: 'Create a campaign' },
  { key: 'link', label: 'Create a tracked link' },
  { key: 'share', label: 'Share your tracked link' },
  { key: 'conversion', label: 'Add conversion tracking' },
] as const

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Scope onboarding to the signed-in user so completion survives logout (the
  // generic logout purge wipes the un-scoped key, which made the wizard reopen
  // on every login). Per-uid keys also keep separate accounts isolated.
  const { user } = useAuth()
  const [state, setState] = usePersistedState<OnboardingState>(`sl_onboarding:${user?.uid || 'anon'}`, EMPTY)
  const [isOpen, setIsOpen] = useState(false)

  const update = (patch: Partial<OnboardingState>) => setState((s) => ({ ...s, ...patch }))
  const markDone = (step: string) =>
    setState((s) => (s.completed.includes(step) ? s : { ...s, completed: [...s.completed, step] }))

  // Auto-open once for a real account that has not finished or dismissed setup.
  // ?setup=1 forces it open in any mode (a "redo setup" entry point).
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('setup') === '1'
    if (forced) {
      setIsOpen(true)
      return
    }
    if (sampleData) return
    if (!state.setupComplete && !state.dismissed) {
      const t = setTimeout(() => setIsOpen(true), 600)
      return () => clearTimeout(t)
    }
  }, [state.setupComplete, state.dismissed])

  return (
    <Ctx.Provider
      value={{ state, update, markDone, open: () => setIsOpen(true), close: () => setIsOpen(false), isOpen }}
    >
      {children}
      {isOpen && <OnboardingWizard />}
    </Ctx.Provider>
  )
}

/* ------------------------------- options --------------------------------- */

const GOALS = [
  'Drive traffic to my website',
  'Grow my audience',
  'Track campaign performance',
  'Measure sales or signups',
  'Manage content across platforms',
]
const USER_TYPES = ['Creator', 'Agency', 'Small business', 'Ecommerce brand', 'Coach or consultant', 'Other']
const AVAILABLE: PlatformId[] = ['youtube', 'pinterest', 'twitch', 'patreon']
const SOON: PlatformId[] = ['instagram', 'facebook', 'tiktok']
const TEMPLATES = [
  'Product Launch',
  'Newsletter Growth',
  'YouTube Traffic',
  'Patreon Promotion',
  'Black Friday',
  'Lead Generation',
  'Podcast Promotion',
  'Etsy Shop Traffic',
]
const GOAL_TYPES = ['Clicks', 'Conversions', 'Revenue', 'Subscribers', 'Traffic', 'Engagement']

// Suggested first campaign per user type (so the Type answer does real work).
const TYPE_TO_TEMPLATE: Record<string, string> = {
  Creator: 'YouTube Traffic',
  Agency: 'Product Launch',
  'Small business': 'Newsletter Growth',
  'Ecommerce brand': 'Black Friday',
  'Coach or consultant': 'Lead Generation',
}

const STEPS = ['welcome', 'goal', 'userType', 'platform', 'campaign', 'link', 'conversion', 'done'] as const
type Step = (typeof STEPS)[number]

// Short labels for the progress rail (welcome + done are excluded).
const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'goal', label: 'Goal' },
  { key: 'userType', label: 'Type' },
  { key: 'platform', label: 'Platform' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'link', label: 'Link' },
  { key: 'conversion', label: 'Finish' },
]

/* ------------------------------- wizard ---------------------------------- */

function OnboardingWizard() {
  const { state, update, markDone, close } = useOnboarding()
  const { addCampaign } = useCampaigns()
  const { addToast } = useToast()

  const [step, setStep] = useState<Step>('welcome')
  const idx = STEPS.indexOf(step)
  const go = (s: Step) => setStep(s)
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)])
  const back = () => go(STEPS[Math.max(idx - 1, 0)])

  // campaign inputs
  const [campName, setCampName] = useState('')
  const [goalType, setGoalType] = useState('Clicks')
  const [goalValue, setGoalValue] = useState('')
  // link inputs
  const [dest, setDest] = useState('')
  const [busy, setBusy] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [selectedPlat, setSelectedPlat] = useState<PlatformId | null>(state.firstPlatform ?? null)
  const [finishing, setFinishing] = useState(false)

  // Suggest a first campaign name from the user's type when they reach that step.
  useEffect(() => {
    if (step === 'campaign' && !campName && state.userType && TYPE_TO_TEMPLATE[state.userType]) {
      setCampName(TYPE_TO_TEMPLATE[state.userType])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const skip = () => {
    update({ dismissed: true })
    close()
  }
  // Brief "initializing" beat before entering the app, for polish.
  const finish = () => {
    setFinishing(true)
    logActivity('onboarding')
    window.setTimeout(() => {
      update({ setupComplete: true })
      close()
    }, 650)
  }
  const isDone = (k: string) => state.completed.includes(k)
  const copyFirstLink = () => {
    if (!state.firstTrackedUrl) return
    try {
      navigator.clipboard?.writeText(state.firstTrackedUrl)
      addToast('Link copied')
    } catch {
      /* ignore */
    }
  }

  const chooseGoal = (g: string) => {
    update({ goal: g })
    markDone('goal')
    next()
  }
  const chooseType = (t: string) => {
    update({ userType: t })
    markDone('userType')
    next()
  }
  // Selecting a platform only highlights it; connecting (which opens the OAuth
  // popup) is a deliberate second click so we never pop a login unprompted.
  const doConnect = (p: PlatformId) => {
    update({ firstPlatform: p })
    markDone('platform')
    startConnect(p)
    addToast(`Opening ${PLATFORMS[p].name} to connect…`, 'info')
    next()
  }

  const createCampaign = () => {
    const name = campName.trim()
    if (!name) {
      addToast('Give your campaign a name', 'info')
      return
    }
    const c = buildCampaign({
      name,
      goalType,
      goalValue: Number(goalValue) || undefined,
      bestPlatform: state.firstPlatform || undefined,
    })
    addCampaign(c)
    update({ firstCampaignId: c.id, firstCampaignName: c.name })
    markDone('campaign')
    addToast('Campaign created 🎯')
    next()
  }

  const createLink = async () => {
    if (!dest.trim()) {
      addToast('Enter a destination URL', 'info')
      return
    }
    setBusy(true)
    try {
      const platform = state.firstPlatform || undefined
      const slug = (state.firstCampaignName || 'campaign')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      const link = await createShortLink(dest.trim(), {
        campaign: state.firstCampaignName,
        platform,
        utmSource: platform || 'schedlytics',
        utmMedium: 'social',
        utmCampaign: slug,
      })
      const short = (link as { shortUrl?: string; slug?: string }).shortUrl || `link/${(link as { slug?: string }).slug || ''}`
      setCreatedUrl(short)
      update({ firstTrackedLinkId: (link as { slug?: string }).slug, firstTrackedUrl: short })
      markDone('link')
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not create link', 'info')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = () => {
    if (!createdUrl) return
    try {
      navigator.clipboard?.writeText(createdUrl)
      addToast('Link copied')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-navy-950/75 p-4 backdrop-blur-sm animate-fade-in">
      {finishing && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-navy-950/90">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-accent" />
            <p className="text-sm font-semibold text-white">Initializing your workspace…</p>
            <p className="text-xs italic text-slate-500">Every click starts a story.</p>
          </div>
        </div>
      )}
      {step === 'done' && <Confetti />}
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-navy-800 shadow-panel">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2 text-cyan-accent">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Setup</span>
          </div>
          {step !== 'done' && (
            <button onClick={skip} className="text-xs font-medium text-slate-400 hover:text-white">
              Skip for now
            </button>
          )}
        </div>

        {/* labeled progress rail */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="flex gap-1.5 px-6 pt-4">
            {STEP_LABELS.map(({ key, label }) => {
              const at = STEPS.indexOf(key)
              const done = at < idx
              const active = at === idx
              return (
                <div key={key} className="flex flex-1 flex-col items-center gap-1">
                  <span className={`h-1 w-full rounded-full ${done || active ? 'bg-cyan-accent' : 'bg-white/10'}`} />
                  <span
                    className={`text-[10px] ${active ? 'font-semibold text-cyan-accent' : done ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="px-6 py-6">
          {step === 'welcome' && (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-cyan text-navy-900 shadow-glow">
                <Rocket className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">Welcome to Schedlytics</h2>
              <p className="mt-2 text-sm text-slate-400">
                Let's set up your first campaign and tracked link so you can see what your content is
                worth. It takes about two minutes.
              </p>
              <button
                onClick={next}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow"
              >
                Start setup <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={skip} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-300">
                Skip for now
              </button>
            </div>
          )}

          {step === 'goal' && (
            <Step title="What do you want to measure first?" subtitle="We will tailor your dashboard around it.">
              <div className="space-y-2">
                {GOALS.map((g) => (
                  <Choice key={g} label={g} selected={state.goal === g} onClick={() => chooseGoal(g)} />
                ))}
              </div>
            </Step>
          )}

          {step === 'userType' && (
            <Step title="What best describes you?" subtitle="This helps us suggest campaigns that fit.">
              <div className="grid grid-cols-2 gap-2">
                {USER_TYPES.map((t) => (
                  <Choice key={t} label={t} selected={state.userType === t} onClick={() => chooseType(t)} />
                ))}
              </div>
            </Step>
          )}

          {step === 'platform' && (
            <Step
              title="Connect a platform to get started?"
              subtitle="Pick one and we will open it so you can sign in. This is optional, and you can always connect later."
            >
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE.map((p) => (
                  <PlatformCard key={p} platform={p} onClick={() => setSelectedPlat(p)} done={selectedPlat === p} />
                ))}
              </div>
              <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Coming soon</p>
              <div className="grid grid-cols-3 gap-2">
                {SOON.map((p) => (
                  <PlatformCard key={p} platform={p} soon />
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Instagram, Facebook, and TikTok are awaiting platform approval. You can still create
                trackable links and campaigns for them today.
              </p>
              {selectedPlat && (
                <button
                  onClick={() => doConnect(selectedPlat)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow"
                >
                  Connect to {PLATFORMS[selectedPlat].name}
                </button>
              )}
              <div className="mt-4 flex items-center justify-between">
                <BackBtn onClick={back} />
                <button onClick={next} className="text-sm font-semibold text-slate-400 hover:text-white">
                  I will connect later →
                </button>
              </div>
            </Step>
          )}

          {step === 'campaign' && (
            <Step title="Create your first campaign" subtitle="Campaigns group posts, links, and results together.">
              <label className="mb-1 block text-xs font-semibold text-slate-300">Campaign name</label>
              <input
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                placeholder="Summer Sale"
                className="mb-2 w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
              />
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setCampName(t)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-accent/40 hover:text-white"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Goal</label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white focus:border-cyan-accent focus:outline-none"
                  >
                    {GOAL_TYPES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Target</label>
                  <input
                    value={goalValue}
                    onChange={(e) => setGoalValue(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="1000"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <BackBtn onClick={back} />
                <div className="flex items-center gap-3">
                  <button onClick={next} className="text-sm font-medium text-slate-400 hover:text-white">
                    Skip this step
                  </button>
                  <button
                    onClick={createCampaign}
                    className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow"
                  >
                    Create campaign
                  </button>
                </div>
              </div>
            </Step>
          )}

          {step === 'link' && (
            <Step
              title="Create your first tracked link"
              subtitle="Schedlytics uses smart short links to track which content drives traffic."
            >
              {createdUrl ? (
                <div className="rounded-xl border border-cyan-accent/30 bg-cyan-accent/5 p-4 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl gradient-cyan text-navy-900">
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">Your first tracked link is ready</p>
                  <code className="mt-2 block break-all rounded-lg bg-navy-900/70 px-3 py-2 font-mono text-xs text-cyan-accent">
                    {createdUrl}
                  </code>
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={copyLink}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <a
                      href={createdUrl.startsWith('http') ? createdUrl : `https://${createdUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                  </div>
                  <button
                    onClick={next}
                    className="mt-4 w-full rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Destination URL</label>
                  <input
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    placeholder="https://yoursite.com/offer"
                    className="w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    We will tag it to {state.firstCampaignName ? `the ${state.firstCampaignName} campaign` : 'your campaign'}
                    {state.firstPlatform ? ` and ${PLATFORMS[state.firstPlatform].name}` : ''}, and add UTM
                    parameters automatically.
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <BackBtn onClick={back} />
                    <div className="flex items-center gap-3">
                      <button onClick={next} className="text-sm font-medium text-slate-400 hover:text-white">
                        Skip this step
                      </button>
                      <button
                        onClick={createLink}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow disabled:opacity-60"
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        Create tracked link
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Step>
          )}

          {step === 'conversion' && (
            <Step
              title="Want to track signups, sales, or goals?"
              subtitle="Clicks are tracked automatically. Add conversion tracking when you are ready to connect traffic to outcomes."
            >
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="rounded-lg border border-white/10 bg-navy-900/50 px-3 py-2">
                  Add the tracking script and goal pages in Settings, under Conversion Tracking.
                </li>
                <li className="rounded-lg border border-white/10 bg-navy-900/50 px-3 py-2">
                  Add manual revenue against a campaign or content item any time.
                </li>
                <li className="rounded-lg border border-dashed border-white/10 bg-navy-900/40 px-3 py-2 text-slate-500">
                  Stripe, Shopify, and CRM connections are coming soon.
                </li>
              </ul>
              <div className="mt-5 flex items-center justify-between">
                <BackBtn onClick={back} />
                <button
                  onClick={() => {
                    markDone('conversion')
                    next()
                  }}
                  className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 shadow-glow"
                >
                  Finish setup
                </button>
              </div>
            </Step>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-cyan text-navy-900 shadow-glow">
                <PartyPopper className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">You are ready 🎉</h2>
              <p className="mt-1 text-sm text-slate-400">Your workspace has been created.</p>

              <ul className="mx-auto mt-4 max-w-[16rem] space-y-2 text-left">
                <DoneRow done={isDone('campaign')} label="Campaign created" />
                <DoneRow done={isDone('link')} label="Tracked link ready" />
                <DoneRow done label="Dashboard personalized" />
              </ul>

              {/* workspace stats */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <WorkspaceStat value={isDone('campaign') ? 1 : 0} label="Campaigns" />
                <WorkspaceStat value={isDone('link') ? 1 : 0} label="Tracked links" />
                <WorkspaceStat value={state.firstPlatform ? 1 : 0} label="Platforms" />
              </div>

              {/* aha preview */}
              <div className="mt-4 rounded-xl border border-white/10 bg-navy-900/50 p-4 text-left">
                <p className="text-sm font-semibold text-white">Your dashboard is ready</p>
                <p className="mt-0.5 text-xs text-slate-400">You'll soon be tracking</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {['Clicks', 'Visitors', 'Best-performing content', 'Best platform', 'Revenue (when connected)'].map((b) => (
                    <span key={b} className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Check className="h-3.5 w-3.5 shrink-0 text-cyan-accent" strokeWidth={2.5} /> {b}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={finish}
                className="mt-5 w-full rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow"
              >
                Open My Dashboard
              </button>
              {state.firstTrackedUrl && (
                <button
                  onClick={copyFirstLink}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy my first link
                </button>
              )}

              {/* next step: bridge to the first real click */}
              <div className="mt-4 rounded-xl border border-cyan-accent/20 bg-cyan-accent/5 p-4 text-left">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <Rocket className="h-4 w-4 text-cyan-accent" /> Next step
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Share your tracked link in your next YouTube description, Pinterest pin, newsletter, or
                  bio. We start tracking visitors the moment someone clicks.
                </p>
              </div>

              <p className="mt-4 text-xs italic text-slate-500">Every click starts a story.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- helpers --------------------------------- */

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {subtitle && <p className="mb-4 mt-1 text-sm text-slate-400">{subtitle}</p>}
      {children}
    </div>
  )
}

function Choice({ label, selected, onClick }: { label: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
        selected
          ? 'border-cyan-accent/50 bg-cyan-accent/10 text-white'
          : 'border-white/10 bg-navy-900/50 text-slate-300 hover:border-white/20 hover:text-white'
      }`}
    >
      {label}
      {selected && <Check className="h-4 w-4 text-cyan-accent" />}
    </button>
  )
}

function PlatformCard({
  platform,
  onClick,
  soon,
  done,
}: {
  platform: PlatformId
  onClick?: () => void
  soon?: boolean
  done?: boolean
}) {
  const p = PLATFORMS[platform]
  const { Icon } = p
  if (soon || isComingSoon(platform)) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-navy-900/40 px-2 py-3 text-center opacity-60">
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${p.gradient} text-white`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs text-slate-400">{p.name}</span>
        <span className="text-[10px] font-semibold text-amber-300/70">Soon</span>
      </div>
    )
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        done ? 'border-cyan-accent/50 bg-cyan-accent/10' : 'border-white/10 bg-navy-900/50 hover:border-white/20'
      }`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${p.gradient} text-white`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold text-white">{p.name}</span>
      {done && <Check className="ml-auto h-4 w-4 text-cyan-accent" />}
    </button>
  )
}

function DoneRow({ done, label }: { done?: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          done ? 'gradient-cyan text-navy-900' : 'border border-white/15 text-transparent'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className={done ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
    </li>
  )
}

function WorkspaceStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-navy-900/50 p-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  )
}

/* -------------------------- first-run checklist -------------------------- */

/** Setup progress card shown on the dashboard until setup is complete. */
export function SetupChecklist({ onShareHint }: { onShareHint?: () => void }) {
  const { state, open } = useOnboarding()
  if (sampleData || state.setupComplete) return null

  const doneCount = SETUP_STEPS.filter((s) => state.completed.includes(s.key)).length
  // Nothing started and not dismissed: the wizard will open on its own.
  if (doneCount === 0 && !state.dismissed) return null

  const nextStep = SETUP_STEPS.find((s) => !state.completed.includes(s.key))

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2 text-cyan-accent">
          <Rocket className="h-4 w-4" />
          <span className="text-sm font-bold text-white">Finish setting up</span>
        </div>
        <span className="text-xs text-slate-400">
          {doneCount} of {SETUP_STEPS.length} completed
        </span>
        <button
          onClick={open}
          className="ml-auto rounded-lg border border-cyan-accent/30 px-3 py-1.5 text-xs font-semibold text-cyan-accent hover:bg-cyan-accent/10"
        >
          Continue setup
        </button>
      </div>
      <div className="grid gap-2 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
        {SETUP_STEPS.map((s) => {
          const done = state.completed.includes(s.key)
          return (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  done ? 'gradient-cyan text-navy-900' : 'border border-white/15 text-transparent'
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={done ? 'text-slate-400 line-through' : 'text-slate-200'}>{s.label}</span>
            </div>
          )
        })}
      </div>
      {nextStep && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-cyan-accent/5 px-5 py-3 text-sm text-slate-300">
          <span className="font-semibold text-white">Next:</span>
          {nextStep.key === 'share'
            ? 'Share your tracked link in your next post, video description, or bio.'
            : nextStep.label}
          {nextStep.key === 'share' && onShareHint && (
            <button onClick={onShareHint} className="ml-auto text-xs font-semibold text-cyan-accent hover:underline">
              View your links
            </button>
          )}
        </div>
      )}
      {/* allow marking the share step done once they have a link */}
      {state.completed.includes('link') && !state.completed.includes('share') && (
        <ShareDoneButton />
      )}
    </div>
  )
}

function ShareDoneButton() {
  const { markDone } = useOnboarding()
  return (
    <div className="border-t border-white/5 px-5 py-3">
      <button
        onClick={() => markDone('share')}
        className="text-xs font-semibold text-cyan-accent hover:underline"
      >
        I shared my link
      </button>
    </div>
  )
}
