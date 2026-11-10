# File and route plan: צעד קטן ביום

This plan was written in stage 0. Each stage builds only the files assigned to it, and a security gate and an accessibility gate run between every two stages.

## Stack
- Next.js 16 with the App Router, TypeScript and a `src/` directory. The UI is Hebrew and right-to-left.
- Postgres on Neon (`@neondatabase/serverless`) in production and node-postgres (`pg`) for local development and tests, both through drizzle-orm. `src/db/index.ts` picks the driver from the host in `DATABASE_URL` (localhost means `pg`; the check in `src/db/local-url.ts` also rejects `?host=`/`?hostaddr=` overrides). drizzle-kit generates the migrations as SQL in `drizzle/`, and they are committed.
- Vercel hosts the app, and Vercel Cron runs the scheduled jobs.
- Accounts use opaque sessions stored in the database. Passwords are hashed with argon2id (`@node-rs/argon2`).
- `zod` validates the environment, the webhook payloads and the forms. `web-push` sends push messages, using VAPID keys.
- There is no auth framework and no date library. Time zone handling uses `Intl` with Asia/Jerusalem.

## Routes
| Route | Kind | Who can reach it |
|---|---|---|
| /login, /activate, /forgot, /tsaad, /accessibility, /privacy, /terms | page | anyone (`/activate` needs a valid one-time link) |
| /today, /path, /day/[n], /live, /reminders, /install, /offer | page | a logged-in user |
| POST /api/webhooks/ghl/signup | handler | callers with the shared secret; replays are rejected |
| login, forgot, activate, logout | server actions (`src/app/(auth)/actions.ts`) | login and forgot are open but rate-limited; every action checks `Origin` against `APP_ORIGIN`; logout deletes the session row. There are no `/api/auth/*` handlers; handlers added later use `rejectCrossOrigin` |
| GET /api/video/[day] | handler | a session, and only once the server has unlocked that day |
| GET /api/live/[day]/ics | handler | a session; day 7 or 14 only, and only when `START_DATE` and `LIVE_TIME_DAYn` are set (else 404). The join link is not in the file |
| POST/DELETE /api/push | handler | a session, `Origin` check, rate limit, subscription validated (see Stage 9) |
| GET /manifest.webmanifest, /sw.js, /offline.html | static / metadata | anyone (no personal data; the service worker caches no HTML) |
| GET /api/cron/reminders, /api/cron/sync, /api/cron/cleanup | handler | requests that carry `Bearer CRON_SECRET` (constant-time check; 401 if the secret is unset or shorter than 16 characters) |
| GET /api/health | handler | anyone |

Access is enforced in the data-access layer (DAL) and in each route handler, not only in `proxy.ts`. The page never receives the content of a locked day.

## Tables
| Table | What it holds |
|---|---|
| `users` | Accounts: lowercase unique `username` (enforced by a CHECK), display name, email, phone, nullable unique `ghl_contact_id`, nullable `password_hash` (null until activation), `created_at`, `activated_at`. There is no `must_change_password` flag. |
| `activation_tokens` | One-time activation and reset links (`purpose` is `activate` or `reset`). Only the SHA-256 hash of the token is stored, with `expires_at` and `used_at`. |
| `sessions` | Login sessions. Only a hash of each token is stored, with `created_at`, `expires_at` and `last_seen_at`. |
| `login_attempts` | Failed logins, used for the rate limit. Stores hashes of the identifier and IP, never the raw values. |
| `webhook_events` | Incoming webhook event IDs (unique), used to make the signup webhook idempotent. No personal data. |
| `action_completions` | Completed actions (`habit`, `move`, `meditate`, `live`), unique on (user, day, action), day 1 to 14. |
| `live_attendance` | One attended or not-attended mark per user per live day (7 or 14), unique on (user, day). |
| `push_subscriptions` | Browser push subscriptions, endpoint unique. |
| `reminder_log` | Reminders, unique on (user, date), with status `pending` (written before sending), `dry_run`, `sent` or `failed`. |
| `sync_outbox` | Updates waiting to be synced, with status (`pending`, `failed` = will retry, `sent`, `dead` = gave up), attempts, next attempt time (also used as a lease while a worker holds the row) and an optional unique dedupe key. |

Every table that holds personal data references `users(id)` with `ON DELETE CASCADE`, so deleting an account removes all of its data. This is covered by an integration test.

Accounts are activated through a one-time link: the participant sets their own password, and nothing temporary is ever issued.

Completion of the challenge (12 of 14 days) is calculated when needed and not stored.

## Stages and the files they create (revised at gate G1)
- **Stage 2, design:**
  - fix the palette contrast
  - add a pause control for the moving water
  - add the missing screens: login, change password, forgot password, and error and loading states
- **Stage 3, content:**
  - all screen copy in a gender-neutral voice
  - aria labels
  - error copy
- **Stage 4, foundation:**
  - configuration: `config/constants.ts`, `config/env.ts` (zod, server-only), `config/index.ts` (frozen, lazy) and `lib/logger.ts` (server-only, with redaction of keys and free text)
  - database: `db/*`, `drizzle.config.ts`, `drizzle/` migrations, and `scripts/test-db.sh` (a throwaway local Postgres with a random password; DB tests run only when it sets `TSAAD_TEST_DB=1` and `DATABASE_URL` is local, and skip otherwise)
  - day logic: `lib/time/*` and `lib/days/*`, pure functions with an injectable clock, tested with fake clocks including DST
  - `lib/bunny/token.ts`
  - `scripts/create-dev-user.ts`, which works in development against localhost only and prints a one-time activation link
- **Stage 5, accounts:**
  - `lib/auth/*`: password, session, rate limit and DAL
  - the one-time activation link flow, where the participant sets their own password
  - a forgot-password flow (same one-time link, purpose `reset`)
  - an Origin check on every non-GET handler
  - built: `lib/auth/{config,crypto,password,policy,tokens,accounts,session,cookies,rate-limit,login,forgot,origin,request,dal}.ts`, `lib/messaging/sender.ts` (dry-run only), the pages under `app/(auth)/`, migration `0002` (`login_attempts.kind`), and `npm run test:e2e` (Playwright + axe)
- **Stage 6, background layer:**
  - `lib/sync/*` with a mock adapter, `lib/push/*` and `api/cron/*`
  - each reminder is sent once per user per day, on the first run at or after 07:30 and before a cutoff
  - a test proves nothing is sent under the default settings
  - built:
    - `lib/sync/{payload,backoff,adapter,outbox,worker}.ts`: PII-free tracker payload (strict zod), outbox with dedupe, `FOR UPDATE SKIP LOCKED` claim with a lease, exponential backoff with jitter, dead after 8 attempts, mock adapter only. There is no real GHL adapter; `getSyncAdapter()` returns null (TODO gate G3), so even `TRACKER_SYNC_ENABLED=true` processes nothing.
    - `lib/push/{endpoints,message,sender,reminders}.ts`: push endpoint allowlist (for stage 9 `api/push`), message text from `copy.push`, `PushSender` (dry-run default, `web-push` behind it, loaded lazily), reminder job (insert into `reminder_log` first, then send; 404/410 delete the subscription).
    - `lib/cron/auth.ts`, `lib/maintenance/cleanup.ts`, `app/api/cron/{reminders,sync,cleanup}/route.ts`, `vercel.json` crons.
    - migration `0003` (`reminder_log.status` gains `pending`; `sync_outbox.status` gains `dead`).
    - technical constants (reminder cutoff 12:00, sync backoff/attempts/lease, retention) in `config/constants.ts`.
- **Stage 7, Today:**
  - the app shell and the Today screen
  - `api/video`, issued for unlocked days only
  - a CSP with a nonce in `proxy.ts`
  - built:
    - `src/proxy.ts` + `lib/security/csp.ts`: per-request nonce CSP, no `'unsafe-inline'`/`'unsafe-eval'` in `script-src` (eval only in dev). `style-src` uses the nonce too; only `style-src-attr 'unsafe-inline'` remains (React `style=` attributes). `frame-src` is `https://iframe.mediadelivery.net` only, which is the host `lib/bunny/token.ts` signs for. `next.config.ts` keeps the other headers, plus a locked-down CSP for `/api/*` (the proxy skips api).
    - Nonce and `cacheComponents`: the Next docs say a nonce needs dynamic rendering and that PPR's static shell cannot carry it. The root layout therefore sets `instant = false` and calls `connection()`, which makes every route render per request (`ƒ` in the build output). There is no static shell any more.
    - `app/(app)/layout.tsx` (Suspense) + `_components/{AppShell,ShellLoading,BottomNav,MotionToggle,icons}.tsx`: header with the real logo, day chip, motion pause (localStorage, try/catch, reduced-motion aware), skip link, bottom nav, logout form.
    - `app/(app)/today/{page,TodayBoard,Cup,Ring,VideoTile,actions}.tsx|ts`: the Today screen. `TodayBoard` is a client component (useOptimistic) that recomputes cup, ring and remaining from the pure `lib/days` functions.
    - `app/api/video/[day]/route.ts`, `lib/today/video.ts`: signed embed URL for a session and an unlocked day with a configured id. `BUNNY_VIDEO_IDS` (new env, comma-separated, days 1..14) holds the ids; none are set.
    - `lib/today/{clock,test-clock,schedule,completions,toggle,view}.ts`: server clock, the test clock and its guard, the schedule from config (`START_DATE` unset means "before start"), `toggleActionCore` (transaction with the tracker outbox row), pure view model.
    - `components/Logo.tsx`: the YOGIT logo path, 11KB with C2PA metadata cut to 2KB. Also used in the auth layout.
    - `/` redirects to `/today` or `/login`.
    - Not implemented, left to stage 9: offline queueing. Marks need a connection; a failed save shows an error with retry.
- **Stage 8, path and locked day:**
  - `path` and `day/[n]`
  - built:
    - `lib/path/view.ts`: pure view models. `stoneState` and `pathModel` (14 stones: counted, today, yesterday, missed, locked, with water level, live flag and link), `dayScreen` (today, open with markable and counted, locked as before_start, tomorrow or far) and `parseDayParam` (1 to 14 only, no zeros, signs or decimals; it lives in the dependency-free `lib/path/day-param.ts`, which also gives `proxy.ts` its `isInvalidDayPath`). `pathModel.legend` lists "counted" plus only the states present on the path.
    - `app/(app)/path/{page,PathMap,StoneCup}.tsx`: the Bento path. The map is an `ol` with an aria-label summary. Stones sit at percent x and pixel y, so the map reflows from 320 px without losing the 44 px targets. Opened stones link to `/day/[n]` (today links to `/today`). Locked stones are plain list items, except tomorrow's, which links to its locked screen (as in AppLocked). The legend shows "אפשר לסמן עד חצות" only when such a stone exists.
    - `app/(app)/day/[n]/{page,DayActions,LockedDay}.tsx`: an invalid `n` gets a real 404 in `proxy.ts` (rewrite to an unmatched path, which renders the Hebrew root `app/not-found.tsx`; the same page serves every unknown URL), and the page's own `notFound()` (`(app)/not-found.tsx`) stays as a fallback; the current day redirects to `/today`; an open day shows its video and its actions, markable only for yesterday (through `toggleAction`, which still enforces the rule on the server), otherwise view only with "לא נספר" or "נספר" copy; a locked day renders `LockedDay`, which receives only the day number, so no titles or video id exist for it.
    - Shared: `today/ActionButton.tsx` (extracted), `today/action-labels.ts` (client-safe, no `content/days`), `lib/today/titles.ts` (server only), `_components/RefreshAtBoundary.tsx`, `lib/format.ts` `withStartDate`.
    - `TodayBoard` now gets the titles of today and yesterday as props instead of importing `content/days`. Before this, the Today client bundle contained the titles of all 14 days.
    - The `/path` tab is `aria-current` on `/path` and on `/day/*`.
    - New copy: the `day` group in `copy.he.ts` and `docs/content/COPY.md` (5 strings).
    - e2e: `e2e/path.spec.ts` (path states, accessibility, day states, invalid day, no-leak checks on HTML and JS).
- **Stage 9, live, reminders, install and the service worker:**
  - built:
    - `/live` (`app/(app)/live/{page,AttendanceToggle}.tsx`): two sessions (day 7, day 14) from `lib/live/{model,config,ics}.ts`. The pure model `liveSession` decides `before` / `open` / `passed` from the server clock; `joinUrl` exists only while `open`, so the link is never rendered (HTML, RSC payload or JS) outside the window. Constants in `config/constants.ts` `LIVE`: the link opens 60 minutes before the start and stays 150 minutes after it (assumed 90 minute session plus 60 minutes grace); the calendar event lasts 90 minutes. Without `LIVE_TIME_DAYn` the time shows the copy placeholder, there is no calendar file and no link window (the session counts as passed only when its day is over). Without `LIVE_URL_DAYn` an open window says the link is not there yet. Attendance is the existing `toggleAction(day, 'live')` (server rules, 2 steps in the cup), offered once the session has started (or any time that day if the time is unknown) while the day is still markable. `RefreshAtBoundary` refreshes the screen when the window opens or closes.
    - `GET /api/live/[day]/ics`: server-generated `.ics` (UTC times converted from Asia/Jerusalem, DST-safe), no join link inside.
    - `/reminders` (`app/(app)/reminders/{page,RemindersControls}.tsx`, `lib/pwa/push-client.ts`): `role="switch"` with the states checking / on / off / blocked / unsupported / error in one polite status region. The public VAPID key reaches the client as a server-rendered prop (not `NEXT_PUBLIC`); no key means "unsupported". Turning off deletes on the server first. The reminder time is fixed text (07:30).
    - `POST/DELETE /api/push` (`app/api/push/route.ts`, `lib/push/subscription.ts`): `Origin` check, session, rate limit (`RATE_LIMITS.push`, new `login_attempts.kind = 'push'`, migration `0005`), JSON and size limits, zod: endpoint on the allowlist (`lib/push/endpoints.ts`), `p256dh` = base64url of an uncompressed P-256 point that is on the curve (65 bytes, `0x04`), `auth` = 16 bytes. At most `REMINDERS.maxSubscriptionsPerUser` (5) per user: the oldest is deleted in the same transaction (per-user advisory lock). Upsert by endpoint: the same user refreshes keys and the subscription becomes the newest; an endpoint that belongs to another user moves to the caller only when `p256dh` and `auth` are identical (the same browser, a different login on a shared device), otherwise 409. Whoever knows only the endpoint cannot take it over.
    - `/install` (`app/(app)/install/{page,InstallGuide}.tsx`, `lib/pwa/install-prompt.ts`): iPhone steps, Android wording, "for the reminder", done / later (both navigate to `/today`). `display-mode: standalone` hides the steps. The "התקנה" button exists only after `beforeinstallprompt` fired (captured once in the shell by `PwaBoot`). No bottom nav on this screen.
    - PWA: `app/manifest.ts` (name, `lang he`, `dir rtl`, `start_url /today`, standalone, brand colours), icons rendered by `scripts/gen-icons.mjs` into `public/icons` and `public/apple-touch-icon.png`, `public/sw.js` registered by `PwaBoot` (production builds only). The worker handles `push` and `notificationclick` (same origin only) and caches only `/_next/static/*`, `/icons/*` and the offline page; navigations are network-first with `public/offline.html` (static, no script, no nonce, own CSP) as the only fallback. Cache names are versioned and old ones are deleted on activate. `sw.js` is served with `Cache-Control: no-cache` and its own CSP; the page CSP gained `worker-src 'self'` and `manifest-src 'self'`; `proxy.ts` skips the static PWA files.
    - Offline queue for marks: not built. Marks need a connection; a failed save shows "retry" (as in stage 7). `copy.today.toastOffline` stays unused and the offline copy no longer promises a queue.
    - Push payload: `buildReminderMessage` already returns `{ title, body, url: '/today', tag }`, which is what `sw.js` reads. Sending is still dry-run unless `REMINDERS_ENABLED=true` and VAPID keys are set.
    - e2e: `e2e/{live,reminders,install,pwa}.spec.ts` with `e2e/helpers.ts`. The e2e server sets fake `LIVE_TIME_DAY7`, `LIVE_URL_DAY7` (day 14 unset on purpose) and an ephemeral `VAPID_PUBLIC_KEY`.
- **Stage 9א, GHL link:**
  - the signup webhook, with a shared secret, idempotency and replay protection
  - it never resets an existing user
  - `api/health`
- **Stage 10, pages:**
  - `/tsaad`, the day-14 offer, and `/yesodot` with server-side eligibility
  - the full accessibility statement
  - privacy, terms, and account deletion (new app pages, which need legal review)
- **Stage 11, QA:**
  - Playwright with axe on every screen
  - keyboard, 200% zoom and screen-reader checks
  - a full security sweep
- **Stage 12, report.**

## Notes for the coming stages
- Marking rule: a participant can mark the current day, and yesterday until 24:00 Israel time of today. Older days are closed. Between 00:00 and 05:00 only the current day is open. The precise definition is in `src/lib/days/marking.ts`.
- `cacheComponents` is on. Read the session and the time inside `<Suspense>` or after `connection()`, and never cache user state or the current day.
- Next 16 renamed `middleware.ts` to `proxy.ts`. Read `node_modules/next/dist/docs` before writing code that touches it.
- Reminders: send once per user per day on the first cron run at or after 07:30 Jerusalem time (DST-safe); never rely on an exact-minute match.
- The CSP is set per request in `src/proxy.ts` (nonce). The service worker (`public/sw.js`) never caches HTML (the nonce is per request); a test inspects Cache Storage after navigating.
- Test clock: `TSAAD_TEST_NOW` and the `x-tsaad-test-now` header work only under the guard in `lib/today/test-clock.ts` (never on Vercel; in production only with `TSAAD_E2E=1` and a loopback `APP_ORIGIN`).
- Passwords and tokens never go into logs. Sending through GHL, WhatsApp or email stays off until gate G3.
- Vercel must not be connected to this repo before a deploy gate, or every branch push creates a preview deployment.
