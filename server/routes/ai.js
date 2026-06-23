/*
 *  AI suggestion route - real Claude-backed titles, captions, and hashtags.
 *
 *  Enabled only when ANTHROPIC_API_KEY is set. The client falls back to its
 *  built-in offline generator whenever this is missing or errors, so the app
 *  works with or without a key.
 */
import express from 'express'

const router = express.Router()

const API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

const PROMPTS = {
  title: (t) =>
    `Generate 5 punchy, high click-through social video titles about: "${t}". Keep each under 70 characters. Return ONLY a JSON array of strings, no commentary.`,
  caption: (t) =>
    `Write 3 engaging social media captions about: "${t}". Each should have a hook and a call to action, and may use a tasteful emoji. Return ONLY a JSON array of strings, no commentary.`,
  tags: (t) =>
    `Generate 12 relevant, trending hashtags for a social post about: "${t}". Return ONLY a JSON array of strings, each starting with #, no commentary.`,
}

/** Lets the client decide whether to call this route or use its offline generator. */
router.get('/status', (_req, res) => res.json({ enabled: Boolean(API_KEY) }))

router.post('/', async (req, res) => {
  if (!API_KEY) return res.status(501).json({ error: 'AI is not configured on the server' })

  const kind = req.body?.kind
  const topic = String(req.body?.topic || '').trim() || 'my content'
  if (!PROMPTS[kind]) return res.status(400).json({ error: 'kind must be title, caption, or tags' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: PROMPTS[kind](topic) }],
      }),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      throw new Error(`Anthropic ${r.status}: ${detail.slice(0, 200)}`)
    }
    const data = await r.json()
    const text = data?.content?.[0]?.text || '[]'
    const items = parseStringArray(text)
    // Attach a descending "trend" score so the UI can rank/badge them.
    const suggestions = items.map((s, i) => ({ text: s, trend: Math.max(60, 96 - i * 4) }))
    res.json({ suggestions })
  } catch (err) {
    console.error('[ai]', err.message)
    res.status(502).json({ error: err.message })
  }
})

/** Pull a JSON array of strings out of a model response, tolerating stray prose. */
function parseStringArray(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : []
  } catch {
    return []
  }
}

export default router
