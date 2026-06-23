/**
 * YouTube-specific routes - the extras beyond the generic /api/:platform/stats.
 * Mounted at /api/youtube.
 *
 *   Analytics API:
 *     GET  /api/youtube/analytics            ?startDate&endDate   (daily time series)
 *     GET  /api/youtube/analytics/demographics
 *     GET  /api/youtube/analytics/traffic
 *     GET  /api/youtube/top-videos           ?max
 *   Data API v3 (posting):
 *     POST /api/youtube/upload               { videoUrl, title, description, tags[], privacyStatus }
 *   Reporting API:
 *     GET  /api/youtube/reporting/report-types
 *     GET  /api/youtube/reporting/jobs
 *     POST /api/youtube/reporting/jobs       { reportTypeId, name }
 *     GET  /api/youtube/reporting/jobs/:jobId/reports
 *     GET  /api/youtube/reporting/download   ?url
 */

import express, { Router } from 'express'
import { youtube } from '../platforms/youtube.js'
import { validAccessToken } from '../tokens.js'

const router = Router()

/** Wrap a handler so "Not connected"/API errors return clean JSON. */
const guard = (fn) => async (req, res) => {
  try {
    const { token } = await validAccessToken(youtube)
    await fn(req, res, token)
  } catch (err) {
    const status = err.status || 502
    console.error('[youtube route]', err.message)
    res.status(status).json({ error: err.message })
  }
}

const range = (req) => ({ startDate: req.query.startDate, endDate: req.query.endDate })

/* ----------------------------- Analytics API ----------------------------- */

router.get('/analytics', guard(async (req, res, token) => {
  res.json(await youtube.getDailyMetrics(token, range(req)))
}))

router.get('/analytics/demographics', guard(async (req, res, token) => {
  res.json(await youtube.getDemographics(token, range(req)))
}))

router.get('/analytics/traffic', guard(async (req, res, token) => {
  res.json(await youtube.getTrafficSources(token, range(req)))
}))

router.get('/top-videos', guard(async (req, res, token) => {
  res.json(await youtube.getTopVideos(token, { max: Number(req.query.max) || 10, ...range(req) }))
}))

/* -------------------------- Data API v3 (comments) ----------------------- */

router.get('/comments', guard(async (req, res, token) => {
  res.json(await youtube.getComments(token, Number(req.query.max) || 20))
}))

router.get('/comments/debug', guard(async (_req, res, token) => {
  res.json(await youtube.commentsDiagnostic(token))
}))

router.post('/comments/:parentId/reply', guard(async (req, res, token) => {
  const text = (req.body?.text || '').toString()
  if (!text.trim()) return res.status(400).json({ error: 'text is required' })
  res.json(await youtube.replyToComment(token, req.params.parentId, text))
}))

/* -------------------------- Data API v3 (posting) ------------------------- */

// A short-lived YouTube access token for the connected account, so the browser
// can run the resumable upload directly against Google (best for large files).
router.get('/upload-token', guard(async (_req, res, token) => {
  res.json({ accessToken: token })
}))

// Returns a resumable upload URL so the browser can PUT the bytes straight to
// Google (avoids serverless request-size limits). The client uploads directly.
router.post('/upload-session', guard(async (req, res, token) => {
  const { title, description, tags, privacyStatus, contentType, contentLength, publishAt } = req.body || {}
  if (!title) return res.status(400).json({ error: 'title is required' })
  if (!contentLength) return res.status(400).json({ error: 'contentLength is required' })
  const uploadUrl = await youtube.createUploadSession(token, {
    title,
    description,
    tags: Array.isArray(tags) ? tags : [],
    privacyStatus: privacyStatus || 'private',
    contentType: contentType || 'video/*',
    contentLength: Number(contentLength),
    publishAt: publishAt || undefined,
  })
  res.json({ uploadUrl })
}))

// Relay one chunk of a resumable upload to Google. The browser sends small
// chunks (< the serverless body limit) and we forward them server-side, which
// avoids both the request-size cap and the cross-origin block on Google's URL.
router.post('/upload-chunk', express.raw({ type: () => true, limit: '8mb' }), async (req, res) => {
  const uploadUrl = req.get('x-upload-url')
  const range = req.get('x-upload-range') // e.g. "bytes 0-3145727/12345678"
  const fileType = req.get('x-file-type') || 'video/*'
  const chunk = req.body
  if (!uploadUrl || !range) return res.status(400).json({ error: 'missing upload headers' })
  if (!Buffer.isBuffer(chunk) || !chunk.length) return res.status(400).json({ error: 'no chunk received' })
  try {
    const r = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': fileType, 'Content-Range': range, 'Content-Length': String(chunk.length) },
      body: chunk,
    })
    if (r.status === 308) return res.json({ done: false }) // resume incomplete - more chunks
    if (r.ok) {
      const data = await r.json().catch(() => ({}))
      return res.json({ done: true, id: data.id, status: data.status })
    }
    const text = await r.text()
    return res.status(502).json({ error: `YouTube upload failed (${r.status}): ${text.slice(0, 200)}` })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

router.post('/upload', guard(async (req, res, token) => {
  const { videoUrl, title, description, tags, privacyStatus, publishAt } = req.body || {}
  if (!videoUrl || !title) {
    return res.status(400).json({ error: 'videoUrl and title are required' })
  }
  // Fetch the source video and upload its bytes (fine for demo-sized files;
  // production would stream/chunk large uploads instead of buffering).
  const src = await fetch(videoUrl)
  if (!src.ok) return res.status(400).json({ error: `Could not fetch videoUrl (${src.status})` })
  const videoBuffer = Buffer.from(await src.arrayBuffer())
  const contentType = src.headers.get('content-type') || 'video/mp4'

  const result = await youtube.uploadVideo(token, {
    videoBuffer,
    contentType,
    title,
    description,
    tags: Array.isArray(tags) ? tags : [],
    privacyStatus: privacyStatus || 'private',
    publishAt: publishAt || undefined,
  })
  res.json({ id: result.id, status: result.status, snippet: result.snippet })
}))

/* ----------------------------- Reporting API ----------------------------- */

router.get('/reporting/report-types', guard(async (_req, res, token) => {
  res.json(await youtube.listReportTypes(token))
}))

router.get('/reporting/jobs', guard(async (_req, res, token) => {
  res.json(await youtube.listReportingJobs(token))
}))

router.post('/reporting/jobs', guard(async (req, res, token) => {
  const { reportTypeId, name } = req.body || {}
  if (!reportTypeId) return res.status(400).json({ error: 'reportTypeId is required' })
  res.json(await youtube.createReportingJob(token, reportTypeId, name))
}))

router.get('/reporting/jobs/:jobId/reports', guard(async (req, res, token) => {
  res.json(await youtube.listJobReports(token, req.params.jobId))
}))

router.get('/reporting/download', guard(async (req, res, token) => {
  if (!req.query.url) return res.status(400).json({ error: 'url is required' })
  const csv = await youtube.downloadReport(token, String(req.query.url))
  res.type('text/csv').send(csv)
}))

export default router
