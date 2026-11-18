import { expect, test, type Page } from "@playwright/test";
import { axe, createUser, expectReflowAndTargets, open, type Session } from "./helpers";

/**
 * Avital photo slots. Server A leaves them off (no photo files yet): the no-photo design, with nothing broken or empty.
 * Server B turns them on with generated placeholder images (TSAAD_E2E_PHOTOS, public/avital/e2e-*.png, git-ignored).
 */
const A = "http://localhost:3100";
const B = "http://localhost:3101";
const ALT_ABOUT = "אביטל פלס מתרגלת יוגה";
const ALT_LIVE = "אביטל פלס, מורת היוגה";
const EARLY = "2026-11-25T12:00:00+02:00"; // before start: the opening-live card shows on /today
const LIVE_DAY = "2026-12-07T10:00:00+02:00";

async function imageLoaded(page: Page, alt: string) {
  const img = page.getByRole("img", { name: alt });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  return img;
}

test.describe("slots off (server A)", () => {
  test.use({ baseURL: A });

  test("landing: no photo element, no broken image, no empty box; the about tile is as before", async ({ page }) => {
    await page.goto("/tsaad");
    await expect(page.locator(".av-photo")).toHaveCount(0);
    await expect(page.getByRole("img", { name: ALT_ABOUT })).toHaveCount(0);
    const tile = page.locator("section[aria-labelledby=land-av-h]");
    await expect(tile.getByRole("heading", { level: 2 })).toHaveText("אביטל פלס");
    await expect(tile.locator("> *")).toHaveCount(3); // heading + two paragraphs only
    expect(await page.locator("img").count()).toBe(0);
    await axe(page);
  });

  test("/live and the opening-live card: no photo", async ({ browser }) => {
    const s = await createUser(browser, "photoa");
    const { ctx, page } = await open(browser, s, LIVE_DAY, "/live");
    await expect(page.locator(".av-photo, .av-head")).toHaveCount(0);
    await ctx.close();
    const b = await open(browser, s, EARLY, "/today");
    await expect(b.page.locator(".av-photo, .av-head")).toHaveCount(0);
    await expect(b.page.getByTestId("opening-live").locator("> span.lv-tag")).toHaveCount(1);
    await b.ctx.close();
  });
});

test.describe("slots on (server B, fixture images)", () => {
  test.use({ baseURL: B });
  let s: Session;
  test.beforeAll(async ({ browser }) => {
    s = await createUser(browser, "photob");
  });

  test("landing: the photo sits in the about tile, with alt, reserved box, no horizontal overflow, axe clean", async ({ page }) => {
    await page.goto("/tsaad");
    const img = await imageLoaded(page, ALT_ABOUT);
    const tile = page.locator("section[aria-labelledby=land-av-h]");
    await expect(tile.locator(".av-photo")).toHaveCount(1);
    const box = await tile.locator(".av-photo").boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(4 / 5, 1);
    // local file only (through the Next image route, same origin)
    expect(await img.getAttribute("src")).toMatch(/^\/_next\/image\?url=%2Favital%2F/);
    await expectReflowAndTargets(page);
    await axe(page);
  });

  test("/live: round photo next to the tag, axe clean", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, LIVE_DAY, "/live");
    await imageLoaded(page, ALT_LIVE);
    await expect(page.locator(".t-live-hero .av-head .av-photo--round")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectReflowAndTargets(page);
    await axe(page);
    await ctx.close();
  });

  test("before start: the opening-live card carries the photo", async ({ browser }) => {
    const { ctx, page } = await open(browser, s, EARLY, "/today");
    await imageLoaded(page, ALT_LIVE);
    await expect(page.getByTestId("opening-live").locator(".av-photo")).toHaveCount(1);
    await expectReflowAndTargets(page);
    await axe(page);
    await ctx.close();
  });
});
