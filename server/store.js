import { hashStore } from './kv.js'

/**
 * OAuth token store. Records are keyed by `${uid}:${platform}` so each signed-in
 * user only ever sees their own connected accounts. Backed by Vercel KV in
 * production and a local JSON file in development (see kv.js).
 *
 * When Firebase is not configured (local/dev single-user), the uid is '_local'.
 */
const h = hashStore('sched:tokens', '.tokens.json')

// Kept for the /health route (driver name only).
export const store = { driver: h.driver }

/** Per-user token accessor. All keys are scoped to this uid. */
export function userTokens(uid) {
  const key = (platform) => `${uid}:${platform}`
  return {
    async get(platform) {
      return h.get(key(platform))
    },
    async set(platform, patch) {
      const current = (await h.get(key(platform))) || {}
      const next = { ...current, ...patch, updatedAt: Date.now() }
      await h.put(key(platform), next)
      return next
    },
    async remove(platform) {
      await h.del(key(platform))
    },
    /** This user's records as { [platform]: record }. */
    async all() {
      const flat = await h.all()
      const out = {}
      for (const k of Object.keys(flat)) {
        const i = k.indexOf(':')
        if (i > 0 && k.slice(0, i) === uid) out[k.slice(i + 1)] = flat[k]
      }
      return out
    },
  }
}

/** Every token record across all users (for the cron). Keys split into uid + platform. */
export async function allTokenEntries() {
  const flat = await h.all()
  return Object.entries(flat).map(([k, record]) => {
    const i = k.indexOf(':')
    return i > 0
      ? { uid: k.slice(0, i), platform: k.slice(i + 1), record }
      : { uid: null, platform: k, record }
  })
}
