# Legal review list: stage 10 (DRAFT)

**Status: DRAFT, pending review by a lawyer.** The texts of the accessibility statement, privacy policy and terms of use are in `src/content/legal.he.ts` (rendered at `/legal/accessibility`, `/legal/privacy`, `/legal/terms`). They were written from what the app does in the code (`src/db/schema.ts`, `src/config/constants.ts`, `src/lib/auth/config.ts`) and are not legal advice. There is no visible "draft" note for users (default decision; the owner can ask for one). Contact placeholders `[ACCESSIBILITY_CONTACT]`, `[PRIVACY_CONTACT]`, `[SUPPORT_CONTACT]` come from the env vars of the same names; when unset, users see a neutral line.

Clause ids below are the `id` of each section in `legal.he.ts` (also the `#anchor` on the page).

## Questions for the lawyer and the owner (open)

1. **Legal entity.** The texts say "YOGIT, אביטל פלס". Is there a registered business (name, number, address) that must appear as the database holder / service provider?
2. **Database registration and a privacy officer.** Under the Privacy Protection Law as amended (Amendment 13), does this database need registration, a DPO, or a notification to the Authority? (not in the user texts)
3. **Retention of accounts.** Accounts and progress are kept until the participant deletes the account; there is no automatic deletion after the challenge. The policy says exactly that. Decide a period (and then a cron job), or approve "until deleted".
4. **Transfers abroad.** Vercel, Bunny, GoHighLevel, push services act outside Israel; the database is in Frankfurt (Neon, aws-eu-central-1, from the project notes). Verify the regions actually used (Vercel function region is not pinned in the repo) and the legal basis for transfers (p-abroad).
5. **GoHighLevel is not part of account deletion.** Deleting an account removes the user row and everything that cascades from it. The contact in GoHighLevel is **not** touched: the owner must delete it there separately, on request (the privacy text and the deletion screens say so, and ask users to contact YOGIT). `src/lib/account/deletion-notice.ts` is a dry-run port for gate G3 (it logs only whether a GHL contact existed; it sends nothing and enqueues nothing in the outbox). Decide at G3 whether to automate (GHL API delete or tag).
6. **Bunny player cookies/storage.** The embedded player runs on its own domain and may store data in the browser. The privacy text says so generically. Verify what the player actually stores.
7. **Minimum age.** Not stated anywhere. Decide whether the terms need an age limit or guardian consent.
8. **Refunds and cancellation.** t-signup refers to the Consumer Protection Law and to the information shown at registration; no specific refund policy is written. The payment page (Morning) must carry the real terms.
9. **Access duration.** t-ip grants a licence "to take part in the challenge" without a period; how long participants keep access after day 14 is a business decision that is not in the code.
10. **Limitation of liability, governing law and venue.** Drafted generally (Israeli law, competent courts, no exclusive city). Confirm wording, enforceability against consumers, and whether to name a district.
11. **Accessibility statement.** Confirm it satisfies the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations: coordinator details (name, phone, email; now one `[ACCESSIBILITY_CONTACT]`), date of last check, who performed it (the text says: automated axe checks and manual keyboard/zoom/mobile checks, no external expert yet), the commitment on Hebrew captions for videos (stated as a known limitation, not yet done), and whether an external audit is required for a service of this size.
12. **Cookies.** The text says there is one essential session cookie (`__Host-tsaad_session`, HttpOnly, Secure, SameSite=Lax; `tsaad_session` on local http) and local storage only for the "pause animation" preference. Confirm no consent banner is needed.
13. **Gender-neutral voice.** The texts address readers in the plural ("אפשר", "הזכויות שלכם") and use the feminine plural for "we" (YOGIT and Avital). Check tone.

## Clauses

### Accessibility statement (`/legal/accessibility`)
| id | Subject | For the lawyer |
|---|---|---|
| a-standard | Law and standard: Equal Rights for Persons with Disabilities Law 1998, Service Accessibility Adjustments Regulations 2013, IS 5568 (WCAG 2.0 AA); built to WCAG 2.1 AA | Citations correct? |
| a-done | List of what was made accessible | Every item is covered by an axe e2e run or a code rule (`docs/design/a11y-notes.md`) |
| a-method | How it was checked; no external expert yet | Is that disclosure enough? |
| a-limits | Known limits: Hebrew captions for the videos not yet added; third-party video player; Zoom and payment page; push depends on the device | Captions are required for videos; deadline? |
| a-date | Date of last check: 2026-11-10 (`LEGAL.accessibilityLastChecked`) | Update on every re-check |
| a-contact | `[ACCESSIBILITY_CONTACT]` | Coordinator details required by the regulations |

### Privacy policy (`/legal/privacy`)
| id | Subject | Source in code |
|---|---|---|
| p-who | Who is responsible; `[PRIVACY_CONTACT]` | open question 1 |
| p-data | Data stored: username, display name, email, phone, GHL contact id, password hash (argon2id), sessions (hashed token, created/expires/last seen), activation and reset tokens (hash only), action completions, push subscriptions (endpoint and keys), reminder log, hashed identifier/IP for rate limits, sync outbox (PII-free tracker payload), host request logs | `schema.ts`, `sync/payload.ts` |
| p-not | No medical/health data, no ads or tracking tools, no payment data | no analytics dependency in `package.json` |
| p-purpose | Purposes; supplying data is not required by law but needed for an account | Law section on notice |
| p-processors | Vercel, Neon (Frankfurt, aws-eu-central-1), Bunny, GoHighLevel, web push services (Google, Apple, Mozilla, Microsoft), Morning (payment, external), Zoom-type service for live | `push/endpoints.ts`, `bunny/token.ts` |
| p-abroad | Transfer outside Israel | open question 4 |
| p-retention | Retention numbers (filled from code): session 30 days absolute / 14 idle, activation tokens 7 days after expiry or use, rate-limit attempts 1 day, webhook ids 30, sync sent 14, sync dead 90, reminder log 90; account and progress until deletion | `RETENTION`, `SESSION_POLICY`, `purgeExpired` (7 days and 1 day are in SQL) |
| p-cookies | One session cookie; local storage for pause-animation; service worker caches static files only; Bunny player note | `auth/cookies.ts`, `MotionToggle.tsx`, `public/sw.js` |
| p-rights | Access, correction, deletion (in app at `/account`, password required); push off; complaint to the Privacy Protection Authority | `account/delete.ts` |
| p-delete | What deletion removes; GHL contact remains until YOGIT deletes it | open question 5 |
| p-security | Reasonable measures, no absolute guarantee | |
| p-changes | Updates | |

### Terms of use (`/legal/terms`)
| id | Subject | For the lawyer |
|---|---|---|
| t-service | What the service is (14 days, videos, marking, two lives, reminders) | |
| t-signup | 79 ₪ one-time, not a subscription, paid outside the app; day-14 offers are separate purchases; refunds per law | open question 8 |
| t-health | No medical advice; consult a doctor or professional; participation is each person's responsibility (no health claims) | Wording of the safety disclaimer |
| t-account | Personal account, accurate details, secrecy of credentials | |
| t-use | Personal use only; no sharing, copying, recording, circumventing day unlock, abuse | |
| t-availability | As is, no guarantee of availability; days open at 05:00 Israel time | |
| t-ip | IP belongs to YOGIT and Avital Pelles; personal licence for the challenge | open question 9 |
| t-liability | Limitation of liability (draft) | open question 10 |
| t-suspend | Suspension for misuse | |
| t-privacy | Points to the privacy policy | |
| t-changes | Changes to terms | Is continued use consent enough? |
| t-law | Israeli law, competent courts | open question 10 |
| t-contact | `[SUPPORT_CONTACT]` | |

### Account deletion screens (`copy.account`, not in `legal.he.ts`)
"What is deleted" list and "contact details also stay in YOGIT's registration system" line (screens `/account` and `/account/deleted`). Same open question 5.
