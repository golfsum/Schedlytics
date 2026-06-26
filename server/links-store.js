import { hashStore } from './kv.js'

/**
 * Local short-link store, keyed by slug. Used only when the ashrt.link
 * integration is not configured (otherwise links live in ashrt.link).
 * Backed by Vercel KV in production and a local JSON file in development.
 */
const h = hashStore('sched:links', '.links.json')

// Maps a short-link slug to the Firebase uid that created it, so we can scope
// the Links list per user even when the link itself lives in ashrt.link.
const ownersHash = hashStore('sched:link-owners', '.link-owners.json')
export const linkOwners = {
  async setOwner(slug, uid) {
    if (slug && uid) await ownersHash.put(String(slug), uid)
  },
  async ownerOf(slug) {
    return ownersHash.get(String(slug))
  },
  async remove(slug) {
    await ownersHash.del(String(slug))
  },
  /** { [slug]: uid } for every recorded owner. */
  async all() {
    return ownersHash.all()
  },
}

export const links = {
  driver: h.driver,

  async all() {
    const map = await h.all()
    return Object.values(map).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  },
  async get(slug) {
    return h.get(slug)
  },
  async add(link) {
    await h.put(link.slug, link)
    return link
  },
  async update(slug, patch) {
    const current = await h.get(slug)
    if (!current) return null
    const next = { ...current, ...patch }
    await h.put(slug, next)
    return next
  },
  async remove(slug) {
    await h.del(slug)
  },
}
