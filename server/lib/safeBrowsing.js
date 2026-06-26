/**
 * Google Safe Browsing v4 lookup, used to block shortening links that point at
 * known malware / phishing pages. No-op (allows everything) until
 * SAFE_BROWSING_API_KEY is set, so it never blocks links by default.
 *
 * Get a key: Google Cloud Console -> enable "Safe Browsing API" -> API key.
 */
const KEY = process.env.SAFE_BROWSING_API_KEY
export const safeBrowsingEnabled = Boolean(KEY)

const THREAT_TYPES = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION']

/**
 * Returns false only when the URL is a CONFIRMED threat. Fails open: if no key
 * is configured or the API errors, returns true so legitimate links are never
 * blocked by an outage.
 */
export async function isUrlSafe(url) {
  if (!KEY) return true
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'schedlytics', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    })
    if (!r.ok) return true // fail open on API error
    const data = await r.json().catch(() => ({}))
    return !(data && Array.isArray(data.matches) && data.matches.length > 0)
  } catch {
    return true // fail open on network error
  }
}
