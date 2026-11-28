import "server-only";
import { getConfig } from "@/config";
import { buildBunnyCdnUrl } from "@/lib/bunny/cdn-token";
import type { Schedule } from "@/lib/days";
import { isDayUnlocked } from "@/lib/days";

/** הקלטות המדיטציה: קובץ שמע לכל יום ב־Pull Zone של Bunny (BUNNY_AUDIO_HOST + BUNNY_AUDIO_FILES). */
export type AudioConfig = { host: string; files: readonly (string | undefined)[]; tokenKey?: string };

const FILE_RE = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;
const validFile = (f: string | undefined): f is string => !!f && FILE_RE.test(f) && !f.includes("..");

export function getAudioConfig(env = getConfig().env): AudioConfig | null {
  if (!env.BUNNY_AUDIO_HOST) return null;
  const files = Array.from({ length: 14 }, (_, i) => (env.BUNNY_AUDIO_FILES ?? "").split(",")[i]?.trim() || undefined);
  return { host: env.BUNNY_AUDIO_HOST, files, tokenKey: env.BUNNY_AUDIO_TOKEN_KEY };
}

/** האם הוגדרה הקלטה ליום (בלי לחשוף את הכתובת). */
export function hasAudio(day: number, cfg: AudioConfig | null = getAudioConfig()): boolean {
  return !!cfg && validFile(cfg.files[day - 1]);
}

export type AudioResult = { status: "ok"; url: string } | { status: "unavailable" } | { status: "locked" } | { status: "invalid" };

/** כתובת הקובץ (חתומה כשיש מפתח), רק ליום שנפתח לפי שעון השרת, ורק אם הוגדרה לו הקלטה. */
export function audioFor(dayParam: unknown, now: Date, schedule: Schedule | null, cfg: AudioConfig | null): AudioResult {
  if (typeof dayParam !== "number" || !Number.isInteger(dayParam) || dayParam < 1 || dayParam > 14) return { status: "invalid" };
  if (!schedule || !isDayUnlocked(dayParam, now, schedule)) return { status: "locked" };
  const file = cfg?.files[dayParam - 1];
  if (!cfg || !validFile(file)) return { status: "unavailable" };
  return { status: "ok", url: buildBunnyCdnUrl({ host: cfg.host, file, tokenKey: cfg.tokenKey, now }) };
}
