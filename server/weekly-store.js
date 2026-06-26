import { hashStore } from './kv.js'

/**
 * Subscribers to the weekly growth brief email, keyed by lowercase email.
 * Opt-in is driven by the "Weekly performance report" toggle in Settings.
 */
const h = hashStore('sched:weekly-subs', '.weekly-subs.json')

export const weeklySubs = {
  driver: h.driver,

  async all() {
    return Object.values(await h.all())
  },
  /** Enable or disable the weekly brief for an email address. */
  async set(email, enabled, uid = null) {
    const key = String(email || '').trim().toLowerCase()
    if (!key) return
    if (!enabled) {
      await h.del(key)
      return
    }
    await h.put(key, { email: key, uid, enabled: true, since: Date.now() })
  },
}
