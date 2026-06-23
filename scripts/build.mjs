import { execSync } from 'node:child_process'
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Production build for the single-domain layout:
 *   /            -> marketing + legal site (site/)
 *   /app         -> the React app (Vite build, base /app/)
 *   /site-media  -> marketing images
 * The API runs as the api/index.js serverless function (/api, /auth, /s).
 *
 * Output goes to out/, which Vercel serves statically.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'out')

console.log('› vite build (base /app/)')
execSync('npx vite build', { cwd: root, stdio: 'inherit', shell: true })

console.log('› assembling out/')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// Marketing + legal pages at the root.
cpSync(join(root, 'site'), out, { recursive: true })

// Marketing images are referenced as /site-media/* — move them there and drop
// the original /assets copy so it cannot clash with the app's /app/assets.
rmSync(join(out, 'assets'), { recursive: true, force: true })
if (existsSync(join(root, 'site', 'assets'))) {
  cpSync(join(root, 'site', 'assets'), join(out, 'site-media'), { recursive: true })
}

// The React app under /app.
cpSync(join(root, 'dist'), join(out, 'app'), { recursive: true })

console.log('✓ out/ ready  (marketing at /, app at /app)')
