# Content: where things live

## The 14 days
`src/content/days.ts` holds each day's habit, movement and meditation titles and the `opening` line spoken at the start of the filmed session. It follows Pit's content file of 2026-11-10 word for word. The only exception is day 13 meditation: the approved short title (2026-11-08) stays as the title, and Pit's longer wording is the optional `detail` shown as a smaller second line.

Changing a title or opening line means editing `days.ts`, then running `node --experimental-strip-types scripts/gen-copy-deck.mjs` and `npx vitest run`. Titles and opening lines are sent to the browser only for today and yesterday (Today) or for an unlocked day (`/day/[n]`); locked days never receive them.

## Recorded-practice videos (Bunny)
There is one place to put the video ids: the environment variable `BUNNY_VIDEO_IDS` (set it in Vercel, and in `.env.local` for development; the template is `.env.example`).

- It is a comma-separated list of Bunny Stream video ids, in day order: position 1 is day 1, position 14 is day 14.
- Leave a position empty for a day without a video yet, for example `id1,id2,,id4`. Trailing days can simply be left off.
- `BUNNY_LIBRARY_ID` and `BUNNY_TOKEN_KEY` must be set too. Without them no day has a video.
- Days 7 and 14 are live sessions; their positions can stay empty unless a recording is added later.

A day with no id keeps the existing "video pending" state on Today and on the day page. Nothing in the code changes when ids are added: set the variable and redeploy. No ids are set today. The id check lives in `src/lib/today/video.ts` (`hasVideo`, `videoFor`).
