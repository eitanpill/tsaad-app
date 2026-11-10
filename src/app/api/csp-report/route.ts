import { logger } from "@/lib/logger";
import {
  CSP_REPORT_CONTENT_TYPES,
  CSP_REPORT_MAX_BYTES,
  createReportBudget,
  parseCspReports,
  readCappedText,
} from "@/lib/security/csp-report";

/**
 * POST /api/csp-report: יעד report-uri / report-to של ה־CSP (src/lib/security/csp.ts).
 * פתוח לכולם (הדפדפן שולח בלי עוגיות ובלי Origin אמין), ולכן: אין כתיבה למסד, אין קריאת סשן, גוף עד 8KB,
 * סוג תוכן של דיווח בלבד, ורישום מוגבל לכל מופע (createReportBudget) של שדות מצומצמים בלבד (ראו csp-report.ts).
 * התשובה תמיד 204 בלי גוף (גם לקלט לא תקין), מלבד 413/415, כדי שלא יהיה מה ללמוד ממנה.
 */
const budget = createReportBudget();
const NO_STORE = { "Cache-Control": "no-store" };
const empty = (status: number) => new Response(null, { status, headers: NO_STORE });

export async function POST(req: Request) {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!CSP_REPORT_CONTENT_TYPES.includes(type)) return empty(415);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > CSP_REPORT_MAX_BYTES) return empty(413);
  const text = await readCappedText(req, CSP_REPORT_MAX_BYTES);
  if (text === null) return empty(413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return empty(204);
  }
  for (const v of parseCspReports(body)) {
    const { allowed, droppedBefore } = budget.take();
    if (droppedBefore > 0) logger.warn("csp reports dropped (rate limit)", { count: droppedBefore });
    if (!allowed) break;
    logger.warn("csp violation", { ...v });
  }
  return empty(204);
}
