/**
 * ============================================================================
 *  TikTok integration - Login Kit v2 (OAuth) + Display API
 * ============================================================================
 *
 *  Self-contained so it can be submitted on its own for TikTok's app review.
 *
 *  Developer setup (https://developers.tiktok.com):
 *    - Create an app → add the "Login Kit" and "Display API" products
 *    - Redirect URI:  {BASE_URL}/auth/tiktok/callback
 *    - Request scopes below; the app starts in Sandbox until audited
 *    - Put client key/secret in .env as TIKTOK_CLIENT_KEY / _SECRET
 *
 *  Scopes (read-only - login + stats):
 *    - user.info.basic   (open_id, display_name, avatar)
 *    - user.info.stats   (follower_count, likes_count, video_count)
 *    - video.list        (recent videos + their stats)
 *  (Add video.publish later for posting - requires the Content Posting API
 *   and a separate audit.)
 * ============================================================================
 */

import { creds, redirectUri } from '../config.js'

const AUTH_ENDPOINT = 'https://www.tiktok.com/v2/auth/authorize/'
const TOKEN_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/token/'
const API = 'https://open.tiktokapis.com/v2'

const SCOPES = ['user.info.basic', 'user.info.stats', 'video.list']

export const tiktok = {
  id: 'tiktok',
  name: 'TikTok',

  /** Step 1 - consent URL. Note TikTok uses `client_key`, not client_id. */
  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_key: creds.tiktok.clientKey,
      response_type: 'code',
      scope: SCOPES.join(','),
      redirect_uri: redirectUri('tiktok'),
      state,
    })
    return `${AUTH_ENDPOINT}?${params.toString()}`
  },

  /** Step 2 - exchange the code for tokens. */
  async exchangeCode(code) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: creds.tiktok.clientKey,
        client_secret: creds.tiktok.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri('tiktok'),
      }),
    })
    if (!res.ok) throw new Error(`TikTok token exchange failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  /** Step 3 - refresh. */
  async refresh(refreshToken) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: creds.tiktok.clientKey,
        client_secret: creds.tiktok.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`TikTok token refresh failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  /** Step 4 - user info + stats. */
  async getStats(accessToken) {
    const fields = [
      'open_id',
      'display_name',
      'avatar_url',
      'follower_count',
      'following_count',
      'likes_count',
      'video_count',
    ].join(',')

    const res = await fetch(`${API}/user/info/?fields=${fields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`TikTok user/info failed: ${await res.text()}`)
    const user = (await res.json()).data?.user
    if (!user) throw new Error('No TikTok user returned')

    return {
      platform: 'tiktok',
      handle: `@${user.display_name}`,
      name: user.display_name,
      avatar: user.avatar_url,
      followers: Number(user.follower_count || 0),
      metrics: [
        { label: 'followers', value: Number(user.follower_count || 0) },
        { label: 'likes', value: Number(user.likes_count || 0) },
        { label: 'videos', value: Number(user.video_count || 0) },
      ],
      raw: user,
    }
  },

  /** Optional - recent videos with engagement stats. */
  async getRecentVideos(accessToken, max = 10) {
    const fields = 'id,title,view_count,like_count,comment_count,share_count,create_time'
    const res = await fetch(`${API}/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: max }),
    })
    if (!res.ok) throw new Error(`TikTok video/list failed: ${await res.text()}`)
    return (await res.json()).data?.videos || []
  },
}

function normalizeTokens(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    scope: data.scope,
  }
}
