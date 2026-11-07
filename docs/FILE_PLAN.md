# File and route plan: צעד קטן ביום

This plan was written in stage 0. Each stage builds only the files assigned to it, and a security gate and an accessibility gate run between every two stages.

## Stack
- Next.js 16 with the App Router, TypeScript and a `src/` directory. The UI is Hebrew and right-to-left.
- Postgres on Neon, accessed through drizzle-orm. drizzle-kit generates the migrations as SQL, and they are committed.
- Vercel hosts the app, and Vercel Cron runs the scheduled jobs.
- Accounts use opaque sessions stored in the database. Passwords are hashed with argon2id (`@node-rs/argon2`).
- `zod` validates the environment, the webhook payloads and the forms. `web-push` sends push messages, using VAPID keys.
- There is no auth framework and no date library. Time zone handling uses `Intl` with Asia/Jerusalem.

## Routes
| Route | Kind | Who can reach it |
|---|---|---|
| /login, /tsaad, /accessibility, /privacy, /terms | page | anyone |
| /change-password | page | a logged-in user, including one who still has to change the temporary password |
| /today, /path, /day/[n], /live, /reminders, /install, /offer | page | a logged-in user who has already changed the temporary password |
| POST /api/webhooks/ghl/signup | handler | callers with the shared secret; replays are rejected |
| POST /api/auth/login, /api/auth/logout | handler | login is open but rate-limited; logout needs a session |
| GET /api/video/[day] | handler | a session, and only once the server has unlocked that day |
| GET /api/live/[session] | handler | a session, from 60 minutes before the live session |
| POST/DELETE /api/push/subscribe | handler | a session |
| GET /api/cron/reminders, /api/cron/sync | handler | requests that carry `Bearer CRON_SECRET` |
| GET /api/health | handler | anyone |

Access is enforced in the data-access layer (DAL) and in each route handler, not only in `proxy.ts`. The page never receives the content of a locked day.

## Tables
| Table | What it holds |
|---|---|
| `users` | Accounts, with a `must_change_password` flag and the GHL contact ID. |
| `sessions` | Login sessions. Only a hash of each token is stored. |
| `login_attempts` | Failed logins, used for the rate limit. |
| `webhook_events` | Incoming webhook IDs, used to make the signup webhook idempotent. |
| `action_completions` | Completed actions, unique on (user, day, action). |
| `live_attendance` | One attended or not-attended mark per user per live session. |
| `push_subscriptions` | Browser push subscriptions. |
| `reminder_log` | Reminders, unique on (user, date), with status `dry_run`, `sent` or `failed`. |
| `sync_outbox` | Updates waiting to be synced. |

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
  - configuration: `config/index.ts`, `config/env.ts` (zod) and `lib/logger.ts` (with redaction)
  - database: `db/*`, `drizzle.config.ts`, plus a local Postgres for tests
  - day logic: `lib/time/*` and `lib/days/*`, tested with a fake clock
  - `lib/bunny/token.ts`
  - a create-user script that works in development only
- **Stage 5, accounts:**
  - `lib/auth/*`: password, session, rate limit and DAL
  - forced password change
  - a forgot-password flow
  - an Origin check on every non-GET handler
- **Stage 6, background layer:**
  - `lib/sync/*` with a mock adapter, `lib/push/*` and `api/cron/*`
  - each reminder is sent once per user per day, on the first run at or after 07:30 and before a cutoff
  - a test proves nothing is sent under the default settings
- **Stage 7, Today:**
  - the app shell and the Today screen
  - `api/video`, issued for unlocked days only
  - a CSP with a nonce in `proxy.ts`
- **Stage 8, path and locked day:** `path` and `day/[n]`.
- **Stage 9, live, reminders and install:**
  - `live`, `reminders` and `install`
  - `api/live` and `api/push`, accepting known push endpoints only
  - the PWA manifest and the service worker, which caches no personal data
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
- `cacheComponents` is on. Read the session and the time inside `<Suspense>` or after `connection()`, and never cache user state or the current day.
- Next 16 renamed `middleware.ts` to `proxy.ts`. Read `node_modules/next/dist/docs` before writing code that touches it.
- Reminders: send once per user per day on the first cron run at or after 07:30 Jerusalem time (DST-safe); never rely on an exact-minute match.
- The CSP still allows `'unsafe-inline'` scripts. In stage 7 it moves to a per-request nonce.
- Passwords and tokens never go into logs. Sending through GHL, WhatsApp or email stays off until gate G3.
- Vercel must not be connected to this repo before a deploy gate, or every branch push creates a preview deployment.
