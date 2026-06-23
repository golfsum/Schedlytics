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

/**
 * What kind of direct publishing each platform supports right now.
 *   - 'video' / 'text': implemented and usable with the right scopes
 *   - 'review': API exists but needs platform app review before it works
 *   - 'none': no public posting endpoint
 */
export const PUBLISH_CAPABILITIES = {
  youtube: { mode: 'video', note: 'Upload a video by URL (youtube.upload scope).' },
  facebook: { mode: 'text', note: 'Post text or a link to your Page (pages_manage_posts).' },
  instagram: { mode: 'review', note: 'Needs the Instagram Content Publishing API (app review).' },
  tiktok: { mode: 'review', note: 'Needs the TikTok Content Posting API (audit required).' },
  pinterest: { mode: 'review', note: 'Needs pins:write plus a target board.' },
  twitch: { mode: 'none', note: 'Twitch has no post-to-feed endpoint.' },
  patreon: { mode: 'none', note: 'Patreon posting is not available via API.' },
}
