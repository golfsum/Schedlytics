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

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN
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
