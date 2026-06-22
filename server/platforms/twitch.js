/**
 * ============================================================================
 *  Twitch integration  —  OAuth 2.0 + Helix API
 * ============================================================================
 *
 *  Self-contained module for Twitch login + channel stats.
 *
 *  Developer setup (https://dev.twitch.tv/console/apps):
 *    - Register an application
 *    - OAuth Redirect URL:  {BASE_URL}/auth/twitch/callback
 *    - .env: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
 *
 *  Scopes (read-only — login + stats):
 *    - user:read:email          (basic profile)
 *    - moderator:read:followers (follower count for the channel)
 *
 *  Important: every Helix request needs BOTH the Bearer token AND a
 *  "Client-Id" header. That is unique to Twitch.
 * ============================================================================
 */

import { creds, redirectUri } from '../config.js'

const AUTH_ENDPOINT = 'https://id.twitch.tv/oauth2/authorize'
const TOKEN_ENDPOINT = 'https://id.twitch.tv/oauth2/token'
const API = 'https://api.twitch.tv/helix'

const SCOPES = ['user:read:email', 'moderator:read:followers']

export const twitch = {
  id: 'twitch',
  name: 'Twitch',

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: creds.twitch.clientId,
      redirect_uri: redirectUri('twitch'),
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
    })
    return `${AUTH_ENDPOINT}?${params.toString()}`
  },

  async exchangeCode(code) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.twitch.clientId,
        client_secret: creds.twitch.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri('twitch'),
      }),
    })
    if (!res.ok) throw new Error(`Twitch token exchange failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  async refresh(refreshToken) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.twitch.clientId,
        client_secret: creds.twitch.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`Twitch token refresh failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  async getStats(accessToken) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': creds.twitch.clientId,
    }

    const userRes = await fetch(`${API}/users`, { headers })
    if (!userRes.ok) throw new Error(`Twitch users failed: ${await userRes.text()}`)
    const user = (await userRes.json()).data?.[0]
    if (!user) throw new Error('No Twitch user returned')

    // Follower total (needs moderator:read:followers; user must own/mod the channel).
    let followers = 0
    try {
      const fRes = await fetch(`${API}/channels/followers?broadcaster_id=${user.id}`, { headers })
      if (fRes.ok) followers = Number((await fRes.json()).total || 0)
    } catch {
      /* best-effort */
    }

    return {
      platform: 'twitch',
      handle: user.login,
      name: user.display_name,
      avatar: user.profile_image_url,
      followers,
      metrics: [
        { label: 'followers', value: followers },
        { label: 'total views', value: Number(user.view_count || 0) },
      ],
      raw: user,
    }
  },
}

function normalizeTokens(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 14400) * 1000,
    scope: Array.isArray(data.scope) ? data.scope.join(' ') : data.scope,
  }
}
