import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { verifySession } from "@/lib/auth/dal";
import { buildIcs } from "@/lib/live/ics";
import { getLiveInputs } from "@/lib/live/config";
import { LIVE_DAYS, liveSession, type LiveDay } from "@/lib/live/model";
import { serverNow } from "@/lib/today/clock";
import { getSchedule } from "@/lib/today/schedule";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/live/[day]/ics: קובץ יומן למפגש של יום 7 או 14, למשתמש מחובר בלבד.
 * נוצר רק כשהתאריך (START_DATE) והשעה (LIVE_TIME_DAYn) ידועים; אחרת 404 (אין ערך מומצא).
 * הקישור למפגש אינו נכלל בקובץ: הוא מוצג באפליקציה רק בחלון שלו (שעה לפני).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ day: string }> }) {
  if (!(await verifySession())) return Response.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  const raw = (await ctx.params).day;
  const day = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
  if (!(LIVE_DAYS as readonly number[]).includes(day)) {
    return Response.json({ error: "invalid" }, { status: 404, headers: NO_STORE });
  }
  const now = await serverNow();
  const live = liveSession(day as LiveDay, now, getSchedule(), getLiveInputs()[day as LiveDay]);
  if (!live.startsAt) return Response.json({ error: "unavailable" }, { status: 404, headers: NO_STORE });

  const cfg = getConfig();
  const origin = cfg.env.APP_ORIGIN;
  const host = origin ? new URL(origin).host : "localhost";
  const g = day === 7 ? copy.live.day7 : copy.live.day14;
  const body = buildIcs({
    uid: `live-day${day}@${host}`,
    startsAt: live.startsAt,
    summary: `${copy.brand.name}: ${g.title}`,
    description: copy.live.linkOpensLater,
    url: origin ? `${origin}/live` : undefined,
    stamp: now,
  });
  return new Response(body, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tsaad-live-day${day}.ics"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
