import { createContext, useContext, type ReactNode } from 'react'
import { useSeededState } from '../lib/usePersisted'
import { CAMPAIGNS, type Campaign } from '../data'
import type { PlatformId } from '../types'

interface CampaignsContextValue {
  campaigns: Campaign[]
  addCampaign: (c: Campaign) => void
  setCampaigns: (updater: Campaign[] | ((prev: Campaign[]) => Campaign[])) => void
}

const CampaignsContext = createContext<CampaignsContextValue | null>(null)

/**
 * Shared campaign store. Demo mode seeds rich sample campaigns; real accounts
 * start empty and persist. Used by the Campaigns page, the dashboard Campaign
 * Performance section, and onboarding.
 */
export function CampaignsProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useSeededState<Campaign[]>('sl_campaigns', CAMPAIGNS, [])
  const addCampaign = (c: Campaign) => setCampaigns((prev) => [c, ...prev])
  return (
    <CampaignsContext.Provider value={{ campaigns, addCampaign, setCampaigns }}>
      {children}
    </CampaignsContext.Provider>
  )
}

export function useCampaigns() {
  const ctx = useContext(CampaignsContext)
  if (!ctx) throw new Error('useCampaigns must be used within a CampaignsProvider')
  return ctx
}

/** Build a fresh campaign (empty metrics) from minimal onboarding inputs. */
export function buildCampaign(input: {
  name: string
  goalType: string
  goalValue?: number
  range?: string
  bestPlatform?: PlatformId
}): Campaign {
  const slug =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `campaign-${Math.abs(hashStr(input.name))}`
  return {
    id: slug,
    name: input.name.trim(),
    status: 'Active',
    range: input.range || 'Ongoing',
    posts: 0,
    clicks: 0,
    visitors: 0,
    revenue: '$0',
    ctr: '0%',
    bestPlatform: input.bestPlatform || 'youtube',
    insight: '',
    goalClicks: input.goalType === 'Clicks' && input.goalValue ? input.goalValue : undefined,
    postRows: [],
    linkRows: [],
  }
}

// Small stable hash so a slugless name still gets a deterministic id.
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
