import { store } from './store.js'

/** Refresh the access token if it has (or is about to) expire. */
export async function ensureFreshToken(platform, record) {
  const aboutToExpire = record.expiresAt && record.expiresAt - Date.now() < 60_000
  if (!aboutToExpire) return record
  if (typeof platform.refresh !== 'function') return record
  try {
    const refreshed = await platform.refresh(record.refreshToken, record)
    return store.set(platform.id, refreshed)
  } catch (err) {
    console.warn(`[${platform.id}] refresh failed, using existing token:`, err.message)
    return record
  }
}

/**
 * Return a valid access token (+ the full stored record) for a platform,
 * refreshing first if needed. Throws a 401-tagged error if not connected.
 */
export async function validAccessToken(platform) {
  let record = store.get(platform.id)
  if (!record?.accessToken) {
    const err = new Error('Not connected')
    err.status = 401
    throw err
  }
  record = await ensureFreshToken(platform, record)
  return { token: record.accessToken, record }
}
