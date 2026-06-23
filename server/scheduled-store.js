/*
 *  Queue of scheduled posts for platforms without native scheduling
 *  (Instagram, TikTok). Each record holds a PUBLIC media URL + caption + the
 *  time to publish; the cron worker publishes due posts. Backed by KV in prod
 *  or a JSON file locally (see kv.js).
 */
import crypto from 'node:crypto'
import { hashStore } from './kv.js'

const store = hashStore('schedlytics:scheduled', 'scheduled.json')

export const scheduled = {
  driver: store.driver,

  async all() {
    return Object.values(await store.all()).sort((a, b) => (a.publishAt || 0) - (b.publishAt || 0))
  },

  async add({ platform, caption = '', mediaUrl, publishAt }) {
    const id = crypto.randomBytes(6).toString('hex')
    const rec = {
      id,
      platform,
      caption,
      mediaUrl,
      publishAt: Number(publishAt),
      status: 'pending',
      createdAt: Date.now(),
    }
    await store.put(id, rec)
    return rec
  },

  async update(id, patch) {
    const cur = await store.get(id)
    if (!cur) return null
    const next = { ...cur, ...patch }
    await store.put(id, next)
    return next
  },

  async remove(id) {
    await store.del(id)
  },

  /** Pending posts whose time has arrived. */
  async due(now) {
    const all = Object.values(await store.all())
    return all.filter((p) => p.status === 'pending' && Number(p.publishAt) <= now)
  },
}
