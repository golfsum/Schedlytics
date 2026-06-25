# TikTok for Developers — App Review Submission

Everything here maps 1:1 to the real integration in
[`server/platforms/tiktok.js`](../server/platforms/tiktok.js). Submit only the
products and scopes listed below; remove any others in the Developer Portal or
the review will be delayed.

- **Website URL to provide:** `https://www.schedlytics.com` (the demo video must
  show this same domain).
- **Redirect URI:** `https://www.schedlytics.com/auth/tiktok/callback`
- **Environment:** record the demo in the **Sandbox** environment (required for a
  first-time submission).

---

## Part A — Product & scope explanation (paste into the form)

**About the app.** Schedlytics is a content scheduling and analytics dashboard
for creators. A creator connects their own social accounts (including TikTok),
sees their own performance in one place, and schedules/publishes posts. The
TikTok integration is used only on the connected creator's own account and own
data.

We use three TikTok products and four scopes:

### 1. Login Kit — `user.info.basic`
Login Kit is how a creator connects their TikTok account. In **Settings →
Connected Accounts**, the user clicks **Connect** on TikTok, which opens TikTok's
OAuth consent screen (`/v2/auth/authorize/`). After they approve, we exchange the
code for tokens (`/v2/oauth/token/`).

The `user.info.basic` scope returns `open_id`, `display_name`, and `avatar_url`.
We use these to (a) identify which account was connected and (b) display the
creator's handle and avatar next to the TikTok row so they can confirm the right
account is linked. Nothing is posted or changed; this scope only powers sign-in
and account identification.

### 2. Display API — `user.info.stats` and `video.list`
The Display API surfaces the creator's own TikTok performance inside our
dashboard so they don't have to switch apps.

- **`user.info.stats`** — we call `/v2/user/info/` for `follower_count`,
  `likes_count`, and `video_count`. These appear as the account's headline
  metrics on the **Dashboard** and **Connected Accounts** card.
- **`video.list`** — we call `/v2/video/list/` for the creator's recent videos
  and their `view_count`, `like_count`, `comment_count`, and `share_count`.
  These appear in **Insights / Recent Activity** so the creator can see which of
  their recent posts performed best.

This is read-only display of the creator's own data; we do not browse or display
any other user's content.

### 3. Content Posting API — `video.publish`
This scope lets a creator publish a video to their own TikTok from our
**Media Studio**. The creator uploads a video and adds a caption/title. Before
anything is sent, we show a **confirmation step** that follows TikTok's UX
guidelines:

1. We call `/v2/post/publish/creator_info/query/` and display the creator's
   account, their **allowed privacy levels**, and which interactions
   (comment / Duet / Stitch) are available.
2. The creator must **explicitly choose a privacy level** (we never pre-select
   one) and can toggle comment/Duet/Stitch.
3. We show the required disclosure linking TikTok's Community Guidelines and
   Music Usage Confirmation.

Only after the creator confirms do we call `/v2/post/publish/video/init/` as a
direct post (single-chunk `FILE_UPLOAD`, or `PULL_FROM_URL` for scheduled posts)
with their chosen settings, then upload the bytes.

While the app is unaudited, `creator_info` returns only `SELF_ONLY`, so the
privacy selector offers just **"Only me (Private)"** and posts land **private**
on the creator's own account. We never post to anyone else's account and never
post without the creator confirming the action.

**Summary of scopes**

| Scope | Product | What we do with it |
| --- | --- | --- |
| `user.info.basic` | Login Kit | Connect account; show handle + avatar |
| `user.info.stats` | Display API | Show the creator's follower/like/video counts |
| `video.list` | Display API | Show the creator's recent videos + engagement |
| `video.publish` | Content Posting API | Let the creator publish their own video |

---

## Part B — Demo video script (end-to-end)

Record one screen capture (mp4/mov, < 50 MB) on `https://www.schedlytics.com`
(keep the browser URL bar visible the whole time). Narrate or add captions for
each step. Use a TikTok **Sandbox** test user.

1. **Show the site + URL (5s).** Land on the app at `www.schedlytics.com/app`
   so the domain is clearly visible. Say: "This is Schedlytics, a content
   scheduling and analytics dashboard."

2. **Login Kit — connect (20s).** Go to **Settings → Connected Accounts**. Click
   **Connect** on TikTok. The TikTok OAuth consent screen opens; show the
   requested scopes on TikTok's own screen. Approve. Back in the app, show the
   TikTok row now displays the connected **handle and avatar**.
   *(Demonstrates Login Kit + `user.info.basic`.)*

3. **Display API — stats (15s).** Open the **Dashboard** / **Connected Accounts**
   card and show the TikTok **follower count, likes, and video count**.
   *(Demonstrates `user.info.stats`.)*

4. **Display API — recent videos (15s).** Open **Insights / Recent Activity** and
   show the list of the creator's **recent TikTok videos with view/like/comment/
   share counts**.
   *(Demonstrates `video.list`.)*

5. **Content Posting API — publish (40s).** Go to **Media Studio**. Upload a
   sample video, add a caption/title, select **TikTok**, and click **Publish**.
   A confirmation dialog appears showing the account, the **privacy selector**
   (choose "Only me / Private"), and the **comment/Duet/Stitch** toggles, plus
   the Community Guidelines + Music Usage disclosure. Choose a privacy level and
   click **Post to TikTok**. Show the success confirmation.
   *(Demonstrates `video.publish` + the required posting-consent UX.)*

6. **Verify on TikTok (10s).** Open the Sandbox test account in the TikTok app
   and show the newly posted video (it will be **private / SELF_ONLY** because the
   app is unaudited). State that out loud so the reviewer expects a private post.

7. **Wrap (5s).** Briefly recap: "Connect via Login Kit, view stats via the
   Display API, and publish via the Content Posting API — all on the creator's own
   account."

Keep each interaction slow and clearly visible (cursor, clicks, resulting UI).

---

## Part C — Pre-submission checklist

- [ ] In the Developer Portal, the app requests **exactly** these scopes —
      `user.info.basic`, `user.info.stats`, `video.list`, `video.publish` — and
      **nothing else**. Remove any extra products/scopes.
- [ ] Redirect URI registered: `https://www.schedlytics.com/auth/tiktok/callback`.
- [ ] The website URL in the form matches the domain shown in the video
      (`www.schedlytics.com`).
- [ ] For the Content Posting API, the URL-pull domain
      (`www.schedlytics.com`) is verified in TikTok app settings if you
      demonstrate scheduled/`PULL_FROM_URL` posting.
- [ ] Demo recorded in the **Sandbox** environment with a sandbox test user.
- [ ] The video shows the UI and each interaction clearly, with the domain visible.

> Posting UX (implemented): before any TikTok post, the composer calls
> `creator_info/query` and shows the creator a confirmation dialog where they
> explicitly pick a privacy level (never pre-selected) and set comment/Duet/
> Stitch, with the required Community Guidelines + Music Usage disclosure. While
> unaudited, the only privacy option returned is `SELF_ONLY`, so posts land
> private. This matches TikTok's Content Posting UX guidelines — make sure the
> demo video clearly shows this dialog.
