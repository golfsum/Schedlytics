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
 *  Scopes (login + stats + posting):
 *    - user.info.basic   (open_id, display_name, avatar)
 *    - user.info.stats   (follower_count, likes_count, video_count)
 *    - video.list        (recent videos + their stats)
 *    - video.publish     (Content Posting API - requires app audit)
 *
 *  Posting note: until the app is audited, the Content Posting API only allows
 *  SELF_ONLY (private) posts, so uploads land as private on your TikTok.
 * ============================================================================
 */

import { creds, redirectUri } from '../config.js'

const AUTH_ENDPOINT = 'https://www.tiktok.com/v2/auth/authorize/'
const TOKEN_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/token/'
const API = 'https://open.tiktokapis.com/v2'

const SCOPES = ['user.info.basic', 'user.info.stats', 'video.list', 'video.publish']
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024 // TikTok single-chunk upload limit

// Privacy levels TikTok accepts for a direct post. Unaudited apps may only use
// SELF_ONLY; the creator_info query tells the UI which ones are allowed.
const PRIVACY_LEVELS = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY']
const normalizePrivacy = (p) => (PRIVACY_LEVELS.includes(p) ? p : 'SELF_ONLY')

// Turn a TikTok post/init error body into a clear, actionable message.
function tiktokInitError(text) {
  let code = ''
  try {
    code = JSON.parse(text)?.error?.code || ''
  } catch {
    /* not JSON */
  }
  const FRIENDLY = {
    unaudited_client_can_only_post_to_private_accounts:
      'While our TikTok app is in review, TikTok only allows posting to a TikTok account set to Private. In the TikTok app open Settings and privacy, then Privacy, and turn on "Private account", then try again.',
    spam_risk_too_many_pending_share:
      'TikTok has too many pending uploads for this account right now. Wait a few minutes and try again.',
    spam_risk_user_banned_from_posting:
      'TikTok has temporarily blocked posting for this account. Try again later.',
    url_ownership_unverified:
      'The video URL\'s domain must be verified in your TikTok app settings before TikTok will pull from it.',
    privacy_level_option_mismatch:
      'That privacy option is not available for this account right now. Pick another and try again.',
  }
  return new Error(FRIENDLY[code] || `TikTok could not start the upload: ${text.slice(0, 200)}`)
}

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

  /**
   * Revoke access so disconnecting really logs the account out. After this,
   * reconnecting requires the creator to approve on TikTok's consent screen
   * again instead of being signed in silently.
   */
  async revoke({ accessToken } = {}) {
    if (!accessToken) return
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: creds.tiktok.clientKey,
        client_secret: creds.tiktok.clientSecret,
        token: accessToken,
      }),
    })
    if (!res.ok) throw new Error(`TikTok revoke failed: ${(await res.text()).slice(0, 200)}`)
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

  /**
   * Content Posting API - query the creator's posting options. Required by
   * TikTok's UX guidelines so the composer can show the creator's real allowed
   * privacy levels and which interactions (comment/duet/stitch) are available.
   */
  async getCreatorInfo(accessToken) {
    const res = await fetch(`${API}/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    })
    if (!res.ok) throw new Error(`TikTok creator_info failed: ${(await res.text()).slice(0, 220)}`)
    const d = (await res.json()).data || {}
    return {
      creatorUsername: d.creator_username || '',
      creatorNickname: d.creator_nickname || '',
      avatarUrl: d.creator_avatar_url || '',
      privacyOptions: Array.isArray(d.privacy_level_options) && d.privacy_level_options.length
        ? d.privacy_level_options
        : ['SELF_ONLY'],
      commentDisabled: Boolean(d.comment_disabled),
      duetDisabled: Boolean(d.duet_disabled),
      stitchDisabled: Boolean(d.stitch_disabled),
      maxDurationSec: Number(d.max_video_post_duration_sec || 0),
    }
  },

  /**
   * Recent videos (Display API, video.list scope), normalized to the common
   * video shape the UI uses. Note: TikTok's video/list returns the user's
   * PUBLIC videos only, so SELF_ONLY/private posts will not appear here.
   */
  async getRecentVideos(accessToken, max = 10) {
    const fields = 'id,title,cover_image_url,share_url,view_count,like_count,comment_count,create_time'
    const res = await fetch(`${API}/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: Math.min(20, max) }),
    })
    if (!res.ok) throw new Error(`TikTok video/list failed: ${(await res.text()).slice(0, 200)}`)
    const videos = (await res.json()).data?.videos || []
    return videos.map((v) => ({
      id: String(v.id),
      title: v.title || 'TikTok video',
      thumbnail: v.cover_image_url || undefined,
      publishedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : '',
      views: Number(v.view_count || 0),
      likes: Number(v.like_count || 0),
      comments: Number(v.comment_count || 0),
      url: v.share_url || '',
      platform: 'tiktok',
    }))
  },

  /**
   * Upload a video to TikTok via the Content Posting API (direct post).
   * Single-chunk FILE_UPLOAD; lands as a private (SELF_ONLY) post until the app
   * is audited. Returns the publish_id for status polling.
   */
  async publishMedia(
    accessToken,
    _record,
    { buffer, contentType, title, privacyLevel, disableComment, disableDuet, disableStitch } = {},
  ) {
    if (!buffer?.length) throw new Error('No video file received')
    const size = buffer.length
    if (size > MAX_SINGLE_CHUNK) {
      throw new Error('TikTok upload here supports videos up to 64MB')
    }

    // 1. Initialize the direct post with the creator's chosen privacy +
    //    interaction settings (defaults to private, the only option until audit).
    const initRes = await fetch(`${API}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: title || '',
          privacy_level: normalizePrivacy(privacyLevel),
          disable_comment: Boolean(disableComment),
          disable_duet: Boolean(disableDuet),
          disable_stitch: Boolean(disableStitch),
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: size,
          chunk_size: size,
          total_chunk_count: 1,
        },
      }),
    })
    if (!initRes.ok) throw tiktokInitError(await initRes.text())
    const init = (await initRes.json()).data || {}
    if (!init.upload_url) throw new Error('TikTok did not return an upload URL')

    // 2. Upload the bytes in a single chunk.
    const put = await fetch(init.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'video/mp4',
        'Content-Length': String(size),
        'Content-Range': `bytes 0-${size - 1}/${size}`,
      },
      body: buffer,
    })
    if (!put.ok) throw new Error(`TikTok upload failed: ${(await put.text()).slice(0, 220)}`)

    return { id: init.publish_id, status: 'processing' }
  },

  /**
   * Publish from a PUBLIC video URL (used by the scheduler so no bytes need to
   * be stored). The URL's domain must be verified in your TikTok app settings.
   */
  async publishFromUrl(accessToken, { videoUrl, title, privacyLevel, disableComment, disableDuet, disableStitch } = {}) {
    if (!videoUrl) throw new Error('videoUrl is required')
    const res = await fetch(`${API}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: title || '',
          privacy_level: normalizePrivacy(privacyLevel),
          disable_comment: Boolean(disableComment),
          disable_duet: Boolean(disableDuet),
          disable_stitch: Boolean(disableStitch),
        },
        source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
      }),
    })
    if (!res.ok) throw tiktokInitError(await res.text())
    const data = (await res.json()).data || {}
    return { id: data.publish_id, status: 'processing' }
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
