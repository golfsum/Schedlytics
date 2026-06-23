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
}

/** Data API v3 - recent comment threads across the connected channel. */
export function fetchYouTubeComments(max = 20) {
  return getJson<YouTubeComment[]>(`/api/youtube/comments?max=${max}`)
}

/**
 * Upload a video FILE to YouTube without proxying the bytes through our server:
 * the server opens a resumable session, then the browser PUTs the bytes straight
 * to Google. This avoids serverless request-size limits (e.g. Vercel's ~4.5MB).
 */
export async function publishYouTubeFile(
  file: File,
  meta: { title: string; description?: string; tags?: string[]; privacyStatus?: string },
): Promise<{ id?: string; url?: string }> {
  if (!backendEnabled) throw new Error('backend disabled')
  // 1. Ask the server for a resumable upload URL (small JSON request).
  const sess = await fetch(`${apiBase}/api/youtube/upload-session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: meta.title,
      description: meta.description || '',
      tags: meta.tags || [],
      privacyStatus: meta.privacyStatus || 'private',
      contentType: file.type || 'video/mp4',
      contentLength: file.size,
    }),
  })
  if (!sess.ok) throw new Error((await sess.json().catch(() => ({}))).error || `session ${sess.status}`)
  const { uploadUrl } = (await sess.json()) as { uploadUrl: string }

  // 2. Upload the bytes straight to Google's resumable endpoint.
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/*' },
    body: file,
  })
  if (!put.ok) throw new Error(`YouTube upload failed (${put.status})`)
  const data = (await put.json().catch(() => ({}))) as { id?: string }
  return { id: data.id, url: data.id ? `https://www.youtube.com/watch?v=${data.id}` : undefined }
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
