import { hashStore } from './kv.js'

/**
 * Manually-curated set of "Founder" users, managed from the admin dashboard.
 * Stored as { [uid]: true }. Backed by Vercel KV in production and a local JSON
 * file in development (see kv.js).
 */
const h = hashStore('sched:founders', '.founders.json')

export const founders = {
  /** { [uid]: true } for every founder. */
  async all() {
    return h.all()
  },
  /** Mark or unmark a user as a founder. */
  async set(uid, on) {
    if (!uid) return
    if (on) await h.put(String(uid), true)
    else await h.del(String(uid))
  },
}
