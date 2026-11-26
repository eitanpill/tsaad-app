import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COMMUNITY_GROUP_URL } from "../src/content/social";
import { axe, createUser, expectReflowAndTargets, open, SHOTS, T, type Session } from "./helpers";

/** כפתור ההצטרפות לקבוצת הווטסאפ: מוצג לכל משתתף רשום, לפני ההתחלה, בזמן האתגר ואחריו. */

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "group");
});

const MOMENTS = [
  ["before", "2026-11-28T12:00:00+02:00"],
  ["day4", T.day4Noon],
  ["ended", T.afterEnd],
] as const;

for (const [name, now] of MOMENTS) {
  for (const width of [390, 320]) {
    test(`group button: ${name} at ${width}px`, async ({ browser }) => {
      const { ctx, page } = await open(browser, s, now, "/today", { width });
      const link = page.getByRole("link", { name: /להצטרפות לקבוצת האתגר בווטסאפ/ });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", COMMUNITY_GROUP_URL);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAccessibleName(/בחלון חדש/);
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      // visible keyboard focus
      await link.focus();
      const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline).not.toBe("none");
      await axe(page);
      await expectReflowAndTargets(page);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await link.blur();
        await page.screenshot({ path: `${SHOTS}/group-${name}-${width}.png`, fullPage: false });
        await page.getByTestId("group-join").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/group-${name}-${width}-full.png`, fullPage: true });
      }
      await ctx.close();
    });
  }
}
