import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * בדיקות דפדפן (Playwright + axe) מול build מקומי ומסד זמני.
 * הרצה: npm run test:e2e   (מרים מסד זמני דרך scripts/test-db.sh, ובונה ומריץ את האפליקציה).
 * דפדפן: משתמשים ב־Chromium שכבר מותקן (PLAYWRIGHT_BROWSERS_PATH); לא מריצים `playwright install`.
 */
const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: ORIGIN, trace: "off", locale: "he-IL" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `${ORIGIN}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      APP_ORIGIN: ORIGIN,
      // סוד חד־פעמי לריצה הזאת בלבד; לא נשמר בשום מקום.
      SESSION_SECRET: randomBytes(32).toString("hex"),
      ACTIVATION_LINK_TTL_MINUTES: "30",
      // Test-only values (fake; nothing real). The test clock is honoured only because of these two
      // together (see src/lib/today/test-clock.ts); a real deployment can never satisfy both.
      TSAAD_E2E: "1",
      TSAAD_TEST_NOW: "2026-12-04T14:00:00+02:00",
      START_DATE: "2026-12-01",
      BUNNY_LIBRARY_ID: "e2e-library",
      BUNNY_TOKEN_KEY: "e2e-not-a-real-key",
      BUNNY_VIDEO_IDS: "e2evid1,e2evid2,e2evid3,e2evid4",
    },
  },
});
