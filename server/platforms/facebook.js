/**
 * ============================================================================
 *  Facebook integration  —  Facebook Login + Pages API (Graph API)
 * ============================================================================
 *
 *  Posting/insights target Facebook *Pages* (personal-profile publishing was
 *  deprecated). After login we pick the first Page the user manages and read
 *  its follower count and insights.
 *
 *  Scopes (read-only — login + stats):
 *    - pages_show_list          (list the user's Pages)
 *    - pages_read_engagement    (read Page content/engagement)
 *    - read_insights            (Page insights metrics)
 *  (Add pages_manage_posts later for publishing.)
 *
 *  OAuth plumbing is shared — see _meta.js.
 * ============================================================================
 */

import { GRAPH, buildAuthUrl, exchangeForLongLivedToken, getManagedPages } from './_meta.js'

const SCOPES = ['pages_show_list', 'pages_read_engagement', 'read_insights']

export const facebook = {
  id: 'facebook',
  name: 'Facebook',

  getAuthUrl(state) {
    return buildAuthUrl('facebook', SCOPES, state)
  },

  async exchangeCode(code) {
    const tokens = await exchangeForLongLivedToken('facebook', code)
    // Resolve a Page + its long-lived Page token now and cache it on the record.
    const pages = await getManagedPages(tokens.accessToken)
    const page = pages[0]
    if (!page) throw new Error('No Facebook Page found — the user must manage at least one Page')
    return {
      ...tokens,
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
    }
  },

  // Long-lived Page tokens effectively don't expire; nothing to refresh.
  async refresh(_refreshToken, existing) {
    return existing
  },

  /** Read Page follower count + recent insights. */
  async getStats(_accessToken, record) {
    const pageId = record.pageId
    const pageToken = record.pageAccessToken

    const profileRes = await fetch(
      `${GRAPH}/${pageId}?fields=name,fan_count,followers_count,picture{url}&access_token=${pageToken}`,
    )
    if (!profileRes.ok) throw new Error(`Facebook page read failed: ${await profileRes.text()}`)
    const page = await profileRes.json()

    // Insights (last 7 days). Some metrics need a published Page with activity.
    let impressions = 0
    let engagements = 0
    try {
      const insRes = await fetch(
        `${GRAPH}/${pageId}/insights?metric=page_impressions,page_post_engagements&period=week&access_token=${pageToken}`,
      )
      if (insRes.ok) {
        const ins = (await insRes.json()).data || []
        impressions = latestValue(ins.find((m) => m.name === 'page_impressions'))
        engagements = latestValue(ins.find((m) => m.name === 'page_post_engagements'))
      }
    } catch {
      /* insights are best-effort */
    }

    const followers = Number(page.followers_count || page.fan_count || 0)
    return {
      platform: 'facebook',
      handle: page.name,
      name: page.name,
      avatar: page.picture?.data?.url,
      followers,
      metrics: [
        { label: 'followers', value: followers },
        { label: 'impressions (7d)', value: impressions },
        { label: 'engagements (7d)', value: engagements },
      ],
      raw: page,
    }
  },
}

function latestValue(metric) {
  const values = metric?.values
  if (!values?.length) return 0
  return Number(values[values.length - 1].value || 0)
}
