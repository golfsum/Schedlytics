/*
 *  Conversion tracking for Schedlytics.
 *
 *  The chain that turns a post into attributed revenue:
 *    1. A tracked short link is clicked. The /s/:slug redirect mints a click id,
 *       stores the link context against it (with a TTL = the attribution window),
 *       and forwards the click id to the destination as ?slc=<id>.
 *    2. The lightweight snippet (served at /sl.js) on the user's own site reads
 *       that click id, keeps it first-party, and reports conversions back, either
 *       automatically when a goal URL is reached or via schedlytics('conversion').
 *    3. /api/track-conversion joins the conversion to the click, so it rolls up
 *       to the exact link (and post, campaign, platform) that earned it.
 *
 *  Conversions are stored per site key (the owner's Firebase UID), which the
 *  snippet carries in data-site.
 */
import crypto from 'node:crypto'
import { hashStore, stateStore } from './kv.js'
import { verifyIdToken } from './lib/firebaseAuth.js'
import { BASE_URL } from './config.js'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID

// How long after a click a conversion can still be attributed to it.
const WINDOW_DAYS = Number(process.env.CONVERSION_WINDOW_DAYS) || 30
const WINDOW_SECONDS = WINDOW_DAYS * 24 * 60 * 60

// uid -> { items: [conversion, ...] }, and uid -> { goals: [{ pattern, name }] }
const convStore = hashStore('sched:conversions', '.conversions.json')
const goalStore = hashStore('sched:conversion-goals', '.conversion-goals.json')
const MAX_PER_SITE = 5000

/* ----------------------------- click capture ----------------------------- */

/**
 * Mint a click id for a redirect and remember the link context against it for
 * the attribution window. Returns the destination URL with ?slc=<id> appended.
 */
export async function tagRedirect(link, ownerUid) {
  try {
    const id = crypto.randomBytes(8).toString('hex')
    const context = {
      slug: link.slug,
      url: link.url,
      title: link.title || null,
      campaign: link.campaign || null,
      sourcePostId: link.sourcePostId || null,
      platform: link.platform || null,
      uid: ownerUid || link.uid || null,
      at: Date.now(),
    }
    await stateStore.set(`clk:${id}`, context, WINDOW_SECONDS)
    const sep = link.url.indexOf('?') === -1 ? '?' : '&'
    return `${link.url}${sep}slc=${id}`
  } catch {
    // Never block a redirect on tracking; fall back to the plain URL.
    return link.url
  }
}

/* ------------------------------ conversions ------------------------------ */

async function recordConversion({ site, clickId, event, value, currency, path, referer }) {
  const click = clickId ? await stateStore.get(`clk:${clickId}`) : null
  // The owning site is whoever the snippet says (data-site), or the click owner.
  const uid = site || click?.uid
  if (!uid) return null

  const conv = {
    id: crypto.randomBytes(6).toString('hex'),
    at: Date.now(),
    event: String(event || 'conversion').slice(0, 60),
    value: Number.isFinite(value) && value > 0 ? Number(value) : 0,
    currency: String(currency || 'USD').slice(0, 8),
    path: path ? String(path).slice(0, 300) : null,
    attributed: Boolean(click),
    slug: click?.slug || null,
    destination: click?.url || null,
    title: click?.title || null,
    campaign: click?.campaign || null,
    sourcePostId: click?.sourcePostId || null,
    platform: click?.platform || null,
    referer: referer ? String(referer).slice(0, 200) : null,
  }

  const cur = (await convStore.get(uid)) || { items: [] }
  cur.items = [conv, ...(cur.items || [])].slice(0, MAX_PER_SITE)
  await convStore.put(uid, cur)
  return conv
}

/** Group a user's conversions for the dashboard (per content first). */
async function summaryFor(uid) {
  const cur = (await convStore.get(uid)) || { items: [] }
  const items = cur.items || []
  const total = items.length
  const revenue = items.reduce((s, c) => s + (c.value || 0), 0)
  const attributed = items.filter((c) => c.attributed).length

  const bucket = (keyFn, labelFn) => {
    const map = new Map()
    for (const c of items) {
      const key = keyFn(c)
      if (key == null) continue
      const row = map.get(key) || { key, label: labelFn(c), conversions: 0, revenue: 0 }
      row.conversions += 1
      row.revenue += c.value || 0
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.conversions - a.conversions)
  }

  return {
    total,
    revenue,
    attributed,
    unattributed: total - attributed,
    byContent: bucket(
      (c) => c.slug || c.destination,
      (c) => c.title || c.destination || c.slug || 'Unknown',
    ),
    byCampaign: bucket(
      (c) => c.campaign,
      (c) => c.campaign,
    ),
    byPlatform: bucket(
      (c) => c.platform,
      (c) => c.platform,
    ),
    recent: items.slice(0, 50),
  }
}

/* ------------------------------- the snippet ----------------------------- */

const SNIPPET = `(function(){
  var s=document.currentScript||(function(){var a=document.getElementsByTagName('script');return a[a.length-1]})();
  var SITE=(s&&s.getAttribute('data-site'))||'';
  var API=(s&&s.src?s.src.replace(/\\/sl\\.js.*$/,''):'');
  var LS='_slclick';
  function qp(n){try{return new URLSearchParams(location.search).get(n)}catch(e){return null}}
  try{var c=qp('slc');if(c)localStorage.setItem(LS,JSON.stringify({id:c,at:Date.now()}))}catch(e){}
  function clickId(){try{var v=JSON.parse(localStorage.getItem(LS)||'null');return v&&v.id||null}catch(e){return null}}
  function send(ev,val,cur){try{
    var body=JSON.stringify({site:SITE,clickId:clickId(),event:ev||'conversion',value:(val!=null?Number(val):null),currency:cur||'USD',path:location.pathname});
    var url=API+'/api/track-conversion';
    if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([body],{type:'text/plain'}))}
    else{fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:body,keepalive:true})}
  }catch(e){}}
  window.schedlytics=function(cmd,opts){opts=opts||{};if(cmd==='conversion')send(opts.event,opts.value,opts.currency)};
  try{if(SITE){fetch(API+'/api/conversions/config?site='+encodeURIComponent(SITE)).then(function(r){return r.json()}).then(function(cfg){
    var goals=(cfg&&cfg.goals)||[];var p=location.pathname;
    for(var i=0;i<goals.length;i++){var g=goals[i];if(g&&g.pattern&&p.indexOf(g.pattern)!==-1){send(g.name||'goal',null);break}}
  }).catch(function(){})}}catch(e){}
})();`

/* --------------------------------- auth ---------------------------------- */

async function requireUser(req, res, next) {
  if (!PROJECT_ID) return res.status(501).json({ error: 'Conversion tracking is not configured' })
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '')
  if (!m) return res.status(401).json({ error: 'missing bearer token' })
  try {
    req.auth = await verifyIdToken(m[1], PROJECT_ID)
    next()
  } catch (err) {
    res.status(401).json({ error: `auth failed: ${err.message}` })
  }
}

function allowCrossSite(res) {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

/* ------------------------------- wiring ---------------------------------- */

/**
 * Routes that arbitrary customer sites call (the snippet + its beacons). Must be
 * registered BEFORE the app's restrictive CORS so they can allow any origin.
 */
export function registerPublicConversionRoutes(app, express) {
  // The tracking snippet itself.
  app.get('/sl.js', (_req, res) => {
    res.type('application/javascript')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(SNIPPET)
  })

  // Conversion beacon. Body arrives as text/plain (a CORS simple request, so no
  // preflight); parse it by hand.
  app.options('/api/track-conversion', (_req, res) => {
    allowCrossSite(res)
    res.status(204).end()
  })
  app.post('/api/track-conversion', express.text({ type: '*/*', limit: '8kb' }), async (req, res) => {
    allowCrossSite(res)
    let body = {}
    try {
      body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {}
    } catch {
      return res.status(400).end()
    }
    try {
      await recordConversion({
        site: body.site,
        clickId: body.clickId,
        event: body.event,
        value: body.value,
        currency: body.currency,
        path: body.path,
        referer: req.get('referer'),
      })
    } catch (err) {
      console.error('[conversions] record failed:', err.message)
    }
    res.status(204).end()
  })

  // Goal-URL config the snippet reads to auto-fire conversions.
  app.get('/api/conversions/config', async (req, res) => {
    allowCrossSite(res)
    const site = String(req.query.site || '')
    if (!site) return res.json({ goals: [] })
    try {
      const cfg = (await goalStore.get(site)) || { goals: [] }
      // Only expose the matcher fields, nothing else.
      res.json({ goals: (cfg.goals || []).map((g) => ({ pattern: g.pattern, name: g.name })) })
    } catch {
      res.json({ goals: [] })
    }
  })
}

/** Authenticated dashboard + settings routes. Registered after express.json(). */
export function registerConversionRoutes(app) {
  app.get('/api/conversions/summary', requireUser, async (req, res) => {
    try {
      res.json(await summaryFor(req.auth.uid))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Manually record revenue / a conversion against a campaign or content item.
  // Lets users attribute outcomes before Stripe / website tracking is wired.
  app.post('/api/conversions/manual', requireUser, async (req, res) => {
    const b = req.body || {}
    const value = Number(b.value)
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: 'amount must be a positive number' })
    }
    let at = Date.now()
    if (b.date) {
      const t = new Date(b.date).getTime()
      if (Number.isFinite(t)) at = t
    }
    const conv = {
      id: crypto.randomBytes(6).toString('hex'),
      at,
      event: String(b.event || 'manual').slice(0, 60),
      value,
      currency: String(b.currency || 'USD').slice(0, 8),
      path: null,
      attributed: true,
      manual: true,
      slug: b.contentId ? String(b.contentId).slice(0, 80) : null,
      destination: null,
      title: b.contentTitle ? String(b.contentTitle).slice(0, 120) : null,
      campaign: b.campaign ? String(b.campaign).slice(0, 80) : null,
      sourcePostId: null,
      platform: b.platform ? String(b.platform).slice(0, 30) : null,
      notes: b.notes ? String(b.notes).slice(0, 300) : null,
    }
    try {
      const cur = (await convStore.get(req.auth.uid)) || { items: [] }
      cur.items = [conv, ...(cur.items || [])].slice(0, MAX_PER_SITE)
      await convStore.put(req.auth.uid, cur)
      res.json({ ok: true, conversion: conv })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/conversions/goals', requireUser, async (req, res) => {
    const cfg = (await goalStore.get(req.auth.uid)) || { goals: [] }
    res.json({ goals: cfg.goals || [], siteKey: req.auth.uid, snippetUrl: `${BASE_URL}/sl.js` })
  })

  app.put('/api/conversions/goals', requireUser, async (req, res) => {
    const input = Array.isArray(req.body?.goals) ? req.body.goals : []
    const goals = input
      .map((g) => ({ pattern: String(g.pattern || '').trim().slice(0, 200), name: String(g.name || '').trim().slice(0, 60) }))
      .filter((g) => g.pattern)
      .slice(0, 50)
    await goalStore.put(req.auth.uid, { goals })
    res.json({ goals })
  })
}
