import {
  Instagram,
  Facebook,
  Film,
  Music2,
  ShoppingBag,
  Youtube,
  Twitch,
  HandCoins,
  LayoutDashboard,
  Megaphone,
  Calendar,
  Clapperboard,
  Lightbulb,
  Link2,
  MessageSquare,
  Settings,
} from 'lucide-react'
import type {
  Platform,
  PlatformId,
  NavItem,
  CalendarPost,
  ChannelStat,
} from './types'

/* -------------------------------------------------------------------------- */
/*  Platforms                                                                   */
/* -------------------------------------------------------------------------- */

export const PLATFORMS: Record<PlatformId, Platform> = {
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    gradient: 'from-fuchsia-500 via-pink-500 to-orange-400',
    color: '#E1306C',
    Icon: Instagram,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    gradient: 'from-blue-600 to-blue-500',
    color: '#1877F2',
    Icon: Facebook,
  },
  reels: {
    id: 'reels',
    name: 'Reels',
    gradient: 'from-pink-500 via-rose-500 to-purple-600',
    color: '#C13584',
    Icon: Film,
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    gradient: 'from-slate-900 to-slate-700',
    color: '#25F4EE',
    Icon: Music2,
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    gradient: 'from-red-600 to-rose-600',
    color: '#E60023',
    Icon: ShoppingBag,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    gradient: 'from-red-600 to-red-500',
    color: '#FF0000',
    Icon: Youtube,
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    gradient: 'from-purple-600 to-violet-500',
    color: '#9146FF',
    Icon: Twitch,
  },
  patreon: {
    id: 'patreon',
    name: 'Patreon',
    gradient: 'from-rose-500 to-red-500',
    color: '#FF424D',
    Icon: HandCoins,
  },
}

export const PLATFORM_LIST = Object.values(PLATFORMS)

/**
 * Platforms that are not live yet (e.g. pending Meta app review). They show a
 * "Coming soon" state and are locked everywhere they can be selected.
 */
export const COMING_SOON: PlatformId[] = ['instagram', 'facebook']
export const isComingSoon = (id: PlatformId) => COMING_SOON.includes(id)

/* -------------------------------------------------------------------------- */
/*  Sidebar navigation                                                         */
/* -------------------------------------------------------------------------- */

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaigns', Icon: Megaphone },
  { id: 'calendar', label: 'Content Calendar', Icon: Calendar },
  { id: 'links', label: 'Links', Icon: Link2 },
  { id: 'insights', label: 'Insights', Icon: Lightbulb },
  { id: 'media-studio', label: 'Media Studio', Icon: Clapperboard },
  { id: 'inbox', label: 'Inbox', Icon: MessageSquare },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

/* -------------------------------------------------------------------------- */
/*  Calendar - weekly schedule                                                  */
/* -------------------------------------------------------------------------- */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const TIME_SLOTS = [
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '1:00',
  '2:00',
]

export const INITIAL_POSTS: CalendarPost[] = [
  { id: 'p1', platform: 'instagram', label: 'Summer drop', day: 4, slot: 0, span: 1 },
  { id: 'p2', platform: 'instagram', label: 'Behind the scenes', day: 1, slot: 1, span: 1 },
  { id: 'p3', platform: 'reels', label: 'Styling reel', day: 2, slot: 2, span: 1 },
  { id: 'p4', platform: 'facebook', label: 'Community Q&A', day: 3, slot: 2, span: 1 },
  { id: 'p5', platform: 'facebook', label: 'Link share', day: 1, slot: 3, span: 1 },
  { id: 'p6', platform: 'reels', label: 'Trending audio', day: 4, slot: 3, span: 1 },
  { id: 'p7', platform: 'instagram', label: 'Carousel tips', day: 0, slot: 4, span: 1 },
]

/* -------------------------------------------------------------------------- */
/*  Analytics - Cross-Platform Sync                                             */
/* -------------------------------------------------------------------------- */

export const CHANNEL_STATS: ChannelStat[] = [
  { platform: 'instagram', impressions: '1.2M', clicks: '14k', revenue: '$1.8k', synced: true },
  { platform: 'youtube', impressions: '1.6M', clicks: '32k', revenue: '$3.4k', synced: true },
  { platform: 'tiktok', impressions: '0.9M', clicks: '21k', revenue: '$2.1k', synced: true },
  { platform: 'facebook', impressions: '0.9M', clicks: '21k', revenue: '$2.1k', synced: false },
  { platform: 'pinterest', impressions: '1.2M', clicks: '11k', revenue: '$0.9k', synced: false },
  { platform: 'twitch', impressions: '0.4M', clicks: '8k', revenue: '$1.2k', synced: false },
  { platform: 'patreon', impressions: '12k', clicks: '3k', revenue: '$4.6k', synced: false },
]

/* -------------------------------------------------------------------------- */
/*  Analytics - chart datasets                                                  */
/* -------------------------------------------------------------------------- */

/** Correlation matrix - Post Frequency (rows) vs Revenue cohorts (cols). */
export const CORRELATION_ROWS = ['1', '2', '4', '6', '1-24']
export const CORRELATION_COLS = ['1', '4', '8', '12', '26']
export const CORRELATION_MATRIX: number[][] = [
  [1.0, 0.75, 0.24, 0.47, 0.39],
  [0.27, 1.0, 0.38, 0.67, 0.75],
  [0.11, 0.27, 1.0, 0.36, 0.63],
  [0.19, 0.15, 0.29, 0.44, 0.51],
  [0.18, 0.28, 0.11, 0.38, 0.78],
]

/** Engagement trend (Oct 20 → Oct 26). */
export const ENGAGEMENT_TREND = [28, 22, 41, 35, 52, 47, 68]
export const ENGAGEMENT_LABELS = ['Oct 20', '', '', '', 'Oct 25', '', 'Oct 26']

/** Conversion by platform. */
export const CONVERSION_BARS: { label: string; value: number; color: string }[] = [
  { label: 'IG', value: 72, color: '#E1306C' },
  { label: 'YT', value: 64, color: '#FF0000' },
  { label: 'TikTok', value: 58, color: '#25F4EE' },
  { label: 'FB', value: 44, color: '#1877F2' },
  { label: 'Twitch', value: 38, color: '#9146FF' },
]

/* -------------------------------------------------------------------------- */
/*  Growth / attribution - sample data (demo mode only)                         */
/* -------------------------------------------------------------------------- */

/** Campaigns a post or link can be grouped under (sample options in demo). */
export const SAMPLE_CAMPAIGNS = [
  'Summer Sale',
  'Digital Planner Launch',
  'Black Friday',
  'Newsletter Growth',
]

export interface GrowthMetric {
  key: string
  label: string
  value: string
  /** Secondary line: a +/-% trend, or a descriptive subtitle. */
  delta: string
  /** true = green up, false = red down, undefined = neutral subtitle. */
  up?: boolean
}

/** Top dashboard metric cards (Growth Dashboard, demo mode). */
export const GROWTH_METRICS: GrowthMetric[] = [
  { key: 'clicks', label: 'Total Clicks', value: '18,420', delta: '+12.4% this week', up: true },
  { key: 'visitors', label: 'Unique Visitors', value: '11,240', delta: '+8.1% this week', up: true },
  { key: 'ctr', label: 'Conversion Rate', value: '4.7%', delta: '+0.6% this week', up: true },
  { key: 'campaign', label: 'Top Campaign', value: 'Summer Sale', delta: '$4.2k attributed' },
  { key: 'revenue', label: 'Revenue Tracked', value: '$9,840', delta: '+18% this week', up: true },
]

export interface TopPost {
  title: string
  platform: PlatformId
  views: number
  clicks: number
  ctr: string
  revenue: string
}

/** Top performing posts table (Growth Dashboard, demo mode). */
export const TOP_POSTS: TopPost[] = [
  { title: 'Summer drop carousel', platform: 'instagram', views: 48200, clicks: 3120, ctr: '6.5%', revenue: '$2,140' },
  { title: 'Planner launch trailer', platform: 'youtube', views: 31900, clicks: 2280, ctr: '7.1%', revenue: '$1,860' },
  { title: 'Styling reel', platform: 'reels', views: 62400, clicks: 1740, ctr: '2.8%', revenue: '$640' },
  { title: 'Behind the scenes', platform: 'tiktok', views: 54100, clicks: 1290, ctr: '2.4%', revenue: '$410' },
  { title: 'Pin board refresh', platform: 'pinterest', views: 18700, clicks: 1510, ctr: '8.1%', revenue: '$980' },
]

export interface PlatformPerf {
  platform: PlatformId
  views: string
  clicks: string
  ctr: string
  revenue: string
}

/** Best platforms breakdown (Growth Dashboard, demo mode). */
export const PLATFORM_PERFORMANCE: PlatformPerf[] = [
  { platform: 'instagram', views: '212K', clicks: '8,940', ctr: '4.2%', revenue: '$4,210' },
  { platform: 'tiktok', views: '186K', clicks: '2,610', ctr: '1.4%', revenue: '$720' },
  { platform: 'youtube', views: '141K', clicks: '4,120', ctr: '2.9%', revenue: '$2,980' },
  { platform: 'facebook', views: '63K', clicks: '1,540', ctr: '2.4%', revenue: '$910' },
  { platform: 'pinterest', views: '47K', clicks: '1,210', ctr: '2.6%', revenue: '$1,020' },
]

/** Headline insight callout shown on the Growth Dashboard (demo mode). */
export const DASHBOARD_INSIGHT =
  'Instagram is driving 4.8x more clicks than TikTok this week. Consider posting more product-focused content there.'

export interface Finding {
  title: string
  /** The headline answer, e.g. "YouTube". */
  value: string
  /** The quantified detail, e.g. "67% of tracked traffic". */
  detail: string
  /** The action to take next (what makes a finding useful, not just true). */
  action?: string
  tone?: 'good' | 'warn'
}
export interface GrowthInsights {
  findings: Finding[]
  /** The single biggest, most actionable opportunity this week. */
  opportunity: Finding
  recommendedActions: string[]
}

export type CampaignStatus = 'Active' | 'Scheduled' | 'Ended'

export interface CampaignPostRow {
  title: string
  platform: PlatformId
  date: string
  views: number
  clicks: number
  ctr: string
  revenue: string
}

export interface CampaignLinkRow {
  short: string
  destination: string
  clicks: number
  visitors: number
  source: string
  created: string
}

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  range: string
  posts: number
  clicks: number
  visitors: number
  revenue: string
  ctr: string
  bestPlatform: PlatformId
  insight: string
  /** Click goal for forecasting (optional). */
  goalClicks?: number
  /** Rough fraction of the campaign window elapsed, for projection. */
  elapsed?: number
  /** Target date label, e.g. "July 1". */
  goalDate?: string
  postRows: CampaignPostRow[]
  linkRows: CampaignLinkRow[]
}

/** Campaigns with full attribution detail (demo mode). */
export const CAMPAIGNS: Campaign[] = [
  {
    id: 'summer-sale',
    name: 'Summer Sale',
    status: 'Active',
    range: 'June 1 - June 30',
    posts: 8,
    clicks: 6240,
    visitors: 4810,
    revenue: '$4,210',
    ctr: '5.2%',
    bestPlatform: 'instagram',
    insight:
      'Carousel posts are producing the highest click rate in this campaign. Reels have more views but lower traffic.',
    goalClicks: 8000,
    elapsed: 0.78,
    goalDate: 'Jun 30',
    postRows: [
      { title: 'Summer drop carousel', platform: 'instagram', date: 'Jun 3', views: 48200, clicks: 3120, ctr: '6.5%', revenue: '$2,140' },
      { title: 'Styling reel', platform: 'reels', date: 'Jun 9', views: 62400, clicks: 1740, ctr: '2.8%', revenue: '$640' },
      { title: 'Sale reminder story', platform: 'instagram', date: 'Jun 21', views: 21800, clicks: 1380, ctr: '6.3%', revenue: '$1,430' },
    ],
    linkRows: [
      { short: 'ashrt.link/sumr26', destination: 'yourstore.com/summer-sale', clicks: 3120, visitors: 2410, source: 'Summer drop carousel', created: 'Jun 3' },
      { short: 'ashrt.link/sumr-rl', destination: 'yourstore.com/summer-sale', clicks: 1740, visitors: 1290, source: 'Styling reel', created: 'Jun 9' },
    ],
  },
  {
    id: 'planner-launch',
    name: 'Digital Planner Launch',
    status: 'Active',
    range: 'June 10 - July 10',
    posts: 6,
    clicks: 4120,
    visitors: 3180,
    revenue: '$3,860',
    ctr: '6.1%',
    bestPlatform: 'youtube',
    insight:
      'YouTube descriptions are driving the most qualified clicks. Add the link higher in the description for the next upload.',
    goalClicks: 5000,
    elapsed: 0.6,
    goalDate: 'Jul 10',
    postRows: [
      { title: 'Planner launch trailer', platform: 'youtube', date: 'Jun 11', views: 31900, clicks: 2280, ctr: '7.1%', revenue: '$1,860' },
      { title: 'Planner walkthrough', platform: 'youtube', date: 'Jun 18', views: 18400, clicks: 1210, ctr: '6.6%', revenue: '$1,320' },
      { title: 'Planner teaser pin', platform: 'pinterest', date: 'Jun 24', views: 12600, clicks: 630, ctr: '5.0%', revenue: '$680' },
    ],
    linkRows: [
      { short: 'ashrt.link/planner', destination: 'yourstore.com/planner', clicks: 2280, visitors: 1740, source: 'Planner launch trailer', created: 'Jun 11' },
      { short: 'ashrt.link/plan-wk', destination: 'yourstore.com/planner', clicks: 1210, visitors: 980, source: 'Planner walkthrough', created: 'Jun 18' },
    ],
  },
  {
    id: 'black-friday',
    name: 'Black Friday',
    status: 'Scheduled',
    range: 'Nov 24 - Nov 30',
    posts: 0,
    clicks: 0,
    visitors: 0,
    revenue: '$0',
    ctr: '-',
    bestPlatform: 'instagram',
    insight: 'This campaign has not started yet. Schedule posts and trackable links to start measuring.',
    goalClicks: 10000,
    elapsed: 0,
    goalDate: 'Nov 30',
    postRows: [],
    linkRows: [],
  },
  {
    id: 'newsletter-growth',
    name: 'Newsletter Growth',
    status: 'Active',
    range: 'May 1 - ongoing',
    posts: 11,
    clicks: 2980,
    visitors: 2540,
    revenue: '$1,120',
    ctr: '3.8%',
    bestPlatform: 'pinterest',
    insight:
      'Pinterest is the top driver of newsletter signups. Repurpose your best pins into a weekly series.',
    goalClicks: 5000,
    elapsed: 0.7,
    goalDate: 'this month',
    postRows: [
      { title: 'Pin board refresh', platform: 'pinterest', date: 'May 12', views: 18700, clicks: 1510, ctr: '8.1%', revenue: '$520' },
      { title: 'Free guide announcement', platform: 'instagram', date: 'May 20', views: 24100, clicks: 980, ctr: '4.1%', revenue: '$340' },
      { title: 'Subscriber shoutout', platform: 'facebook', date: 'Jun 2', views: 9800, clicks: 490, ctr: '5.0%', revenue: '$260' },
    ],
    linkRows: [
      { short: 'ashrt.link/newco', destination: 'yoursite.com/newsletter', clicks: 1510, visitors: 1280, source: 'Pin board refresh', created: 'May 12' },
      { short: 'ashrt.link/free-gd', destination: 'yoursite.com/guide', clicks: 980, visitors: 870, source: 'Free guide announcement', created: 'May 20' },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  Growth Coach - score, weekly brief, narrative (demo mode)                   */
/* -------------------------------------------------------------------------- */

export interface GrowthFactor {
  label: string
  value: number
}
export interface GrowthScore {
  score: number
  delta: number
  factors: GrowthFactor[]
}

/** Headline Growth Score shown on the dashboard (demo mode). */
export const GROWTH_SCORE: GrowthScore = {
  score: 82,
  delta: 7,
  factors: [
    { label: 'Traffic', value: 88 },
    { label: 'Engagement', value: 79 },
    { label: 'Consistency', value: 72 },
    { label: 'Campaigns', value: 90 },
  ],
}

export interface WeeklyBrief {
  trafficDelta: string
  bestPlatform: PlatformId
  bestContent: string
  recommendation: string
  topPost: string
  topPostClicks: number
  /** Triggers the celebration banner when the week was strong. */
  bestWeek: boolean
  /** AI coach narrative bullets for the Insights page. */
  highlights: string[]
}

/** Cross-platform timing patterns surfaced by the correlation engine (demo). */
export const CORRELATION_INSIGHTS: string[] = [
  'Instagram traffic spikes about 6 hours after you publish a YouTube video.',
  'Viewers who watch your YouTube uploads tend to click your Instagram profile within 24 hours.',
  'Your link traffic peaks roughly 3 hours after you post a Short.',
]

export type OpportunityTier = 'Highest Impact' | 'Easy Win' | 'Missing Data'
export interface Opportunity {
  tier: OpportunityTier
  label: string
  potential: number
  /** Where the action button should take the user. */
  nav?: 'links' | 'campaigns' | 'calendar' | 'settings'
}

/** Growth Opportunities roadmap (demo mode), highest-impact first. */
export const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  { tier: 'Highest Impact', label: 'Add trackable links to Instagram', potential: 22, nav: 'links' },
  { tier: 'Highest Impact', label: 'Add UTM tags to your top links', potential: 16, nav: 'links' },
  { tier: 'Easy Win', label: 'Create your first campaign', potential: 15, nav: 'campaigns' },
  { tier: 'Easy Win', label: 'Schedule 3 posts for next week', potential: 12, nav: 'calendar' },
  { tier: 'Missing Data', label: 'Connect Facebook', potential: 8, nav: 'settings' },
  { tier: 'Missing Data', label: 'Connect Pinterest', potential: 6, nav: 'settings' },
]

/** The Monday "Weekly Growth Brief" (demo mode). */
export const WEEKLY_BRIEF: WeeklyBrief = {
  trafficDelta: '+14%',
  bestPlatform: 'instagram',
  bestContent: 'Carousel',
  recommendation: 'Create 2 more carousel posts this week, and post them Tuesday between 9 and 11 AM.',
  topPost: 'Summer Sale carousel',
  topPostClicks: 412,
  bestWeek: true,
  highlights: [
    'Instagram generated 63% of your tracked traffic last week.',
    'Carousel posts averaged 2.4x more clicks than reels.',
    'Your best posting time was Tuesday between 9 and 11 AM.',
    'Reuse your Summer Sale campaign, it produced the highest click rate.',
  ],
}

/** Insight-first summary on the Insights page (demo mode). */
export const INSIGHTS: GrowthInsights = {
  findings: [
    {
      title: 'Best Platform',
      value: 'YouTube',
      detail: '67% of tracked traffic',
      action: 'Put your primary link higher in every description.',
      tone: 'good',
    },
    {
      title: 'Best Content Type',
      value: 'Tutorial videos',
      detail: '2.3x more clicks than your average post',
      action: 'Plan two more tutorials this week.',
      tone: 'good',
    },
    {
      title: 'Best Time',
      value: 'Tue, 9-11 AM',
      detail: 'Your highest click-through window',
      action: 'Schedule your next post into this window.',
      tone: 'good',
    },
  ],
  opportunity: {
    title: 'Biggest Opportunity',
    value: 'Add links to your TikTok captions',
    detail: 'Potential +32 clicks per week',
    action: 'Add a trackable link to your next 3 TikToks.',
    tone: 'warn',
  },
  recommendedActions: [
    'Create 2 more tutorial videos this week',
    "Reuse your top link in tomorrow's newsletter",
    'Add a trackable link to your TikTok captions',
    'Turn your best post into a campaign',
  ],
}
