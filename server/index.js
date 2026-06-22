import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PORT, BASE_URL, FRONTEND_URL, creds } from './config.js'
import { getPlatform, platforms } from './platforms/index.js'
import { store } from './store.js'
import { validAccessToken } from './tokens.js'
import youtubeRoutes from './routes/youtube.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_DIR = join(__dirname, '..', 'site')

const app = express()
app.use(express.json())
app.use(cors({ origin: FRONTEND_URL, credentials: true }))

// Platform-specific routes (extras beyond generic stats).
app.use('/api/youtube', youtubeRoutes)

/* -------------------------------------------------------------------------- */
/*  Marketing + legal site (landing, privacy, terms, data deletion)            */
/*    Served from /site so the legal pages have real, linkable URLs for the    */
/*    platform app reviews (e.g. {BASE_URL}/privacy, {BASE_URL}/data-deletion).  */
/* -------------------------------------------------------------------------- */

app.use(express.static(SITE_DIR))
app.get('/', (_req, res) => res.sendFile(join(SITE_DIR, 'index.html')))
app.get('/privacy', (_req, res) => res.sendFile(join(SITE_DIR, 'privacy.html')))
app.get('/terms', (_req, res) => res.sendFile(join(SITE_DIR, 'terms.html')))
app.get('/data-deletion', (_req, res) => res.sendFile(join(SITE_DIR, 'data-deletion.html')))

// In-memory CSRF "state" cache: state -> { platform, createdAt }.
const stateCache = new Map()
const STATE_TTL = 10 * 60 * 1000 // 10 minutes

/* -------------------------------------------------------------------------- */
/*  Health + config introspection                                              */
/* -------------------------------------------------------------------------- */

app.get('/health', (_req, res) => res.json({ ok: true }))

// Which platforms have credentials configured (so the UI can hint setup).
app.get('/api/config', (_req, res) => {
  const configured = {}
  for (const id of Object.keys(platforms)) {
    configured[id] = Boolean(creds[id]?.clientId || creds[id]?.clientKey)
  }
  res.json({ configured, baseUrl: BASE_URL })
})

/* -------------------------------------------------------------------------- */
/*  OAuth — start                                                              */
/*    GET /auth/:platform/start  → 302 redirect to the provider's consent page */
/* -------------------------------------------------------------------------- */

app.get('/auth/:platform/start', (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).send('Unknown platform')

  const cfg = creds[platform.id]
  if (!cfg?.clientId && !cfg?.clientKey) {
    return res
      .status(500)
      .send(`${platform.name} is not configured — add its credentials to .env`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  stateCache.set(state, { platform: platform.id, createdAt: Date.now() })
  res.redirect(platform.getAuthUrl(state))
})

/* -------------------------------------------------------------------------- */
/*  OAuth — callback                                                           */
/*    GET /auth/:platform/callback?code=...&state=...                          */
/*    Exchanges the code, stores tokens, returns the user to the React app.    */
/* -------------------------------------------------------------------------- */

app.get('/auth/:platform/callback', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).send('Unknown platform')

  const { code, state, error, error_description } = req.query
  if (error) {
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(error_description || error)}`)
  }

  // Verify CSRF state.
  const entry = state && stateCache.get(String(state))
  if (!entry || entry.platform !== platform.id || Date.now() - entry.createdAt > STATE_TTL) {
    return res.redirect(`${FRONTEND_URL}/?error=invalid_state`)
  }
  stateCache.delete(String(state))

  try {
    const tokens = await platform.exchangeCode(String(code))
    store.set(platform.id, tokens)
    // Fetch + cache a profile so the dashboard has something immediately.
    try {
      const stats = await platform.getStats(tokens.accessToken, tokens)
      store.set(platform.id, {
        profile: { handle: stats.handle, name: stats.name, avatar: stats.avatar, followers: stats.followers },
      })
    } catch {
      /* profile fetch is best-effort */
    }
    res.redirect(`${FRONTEND_URL}/?connected=${platform.id}`)
  } catch (err) {
    console.error(`[${platform.id}] callback error:`, err.message)
    res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(err.message)}`)
  }
})

/* -------------------------------------------------------------------------- */
/*  Accounts — connection status for every platform                            */
/* -------------------------------------------------------------------------- */

app.get('/api/accounts', (_req, res) => {
  const all = store.all()
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
/*  Stats — live fetch for one platform (auto-refreshes the token if needed)   */
/* -------------------------------------------------------------------------- */

app.get('/api/:platform/stats', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).json({ error: 'Unknown platform' })

  try {
    const { token, record } = await validAccessToken(platform)
    const stats = await platform.getStats(token, record)
    // refresh the cached profile too
    store.set(platform.id, {
      profile: { handle: stats.handle, name: stats.name, avatar: stats.avatar, followers: stats.followers },
    })
    res.json(stats)
  } catch (err) {
    console.error(`[${platform.id}] stats error:`, err.message)
    res.status(err.status || 502).json({ error: err.message })
  }
})

/* -------------------------------------------------------------------------- */
/*  Disconnect                                                                  */
/* -------------------------------------------------------------------------- */

app.post('/api/:platform/disconnect', (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).json({ error: 'Unknown platform' })
  store.remove(platform.id)
  res.json({ ok: true })
})

/* -------------------------------------------------------------------------- */
/*  Data deletion request (used by the public /data-deletion page)             */
/*    Removes every stored token/profile we hold. In a multi-user production    */
/*    app you would look the user up by email and delete only their records.    */
/* -------------------------------------------------------------------------- */

app.post('/api/data-deletion', (req, res) => {
  const { email, reason } = req.body || {}

  // Delete the data we actually hold (per-platform tokens + cached profiles).
  const removed = Object.keys(store.all())
  for (const id of removed) store.remove(id)

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

app.listen(PORT, () => {
  console.log(`\n  Schedlytics API → ${BASE_URL}`)
  console.log(`  Allowing frontend origin → ${FRONTEND_URL}`)
  console.log(`  Connect a platform:  ${BASE_URL}/auth/youtube/start\n`)
})
