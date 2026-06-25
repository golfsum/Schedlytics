/**
 * ============================================================================
 *  YouTube integration - ALL THREE YouTube APIs
 * ============================================================================
 *
 *  Self-contained so it can be submitted on its own for Google's OAuth
 *  verification / API quota-extension review.
 *
 *  APIs used:
 *    1. YouTube Data API v3        → channel/video metadata, lifetime stats, UPLOADS (posting)
 *    2. YouTube Analytics API      → time-series & dimensional metrics (the dashboard data)
 *    3. YouTube Reporting API      → bulk async CSV reports (large-scale historical data)
 *
 *  Developer setup (https://console.cloud.google.com):
 *    - Create a project → enable all three:
 *        "YouTube Data API v3", "YouTube Analytics API", "YouTube Reporting API"
 *    - Configure the OAuth consent screen (External) + add test users
 *    - Create an "OAuth client ID" (Web application)
 *    - Authorized redirect URI:  {BASE_URL}/auth/youtube/callback
 *    - .env: YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
 *
 *  Scopes:
 *    - youtube.readonly                       (read channels/videos)
 *    - youtube.upload                         (RESTRICTED - uploads; needs Google audit)
 *    - https://www.googleapis.com/auth/youtube (manage: thumbnails, playlists)
 *    - yt-analytics.readonly                  (Analytics + Reporting metrics)
 *    - userinfo.profile
 *    (Add yt-analytics-monetary.readonly for estimatedRevenue.)
 *
 *  Quota: stats/analytics queries are cheap; an upload (videos.insert) costs
 *  ~1,600 of the default 10,000 units/day - that is the quota-extension request.
 * ============================================================================
 */

import { creds, redirectUri } from '../config.js'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const DATA_API = 'https://www.googleapis.com/youtube/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3'
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2'
const REPORTING_API = 'https://youtubereporting.googleapis.com/v1'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  // force-ssl is required to write comment replies (comments.insert).
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
]

export const youtube = {
  id: 'youtube',
  name: 'YouTube',

  /* ====================================================================== */
  /*  OAUTH (login)                                                          */
  /* ====================================================================== */

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: creds.youtube.clientId,
      redirect_uri: redirectUri('youtube'),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
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
        client_id: creds.youtube.clientId,
        client_secret: creds.youtube.clientSecret,
        redirect_uri: redirectUri('youtube'),
        grant_type: 'authorization_code',
      }),
    })
    if (!res.ok) throw new Error(`YouTube token exchange failed: ${await res.text()}`)
    return normalizeTokens(await res.json())
  },

  async refresh(refreshToken) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: creds.youtube.clientId,
        client_secret: creds.youtube.clientSecret,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) throw new Error(`YouTube token refresh failed: ${await res.text()}`)
    return { ...normalizeTokens(await res.json()), refreshToken }
  },

  /** Revoke the Google grant so disconnecting fully logs the account out. */
  async revoke({ accessToken, refreshToken } = {}) {
    const token = refreshToken || accessToken
    if (!token) return
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },

  /* ====================================================================== */
  /*  1) DATA API v3 - lifetime stats + metadata                           */
  /* ====================================================================== */

  /** Channel snapshot (cumulative counts) - used for the connect/profile card. */
  async getStats(accessToken) {
    const data = await getJson(
      `${DATA_API}/channels?part=snippet,statistics&mine=true`,
      accessToken,
    )
    const channel = data.items?.[0]
    if (!channel) throw new Error('No YouTube channel found for this account')
    const s = channel.statistics || {}
    return {
      platform: 'youtube',
      handle: channel.snippet?.customUrl || channel.snippet?.title,
      name: channel.snippet?.title,
      avatar: channel.snippet?.thumbnails?.default?.url,
      followers: Number(s.subscriberCount || 0),
      metrics: [
        { label: 'subscribers', value: Number(s.subscriberCount || 0) },
        { label: 'views', value: Number(s.viewCount || 0) },
        { label: 'videos', value: Number(s.videoCount || 0) },
      ],
      raw: channel,
    }
  },

  /**
   * Recent uploads with LIVE view/like/comment counts (Data API statistics,
   * no analytics lag). Uses the uploads playlist (cheap) instead of search.
   */
  async getRecentVideosLive(accessToken, max = 6) {
    const ch = await getJson(`${DATA_API}/channels?part=contentDetails&mine=true`, accessToken)
    const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploads) return []
    const pl = await getJson(
      `${DATA_API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=${Math.min(max, 25)}`,
      accessToken,
    )
    const ids = (pl.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean)
    if (!ids.length) return []
    const data = await getJson(`${DATA_API}/videos?part=snippet,statistics&id=${ids.join(',')}`, accessToken)
    return (data.items || []).map((v) => ({
      id: v.id,
      title: v.snippet?.title,
      thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
      publishedAt: v.snippet?.publishedAt,
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      comments: Number(v.statistics?.commentCount || 0),
      url: `https://www.youtube.com/watch?v=${v.id}`,
    }))
  },

  /** Most recent uploads with per-video view/like counts. */
  async getRecentVideos(accessToken, max = 5) {
    const search = await getJson(
      `${DATA_API}/search?part=snippet&forMine=true&type=video&order=date&maxResults=${max}`,
      accessToken,
    )
    const ids = search.items?.map((i) => i.id.videoId).filter(Boolean) || []
    if (ids.length === 0) return []
    const stats = await getJson(
      `${DATA_API}/videos?part=snippet,statistics&id=${ids.join(',')}`,
      accessToken,
    )
    return stats.items || []
  },

  /**
   * Recent comments on the connected channel's videos.
   *
   * Primary path: the channel-wide thread feed (allThreadsRelatedToChannelId),
   * which surfaces the newest comments across every video and needs the
   * youtube.force-ssl scope. Falls back to a per-video scan (youtube.readonly)
   * if that scope hasn't been granted yet.
   */
  async getComments(accessToken, max = 25) {
    const ch = await getJson(`${DATA_API}/channels?part=contentDetails,id&mine=true`, accessToken)
    const channel = ch.items?.[0]
    const channelId = channel?.id
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads
    if (!channelId) {
      const err = new Error('No YouTube channel found on this account. Create a channel first.')
      err.status = 400
      throw err
    }

    // 1. Channel-wide thread feed (needs force-ssl). Most reliable for new comments.
    let out = []
    if (channelId) {
      try {
        const data = await getJson(
          `${DATA_API}/commentThreads?part=snippet&order=time&maxResults=${Math.min(max, 100)}&allThreadsRelatedToChannelId=${channelId}`,
          accessToken,
        )
        out = (data.items || []).map(threadToComment)
      } catch {
        /* scope not granted yet (needs reconnect) or none - fall back */
      }
    }

    // 2. Fallback: scan recent uploads per-video (works with youtube.readonly).
    if (!out.length && uploads) {
      const pl = await getJson(
        `${DATA_API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=10`,
        accessToken,
      )
      const videoIds = (pl.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean)
      for (const videoId of videoIds) {
        try {
          const data = await getJson(
            `${DATA_API}/commentThreads?part=snippet&order=time&maxResults=10&videoId=${videoId}`,
            accessToken,
          )
          for (const it of data.items || []) out.push(threadToComment(it))
        } catch {
          /* comments disabled or unavailable for this video - skip it */
        }
      }
      out.sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0))
    }

    out = out.slice(0, max)
    await this.attachVideoTitles(accessToken, out)
    return out
  },

  /** Look up the title of each comment's video and attach it (best-effort). */
  async attachVideoTitles(accessToken, comments) {
    const ids = [...new Set(comments.map((c) => c.videoId).filter(Boolean))]
    if (!ids.length) return comments
    try {
      const data = await getJson(`${DATA_API}/videos?part=snippet&id=${ids.join(',')}`, accessToken)
      const titles = {}
      for (const v of data.items || []) titles[v.id] = v.snippet?.title
      for (const c of comments) if (c.videoId) c.videoTitle = titles[c.videoId]
    } catch {
      /* best-effort - leave titles unset */
    }
    return comments
  },

  /**
   * Diagnostic: report what the comment-fetch sees for this account, so we can
   * tell why comments may be missing (scope, video privacy, propagation).
   */
  async commentsDiagnostic(accessToken) {
    const out = { scopesHint: 'channel-wide needs youtube.force-ssl (reconnect)' }
    try {
      const ch = await getJson(`${DATA_API}/channels?part=contentDetails,id&mine=true`, accessToken)
      const channel = ch.items?.[0]
      out.channelId = channel?.id || null
      const uploads = channel?.contentDetails?.relatedPlaylists?.uploads
      out.uploadsPlaylist = uploads || null

      // Channel-wide feed (force-ssl).
      if (out.channelId) {
        try {
          const cw = await getJson(
            `${DATA_API}/commentThreads?part=snippet&order=time&maxResults=25&allThreadsRelatedToChannelId=${out.channelId}`,
            accessToken,
          )
          out.channelWide = { ok: true, count: (cw.items || []).length }
        } catch (e) {
          out.channelWide = { ok: false, error: e.message }
        }
      }

      // Recent uploads + per-video comment attempts.
      out.videos = []
      if (uploads) {
        const pl = await getJson(
          `${DATA_API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=10`,
          accessToken,
        )
        const ids = (pl.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean)
        // Privacy status of those videos.
        const priv = {}
        if (ids.length) {
          const vids = await getJson(`${DATA_API}/videos?part=status,snippet&id=${ids.join(',')}`, accessToken)
          for (const v of vids.items || []) priv[v.id] = { privacy: v.status?.privacyStatus, title: v.snippet?.title }
        }
        for (const id of ids) {
          const row = { id, title: priv[id]?.title, privacy: priv[id]?.privacy }
          try {
            const data = await getJson(
              `${DATA_API}/commentThreads?part=snippet&order=time&maxResults=10&videoId=${id}`,
              accessToken,
            )
            row.comments = (data.items || []).length
          } catch (e) {
            row.commentsError = e.message
          }
          out.videos.push(row)
        }
      }
    } catch (e) {
      out.error = e.message
    }
    return out
  },

  /**
   * Reply to a top-level comment thread (needs the youtube.force-ssl scope).
   * @param parentId  the top-level comment id to reply under
   * @param text      the reply body
   */
  async replyToComment(accessToken, parentId, text) {
    if (!parentId) throw new Error('replyToComment requires a parent comment id')
    if (!text?.trim()) throw new Error('replyToComment requires text')
    const res = await fetch(`${DATA_API}/comments?part=snippet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
    })
    if (!res.ok) {
      const body = await res.text()
      let reason = body
      try {
        reason = JSON.parse(body)?.error?.message || body
      } catch {
        /* keep raw */
      }
      const err = new Error(`YouTube ${res.status}: ${String(reason).slice(0, 220)}`)
      err.status = res.status
      throw err
    }
    const data = await res.json()
    return { id: data.id, text: data.snippet?.textDisplay }
  },

  /* ====================================================================== */
  /*  1b) DATA API v3 - POSTING (resumable upload)                         */
  /* ====================================================================== */

  /**
   * Upload a video using the resumable protocol.
   * @param accessToken  OAuth token with the youtube.upload scope
   * @param opts.videoBuffer  Buffer/Uint8Array of the video file bytes
   * @param opts.contentType  e.g. "video/mp4"
   * @param opts.title/description/tags/privacyStatus/categoryId
   * @returns the created video resource (id, snippet, status)
   */
  async uploadVideo(accessToken, opts) {
    const {
      videoBuffer,
      contentType = 'video/*',
      title,
      description = '',
      tags = [],
      privacyStatus = 'private',
      categoryId = '22', // "People & Blogs"
      publishAt, // RFC3339 - YouTube auto-publishes (public) at this time
    } = opts
    if (!videoBuffer?.length) throw new Error('uploadVideo requires videoBuffer')

    const metadata = {
      snippet: { title, description, tags, categoryId },
      // publishAt requires the video to be uploaded as private; YouTube makes it
      // public automatically at that time.
      status: {
        privacyStatus: publishAt ? 'private' : privacyStatus,
        selfDeclaredMadeForKids: false,
        ...(publishAt ? { publishAt } : {}),
      },
    }

    // (1) Open a resumable session - returns an upload URL in the Location header.
    const init = await fetch(
      `${UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBuffer.length),
        },
        body: JSON.stringify(metadata),
      },
    )
    if (!init.ok) throw new Error(`YouTube upload init failed: ${await init.text()}`)
    const uploadUrl = init.headers.get('location')
    if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL')

    // (2) Upload the bytes. (For very large files you would chunk this.)
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': String(videoBuffer.length) },
      body: videoBuffer,
    })
    if (!put.ok) throw new Error(`YouTube upload failed: ${await put.text()}`)
    return put.json()
  },

  /**
   * Open a resumable upload session and return the upload URL. The browser then
   * PUTs the video bytes straight to Google, bypassing our server's body limit
   * (important on serverless hosts like Vercel with ~4.5MB request caps).
   */
  async createUploadSession(accessToken, opts = {}) {
    const {
      title,
      description = '',
      tags = [],
      privacyStatus = 'private',
      categoryId = '22',
      contentType = 'video/*',
      contentLength,
      publishAt,
    } = opts
    if (!contentLength) throw new Error('createUploadSession requires contentLength')

    const metadata = {
      snippet: { title: title || 'Untitled', description, tags, categoryId },
      status: {
        privacyStatus: publishAt ? 'private' : privacyStatus,
        selfDeclaredMadeForKids: false,
        ...(publishAt ? { publishAt } : {}),
      },
    }
    const init = await fetch(`${UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(contentLength),
      },
      body: JSON.stringify(metadata),
    })
    if (!init.ok) throw new Error(`YouTube upload init failed: ${(await init.text()).slice(0, 220)}`)
    const uploadUrl = init.headers.get('location')
    if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL')
    return uploadUrl
  },

  /**
   * Generic media publish used by the app's media uploader: takes raw bytes and
   * uploads them as a video. Returns a watch URL.
   */
  async publishMedia(accessToken, _record, { buffer, contentType, title, description, tags, privacyStatus } = {}) {
    if (!buffer?.length) throw new Error('No video file received')
    const result = await this.uploadVideo(accessToken, {
      videoBuffer: buffer,
      contentType: contentType || 'video/mp4',
      title: title || 'Untitled',
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      privacyStatus: privacyStatus || 'private',
    })
    return {
      id: result.id,
      url: result.id ? `https://www.youtube.com/watch?v=${result.id}` : undefined,
      status: result.status,
    }
  },

  /** Set/replace a video's thumbnail (needs the manage scope). */
  async setThumbnail(accessToken, videoId, imageBuffer, contentType = 'image/jpeg') {
    const res = await fetch(
      `${UPLOAD_API}/thumbnails/set?videoId=${videoId}&uploadType=media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
        body: imageBuffer,
      },
    )
    if (!res.ok) throw new Error(`YouTube thumbnail set failed: ${await res.text()}`)
    return res.json()
  },

  /* ====================================================================== */
  /*  2) ANALYTICS API - time-series + dimensional metrics                 */
  /* ====================================================================== */

  /** Low-level query against youtubeAnalytics.reports. Returns {columnHeaders, rows}. */
  async getAnalytics(accessToken, { startDate, endDate, metrics, dimensions, sort, maxResults, filters }) {
    const range = startDate && endDate ? { startDate, endDate } : defaultRange()
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: range.startDate,
      endDate: range.endDate,
      metrics,
    })
    if (dimensions) params.set('dimensions', dimensions)
    if (sort) params.set('sort', sort)
    if (maxResults) params.set('maxResults', String(maxResults))
    if (filters) params.set('filters', filters)
    return getJson(`${ANALYTICS_API}/reports?${params}`, accessToken)
  },

  /** Daily time series - this is what powers the "Engagement Trend" chart. */
  async getDailyMetrics(accessToken, range = {}) {
    const result = await this.getAnalytics(accessToken, {
      ...range,
      dimensions: 'day',
      metrics: 'views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost',
      sort: 'day',
    })
    return mapRows(result)
  },

  /** Audience demographics (age × gender, % of views). */
  async getDemographics(accessToken, range = {}) {
    const result = await this.getAnalytics(accessToken, {
      ...range,
      dimensions: 'ageGroup,gender',
      metrics: 'viewerPercentage',
      sort: '-viewerPercentage',
    })
    return mapRows(result)
  },

  /** Where views come from (search, suggested, external, etc.). */
  async getTrafficSources(accessToken, range = {}) {
    const result = await this.getAnalytics(accessToken, {
      ...range,
      dimensions: 'insightTrafficSourceType',
      metrics: 'views,estimatedMinutesWatched',
      sort: '-views',
    })
    return mapRows(result)
  },

  /** Top videos by views for the period. */
  async getTopVideos(accessToken, { max = 10, ...range } = {}) {
    const result = await this.getAnalytics(accessToken, {
      ...range,
      dimensions: 'video',
      metrics: 'views,estimatedMinutesWatched,likes,subscribersGained',
      sort: '-views',
      maxResults: max,
    })
    return mapRows(result)
  },

  /* ====================================================================== */
  /*  3) REPORTING API - bulk async CSV reports                            */
  /* ====================================================================== */

  /** Catalog of report types you can subscribe to (e.g. channel_basic_a2). */
  async listReportTypes(accessToken) {
    return getJson(`${REPORTING_API}/reportTypes`, accessToken)
  },

  /** Existing reporting jobs (subscriptions). */
  async listReportingJobs(accessToken) {
    return getJson(`${REPORTING_API}/jobs`, accessToken)
  },

  /** Create a reporting job; YouTube then generates a CSV daily. */
  async createReportingJob(accessToken, reportTypeId, name) {
    const res = await fetch(`${REPORTING_API}/jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportTypeId, name: name || `schedlytics-${reportTypeId}` }),
    })
    if (!res.ok) throw new Error(`YouTube reporting job create failed: ${await res.text()}`)
    return res.json()
  },

  /** List the generated reports available for a job. */
  async listJobReports(accessToken, jobId) {
    return getJson(`${REPORTING_API}/jobs/${jobId}/reports`, accessToken)
  },

  /** Download a generated report (returns raw CSV text). */
  async downloadReport(accessToken, downloadUrl) {
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`YouTube report download failed: ${await res.text()}`)
    return res.text()
  },
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeTokens(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope,
  }
}

async function getJson(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    // Extract just the human-readable reason instead of dumping the whole JSON.
    const body = await res.text()
    let reason = body
    try {
      reason = JSON.parse(body)?.error?.message || body
    } catch {
      /* keep raw body */
    }
    throw new Error(`YouTube ${res.status}: ${String(reason).slice(0, 220)}`)
  }
  return res.json()
}

/** Normalize a commentThreads item into our comment shape. */
function threadToComment(it) {
  const c = it.snippet?.topLevelComment?.snippet || {}
  return {
    id: it.snippet?.topLevelComment?.id || it.id,
    author: c.authorDisplayName,
    avatar: c.authorProfileImageUrl,
    text: c.textDisplay,
    time: c.publishedAt,
    likeCount: Number(c.likeCount || 0),
    replyCount: Number(it.snippet?.totalReplyCount || 0),
    videoId: c.videoId || it.snippet?.videoId,
  }
}

/** Turn an Analytics {columnHeaders, rows} payload into array-of-objects. */
function mapRows(result) {
  const headers = (result.columnHeaders || []).map((h) => h.name)
  return (result.rows || []).map((row) =>
    Object.fromEntries(row.map((value, i) => [headers[i], value])),
  )
}

/** Default analytics window: the last 28 days. */
function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 28)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { startDate: iso(start), endDate: iso(end) }
}
