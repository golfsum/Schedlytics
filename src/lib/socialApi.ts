/**
 * Thin client for the Schedlytics OAuth/stats backend (see /server).
 *
 * If VITE_API_URL is set, the app talks to the real backend and drives genuine
 * OAuth + live stats. If it is unset, `backendEnabled` is false and the UI keeps
 * its built-in simulated connection flow so the demo still works standalone.
 */
import type { PlatformId } from '../types'

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

/**
 * Backend mode is on when VITE_API_URL is set, OR in a production build (where
 * the app is served by the same deployment as the API, so it calls same-origin
 * "/api"). In local dev with no VITE_API_URL, backend mode is off (demo mode).
 */
export const backendEnabled = Boolean(API) || import.meta.env.PROD

/** Base URL of the backend. Empty string means same-origin (calls "/api/..."). */
export const apiBase = API ?? ''

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

/** Kick off the OAuth flow by navigating to the backend's start route. */
export function startConnect(platform: PlatformId): void {
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

/** Disconnect a platform (revoke locally / remove stored tokens). */
export async function disconnectAccount(platform: PlatformId): Promise<void> {
  if (!backendEnabled) return
  await fetch(`${apiBase}/api/${platform}/disconnect`, {
    method: 'POST',
    credentials: 'include',
  })
}

/* -------------------------------------------------------------------------- */
/*  YouTube extras — Analytics API, posting (Data v3), Reporting API           */
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

/** Analytics API — daily time series (powers the engagement-trend chart). */
export function fetchYouTubeDaily(startDate?: string, endDate?: string) {
  const qs = new URLSearchParams()
  if (startDate) qs.set('startDate', startDate)
  if (endDate) qs.set('endDate', endDate)
  return getJson<DailyMetric[]>(`/api/youtube/analytics?${qs}`)
}

/** Analytics API — audience age × gender breakdown. */
export function fetchYouTubeDemographics() {
  return getJson<Record<string, string | number>[]>(`/api/youtube/analytics/demographics`)
}

/** Analytics API — traffic source breakdown. */
export function fetchYouTubeTraffic() {
  return getJson<Record<string, string | number>[]>(`/api/youtube/analytics/traffic`)
}

/** Analytics API — top videos by views. */
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

/** Data API v3 — recent comment threads across the connected channel. */
export function fetchYouTubeComments(max = 20) {
  return getJson<YouTubeComment[]>(`/api/youtube/comments?max=${max}`)
}

/** Data API v3 — publish a video by URL (server fetches + resumable-uploads it). */
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

/** Reporting API — list available report types / jobs / a job's reports. */
export const youtubeReporting = {
  reportTypes: () => getJson<unknown>(`/api/youtube/reporting/report-types`),
  jobs: () => getJson<unknown>(`/api/youtube/reporting/jobs`),
  jobReports: (jobId: string) => getJson<unknown>(`/api/youtube/reporting/jobs/${jobId}/reports`),
}
