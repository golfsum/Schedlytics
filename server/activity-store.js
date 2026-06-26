/**
 * Founder Mode activity feed: a bounded stream of the lifecycle moments that
 * matter during early access (signups, connections, first links, publishes,
 * upgrades, tickets, critical errors). Powers the admin Activity tab.
 */
import crypto from 'node:crypto'
import { hashStore } from './kv.js'

const h = hashStore('sched:activity', '.activity.json')
const MAX = 500

export const activity = {
  driver: h.driver,

  /** Record one event. type is a short tag (signup, connect, link, ...). */
  async add({ type, email = null, uid = null, detail = null }) {
    try {
      const list = (await h.get('events')) || []
      const ev = {
        id: crypto.randomBytes(5).toString('hex'),
        at: Date.now(),
        type: String(type || 'event').slice(0, 40),
        email: email ? String(email).slice(0, 160).toLowerCase() : null,
        uid: uid || null,
        detail: detail ? String(detail).slice(0, 200) : null,
      }
      list.push(ev)
      if (list.length > MAX) list.splice(0, list.length - MAX)
      await h.put('events', list)
      return ev
    } catch {
      // Activity logging must never break the action it is recording.
      return null
    }
  },

  /** Newest-first feed. */
  async all() {
    return ((await h.get('events')) || []).slice().reverse()
  },

  async clear() {
    await h.put('events', [])
  },
}
