// Vercel serverless entry for Schedlytics. The whole Express backend runs as
// one function; vercel.json routes requests here. It serves the API, the OAuth
// callbacks, the legal pages, the short-link redirects, and the built SPA.
import app from '../server/index.js'

export default app
