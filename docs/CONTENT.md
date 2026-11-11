# Content: where things live

## The 14 days
`src/content/days.ts` holds each day's habit, movement and meditation titles and the `opening` line spoken at the start of the filmed session. It follows Pit's content file of 2026-11-10 word for word. The only exception is day 13 meditation: the approved short title (2026-11-08) stays as the title, and Pit's longer wording is the optional `detail` shown as a smaller second line.

Changing a title or opening line means editing `days.ts`, then running `node --experimental-strip-types scripts/gen-copy-deck.mjs` and `npx vitest run`. Titles and opening lines are sent to the browser only for today and yesterday (Today) or for an unlocked day (`/day/[n]`); locked days never receive them.

## Recorded-practice videos (Bunny)
**One practice video per day** (decision D4): each day has a single Bunny Stream video for the whole day's practice (the habit, the movement and the meditation together), so there is exactly one id per day, never one per action. The three actions are only things to mark; none of them has its own video, and no code, copy or env variable assumes otherwise. There are two places for its id, and the file is the main one:

1. **`src/content/days.ts` (main).** Each day has an optional `videoId`. When the owner sends a link or id for a day, it goes there: add `videoId: "<id>",` to that day's object. The id is the part of the Bunny link after `/embed/<library>/` or `/play/<library>/` (letters, digits, `_`, `-`); if you are sent a full link, copy only that id. Do not guess ids. Then run `npx vitest run` and deploy.
2. **`BUNNY_VIDEO_IDS` (override).** A comma-separated list in day order (position 1 = day 1). A non-empty position wins over `days.ts` for that day; an empty position falls back to `days.ts`. Useful for a quick swap on Vercel without a code change. Example: `id1,id2,,id4`.

`BUNNY_LIBRARY_ID` and `BUNNY_TOKEN_KEY` must be set too (environment only, never in the repo). Without them no day has a video. Days 7 and 14 are live sessions; they can stay without an id unless a recording is added.

A day with no id keeps the "video pending" state on Today and on the day page. `days.ts` stays on the server: the id is never sent to the browser, and the player URL is signed per request only for an unlocked day (`/api/video/[day]`). The merge logic is `getVideoConfig` in `src/lib/today/video.ts`. No ids are set today.
