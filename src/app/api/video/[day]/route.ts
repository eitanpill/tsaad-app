import { verifySession } from "@/lib/auth/dal";
import { getAppClock } from "@/lib/preview/context";
import { getVideoConfig, videoFor } from "@/lib/today/video";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

/** GET /api/video/[day]: משתמש מחובר בלבד, ורק יום שהשרת פתח. הכתובת החתומה תקפה שעה. */
export async function GET(req: Request, ctx: { params: Promise<{ day: string }> }) {
  if (!(await verifySession())) return json({ error: "unauthenticated" }, 401);
  const { day } = await ctx.params;
  const n = /^\d{1,2}$/.test(day) ? Number(day) : NaN;
  const clock = await getAppClock();
  // ?v=short מבקש את התרגול הקצר; כל ערך אחר, או היעדרו, הוא התרגול המלא.
  const length = new URL(req.url).searchParams.get("v") === "short" ? "short" : "long";
  const r = videoFor(n, clock.now, clock.schedule, getVideoConfig(), length);
  switch (r.status) {
    case "ok":
      return json({ url: r.url }, 200);
    case "unavailable":
      return json({ error: "unavailable" }, 404);
    case "locked":
      return json({ error: "locked" }, 403);
    default:
      return json({ error: "invalid" }, 400);
  }
}
