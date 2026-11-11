import { expect, test } from "@playwright/test";
import { axe, clock } from "./helpers";

/**
 * D2: registration closes at the end of challenge day 2 (Israel time): START_DATE 2026-12-01, so day 3 opens at 05:00 on
 * 2026-12-03 (+02:00). Server A has no payment link and no next-cohort URL; server B has both.
 */
test.use({ viewport: { width: 390, height: 844 } });
const OPEN = "2026-12-03T04:59:00+02:00";
const CLOSED = "2026-12-03T05:00:00+02:00";

for (const [name, base] of [
  ["A", "http://localhost:3100"],
  ["B", "http://localhost:3101"],
] as const) {
  test.describe(`landing closing, server ${name}`, () => {
    const visit = async (browser: import("@playwright/test").Browser, now: string) => {
      const ctx = await browser.newContext({ baseURL: base, extraHTTPHeaders: clock(now), locale: "he-IL" });
      const page = await ctx.newPage();
      await page.goto("/tsaad");
      return { ctx, page };
    };

    test("one minute before day 3 the CTA is still there", async ({ browser }) => {
      const { ctx, page } = await visit(browser, OPEN);
      await expect(page.getByText("ההרשמה למחזור הזה נסגרה")).toHaveCount(0);
      await expect(page.locator(".cta").first()).toContainText("אני בפנים");
      await ctx.close();
    });

    test("from day 3 05:00 the CTA is replaced by the closed line; no price or start line; axe", async ({ browser }) => {
      const { ctx, page } = await visit(browser, CLOSED);
      await expect(page.getByText("ההרשמה למחזור הזה נסגרה").first()).toBeVisible();
      await expect(page.locator(".cta")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /אני בפנים/ })).toHaveCount(0);
      await expect(page.getByText("האתגר מתחיל ב־1 בדצמבר.")).toHaveCount(0);
      const next = page.getByRole("link", { name: "לעדכון על המחזור הבא" });
      if (name === "B") await expect(next).toHaveAttribute("href", "https://next.example.test/updates");
      else await expect(next).toHaveCount(0);
      await expect(page.getByRole("link", { name: "כניסה" }).first()).toBeVisible(); // existing participants can still log in
      await axe(page);
      await ctx.close();
    });
  });
}
