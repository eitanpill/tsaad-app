import "server-only";
import { getConfig } from "@/config";
import { DAYS } from "@/content/days";
import { buildBunnyEmbedUrl } from "@/lib/bunny/token";
import type { Schedule } from "@/lib/days";
import { isDayUnlocked } from "@/lib/days";

export type VideoConfig = { libraryId: string; tokenKey: string; ids: readonly (string | undefined)[] };

export function getVideoConfig(
  env = getConfig().env,
  days: readonly { videoId?: string }[] = DAYS,
): VideoConfig | null {
  if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_TOKEN_KEY) return null;
  // המשתנה BUNNY_VIDEO_IDS גובר על days.ts ליום שהוגדר בו; יום שנשאר ריק בו מקבל את videoId מ־src/content/days.ts.
  const fromEnv = (env.BUNNY_VIDEO_IDS ?? "").split(",").map((s) => s.trim() || undefined);
  const ids = days.map((d, i) => fromEnv[i] ?? d.videoId);
  return { libraryId: env.BUNNY_LIBRARY_ID, tokenKey: env.BUNNY_TOKEN_KEY, ids };
}

/** האם יש סרטון מוגדר ליום (בלי לחשוף את המזהה). */
export function hasVideo(day: number, cfg: VideoConfig | null = getVideoConfig()): boolean {
  return !!cfg?.ids[day - 1];
}

export type VideoResult =
  | { status: "ok"; url: string }
  | { status: "unavailable" }
  | { status: "locked" }
  | { status: "invalid" };

/** כתובת הטמעה חתומה, רק ליום שנפתח לפי שעון השרת, ורק אם הוגדר לו סרטון. */
export function videoFor(
  dayParam: unknown,
  now: Date,
  schedule: Schedule | null,
  cfg: VideoConfig | null,
): VideoResult {
  if (typeof dayParam !== "number" || !Number.isInteger(dayParam) || dayParam < 1 || dayParam > 14) {
    return { status: "invalid" };
  }
  if (!schedule || !isDayUnlocked(dayParam, now, schedule)) return { status: "locked" };
  const id = cfg?.ids[dayParam - 1];
  if (!cfg || !id) return { status: "unavailable" };
  const { url } = buildBunnyEmbedUrl({ libraryId: cfg.libraryId, videoId: id, tokenKey: cfg.tokenKey, now });
  return { status: "ok", url };
}
