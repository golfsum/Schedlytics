/**
 * ============================================================================
 *  Shared Meta (Facebook + Instagram) OAuth helpers
 * ============================================================================
 *
 *  Instagram and Facebook both authenticate through one Meta app and the same
 *  "Facebook Login" dialog, so the OAuth plumbing lives here and is imported by
 *  both platform modules. The platform-specific stats logic stays in
 *  instagram.js and facebook.js.
 *
 *  Developer setup (https://developers.facebook.com):
 *    - Create an app (type: Business)
 *    - Add the products "Facebook Login" and (for IG) "Instagram Graph API"
 *    - Valid OAuth Redirect URIs:
 *        {BASE_URL}/auth/facebook/callback
 *        {BASE_URL}/auth/instagram/callback
 *    - .env: META_APP_ID, META_APP_SECRET
 *    - Advanced access to the scopes requires App Review + Business verification.
 * ============================================================================
 */

import { creds, redirectUri, META_GRAPH_VERSION } from '../config.js'

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`
const DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`

export { GRAPH }

/** Build the Facebook Login consent URL for a given platform + scope list. */
export function buildAuthUrl(platform, scopes, state) {
  const params = new URLSearchParams({
    client_id: creds[platform].clientId,
    redirect_uri: redirectUri(platform),
    response_type: 'code',
    scope: scopes.join(','),
    state,
  })
  return `${DIALOG}?${params.toString()}`
}

/**
 * Exchange the auth code for a short-lived user token, then immediately
 * upgrade it to a long-lived token (~60 days).
 */
export async function exchangeForLongLivedToken(platform, code) {
  // short-lived
  const shortRes = await fetch(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        client_id: creds[platform].clientId,
        client_secret: creds[platform].clientSecret,
        redirect_uri: redirectUri(platform),
        code,
      }),
  )
  if (!shortRes.ok) throw new Error(`Meta token exchange failed: ${await shortRes.text()}`)
  const short = await shortRes.json()

  // long-lived
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: creds[platform].clientId,
        client_secret: creds[platform].clientSecret,
        fb_exchange_token: short.access_token,
      }),
  )
  if (!longRes.ok) throw new Error(`Meta long-lived exchange failed: ${await longRes.text()}`)
  const long = await longRes.json()

  return {
    accessToken: long.access_token,
    // long-lived user tokens last ~60 days; Meta has no refresh_token —
    // you re-exchange before expiry or ask the user to reconnect.
    expiresAt: Date.now() + (long.expires_in || 60 * 24 * 3600) * 1000,
  }
}

/** Return the Pages the user manages, each with its own Page access token. */
export async function getManagedPages(userAccessToken) {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,fan_count,followers_count,picture&access_token=${userAccessToken}`,
  )
  if (!res.ok) throw new Error(`Meta /me/accounts failed: ${await res.text()}`)
  return (await res.json()).data || []
}
