import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Storage helpers with two backends, chosen automatically:
 *   - Vercel KV / Upstash Redis  (when KV_REST_API_URL + KV_REST_API_TOKEN are set)
 *   - local JSON files / memory  (everything else, e.g. `npm start`)
 *
 * Vercel serverless has a read-only filesystem and no shared memory between
 * invocations, so production must use KV. Locally the file/memory path keeps it
 * zero-config. Everything is async so the two backends are interchangeable.
 */

// Accept either Vercel KV or Upstash Redis env var names.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
export const useKV = Boolean(KV_URL && KV_TOKEN)

const __dirname = dirname(fileURLToPath(import.meta.url))

async function redis(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.result
}

/** Health probe for the storage backend (Redis PING, or local file fallback). */
export async function kvPing() {
  if (!useKV) return { ok: true, backend: 'local file', latencyMs: 0 }
  const start = Date.now()
  const r = await redis(['PING'])
  return { ok: r === 'PONG', backend: 'Vercel KV', latencyMs: Date.now() - start }
}

/* ----------------------- hash store (field -> object) --------------------- */

/**
 * A map-like store keyed by `field`. Backed by a Redis hash in prod or a JSON
 * file locally.
 */
export function hashStore(hashKey, fileName) {
  const FILE = join(__dirname, fileName)

  const fileRead = () => {
    if (!existsSync(FILE)) return {}
    try {
      return JSON.parse(readFileSync(FILE, 'utf8'))
    } catch {
      return {}
    }
  }
  const fileWrite = (obj) => writeFileSync(FILE, JSON.stringify(obj, null, 2))

  return {
    driver: useKV ? 'kv' : 'file',

    async all() {
      if (!useKV) return fileRead()
      const flat = (await redis(['HGETALL', hashKey])) || []
      const out = {}
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1])
      return out
    },
    async get(field) {
      if (!useKV) return fileRead()[field] || null
      const v = await redis(['HGET', hashKey, field])
      return v ? JSON.parse(v) : null
    },
    async put(field, value) {
      if (!useKV) {
        const obj = fileRead()
        obj[field] = value
        fileWrite(obj)
        return value
      }
      await redis(['HSET', hashKey, field, JSON.stringify(value)])
      return value
    },
    async del(field) {
      if (!useKV) {
        const obj = fileRead()
        delete obj[field]
        fileWrite(obj)
        return
      }
      await redis(['HDEL', hashKey, field])
    },
  }
}

/* ------------------------------ rate limiting ----------------------------- */

const rlMem = new Map() // local fallback (fixed window per key)

/**
 * Fixed-window rate limit. Returns { allowed, retryAfter }. Backed by an atomic
 * Redis INCR+EXPIRE in prod, or an in-memory window locally. Never throws.
 */
export async function rateLimit(key, max, windowSeconds) {
  try {
    if (!useKV) {
      const now = Date.now()
      const e = rlMem.get(key)
      if (!e || now > e.reset) {
        rlMem.set(key, { count: 1, reset: now + windowSeconds * 1000 })
        return { allowed: true }
      }
      e.count += 1
      if (e.count > max) return { allowed: false, retryAfter: Math.ceil((e.reset - now) / 1000) }
      return { allowed: true }
    }
    const k = `rl:${key}`
    const count = await redis(['INCR', k])
    if (count === 1) await redis(['EXPIRE', k, String(windowSeconds)])
    if (count > max) {
      let ttl = await redis(['TTL', k])
      if (!(ttl > 0)) ttl = windowSeconds
      return { allowed: false, retryAfter: ttl }
    }
    return { allowed: true }
  } catch {
    // Never let the limiter break a request.
    return { allowed: true }
  }
}

/* ------------------------ state store (with TTL) -------------------------- */

const mem = new Map() // local fallback

/** Short-lived key/value (used for the OAuth CSRF state). */
export const stateStore = {
  async set(key, value, ttlSeconds) {
    if (!useKV) {
      mem.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
      return
    }
    await redis(['SET', `state:${key}`, JSON.stringify(value), 'EX', String(ttlSeconds)])
  },
  async get(key) {
    if (!useKV) {
      const e = mem.get(key)
      if (!e) return null
      if (Date.now() > e.expires) {
        mem.delete(key)
        return null
      }
      return e.value
    }
    const v = await redis(['GET', `state:${key}`])
    return v ? JSON.parse(v) : null
  },
  async del(key) {
    if (!useKV) {
      mem.delete(key)
      return
    }
    await redis(['DEL', `state:${key}`])
  },
}
