# Launch checklist: צעד קטן ביום

Written at stage 11 (QA). Nothing here has been done yet: no Vercel project is connected, nothing is deployed, and no message has been sent to anyone. Each step below is for the owner, or for whoever deploys with the owner's approval.

## 0. Before connecting Vercel
- [ ] Merge `feat/tsaad-challenge` only when the owner approves the deploy gate. Connecting Vercel to the repo turns every branch push into a preview deployment (see `docs/FILE_PLAN.md`).
- [ ] Vercel plan: the crons in `vercel.json` run every 15 minutes (`*/15`). Hobby allows at most one run a day, and a deploy with these schedules is rejected there. Use Pro, or change the schedules first.
- [ ] Region: `vercel.json` pins functions to `fra1` (Frankfurt), next to Neon in `aws-eu-central-1`. Keep the project's function region on fra1 in the dashboard too.
- [ ] Domain: decide the production domain first. `APP_ORIGIN` must equal it exactly, because every form and API call checks `Origin` against it. Preview deployments need their own `APP_ORIGIN`, or their forms are refused.

## 1. Environment variables on Vercel
Set them under Project → Settings → Environment Variables, for Production (and Preview if previews are used). Mark every "secret" as Sensitive. Nothing here is `NEXT_PUBLIC_`.

The server refuses to start in production when a **required** variable is missing or any value is invalid, and logs the variable names only (`src/config/required.ts`, run from `src/instrumentation.ts`). Missing **recommended** ones are logged as a warning, and that feature stays off or shows a neutral placeholder.

### Required
| Variable | Secret | Value |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (host has `-pooler`). |
| `APP_ORIGIN` | no | `https://<production domain>`, no path, no trailing slash. |
| `SESSION_SECRET` | yes | At least 32 random characters: `openssl rand -hex 32`. Changing it signs everyone out. |
| `ACTIVATION_LINK_TTL_MINUTES` | no | Owner decision, whole minutes (for example `1440` = 24 hours). |

### Secrets for features (recommended)
| Variable | Secret | Value |
|---|---|---|
| `CRON_SECRET` | yes | `openssl rand -hex 24` (16+ characters). Vercel Cron sends it as `Authorization: Bearer`. Without it every cron answers 401. |
| `GHL_WEBHOOK_SECRET` | yes | `openssl rand -hex 32` (32+). Without it the signup webhook answers 503. Same value goes into the GHL workflow header (`docs/GHL_SETUP.md`). |
| `BUNNY_TOKEN_KEY` | yes | Bunny Stream library → Security → token authentication key. |
| `VAPID_PRIVATE_KEY` | yes | From `npx web-push generate-vapid-keys` (together with the public key). Only needed when reminders are switched on. |

### Placeholders the owner must fill
| Variable | Value |
|---|---|
| `START_DATE` | `YYYY-MM-DD`, day 1 of the challenge (Israel time). Unset = every screen shows "before start". |
| `BUNNY_CDN_HOST` | Optional. Library CDN hostname (`vz-….b-cdn.net`, Bunny Stream → Library → CDN Hostname). With it the Today and day screens show the video thumbnail as the poster (`https://HOST/VIDEO_ID/thumbnail.jpg`); the host is added to the CSP `img-src` and nothing else. Without it a warm illustration is shown. If CDN token authentication is on for that zone, thumbnails will not load and the illustration stays. |
| `BUNNY_LIBRARY_ID` | Bunny Stream library id. |
| `BUNNY_VIDEO_IDS` | 14 video ids, comma-separated in day order; an empty slot means "no video yet" for that day. |
| `LIVE_TIME_DAY7`, `LIVE_TIME_DAY14` | `HH:MM` Israel time. Unset = "השעה תפורסם בקרוב." and no calendar file. `LIVE_TIME_DAY14` also starts the offer window. |
| `LIVE_URL_DAY7`, `LIVE_URL_DAY14` | https link of each live session. Shown only from 60 minutes before the start until 120 minutes after. |
| `MORNING_URL_CHALLENGE_79` | Payment page for the landing CTA (https). Unset = a disabled button. |
| `MORNING_URL_SESSION_271`, `MORNING_URL_BUNDLE_139`, `MORNING_URL_YESODOT_1265` | Day-14 offer payment pages (https). Unset = disabled button. |
| `OFFER_WINDOW_HOURS` | How long the day-14 offer stays open after the day-14 live ends. Unset = the offer never opens. Owner value: `48`. |
| `NEXT_COHORT_URL` | Optional https link for "לעדכון על המחזור הבא". The landing page replaces the registration button with "ההרשמה למחזור הזה נסגרה" from the opening of day 3 (05:00 Israel time); the link is shown next to it only when this is set. The signup webhook keeps creating accounts for people who already paid (it logs a warning). The payment page itself (`MORNING_URL_CHALLENGE_79`) is not closed by the app: switch it off in Morning when registration closes. |
| `OFFER_UTM_SESSION`, `OFFER_UTM_BUNDLE`, `OFFER_UTM_YESODOT` | Optional `utm_campaign` values (letters, digits, `_ . -`). |
| `YESODOT_OFFER_EXPIRY` | `YYYY-MM-DD` (end of that day in Israel) or an ISO time. Unset = no date shown. |
| `SESSION_SPOTS` | Only if a real, current number of places exists. It never counts down; clear it when it stops being true. |
| `ACCESSIBILITY_CONTACT` | **Blocker before launch** (accessibility regulations, regulation 35): the accessibility coordinator's name and phone or email. Owner value: `support@yogit-yoga.co.il`. |
| `PRIVACY_CONTACT` | **Blocker before launch**: contact for privacy access and correction requests. |
| `SUPPORT_CONTACT` | General contact shown in the terms. Owner value: `support@yogit-yoga.co.il`. |
| `ADMIN_USERNAMES` | Comma-separated usernames allowed to open `/admin/stats` (aggregate numbers: signed up, activated, active per day, days counted, completed 12 of 14, reminders opted in, offer button clicks). Empty = nobody. Everyone else, and anyone logged out, gets the normal 404. Use the owner's own participant username (an account created through the signup webhook). |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Public half of the VAPID pair, and `mailto:<address>` or an https URL. Without the public key the reminders screen says reminders are not supported. |

### Switches that stay off until the owner approves (gate G3)
| Variable | Value at launch | What it does |
|---|---|---|
| `REMINDERS_ENABLED` | `false` | With `false` the 07:30 job writes `dry_run` rows and sends nothing. Turn on only with the VAPID keys set, after the owner approves. A `dry_run` row holds the day, so switching on mid-morning sends from the next day. |
| `TRACKER_SYNC_ENABLED` | `false` | There is no real GHL adapter yet, so even `true` processes nothing. Keep `false`. |
| GHL activation delivery | dry-run (code) | The signup webhook creates the account and logs that a message *would* go out. There is no WhatsApp or email sending in the code (`lib/webhooks/ghl/delivery.ts`). Do not connect the GHL workflow for real participants until a real adapter is approved and built (G3). |

### Keep at their defaults
`UNLOCK_HOUR=05:00`, `REMINDER_TIME=07:30`, `TZ_NAME=Asia/Jerusalem`. Leave `TRUST_PROXY_IP_HEADERS` and `GHL_WEBHOOK_URL` empty (Vercel sets trusted IP headers itself; the URL is for G3).

### Never set on Vercel
`TSAAD_E2E`, `TSAAD_TEST_NOW`, `TSAAD_TEST_CLOCK_KEY`, `TSAAD_WEBHOOK_CAPTURE_FILE`. The test clock is ignored on Vercel anyway (`lib/today/test-clock.ts`), and the server logs a warning if they are there.

## 2. Database (Neon, aws-eu-central-1)
- [ ] Use the **unpooled** connection string (host without `-pooler`) for migrations only; the app uses the pooled one.
- [ ] From a checkout of the deployed commit: `DATABASE_URL='<unpooled url>' npx drizzle-kit migrate`. It applies `drizzle/0000` to `0009` in order (verified on an empty Postgres 16 by `scripts/test-db.sh`). `0008` drops the unused `login_attempts.user_id`; `0009` adds the `offer_clicks` counter table. Run it before the first deploy, and again before any deploy that adds a migration.
- [ ] Do not run `scripts/create-dev-user.ts` against Neon (it refuses anything but localhost).
- [ ] Turn on Neon point-in-time restore / backups for the branch.

## 3. Deploy
- [ ] Build locally first: `npx next build` must pass (stage 11: passes; every page is dynamic, `ƒ`).
- [ ] Deploy to production. Check the function logs for `env:` warnings and for `EnvConfigError` (a missing required variable stops the start).

## 4. Smoke test after deploy (about 15 minutes)
1. `GET https://<domain>/api/health` → `200 {"ok":true,"db":true}`.
2. `curl -sI https://<domain>/login` shows `Content-Security-Policy` with a nonce and `report-uri /api/csp-report`, `Reporting-Endpoints`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. No `X-Powered-By`.
3. `GET /api/cron/reminders` without a header → 401. In the Vercel dashboard, run the reminders cron once by hand → 200, and the response says `"mode":"dry"` or a `skipped` reason. Nothing is sent.
4. `/tsaad` loads, the CTA is a link only if `MORNING_URL_CHALLENGE_79` is set, `/legal/accessibility` shows the coordinator contact (not "פרטי הקשר ייוספו כאן בקרוב").
5. Create one staff test account: send one test signup to the webhook (see `docs/GHL_SETUP.md`, with the test contact's own details). Because delivery is dry-run, get the link with "שכחתי סיסמה" → it is also dry-run, so for this one test create the link with a one-off SQL insert, or wait for G3. Then: log in, mark today's habit, undo, open `/path`, a past day, `/live`, `/reminders` (turn on and off on a real phone), `/install`, `/account`.
6. Delete the staff test account from `/account` and check that login then fails.
7. On an iPhone and an Android phone: install to the home screen, open offline once (the offline page appears), and check the video plays (Bunny token, `frame-src`).
8. Offer clicks: with a payment URL set, open `/go/session` (or the matching key) once: it answers 302 to that URL. With `ADMIN_USERNAMES` set, log in as that user and check `/admin/stats` shows the click; a logged-out request to it must be a 404.
9. Watch the logs for a day for `csp violation` lines. A few from browser extensions are normal; repeated ones on our own pages mean a real problem.

## 5. Before inviting participants
- [ ] Lawyer review of the legal texts (`docs/LEGAL_REVIEW.md`); the pages are marked DRAFT until then.
- [ ] Accessibility statement: contact filled, check date still accurate.
- [ ] Owner decisions still open: listed in `/mnt/project-files/app/stage11/review.md` ("Needs the owner").
