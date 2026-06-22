import { hashStore } from './kv.js'

/**
 * OAuth token store, keyed by platform id. Backed by Vercel KV in production
 * and a local JSON file in development (see kv.js).
 *
 * ⚠️  Single-user demo store. A multi-user app would key by the logged-in user.
 */
const h = hashStore('sched:tokens', '.tokens.json')

export const store = {
  driver: h.driver,

  async get(platform) {
    return h.get(platform)
  },
  async set(platform, patch) {
    const current = (await h.get(platform)) || {}
    const next = { ...current, ...patch, updatedAt: Date.now() }
    await h.put(platform, next)
    return next
  },
  async remove(platform) {
    await h.del(platform)
  },
  async all() {
    return h.all()
  },
}
