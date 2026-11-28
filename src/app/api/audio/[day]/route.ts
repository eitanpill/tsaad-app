import { verifySession } from "@/lib/auth/dal";
import { getAppClock } from "@/lib/preview/context";
import { audioFor, getAudioConfig } from "@/lib/today/audio";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

/**
 * GET /api/audio/[day]: משתמש מחובר בלבד, ורק יום שהשרת פתח. מפנה (302) לקובץ השמע ב־Bunny.
 * תגית ה־<audio> מצביעה לכאן, כך שהכתובת (והחתימה) לא מופיעות ב־HTML ונוצרות מחדש בכל ניגון.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ day: string }> }) {
  if (!(await verifySession())) return json({ error: "unauthenticated" }, 401);
  const { day } = await ctx.params;
  const n = /^\d{1,2}$/.test(day) ? Number(day) : NaN;
  const clock = await getAppClock();
  const r = audioFor(n, clock.now, clock.schedule, getAudioConfig());
  switch (r.status) {
    case "ok":
      return new Response(null, { status: 302, headers: { ...NO_STORE, Location: r.url, "Referrer-Policy": "no-referrer" } });
    case "unavailable":
      return json({ error: "unavailable" }, 404);
    case "locked":
      return json({ error: "locked" }, 403);
    default:
      return json({ error: "invalid" }, 400);
  }
}
