/*
 *  AI suggestion route - real Claude-backed titles, captions, and hashtags.
 *
 *  Two modes:
 *    POST /api/ai          { kind, topic }            -> text-only suggestions
 *    POST /api/ai/analyze  { frames[], platform, topic } -> VISION: Claude looks
 *        at sampled video frames and returns video-specific title/description/
 *        hashtags so the result is about THIS video, not a generic template.
 *
 *  Enabled only when ANTHROPIC_API_KEY is set. The client falls back to its
 *  built-in offline generator whenever this is missing or errors.
 */
import express from 'express'

const router = express.Router()

const API_KEY = process.env.ANTHROPIC_API_KEY
// Valid, non-date-suffixed model ids. Haiku 4.5 supports vision and is a good
// cheap/fast default; set ANTHROPIC_MODEL to a stronger model for better copy.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const PROMPTS = {
  title: (t) =>
    `Generate 5 punchy, high click-through social video titles about: "${t}". Keep each under 70 characters, specific and concrete (no generic "how I got 100k views" filler). Return ONLY a JSON array of strings, no commentary.`,
  caption: (t) =>
    `Write 3 engaging social media captions about: "${t}". Each should have a hook and a call to action, and may use a tasteful emoji. Return ONLY a JSON array of strings, no commentary.`,
  tags: (t) =>
    `Generate 12 relevant, trending hashtags for a social post about: "${t}". Return ONLY a JSON array of strings, each starting with #, no commentary.`,
}

/** Call the Anthropic Messages API and return the first text block. */
async function callClaude({ model, system, content, maxTokens = 600 }) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content }],
    }),
  })
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(`Anthropic ${r.status}: ${detail.slice(0, 200)}`)
  }
  const data = await r.json()
  return data?.content?.[0]?.text || ''
}

/** Lets the client decide whether to call this route or use its offline generator. */
router.get('/status', (_req, res) =>
  res.json({ enabled: Boolean(API_KEY), model: MODEL, vision: Boolean(API_KEY) }),
)

/* ----------------------------- text suggestions --------------------------- */

router.post('/', async (req, res) => {
  if (!API_KEY) return res.status(501).json({ error: 'AI is not configured on the server' })

  const kind = req.body?.kind
  const topic = String(req.body?.topic || '').trim() || 'my content'
  if (!PROMPTS[kind]) return res.status(400).json({ error: 'kind must be title, caption, or tags' })

  try {
    const text = await callClaude({ model: MODEL, content: PROMPTS[kind](topic), maxTokens: 500 })
    const items = parseStringArray(text)
    // Attach a descending "trend" score so the UI can rank/badge them.
    const suggestions = items.map((s, i) => ({ text: s, trend: Math.max(60, 96 - i * 4) }))
    res.json({ suggestions })
  } catch (err) {
    console.error('[ai]', err.message)
    res.status(502).json({ error: err.message })
  }
})

/* ----------------------- vision: analyze video frames --------------------- */

const ANALYZE_SYSTEM =
  'You are an expert social media growth strategist and copywriter. You write specific, ' +
  'concrete, high click-through metadata grounded in what is actually shown in the video. ' +
  'Avoid generic clickbait like "how I got 100k views". Always respond with ONLY valid JSON.'

router.post('/analyze', async (req, res) => {
  if (!API_KEY) return res.status(501).json({ error: 'AI is not configured on the server' })

  const frames = Array.isArray(req.body?.frames) ? req.body.frames.slice(0, 4) : []
  const platform = String(req.body?.platform || 'social').slice(0, 30)
  const topic = String(req.body?.topic || '').trim()
  if (!frames.length) return res.status(400).json({ error: 'frames are required' })

  // Turn each data URL into an Anthropic image content block.
  const images = []
  for (const f of frames) {
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(String(f))
    if (m) images.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
  }
  if (!images.length) return res.status(400).json({ error: 'frames must be base64 image data URLs' })

  const instruction =
    `These are ${images.length} frames sampled across a ${platform} video` +
    (topic ? ` the creator describes as: "${topic}".` : '.') +
    ` Watch them and infer what the video is actually about. Then produce metadata optimized to ` +
    `maximize click-through and watch time on ${platform}.\n\n` +
    `Return ONLY this JSON object (no markdown, no commentary):\n` +
    `{"titles": [5 distinct titles, each under 70 characters],` +
    ` "description": "2 to 4 sentences with a strong hook and a clear call to action, at least 150 characters",` +
    ` "hashtags": [10 relevant hashtags, each starting with #]}`

  try {
    const content = [...images, { type: 'text', text: instruction }]
    const text = await callClaude({ model: MODEL, system: ANALYZE_SYSTEM, content, maxTokens: 900 })
    const obj = parseJsonObject(text)
    if (!obj) throw new Error('could not parse model response')
    res.json({
      titles: toStringArray(obj.titles).slice(0, 5),
      description: typeof obj.description === 'string' ? obj.description : '',
      hashtags: toStringArray(obj.hashtags)
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .slice(0, 12),
      model: MODEL,
    })
  } catch (err) {
    console.error('[ai/analyze]', err.message)
    res.status(502).json({ error: err.message })
  }
})

/* --------------------------------- parsing -------------------------------- */

const toStringArray = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [])

/** Pull a JSON array of strings out of a model response, tolerating stray prose. */
function parseStringArray(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1))
    return toStringArray(arr)
  } catch {
    return []
  }
}

/** Pull a JSON object out of a model response, tolerating code fences / prose. */
function parseJsonObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

export default router
