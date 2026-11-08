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
    },
  },
});
