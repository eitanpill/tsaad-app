# Accessibility notes · stage 2 (target: IS 5568 / WCAG 2.1 AA)

Applies to the "לוח פסיפס" boards: R5Bento (landing) and the App boards (390×844). Contrast numbers: see `contrast.md`.

## Shared rules (all screens)

- `<html lang="he" dir="rtl">`. Latin values (username, times, placeholders such as `[UNLOCK_HOUR]`) get `dir="ltr"` on their own element.
- Landmarks: `header` (logo + screen tools), `main` (the tile grid), `nav aria-label="ניווט ראשי"` (tab bar, signed-in screens only). Add a "דילוג לתוכן" skip link as the first focusable element, visible on focus.
- One `h1` per screen (the hero tile). Tiles that carry their own title use `h2`. Do not skip levels. Bold labels inside tiles that are not titles stay `<b>`/`<span>`.
- Logo: inline SVG with `role="img" aria-label="YOGIT"`; when it links home, the link gets `aria-label="YOGIT, למסך היום"`.
- Focus ring: `:focus-visible { outline: 3px solid #123021; outline-offset: 2px; box-shadow: 0 0 0 2px #FAF8F4 }` (works on cream, sky, sand, sage and on forest). Never `outline: none` without this replacement.
- Target size: every interactive element is at least 44×44 CSS px (buttons 48–54px tall, tab items 52px tall × ~85px wide, the motion button 44×44, the show-password button 44×44, the switch 60×44 hit area, text links `min-height: 44px`).
- Focus order follows the visual RTL reading order: header (logo, motion button) → main tiles top to bottom, right to left inside a row → tab bar. No positive `tabindex`.
- State never by color alone: cups (fill level + solid/dashed outline), stones (solid/dashed outline + "היום" tag + day numbers), actions (check disc vs empty ring + `aria-pressed`), switch (knob side + check icon + `aria-checked`), errors (icon + text + border).
- Motion: every continuous animation (water waves, play-button pulse, today-stone glow) stops with `prefers-reduced-motion: reduce` and with the header "עצירת אנימציה" button (2.2.2). Animations shorter than 5s (ring fill, Live dot ×2, Install icon waves ×2) run once and need no control.
- Live regions: use one polite `role="status"` region per screen for toasts and save confirmations, and `role="alert"` only for blocking errors. Don't re-announce on every re-render.
- Forms: every input has a visible `<label for>`, `autocomplete`, and `aria-describedby` that points to its hint, requirements list and error. On submit error: `aria-invalid="true"`, the error text is placed under the field, and focus moves to the first invalid field. Do not rely on placeholders.
- Language: gender-neutral Hebrew (plural or impersonal) in new copy. No internal terms (vendor names, "שרת") in UI text.

### Motion button (Today, Path, R5Bento)
```html
<button type="button" aria-pressed="false" aria-label="עצירת אנימציה">…pause icon…</button>
```
On press: set `aria-pressed="true"`, swap to the play icon, keep the label stable (the pressed state carries the meaning), set `data-motion="off"` on the app root (CSS pauses `.apwv`, `.appulse`, `.apglow`) and save the choice in `localStorage`. Initial state: paused when `prefers-reduced-motion: reduce`.

---

## R5Bento (landing)
- Landmarks: `header` (logo, "עם אביטל פלס", motion button), `main`. A footer with legal links is still to come.
- Headings: h1 "צעד קטן ביום". The tiles "השביל שלך" and "מה עושים היום" become h2 in code (they are shown as `<span>`/`<b>` now).
- Names: motion button "עצירת אנימציה". The path tile is `role="img" aria-label="שביל של 14 ימים, 4 נספרו"` and its cups and stones are `aria-hidden`. The ring is `role="img" aria-label="4 מתוך 14 ימים"`, and so is the cup ("כוס של היום, חצי מלאה").
- Actions on the landing page are a demo. Either make them real toggle buttons (`aria-pressed`) or render them as non-interactive illustration (`aria-hidden`, not focusable). Don't ship focusable fakes.
- Focus order: motion button → CTA "אני בפנים" → (demo actions, if interactive).
- Targets: CTA 52px, motion button 44px, actions 70px.

## AppToday
- Landmarks: header, main, nav.
- Headings: h1 "הבוקר: שבע דקות אור שמש"; the video tile title "התרגול של היום עם אביטל" is h2.
- Names: motion button "עצירת אנימציה"; play button "ניגון סרטון יום 4"; the ring is `role="img" aria-label="4 מתוך 14 ימים"`; the cup tile needs `role="img"` on its SVG (currently only the section has the label) with "הכוס של היום, חצי מלאה".
- Actions: three `<button aria-pressed>`; the accessible name is the visible text ("הרגל, שבע דקות אור שמש"). On toggle, a polite `role="status"` says "נשמר. הכוס עלתה." (see AppStates). The cup's level change is also put into words in that message.
- Video player: an embedded iframe gets `title="סרטון התרגול של יום 4"`. Captions or subtitles must be available (1.2.2). If the player has autoplay, it must be muted or off.
- Focus order: motion → play → actions (הרגל → תנועה → מדיטציה) → tab bar.
- Note: the caption chip on the video still uses an internal vendor name; replace it in the stage-3 copy pass.

## AppPath
- Landmarks: header, main, nav.
- Headings: h1 "השביל שלך".
- Path tile: `role="img"` with the summary label "14 אבנים, 4 נספרו. מפגשי לייב ביום 7 וביום 14". Every cup and stone is `aria-hidden`. If stones become tappable (to reopen a past day), replace the image with an `<ol>` of 14 links: "יום 3, נספר", "יום 4, היום", "יום 7, לייב, עוד לא נפתח"… 44×44 each, plus `aria-current="date"` on today.
- Legend: plain text spans; the mini cup and stone icons are `aria-hidden`.
- Focus order: motion → (stones, if interactive) → tab bar.

## AppLocked
- Landmarks: header, main, nav (current tab: השביל).
- Headings: h1 "יום 5 נפתח מחר בבוקר"; the two small tiles get h2 ("יום 4 עדיין פתוח", "אפשר לצפות שוב בסרטונים של ימים קודמים").
- Names: the lock and empty cup illustration are `aria-hidden` (the h1 says it). Links "חזרה להיום" and "לימים שעברו" are 44px+ (the "לימים שעברו" text link needs `min-height: 44px` in code).
- Unlock time `[UNLOCK_HOUR]` is a real `<time>` element.
- Note: the footer tile still mentions "השרת"; rephrase in the stage-3 copy pass.

## AppLive
- Landmarks: header, main, nav.
- Headings: h1 "חצי הדרך, יחד עם אביטל"; h2 for "מפגש הסיום" and "ההקלטה תעלה לכאן".
- The disabled join button uses `aria-disabled="true"` (keep it focusable so its text can be read) instead of `disabled`, and adds `aria-describedby` that points to "הקישור מוצג רק…". When it becomes active, announce politely: "הקישור למפגש פתוח".
- "להוסיף ליומן" downloads an .ics file; name it "להוסיף את המפגש ביום 7 ליומן".
- The pulse dot in the chip runs twice (under 5s) and then stays still.
- Times are `<time datetime>`.

## AppReminders
- Landmarks: header, main, nav.
- Headings: h1 "תזכורת של בוקר".
- Switch: `<button role="switch" aria-checked="true">` with the accessible name "התראה בטלפון" (via `aria-labelledby` to the row title, and `aria-describedby` to its subtitle). The hit area is 60×44. The OFF state is drawn as an outlined track with a #6B4B45 knob; ON is a forest track with a white knob and a check.
- Reminder time: a native `<input type="time">` (or `<select>`) with a visible label "שעת התזכורת", 44px+.
- The notification preview is `aria-hidden` or `role="img" aria-label="דוגמה להתראה: יום 5 נפתח…"`.
- When the user turns the switch on, the system permission prompt opens. Show the result in a polite `role="status"` ("ההתראות פעילות" / "ההתראות חסומות בהגדרות הטלפון").

## AppInstall
- Landmarks: header, main. Like the pre-login screens, no tab bar is needed if this screen is shown as an onboarding step. If it is shown inside the app, add the nav.
- Headings: h1 "צעד קטן ביום, על המסך שלך"; h2 "באייפון, בספארי" (currently `<b>`), h2 "באנדרואיד", h2 "למה זה חשוב".
- Steps are an `<ol>` and the numbers are decorative. The icon is `aria-hidden`; its wave runs twice, then stops.
- Buttons: "הוספתי, אפשר להתחיל" (54px) and "אחר כך" (44px).

## AppLogin (new, pre-login, no tab bar)
- Landmarks: header (logo, byline), main containing `<form aria-labelledby>` with a visually hidden h2 "פרטי כניסה".
- Headings: h1 "כניסה לאתגר" → h2 (hidden) "פרטי כניסה". The note tiles use `<b>` (or h2 "כניסה ראשונה?").
- Fields: "שם משתמש" (`autocomplete="username"`, `dir="ltr"`), "סיסמה" (`type="password"`, `autocomplete="current-password"`). Fields are 52px tall with a 2px #6B4B45 border; the username is drawn in the focused state.
- Show-password: `<button type="button" aria-label="הצגת הסיסמה" aria-pressed="false" aria-controls="pass">` 44×44 inside the field. When pressed: `aria-pressed="true"`, `type="text"`, and the icon changes to an eye with a slash. The label text stays.
- Submit "כניסה" (54px). If login fails, show one message above the button in `role="alert"`: "שם המשתמש או הסיסמה לא נכונים". It doesn't say which one. Move focus to the username field.
- Focus order: username → password → show-password → כניסה → שכחתי סיסמה → לפרטים על האתגר.
- Links "שכחתי סיסמה", "לפרטים על האתגר" are underlined, #8A4A33, 44px min height.

## AppActivate (new, from the one-time link)
- Landmarks: header, main with a form.
- Headings: h1 "בוחרים סיסמה ומתחילים"; h2 "הקישור כבר לא בתוקף" (expired state).
- Username: a read-only input (`readonly`, not `disabled`, so it can be focused and read) with `aria-describedby` that points to the hint "נקבע בהרשמה ולא ניתן לשינוי". The lock icon is `aria-hidden`.
- "בחירת סיסמה": `autocomplete="new-password"`, `aria-describedby="pw-req"`. The requirements are a `<ul aria-label="דרישות לסיסמה">` of text items. Each one has an icon (check or empty ring) plus visually hidden text (", בוצע" / ", עוד לא"). Update them live, but don't announce every keystroke. Announce only on blur or submit.
- "אימות הסיסמה": shown in the error state with `aria-invalid="true"` and `aria-describedby="newpw2-err"`. The error text has an icon: "הסיסמאות לא זהות. כדאי להקליד שוב."
- Both password fields have the 44×44 show-password toggle (drawn on the first one).
- Expired-link state: when the token is invalid or used, render it instead of the form, with focus on its h2. The button "שליחת קישור חדש" goes to the Forgot flow, prefilled.
- Focus order: username (read-only) → password → toggle → confirm → toggle → "שמירה וכניסה".

## AppForgot (new)
- Landmarks: header, main with a form.
- Headings: h1 "שכחתי סיסמה"; h2 "אם הפרטים נכונים, יגיע קישור" (confirmation state).
- One field, "שם משתמש, טלפון או מייל" (`autocomplete="username"`, `inputmode` stays text), with the hint "אותם פרטים שמסרתם בהרשמה".
- After submit, the same neutral confirmation is shown whether or not the account exists. It goes in `role="status"`, and focus moves to its heading. The "שליחה מחדש" link is rate-limited. While it is disabled, show a countdown as text, not color only.
- Focus order: field → שליחת קישור → חזרה לכניסה → (after sending) שליחה מחדש.

## AppStates (new · Today screen states)
- Each state tile has a text tag ("שגיאה", "אין חיבור", "טעינה", "הצלחה") for the design review only. The tags are not shipped.
- Error: the tile is `role="alert"` with an h2 "הסרטון לא נטען", an icon and text, and a 2px #8A4A33 border. The button "לנסות שוב" is 48px. After a retry, focus stays on the button.
- Offline: a persistent banner in `role="status"` (polite) "אין חיבור לאינטרנט…". Actions taken offline are queued, and the success toast says "יישמר כשהחיבור יחזור".
- Loading: the main region has `aria-busy="true"`, with one status text "טוענים את היום…". The skeleton blocks are `aria-hidden` and need no contrast. They don't shimmer when reduced motion is on.
- Success toast: `role="status"`, "נשמר. הכוס עלתה." with a "ביטול" button (44px). The toast stays at least 6s and doesn't vanish while focus or hover is inside it. It never takes focus.
- Tab bar stays available in all states.
