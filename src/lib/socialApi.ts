/**
 * Thin client for the Schedlytics OAuth/stats backend (see /server).
 *
 * If VITE_API_URL is set, the app talks to the real backend and drives genuine
 * OAuth + live stats. If it is unset, `backendEnabled` is false and the UI keeps
 * its built-in simulated connection flow so the demo still works standalone.
 */
import type { PlatformId } from '../types'
import { firebaseEnabled } from './firebase'

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

/**
 * Demo mode: when the URL has `?demo` (or a `/demo` path), the app runs with
 * simulated connections and sample data so anyone can try it with no sign-in
 * and no backend calls.
 */
export const demoMode =
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).has('demo') ||
    window.location.pathname.startsWith('/demo'))

/**
 * Backend mode is on when VITE_API_URL is set OR in a production build (same
 * origin "/api"), and never in demo mode. Otherwise the UI uses its built-in
 * simulated flow.
 */
export const backendEnabled = (Boolean(API) || import.meta.env.PROD) && !demoMode

/** Base URL of the backend. Empty string means same-origin (calls "/api/..."). */
export const apiBase = API ?? ''

/** Origin the backend serves from (used to validate OAuth popup messages). */
export const apiOrigin =
  typeof window !== 'undefined' ? (API ? new URL(API).origin : window.location.origin) : ''

/**
 * Whether to seed the UI with sample content (calendar posts, notifications,
 * analytics). True in demo mode, or when auth is disabled (local dev). A real
 * signed-in user starts empty and accumulates their own data.
 */
export const sampleData = demoMode || !firebaseEnabled

export interface RemoteAccount {
  connected: boolean
  connecting: boolean
  handle?: string
  name?: string
  avatar?: string
  followers?: number
}

export interface RemoteStats {
  platform: PlatformId
  handle: string
  name: string
  avatar?: string
  followers: number
  metrics: { label: string; value: number }[]
}

/**
 * Kick off the OAuth flow in a popup window so the Schedlytics app stays put.
 * Returns the popup handle, or null if it could not be opened (caller should
 * then fall back to a full-page redirect).
 */
export function startConnect(platform: PlatformId): Window | null {
  if (!backendEnabled) return null
  const url = `${apiBase}/auth/${platform}/start?popup=1`
  const w = 600
  const h = 720
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
  const popup = window.open(
    url,
    'schedlytics_oauth',
    `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no`,
  )
  return popup && !popup.closed ? popup : null
}

/** Full-page fallback when popups are blocked. */
export function startConnectRedirect(platform: PlatformId): void {
  if (!backendEnabled) return
  window.location.href = `${apiBase}/auth/${platform}/start`
}

/** Current connection status + cached profile for every platform. */
export async function fetchAccounts(): Promise<Record<string, RemoteAccount>> {
  if (!backendEnabled) return {}
  const res = await fetch(`${apiBase}/api/accounts`, { credentials: 'include' })
  if (!res.ok) throw new Error(`accounts ${res.status}`)
  return res.json()
}

/** Live stats for one connected platform. */
export async function fetchStats(platform: PlatformId): Promise<RemoteStats> {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}/api/${platform}/stats`, { credentials: 'include' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `stats ${res.status}`)
  return res.json()
}

/**
 * Platforms we can publish to directly right now (others schedule onto the
 * calendar instead). Mirrors the server's PUBLISH_CAPABILITIES for the modes
 * that are actually implemented.
 */
export const PUBLISH_MODES: Partial<Record<PlatformId, 'video' | 'text'>> = {
  youtube: 'video',
  facebook: 'text',
}

/** Publish a post to a connected platform (generic dispatch). Payload shape is
 *  platform-specific: Facebook uses { text, link }, Instagram { mediaUrl, caption }. */
export async function publishPost(
  platform: PlatformId,
  payload: Record<string, unknown>,
): Promise<{ id: string; url?: string }> {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}/api/${platform}/publish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`)
  return res.json()
}

/** Base64-encode a JSON object safely (handles unicode) for a header. */
function encodeMeta(meta: Record<string, unknown>): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(meta))))
}

/**
 * Upload a media file (the bytes) straight to a connected platform's API.
 * Metadata rides along in a header so no multipart parser is needed server-side.
 */
export async function publishMedia(
  platform: PlatformId,
  file: File | Blob,
  meta: Record<string, unknown>,
): Promise<{ id: string; url?: string }> {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}/api/${platform}/publish-media`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': (file as File).type || 'application/octet-stream',
      'X-Upload-Meta': encodeMeta(meta),
    },
    body: file,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`)
  return res.json()
}

export interface ScheduledPost {
  id: string
  platform: PlatformId
  caption: string
  mediaUrl: string
  publishAt: number
  status: 'pending' | 'published' | 'failed'
  error?: string
}

/** Queue a post for the cron worker (Instagram/TikTok, which lack native scheduling). */
export async function schedulePost(input: {
  platform: PlatformId
  caption: string
  mediaUrl: string
  publishAt: number
}): Promise<ScheduledPost> {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}/api/scheduled`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`)
  return res.json()
}

/** List queued scheduled posts. */
export async function listScheduled(): Promise<ScheduledPost[]> {
  if (!backendEnabled) return []
  const res = await fetch(`${apiBase}/api/scheduled`, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

/** Cancel a queued scheduled post. */
export async function cancelScheduled(id: string): Promise<void> {
  if (!backendEnabled) return
  await fetch(`${apiBase}/api/scheduled/${id}`, { method: 'DELETE', credentials: 'include' })
}

/** Disconnect a platform (revoke locally / remove stored tokens). */
export async function disconnectAccount(platform: PlatformId): Promise<void> {
  if (!backendEnabled) return
  await fetch(`${apiBase}/api/${platform}/disconnect`, {
    method: 'POST',
    credentials: 'include',
  })
}

/* -------------------------------------------------------------------------- */
/*  YouTube extras - Analytics API, posting (Data v3), Reporting API           */
/* -------------------------------------------------------------------------- */

async function getJson<T>(path: string): Promise<T> {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`)
  return res.json() as Promise<T>
}

export interface DailyMetric {
  day: string
  views: number
  estimatedMinutesWatched: number
  likes: number
  comments: number
  shares: number
  subscribersGained: number
  subscribersLost: number
}

/** Analytics API - daily time series (powers the engagement-trend chart). */
export function fetchYouTubeDaily(startDate?: string, endDate?: string) {
  const qs = new URLSearchParams()
  if (startDate) qs.set('startDate', startDate)
  if (endDate) qs.set('endDate', endDate)
  return getJson<DailyMetric[]>(`/api/youtube/analytics?${qs}`)
}

/** Analytics API - audience age × gender breakdown. */
export function fetchYouTubeDemographics() {
  return getJson<Record<string, string | number>[]>(`/api/youtube/analytics/demographics`)
}

/** Analytics API - traffic source breakdown. */
export function fetchYouTubeTraffic() {
  return getJson<Record<string, string | number>[]>(`/api/youtube/analytics/traffic`)
}

/** Analytics API - top videos by views. */
export function fetchYouTubeTopVideos(max = 10) {
  return getJson<Record<string, string | number>[]>(`/api/youtube/top-videos?max=${max}`)
}

export interface YouTubeComment {
  id: string
  author: string
  avatar?: string
  text: string
  time: string
  likeCount: number
  replyCount: number
  videoId?: string
  videoTitle?: string
}

/** Data API v3 - recent comment threads across the connected channel. */
export function fetchYouTubeComments(max = 20) {
  return getJson<YouTubeComment[]>(`/api/youtube/comments?max=${max}`)
}

export interface YouTubeVideo {
  id: string
  title: string
  thumbnail?: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  url: string
}

/** Data API v3 - recent uploads with LIVE view/like/comment counts (no lag). */
export function fetchYouTubeRecentVideos(max = 6) {
  return getJson<YouTubeVideo[]>(`/api/youtube/recent-videos?max=${max}`)
}

/** Opt the user in/out of the weekly growth brief email. Best-effort, no-throw. */
export function subscribeWeeklyBrief(email: string, enabled: boolean): Promise<void> {
  if (!backendEnabled || !email) return Promise.resolve()
  return fetch(`${apiBase}/api/weekly-brief/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, enabled }),
  })
    .then(() => undefined)
    .catch(() => undefined)
}

// Chunk size for resumable uploads: 4MB (a multiple of 256KB, as Google
// requires) and under serverless request-body limits (Vercel ~4.5MB).
const YT_CHUNK = 4 * 1024 * 1024
const YT_RESUMABLE = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'

interface YTUploadMeta {
  title: string
  description?: string
  tags?: string[]
  privacyStatus?: string
  /** RFC3339 time to auto-publish (public). Forces a private upload until then. */
  publishAt?: string
}

function buildYTMetadata(meta: YTUploadMeta) {
  return {
    snippet: {
      title: meta.title || 'Untitled',
      description: meta.description || '',
      tags: meta.tags || [],
      categoryId: '22',
    },
    status: {
      privacyStatus: meta.publishAt ? 'private' : meta.privacyStatus || 'private',
      selfDeclaredMadeForKids: false,
      ...(meta.publishAt ? { publishAt: meta.publishAt } : {}),
    },
  }
}

/**
 * Browser-direct resumable upload: the whole flow (create session + PUT bytes)
 * runs against Google with a short-lived token, so large files stream straight
 * from the browser with no server in the byte path and no size cap. Throws if
 * the token or Google's CORS isn't available, so the caller can fall back.
 */
async function uploadDirectToYouTube(
  file: File,
  meta: YTUploadMeta,
  onProgress?: (fraction: number) => void,
): Promise<{ id?: string; url?: string; privacyStatus?: string }> {
  const tokenRes = await fetch(`${apiBase}/api/youtube/upload-token`, { credentials: 'include' })
  if (!tokenRes.ok) throw new Error('no upload token')
  const { accessToken } = (await tokenRes.json()) as { accessToken?: string }
  if (!accessToken) throw new Error('no upload token')

  const fileType = file.type || 'video/*'
  const init = await fetch(YT_RESUMABLE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': fileType,
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify(buildYTMetadata(meta)),
  })
  if (!init.ok) throw new Error(`init ${init.status}`)
  const uploadUrl = init.headers.get('location')
  if (!uploadUrl) throw new Error('no upload url') // Location not exposed -> fall back

  // PUT via XHR so we get real upload progress (fetch can't report it).
  const data = await new Promise<{ id?: string; status?: { privacyStatus?: string } }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', fileType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({})
        }
      } else {
        reject(new Error(`put ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('network/CORS error'))
    xhr.send(file)
  })
  onProgress?.(1)
  return {
    id: data.id,
    url: data.id ? `https://www.youtube.com/watch?v=${data.id}` : undefined,
    privacyStatus: data.status?.privacyStatus,
  }
}

/**
 * Relay the file to Google in small chunks THROUGH our server. Works anywhere
 * (keeps each request under the serverless body cap), but is slower. Used as the
 * fallback when browser-direct upload isn't available.
 */
async function uploadViaRelay(
  file: File,
  meta: YTUploadMeta,
  onProgress?: (fraction: number) => void,
): Promise<{ id?: string; url?: string; privacyStatus?: string }> {
  const sess = await fetch(`${apiBase}/api/youtube/upload-session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: meta.title,
      description: meta.description || '',
      tags: meta.tags || [],
      privacyStatus: meta.privacyStatus || 'private',
      publishAt: meta.publishAt,
      contentType: file.type || 'video/mp4',
      contentLength: file.size,
    }),
  })
  if (!sess.ok) throw new Error((await sess.json().catch(() => ({}))).error || `session ${sess.status}`)
  const { uploadUrl } = (await sess.json()) as { uploadUrl: string }

  const total = file.size
  const fileType = file.type || 'video/*'
  let start = 0
  let id: string | undefined
  let privacyStatus: string | undefined
  while (start < total) {
    const end = Math.min(start + YT_CHUNK, total)
    const res = await fetch(`${apiBase}/api/youtube/upload-chunk`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Upload-Url': uploadUrl,
        'X-Upload-Range': `bytes ${start}-${end - 1}/${total}`,
        'X-File-Type': fileType,
      },
      body: file.slice(start, end),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `upload ${res.status}`)
    const data = (await res.json()) as { done: boolean; id?: string; status?: { privacyStatus?: string } }
    onProgress?.(end / total)
    if (data.done) {
      id = data.id
      privacyStatus = data.status?.privacyStatus
      break
    }
    start = end
  }
  return { id, url: id ? `https://www.youtube.com/watch?v=${id}` : undefined, privacyStatus }
}

/**
 * Upload a video FILE to YouTube. Tries a browser-direct upload first (best for
 * large 10-20+ minute videos), and falls back to a chunked server relay if the
 * direct path is blocked (e.g. CORS or no token).
 */
export async function publishYouTubeFile(
  file: File,
  meta: YTUploadMeta,
  onProgress?: (fraction: number) => void,
): Promise<{ id?: string; url?: string; privacyStatus?: string }> {
  if (!backendEnabled) throw new Error('backend disabled')
  try {
    return await uploadDirectToYouTube(file, meta, onProgress)
  } catch {
    // Direct upload unavailable - relay through the server instead.
    return uploadViaRelay(file, meta, onProgress)
  }
}

/** Data API v3 - reply to a comment (needs the youtube.force-ssl scope). */
export async function replyToYouTubeComment(parentId: string, text: string) {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}/api/youtube/comments/${encodeURIComponent(parentId)}/reply`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`)
  return res.json() as Promise<{ id: string; text?: string }>
}

/** Data API v3 - publish a video by URL (server fetches + resumable-uploads it). */
export async function publishYouTubeVideo(body: {
  videoUrl: string
  title: string
  description?: string
  tags?: string[]
  privacyStatus?: 'private' | 'unlisted' | 'public'
  publishAt?: string
}) {
  if (!backendEnabled) throw new Error('backend disabled')
  const res = await fetch(`${apiBase}/api/youtube/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`)
  return res.json()
}

/** Reporting API - list available report types / jobs / a job's reports. */
export const youtubeReporting = {
  reportTypes: () => getJson<unknown>(`/api/youtube/reporting/report-types`),
  jobs: () => getJson<unknown>(`/api/youtube/reporting/jobs`),
  jobReports: (jobId: string) => getJson<unknown>(`/api/youtube/reporting/jobs/${jobId}/reports`),
}
