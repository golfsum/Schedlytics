import dotenv from 'dotenv'
dotenv.config()

/**
 * Central configuration. Every secret comes from environment variables
 * (see .env.example) - nothing sensitive is hard-coded.
 */

export const PORT = Number(process.env.PORT) || 8787

// Public base URL of THIS backend (must match the redirect URIs you register
// in each developer console). On Vercel, VERCEL_URL is provided automatically;
// set BASE_URL to your custom domain for stable OAuth redirect URIs.
export const BASE_URL = (
  process.env.BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`)
).replace(/\/+$/, '') // never allow a trailing slash (avoids redirect_uri mismatch)

// Where to send the user back to after a connection finishes. Defaults to the
// backend's own origin (same-origin single deployment); override for split dev.
export const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL

/** The OAuth redirect/callback URL for a given platform. */
export const redirectUri = (platform) => `${BASE_URL}/auth/${platform}/callback`

export const PLATFORM_IDS = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'pinterest',
  'twitch',
  'patreon',
]

export const creds = {
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  },
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  },
  // Instagram + Facebook share one Meta app (same App ID / Secret).
  instagram: {
    clientId: process.env.META_APP_ID,
    clientSecret: process.env.META_APP_SECRET,
  },
  facebook: {
    clientId: process.env.META_APP_ID,
    clientSecret: process.env.META_APP_SECRET,
  },
  pinterest: {
    clientId: process.env.PINTEREST_APP_ID,
    clientSecret: process.env.PINTEREST_APP_SECRET,
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  },
  patreon: {
    clientId: process.env.PATREON_CLIENT_ID,
    clientSecret: process.env.PATREON_CLIENT_SECRET,
  },
}

/** Graph API version used for all Meta (Facebook/Instagram) calls. */
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0'

/**
 * ashrt.link integration. When apiUrl is set, Schedlytics mints its short links
 * through the ashrt.link service (so links live on that domain with shared
 * stats). When unset, Schedlytics uses its own built-in shortener.
 */
export const ashrt = {
  apiUrl: (process.env.ASHRT_API_URL || '').replace(/\/$/, ''),
  apiKey: process.env.ASHRT_API_KEY || '',
}
