import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PORT, BASE_URL, FRONTEND_URL, creds, ashrt } from './config.js'
import { getPlatform, platforms, PUBLISH_CAPABILITIES } from './platforms/index.js'
import { store } from './store.js'
import { links } from './links-store.js'
import { scheduled } from './scheduled-store.js'
import { weeklySubs } from './weekly-store.js'
import { earlyAccess, EA_CAP } from './early-access-store.js'
import { support } from './support-store.js'
import { analytics } from './analytics-store.js'
import { errors as errorLog } from './error-store.js'
import { banner } from './banner-store.js'
import { checkHealth } from './health.js'
import { registerBillingRoutes, stripeWebhook } from './billing.js'
import { tagRedirect, registerPublicConversionRoutes, registerConversionRoutes } from './conversions.js'
import { sendEmail, emailEnabled } from './email.js'
import { isConfigured as fbAdminConfigured, listUsers, passwordResetLink, setUserDisabled } from './lib/firebaseAdmin.js'
import { verifyIdToken } from './lib/firebaseAuth.js'
import { stateStore } from './kv.js'
import { validAccessToken } from './tokens.js'
import youtubeRoutes from './routes/youtube.js'
import aiRoutes from './routes/ai.js'
import settingsRoutes from './routes/settings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_DIR = join(__dirname, '..', 'site')

const app = express()
// The Stripe webhook needs the raw request body to verify its signature, so it
// must be registered BEFORE the global JSON parser below.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook)
// Conversion tracking endpoints are called from arbitrary customer sites, so
// they set their own permissive CORS and must be registered before the app's
// restrictive CORS below.
registerPublicConversionRoutes(app, express)
app.use(express.json())
// Allow the configured frontend origin plus any localhost port (the dev server
// port can vary), so requests are not blocked by CORS during local development.
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const ok =
        origin === FRONTEND_URL ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      cb(null, ok)
    },
    credentials: true,
  }),
)

// Platform-specific routes (extras beyond generic stats).
app.use('/api/youtube', youtubeRoutes)
// AI suggestions (Claude-backed when ANTHROPIC_API_KEY is set).
app.use('/api/ai', aiRoutes)
// Per-user settings sync (requires FIREBASE_PROJECT_ID).
app.use('/api/settings', settingsRoutes)
// Stripe subscriptions: checkout, billing portal, plan status (no-op until
// STRIPE_SECRET_KEY is set). The webhook is registered above (raw body).
registerBillingRoutes(app)
// Conversion tracking dashboard + goal settings (per-user, Firebase token).
registerConversionRoutes(app)

/* -------------------------------------------------------------------------- */
/*  Marketing + legal site (landing, privacy, terms, data deletion)            */
/*    Served from /site so the legal pages have real, linkable URLs for the    */
/*    platform app reviews (e.g. {BASE_URL}/privacy, {BASE_URL}/data-deletion).  */
/* -------------------------------------------------------------------------- */

// Marketing + legal site lives at the root; the app lives at /app.
// (On Vercel these are served statically from out/; this mirror is for running
// the backend directly in local dev.)
if (existsSync(SITE_DIR)) {
  app.use(express.static(SITE_DIR))
  app.use('/site-media', express.static(join(SITE_DIR, 'assets')))
  app.get('/', (_req, res) => res.sendFile(join(SITE_DIR, 'index.html')))
  app.get('/welcome', (_req, res) => res.redirect(301, '/')) // back-compat
  app.get('/privacy', (_req, res) => res.sendFile(join(SITE_DIR, 'privacy.html')))
  app.get('/terms', (_req, res) => res.sendFile(join(SITE_DIR, 'terms.html')))
  app.get('/data-deletion', (_req, res) => res.sendFile(join(SITE_DIR, 'data-deletion.html')))
  // SEO landing pages (clean URLs -> their .html). On Vercel cleanUrls does this
  // automatically; this mirror keeps the same routes working in local dev.
  for (const slug of [
    'social-media-analytics',
    'youtube-analytics',
    'campaign-tracking',
    'link-tracking',
    'utm-builder',
    'tools',
    'guides',
    'track-content-that-drives-sales',
    'find-your-best-performing-platform',
    'utm-best-practices',
  ]) {
    app.get(`/${slug}`, (_req, res) => res.sendFile(join(SITE_DIR, `${slug}.html`)))
  }
}

// CSRF "state" lives in KV (prod) or memory (local), with a 10-minute TTL.
const STATE_TTL = 600 // seconds

/* -------------------------------------------------------------------------- */
/*  Health + config introspection                                              */
/* -------------------------------------------------------------------------- */

app.get('/health', (_req, res) => res.json({ ok: true, store: store.driver }))

// EARLY_ACCESS is on unless explicitly set to "false".
const EARLY_ACCESS_ON = process.env.EARLY_ACCESS !== 'false'

// Which platforms have credentials configured (so the UI can hint setup).
app.get('/api/config', async (_req, res) => {
  const configured = {}
  for (const id of Object.keys(platforms)) {
    configured[id] = Boolean(creds[id]?.clientId || creds[id]?.clientKey)
  }
  let spotsLeft = EA_CAP
  try {
    spotsLeft = Math.max(0, EA_CAP - (await earlyAccess.acceptedCount()))
  } catch {
    /* store unavailable - report full cap */
  }
  res.json({ configured, baseUrl: BASE_URL, earlyAccess: EARLY_ACCESS_ON, eaCap: EA_CAP, eaSpotsLeft: spotsLeft })
})

/** Confirmation email sent to a new early-access sign-up. */
function earlyAccessConfirmHtml(accepted) {
  const appUrl = `${FRONTEND_URL}/`
  const lead = accepted
    ? 'You are in. You are one of the first creators getting early access to Schedlytics.'
    : 'Thanks for signing up. The first round is full, so you are on the waitlist and we will be in touch as spots open.'
  return `<!doctype html><html><body style="margin:0;background:#0b1120;font-family:Inter,Arial,sans-serif;color:#e2e8f0">
    <div style="max-width:540px;margin:0 auto;padding:28px 20px">
      <div style="font-size:20px;font-weight:800;color:#fff">Sched<span style="color:#22d3ee">lytics</span></div>
      <h1 style="font-size:22px;color:#fff;margin:20px 0 8px">${accepted ? 'Welcome to early access' : 'You are on the waitlist'}</h1>
      <p style="color:#94a3b8;margin:0 0 18px">${lead}</p>
      <p style="color:#e2e8f0;margin:0 0 8px">As an early member you get lifetime early adopter pricing, direct access to new features, a say in the roadmap, and priority support.</p>
      <a href="${appUrl}" style="display:inline-block;margin-top:14px;padding:12px 22px;background:linear-gradient(135deg,#22d3ee,#0ea5e9);color:#0f172a;font-weight:700;text-decoration:none;border-radius:12px">Visit Schedlytics</a>
    </div></body></html>`
}

/** Notify the owner and confirm to the signer. Best-effort; never throws. */
async function notifyEarlyAccess(email, result) {
  if (result.already) return
  const adminTo = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
  try {
    if (adminTo) {
      await sendEmail({
        to: adminTo,
        subject: `New early-access signup (${result.status})`,
        html: `<p><b>${email}</b> requested early access.</p><p>Status: <b>${result.status}</b>. Spots left: ${result.spotsLeft}.</p>`,
      })
    }
    await sendEmail({
      to: email,
      subject: result.status === 'accepted' ? 'You are in: Schedlytics early access' : 'You are on the Schedlytics waitlist',
      html: earlyAccessConfirmHtml(result.status === 'accepted'),
    })
  } catch (err) {
    console.warn('[early-access] email failed:', err.message)
  }
}

// Early-access sign-up: first EA_CAP accepted, rest waitlisted.
app.post('/api/early-access', async (req, res) => {
  const { email } = req.body || {}
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    return res.status(400).json({ error: 'A valid email is required' })
  }
  try {
    const result = await earlyAccess.add(email)
    await notifyEarlyAccess(email, result)
    res.json(result)
  } catch (err) {
    console.error('[early-access] failed:', err.message)
    res.status(500).json({ error: 'Could not save your sign-up. Please try again.' })
  }
})

/* -------------------------------------------------------------------------- */
/*  Site analytics. A tiny first-party beacon counts page loads + demo opens.   */
/*  Privacy-friendly: we store only salted IP+UA hashes to de-dupe visitors.    */
/* -------------------------------------------------------------------------- */

// IPs to ignore (e.g. the owner's own address). Set ANALYTICS_EXCLUDE_IPS in
// Vercel as a comma-separated list.
const ANALYTICS_EXCLUDE_IPS = (process.env.ANALYTICS_EXCLUDE_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()

// Public beacon. POST /api/track?type=demo when the demo is opened. Never errors
// (a tracking failure must not affect the page); skips excluded IPs and bots.
app.post('/api/track', async (req, res) => {
  try {
    const ip = clientIp(req)
    const ua = req.get('user-agent') || ''
    const isBot = /bot|crawl|spider|slurp|preview|monitor|lighthouse|headless|curl|wget/i.test(ua)
    if (ip && ANALYTICS_EXCLUDE_IPS.includes(ip)) return res.json({ ok: true, skipped: 'excluded' })
    if (isBot) return res.json({ ok: true, skipped: 'bot' })
    const visitor = crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16)
    const type = ['site', 'app', 'demo'].includes(req.query.type) ? req.query.type : 'site'
    await analytics.record({ visitor, type })
    res.json({ ok: true })
  } catch {
    res.json({ ok: false })
  }
})

// Public beacon for errors a user hit in the app (powers the admin Errors tab).
// Never errors; ignores bots.
app.post('/api/track-error', async (req, res) => {
  try {
    const ua = req.get('user-agent') || ''
    if (/bot|crawl|spider|lighthouse|headless/i.test(ua)) return res.json({ ok: true })
    const { context, message, email, platform, url } = req.body || {}
    if (message || context) {
      const event = await errorLog.add({ context, message, email, platform, url, source: 'client' })
      // Alert the owner by email on a new error type or a spike (best-effort).
      if (emailEnabled) {
        errorLog
          .maybeAlert(event)
          .then((alert) => alert && notifyErrorAlert(alert))
          .catch((e) => console.warn('[error-alert] failed:', e.message))
      }
    }
    res.json({ ok: true })
  } catch {
    res.json({ ok: false })
  }
})

/** Email the owner when an error is new or spiking. */
async function notifyErrorAlert(alert) {
  const to = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
  if (!to) return
  const subject =
    alert.reason === 'new'
      ? `New error in Schedlytics: ${alert.context}`
      : `Error spike in Schedlytics: ${alert.context} (${alert.hourCount} in the last hour)`
  const body =
    alert.reason === 'new'
      ? 'This error appeared for the first time.'
      : `It happened ${alert.hourCount} times in the last hour (${alert.total} total).`
  const safe = String(alert.message || '').replace(/</g, '&lt;')
  await sendEmail({
    to,
    subject,
    html: `<p><b>${alert.context}</b></p><p>${safe}</p><p>${body}</p><p>Open the admin Errors tab for details.</p>`,
  })
}

/* -------------------------------------------------------------------------- */
/*  Admin (early access + support). Auth: ADMIN_SECRET, or a Firebase ID token  */
/*  whose verified email is in ADMIN_EMAILS.                                    */
/* -------------------------------------------------------------------------- */

const ADMIN_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

/** Returns the admin identity ('secret' or an email) for the request, or null. */
async function adminOf(req) {
  const bearer = (req.get('authorization') || '').replace(/^Bearer /, '') || String(req.query.secret || '')
  if (!bearer) return null
  if (process.env.ADMIN_SECRET && bearer === process.env.ADMIN_SECRET) return 'secret'
  if (ADMIN_PROJECT_ID && ADMIN_EMAILS.length) {
    try {
      const { email } = await verifyIdToken(bearer, ADMIN_PROJECT_ID)
      if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return email.toLowerCase()
    } catch {
      /* not an admin token */
    }
  }
  return null
}

// Lets the app decide whether to show the Admin nav for the signed-in user.
app.get('/api/admin/me', async (req, res) => {
  res.json({ admin: Boolean(await adminOf(req)) })
})

// One-screen overview: the day's headline numbers across every admin area.
app.get('/api/admin/overview', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const [an, ea, tickets, errs] = await Promise.all([
    analytics.summary(),
    earlyAccess.all(),
    support.all(),
    errorLog.summary(),
  ])
  res.json({
    viewsToday: an.today.views,
    uniquesToday: an.today.uniques,
    demoToday: an.today.demo,
    signups: ea.length,
    accepted: ea.filter((e) => e.status === 'accepted').length,
    waitlist: ea.filter((e) => e.status === 'waitlist').length,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    totalTickets: tickets.length,
    errors24h: errs.last24h,
    errorsTotal: errs.total,
  })
})

// Site traffic: views + unique visitors (today / week / month) + demo opens.
app.get('/api/admin/analytics', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  res.json(await analytics.summary())
})

// Errors users hit: top by frequency, most-affected users, recent occurrences.
// ?format=csv exports the full log.
app.get('/api/admin/errors', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  if (req.query.format === 'csv') {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const all = await errorLog.all()
    const rows = [
      'time,context,message,email,platform,url,source',
      ...all.map((e) =>
        [new Date(e.at).toISOString(), e.context, e.message, e.email, e.platform, e.url, e.source].map(cell).join(','),
      ),
    ]
    return res.type('text/csv').send(rows.join('\n'))
  }
  res.json(await errorLog.summary())
})

// Clear the error log (housekeeping after a fix ships).
app.delete('/api/admin/errors', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  await errorLog.clear()
  res.json({ ok: true })
})

// Resolve / unresolve an error group. { context, message, acked }
app.post('/api/admin/errors/ack', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const { context, message, acked = true } = req.body || {}
  await errorLog.ack(context, message, acked)
  res.json({ ok: true })
})

/* -- Broadcast banner: public read, admin write. ------------------------- */
app.get('/api/banner', async (_req, res) => res.json(await banner.get()))

app.post('/api/admin/banner', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const { message, type } = req.body || {}
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'A message is required' })
  res.json(await banner.set({ message, type }))
})

app.delete('/api/admin/banner', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  await banner.clear()
  res.json({ ok: true })
})

// Live uptime checks for platform APIs, AI, storage, email, and the shortener.
app.get('/api/admin/health', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  try {
    res.json({ checks: await checkHealth(), at: Date.now() })
  } catch (err) {
    console.error('[admin/health] failed:', err.message)
    res.status(502).json({ error: err.message })
  }
})

// Send a real test email to confirm SMTP actually delivers (not just configured).
app.post('/api/admin/send-test-email', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  if (!emailEnabled) return res.status(400).json({ error: 'Email is not configured. Set the SMTP_* env vars first.' })
  const to = String(req.body?.to || process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim()
  if (!to) return res.status(400).json({ error: 'No recipient. Set ADMIN_EMAIL.' })
  try {
    await sendEmail({
      to,
      subject: 'Schedlytics test email',
      html: '<p>This is a test email from your Schedlytics admin dashboard.</p><p>If you can read this, SMTP is working and emails are delivering.</p>',
    })
    res.json({ ok: true, to })
  } catch (err) {
    console.error('[admin/send-test-email] failed:', err.message)
    res.status(502).json({ ok: false, error: err.message })
  }
})

// List early-access sign-ups (JSON or ?format=csv).
app.get('/api/admin/early-access', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const all = (await earlyAccess.all()).sort((a, b) => (a.at || 0) - (b.at || 0))
  if (req.query.format === 'csv') {
    const rows = ['email,status,signed_up', ...all.map((e) => `${e.email},${e.status},${new Date(e.at || 0).toISOString()}`)]
    return res.type('text/csv').send(rows.join('\n'))
  }
  res.json({
    total: all.length,
    accepted: all.filter((e) => e.status === 'accepted').length,
    waitlist: all.filter((e) => e.status === 'waitlist').length,
    cap: EA_CAP,
    signups: all,
  })
})

// Submit a support ticket (public for signed-in users; notifies the owner).
app.post('/api/support', async (req, res) => {
  const { email, subject, message, userId } = req.body || {}
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    return res.status(400).json({ error: 'A valid email is required' })
  }
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'A message is required' })
  try {
    const ticket = await support.add({ email, subject, message, userId })
    const adminTo = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
    if (adminTo) {
      try {
        await sendEmail({
          to: adminTo,
          subject: `New support ticket: ${ticket.subject || '(no subject)'}`,
          html: `<p>From: <b>${ticket.email}</b></p><p>${(ticket.message || '').replace(/</g, '&lt;')}</p>`,
        })
      } catch (e) {
        console.warn('[support] notify failed:', e.message)
      }
    }
    res.json({ ok: true, id: ticket.id })
  } catch (err) {
    console.error('[support] failed:', err.message)
    res.status(500).json({ error: 'Could not submit your message. Please try again.' })
  }
})

app.get('/api/admin/support', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  res.json({ tickets: await support.all() })
})

app.patch('/api/admin/support/:id', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const status = req.body?.status
  if (!['open', 'resolved'].includes(status)) return res.status(400).json({ error: 'invalid status' })
  const next = await support.update(req.params.id, { status })
  if (!next) return res.status(404).json({ error: 'not found' })
  res.json(next)
})

/* -- Firebase user management (v2). Needs a service account; see firebaseAdmin.js. */

// List Firebase Auth users. { configured:false } when the Admin SDK has no creds.
app.get('/api/admin/users', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  try {
    const users = await listUsers()
    if (users === null) return res.json({ configured: false, users: [] })
    res.json({ configured: true, users })
  } catch (err) {
    // Admin-only endpoint, so it's safe to surface the real cause (e.g. a bad
    // private key or a missing IAM role) to help configure the service account.
    console.error('[admin/users] failed:', err)
    res.status(500).json({ error: 'Could not list users', detail: err.message, code: err.code || null })
  }
})

// Mint a password-reset link for an email and (if SMTP is set) send it to them.
app.post('/api/admin/users/reset-link', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const email = String(req.body?.email || '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' })
  try {
    const link = await passwordResetLink(email)
    if (link === null) return res.status(400).json({ error: 'Firebase Admin is not configured' })
    let emailed = false
    if (emailEnabled) {
      try {
        await sendEmail({
          to: email,
          subject: 'Reset your Schedlytics password',
          html: `<p>A password reset was requested for your Schedlytics account.</p><p><a href="${link}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        })
        emailed = true
      } catch (e) {
        console.warn('[admin/reset-link] email failed:', e.message)
      }
    }
    res.json({ link, emailed })
  } catch (err) {
    // e.g. auth/user-not-found
    console.error('[admin/reset-link] failed:', err.message)
    res.status(400).json({ error: err.message || 'Could not create reset link' })
  }
})

// Enable or disable a user account.
app.patch('/api/admin/users/:uid', async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: 'unauthorized' })
  const { disabled } = req.body || {}
  if (typeof disabled !== 'boolean') return res.status(400).json({ error: 'disabled must be a boolean' })
  try {
    const ok = await setUserDisabled(req.params.uid, disabled)
    if (ok === null) return res.status(400).json({ error: 'Firebase Admin is not configured' })
    res.json({ ok: true, uid: req.params.uid, disabled })
  } catch (err) {
    console.error('[admin/users patch] failed:', err.message)
    res.status(400).json({ error: err.message || 'Could not update user' })
  }
})

/* -------------------------------------------------------------------------- */
/*  OAuth - start                                                              */
/*    GET /auth/:platform/start  → 302 redirect to the provider's consent page */
/* -------------------------------------------------------------------------- */

app.get('/auth/:platform/start', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).send('Unknown platform')

  const cfg = creds[platform.id]
  if (!cfg?.clientId && !cfg?.clientKey) {
    return res
      .status(500)
      .send(`${platform.name} is not configured. Add its credentials to .env`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  await stateStore.set(state, { platform: platform.id, popup: req.query.popup === '1' }, STATE_TTL)
  res.redirect(platform.getAuthUrl(state))
})

/**
 * HTML returned to an OAuth popup: posts the result back to the opener and
 * closes itself, so the Schedlytics tab never navigates away.
 */
function popupResultPage(platform, status, error) {
  const payload = JSON.stringify({ type: 'schedlytics-oauth', platform, status, error: error || null })
  const msg = status === 'connected' ? 'Connected! You can close this window.' : 'Connection failed.'
  return `<!doctype html><html><head><meta charset="utf-8"><title>${msg}</title></head>
<body style="background:#0F172A;color:#e2e8f0;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0">
<p>${msg}</p>
<script>
  try { if (window.opener) window.opener.postMessage(${payload}, '*') } catch (e) {}
  window.close();
  setTimeout(function () { document.body.insertAdjacentHTML('beforeend', '<p style="opacity:.6">You can close this window.</p>') }, 400);
</script>
</body></html>`
}

/* -------------------------------------------------------------------------- */
/*  OAuth - callback                                                           */
/*    GET /auth/:platform/callback?code=...&state=...                          */
/*    Exchanges the code, stores tokens, returns the user to the React app.    */
/* -------------------------------------------------------------------------- */

app.get('/auth/:platform/callback', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).send('Unknown platform')

  const { code, state, error, error_description } = req.query

  // Verify CSRF state (also tells us whether this came from a popup).
  const entry = state && (await stateStore.get(String(state)))
  const popup = Boolean(entry?.popup)

  // Finish by either closing the popup (postMessage) or redirecting the page.
  const finish = (status, errMsg) => {
    if (popup) {
      return res.type('html').send(popupResultPage(platform.id, status, errMsg))
    }
    const qs = status === 'connected' ? `connected=${platform.id}` : `error=${encodeURIComponent(errMsg || 'oauth')}`
    return res.redirect(`${FRONTEND_URL}/?${qs}`)
  }

  if (error) return finish('error', String(error_description || error))
  if (!entry || entry.platform !== platform.id) return finish('error', 'invalid_state')
  await stateStore.del(String(state))

  try {
    const tokens = await platform.exchangeCode(String(code))
    await store.set(platform.id, tokens)
    // Fetch + cache a profile so the dashboard has something immediately.
    try {
      const stats = await platform.getStats(tokens.accessToken, tokens)
      await store.set(platform.id, {
        profile: { handle: stats.handle, name: stats.name, avatar: stats.avatar, followers: stats.followers },
      })
    } catch (e) {
      // best-effort: connection still succeeds even if the first profile read fails
      console.warn(`[${platform.id}] profile fetch failed:`, e.message)
    }
    finish('connected')
  } catch (err) {
    console.error(`[${platform.id}] callback error:`, err.message)
    finish('error', err.message)
  }
})

/* -------------------------------------------------------------------------- */
/*  Accounts - connection status for every platform                            */
/* -------------------------------------------------------------------------- */

app.get('/api/accounts', async (_req, res) => {
  const all = await store.all()
  const accounts = {}
  for (const id of Object.keys(platforms)) {
    const rec = all[id]
    accounts[id] = rec
      ? { connected: true, connecting: false, ...(rec.profile || {}) }
      : { connected: false, connecting: false }
  }
  res.json(accounts)
})

/* -------------------------------------------------------------------------- */
/*  Stats - live fetch for one platform (auto-refreshes the token if needed)   */
/* -------------------------------------------------------------------------- */

app.get('/api/:platform/stats', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).json({ error: 'Unknown platform' })

  try {
    const { token, record } = await validAccessToken(platform)
    const stats = await platform.getStats(token, record)
    // refresh the cached profile too
    await store.set(platform.id, {
      profile: { handle: stats.handle, name: stats.name, avatar: stats.avatar, followers: stats.followers },
    })
    res.json(stats)
  } catch (err) {
    console.error(`[${platform.id}] stats error:`, err.message)
    res.status(err.status || 502).json({ error: err.message })
  }
})

/* -------------------------------------------------------------------------- */
/*  Publishing - generic post dispatch + capability map                        */
/* -------------------------------------------------------------------------- */

// What each platform can publish right now (so the UI can label accordingly).
app.get('/api/publish/capabilities', (_req, res) => res.json(PUBLISH_CAPABILITIES))

app.post('/api/:platform/publish', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).json({ error: 'Unknown platform' })
  if (typeof platform.publish !== 'function') {
    const cap = PUBLISH_CAPABILITIES[platform.id]
    return res.status(400).json({
      error: `Direct publishing to ${platform.name} isn't available yet. ${cap?.note || ''}`.trim(),
    })
  }
  try {
    const { token, record } = await validAccessToken(platform)
    const result = await platform.publish(token, record, req.body || {})
    res.json(result)
  } catch (err) {
    console.error(`[${platform.id}] publish error:`, err.message)
    res.status(err.status || 502).json({ error: err.message })
  }
})

// Posting options for the connected creator (TikTok Content Posting API: the
// allowed privacy levels + which interactions are available). The composer must
// show these before a direct post per TikTok's UX guidelines.
app.get('/api/:platform/creator-info', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform || typeof platform.getCreatorInfo !== 'function') {
    return res.status(404).json({ error: 'Not available for this platform' })
  }
  try {
    const { token } = await validAccessToken(platform)
    res.json(await platform.getCreatorInfo(token))
  } catch (err) {
    console.error(`[${platform.id}] creator-info error:`, err.message)
    res.status(err.status || 502).json({ error: err.message })
  }
})

// Recent videos for a platform that supports it (TikTok video.list, etc.).
// Note: TikTok only returns the user's public videos here.
app.get('/api/:platform/recent-videos', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform || typeof platform.getRecentVideos !== 'function') {
    return res.status(404).json({ error: 'Not available for this platform' })
  }
  try {
    const { token } = await validAccessToken(platform)
    res.json(await platform.getRecentVideos(token, Number(req.query.max) || 6))
  } catch (err) {
    console.error(`[${platform.id}] recent-videos error:`, err.message)
    res.status(err.status || 502).json({ error: err.message })
  }
})

// Upload a media file straight to the platform. The raw bytes are the request
// body; metadata (title/description/tags/etc.) rides along as base64 JSON in
// the X-Upload-Meta header so we don't need a multipart parser.
app.post(
  '/api/:platform/publish-media',
  express.raw({ type: () => true, limit: '512mb' }),
  async (req, res) => {
    const platform = getPlatform(req.params.platform)
    if (!platform) return res.status(404).json({ error: 'Unknown platform' })
    if (typeof platform.publishMedia !== 'function') {
      const cap = PUBLISH_CAPABILITIES[platform.id]
      return res.status(400).json({
        error: `Media publishing to ${platform.name} isn't available yet. ${cap?.note || ''}`.trim(),
      })
    }
    const buffer = req.body
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      return res.status(400).json({ error: 'No file received' })
    }
    let meta = {}
    try {
      const raw = req.get('x-upload-meta')
      if (raw) meta = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    } catch {
      /* ignore malformed meta */
    }
    try {
      const { token, record } = await validAccessToken(platform)
      const result = await platform.publishMedia(token, record, {
        buffer,
        contentType: req.get('content-type') || 'application/octet-stream',
        ...meta,
      })
      res.json(result)
    } catch (err) {
      console.error(`[${platform.id}] publish-media error:`, err.message)
      res.status(err.status || 502).json({ error: err.message })
    }
  },
)

/* -------------------------------------------------------------------------- */
/*  Scheduled posts (Instagram/TikTok) + cron worker                           */
/*    These platforms have no native scheduling, so we queue a post (public     */
/*    media URL + caption + time) and a Vercel Cron job publishes it when due.  */
/* -------------------------------------------------------------------------- */

app.get('/api/scheduled', async (_req, res) => res.json(await scheduled.all()))

app.post('/api/scheduled', async (req, res) => {
  const { platform, caption, mediaUrl, publishAt } = req.body || {}
  if (!platform || !mediaUrl || !publishAt) {
    return res.status(400).json({ error: 'platform, mediaUrl and publishAt are required' })
  }
  if (!getPlatform(platform)) return res.status(400).json({ error: 'Unknown platform' })
  const rec = await scheduled.add({ platform, caption, mediaUrl, publishAt })
  res.json(rec)
})

app.delete('/api/scheduled/:id', async (req, res) => {
  await scheduled.remove(req.params.id)
  res.json({ ok: true })
})

// Cron worker: publish every due post. Vercel Cron calls this on a schedule and
// includes `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
app.get('/api/cron/publish', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret && req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const due = await scheduled.due(Date.now())
  const results = []
  for (const post of due) {
    try {
      const platform = getPlatform(post.platform)
      if (!platform) throw new Error('unknown platform')
      const { token, record } = await validAccessToken(platform)

      let result
      if (post.platform === 'instagram') {
        result = await platform.publish(token, record, { mediaUrl: post.mediaUrl, caption: post.caption })
      } else if (post.platform === 'tiktok') {
        result = await platform.publishFromUrl(token, { videoUrl: post.mediaUrl, title: post.caption })
      } else if (typeof platform.publish === 'function') {
        result = await platform.publish(token, record, { text: post.caption, mediaUrl: post.mediaUrl, caption: post.caption })
      } else {
        throw new Error(`publishing to ${post.platform} is not supported`)
      }

      await scheduled.update(post.id, { status: 'published', publishedAt: Date.now(), result })
      results.push({ id: post.id, ok: true })
    } catch (err) {
      console.error(`[cron] publish ${post.id} failed:`, err.message)
      await scheduled.update(post.id, { status: 'failed', error: err.message, failedAt: Date.now() })
      results.push({ id: post.id, ok: false, error: err.message })
    }
  }
  res.json({ ranAt: Date.now(), processed: results.length, results })
})

/* -------------------------------------------------------------------------- */
/*  Weekly growth brief email (opt-in via Settings, sent by a Monday cron)      */
/* -------------------------------------------------------------------------- */

app.post('/api/weekly-brief/subscribe', async (req, res) => {
  const { email, enabled } = req.body || {}
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    return res.status(400).json({ error: 'valid email is required' })
  }
  await weeklySubs.set(email, Boolean(enabled))
  res.json({ ok: true, enabled: Boolean(enabled), emailConfigured: emailEnabled })
})

/** Build the weekly brief HTML from the real link aggregates we hold. */
function weeklyEmailHtml({ clicks, visitors, topLink, tip }) {
  const appUrl = `${FRONTEND_URL}/app/`
  const card = (label, value) =>
    `<td style="padding:14px 16px;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:12px">
       <div style="font-size:22px;font-weight:800;color:#fff">${value}</div>
       <div style="font-size:12px;color:#94a3b8">${label}</div>
     </td>`
  return `<!doctype html><html><body style="margin:0;background:#0b1120;font-family:Inter,Arial,sans-serif;color:#e2e8f0">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px">
      <div style="font-size:20px;font-weight:800;color:#fff">Sched<span style="color:#22d3ee">lytics</span></div>
      <h1 style="font-size:24px;color:#fff;margin:20px 0 6px">Your week at a glance</h1>
      <p style="color:#94a3b8;margin:0 0 20px">Here is how your tracked content performed.</p>
      <table style="width:100%;border-collapse:separate;border-spacing:10px 0"><tr>
        ${card('Total clicks', clicks.toLocaleString())}
        ${card('Unique visitors', visitors.toLocaleString())}
      </tr></table>
      ${topLink ? `<p style="margin:20px 0 0;color:#e2e8f0">Top link: <b style="color:#22d3ee">${topLink}</b></p>` : ''}
      <div style="margin:20px 0;padding:16px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:12px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#22d3ee">Growth Coach</div>
        <p style="margin:8px 0 0;color:#e2e8f0">${tip}</p>
      </div>
      <a href="${appUrl}" style="display:inline-block;margin-top:8px;padding:12px 22px;background:linear-gradient(135deg,#22d3ee,#0ea5e9);color:#0f172a;font-weight:700;text-decoration:none;border-radius:12px">Open your dashboard</a>
      <p style="margin-top:28px;font-size:12px;color:#64748b">You are receiving this because you turned on the weekly performance report in Schedlytics. Turn it off any time in Settings, Notifications.</p>
    </div></body></html>`
}

const WEEKLY_TIPS = [
  'Repost your best-performing link in your newsletter to compound its reach.',
  'Add a clear call to action to your captions; it is the fastest way to lift click rate.',
  'Group this week\'s posts into a campaign so you can compare them side by side.',
  'Your best posting window is usually mid-morning. Schedule your next post then.',
  'Turn your top post into a short series; consistency beats one-off spikes.',
]

app.get('/api/cron/weekly-brief', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret && req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  // Real aggregates from the link store (honest data, no fabricated stats).
  const all = await links.all()
  const clicks = all.reduce((s, l) => s + (l.clicks || 0), 0)
  const visitors = all.reduce((s, l) => s + (l.uniqueVisitors || 0), 0)
  const top = all.slice().sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0]
  const topLink = top ? `${BASE_URL}/s/${top.slug}` : ''
  const weekIndex = Math.floor(Date.now() / (7 * 86400000))
  const tip = WEEKLY_TIPS[weekIndex % WEEKLY_TIPS.length]
  const html = weeklyEmailHtml({ clicks, visitors, topLink, tip })

  const subs = await weeklySubs.all()
  const results = []
  for (const s of subs) {
    try {
      const r = await sendEmail({ to: s.email, subject: 'Your weekly growth brief', html })
      results.push({ to: s.email, ...r })
    } catch (err) {
      console.error('[weekly] send failed for', s.email, err.message)
      results.push({ to: s.email, error: err.message })
    }
  }
  res.json({ ranAt: Date.now(), subscribers: subs.length, emailConfigured: emailEnabled, results })
})

/* -------------------------------------------------------------------------- */
/*  Disconnect                                                                  */
/* -------------------------------------------------------------------------- */

app.post('/api/:platform/disconnect', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).json({ error: 'Unknown platform' })
  // Real logout: revoke the grant at the platform (best-effort) so reconnecting
  // requires a fresh consent, then drop our stored token either way.
  if (typeof platform.revoke === 'function') {
    try {
      const tokens = await store.get(platform.id)
      if (tokens) await platform.revoke(tokens)
    } catch (err) {
      console.warn(`[${platform.id}] revoke failed (clearing locally anyway):`, err.message)
    }
  }
  await store.remove(platform.id)
  res.json({ ok: true })
})

/* -------------------------------------------------------------------------- */
/*  Data deletion request (used by the public /data-deletion page)             */
/*    Removes every stored token/profile we hold. In a multi-user production    */
/*    app you would look the user up by email and delete only their records.    */
/* -------------------------------------------------------------------------- */

app.post('/api/data-deletion', async (req, res) => {
  const { email, reason } = req.body || {}

  // Delete the data we actually hold (per-platform tokens + cached profiles).
  const removed = Object.keys(await store.all())
  for (const id of removed) await store.remove(id)

  const confirmationCode = 'DEL-' + crypto.randomBytes(4).toString('hex').toUpperCase()
  console.log(
    `[data-deletion] ${confirmationCode} email=${email || 'n/a'} removed=[${removed.join(', ')}] reason=${reason || 'n/a'}`,
  )

  res.json({
    ok: true,
    confirmationCode,
    email: email || null,
    message:
      'All stored Schedlytics data and platform access tokens have been deleted. If you connected accounts, you may also revoke access from each platform settings.',
  })
})

/* -------------------------------------------------------------------------- */
/*  URL shortener                                                              */
/*    POST   /api/links        { url }   -> { slug, shortUrl, url, clicks }     */
/*    GET    /api/links                  -> list (with shortUrl + clicks)       */
/*    DELETE /api/links/:slug                                                   */
/*    GET    /s/:slug          -> 302 redirect to the long URL (+ click count)  */
/* -------------------------------------------------------------------------- */

// Never expose the internal visitor-hash set to clients.
const withShort = ({ visitorHashes, ...l }) => ({ ...l, shortUrl: `${BASE_URL}/s/${l.slug}` })

/**
 * Pseudonymous per-link visitor fingerprint. We hash IP + user agent + slug and
 * keep only the hash (never the raw IP), so we can count unique visitors without
 * storing personal data.
 */
function visitorHash(req, slug) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
  const ua = req.get('user-agent') || ''
  return crypto.createHash('sha256').update(`${ip}|${ua}|${slug}`).digest('hex').slice(0, 16)
}

const ashrtEnabled = Boolean(ashrt.apiUrl)
const ashrtFetch = (path, opts = {}) =>
  fetch(`${ashrt.apiUrl}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-api-key': ashrt.apiKey, ...(opts.headers || {}) },
  })

app.post('/api/links', async (req, res) => {
  const url = req.body?.url
  if (!url || !String(url).trim()) return res.status(400).json({ error: 'url is required' })

  // Prefer ashrt.link when configured; fall back to the built-in shortener.
  if (ashrtEnabled) {
    try {
      const r = await ashrtFetch('/api/links', {
        method: 'POST',
        body: JSON.stringify({ url, source: 'schedlytics' }),
      })
      return res.status(r.status).json(await r.json())
    } catch (err) {
      console.warn('[links] ashrt.link unreachable, using local store:', err.message)
    }
  }

  let clean = String(url).trim()
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`
  const slug = crypto.randomBytes(3).toString('hex')
  const link = await links.add({ slug, url: clean, clicks: 0, uniqueVisitors: 0, createdAt: Date.now() })
  res.json(withShort(link))
})

app.get('/api/links', async (_req, res) => {
  if (ashrtEnabled) {
    try {
      const r = await ashrtFetch('/api/links')
      const data = await r.json()
      return res.json(data.links || [])
    } catch (err) {
      console.warn('[links] ashrt.link unreachable, using local store:', err.message)
    }
  }
  res.json((await links.all()).map(withShort))
})

app.delete('/api/links/:slug', async (req, res) => {
  if (ashrtEnabled) {
    try {
      await ashrtFetch(`/api/links/${req.params.slug}`, { method: 'DELETE' })
      return res.json({ ok: true })
    } catch (err) {
      console.warn('[links] ashrt.link unreachable, using local store:', err.message)
    }
  }
  await links.remove(req.params.slug)
  res.json({ ok: true })
})

app.get('/s/:slug', async (req, res) => {
  const link = await links.get(req.params.slug)
  if (!link) {
    return res
      .status(404)
      .type('html')
      .send('<h1 style="font-family:sans-serif">Short link not found</h1>')
  }
  // Count the click, and increment unique visitors only for a new fingerprint.
  const hash = visitorHash(req, link.slug)
  const seen = link.visitorHashes || []
  const patch = { clicks: (link.clicks || 0) + 1 }
  if (!seen.includes(hash)) {
    patch.uniqueVisitors = (link.uniqueVisitors || 0) + 1
    patch.visitorHashes = [...seen, hash].slice(-2000) // bound storage
  }
  await links.update(link.slug, patch)
  // Append a click id so a later conversion on the destination site can be
  // attributed back to this exact link (and its post, campaign, and platform).
  const dest = await tagRedirect(link, link.uid)
  res.redirect(302, dest)
})

/* -------------------------------------------------------------------------- */
/*  Built React app (only when a dist/ exists, i.e. on Vercel after build).     */
/*  Locally the Vite dev server serves the app, so this stays inert.            */
/* -------------------------------------------------------------------------- */

const DIST = join(__dirname, '..', 'dist')
if (existsSync(DIST)) {
  // The app is mounted under /app (built with base /app/).
  app.use('/app', express.static(DIST))
  app.get(['/app', '/app/*'], (req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(join(DIST, 'index.html'))
  })
}

// Run a normal server locally; on Vercel the app is imported by api/index.js.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  app.listen(PORT, () => {
    console.log(`\n  Schedlytics API -> ${BASE_URL}  (store: ${store.driver})`)
    console.log(`  Allowing frontend origin -> ${FRONTEND_URL}`)
    console.log(`  Connect a platform:  ${BASE_URL}/auth/youtube/start\n`)
  })
}

export default app
