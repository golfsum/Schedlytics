/**
 * URL shortener client.
 *
 * - When a backend is configured (VITE_API_URL), links are created on the
 *   server and the short URL is {backend}/s/<slug>, which 302-redirects.
 * - Otherwise it falls back to a fully client-side shortener: links are stored
 *   in localStorage and the short URL is {appOrigin}/#/s/<slug>. On load, the
 *   app detects that hash and redirects. This means short links work even with
 *   no backend running (within the same browser).
 *
 * Either way the generated link is on a domain that actually resolves and
 * redirects - never the unowned "sched.ly" placeholder.
 */
import { apiBase, backendEnabled, authToken } from './socialApi'
import type { PlatformId } from '../types'

export interface ShortLink {
  slug: string
  url: string
  shortUrl: string
  clicks: number
  createdAt?: number
  /* Optional attribution metadata (populated client-side for the demo path). */
  campaign?: string
  sourcePost?: string
  platform?: PlatformId
  uniqueVisitors?: number
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  expiresAt?: number
}

/** Metadata accepted when creating a tracked link. */
export interface ShortLinkMeta {
  customSlug?: string
  campaign?: string
  sourcePost?: string
  platform?: PlatformId
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

const KEY = 'schedlytics_links_v1'

/** Add https:// if the user omitted a scheme. */
export function normalizeUrl(input: string): string {
  const t = input.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

/** Strip the scheme for a tidier on-screen label. */
export function displayShort(shortUrl: string): string {
  return shortUrl.replace(/^https?:\/\//, '')
}

/* ------------------------------ local store ------------------------------ */

function readLocal(): ShortLink[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
function writeLocal(list: ShortLink[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}
function localShortUrl(slug: string): string {
  return `${location.origin}${location.pathname}#/s/${slug}`
}
function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Seed a few working example links on first run (demo polish). */
function seedIfEmpty() {
  if (localStorage.getItem(KEY) !== null) return
  const seeds: Partial<ShortLink>[] = [
    {
      url: 'https://www.instagram.com/', slug: 'sumr26', clicks: 1284, uniqueVisitors: 1041,
      campaign: 'Summer Sale', sourcePost: 'Summer drop', platform: 'instagram',
      utmSource: 'instagram', utmMedium: 'social', utmCampaign: 'summer_sale',
    },
    {
      url: 'https://www.youtube.com/', slug: 'ytlive', clicks: 932, uniqueVisitors: 778,
      campaign: 'Digital Planner Launch', sourcePost: 'Launch trailer', platform: 'youtube',
      utmSource: 'youtube', utmMedium: 'video', utmCampaign: 'planner_launch',
    },
    {
      url: 'https://www.pinterest.com/', slug: 'newco', clicks: 2571, uniqueVisitors: 1903,
      campaign: 'Newsletter Growth', sourcePost: 'Pin board refresh', platform: 'pinterest',
      utmSource: 'pinterest', utmMedium: 'social', utmCampaign: 'newsletter',
    },
  ]
  writeLocal(seeds.map((s) => ({ ...s, shortUrl: localShortUrl(s.slug as string) }) as ShortLink))
}

/* ------------------------------ backend calls ----------------------------- */

/** Authorization header so the backend scopes links to the signed-in user. */
async function authHeader(extra?: Record<string, string>): Promise<Record<string, string>> {
  const t = await authToken()
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(extra || {}) }
}

async function apiList(): Promise<ShortLink[]> {
  const r = await fetch(`${apiBase}/api/links`, { headers: await authHeader() })
  if (!r.ok) throw new Error('list failed')
  return r.json()
}
async function apiCreate(url: string): Promise<ShortLink> {
  const r = await fetch(`${apiBase}/api/links`, {
    method: 'POST',
    headers: await authHeader({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ url }),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'create failed')
  return r.json()
}
async function apiDelete(slug: string): Promise<void> {
  await fetch(`${apiBase}/api/links/${slug}`, { method: 'DELETE', headers: await authHeader() })
}

/* ------------------------------ unified API ------------------------------- */

function createLocal(url: string, meta?: ShortLinkMeta): ShortLink {
  const slug = (meta?.customSlug || '').trim().replace(/[^A-Za-z0-9_-]/g, '') || randomSlug()
  const link: ShortLink = {
    slug,
    url,
    shortUrl: localShortUrl(slug),
    clicks: 0,
    uniqueVisitors: 0,
    createdAt: Date.now(),
    campaign: meta?.campaign,
    sourcePost: meta?.sourcePost,
    platform: meta?.platform,
    utmSource: meta?.utmSource,
    utmMedium: meta?.utmMedium,
    utmCampaign: meta?.utmCampaign,
  }
  writeLocal([link, ...readLocal()])
  return link
}

export async function listShortLinks(): Promise<ShortLink[]> {
  if (backendEnabled) {
    try {
      return await apiList()
    } catch {
      // backend unreachable - fall back to local links so the page still works
    }
  }
  seedIfEmpty()
  return readLocal()
}

export async function createShortLink(rawUrl: string, meta?: ShortLinkMeta): Promise<ShortLink> {
  const url = normalizeUrl(rawUrl)
  if (!url) throw new Error('Please enter a URL')
  if (backendEnabled) {
    try {
      // Backend ignores attribution metadata for now (Phase 1); merge it back
      // onto the returned link so the UI reflects what the user entered.
      return { ...(await apiCreate(url)), ...stripUndefined(meta) }
    } catch {
      // backend unreachable - still give the user a working (local) short link
    }
  }
  return createLocal(url, meta)
}

/** Drop undefined keys so a spread does not clobber server-provided values. */
function stripUndefined(meta?: ShortLinkMeta): Partial<ShortLink> {
  if (!meta) return {}
  const { customSlug: _omit, ...rest } = meta
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
}

export async function deleteShortLink(slug: string): Promise<void> {
  if (backendEnabled) {
    try {
      await apiDelete(slug)
    } catch {
      /* ignore */
    }
  }
  // Always clear any local copy too.
  writeLocal(readLocal().filter((l) => l.slug !== slug))
}

/**
 * Handle a client-side short link of the form {origin}/#/s/<slug>.
 * Returns true if it kicked off a redirect (caller should skip rendering).
 * Backend short links redirect server-side, so they never reach here.
 */
export function resolveShortLinkRedirect(): boolean {
  const m = location.hash.match(/^#\/s\/([A-Za-z0-9]+)$/)
  if (!m) return false
  const slug = m[1]
  const list = readLocal()
  const link = list.find((l) => l.slug === slug)
  if (!link) return false
  link.clicks = (link.clicks || 0) + 1
  // Count this browser as a unique visitor once per slug.
  const visitedKey = `sl_v_${slug}`
  if (!localStorage.getItem(visitedKey)) {
    link.uniqueVisitors = (link.uniqueVisitors || 0) + 1
    try {
      localStorage.setItem(visitedKey, '1')
    } catch {
      /* ignore quota errors */
    }
  }
  writeLocal(list)
  location.replace(link.url)
  return true
}
