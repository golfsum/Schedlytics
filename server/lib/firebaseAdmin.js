/*
 *  Firebase Admin SDK (service-account) — powers the admin "Users" tab:
 *  listing accounts and minting password-reset links. This is separate from
 *  the lightweight token verifier in firebaseAuth.js (which only checks
 *  signatures and cannot enumerate or manage users).
 *
 *  Credentials are read once, lazily, from one of (in priority order):
 *    1. FIREBASE_SERVICE_ACCOUNT      — the service-account JSON, inline.
 *       Accepts raw JSON or base64-encoded JSON (handy for Vercel env vars).
 *    2. GOOGLE_APPLICATION_CREDENTIALS — a path to the JSON key file
 *       (the Admin SDK's own default; we just let initializeApp() find it).
 *
 *  When neither is present, isConfigured() is false and the endpoints report
 *  "not configured" instead of crashing — so the rest of admin v1 keeps working.
 */
let appPromise = null
let configured = null

function parseServiceAccount(raw) {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  return JSON.parse(text)
}

/** Lazily initialise (or reuse) the Admin app. Returns the app, or null if unconfigured. */
async function getApp() {
  if (configured === false) return null
  if (appPromise) return appPromise

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  const hasFileCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  if (!inline && !hasFileCreds) {
    configured = false
    return null
  }

  appPromise = (async () => {
    const { initializeApp, getApps, cert, applicationDefault } = await import('firebase-admin/app')
    if (getApps().length) return getApps()[0]
    const credential = inline ? cert(parseServiceAccount(inline)) : applicationDefault()
    const app = initializeApp({ credential })
    configured = true
    return app
  })()

  try {
    return await appPromise
  } catch (err) {
    // Bad/malformed credentials: log once and degrade to "not configured".
    console.error('[firebaseAdmin] init failed:', err.message)
    appPromise = null
    configured = false
    return null
  }
}

/** Whether the Admin SDK has usable credentials (so the UI can show a hint). */
export async function isConfigured() {
  return Boolean(await getApp())
}

async function authClient() {
  const app = await getApp()
  if (!app) return null
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth(app)
}

/**
 * List up to `max` users (newest first). Returns a flat, UI-friendly shape.
 * Throws only on unexpected SDK errors; returns null when not configured.
 */
export async function listUsers(max = 1000) {
  const auth = await authClient()
  if (!auth) return null
  const out = []
  let pageToken
  do {
    const page = await auth.listUsers(Math.min(1000, max - out.length), pageToken)
    for (const u of page.users) {
      out.push({
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || '',
        photoURL: u.photoURL || '',
        disabled: Boolean(u.disabled),
        emailVerified: Boolean(u.emailVerified),
        providers: (u.providerData || []).map((p) => p.providerId),
        createdAt: u.metadata?.creationTime ? Date.parse(u.metadata.creationTime) : null,
        lastSignInAt: u.metadata?.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null,
      })
    }
    pageToken = page.pageToken
  } while (pageToken && out.length < max)
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return out
}

/** Mint a password-reset link for an email. Returns the link, or null when unconfigured. */
export async function passwordResetLink(email) {
  const auth = await authClient()
  if (!auth) return null
  return auth.generatePasswordResetLink(email)
}

/** Enable or disable a user account. Returns true on success, null when unconfigured. */
export async function setUserDisabled(uid, disabled) {
  const auth = await authClient()
  if (!auth) return null
  await auth.updateUser(uid, { disabled: Boolean(disabled) })
  return true
}
