import crypto from 'node:crypto'
import { hashStore } from './kv.js'

/** Support tickets, keyed by id. */
const h = hashStore('sched:support', '.support.json')

export const support = {
  driver: h.driver,

  async all() {
    const map = await h.all()
    return Object.values(map).sort((a, b) => (b.at || 0) - (a.at || 0))
  },
  async add({ email, subject, message, userId }) {
    const id = crypto.randomBytes(5).toString('hex')
    const ticket = {
      id,
      email: String(email || '').trim().toLowerCase(),
      subject: String(subject || '').slice(0, 200),
      message: String(message || '').slice(0, 5000),
      userId: userId || null,
      status: 'open',
      at: Date.now(),
    }
    await h.put(id, ticket)
    return ticket
  },
  async update(id, patch) {
    const cur = await h.get(id)
    if (!cur) return null
    const next = { ...cur, ...patch }
    await h.put(id, next)
    return next
  },
}
