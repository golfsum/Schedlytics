/**
 * Live health checks for the external services Schedlytics depends on: each
 * platform's API, the AI provider, storage, email, and the link shortener.
 *
 * Platform probes only check reachability (any HTTP response, including the
 * expected 401/400 from an unauthenticated request, means the API is up). The
 * AI check uses the configured key to confirm it actually authenticates.
 */
import { kvPing } from './kv.js'
import { ashrt, META_GRAPH_VERSION } from './config.js'
import { emailEnabled } from './email.js'

const TIMEOUT = 6000

async function probe(name, category, url, opts = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT)
  const start = Date.now()
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal })
    const latencyMs = Date.now() - start
    // 5xx or no response = down; anything else means the host answered.
    return { name, category, ok: res.status > 0 && res.status < 500, status: res.status, latencyMs }
  } catch (err) {
    return {
      name,
      category,
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      detail: err.name === 'AbortError' ? 'timed out' : err.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function probeAI() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { name: 'AI (Anthropic)', category: 'Services', ok: true, status: 0, detail: 'no key set, using built-in suggestions' }
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT)
  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: ac.signal,
    })
    const latencyMs = Date.now() - start
    return {
      name: 'AI (Anthropic)',
      category: 'Services',
      ok: res.ok,
      status: res.status,
      latencyMs,
      detail: res.ok ? 'reachable, key valid' : res.status === 401 ? 'invalid API key' : `error ${res.status}`,
    }
  } catch (err) {
    return { name: 'AI (Anthropic)', category: 'Services', ok: false, status: 0, latencyMs: Date.now() - start, detail: err.name === 'AbortError' ? 'timed out' : err.message }
  } finally {
    clearTimeout(timer)
  }
}

async function probeKV() {
  const start = Date.now()
  try {
    const k = await kvPing()
    return { name: 'Storage', category: 'Infrastructure', ok: k.ok, status: k.ok ? 200 : 0, latencyMs: k.latencyMs ?? Date.now() - start, detail: k.backend }
  } catch (err) {
    return { name: 'Storage', category: 'Infrastructure', ok: false, status: 0, latencyMs: Date.now() - start, detail: err.message }
  }
}

/** Run every check in parallel and return a flat list of results. */
export async function checkHealth() {
  const g = META_GRAPH_VERSION
  const checks = await Promise.all([
    probe('YouTube / Google', 'Platforms', 'https://www.googleapis.com/discovery/v1/apis'),
    probe('TikTok', 'Platforms', 'https://open.tiktokapis.com/v2/user/info/'),
    probe('Meta (Instagram, Facebook)', 'Platforms', `https://graph.facebook.com/${g}/me`),
    probe('Pinterest', 'Platforms', 'https://api.pinterest.com/v5/user_account'),
    probe('Twitch', 'Platforms', 'https://id.twitch.tv/oauth2/validate'),
    probe('Patreon', 'Platforms', 'https://www.patreon.com/api/oauth2/v2/identity'),
    probeAI(),
    probeKV(),
    ashrt.apiUrl
      ? probe('Link shortener', 'Services', ashrt.apiUrl)
      : Promise.resolve({ name: 'Link shortener', category: 'Services', ok: true, status: 0, detail: 'built-in shortener' }),
  ])

  // Email is a config check (a live SMTP handshake is too heavy to run on view).
  checks.push({
    name: 'Email (SMTP)',
    category: 'Infrastructure',
    ok: emailEnabled,
    status: emailEnabled ? 200 : 0,
    detail: emailEnabled ? 'configured' : 'not configured',
  })

  return checks
}
