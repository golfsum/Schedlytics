/**
 * Credential doctor — checks whether the app credentials in .env are valid and
 * recognized by each provider, WITHOUT printing any secret values.
 *
 * It uses app-level / negative-probe auth calls (no user data, no OAuth login):
 *   - Meta / Twitch: request an app (client_credentials) token.
 *   - Google/YouTube, TikTok, Pinterest, Patreon: send a deliberately invalid
 *     grant and read the error — "invalid_client" means the ID/secret are wrong,
 *     while "invalid_grant" means the credentials are accepted (only the code is bad).
 *
 * Run:  node check-credentials.mjs   (from the server/ directory)
 */
import { creds, redirectUri, META_GRAPH_VERSION } from './config.js'

const has = (c) => Boolean(c?.clientId || c?.clientKey)

const RESET = '\x1b[0m'
const tag = (s) =>
  ({
    valid: `\x1b[32m✓ valid${RESET}`,
    invalid: `\x1b[31m✗ invalid${RESET}`,
    unknown: `\x1b[33m? unverified${RESET}`,
    skip: `\x1b[90m– not configured${RESET}`,
  })[s]

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/* --------------------------- per-provider checks -------------------------- */

async function checkMeta() {
  // App access token via client_credentials validates App ID + Secret.
  const url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?` +
    new URLSearchParams({
      client_id: creds.instagram.clientId,
      client_secret: creds.instagram.clientSecret,
      grant_type: 'client_credentials',
    })
  const res = await fetch(url)
  const data = await safeJson(res)
  if (res.ok && data.access_token) return { status: 'valid', detail: 'app token issued (covers Instagram + Facebook)' }
  return { status: 'invalid', detail: data.error?.message || `HTTP ${res.status}` }
}

async function checkTwitch() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.twitch.clientId,
      client_secret: creds.twitch.clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  const data = await safeJson(res)
  if (res.ok && data.access_token) return { status: 'valid', detail: 'app token issued' }
  return { status: 'invalid', detail: data.message || `HTTP ${res.status}` }
}

async function checkGoogle() {
  // Negative probe: a bad refresh token. invalid_client => wrong creds.
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.youtube.clientId,
      client_secret: creds.youtube.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: 'schedlytics-invalid-probe',
    }),
  })
  const data = await safeJson(res)
  if (data.error === 'invalid_grant') return { status: 'valid', detail: 'client recognized by Google' }
  if (data.error === 'invalid_client') return { status: 'invalid', detail: 'client id/secret rejected' }
  return { status: 'unknown', detail: data.error || `HTTP ${res.status}` }
}

async function checkTikTok() {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: creds.tiktok.clientKey,
      client_secret: creds.tiktok.clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  const data = await safeJson(res)
  if (res.ok && data.access_token) return { status: 'valid', detail: 'client token issued' }
  const err = data.error || data.error_description || data.message || ''
  if (/client_key|client key|invalid_client|client_secret/i.test(JSON.stringify(data)))
    return { status: 'invalid', detail: String(err).slice(0, 80) }
  return { status: 'unknown', detail: String(err || `HTTP ${res.status}`).slice(0, 80) }
}

async function checkPinterest() {
  const basic = Buffer.from(`${creds.pinterest.clientId}:${creds.pinterest.clientSecret}`).toString('base64')
  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'schedlytics-invalid-probe',
      redirect_uri: redirectUri('pinterest'),
    }),
  })
  const data = await safeJson(res)
  // 401 => the Basic credentials were rejected. Other 4xx (bad code) => creds OK.
  if (res.status === 401) return { status: 'invalid', detail: 'app id/secret rejected' }
  if (res.status >= 400) return { status: 'valid', detail: 'app id/secret accepted (probe code rejected as expected)' }
  return { status: 'unknown', detail: `HTTP ${res.status}` }
}

async function checkPatreon() {
  const res = await fetch('https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'schedlytics-invalid-probe',
      client_id: creds.patreon.clientId,
      client_secret: creds.patreon.clientSecret,
      redirect_uri: redirectUri('patreon'),
    }),
  })
  const data = await safeJson(res)
  const err = data.error || ''
  if (err === 'invalid_client') return { status: 'invalid', detail: 'client id/secret rejected' }
  if (err) return { status: 'valid', detail: 'client recognized (probe code rejected as expected)' }
  return { status: 'unknown', detail: `HTTP ${res.status}` }
}

/* --------------------------------- run ------------------------------------ */

const plan = [
  ['YouTube', creds.youtube, checkGoogle],
  ['TikTok', creds.tiktok, checkTikTok],
  ['Meta (Instagram + Facebook)', creds.instagram, checkMeta],
  ['Pinterest', creds.pinterest, checkPinterest],
  ['Twitch', creds.twitch, checkTwitch],
  ['Patreon', creds.patreon, checkPatreon],
]

console.log('\n  Schedlytics credential check')
console.log('  ' + '─'.repeat(60))

for (const [name, cred, check] of plan) {
  if (!has(cred)) {
    console.log(`  ${name.padEnd(30)} ${tag('skip')}`)
    continue
  }
  try {
    const { status, detail } = await check()
    console.log(`  ${name.padEnd(30)} ${tag(status)}   ${detail || ''}`)
  } catch (e) {
    console.log(`  ${name.padEnd(30)} ${tag('unknown')}   ${e.message}`)
  }
}

console.log('  ' + '─'.repeat(60))
console.log(
  '\n  Note: "valid" means the app credentials are correct. Pulling a user\'s\n' +
    '  stats still requires connecting that account via OAuth in the app.\n',
)
