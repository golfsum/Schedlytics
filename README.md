# Schedlytics

**Schedule. Analyze. Grow.** — a sleek, dark-mode scheduling & analytics dashboard for influencers and marketers, built with **React 18 + TypeScript + Tailwind CSS**.

![Calendar view](https://img.shields.io/badge/theme-dark%20navy%20%2B%20cyan-22D3EE)

## Features

- **Sidebar navigation** — Dashboard, Calendar, Analytics, Link Tools, Inbox, Settings
- **Content Calendar** — weekly grid with **drag-and-drop** post blocks (Instagram, Reels, Facebook…), tabs for Visual Grid / Stories / Reels Planner
- **New Post studio** (slide-in panel) — platform selector with checkmarks, content-type dropdown, media upload preview, caption, geotag / shopping-tag / alt-text toggles, scheduling, and a "Schedule Post" CTA that drops the post onto the calendar
- **Media Studio & Analytics** — image upload, multi-variant captions with A/B testing, **Cross-Platform Sync** cards (impressions / clicks / revenue + sync toggles), a **Correlation Matrix** heatmap, an **Engagement Trend** area chart, and a **Conversion by Platform** bar chart (all hand-built SVG — no chart library)
- **Link & Engagement Tools** — link-in-bio builder mock + a working URL shortener with copy-to-clipboard

## Stack

- React 18 + TypeScript
- Tailwind CSS 3 (custom navy/cyan brand theme in `tailwind.config.js`)
- [lucide-react](https://lucide.dev) icons
- Vite

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Project structure

```
src/
  App.tsx                  # layout shell + routing between views
  data.tsx                 # platforms, nav items, dummy datasets
  types.ts                 # shared TypeScript types
  components/
    Sidebar.tsx            # left nav rail + brand + upgrade card
    Topbar.tsx             # search, notifications, user menu
    Logo.tsx               # Schedlytics calendar+bolt mark
    CalendarView.tsx       # weekly grid (DnD) + Link & Engagement Tools
    PostBlock.tsx          # draggable platform chip
    NewPostPanel.tsx       # right-hand "New Post" studio
    AnalyticsView.tsx      # 3-column Media Studio / Sync / Correlation
    charts.tsx             # SVG correlation matrix, line + bar charts
    Toggle.tsx             # reusable cyan switch
    Placeholder.tsx        # friendly stub for secondary routes
```

All data is dummy/static and lives in `src/data.tsx` — swap it for a real API when ready.

## Real social connections (optional backend)

The app runs standalone with a **simulated** connect flow. To connect real
accounts and pull **live stats** from YouTube, TikTok, Instagram, Facebook, and
Pinterest, run the backend in [`server/`](server) — one OAuth+stats module per
platform (see [server/README.md](server/README.md)).

```bash
# 1) start the backend
cd server && cp .env.example .env   # fill in your platform credentials
npm install && npm run dev          # http://localhost:8787

# 2) point the frontend at it
cd .. && cp .env.example .env       # sets VITE_API_URL=http://localhost:8787
npm run dev
```

When `VITE_API_URL` is set, the "Connect" buttons trigger real OAuth and the
profile/stats come from the live APIs. When it's unset, the built-in demo
simulation is used — no backend required.

The frontend integration points are tiny:
[`src/lib/socialApi.ts`](src/lib/socialApi.ts) (the client) and the `connect()` /
`refresh()` logic in [`src/components/Connections.tsx`](src/components/Connections.tsx).
