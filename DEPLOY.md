# Deploying to Vercel

Two Vercel projects, one per repo, each with a Vercel KV store for persistence.
Vercel's filesystem is read-only, so the apps detect `KV_REST_API_URL` /
`KV_REST_API_TOKEN` and use Vercel KV (Upstash Redis) in production. Locally
they fall back to a JSON file, so `npm run dev` / `npm start` still work with no
setup.

---

## Project 1: Schedlytics (this repo)

This single project serves the **React app**, the **API + OAuth**, the **legal
pages**, and the **short-link redirects** from one deployment. `vercel.json` and
`api/index.js` are already in the repo.

**Import the repo in Vercel, then set:**

| Setting | Value |
|---|---|
| **Root Directory** | **`./` (the repo root, NOT `server`)** |
| Framework Preset | Vite |
| Build Command | `npm run build` (from vercel.json) |
| Output Directory | `dist` |
| Install Command | `npm install` |

> Important: Root Directory must be the repo root. The backend ships as the
> `api/index.js` serverless function at the root, so do NOT set the root to
> `server/`. If a build logs "added 71 packages" and "vite: command not found",
> the Root Directory is wrong (it built `server/`). Fix it under
> Settings > General > Root Directory.

`vercel.json` deploys the Express backend as one function (`api/index.js`).
The URL map on your domain:

| Path | Serves |
|---|---|
| `/` | the React app (from `dist`) |
| `/welcome` | the marketing landing page |
| `/privacy`, `/terms`, `/data-deletion` | legal pages |
| `/api/*`, `/auth/*`, `/s/*` | backend (function) |

The marketing/legal pages and their assets (`/styles.css`, `/site-media/*`) are
served by the function; the app and its hashed `/assets/*` bundles come from
`dist`. The marketing "Open App" button links to `/`.

**Add a Vercel KV store** (Storage tab, Create > KV). Vercel injects
`KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

**Environment Variables:**

```
BASE_URL=https://your-schedlytics-domain        # your production domain
# (do NOT set VITE_API_URL — the app calls same-origin /api in production)

# platform credentials (same values you tested locally)
YOUTUBE_CLIENT_ID= / YOUTUBE_CLIENT_SECRET=
TIKTOK_CLIENT_KEY= / TIKTOK_CLIENT_SECRET=
META_APP_ID= / META_APP_SECRET=
PINTEREST_APP_ID= / PINTEREST_APP_SECRET=
TWITCH_CLIENT_ID= / TWITCH_CLIENT_SECRET=
PATREON_CLIENT_ID= / PATREON_CLIENT_SECRET=

# short links via ashrt.link (Project 2)
ASHRT_API_URL=https://ashrt.link
ASHRT_API_KEY=the-same-key-you-set-in-ashrt.link
```

**Update each platform's OAuth redirect URI** to your production domain:

```
https://your-schedlytics-domain/auth/youtube/callback
https://your-schedlytics-domain/auth/tiktok/callback
https://your-schedlytics-domain/auth/instagram/callback
https://your-schedlytics-domain/auth/facebook/callback
https://your-schedlytics-domain/auth/pinterest/callback
https://your-schedlytics-domain/auth/twitch/callback
https://your-schedlytics-domain/auth/patreon/callback
```

---

## Project 2: ashrt.link (the ashrt.link repo)

Import `C:\Users\ND\Documents\GitHub\ashrt.link` as its own Vercel project.

| Setting | Value |
|---|---|
| Framework Preset | Other |
| Build Command | (leave empty) |
| Output Directory | (leave empty) |

`vercel.json` runs the whole app as one function and serves the dashboard.

**Add a Vercel KV store** (so links persist). **Environment Variables:**

```
BASE_URL=https://ashrt.link
API_KEY=a-long-random-string        # the same value goes in Schedlytics ASHRT_API_KEY
```

**Domains:** point the `ashrt.link` domain at this project. Short links then read
as `https://ashrt.link/abc123`.

---

## Order of operations

1. Deploy **ashrt.link**, add its KV, set `API_KEY` + `BASE_URL`, attach the domain.
2. Deploy **Schedlytics**, add its KV, set `BASE_URL`, the platform creds, and
   `ASHRT_API_URL` + `ASHRT_API_KEY` (matching ashrt.link's key).
3. Update the OAuth redirect URIs at each provider to the Schedlytics domain.
4. Open the app, go to Settings > Connected Accounts, and connect each platform.

## Notes

- Re-run `node server/check-credentials.mjs` anytime to confirm credentials.
- The file-based stores are only for local dev. In production everything lives in
  Vercel KV, so it persists across serverless invocations and deploys.
- Vercel serverless functions are stateless; the OAuth CSRF `state` is stored in
  KV with a 10-minute TTL, so logins work across invocations.
