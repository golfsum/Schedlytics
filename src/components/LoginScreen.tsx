import { useState } from 'react'
import { Loader2, Mail, Lock, Check, X as XIcon, Eye, EyeOff } from 'lucide-react'
import { BrandIcon } from './Logo'
import { useAuth } from './Auth'

/** Password requirements enforced on account creation. */
const PASSWORD_RULES = [
  { key: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'A number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'A special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

/** 0-4 score + label/color for the strength meter. */
function passwordStrength(p: string) {
  if (!p) return { score: 0, label: '', color: 'bg-white/10', text: 'text-slate-500' }
  let score = PASSWORD_RULES.filter((r) => r.test(p)).length
  if (p.length >= 12 && score === 4) score = 5 // bonus tier for long + all rules
  const tiers = [
    { label: 'Very weak', color: 'bg-rose-500', text: 'text-rose-300' },
    { label: 'Weak', color: 'bg-rose-500', text: 'text-rose-300' },
    { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-300' },
    { label: 'Good', color: 'bg-cyan-accent', text: 'text-cyan-accent' },
    { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-300' },
    { label: 'Very strong', color: 'bg-emerald-500', text: 'text-emerald-300' },
  ]
  return { score, ...tiers[score] }
}

/** Sign-in screen shown at /app when the user is not authenticated. */
export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, registerWithEmail, resetPassword } = useAuth()
  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  const ruleResults = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }))
  const allRulesMet = ruleResults.every((r) => r.ok)
  const passwordsMatch = confirm.length > 0 && password === confirm
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  const strength = passwordStrength(password)
  const canRegister = emailValid && allRulesMet && passwordsMatch

  const goMode = (m: 'signin' | 'register' | 'reset') => {
    setMode(m)
    setError(null)
    setResetSent(false)
    setConfirm('')
  }

  const google = async () => {
    setError(null)
    setBusy('google')
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(friendly(e))
    } finally {
      setBusy(null)
    }
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'register' && !canRegister) {
      setError(!allRulesMet ? 'Your password does not meet all the requirements yet.' : 'The passwords do not match.')
      return
    }
    setError(null)
    setBusy('email')
    try {
      if (mode === 'signin') await signInWithEmail(email, password)
      else await registerWithEmail(email, password)
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(null)
    }
  }

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy('email')
    try {
      await resetPassword(email)
      setResetSent(true) // neutral: shown whether or not an account exists
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy-950 px-4 text-slate-200">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandIcon className="h-12 w-12 rounded-2xl ring-1 ring-white/10" />
          <h1 className="mt-4 text-2xl font-bold text-white">
            {mode === 'reset' ? 'Reset your password' : mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'reset'
              ? 'Enter your email and we will send you a password reset link.'
              : mode === 'signin'
                ? 'Sign in to your Schedlytics dashboard.'
                : 'Start scheduling smarter in minutes.'}
          </p>
        </div>

        <div className="card p-6">
          {mode === 'reset' ? (
            resetSent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-cyan-accent/15 text-cyan-accent">
                  <Mail className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-300">
                  If an account exists for <span className="font-semibold text-white">{email}</span>, a reset
                  link has been sent. Check your inbox and spam folder.
                </p>
                <button
                  onClick={() => goMode('signin')}
                  className="w-full rounded-lg border border-white/15 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={submitReset} className="space-y-3">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                  />
                </div>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
                >
                  {busy === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </button>
                <button
                  type="button"
                  onClick={() => goMode('signin')}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
          <>
          <button
            onClick={google}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white py-2.5 text-sm font-semibold text-navy-900 transition-transform hover:scale-[1.01] disabled:opacity-70"
          >
            {busy === 'google' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.7 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z" />
                <path fill="#FBBC05" d="M10.4 28.3a14.5 14.5 0 0 1 0-8.6l-7.8-6.1a24 24 0 0 0 0 20.8l7.8-6.1z" />
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.1-5.5c-2 1.3-4.6 2.1-8.1 2.1-6.4 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submitEmail} className="space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Password"
                className="w-full rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:text-slate-200"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {mode === 'register' && (
              <>
                {/* live strength meter */}
                {password && (
                  <div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Strength</span>
                      <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                    </div>
                    <div className="mt-1 flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < Math.min(strength.score, 4) ? strength.color : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* requirements - tick off as the user types */}
                <ul className="space-y-1">
                  {ruleResults.map((r) => (
                    <li
                      key={r.key}
                      className={`flex items-center gap-1.5 text-[11px] ${r.ok ? 'text-emerald-300' : 'text-slate-500'}`}
                    >
                      {r.ok ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3 text-slate-600" />}
                      {r.label}
                    </li>
                  ))}
                </ul>

                {/* re-type password */}
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    type={showConfirm ? 'text' : 'password'}
                    required
                    placeholder="Re-type password"
                    className="w-full rounded-lg border border-white/5 bg-navy-900/60 py-2.5 pl-9 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:text-slate-200"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm.length > 0 &&
                  (passwordsMatch ? (
                    <p className="flex items-center gap-1 text-[11px] text-emerald-300">
                      <Check className="h-3 w-3" /> Passwords match
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-[11px] text-rose-400">
                      <XIcon className="h-3 w-3" /> Passwords do not match
                    </p>
                  ))}
              </>
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => goMode('reset')}
                  className="text-xs font-semibold text-cyan-accent hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-xs text-rose-400">{error}</p>}

            {mode === 'register' && (
              <p className="text-center text-[11px] leading-relaxed text-slate-500">
                By creating an account, you agree to the{' '}
                <a href="/terms" target="_blank" rel="noreferrer" className="text-cyan-accent hover:underline">
                  Terms
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-cyan-accent hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            )}

            <button
              type="submit"
              disabled={busy !== null || (mode === 'register' && !canRegister)}
              className="flex w-full items-center justify-center gap-2 rounded-lg gradient-cyan py-2.5 text-sm font-bold text-navy-900 shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-70 disabled:hover:scale-100"
            >
              {busy === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            {mode === 'register' && (
              <p className="text-center text-[11px] text-slate-500">
                Early Access pricing is locked in while your subscription stays active.
              </p>
            )}
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => goMode(mode === 'signin' ? 'register' : 'signin')}
              className="font-semibold text-cyan-accent hover:underline"
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>

          <p className="mt-3 border-t border-white/5 pt-3 text-center text-[11px] text-slate-500">
            Secure sign-in powered by Google and Firebase.
          </p>
          </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
          <a href="/app/?demo=1" className="hover:text-slate-300">
            Try the demo
          </a>
          <span>·</span>
          <a href="/" className="hover:text-slate-300">
            Back to site
          </a>
        </div>
      </div>
    </div>
  )
}

/** Turn a Firebase auth error into a short human message. */
function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Wrong email or password.'
  if (code.includes('email-already-in-use')) return 'That email is already registered. Try signing in.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('popup-closed')) return 'Sign-in was cancelled.'
  if (code.includes('unauthorized-domain')) return 'This domain is not authorized in Firebase Auth settings.'
  return (e as Error)?.message || 'Something went wrong. Please try again.'
}
