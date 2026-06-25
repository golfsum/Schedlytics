/**
 * Real Growth Coach computations for live (non-demo) accounts. These derive the
 * Growth Score, Weekly Brief, and coach highlights from data we actually hold
 * (tracked-link clicks/visitors/platform/campaign, YouTube engagement, posting
 * cadence). Honest by design: no fabricated week-over-week deltas.
 */
import { PLATFORMS, type GrowthScore, type WeeklyBrief } from '../data'
import type { ShortLink } from './shortLinks'
import type { YouTubeVideo } from './socialApi'
import type { PlatformId } from '../types'

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/* ------------------------------- growth level ----------------------------- */

export interface GrowthLevel {
  name: string
  min: number
}

export const GROWTH_LEVELS: GrowthLevel[] = [
  { name: 'Growth Scout', min: 0 },
  { name: 'Growth Builder', min: 20 },
  { name: 'Growth Creator', min: 40 },
  { name: 'Growth Influencer', min: 60 },
  { name: 'Growth Expert', min: 75 },
  { name: 'Growth Authority', min: 88 },
  { name: 'Growth Legend', min: 97 },
]

/** Current level for a score and the next one up (null at the top). */
export function levelFor(score: number): { current: GrowthLevel; next: GrowthLevel | null } {
  let current = GROWTH_LEVELS[0]
  let next: GrowthLevel | null = GROWTH_LEVELS[1] || null
  for (let i = 0; i < GROWTH_LEVELS.length; i++) {
    if (score >= GROWTH_LEVELS[i].min) {
      current = GROWTH_LEVELS[i]
      next = GROWTH_LEVELS[i + 1] || null
    }
  }
  return { current, next }
}

/** Key with the highest summed clicks across links (or null). */
export function topByClicks<K extends keyof ShortLink>(links: ShortLink[], key: K): string | null {
  const totals = new Map<string, number>()
  for (const l of links) {
    const k = l[key]
    if (typeof k === 'string' && k) totals.set(k, (totals.get(k) || 0) + (l.clicks || 0))
  }
  let best: string | null = null
  let bestVal = -1
  for (const [k, v] of totals) if (v > bestVal) (bestVal = v), (best = k)
  return best
}

/** Rough 0-100 Growth Score from real signals, or null when there's no activity. */
export function realGrowthScore(
  clicks: number,
  videos: YouTubeVideo[],
  postCount: number,
  links: ShortLink[],
): GrowthScore | null {
  if (clicks === 0 && videos.length === 0 && postCount === 0) return null
  const views = videos.reduce((s, v) => s + (v.views || 0), 0)
  const eng = videos.reduce((s, v) => s + (v.likes || 0) + (v.comments || 0), 0)
  const engRate = views > 0 ? (eng / views) * 100 : 0
  const traffic = clamp(clicks > 0 ? 35 + Math.log10(clicks + 1) * 22 : 8)
  const engagement = clamp(engRate * 12)
  const consistency = clamp(postCount * 12)
  const campaigns = clamp(links.filter((l) => l.campaign).length * 30)
  const score = clamp(traffic * 0.35 + engagement * 0.25 + consistency * 0.2 + campaigns * 0.2)
  return {
    score,
    delta: 0, // no week-over-week history yet
    factors: [
      { label: 'Traffic', value: traffic },
      { label: 'Engagement', value: engagement },
      { label: 'Consistency', value: consistency },
      { label: 'Campaigns', value: campaigns },
    ],
  }
}

/** Real coach highlight bullets from the user's own data. */
export function realHighlights(
  clicks: number,
  visitors: number,
  bestPlatform: PlatformId | null,
  topCampaign: string | null,
  topVideoTitle?: string,
): string[] {
  const out: string[] = []
  if (clicks > 0) out.push(`Your tracked links drove ${compact(clicks)} clicks from ${compact(visitors)} unique visitors.`)
  if (bestPlatform) out.push(`${PLATFORMS[bestPlatform].name} is your top traffic source right now.`)
  if (topCampaign) out.push(`Your "${topCampaign}" campaign has the most clicks of any campaign.`)
  if (topVideoTitle) out.push(`"${topVideoTitle}" is your most-viewed recent upload.`)
  out.push('Add a clear call to action to your captions to lift your click rate.')
  return out
}

/** Real Weekly Brief from the user's own data, or null when there's nothing yet. */
export function realWeeklyBrief(
  clicks: number,
  visitors: number,
  bestPlatform: PlatformId | null,
  topCampaign: string | null,
  videos: YouTubeVideo[],
  links: ShortLink[],
): WeeklyBrief | null {
  if (clicks === 0 && videos.length === 0) return null
  const topVid = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
  const bestContent = topVid?.title || links.find((l) => l.sourcePost)?.sourcePost || 'Not enough data'
  const recommendation = bestPlatform
    ? `Post more on ${PLATFORMS[bestPlatform].name}; it is driving the most of your tracked clicks. Reuse your best link there.`
    : 'Add trackable links to more of your posts so Schedlytics can show what actually drives traffic.'
  return {
    trafficDelta: clicks > 0 ? compact(clicks) : '0',
    bestPlatform: bestPlatform || (topVid ? 'youtube' : 'instagram'),
    bestContent,
    recommendation,
    topPost: topVid?.title || '',
    topPostClicks: clicks,
    bestWeek: clicks >= 100, // honest "momentum", not a week-over-week claim
    highlights: realHighlights(clicks, visitors, bestPlatform, topCampaign, topVid?.title),
  }
}
