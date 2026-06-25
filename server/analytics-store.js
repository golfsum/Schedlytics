/**
 * First-party site analytics (privacy-friendly). We store, per UTC day:
 *   - views   : total page loads (non-unique)
 *   - visitors: a set of short salted hashes of IP+UA (for unique counts)
 *   - types   : view counts split by source - marketing site / app / demo
 *
 * No raw IPs or personal data are stored - only one-way hashes used solely to
 * de-duplicate visitors within a day. Counts are best-effort (a read-modify-
 * write per day), which is plenty accurate at this traffic level.
 */
import { hashStore } from './kv.js'

const h = hashStore('sched:analytics', '.analytics.json')

const MAX_VISITORS_PER_DAY = 5000 // bound storage for a hot day

export const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10)

/** The last `n` day-keys, newest first. */
function lastNDays(n) {
  const out = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return out
}

export const analytics = {
  driver: h.driver,

  /** Record one page load for `visitor` on `day`, tagged by source type. */
  async record({ day = dayKey(), visitor, type = 'site' }) {
    const cur = (await h.get(day)) || { views: 0, visitors: {}, types: {} }
    cur.views = (cur.views || 0) + 1
    cur.types = cur.types || {}
    cur.types[type] = (cur.types[type] || 0) + 1
    if (visitor && !cur.visitors[visitor] && Object.keys(cur.visitors).length < MAX_VISITORS_PER_DAY) {
      cur.visitors[visitor] = 1
    }
    await h.put(day, cur)
  },

  /** Totals + true uniques (union of daily sets) for today / 7d / 30d + a 14d series. */
  async summary() {
    const map = await h.all()
    const get = (day) => map[day] || { views: 0, visitors: {}, types: {} }
    // Demo opens may live under types.demo, or r.demo from older records.
    const demoOf = (r) => (r.types?.demo || 0) + (r.demo || 0)

    const agg = (days) => {
      let views = 0
      const types = { site: 0, app: 0, demo: 0 }
      const uniq = new Set()
      for (const day of days) {
        const r = get(day)
        views += r.views || 0
        for (const t in r.types || {}) types[t] = (types[t] || 0) + r.types[t]
        if (r.demo) types.demo += r.demo // back-compat
        for (const v in r.visitors || {}) uniq.add(v)
      }
      return { views, uniques: uniq.size, site: types.site, app: types.app, demo: types.demo }
    }

    const series = lastNDays(14)
      .reverse()
      .map((day) => {
        const r = get(day)
        return {
          day,
          views: r.views || 0,
          uniques: Object.keys(r.visitors || {}).length,
          demo: demoOf(r),
        }
      })

    return {
      today: agg(lastNDays(1)),
      week: agg(lastNDays(7)),
      month: agg(lastNDays(30)),
      series,
      driver: h.driver,
    }
  },
}
