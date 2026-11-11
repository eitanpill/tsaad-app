import { describe, expect, it } from "vitest";
import { isAdminPath, SESSION_COOKIE_NAMES } from "./admin-path";
import { sessionCookieName } from "@/lib/auth/config";

describe("admin paths", () => {
  it("matches /admin and below only", () => {
    for (const p of ["/admin", "/admin/", "/admin/stats", "/admin/x/y"]) expect(isAdminPath(p), p).toBe(true);
    for (const p of ["/", "/administrator", "/adminx/stats", "/today", "/api/admin"]) expect(isAdminPath(p), p).toBe(false);
  });
  it("knows both session cookie names", () => {
    expect(SESSION_COOKIE_NAMES).toContain(sessionCookieName({ NODE_ENV: "production" }));
    expect(SESSION_COOKIE_NAMES).toContain(sessionCookieName({ NODE_ENV: "development", APP_ORIGIN: "http://localhost:3000" }));
  });
});
