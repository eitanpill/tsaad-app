# Photos of Avital

Status (2026-11-26): `hero` and `about` are ON with photos from the shared album (cropped to 4:5, 1200x1500, about 220 KB each). `live` is still off.

The slots are built and wait for the files. While a slot is off: the landing "about" tile shows a small decorative sprig in a cream circle (no empty photo-sized box, no stand-in photo); the round `live` slot renders nothing.

| Slot | File (under `public/avital/`) | Ratio | Send at least | Recommended | Where it shows |
|---|---|---|---|---|---|
| `hero` | `avital-hero.jpg` | 4:5 portrait | 600 x 750 px | 1200 x 1500 px | Landing `/tsaad`, first photo of Avital, in the top tile under the signup button (beside the title on desktop). Preloaded. Professional, recognizable portrait. While off: nothing (the hero keeps its text-only layout). |
| `about` | `avital-about.jpg` | 4:5 portrait | 600 x 750 px | 1200 x 1500 px | Landing `/tsaad`, the "אביטל פלס" tile (between the heading and the text). Below the fold, so not preloaded. |
| `live` | `avital-live.jpg` | 1:1 square | 400 x 400 px | 800 x 800 px | A round 72 px photo beside the tag on the `/live` hero tile, and on the opening-live card of the before-start screen (`/today` before the challenge starts). The same file in both places. |

- Format: JPEG (or WebP, then change the extension in `src/content/photos.ts`). Target 200 to 400 KB per file; the test fails above 500 KB.
- Crop to the exact ratio before sending. The box is reserved from the ratio and the image is cropped to fill it (`object-fit: cover`), so a different ratio gets cut at the edges. Keep the face in the middle third.
- Local files only (the CSP allows `img-src 'self'`); Next serves them through its own image route as sized WebP/AVIF.
- Alt text is in `src/content/photos.ts` (neutral descriptions; change if the photo shows something specific).

## Turning a slot on

1. Put the file in `public/avital/` with the exact name above.
2. In `src/content/photos.ts` set `present: true` for that slot.
3. `npm test` (the manifest test fails if a slot is on without its file, if a photo is in the folder but its slot is off, or if a file is over 500 KB), then commit.

## Tests

- Unit: `src/content/photos.test.ts`.
- E2E: `e2e/photos.spec.ts`. Server A has the slots off (the no-photo design); server B turns them on with tiny generated placeholders (`public/avital/e2e-*.png`, created by `playwright.config.ts`, removed after the run, git-ignored). The switch `TSAAD_E2E_PHOTOS` works only where the test clock is allowed (never on Vercel). No fake photo of Avital is ever shipped.
