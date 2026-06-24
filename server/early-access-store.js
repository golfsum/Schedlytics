import { hashStore } from './kv.js'

/**
 * Early-access sign-ups, keyed by lowercase email. The first EA_CAP sign-ups
 * get status "accepted"; the rest are "waitlist".
 */
const h = hashStore('sched:early-access', '.early-access.json')

export const EA_CAP = Number(process.env.EARLY_ACCESS_CAP) || 25

export const earlyAccess = {
  driver: h.driver,

  async all() {
    return Object.values(await h.all())
  },
  async acceptedCount() {
    return (await this.all()).filter((e) => e.status === 'accepted').length
  },
  /** Add an email. Returns { status, spotsLeft, already }. */
  async add(email) {
    const key = String(email || '').trim().toLowerCase()
    const existing = await h.get(key)
    if (existing) {
      const spotsLeft = Math.max(0, EA_CAP - (await this.acceptedCount()))
      return { status: existing.status, spotsLeft, already: true }
    }
    const accepted = await this.acceptedCount()
    const status = accepted < EA_CAP ? 'accepted' : 'waitlist'
    await h.put(key, { email: key, status, at: Date.now() })
    const spotsLeft = Math.max(0, EA_CAP - (await this.acceptedCount()))
    return { status, spotsLeft, already: false }
  },
}
