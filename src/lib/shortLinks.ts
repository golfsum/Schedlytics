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
 * redirects — never the unowned "sched.ly" placeholder.
 */
import { apiBase, backendEnabled } from './socialApi'

export interface ShortLink {
  slug: string
  url: string
  shortUrl: string
  clicks: number
  createdAt?: number
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
  const seeds: [string, string, number][] = [
    ['https://www.instagram.com/', 'sumr26', 1284],
    ['https://www.youtube.com/', 'ytlive', 932],
    ['https://www.pinterest.com/', 'newco', 2571],
  ]
  writeLocal(
    seeds.map(([url, slug, clicks]) => ({ slug, url, shortUrl: localShortUrl(slug), clicks })),
  )
}

/* ------------------------------ backend calls ----------------------------- */

async function apiList(): Promise<ShortLink[]> {
  const r = await fetch(`${apiBase}/api/links`)
  if (!r.ok) throw new Error('list failed')
  return r.json()
}
async function apiCreate(url: string): Promise<ShortLink> {
  const r = await fetch(`${apiBase}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'create failed')
  return r.json()
}
async function apiDelete(slug: string): Promise<void> {
  await fetch(`${apiBase}/api/links/${slug}`, { method: 'DELETE' })
}

/* ------------------------------ unified API ------------------------------- */

function createLocal(url: string): ShortLink {
  const slug = randomSlug()
  const link: ShortLink = { slug, url, shortUrl: localShortUrl(slug), clicks: 0, createdAt: Date.now() }
  writeLocal([link, ...readLocal()])
  return link
}

export async function listShortLinks(): Promise<ShortLink[]> {
  if (backendEnabled) {
    try {
      return await apiList()
    } catch {
      // backend unreachable — fall back to local links so the page still works
    }
  }
  seedIfEmpty()
  return readLocal()
}

export async function createShortLink(rawUrl: string): Promise<ShortLink> {
  const url = normalizeUrl(rawUrl)
  if (!url) throw new Error('Please enter a URL')
  if (backendEnabled) {
    try {
      return await apiCreate(url)
    } catch {
      // backend unreachable — still give the user a working (local) short link
    }
  }
  return createLocal(url)
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
  writeLocal(list)
  location.replace(link.url)
  return true
}
