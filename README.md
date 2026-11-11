# צעד קטן ביום

A Hebrew, right-to-left progressive web app for the 14-day yoga challenge "צעד קטן ביום". Participants are signed up from GoHighLevel, activate their account from a one-time link, and each morning get one new day: a small habit, a movement and a meditation (recorded practice videos on Bunny Stream), with live sessions on days 7 and 14, an optional morning reminder (web push) and the day-14 offers.

Stack: Next.js 16 (App Router, TypeScript), Postgres (Neon in production, node-postgres locally) through drizzle-orm, opaque database sessions with argon2id passwords, zod for configuration, Vercel for hosting and cron. Nothing is deployed yet: see `docs/LAUNCH_CHECKLIST.md`.

## Run it locally

You need Node 22 and a local Postgres 16. Copy `.env.example` to `.env.local` and fill in at least:

```
DATABASE_URL=postgres://user:password@localhost:5432/tsaad   # must be localhost for local development
SESSION_SECRET=<at least 32 random characters>
APP_ORIGIN=http://localhost:3000
```

```bash
npm ci
npx drizzle-kit migrate      # applies drizzle/*.sql to DATABASE_URL
npm run dev                  # http://localhost:3000
npm run dev:create-user -- --username dana --name "דנה" --email dana@example.test   # local test account, prints its activation link (refuses anything but localhost)
```

Every variable is documented in `.env.example` and `docs/LAUNCH_CHECKLIST.md`. All server-side configuration is read and validated in `src/config`.

## Tests and checks

| Command | What it does |
|---|---|
| `npm run typecheck` | Generates the Next route types, then runs `tsc --noEmit` (works on a fresh clone). |
| `npm run lint` | ESLint. |
| `npm test` | Unit and component tests (Vitest). Database tests are skipped without a test database. |
| `npm run test:db` | Starts a throwaway Postgres 16 (needs the Postgres 16 binaries, `PG_BIN` if not in `/usr/lib/postgresql/16/bin`), migrates it and runs all tests including the database ones. Nothing outside localhost is touched. |
| `npm run test:e2e` | Playwright and axe against a local build and a throwaway database. Uses the browser already installed (`PLAYWRIGHT_BROWSERS_PATH`); it does not download one. |
| `npx next build` | Production build. |

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, tests, the database tests against a Postgres 16 service and the build on every push and pull request; the browser tests run on the default branch and on demand.

## Where things are

- `src/content/copy.he.ts`: all user-facing text. `src/content/days.ts`: the 14 days (and optional Bunny `videoId` per day). `src/content/legal.he.ts`: the legal texts (drafts).
- `src/config`: environment schema, constants and the single `getConfig()`.
- `src/lib`: domain logic (auth, days and schedule, reminders, push, sync, webhooks, offer, live sessions).
- `src/app`: routes. `drizzle/`: committed SQL migrations. `e2e/`: browser tests.

## Docs

- `docs/FILE_PLAN.md`: stack, routes, data model and security decisions.
- `docs/LAUNCH_CHECKLIST.md`: environment variables, database, deploy and smoke test.
- `docs/CONTENT.md`: where the day content and the video ids go.
- `docs/GHL_SETUP.md`: the GoHighLevel signup webhook.
- `docs/LEGAL_REVIEW.md`: what the lawyer should check.
- `docs/content/COPY.md`: the full copy deck, generated from `src/content/copy.he.ts`.
- `AGENTS.md`: notes for coding agents (Next.js 16 differs from older versions).
