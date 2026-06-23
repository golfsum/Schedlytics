import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PORT, BASE_URL, FRONTEND_URL, creds, ashrt } from './config.js'
import { getPlatform, platforms } from './platforms/index.js'
import { store } from './store.js'
import { links } from './links-store.js'
import { stateStore } from './kv.js'
import { validAccessToken } from './tokens.js'
import youtubeRoutes from './routes/youtube.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_DIR = join(__dirname, '..', 'site')

const app = express()
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
}

// CSRF "state" lives in KV (prod) or memory (local), with a 10-minute TTL.
const STATE_TTL = 600 // seconds

/* -------------------------------------------------------------------------- */
/*  Health + config introspection                                              */
/* -------------------------------------------------------------------------- */

app.get('/health', (_req, res) => res.json({ ok: true, store: store.driver }))

// Which platforms have credentials configured (so the UI can hint setup).
app.get('/api/config', (_req, res) => {
  const configured = {}
  for (const id of Object.keys(platforms)) {
    configured[id] = Boolean(creds[id]?.clientId || creds[id]?.clientKey)
  }
  res.json({ configured, baseUrl: BASE_URL })
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
  await stateStore.set(state, { platform: platform.id }, STATE_TTL)
  res.redirect(platform.getAuthUrl(state))
})

/* -------------------------------------------------------------------------- */
/*  OAuth - callback                                                           */
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
  const entry = state && (await stateStore.get(String(state)))
  if (!entry || entry.platform !== platform.id) {
    return res.redirect(`${FRONTEND_URL}/?error=invalid_state`)
  }
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
    res.redirect(`${FRONTEND_URL}/?connected=${platform.id}`)
  } catch (err) {
    console.error(`[${platform.id}] callback error:`, err.message)
    res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(err.message)}`)
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
/*  Disconnect                                                                  */
/* -------------------------------------------------------------------------- */

app.post('/api/:platform/disconnect', async (req, res) => {
  const platform = getPlatform(req.params.platform)
  if (!platform) return res.status(404).json({ error: 'Unknown platform' })
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

const withShort = (l) => ({ ...l, shortUrl: `${BASE_URL}/s/${l.slug}` })

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
  const link = await links.add({ slug, url: clean, clicks: 0, createdAt: Date.now() })
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
  await links.update(link.slug, { clicks: (link.clicks || 0) + 1 })
  res.redirect(302, link.url)
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
