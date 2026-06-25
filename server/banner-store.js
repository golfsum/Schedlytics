/**
 * A single site-wide broadcast banner the admin can show to every app user
 * (e.g. "scheduled maintenance" or "TikTok is temporarily down").
 */
import { hashStore } from './kv.js'

const h = hashStore('sched:banner', '.banner.json')

export const banner = {
  async get() {
    return (await h.get('current')) || null
  },
  async set({ message, type } = {}) {
    const rec = {
      message: String(message || '').slice(0, 300),
      type: type === 'warning' ? 'warning' : 'info',
      active: true,
      at: Date.now(),
    }
    await h.put('current', rec)
    return rec
  },
  async clear() {
    await h.put('current', null)
  },
}
