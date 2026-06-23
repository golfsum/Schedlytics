/**
 * AI suggestion engine for titles, captions, and hashtags.
 *
 * This is a simulated generator that produces plausible, trend-styled options
 * from a topic. It's intentionally behind small async functions so you can swap
 * the bodies for a real LLM call (e.g. POST /api/ai/titles backed by the Claude
 * API) without touching the UI.
 */

export interface Suggestion {
  text: string
  /** 0-100 "trend potential" score used to rank and badge options. */
  trend: number
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)
const trendScore = () => 62 + Math.floor(Math.random() * 38) // 62-99
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function topicOf(input: string) {
  return cap((input || '').trim() || 'your content')
}

/* --------------------------------- titles -------------------------------- */

function makeTitles(input: string): Suggestion[] {
  const t = topicOf(input)
  const n = () => rand(['3', '5', '7', '10'])
  const options = [
    `${t} Hacks You Need in 2026`,
    `I Tried Viral ${t} (Honest Results)`,
    `${n()} ${t} Ideas That Actually Work`,
    `The ${t} Trend Everyone Is Talking About`,
    `Stop Scrolling: ${t} Edition`,
    `${t}: Beginner to Pro in One Video`,
    `Why Your ${t} Is Not Working (and the Fix)`,
    `This ${t} Tip Changed Everything`,
    `${t} Glow Up ✨`,
    `Watch This Before You Try ${t}`,
  ]
  return shuffle(options)
    .slice(0, 5)
    .map((text) => ({ text, trend: trendScore() }))
    .sort((a, b) => b.trend - a.trend)
}

/* -------------------------------- captions ------------------------------- */

function makeCaptions(input: string): Suggestion[] {
  const t = (input || '').trim() || 'this'
  const hooks = [
    'POV:',
    'Here is your sign to try',
    'Nobody talks about this, but',
    'Save this for later 📌',
    'Wait for the end 👀',
  ]
  const bodies = [
    `${cap(t)} done the way that actually keeps people watching.`,
    `the ${t} routine that took me from zero to viral.`,
    `everything I wish I knew about ${t} sooner.`,
    `the ${t} mistake almost everyone makes.`,
  ]
  const ctas = [
    'Drop a 🔥 if you agree.',
    'Follow for more.',
    'Which one is your favorite?',
    'Tag someone who needs this.',
    'Comment your thoughts below 👇',
  ]
  return Array.from({ length: 3 }, () => ({
    text: `${rand(hooks)} ${rand(bodies)} ${rand(ctas)}`,
    trend: trendScore(),
  })).sort((a, b) => b.trend - a.trend)
}

/* -------------------------------- hashtags ------------------------------- */

function makeHashtags(input: string): Suggestion[] {
  const words = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  const topical = words.map((w) => `#${w}`)
  const combo = words.length > 1 ? [`#${words.join('')}`] : []
  const trending = [
    '#fyp',
    '#viral',
    '#trending',
    '#reels',
    '#explore',
    '#foryou',
    '#contentcreator',
    '#creatortips',
    '#viralvideo',
    '#growyouraccount',
    '#2026',
    '#tutorial',
  ]
  const all = [...combo, ...topical, ...shuffle(trending)]
  const seen = new Set<string>()
  return all
    .filter((h) => {
      const k = h.toLowerCase()
      if (h === '#' || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 14)
    .map((text) => ({ text, trend: trendScore() }))
    .sort((a, b) => b.trend - a.trend)
}

/* ---------------------------- public (async) ----------------------------- */
/* Swap the bodies for real API calls; the UI awaits these.                  */

export async function aiTitles(topic: string): Promise<Suggestion[]> {
  await delay(650)
  return makeTitles(topic)
}
export async function aiCaptions(topic: string): Promise<Suggestion[]> {
  await delay(650)
  return makeCaptions(topic)
}
export async function aiHashtags(topic: string): Promise<Suggestion[]> {
  await delay(500)
  return makeHashtags(topic)
}
