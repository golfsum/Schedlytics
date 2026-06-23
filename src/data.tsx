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
  Calendar,
  Clapperboard,
  BarChart3,
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

/* -------------------------------------------------------------------------- */
/*  Sidebar navigation                                                         */
/* -------------------------------------------------------------------------- */

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', Icon: Calendar },
  { id: 'media-studio', label: 'Media Studio', Icon: Clapperboard },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'link-tools', label: 'Link Tools', Icon: Link2 },
  { id: 'inbox', label: 'Inbox', Icon: MessageSquare },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

/* -------------------------------------------------------------------------- */
/*  Calendar — weekly schedule                                                  */
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
/*  Analytics — Cross-Platform Sync                                             */
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
/*  Analytics — chart datasets                                                  */
/* -------------------------------------------------------------------------- */

/** Correlation matrix — Post Frequency (rows) vs Revenue cohorts (cols). */
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
