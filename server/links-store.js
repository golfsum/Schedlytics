import { hashStore } from './kv.js'

/**
 * Local short-link store, keyed by slug. Used only when the ashrt.link
 * integration is not configured (otherwise links live in ashrt.link).
 * Backed by Vercel KV in production and a local JSON file in development.
 */
const h = hashStore('sched:links', '.links.json')

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
