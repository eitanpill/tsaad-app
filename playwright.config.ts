import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * בדיקות דפדפן (Playwright + axe) מול build מקומי ומסד זמני.
 * הרצה: npm run test:e2e   (מרים מסד זמני דרך scripts/test-db.sh, ובונה ומריץ את האפליקציה).
 * דפדפן: משתמשים ב־Chromium שכבר מותקן (PLAYWRIGHT_BROWSERS_PATH); לא מריצים `playwright install`.
 */
const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;
// Per-run key for the test-clock header (src/lib/today/test-clock.ts). Set once in the runner process so the
// worker processes (which inherit the env and re-read this file) and the web server share the same value.
process.env.TSAAD_TEST_CLOCK_KEY ??= randomBytes(32).toString("hex");

// GHL signup webhook (stage 9א): a per-run fake secret, and a file where the e2e-only capture delivery (guarded like the
// test clock, see src/lib/webhooks/ghl/delivery.ts) writes the activation link, since real sending is off.
process.env.GHL_WEBHOOK_SECRET ??= randomBytes(32).toString("hex");
process.env.TSAAD_WEBHOOK_CAPTURE_FILE ??= join(mkdtempSync(join(tmpdir(), "tsaad-webhook-")), "capture.jsonl");

// Ephemeral VAPID public key for the reminders screen (a fresh P-256 point per run; the private half is never kept).
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const E2E_VAPID_PUBLIC_KEY = ecdh.getPublicKey().toString("base64url");

const PORT_B = 3101;
export const ORIGIN_B = `http://localhost:${PORT_B}`;
const APP_ENV = {
  // סוד חד־פעמי לריצה הזאת בלבד; לא נשמר בשום מקום.
  SESSION_SECRET: randomBytes(32).toString("hex"),
  ACTIVATION_LINK_TTL_MINUTES: "30",
  TSAAD_E2E: "1",
  TSAAD_TEST_NOW: "2026-12-04T14:00:00+02:00",
  TSAAD_TEST_CLOCK_KEY: process.env.TSAAD_TEST_CLOCK_KEY,
  GHL_WEBHOOK_SECRET: process.env.GHL_WEBHOOK_SECRET,
  TSAAD_WEBHOOK_CAPTURE_FILE: process.env.TSAAD_WEBHOOK_CAPTURE_FILE,
  START_DATE: "2026-12-01",
  BUNNY_LIBRARY_ID: "e2e-library",
  BUNNY_TOKEN_KEY: "e2e-not-a-real-key",
  BUNNY_VIDEO_IDS: "e2evid1,e2evid2,e2evid3,e2evid4",
  LIVE_TIME_DAY7: "20:00",
  LIVE_URL_DAY7: "https://live.example.test/e2e-room-day7",
  VAPID_PUBLIC_KEY: E2E_VAPID_PUBLIC_KEY,
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: ORIGIN, trace: "off", locale: "he-IL" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A: the default environment (day 14 live time, offer window, payment links and contacts all unset: placeholder states).
  // B: the same build, started again with the offer and contacts configured (fake values on reserved .test domains).
  // Playwright starts them in order, so B's `next start` finds the build A just made.
  webServer: [
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: `${ORIGIN}/login`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: { ...APP_ENV, APP_ORIGIN: ORIGIN },
    },
    {
      command: `npx next start -p ${PORT_B}`,
      url: `${ORIGIN_B}/login`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...APP_ENV,
        APP_ORIGIN: ORIGIN_B,
        LIVE_TIME_DAY14: "20:00",
        OFFER_WINDOW_HOURS: "48",
        SESSION_SPOTS: "5",
        MORNING_URL_CHALLENGE_79: "https://pay.example.test/challenge79",
        MORNING_URL_SESSION_271: "https://pay.example.test/session271?ref=app",
        MORNING_URL_YESODOT_1265: "https://pay.example.test/yesodot1265",
        // bundle link deliberately unset: one disabled button next to enabled ones
        OFFER_UTM_SESSION: "session271",
        OFFER_UTM_YESODOT: "yesodot1265",
        YESODOT_OFFER_EXPIRY: "2026-12-20",
        ACCESSIBILITY_CONTACT: "access@example.test",
        PRIVACY_CONTACT: "privacy@example.test",
        SUPPORT_CONTACT: "050-123-4567",
      },
    },
  ],
});
