import dotenv from 'dotenv'
dotenv.config()

/**
 * Central configuration. Every secret comes from environment variables
 * (see .env.example) — nothing sensitive is hard-coded.
 */

export const PORT = Number(process.env.PORT) || 8787

// Public base URL of THIS backend (must match the redirect URIs you register
// in each developer console). For local dev this is http://localhost:8787.
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`

// Where to send the user back to in the React app after a connection finishes.
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5185'

/** The OAuth redirect/callback URL for a given platform. */
export const redirectUri = (platform) => `${BASE_URL}/auth/${platform}/callback`

export const PLATFORM_IDS = ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest']

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
}

/** Graph API version used for all Meta (Facebook/Instagram) calls. */
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0'
