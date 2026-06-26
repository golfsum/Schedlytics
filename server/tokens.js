import { userTokens } from './store.js'

/** Refresh the access token if it has (or is about to) expire. */
export async function ensureFreshToken(platform, record, uid) {
  const aboutToExpire = record.expiresAt && record.expiresAt - Date.now() < 60_000
  if (!aboutToExpire) return record
  if (typeof platform.refresh !== 'function') return record
  try {
    const refreshed = await platform.refresh(record.refreshToken, record)
    return await userTokens(uid).set(platform.id, refreshed)
  } catch (err) {
    console.warn(`[${platform.id}] refresh failed, using existing token:`, err.message)
    return record
  }
}

/**
 * Return a valid access token (+ the full stored record) for a platform and
 * user, refreshing first if needed. Throws a 401-tagged error if the user is
 * not signed in or the platform is not connected for that user.
 */
export async function validAccessToken(platform, uid) {
  if (!uid) {
    const err = new Error('Not signed in')
    err.status = 401
    throw err
  }
  let record = await userTokens(uid).get(platform.id)
  if (!record?.accessToken) {
    const err = new Error('Not connected')
    err.status = 401
    throw err
  }
  record = await ensureFreshToken(platform, record, uid)
  return { token: record.accessToken, record }
}
