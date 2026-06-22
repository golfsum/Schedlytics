/**
 * Capture real screenshots + a drag-and-drop GIF of the Schedlytics app and
 * write them into site/assets so the landing page can show the product working.
 *
 * Run:  npm run build   (in the project root, first)
 *       cd capture && npm install && npx playwright install chromium
 *       npm run capture
 */
import http from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'site', 'assets')
const PORT = 4599

/* ----------------------------- tiny static server ----------------------- */

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

function serveDist() {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0])
      if (p === '/') p = '/index.html'
      let file = join(DIST, p)
      let data
      try {
        data = await readFile(file)
      } catch {
        file = join(DIST, 'index.html') // SPA fallback
        data = await readFile(file)
      }
      res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream')
      res.end(data)
    } catch {
      res.statusCode = 500
      res.end('error')
    }
  })
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)))
}

/* --------------------------------- helpers ------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Encode an array of equal-size PNG buffers into an animated GIF. */
function encodeGif(frames, delays) {
  const enc = GIFEncoder()
  frames.forEach((buf, i) => {
    const png = PNG.sync.read(buf)
    const data = new Uint8Array(png.data)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    enc.writeFrame(index, png.width, png.height, { palette, delay: delays[i] ?? 600 })
  })
  enc.finish()
  return Buffer.from(enc.bytes())
}

/* ----------------------------------- main -------------------------------- */

const server = await serveDist()
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 820 },
  deviceScaleFactor: 1,
})

const base = `http://localhost:${PORT}/`
await page.goto(base, { waitUntil: 'networkidle' })
await sleep(1200) // let remote images (avatars, unsplash) settle

const nav = (name) => page.locator('aside nav button', { hasText: name })

/* ---- 1) full-screen screenshots of each view ---- */

await nav('Calendar').click()
await sleep(500)
await page.screenshot({ path: join(OUT, 'calendar.png') })

await nav('Analytics').click()
await sleep(700)
await page.screenshot({ path: join(OUT, 'analytics.png') })

await nav('Dashboard').click()
await sleep(700)
await page.screenshot({ path: join(OUT, 'dashboard.png') })

/* ---- 2) drag-and-drop GIF on the calendar (panel closed = clean view) ---- */

await nav('Calendar').click()
await sleep(500)

// Clip region = the calendar card (first .card on the page).
const card = page.locator('.card').first()
const boxRaw = await card.boundingBox()
const clip = {
  x: Math.round(boxRaw.x),
  y: Math.round(boxRaw.y),
  width: Math.round(boxRaw.width),
  height: Math.round(boxRaw.height),
}
const shot = () => page.screenshot({ clip })

const SRC = '[title*="Summer drop"]' // post p1, Friday 9:00
const frames = []
const delays = []
const push = async (delay) => {
  frames.push(await shot())
  delays.push(delay)
}

// initial
await push(700)

// start dragging the source block
await page.evaluate(() => {
  window.__dt = new DataTransfer()
})
await page.evaluate((sel) => {
  document
    .querySelector(sel)
    .dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: window.__dt }))
}, SRC)
await sleep(150)
await push(550)

// move the highlight across a few cells, capturing each
for (const cell of ['3-1', '1-2', '0-3']) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: window.__dt }))
    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt }))
  }, `[data-cell="${cell}"]`)
  await sleep(150)
  await push(550)
}

// drop on the final cell (Monday, 12:00)
await page.evaluate((sel) => {
  const el = document.querySelector(sel)
  el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__dt }))
}, '[data-cell="0-3"]')
await page.evaluate((sel) => {
  document
    .querySelector(sel)
    ?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt }))
}, SRC)
await sleep(250)
await push(1500) // hold on the result

const gif = encodeGif(frames, delays)
await writeFile(join(OUT, 'drag.gif'), gif)

/* ---- 3) New Post panel screenshot (last, so it does not affect the drag) ---- */

await page.locator('main button', { hasText: 'Create New Post' }).click()
await sleep(700)
await page.screenshot({ path: join(OUT, 'newpost.png') })

console.log(`Wrote ${frames.length}-frame GIF (${(gif.length / 1024).toFixed(0)} KB) + 4 screenshots to site/assets`)

await browser.close()
server.close()
