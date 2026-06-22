import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * File-backed store for shortened links. DEMO ONLY (single shared store);
 * a production app would key links by user and use a real database.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, '.links.json')

function read() {
  if (!existsSync(FILE)) return []
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return []
  }
}

function write(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2))
}

export const links = {
  all: () => read(),
  get: (slug) => read().find((l) => l.slug === slug) || null,
  add: (link) => {
    const all = read()
    all.unshift(link)
    write(all)
    return link
  },
  update: (slug, patch) => {
    const all = read()
    const i = all.findIndex((l) => l.slug === slug)
    if (i < 0) return null
    all[i] = { ...all[i], ...patch }
    write(all)
    return all[i]
  },
  remove: (slug) => write(read().filter((l) => l.slug !== slug)),
}
