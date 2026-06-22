import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Dead-simple token store backed by a JSON file.
 *
 * ⚠️  DEMO ONLY. A production app would:
 *   - key tokens by the logged-in user's id (this stores one user's tokens)
 *   - encrypt tokens at rest
 *   - use a real database (Postgres, Redis, etc.)
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, '.tokens.json')

function readAll() {
  if (!existsSync(FILE)) return {}
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeAll(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2))
}

export const store = {
  get(platform) {
    return readAll()[platform] || null
  },
  set(platform, tokens) {
    const all = readAll()
    all[platform] = { ...all[platform], ...tokens, updatedAt: Date.now() }
    writeAll(all)
    return all[platform]
  },
  remove(platform) {
    const all = readAll()
    delete all[platform]
    writeAll(all)
  },
  all() {
    return readAll()
  },
}
