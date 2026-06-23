/*
 *  Per-user settings sync. Stores one JSON blob per Firebase UID so a user's
 *  profile, plan, calendar, planners, and preferences follow them across
 *  devices. Requires FIREBASE_PROJECT_ID to be set; otherwise returns 501 and
 *  the client just keeps using local storage.
 */
import express from 'express'
import { hashStore } from '../kv.js'
import { verifyIdToken } from '../lib/firebaseAuth.js'

const router = express.Router()
const settings = hashStore('schedlytics:settings', 'settings.json')
// Accept either the server-style name or the VITE_-prefixed one the frontend
// already uses (Vercel exposes both to the function at runtime).
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID

// Reject anything over ~1 MB to keep one user's blob sane.
const MAX_BYTES = 1_000_000

async function requireUser(req, res, next) {
  if (!PROJECT_ID) return res.status(501).json({ error: 'Settings sync is not configured' })
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '')
  if (!m) return res.status(401).json({ error: 'missing bearer token' })
  try {
    req.auth = await verifyIdToken(m[1], PROJECT_ID)
    next()
  } catch (err) {
    res.status(401).json({ error: `auth failed: ${err.message}` })
  }
}

router.get('/', requireUser, async (req, res) => {
  const blob = await settings.get(req.auth.uid)
  res.json({ settings: blob || null })
})

router.put('/', requireUser, async (req, res) => {
  const data = req.body?.settings
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'settings must be an object' })
  }
  if (JSON.stringify(data).length > MAX_BYTES) {
    return res.status(413).json({ error: 'settings too large' })
  }
  await settings.put(req.auth.uid, { ...data, _updatedAt: Date.now() })
  res.json({ ok: true })
})

export default router
