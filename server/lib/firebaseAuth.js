/*
 *  Minimal Firebase ID-token verifier (no firebase-admin dependency).
 *
 *  Firebase ID tokens are RS256 JWTs signed by Google. We fetch Google's public
 *  x509 certs, verify the signature, and validate the standard claims. This is
 *  enough to trust the `sub` (Firebase UID) for per-user settings sync.
 */
import crypto from 'node:crypto'

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

let cache = { certs: null, expires: 0 }

async function getCerts() {
  if (cache.certs && Date.now() < cache.expires) return cache.certs
  const res = await fetch(CERTS_URL)
  if (!res.ok) throw new Error('could not fetch Google signing certs')
  const certs = await res.json()
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '')
  cache = { certs, expires: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 3_600_000) }
  return certs
}

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'))
}

/** Verify a Firebase ID token and return { uid, email }. Throws on any problem. */
export async function verifyIdToken(token, projectId) {
  if (!token) throw new Error('missing token')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('malformed token')
  const [h, p, s] = parts

  const header = decodeSegment(h)
  if (header.alg !== 'RS256' || !header.kid) throw new Error('unexpected token header')

  const certs = await getCerts()
  const cert = certs[header.kid]
  if (!cert) throw new Error('unknown signing key')

  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(`${h}.${p}`)
  verifier.end()
  if (!verifier.verify(cert, Buffer.from(s, 'base64url'))) throw new Error('invalid signature')

  const claims = decodeSegment(p)
  const now = Math.floor(Date.now() / 1000)
  if (claims.exp <= now) throw new Error('token expired')
  if (claims.aud !== projectId) throw new Error('wrong audience')
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('wrong issuer')
  if (!claims.sub) throw new Error('token has no subject')

  return { uid: claims.sub, email: claims.email }
}
