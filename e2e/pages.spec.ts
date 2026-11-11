import { expect, test } from "@playwright/test";
import { T, axe, clock, createUser, expectReflowAndTargets, open, overflowingElements, pool, shot } from "./helpers";

/**
 * Stage 10 on server A (offer window, payment links and contacts unset): the landing page, legal pages, health, robots,
 * the offer and Yesodot in their placeholder states, and account deletion.
 */
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const RAW = /\[[A-Z_*0-9]+\]/;

test.describe("landing /tsaad (public)", () => {
  test("renders without login: heading, disabled CTA with the reason, neutral start line, no raw placeholders, axe", async ({ page }) => {
    await page.goto("/tsaad");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("צעד קטן ביום");
    const cta = page.getByRole("button", { name: "אני בפנים, להרשמה לאתגר" }).first();
    await expect(page.locator("button.cta--off").first()).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#cta-note-hero")).toHaveText("ההרשמה תיפתח כאן.");
    expect(await cta.count()).toBe(0); // the disabled button's visible name is the label; it is not the link
    await expect(page.getByText("ההרשמה לאתגר היא 79 ₪. זה לא מנוי.").first()).toBeVisible();
    await expect(page.getByText("תאריך ההתחלה יפורסם בקרוב.")).toHaveCount(0); // START_DATE is set on this server
    await expect(page.getByText("האתגר מתחיל ב־1 בדצמבר.")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(RAW);
    // day 14 live time unset: the neutral line replaces the placeholder
    await expect(page.getByText("יום 14: השעה תפורסם בקרוב.")).toBeVisible();
    await expect(page.getByText("יום 7: ", { exact: false })).toContainText("20:00");
    await shot(page, "landing");
    await axe(page);
  });

  test("SEO: title, description, canonical, Open Graph, robots allow; robots.txt", async ({ page, request }) => {
    await page.goto("/tsaad");
    await expect(page).toHaveTitle("צעד קטן ביום: 14 ימים של הרגל, תנועה ומדיטציה | YOGIT");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /79 ₪/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/tsaad$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "he_IL");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "").not.toContain("noindex");
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt).toContain("Allow: /tsaad");
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain("Disallow: /today");
  });

  test("320px reflow, 44px targets, focus order starts at the skip link, FAQ opens by keyboard", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto("/tsaad");
    await expectReflowAndTargets(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "דילוג לתוכן" })).toBeFocused();
    const summary = page.locator("summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details").first()).toHaveAttribute("open", "");
    await axe(page);
    await ctx.close();
  });

  test("200% browser zoom at 390px (CSS viewport 195px, DPR 2): no horizontal scroll, heading and CTA stay in view", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 195, height: 422 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto("/tsaad");
    expect(await overflowingElements(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const loc of [page.getByRole("heading", { level: 1 }), page.locator("button.cta--off").first()]) {
      const box = (await loc.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(195.5);
    }
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/landing-zoom200-390.png`, fullPage: true });
    await ctx.close();
  });

  test("keyboard order: skip link, pause animation, CTA (focusable while disabled), login", async ({ page }) => {
    await page.goto("/tsaad");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "דילוג לתוכן" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "עצירת אנימציה" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("button.cta--off").first()).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe("solid");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "כניסה", exact: true })).toBeFocused();
  });

  test("reduced motion: the water and the glow do not animate", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/tsaad");
    const names = await page.locator(".pub-wv, .pub-glow, .pub-ring").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toBe("none");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await ctx.close();
  });

  test("the motion button pauses the water (data-motion=off)", async ({ page }) => {
    await page.goto("/tsaad");
    await page.getByRole("button", { name: "עצירת אנימציה" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  });

  test("login stays reachable from the landing page, and the footer links to the legal pages", async ({ page }) => {
    await page.goto("/tsaad");
    await page.getByRole("link", { name: "כניסה", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/tsaad");
    for (const [name, url] of [["הצהרת נגישות", "/legal/accessibility"], ["מדיניות פרטיות", "/legal/privacy"], ["תנאי שימוש", "/legal/terms"]] as const) {
      await expect(page.getByRole("contentinfo").getByRole("link", { name })).toHaveAttribute("href", url);
    }
  });

  test("the pre-login screens link to the accessibility statement and privacy, without sending a Referer", async ({ page }) => {
    for (const path of ["/login", "/forgot"]) {
      await page.goto(path);
      const a = page.getByRole("contentinfo").getByRole("link", { name: "הצהרת נגישות" });
      await expect(a).toHaveAttribute("href", "/legal/accessibility");
      await expect(a).toHaveAttribute("referrerpolicy", "no-referrer");
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "מדיניות פרטיות" })).toBeVisible();
      await expectReflowAndTargets(page);
    }
  });

  test("root redirects a visitor to /tsaad and a signed-in user to /today", async ({ browser, page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/tsaad$/);
    const s = await createUser(browser, "root");
    const o = await open(browser, s, T.day4Noon, "/");
    await expect(o.page).toHaveURL(/\/today$/);
    await o.ctx.close();
  });
});

test.describe("legal pages (public)", () => {
  for (const [path, title, h2s] of [
    ["/legal/accessibility", "הצהרת נגישות", ["התקן והדין", "מה הונגש", "איך נבדקה הנגישות", "מגבלות ידועות", "תאריך הבדיקה האחרון"]],
    ["/legal/privacy", "מדיניות פרטיות", ["איזה מידע נשמר", "מי עוד מטפל במידע", "לכמה זמן שומרים", "עוגיות ואחסון בדפדפן", "הזכויות שלכם"]],
    ["/legal/terms", "תנאי שימוש", ["מה השירות", "הרשמה ותשלום", "אין כאן ייעוץ רפואי", "הגבלת אחריות", "דין וסמכות שיפוט"]],
  ] as const) {
    test(`${path}: one h1, ordered headings, TOC links, neutral contact line, no raw placeholders or tokens, axe, reflow`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      for (const h of h2s) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
      const levels = await page.locator("h1,h2,h3").evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
      for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
      const body = await page.locator("main").innerText();
      expect(body).not.toMatch(RAW);
      expect(body).not.toMatch(/\{\w+\}/);
      if (path !== "/legal/terms") expect(body).toContain("פרטי הקשר ייוספו כאן בקרוב.");
      // TOC jumps to a section
      const first = page.locator(".doc-toc a").nth(1);
      const href = await first.getAttribute("href");
      await first.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expectReflowAndTargets(page);
      await shot(page, path.replace("/legal/", "legal-"));
      await axe(page);
    });
  }

  test("privacy states the retention numbers from the code and the one-cookie fact", async ({ page }) => {
    await page.goto("/legal/privacy");
    const t = await page.locator("main").innerText();
    expect(t).toContain("עד 30 ימים מרגע הכניסה, או עד 14 ימים בלי שימוש");
    expect(t).toContain("יומן תזכורות: 90 ימים");
    expect(t).toContain("עוגייה אחת בלבד");
  });

  test("accessibility statement carries the last-check date and the known limitation about captions", async ({ page }) => {
    await page.goto("/legal/accessibility");
    const t = await page.locator("main").innerText();
    expect(t).toContain("10 בנובמבר 2026");
    expect(t).toContain("כתוביות בעברית");
  });

  test("the account-deleted page sends a signed-in visitor to /today (a link to it cannot drop a live user's push)", async ({ browser }) => {
    const s = await createUser(browser, "delpg");
    const o = await open(browser, s, T.day4Noon, "/account/deleted");
    await expect(o.page).toHaveURL(/\/today$/);
    await o.ctx.close();
  });

  test("the legal index and the account-deleted page pass axe", async ({ page }) => {
    await page.goto("/legal");
    await axe(page);
    await page.goto("/account/deleted");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("החשבון נמחק");
    await shot(page, "account-deleted");
    await axe(page);
  });
});

test("CSP: every script tag on the stage-10 pages carries this request's nonce (public and signed-in)", async ({ browser, request }) => {
  const check = async (get: (u: string) => ReturnType<typeof request.get>, url: string) => {
    const res = await get(url);
    expect(res.status(), url).toBe(200);
    const nonce = /'nonce-([^']+)'/.exec(res.headers()["content-security-policy"] ?? "")?.[1];
    expect(nonce, url).toBeTruthy();
    const scripts = (await res.text()).match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length, url).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag, `${url} ${tag}`).toContain(`nonce="${nonce}"`);
  };
  for (const url of ["/tsaad", "/legal", "/legal/accessibility", "/legal/privacy", "/legal/terms", "/account/deleted"]) await check((u) => request.get(u), url);
  const s = await createUser(browser, "csp10");
  const ctx = await browser.newContext({ storageState: s.storageState, extraHTTPHeaders: clock(T.day14Noon) });
  for (const url of ["/offer", "/yesodot", "/account"]) await check((u) => ctx.request.get(u), url);
  await ctx.close();
});

test.describe("health", () => {
  test("GET /api/health returns only ok and db, no-store", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ ok: true, db: true });
    expect(r.headers()["cache-control"]).toBe("no-store");
    expect(r.headers()["content-security-policy"]).toContain("default-src 'none'");
  });
});

test.describe("offer and Yesodot with nothing configured (server A)", () => {
  test("offer: not yet, no prices or links, axe", async ({ browser }) => {
    const s = await createUser(browser, "ofa");
    const { ctx, page } = await open(browser, s, T.day14Noon, "/offer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ההצעה תופיע כאן ביום 14");
    const html = await page.content();
    for (const x of ["271 ₪", "139 ₪", "1,265", "pay.example.test"]) expect(html).not.toContain(x);
    await shot(page, "offer-not-yet");
    await axe(page);
    await ctx.close();
  });

  test("yesodot: neutral expiry line, disabled CTA with the reason, no raw placeholder, axe", async ({ browser }) => {
    const s = await createUser(browser, "yea");
    const { ctx, page } = await open(browser, s, T.day4Noon, "/yesodot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("יסודות היוגה");
    await expect(page.getByText("1,265 ₪")).toBeVisible();
    await expect(page.getByText("תוקף המחיר יפורסם בקרוב.")).toBeVisible();
    const cta = page.getByRole("button", { name: "להרשמה ליסודות היוגה" });
    await expect(cta).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#yes-note")).toHaveText("הכפתור יהיה פעיל כשהקישור יהיה מוכן.");
    expect(await page.locator("main").innerText()).not.toMatch(RAW);
    await expectReflowAndTargets(page);
    await shot(page, "yesodot-unset");
    await axe(page);
    await ctx.close();
  });

  test("Today shows the small offer tile on day 14 and after the end, not before", async ({ browser }) => {
    const s = await createUser(browser, "oft");
    let o = await open(browser, s, T.day4Noon, "/today");
    await expect(o.page.getByRole("link", { name: "לצפייה בהצעות" })).toHaveCount(0);
    await o.ctx.close();
    o = await open(browser, s, T.day14Noon, "/today");
    const tile = o.page.locator(".t-entry");
    await expect(tile.getByRole("heading", { level: 2 })).toHaveText("ההצעה תופיע כאן ביום 14");
    await shot(o.page, "today-offer-entry");
    await axe(o.page);
    await tile.getByRole("link", { name: "לצפייה בהצעות" }).click();
    await expect(o.page).toHaveURL(/\/offer$/);
    await o.ctx.close();
    o = await open(browser, s, T.afterEnd, "/today");
    await expect(o.page.locator(".t-entry")).toBeVisible();
    await o.ctx.close();
  });

  test("offer and yesodot need a session", async ({ page }) => {
    await page.goto("/offer");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/yesodot");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("account deletion", () => {
  test("account page: details, legal links, footer entry points, axe", async ({ browser }) => {
    const s = await createUser(browser, "acc");
    const { ctx, page } = await open(browser, s, T.day4Noon, "/today");
    await page.getByRole("navigation", { name: "פרטיות ונגישות" }).getByRole("link", { name: "החשבון שלי" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("החשבון שלי");
    await expect(page.getByText(s.username)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "מחיקת חשבון" })).toBeVisible();
    await expectReflowAndTargets(page);
    await shot(page, "account");
    await axe(page);
    await ctx.close();
  });

  test("wrong password keeps the account; the right one deletes it, logs out, and login then fails", async ({ browser }) => {
    const s = await createUser(browser, "del");
    const { ctx, page } = await open(browser, s, T.day4Noon, "/account");
    const pw = page.getByLabel("סיסמה", { exact: true });
    const submit = page.getByRole("button", { name: "מחיקת החשבון" });

    await submit.click();
    await expect(page.locator("p.acc-error")).toHaveText("צריך להקליד את הסיסמה.");
    await expect(pw).toBeFocused();
    await axe(page);

    await pw.fill("wrong-pass-12");
    await submit.click();
    await expect(page.locator("p.acc-error")).toHaveText("הסיסמה לא נכונה. אפשר לנסות שוב.");
    await shot(page, "account-error");
    expect((await pool.query("select 1 from users where id = $1", [s.userId])).rowCount).toBe(1);

    await pw.fill("today-pass-12");
    await submit.click();
    await page.waitForURL("**/account/deleted");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("החשבון נמחק");
    expect((await pool.query("select 1 from users where id = $1", [s.userId])).rowCount).toBe(0);
    expect((await pool.query("select 1 from sessions where user_id = $1", [s.userId])).rowCount).toBe(0);

    await page.goto("/today");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("שם משתמש").fill(s.username);
    await page.getByLabel("סיסמה", { exact: true }).fill("today-pass-12");
    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await expect(page.getByText("שם המשתמש או הסיסמה לא נכונים.")).toBeVisible();
    await ctx.close();
  });
});

test("the clock helper is available", () => {
  expect(clock("x")["x-tsaad-test-now"]).toBe("x");
});
