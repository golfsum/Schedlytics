/**
 * ============================================================================
 *  Patreon integration - OAuth 2.0 + API v2
 * ============================================================================
 *
 *  Self-contained module for Patreon login + creator/campaign stats.
 *
 *  Developer setup (https://www.patreon.com/portal/registration/register-clients):
 *    - Register a client
 *    - Redirect URI:  {BASE_URL}/auth/patreon/callback
 *    - .env: PATREON_CLIENT_ID, PATREON_CLIENT_SECRET
 *
 *  Scopes (read-only - login + stats):
 *    - identity        (the logged-in user's profile)
 *    - campaigns       (the creator's campaign, including patron_count)
 *  (Add campaigns.members later to read individual patrons.)
 *
 *  Note: API v2 uses JSON:API style sparse fieldsets via fields[type]=... query
 *  params, and amounts (pledge_sum) are returned in cents.
 * ============================================================================
 */

import { creds, redirectUri } from '../config.js'

const AUTH_ENDPOINT = 'https://www.patreon.com/oauth2/authorize'
const TOKEN_ENDPOINT = 'https://www.patreon.com/api/oauth2/token'
const API = 'https://www.patreon.com/api/oauth2/v2'

const SCOPES = ['identity', 'campaigns']

export const patreon = {
  id: 'patreon',
  name: 'Patreon',

  getAuthUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: creds.patreon.clientId,
      redirect_uri: redirectUri('patreon'),
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
        code,
        grant_type: 'authorization_code',
        client_id: creds.patreon.clientId,
        client_secret: creds.patreon.clientSecret,
        redirect_uri: redirectUri('patreon'),
      }),
    })
    if (!res.ok) throw new Error(`Patreon token exchange failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  async refresh(refreshToken) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: creds.patreon.clientId,
        client_secret: creds.patreon.clientSecret,
      }),
    })
    if (!res.ok) throw new Error(`Patreon token refresh failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  async getStats(accessToken) {
    const headers = { Authorization: `Bearer ${accessToken}` }

    // Identity (the connected user).
    const idUrl = `${API}/identity?fields%5Buser%5D=full_name,image_url,vanity`
    const idRes = await fetch(idUrl, { headers })
    if (!idRes.ok) throw new Error(`Patreon identity failed: ${await idRes.text()}`)
    const user = (await idRes.json()).data?.attributes || {}

    // Campaign (creator metrics: patron_count + monthly pledge sum in cents).
    let patrons = 0
    let pledgeUsd = 0
    let campaignName = null
    try {
      const cUrl = `${API}/campaigns?fields%5Bcampaign%5D=patron_count,pledge_sum,creation_name`
      const cRes = await fetch(cUrl, { headers })
      if (cRes.ok) {
        const campaign = (await cRes.json()).data?.[0]?.attributes
        if (campaign) {
          patrons = Number(campaign.patron_count || 0)
          pledgeUsd = Math.round(Number(campaign.pledge_sum || 0) / 100)
          campaignName = campaign.creation_name || null
        }
      }
    } catch {
      /* a non-creator account has no campaign; that is fine */
    }

    return {
      platform: 'patreon',
      handle: user.vanity || user.full_name,
      name: campaignName || user.full_name,
      avatar: user.image_url,
      followers: patrons,
      metrics: [
        { label: 'patrons', value: patrons },
        { label: 'monthly pledged (USD)', value: pledgeUsd },
      ],
      raw: { user },
    }
  },
}

function normalizeTokens(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 2678400) * 1000, // ~31 days
    scope: data.scope,
  }
}
