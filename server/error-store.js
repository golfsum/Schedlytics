/**
 * User-facing error log for the admin dashboard. Every error a user sees in the
 * app (publish failures, connection problems, uncaught errors) is reported here
 * so support can spot what is breaking, how often, and for whom.
 *
 * Stored as a single bounded list (newest kept) to keep storage predictable.
 */
import crypto from 'node:crypto'
import { hashStore } from './kv.js'

const h = hashStore('sched:errors', '.errors.json')
const MAX = 500

export const errors = {
  driver: h.driver,

  async add(ev = {}) {
    const list = (await h.get('events')) || []
    list.push({
      id: crypto.randomBytes(5).toString('hex'),
      at: Date.now(),
      context: String(ev.context || 'app').slice(0, 200),
      message: String(ev.message || '').slice(0, 1000),
      email: ev.email ? String(ev.email).slice(0, 160).toLowerCase() : null,
      platform: ev.platform ? String(ev.platform).slice(0, 24) : null,
      url: ev.url ? String(ev.url).slice(0, 200) : null,
      source: ev.source === 'server' ? 'server' : 'client',
    })
    if (list.length > MAX) list.splice(0, list.length - MAX)
    await h.put('events', list)
  },

  /** Newest-first list of every stored error event. */
  async all() {
    return ((await h.get('events')) || []).slice().reverse()
  },

  async clear() {
    await h.put('events', [])
  },

  /** Aggregations for the admin Errors tab: top errors, top users, recent. */
  async summary() {
    const all = await this.all()
    const dayAgo = Date.now() - 86_400_000
    const groups = new Map()
    const byUser = new Map()

    for (const e of all) {
      const key = `${e.context}|${e.message}`.slice(0, 240)
      let g = groups.get(key)
      if (!g) {
        g = { context: e.context, message: e.message, count: 0, lastAt: 0, users: new Set() }
        groups.set(key, g)
      }
      g.count += 1
      g.lastAt = Math.max(g.lastAt, e.at)
      if (e.email) g.users.add(e.email)

      const u = e.email || 'anonymous'
      byUser.set(u, (byUser.get(u) || 0) + 1)
    }

    const topGroups = [...groups.values()]
      .map((g) => ({ context: g.context, message: g.message, count: g.count, lastAt: g.lastAt, users: g.users.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40)

    const topUsers = [...byUser.entries()]
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40)

    return {
      total: all.length,
      last24h: all.filter((e) => e.at >= dayAgo).length,
      affectedUsers: [...byUser.keys()].filter((u) => u !== 'anonymous').length,
      topGroups,
      topUsers,
      recent: all.slice(0, 120),
      driver: h.driver,
    }
  },
}
