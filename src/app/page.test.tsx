// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/dal", () => ({ verifySession: verify }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import Home from "./page";

describe("root redirect", () => {
  beforeEach(() => verify.mockReset());
  it("sends a signed-in user to /today", async () => {
    verify.mockResolvedValue({ userId: "u", username: "a", displayName: "a" });
    await expect(Home()).rejects.toThrow("REDIRECT:/today");
  });
  it("sends everyone else to /login", async () => {
    verify.mockResolvedValue(null);
    await expect(Home()).rejects.toThrow("REDIRECT:/login");
  });
});
