# Google OAuth Verification — Demo Video Script (Schedlytics / YouTube)

This is the screen-recording script for the OAuth verification demo video Google
requires for the **restricted YouTube scopes**. Record one continuous,
narrated screen capture (voiceover or on-screen captions) on the **production**
domain so the consent screen and redirect URIs match exactly.

- App: **Schedlytics** · Domain: **https://www.schedlytics.com**
- Record at 1080p, ~3–6 minutes, no cuts inside the OAuth flow.
- Sign in with a Google account that is added as a **Test user** on the OAuth
  consent screen (or after the app is published).

---

## Scopes this video must justify

| Scope | Tier | Shown in scene |
|---|---|---|
| `…/auth/userinfo.profile` | Non-sensitive | 3 (connected channel name/avatar) |
| `…/auth/youtube.readonly` | Restricted | 4 (videos + stats on dashboard) |
| `…/auth/yt-analytics.readonly` | Sensitive | 5 (Insights charts) |
| `…/auth/youtube.upload` | Restricted | 6 (upload from Media Studio) |
| `…/auth/youtube` | Restricted | 6 (set title/visibility, publish/schedule) |
| `…/auth/youtube.force-ssl` | Restricted | 7 (reply to a comment in Inbox) |

Every restricted scope must be visibly exercised on screen. Do not skip a scene.

---

## Pre-recording checklist

- [ ] Production env is live (`/auth/config` shows `baseUrl: https://www.schedlytics.com`)
- [ ] The Google OAuth client used in prod is the one under review; redirect URI
      `https://www.schedlytics.com/auth/youtube/callback` is registered
- [ ] Test Google account has a YouTube channel with at least one uploaded video
      and at least one comment (so scenes 4–7 have real data)
- [ ] You're signed OUT of Schedlytics before recording
- [ ] Close unrelated tabs; hide bookmarks/personal info from the capture

---

## Scene 1 — Intro & app identity (10–15s)

**On screen:** the marketing homepage at `https://www.schedlytics.com`.

> "This is Schedlytics, a content analytics and publishing tool for creators, at
> www.schedlytics.com. I'll show how it uses each requested YouTube permission.
> A creator connects their own YouTube channel to see their performance and
> publish content from one dashboard."

---

## Scene 2 — Sign in & start the connection (20–30s)

**Actions:** Click **Open App** → sign in (Google or email) → go to
**Settings → Connected Accounts** → click **Connect** on **YouTube**.

> "First I sign in to Schedlytics. Then, from Settings, I choose to connect my
> YouTube account."

**On screen:** the Google **consent screen** appears. Pause here so the reviewer
can read the app name and the requested scopes.

> "Here is the Google consent screen showing the Schedlytics app and the exact
> permissions it requests. I'll grant access to my own channel."

**Action:** Approve. The popup returns to Schedlytics showing "Connected".

---

## Scene 3 — userinfo.profile (10s)

**On screen:** the connected YouTube card now shows the channel name and avatar.

> "Using the profile scope, Schedlytics displays the connected channel's name and
> picture so the creator can confirm which account is linked."

---

## Scene 4 — youtube.readonly (25–35s)

**Actions:** Go to the **Dashboard** (and/or **Content**). Show the channel's
videos, view/like/comment counts, and recent uploads loaded live.

> "With the YouTube read-only scope, Schedlytics reads the creator's own videos
> and their statistics — views, likes, and comments — and shows them on the
> dashboard so they can see what's performing."

---

## Scene 5 — yt-analytics.readonly (20–30s)

**Actions:** Open **Insights**. Show the analytics charts (views over time, watch
time, traffic sources, demographics).

> "Using the YouTube Analytics read-only scope, Schedlytics displays the
> creator's own channel analytics — watch time, traffic sources, and audience
> data — as charts and insights."

---

## Scene 6 — youtube.upload + youtube (45–60s)

**Actions:** Open **Media Studio**. Upload a video file. Set a title,
description, and visibility. Click **Publish to YouTube** (or schedule it).
After it finishes, open the new video on YouTube in a new tab to prove it
uploaded.

> "With the upload and manage scopes, the creator uploads a video to their own
> channel directly from Media Studio, sets its title, description, and privacy,
> and publishes or schedules it. Here is the resulting video on their YouTube
> channel."

---

## Scene 7 — youtube.force-ssl (25–35s)

**Actions:** Open **Inbox**. Show recent comments pulled from the channel. Type a
reply to one and send it. Show the reply posted.

> "Using the force-ssl scope, Schedlytics lets the creator read comments on their
> own videos and reply to them from the Inbox. I'll reply to this comment, and
> you can see it posted back to YouTube."

---

## Scene 8 — Revoke / disconnect (15–20s)

**Actions:** Go to **Settings → Connected Accounts → Disconnect** on YouTube.
Then optionally show **myaccount.google.com → Security → Third-party access** to
confirm the grant is removed.

> "Finally, the creator can disconnect at any time. Schedlytics revokes the grant
> and deletes the stored tokens, and access can also be removed from the Google
> account's third-party access page."

---

## Closing line (5s)

> "Schedlytics only ever accesses the signed-in creator's own channel data,
> displays it back to them, and never sells or shares it. Thank you for
> reviewing."

---

## Notes for the submission form

- Keep the spoken/caption justification for each scope close to the wording in
  the table above — reviewers match the video to the scope justifications.
- The privacy policy (`/privacy`), terms (`/terms`), and data deletion
  (`/data-deletion`) pages are public and linked in the footer; reference them if
  the form asks.
- Restricted scopes (`youtube`, `youtube.upload`, `youtube.force-ssl`) may also
  require a CASA security assessment before public launch; Testing mode (up to
  100 test users) works in the meantime.
- If you want a lighter first review, the scopes could be reduced to read-only
  (`youtube.readonly` + `yt-analytics.readonly` + `userinfo.profile`), which drops
  publishing and comment replies. Keep the full set if those features matter.
