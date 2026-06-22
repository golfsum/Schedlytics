import type { LucideIcon } from 'lucide-react'

export type PlatformId =
  | 'instagram'
  | 'facebook'
  | 'reels'
  | 'tiktok'
  | 'pinterest'
  | 'youtube'

export interface Platform {
  id: PlatformId
  name: string
  /** Tailwind gradient classes used for chips / blocks */
  gradient: string
  /** Solid accent (hex) for charts and dots */
  color: string
  Icon: LucideIcon
}

export type NavId =
  | 'dashboard'
  | 'calendar'
  | 'analytics'
  | 'link-tools'
  | 'inbox'
  | 'settings'

export interface NavItem {
  id: NavId
  label: string
  Icon: LucideIcon
  badge?: number
}

/** A scheduled block rendered on the weekly calendar grid. */
export interface CalendarPost {
  id: string
  platform: PlatformId
  label: string
  /** 0 = Monday … 4 = Friday */
  day: number
  /** Row index in the time grid (0-based) */
  slot: number
  /** How many slots tall the block is */
  span: number
}

/** A row in the Cross-Platform Sync panel. */
export interface ChannelStat {
  platform: PlatformId
  impressions: string
  clicks: string
  revenue: string
  synced: boolean
}
