/**
 * ============================================================================
 *  Instagram integration - Instagram Graph API (via Facebook Login)
 * ============================================================================
 *
 *  Reading Instagram insights requires a **Professional** (Business or Creator)
 *  Instagram account that is linked to a Facebook Page. The flow:
 *    1. User logs in with Facebook (shared _meta.js helper)
 *    2. Find the user's Page → the Page's linked instagram_business_account
 *    3. Read that IG account's followers + insights
 *
 *  Scopes (login + stats + publishing):
 *    - instagram_basic
 *    - instagram_manage_insights
 *    - instagram_content_publish   (publish photos/videos)
 *    - pages_show_list
 *    - pages_read_engagement
 *
 *  Publishing note: the IG Content Publishing API works from a PUBLIC media URL
 *  (it fetches the file itself); you cannot upload raw bytes. So posts need a
 *  hosted image/video URL.
 *
 *  OAuth plumbing is shared - see _meta.js.
 * ============================================================================
 */

import { GRAPH, buildAuthUrl, exchangeForLongLivedToken, getManagedPages } from './_meta.js'

const SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
]

export const instagram = {
  id: 'instagram',
  name: 'Instagram',

  getAuthUrl(state) {
    return buildAuthUrl('instagram', SCOPES, state)
  },

  async exchangeCode(code) {
    const tokens = await exchangeForLongLivedToken('instagram', code)

    // Resolve the IG Business Account id via the user's first Page.
    const pages = await getManagedPages(tokens.accessToken)
    let igUserId = null
    let pageToken = null
    for (const page of pages) {
      const res = await fetch(
        `${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
      )
      if (!res.ok) continue
      const linked = (await res.json()).instagram_business_account
      if (linked?.id) {
        igUserId = linked.id
        pageToken = page.access_token
        break
      }
    }
    if (!igUserId) {
      throw new Error(
        'No Instagram Business account found. Link a Professional IG account to a Facebook Page.',
      )
    }
    return { ...tokens, igUserId, pageAccessToken: pageToken }
  },

  async refresh(_refreshToken, existing) {
    return existing
  },

  /** Read IG profile stats + reach/impressions insights. */
  async getStats(_accessToken, record) {
    const igId = record.igUserId
    const token = record.pageAccessToken

    const profileRes = await fetch(
      `${GRAPH}/${igId}?fields=username,followers_count,media_count,profile_picture_url&access_token=${token}`,
    )
    if (!profileRes.ok) throw new Error(`Instagram profile read failed: ${await profileRes.text()}`)
    const profile = await profileRes.json()

    let reach = 0
    let impressions = 0
    try {
      const insRes = await fetch(
        `${GRAPH}/${igId}/insights?metric=reach,impressions&period=week&access_token=${token}`,
      )
      if (insRes.ok) {
        const ins = (await insRes.json()).data || []
        reach = latestValue(ins.find((m) => m.name === 'reach'))
        impressions = latestValue(ins.find((m) => m.name === 'impressions'))
      }
    } catch {
      /* insights are best-effort */
    }

    return {
      platform: 'instagram',
      handle: `@${profile.username}`,
      name: profile.username,
      avatar: profile.profile_picture_url,
      followers: Number(profile.followers_count || 0),
      metrics: [
        { label: 'followers', value: Number(profile.followers_count || 0) },
        { label: 'posts', value: Number(profile.media_count || 0) },
        { label: 'reach (7d)', value: reach },
        { label: 'impressions (7d)', value: impressions },
      ],
      raw: profile,
    }
  },

  /**
   * Publish a photo or Reel from a PUBLIC media URL.
   * Flow: create a media container -> (video: wait for processing) -> publish.
   */
  async publish(_accessToken, record, { mediaUrl, imageUrl, videoUrl, caption } = {}) {
    const igId = record?.igUserId
    const token = record?.pageAccessToken
    if (!igId || !token) throw new Error('No Instagram Business account connected')

    const url = mediaUrl || videoUrl || imageUrl
    if (!url) throw new Error('Instagram needs a public image or video URL')
    const isVideo = Boolean(videoUrl) || /\.(mp4|mov|m4v)(\?|$)/i.test(url)

    // 1. Create the media container.
    const create = new URLSearchParams({ access_token: token })
    if (caption?.trim()) create.set('caption', caption.trim())
    if (isVideo) {
      create.set('media_type', 'REELS')
      create.set('video_url', url)
    } else {
      create.set('image_url', url)
    }
    const createRes = await fetch(`${GRAPH}/${igId}/media`, { method: 'POST', body: create })
    if (!createRes.ok) throw new Error(`Instagram container failed: ${(await createRes.text()).slice(0, 220)}`)
    const creationId = (await createRes.json()).id

    // 2. Video containers need processing time before they can be published.
    if (isVideo) {
      let ready = false
      for (let i = 0; i < 15 && !ready; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        const st = await fetch(`${GRAPH}/${creationId}?fields=status_code&access_token=${token}`)
        const code = st.ok ? (await st.json()).status_code : null
        if (code === 'FINISHED') ready = true
        else if (code === 'ERROR') throw new Error('Instagram could not process the video')
      }
      if (!ready) throw new Error('Instagram video still processing - try again shortly')
    }

    // 3. Publish the container.
    const pubRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    })
    if (!pubRes.ok) throw new Error(`Instagram publish failed: ${(await pubRes.text()).slice(0, 220)}`)
    const data = await pubRes.json()
    return { id: data.id, url: `https://www.instagram.com/` }
  },
}

function latestValue(metric) {
  const values = metric?.values
  if (!values?.length) return 0
  return Number(values[values.length - 1].value || 0)
}
