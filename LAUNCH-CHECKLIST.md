# Schedlytics Pre-Early-Access Verification Checklist

Work top to bottom. Section 0 (config) gates everything else — if an env var is
missing, the related feature silently falls back or fails. Items marked
**[verified live]** were already confirmed on www.schedlytics.com.

Test on **https://www.schedlytics.com** (the deployed app), not the local demo.
Use a real browser, signed out, in a normal window unless a step says otherwise.

---

## 0. Config prerequisites (Vercel env + provider consoles)

These must be set in Vercel → Project → Settings → Environment Variables (then
redeploy). Use `https://www.schedlytics.com/auth/config` to confirm `BASE_URL`.

- [ ] `BASE_URL = https://www.schedlytics.com` (no trailing slash)
- [ ] `ANTHROPIC_API_KEY` set (and optionally `ANTHROPIC_MODEL`, e.g. `claude-sonnet-4-6`)
- [ ] `FIREBASE_SERVICE_ACCOUNT` set (server-only — NOT `VITE_` prefixed)
- [ ] `FIREBASE_PROJECT_ID` set (enables settings sync + conversions + admin)
- [ ] `VITE_FIREBASE_*` client keys set, `VITE_FIREBASE_AUTH_DOMAIN = www.schedlytics.com`
- [ ] `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` set
- [ ] `ADMIN_EMAILS` includes your email
- [ ] SMTP vars set (so emails actually send)
- [ ] `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV / Upstash) set
- [ ] Platform OAuth creds set: `YOUTUBE_CLIENT_ID/SECRET`, Pinterest, Twitch, Patreon
- [ ] `SAFE_BROWSING_API_KEY` (optional — link malware/phishing blocking)
- [ ] Each platform's redirect URI registered: `https://www.schedlytics.com/auth/<platform>/callback`
- [ ] Google OAuth: your test account added under OAuth consent screen → Test users

Quick check: `https://www.schedlytics.com/auth/config` shows the right `baseUrl`,
and `https://www.schedlytics.com/api/ai/status` shows `{"enabled":true,...}`.

---

## 1. Sign-up & sign-in

- [ ] **Google sign-in** completes (popup → select account → lands in app). *[regression-prone: was broken by security headers, since fixed]*
- [ ] **Create account** page: subtitle reads "Start tracking what your content is actually worth."
- [ ] Email field + password rules tick green as you type (8 chars, uppercase, number, special)
- [ ] Strength meter updates (Very weak → Very strong)
- [ ] Show/hide (eye) toggles work on both password and re-type fields
- [ ] "Passwords match" / "Passwords do not match" updates live
- [ ] Terms & Privacy line shows and links open `/terms` and `/privacy`
- [ ] "No credit card required" + Early Access line show; nothing wraps to a lone word
- [ ] **Create account** button stays disabled until email valid + rules pass + passwords match
- [ ] Account is created and lands in the app
- [ ] **Forgot password?** sends a reset email; success copy is neutral ("If an account exists…")
- [ ] Sign out returns to the marketing site

---

## 2. Onboarding

- [ ] First login on a new account auto-opens the setup wizard (once)
- [ ] "Skip this step" advances; "Skip for now" closes it
- [ ] After skipping, the wizard does NOT reopen on the next login
- [ ] After skipping, the dashboard is clean (no setup card)
- [ ] Settings → **Getting started** tab shows the checklist + "Open guided setup"
- [ ] Completing setup shows "You're all set" with "Redo guided setup"

---

## 3. Data isolation (the original multi-tenant bug)

- [ ] Sign in as account A, connect a platform / create a link
- [ ] Sign out, sign in as account B → B sees **none** of A's connected platforms, videos, or links
- [ ] Each account only sees its own campaigns, links, scheduled posts, billing, conversions

---

## 4. Platform connections (OAuth)

- [ ] Connect **YouTube** (Google "unverified app" → Advanced → continue is expected in Testing mode)
- [ ] Connect **Pinterest**, **Twitch**, **Patreon**
- [ ] Connected account shows handle/avatar; stats/recent videos load
- [ ] Disconnect, then reconnect, works
- [ ] **TikTok** clearly labeled sandbox/private (not implied as public publishing)
- [ ] **Instagram/Facebook** shown as "Coming soon" / awaiting approval

---

## 5. Media Studio + AI

- [ ] AI badge reads **"AI ready"** (or "AI offline (samples)" if no key)
- [ ] Upload a video → cover-frame thumbnails appear automatically (no second upload)
- [ ] Video preview card shows duration, resolution, size, Replace, Remove
- [ ] Pick a content category, then **Generate everything from video** → titles/description/hashtags describe THIS video (not generic "how I got 100k views")
- [ ] Rewrite chips (Better / Shorter / More clicks / SEO) change the title
- [ ] Campaign selector + Destination URL auto-creates a tracked link
- [ ] "Best time" chip sets a schedule; Publishing Score + checklist update as you fill fields
- [ ] Upload a **>250 MB** video → "Large video detected" warning appears
- [ ] **Publish to YouTube** actually creates the video (check your channel)
- [ ] A failed publish keeps your title/description and shows up in Admin → Errors

---

## 6. Tracked links & conversions

- [ ] Create a tracked link (Links page) → it appears in the list, scoped to you
- [ ] Open the short link in another browser → redirects to the destination
- [ ] Click count + unique visitor increment on the dashboard
- [ ] Dashboard totals match per-link stats
- [ ] **Known limitation:** conversions only record with a valid click id; with ashrt.link not forwarding the click id, prod conversions may stay empty (flagged separately)

---

## 7. Billing & paywall (use Stripe test mode first)

- [ ] **Free → Creator** checkout → returns with confetti, plan shows active
- [ ] **Free → Business** checkout works
- [ ] **Switch** Creator ↔ Business via the billing portal (no double-charge)
- [ ] Cancel checkout → "Checkout canceled. No changes were made." toast
- [ ] If activation lags → "Payment received. Your plan is being activated…" then flips to active
- [ ] Trigger a failed payment (`stripe trigger invoice.payment_failed`) → **Payment issue** banner with Manage Billing
- [ ] Cancel subscription → keeps access until period end (not instantly downgraded)
- [ ] As a non-Business user, Settings → Branded Domain shows the upgrade prompt with a clear reason

---

## 8. Feedback

- [ ] **Feedback** button visible on every app page (floating, bottom-right)
- [ ] Submit each type (Bug / Feature / Confusing / General) → success toast
- [ ] Admin → Support shows the feedback, tagged by type, with page/device context
- [ ] Optional email + "include page and device info" toggle work

---

## 9. PWA install

- [ ] Desktop Chrome/Edge: **Install** button (next to the bell) triggers the native install
- [ ] Install banner appears after the 2nd visit; "Not now" / dismiss stops it returning
- [ ] iOS Safari: install button / banner shows Add-to-Home-Screen steps
- [ ] Settings → Connected Accounts → **Install App** card shows correct status
- [ ] Installed app opens standalone (no browser chrome); install button hides

---

## 10. Admin (sign in with an `ADMIN_EMAILS` account)

- [ ] Admin page is reachable; non-admins cannot see it
- [ ] **Users** tab: badges show (Free / Founder / Paid / Admin); plan + admin correct
- [ ] Toggle **Founder** on a user → amber Founder badge appears
- [ ] **Activity** tab streams events (signup, connect, link, publish, upgrade, support, feedback, critical error)
- [ ] **Errors** tab: critical errors show a red chip + device; ack works; no email spam
- [ ] **Support** tab: tickets + feedback listed; reply / resolve works
- [ ] Overview / Traffic / Status / Early Access tabs load

---

## 11. Security  *(headers [verified live])*

- [ ] **[verified live]** Security headers present on `/`, `/app/`, `/api/*` (CSP, HSTS, X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy)
- [ ] Rate limiting: rapidly submit support/feedback → eventually `429` (5 support / 10 min)
- [ ] Creating a link with a `javascript:` URL is rejected
- [ ] (If `SAFE_BROWSING_API_KEY` set) a known-bad test URL is blocked
- [ ] Run **Mozilla Observatory** on the domain → headers score well
- [ ] (Optional) OWASP ZAP baseline scan against the deploy

---

## 12. Marketing & legal pages

- [ ] `/contact` loads, matches the dark design, Support + Early Access emails, platform status, policy links
- [ ] Contact is linked in the homepage footer
- [ ] `/privacy`, `/terms`, `/data-deletion`, `/guides` all load
- [ ] `/sitemap.xml` and `/robots.txt` load (Search Console can fetch the sitemap)

---

## 13. Mobile (phone or DevTools device mode)

- [ ] Demo-data banner stacks; buttons full-width; no horizontal scroll
- [ ] Sidebar / nav drawer works
- [ ] Create-account card fits; Media Studio, dashboard usable
- [ ] Feedback + Install buttons reachable above the safe area

---

## 14. Email delivery (with SMTP configured)

- [ ] Password reset email arrives
- [ ] Support ticket + feedback notify the admin inbox
- [ ] New-error / error-spike alert email arrives (and is throttled, not spammy)
- [ ] Weekly brief cron sends (Monday) with per-user numbers

---

## 15. Cross-device sync

- [ ] Sign in on browser A and browser B (same account)
- [ ] Change a setting / create a campaign on A → reload B → it appears
- [ ] Connected accounts show on both
- [ ] Onboarding completion does not re-trigger on the second device
- [ ] **Note:** simultaneous edits to the same setting are last-write-wins (not real-time)

---

## End-to-end smoke (do this once, start to finish)

1. [ ] Marketing site → Open App → Create account (email)
2. [ ] Log out → reset password → log back in
3. [ ] Complete (or skip) onboarding
4. [ ] Connect YouTube
5. [ ] Create a campaign + tracked link
6. [ ] Upload a short video → Generate everything → Publish/schedule
7. [ ] Click the tracked link from another device → confirm the click on the dashboard
8. [ ] Upgrade to Creator (Stripe test) → confirm paywall unlocks → cancel
9. [ ] Submit a support ticket + feedback
10. [ ] In Admin: confirm the ticket, feedback, activity, and any errors all show
11. [ ] No broken screens, numbers make sense, errors are understandable
