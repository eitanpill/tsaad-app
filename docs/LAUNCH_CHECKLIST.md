# Launch checklist: צעד קטן ביום

Written at stage 11 (QA). Nothing here has been done yet: no Vercel project is connected, nothing is deployed, and no message has been sent to anyone. Each step below is for the owner, or for whoever deploys with the owner's approval.

## 0. Before connecting Vercel
- [ ] Merge `feat/tsaad-challenge` only when the owner approves the deploy gate. Connecting Vercel to the repo turns every branch push into a preview deployment (see `docs/FILE_PLAN.md`).
- [ ] Vercel plan: the crons in `vercel.json` run every 15 minutes (`*/15`). Hobby allows at most one run a day, and a deploy with these schedules is rejected there. Use Pro, or change the schedules first. **The reminders cron now runs every 15 minutes all day** (`*/15 * * * *`, it was `*/15 4-10 * * *`): each participant chooses their own reminder time (05:30 to 21:00 Israel time), and a run only claims the people whose time has come. The days still unlock at 05:00. **The same cron also sends the separate live reminder** (no new cron entry): on days 7 and 14 only, once per participant, at the first run at or after 60 minutes before the live start (when the link opens in the app) and never at or after the start, so with the 15-minute granularity it arrives 45 to 60 minutes before. Nothing is sent for a day whose `LIVE_TIME_DAY7` / `LIVE_TIME_DAY14` is unset.
- [ ] **Migration `0016` (`habit_checks`) must run before the deploy** (`DATABASE_URL=<unpooled url> npx drizzle-kit migrate`). It only creates the new table `habit_checks` (cumulative habit checklist "ההרגלים שלי": user, day, habit_day; unique per user/day/habit; CHECK day 1..14 and 1 <= habit_day < day; cascade on user delete). No existing table is touched. The new code reads and writes it on /today, /day/N and /path, so deploying first makes those pages fail; the old code never uses it, so running the migration first is safe. Sending flags and defaults are unchanged.
- [ ] **Migration `0015` (`reminder_log_live_channels`) must run before the deploy** (`DATABASE_URL=<unpooled url> npx drizzle-kit migrate`). It only replaces the CHECK on `reminder_log.channel` to also allow `live_push` and `live_ghl` (no data change, no rewrite of rows). The new code writes those two values, so deploying it first makes the live reminder insert fail (the daily reminder is unaffected, nothing is sent). The old code never writes them, so running the migration first is safe.
- [ ] **Migration `0014` (`users_reminder_time`) must run before the deploy** (`DATABASE_URL=<unpooled url> npx drizzle-kit migrate`). It adds `users.reminder_time` (smallint, not null, default 450 = 07:30, CHECK 330..1260 in steps of 30). The default is a constant, so no table rewrite; every existing participant gets 07:30. The new code selects on that column, so deploying it first makes the reminders cron fail (nothing is sent, no data lost). The old code does not read the column, so running the migration first is safe.
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
| `NEXT_COHORT_URL` | Optional https link for "לעדכון על המחזור הבא". The landing page replaces the registration button with "ההרשמה למחזור הזה נסגרה" from the opening of day 3 (05:00 Israel time); the link is shown next to it only when this is set. The signup webhook keeps creating accounts for people who already paid (it logs a warning). **This landing button is the only thing that closes**: the payment link appears only in this button, so replacing it on day 3 at 05:00 is enough. Nothing else to close in the app, Morning or GHL. |
| `OFFER_UTM_SESSION`, `OFFER_UTM_BUNDLE`, `OFFER_UTM_YESODOT` | Optional `utm_campaign` values (letters, digits, `_ . -`). |
| `SESSION_SPOTS` | Only if a real, current number of places exists. It never counts down; clear it when it stops being true. |
| `ACCESSIBILITY_CONTACT` | **Blocker before launch** (accessibility regulations, regulation 35): the accessibility coordinator's name and phone or email. Owner value: `support@yogit-yoga.co.il`. |
| `PRIVACY_CONTACT` | **Blocker before launch**: contact for privacy access and correction requests. |
| `SUPPORT_CONTACT` | General contact shown in the terms. Owner value: `support@yogit-yoga.co.il`. |
| `ADMIN_USERNAMES` | Comma-separated usernames allowed to open `/admin/stats`, `/admin/participants` (manage participants, one-time links) and the day preview (see section 6). `/admin/stats` shows aggregate numbers: signed up, activated, active per day, days counted, completed 12 of 14, reminders opted in, offer button clicks). Empty = nobody. Everyone else, and anyone logged out, gets the normal 404. Use the owner's own usernames (accounts made with `npm run admin:create-user`, section 6, or through the signup webhook). |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Public half of the VAPID pair, and `mailto:<address>` or an https URL. Without the public key the reminders screen says reminders are not supported. |

### Switches that stay off until the owner approves (gate G3)
| Variable | Value at launch | What it does |
|---|---|---|
| `REMINDERS_ENABLED` | `false` | With `false` the reminders job (every 15 minutes, each participant at their chosen time, default 07:30) writes `dry_run` rows and sends nothing. The same flag gates the live reminder (channel `live_push`, one hour before the live on days 7 and 14); the daily reminder never mentions the live. Turn on only with the VAPID keys set, after the owner approves. A `dry_run` row holds the day, so switching on mid-morning sends from the next day. |
| `TRACKER_SYNC_ENABLED` | `false` | There is no tracker adapter yet, so even `true` processes nothing. Keep `false`. |
| `GHL_REMINDER_MODE` | `off` | `off` = push only, as before. `dry` = logs and writes `reminder_log` rows (channel `ghl`), calls nothing. `live` = at the first run at or after each participant's chosen time (default 07:30), sets the contact field and adds the day tag in GHL, and a GHL workflow sends the WhatsApp. Needs `GHL_API_TOKEN` and `GHL_LOCATION_ID`; ignored (runs as off, with an error in the log) without them, and never active in tests/e2e. |
| `GHL_REMINDER_MODE` and the live reminder | (same flag) | The same `off\|dry\|live` flag also gates the separate live WhatsApp reminder: `dry` writes `live_ghl` rows and logs, `live` sets the field `tsaad_live_time` (the live time, e.g. `20:00`) and adds the tag `tsaad_live_reminder` about an hour before the live. Needs workflow 4 and template 4 in `docs/GHL_SETUP.md`. |
| `GHL_DELIVERY_MODE` | `off` | `off` = today's dry-run. `dry` = logs what would be written. `live` = writes the one-time activation or reset link to the contact field and adds the tag, and a GHL workflow sends it **by email only** (Meta does not approve a WhatsApp template with a password link; WhatsApp carries only the morning reminder, template 3). A contact with a phone but no email gets an account and a log warning, no link; `/admin/participants` shows "אין מייל: שלחו קישור ידנית" and the owner uses "new link" and sends it by hand. Same token rules. |
| `GHL_API_TOKEN` (secret), `GHL_LOCATION_ID` | empty | Only for `live`. Private Integration token with the contacts scopes (view and edit), see `docs/GHL_SETUP.md`. |
| `GHL_FIELD_TODAY_URL`, `GHL_FIELD_ACTIVATION_URL`, `GHL_TAG_REMINDER_PREFIX`, `GHL_TAG_ACCOUNT_READY`, `GHL_TAG_RESET_READY`, `GHL_FIELD_LIVE_TIME`, `GHL_FIELD_LIVE_TIME_ID`, `GHL_TAG_LIVE_REMINDER` | defaults `tsaad_today_url`, `tsaad_activation_url`, `tsaad_reminder_day`, `tsaad_account_ready`, `tsaad_reset_ready`, `tsaad_live_time`, (no id), `tsaad_live_reminder` | Names (keys) of what Pit creates in GHL. Change only if the names in GHL differ. |
| `GHL_FIELD_TODAY_URL_ID`, `GHL_FIELD_ACTIVATION_URL_ID` | empty (set for live) | Recommended: the GHL ids of the two custom fields (Settings, Custom Fields). Set = the update sends `{id, fieldValue}` (GHL's schema marks `id` required); empty = `{key, fieldValue}`. |
| GHL activation delivery | dry-run (`GHL_DELIVERY_MODE=off`) | The signup webhook creates the account and logs that a message *would* go out. The app itself never sends WhatsApp or email: with `GHL_DELIVERY_MODE=live` it writes the link to a GHL field and a GHL workflow sends the email. GHL cannot empty a field, so after sending the workflow sets `tsaad_activation_url` to a single space; the app never reads that field (it only overwrites it), and any future read must treat a whitespace-only value as empty. Do not connect real participants before the live check above. |

Order for turning on GHL sending (each step with Pit's approval): finish the GHL steps in `docs/GHL_SETUP.md`, then `dry` for a day and read the logs, then `live` for one test contact (Pit's own) before real participants. **The first live call must be verified by hand** (the request shapes are written from the GHL API v2 documentation, not from a live call): check that the field and the tag appear on the contact and that the workflow fires. Run migrations `0011` (adds `reminder_log.channel`), `0012` (adds `users.whatsapp_reminders`, default on) and `0014` (adds `users.reminder_time`, default 07:30) first. The WhatsApp tag now arrives at each participant's chosen time (same time as the push); no change is needed in GHL, but the template greeting should not say "good morning" (`docs/GHL_SETUP.md`). With `GHL_REMINDER_MODE` not `off`, /reminders shows a "תזכורת בוואטסאפ" switch to participants who have a GHL contact; switched off, they get no WhatsApp reminder. The daily WhatsApp reminder never mentions the live; the live has its own tag `tsaad_live_reminder` (workflow 4, template 4, no Wait: the tag fires about an hour before the live). Templates 3 (morning reminder) and 4 (live reminder) are the WhatsApp reminder templates and must carry the opt-out line (`docs/GHL_SETUP.md`). Run migration `0015` first. Signup: Pit's Morning payment workflow adds the tag `tsaad_registered`, and Workflow 0 posts to the final URL `https://14days.yogit-yoga.co.il/api/webhooks/ghl/signup` with the header `x-tsaad-webhook-secret` (so `APP_ORIGIN=https://14days.yogit-yoga.co.il`).

### Keep at their defaults
`UNLOCK_HOUR=05:00`, `REMINDER_TIME=07:30` (only the default time shown in the texts; each participant's real time is `users.reminder_time`, default 07:30, so keep it equal to 07:30), `TZ_NAME=Asia/Jerusalem`. Leave `TRUST_PROXY_IP_HEADERS` and `GHL_WEBHOOK_URL` empty (Vercel sets trusted IP headers itself; the URL is for G3).

### Never set on Vercel
`TSAAD_E2E`, `TSAAD_TEST_NOW`, `TSAAD_TEST_CLOCK_KEY`, `TSAAD_WEBHOOK_CAPTURE_FILE`. The test clock is ignored on Vercel anyway (`lib/today/test-clock.ts`), and the server logs a warning if they are there.

## 2. Database (Neon, aws-eu-central-1)
- [ ] Use the **unpooled** connection string (host without `-pooler`) for migrations only; the app uses the pooled one.
- [ ] From a checkout of the deployed commit: `DATABASE_URL='<unpooled url>' npx drizzle-kit migrate`. It applies `drizzle/0000` to `0016` in order (verified on an empty Postgres 16 by `scripts/test-db.sh`). `0008` drops the unused `login_attempts.user_id`; `0009` adds the `offer_clicks` counter table; `0013` (`users_disabled_at`) adds the nullable `users.disabled_at` column (no default, no rewrite; participants disabled from `/admin/participants`); `0014` (`users_reminder_time`) adds `users.reminder_time` (default 450 = 07:30, CHECK 330..1260 step 30), see section 0; `0015` (`reminder_log_live_channels`) widens the `reminder_log.channel` CHECK for the live reminder; `0016` (`habit_checks`) adds the older-habits table of the habit checklist. Run it before the first deploy, and again before any deploy that adds a migration.
- [ ] Do not run `scripts/create-dev-user.ts` against Neon (it refuses anything but localhost). The production script is `npm run admin:create-user` (section 6).
- [ ] Turn on Neon point-in-time restore / backups for the branch.

## 3. Deploy
- [ ] Build locally first: `npx next build` must pass (stage 11: passes; every page is dynamic, `ƒ`).
- [ ] Deploy to production. Check the function logs for `env:` warnings and for `EnvConfigError` (a missing required variable stops the start).

## 4. Smoke test after deploy (about 15 minutes)
1. `GET https://<domain>/api/health` → `200 {"ok":true,"db":true}`.
2. `curl -sI https://<domain>/login` shows `Content-Security-Policy` with a nonce and `report-uri /api/csp-report`, `Reporting-Endpoints`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. No `X-Powered-By`.
3. `GET /api/cron/reminders` without a header → 401. In the Vercel dashboard, run the reminders cron once by hand → 200, and the response says `"mode":"dry"` or a `skipped` reason (`too_early` before 05:30 local). `"claimed":0` is normal outside someone's chosen time. Nothing is sent. On days 7 and 14, from an hour before the live, the response also has a `live` part (`"mode":"dry"`, rows `live_push`); on other days or without a configured live time it is absent or `skipped`. In `/reminders`, change the time, press save and reload: the choice stays.
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

## 6. Owner and reviewer access before GHL is connected (Pit and Avital log in and review the app)
Production runs with `GHL_DELIVERY_MODE=off`: the app sends nothing, so the owner creates the accounts and sends each link by hand. `START_DATE` may stay unset: the day preview lets reviewers see any day.

Run everything below from `~/tsaad-app` on the Mac, with `.env.local` holding the production `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `APP_ORIGIN` (the production origin, `https://...`) and, optionally, `ACTIVATION_LINK_TTL_MINUTES` (the script defaults to 4320 = 3 days). Nothing here is sent anywhere.

1. **Migrations up to 0014** (once, before the deploy that contains this code; the unpooled URL is for migrations only):
   ```bash
   set -a; source .env.local; set +a
   DATABASE_URL="$DATABASE_URL_UNPOOLED" npx drizzle-kit migrate
   ```
   It applies `drizzle/0013_users_disabled_at.sql` and `drizzle/0014_users_reminder_time.sql` (and any earlier migration that is missing).
2. **Deploy** this commit to production (Vercel).
3. **Create the first two accounts.** The command prints the activation link once, on its own line (stdout); the rest goes to stderr. Open it, or send it to the person, to set a password:
   ```bash
   npm run admin:create-user -- --confirm-production --username pit --name "פיט" --email <Pit's email> --phone <Pit's phone>
   npm run admin:create-user -- --confirm-production --username avital --name "אביטל" --email <Avital's email> --phone <Avital's phone>
   ```
   Email or phone may be left out if the other is given. `--confirm-production` and `APP_ORIGIN` are required, and the script prints the database host (not the password) and asks you to type that host before it writes anything (check it is the production Neon host); outside a terminal pass `--db-host <host>` instead. A wrong or missing host stops the script with nothing written. If the username already exists: `npm run admin:create-user -- --confirm-production --username pit --new-link` prints a fresh activation link (account not yet activated) or a password-reset link (account already activated); the old unused link stops working. A disabled account gets no link.
4. **Make them admins.** Vercel → Project → Settings → Environment Variables → Production: `ADMIN_USERNAMES=pit,avital`, then **redeploy** (a variable change applies only to new deployments). Until then, `/admin/*` answers 404 for everyone.
5. **Log in** at `/login` with the username and the password chosen from the link, then open `/admin/participants`.

### Using /admin/participants
- **List and search**: name, username, phone, email, created, activated, disabled, last activity (latest mark or sign-in). Search by name, username, email or phone; 25 per page. `/admin/stats` and this page link to each other at the top.
- **Add participant manually**: name plus phone and/or email; the username is generated like the signup webhook (email local part, else phone digits, else `yogi12345`, with a numeric suffix on conflict). The activation link is shown once, with a copy button. It is not stored anywhere: reload and it is gone. Send it yourself by WhatsApp or email (manual sending is the owner's choice; the automatic links go by email only). A not-yet-activated participant with no email shows the badge "אין מייל: שלחו קישור ידנית": use **New link** and send it yourself.
- **New link**: an activation link for someone who has not activated, a password-reset link for someone who has (it also signs them out everywhere once used). Shown once, same as above; the previous unused link of that kind stops working.
- **Disable / enable**: a disabled participant cannot sign in (same "wrong details" message), is signed out immediately, gets no reminders, push, GHL reminder tags, tracker sync or new links. A GHL signup webhook for that contact never re-enables them. Enable brings them back (they sign in with their old password).
- **Delete**: permanent, same cascade as self-deletion from `/account`. First click opens a confirmation panel; type the username to confirm. Nothing is deleted in GHL (do that by hand, `docs/LEGAL_REVIEW.md`).
- You cannot disable or delete your own account. Every action checks admin status and `Origin` on the server, is rate limited (60 per 10 minutes per admin) and writes one audit log line with ids only, no names, contact details or links.

### Day preview (reviewers)
On `/admin/participants`, "תצוגה מקדימה של יום": pick day 1 to 14 and start. `/today`, `/day/N`, `/path`, `/live`, `/offer`, `/yesodot` and the video links then behave as if today were that day, only for that admin's own browser (a signed, httpOnly cookie bound to the admin account, valid 12 hours; re-checked against `ADMIN_USERNAMES` on every request, so a forged or copied cookie does nothing for anyone else). A banner "מצב תצוגה מקדימה: יום N" with a stop button shows on every app page; the same stop button is on the participants page. Marks made during a preview are saved on the admin's own account like normal marks. The e2e test clock (`TSAAD_TEST_NOW`) is separate and stays off on Vercel.
