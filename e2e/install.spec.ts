import { expect, test } from "@playwright/test";
import { T, axe, createUser, expectReflowAndTargets, open, shot, type Session } from "./helpers";

let s: Session;
test.beforeAll(async ({ browser }) => {
  s = await createUser(browser, "inst");
});

test("content: iPhone steps, Android with conditional wording, the reminder reason, done and later; no bottom nav", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/install");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("צעד קטן ביום, על המסך שלך");
  await expect(page.getByRole("heading", { level: 2, name: "באייפון, בספארי" })).toBeVisible();
  const steps = page.getByRole("list", { name: "שלבי ההוספה למסך הבית" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("לוחצים על כפתור השיתוף");
  await expect(steps.nth(1)).toContainText("הוספה למסך הבית");
  await expect(steps.nth(2)).toContainText("פותחים מהאייקון החדש");
  await expect(page.getByRole("heading", { level: 2, name: "באנדרואיד" })).toBeVisible();
  await expect(page.locator(".t-in-android")).toContainText("אם מופיע כפתור");
  await expect(page.getByRole("heading", { level: 2, name: "בשביל התזכורת" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ניווט ראשי" })).toHaveCount(0);
  // the install button only exists if the browser offered installation
  await expect(page.getByRole("button", { name: "התקנה" })).toHaveCount(0);
  await expectReflowAndTargets(page);
  await axe(page);
  await shot(page, "install");
  await ctx.close();
});

test("the install button appears only after beforeinstallprompt fired, and calls the browser prompt", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/install");
  await expect(page.getByRole("button", { name: "התקנה" })).toHaveCount(0);
  await page.evaluate(() => {
    const e = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {
        (window as unknown as { __prompted: boolean }).__prompted = true;
      },
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(e);
  });
  const btn = page.getByRole("button", { name: "התקנה" });
  await expect(btn).toBeVisible();
  await axe(page);
  await shot(page, "install-android-button");
  await btn.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  await expect(btn).toHaveCount(0); // the event is single-use
  await ctx.close();
});

test("already installed (standalone): the steps are hidden and the page only leads back to Today", async ({ browser }) => {
  const standalone = () => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ ...orig(q), matches: true } as MediaQueryList) : orig(q));
  };
  const { ctx, page } = await open(browser, s, T.day4Noon, "/install", { init: standalone });
  await expect(page.getByText("האפליקציה כבר על המסך שלך.")).toBeVisible();
  await expect(page.getByRole("list", { name: "שלבי ההוספה למסך הבית" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "חזרה להיום" })).toHaveAttribute("href", "/today");
  await axe(page);
  await shot(page, "install-installed");
  await ctx.close();
});

test("'done' and 'later' just navigate to Today; 'later' keeps its longer accessible name", async ({ browser }) => {
  const a = await open(browser, s, T.day4Noon, "/install");
  await a.page.getByRole("link", { name: "הוספתי, אפשר להתחיל" }).click();
  await expect(a.page).toHaveURL(/\/today$/);
  await a.ctx.close();
  const b = await open(browser, s, T.day4Noon, "/install");
  const later = b.page.getByRole("link", { name: "להתקין אחר כך" });
  await expect(later).toHaveText("אחר כך");
  await later.click();
  await expect(b.page).toHaveURL(/\/today$/);
  await b.ctx.close();
});

test("320px reflow", async ({ browser }) => {
  const { ctx, page } = await open(browser, s, T.day4Noon, "/install", { width: 320 });
  await expectReflowAndTargets(page);
  await axe(page);
  await shot(page, "install-320");
  await ctx.close();
});
