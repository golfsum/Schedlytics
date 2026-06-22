import { youtube } from './youtube.js'
import { tiktok } from './tiktok.js'
import { instagram } from './instagram.js'
import { facebook } from './facebook.js'
import { pinterest } from './pinterest.js'
import { twitch } from './twitch.js'
import { patreon } from './patreon.js'

/** Registry of every platform module, keyed by id. */
export const platforms = {
  youtube,
  tiktok,
  instagram,
  facebook,
  pinterest,
  twitch,
  patreon,
}

export function getPlatform(id) {
  return platforms[id] || null
}
