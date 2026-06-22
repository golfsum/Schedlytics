# Schedlytics — Social API Backend

OAuth login + live stats for **YouTube, TikTok, Instagram, Facebook, and Pinterest**.
Each platform is an isolated module under [`platforms/`](platforms) so it can be
reviewed or handed off independently (e.g. submitting `platforms/youtube.js` for
Google's API audit / quota-extension request).

```
server/
├── index.js              # Express app: OAuth start/callback + stats routes
├── config.js             # env-driven config (no hard-coded secrets)
├── store.js              # token storage (JSON file — swap for a DB in prod)
└── platforms/
    ├── index.js          # registry
    ├── youtube.js        # Google OAuth 2.0 + YouTube Data API v3
    ├── tiktok.js         # Login Kit v2 + Display API
    ├── _meta.js          # shared Facebook Login helper (IG + FB)
    ├── instagram.js      # Instagram Graph API (insights)
    ├── facebook.js       # Pages API (insights)
    ├── pinterest.js      # Pinterest API v5
    ├── twitch.js         # Twitch OAuth + Helix API
    └── patreon.js        # Patreon OAuth + API v2
```

## Each module exposes the same interface

```js
platform.getAuthUrl(state)              // → consent URL (login)
platform.exchangeCode(code)             // → { accessToken, refreshToken, expiresAt, ... }
platform.refresh(refreshToken, record)  // → fresh tokens
platform.getStats(accessToken, record)  // → normalized stats (the data)
```

Normalized stats shape returned to the frontend:

```js
{
  platform: 'youtube',
  handle: '@alexcreates',
  name: 'Alex Creates',
  avatar: 'https://…',
  followers: 41200,
  metrics: [ { label: 'subscribers', value: 41200 }, { label: 'views', value: 1820000 }, … ],
  raw: { /* original API payload */ }
}
```

## Run it

```bash
cd server
cp .env.example .env       # then fill in credentials
npm install
npm run dev                # http://localhost:8787
```

Smoke test without any credentials:

```bash
curl http://localhost:8787/health            # { "ok": true }
curl http://localhost:8787/api/accounts      # all platforms "connected": false
curl http://localhost:8787/api/config        # which platforms have creds set
```

## HTTP API

| Method | Route | Purpose |
|---|---|---|
| GET | `/auth/:platform/start` | Redirects to the provider's login/consent page |
| GET | `/auth/:platform/callback` | Exchanges code → tokens, redirects to the app with `?connected=` |
| GET | `/api/accounts` | Connection status + cached profile for all platforms |
| GET | `/api/:platform/stats` | Live stats (auto-refreshes the token) |
| POST | `/api/:platform/disconnect` | Removes stored tokens |
| POST | `/api/data-deletion` | Deletes all stored data; returns a confirmation code |
| GET | `/`, `/privacy`, `/terms`, `/data-deletion` | Serves the marketing + legal site from `/site` |

The legal pages give you real URLs for the platform app reviews, e.g.
`{BASE_URL}/privacy` and `{BASE_URL}/data-deletion` (Meta/TikTok/Pinterest all
require a Privacy Policy URL and a Data Deletion URL).

### YouTube — all three APIs

`platforms/youtube.js` leverages every YouTube API:

| API | Used for | Routes |
|---|---|---|
| **Data API v3** | channel/video stats + **uploads (posting)** | `GET /api/youtube/stats`, `POST /api/youtube/upload` |
| **Analytics API** | time-series & dimensional metrics (dashboard) | `GET /api/youtube/analytics`, `/analytics/demographics`, `/analytics/traffic`, `/top-videos` |
| **Reporting API** | bulk async CSV reports | `GET /api/youtube/reporting/report-types`, `/reporting/jobs`, `POST /reporting/jobs`, `GET /reporting/jobs/:id/reports`, `/reporting/download?url=` |

```bash
# daily time series (last 28 days by default)
curl "http://localhost:8787/api/youtube/analytics?startDate=2026-05-01&endDate=2026-05-28"

# publish a video (server fetches the URL and resumable-uploads it)
curl -X POST http://localhost:8787/api/youtube/upload \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://.../clip.mp4","title":"My Reel","privacyStatus":"unlisted"}'
```

Requires enabling **all three** APIs in Google Cloud and these scopes:
`youtube.readonly`, `youtube.upload` (audit), `youtube`, `yt-analytics.readonly`.

## Per-platform setup

| Platform | Console | Redirect URI | Read scopes |
|---|---|---|---|
| YouTube | console.cloud.google.com (enable *YouTube Data API v3*) | `/auth/youtube/callback` | `youtube.readonly` |
| TikTok | developers.tiktok.com (*Login Kit* + *Display API*) | `/auth/tiktok/callback` | `user.info.basic`, `user.info.stats`, `video.list` |
| Instagram | developers.facebook.com (*Instagram Graph API*) | `/auth/instagram/callback` | `instagram_basic`, `instagram_manage_insights`, `pages_show_list` |
| Facebook | developers.facebook.com (*Facebook Login*) | `/auth/facebook/callback` | `pages_show_list`, `pages_read_engagement`, `read_insights` |
| Pinterest | developers.pinterest.com (*API v5*) | `/auth/pinterest/callback` | `user_accounts:read`, `pins:read`, `boards:read` |
| Twitch | dev.twitch.tv/console/apps (*Helix*) | `/auth/twitch/callback` | `user:read:email`, `moderator:read:followers` |
| Patreon | patreon.com/portal (*API v2*) | `/auth/patreon/callback` | `identity`, `campaigns` |

### Notes & gotchas
- **Instagram** stats require a **Professional** (Business/Creator) IG account linked to a Facebook Page.
- **Facebook** posting/insights target **Pages**, not personal profiles.
- **YouTube** uploads (not needed for stats) cost ~1,600 quota units each — that's the quota-extension request. `prompt=consent` + `access_type=offline` ensure a refresh token.
- **TikTok** and most Meta scopes require **App Review** before non-test users can connect.
- All five start limited (sandbox/dev/trial) and need review for production access.

## Going from stats → publishing later
Add the write scope to a module's `SCOPES` array and a `publish()` method:
YouTube `youtube.upload`, TikTok `video.publish`, Instagram `instagram_content_publish`,
Facebook `pages_manage_posts`, Pinterest `pins:write`.
