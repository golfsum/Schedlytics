/**
 * YouTube-specific routes — the extras beyond the generic /api/:platform/stats.
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

import { Router } from 'express'
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

/* -------------------------- Data API v3 (posting) ------------------------- */

router.post('/upload', guard(async (req, res, token) => {
  const { videoUrl, title, description, tags, privacyStatus } = req.body || {}
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
