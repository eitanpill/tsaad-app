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

## Stages and the files they create
- **Stage 4, core logic:**
  - time and unlock logic: `lib/time/*`, `lib/days/*`
  - accounts and sessions: `lib/auth/{password,session,webhook,rate-limit}`
  - video tokens: `lib/bunny/token`
  - database: `db/*`, `drizzle.config.ts`
  - unit tests with a fake clock
- **Stage 5, configuration:** `config/index.ts`, `config/env.ts`, `lib/logger.ts`, and new keys in `.env.example` (SESSION_SECRET, GHL_WEBHOOK_SECRET, CRON_SECRET, VAPID_SUBJECT, LIVE_URL_DAY7/14, APP_ORIGIN).
- **Stage 6, sync layer:** `lib/sync/*`, `lib/push/*`, `api/cron/*` and `vercel.json`. A test checks that nothing is sent under the default settings.
- **Stage 7, first screens:** login, password change, the app layout and Today, plus the server actions, `proxy.ts` (with a CSP nonce) and `api/video`.
- **Stage 8, path screens:** `path` and `day/[n]`, which includes the locked-day screen.
- **Stage 9, live and reminders:** `live`, `reminders` and `install`, plus `api/live` and `api/push`.
- **Stage 9א, app layer:** the PWA files (manifest, service worker, icons), the GHL signup webhook and `api/health`.
- **Stage 10, legal and landing pages:** the accessibility statement (IS 5568, WCAG 2.1 AA, with `[ACCESSIBILITY_CONTACT]`), privacy, terms, `/tsaad` and the day-14 offer.
- **Stage 11, QA:** Playwright with axe on every screen, keyboard, zoom and screen reader checks, and a full security sweep.

## Notes for the coming stages
- `cacheComponents` is on. Read the session and the time inside `<Suspense>` or after `connection()`, and never cache user state or the current day.
- Next 16 renamed `middleware.ts` to `proxy.ts`. Read `node_modules/next/dist/docs` before writing code that touches it.
- Reminders run at two UTC times, and the handler proceeds only when Jerusalem local time matches 07:30. This handles daylight saving time.
- The CSP still allows `'unsafe-inline'` scripts. In stage 7 it moves to a per-request nonce.
- Passwords and tokens never go into logs. Sending through GHL, WhatsApp or email stays off until gate G3.
