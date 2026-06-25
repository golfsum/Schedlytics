/**
 * ============================================================================
 *  Pinterest integration - Pinterest API v5 (OAuth 2.0)
 * ============================================================================
 *
 *  Self-contained module for Pinterest login + account stats.
 *
 *  Developer setup (https://developers.pinterest.com):
 *    - Create an app → note App ID + App secret
 *    - Redirect URI:  {BASE_URL}/auth/pinterest/callback
 *    - Apps start with "Trial access"; request "Standard access" via review
 *    - .env: PINTEREST_APP_ID, PINTEREST_APP_SECRET
 *
 *  Scopes (read-only - login + stats):
 *    - user_accounts:read
 *    - pins:read
 *    - boards:read
 *  (Add pins:write / boards:write later for publishing.)
 *
 *  Token note: the token endpoint authenticates with HTTP Basic
 *  (base64(app_id:app_secret)) and the body is form-encoded.
 * ============================================================================
 */

import { creds, redirectUri } from '../config.js'

const AUTH_ENDPOINT = 'https://www.pinterest.com/oauth/'
const TOKEN_ENDPOINT = 'https://api.pinterest.com/v5/oauth/token'
const API = 'https://api.pinterest.com/v5'

const SCOPES = ['user_accounts:read', 'pins:read', 'boards:read']

export const pinterest = {
  id: 'pinterest',
  name: 'Pinterest',

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: creds.pinterest.clientId,
      redirect_uri: redirectUri('pinterest'),
      response_type: 'code',
      scope: SCOPES.join(','),
      state,
    })
    return `${AUTH_ENDPOINT}?${params.toString()}`
  },

  async exchangeCode(code) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + basicAuth(),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri('pinterest'),
      }),
    })
    if (!res.ok) throw new Error(`Pinterest token exchange failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  async refresh(refreshToken) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + basicAuth(),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`Pinterest token refresh failed: ${await res.text()}`)
    // Pinterest may not return a new refresh_token - keep the old one.
    return { ...normalizeTokens(await res.json()), refreshToken }
  },

  async getStats(accessToken) {
    const res = await fetch(`${API}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Pinterest user_account failed: ${await res.text()}`)
    const acct = await res.json()

    // Pinterest reports monthly_views as -1 when it cannot be calculated (for
    // example a personal account, or one without enough recent activity). Clamp
    // any negative count to 0 so the UI never shows "-1 monthly views".
    const count = (v) => Math.max(0, Number(v || 0))

    return {
      platform: 'pinterest',
      handle: acct.username,
      name: acct.username,
      avatar: acct.profile_image,
      followers: count(acct.follower_count),
      metrics: [
        { label: 'followers', value: count(acct.follower_count) },
        { label: 'monthly views', value: count(acct.monthly_views) },
        { label: 'pins', value: count(acct.pin_count) },
      ],
      raw: acct,
    }
  },
}

function basicAuth() {
  return Buffer.from(
    `${creds.pinterest.clientId}:${creds.pinterest.clientSecret}`,
  ).toString('base64')
}

function normalizeTokens(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope,
  }
}
