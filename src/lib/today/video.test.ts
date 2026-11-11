// @vitest-environment node
import { describe, expect, it } from "vitest";
import { makeSchedule } from "@/lib/days";
import { getVideoConfig, hasVideo, posterUrl, videoFor } from "./video";

const s = makeSchedule("2026-12-01");
const now = new Date("2026-12-04T14:00:00+02:00");
const env = { BUNNY_LIBRARY_ID: "lib1", BUNNY_TOKEN_KEY: "key", BUNNY_VIDEO_IDS: "a1,,c3,d4" } as never;

describe("poster url", () => {
  const cfg = getVideoConfig(env);
  it("is built from the configured host and the day's video id only", () => {
    expect(posterUrl(4, cfg, "vz-abc.b-cdn.net")).toBe("https://vz-abc.b-cdn.net/d4/thumbnail.jpg");
  });
  it("is null without a host, without an id for that day, or without a library", () => {
    expect(posterUrl(4, cfg, undefined)).toBeNull();
    expect(posterUrl(2, cfg, "vz-abc.b-cdn.net")).toBeNull();
    expect(posterUrl(4, getVideoConfig({} as never), "vz-abc.b-cdn.net")).toBeNull();
  });
});

describe("video issuance", () => {
  const cfg = getVideoConfig(env);
  it("issues a signed iframe url only for an unlocked day with a configured id", () => {
    const r = videoFor(4, now, s, cfg);
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.url).toMatch(/^https:\/\/iframe\.mediadelivery\.net\/embed\/lib1\/d4\?token=[0-9a-f]{64}&expires=\d+$/);
    expect(videoFor(1, now, s, cfg).status).toBe("ok");
  });
  it("refuses locked days without revealing anything", () => {
    expect(videoFor(5, now, s, cfg)).toEqual({ status: "locked" });
    expect(videoFor(14, now, s, cfg)).toEqual({ status: "locked" });
    expect(videoFor(1, new Date("2026-11-30T12:00:00+02:00"), s, cfg)).toEqual({ status: "locked" });
    expect(videoFor(1, now, null, cfg)).toEqual({ status: "locked" });
  });
  it("is unavailable when no id or library is configured (no invented ids)", () => {
    expect(videoFor(2, now, s, cfg)).toEqual({ status: "unavailable" });
    expect(videoFor(4, now, s, getVideoConfig({} as never))).toEqual({ status: "unavailable" });
    expect(hasVideo(2, cfg)).toBe(false);
    expect(hasVideo(3, cfg)).toBe(true);
  });
  it("rejects bad day values", () => {
    for (const d of [0, 15, 1.5, NaN, "4", null]) expect(videoFor(d, now, s, cfg)).toEqual({ status: "invalid" });
  });
  it("takes a day's id from days.ts, and BUNNY_VIDEO_IDS overrides it for the same day", () => {
    const days = Array.from({ length: 14 }, (_, i) => ({ videoId: i === 1 ? "fromFile2" : i === 2 ? "fromFile3" : undefined }));
    const c = getVideoConfig({ BUNNY_LIBRARY_ID: "lib1", BUNNY_TOKEN_KEY: "key", BUNNY_VIDEO_IDS: "a1,,envOverride3" } as never, days);
    expect(c?.ids[0]).toBe("a1");
    expect(c?.ids[1]).toBe("fromFile2"); // empty env slot falls back to the file
    expect(c?.ids[2]).toBe("envOverride3"); // env wins over the file
    expect(c?.ids[3]).toBeUndefined();
    expect(hasVideo(2, c)).toBe(true);
    expect(hasVideo(4, c)).toBe(false);
    // no env at all: days.ts alone
    const onlyFile = getVideoConfig({ BUNNY_LIBRARY_ID: "lib1", BUNNY_TOKEN_KEY: "key" } as never, days);
    expect(onlyFile?.ids[1]).toBe("fromFile2");
  });
});
