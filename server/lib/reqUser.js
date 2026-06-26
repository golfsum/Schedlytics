import { verifyIdToken } from './firebaseAuth.js'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID

/** True when Firebase auth is configured (production is multi-tenant). */
export const multiTenant = Boolean(PROJECT_ID)

/**
 * Resolve the Firebase UID for a request. Reads the ID token from the
 * Authorization Bearer header, or from a ?t= query param (the OAuth popup can
 * only pass it via the URL). When Firebase is not configured (local dev /
 * single-user), returns a fixed '_local' uid so the app still works without auth.
 * Returns null when auth is required but the token is missing or invalid.
 */
export async function uidFromReq(req) {
  if (!PROJECT_ID) return '_local'
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '')
  const token = m ? m[1] : req.query?.t ? String(req.query.t) : ''
  if (!token) return null
  try {
    return (await verifyIdToken(token, PROJECT_ID)).uid
  } catch {
    return null
  }
}
