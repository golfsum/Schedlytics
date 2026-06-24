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
import { stateStore } from './kv.js'
import { validAccessToken } from './tokens.js'
import youtubeRoutes from './routes/youtube.js'
import aiRoutes from './routes/ai.js'
import settingsRoutes from './routes/settings.js'

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
// AI suggestions (Claude-backed when ANTHROPIC_API_KEY is set).
app.use('/api/ai', aiRoutes)
// Per-user settings sync (requires FIREBASE_PROJECT_ID).
app.use('/api/settings', settingsRoutes)

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
