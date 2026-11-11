/**
 * דיווחי הפרת CSP (report-uri / report-to). הדפדפן שולח אותם בלי אימות, ולכן כל מה שבגוף הוא קלט לא אמין:
 *  - גודל מוגבל (נקרא בהדרגה ונעצר בתקרה), ורק סוגי תוכן של דיווח.
 *  - נשמרים בלוג בלבד, אף פעם לא במסד. לכל מופע יש תקרת רישום לדקה (אחרת דף שנפרץ או תוקף יציפו את הלוגים).
 *  - נרשמים רק שדות קצרים ומנורמלים: ההנחיה, המקור החסום מצומצם ל־origin (או מילת מפתח כמו inline/eval),
 *    הנתיב של הדף בלי query (ב־/activate?token= יש אסימון) וקובץ המקור בלי נתיב. אין כתובות מלאות, אין דגימות קוד.
 */

export { CSP_REPORT_GROUP, CSP_REPORT_PATH } from "./csp";
export const CSP_REPORT_MAX_BYTES = 8 * 1024;
/** כמה דיווחים לכל היותר נרשמים בדקה בכל מופע; השאר נספרים בלבד. */
export const CSP_REPORT_LOGS_PER_MINUTE = 30;
/** כמה הפרות לכל היותר מתוך גוף אחד (report-to יכול לאגד כמה). */
export const CSP_REPORT_MAX_ITEMS = 5;

export const CSP_REPORT_CONTENT_TYPES = ["application/csp-report", "application/reports+json", "application/json"];

export type CspViolation = {
  directive: string;
  blocked: string;
  page: string;
  source: string | null;
  line: number | null;
  disposition: string | null;
};

const KEYWORDS = new Set(["inline", "eval", "self", "data", "blob", "wasm-eval", "trusted-types-policy", "trusted-types-sink"]);

const short = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.length > 0 ? v.replace(/[^\x20-\x7e]/g, "?").slice(0, max) : null;

/** מקור חסום: מילת מפתח (inline, eval) או ה־origin בלבד, בלי נתיב ו־query. */
export function reduceBlocked(raw: unknown): string {
  const v = short(raw, 2048);
  if (!v) return "unknown";
  if (KEYWORDS.has(v)) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ws:" || u.protocol === "wss:") {
      return u.host.slice(0, 120);
    }
    return u.protocol.replace(/:$/, "").slice(0, 20);
  } catch {
    return "other";
  }
}

/** נתיב הדף בלבד (בלי origin, query ו־hash): הכתובת של /activate נושאת אסימון. */
export function reducePage(raw: unknown): string {
  const v = short(raw, 2048);
  if (!v) return "unknown";
  try {
    return new URL(v).pathname.slice(0, 120);
  } catch {
    return "other";
  }
}

function reduceSource(raw: unknown): string | null {
  const v = short(raw, 2048);
  if (!v) return null;
  try {
    const u = new URL(v);
    // קבצי Next הם /_next/static/chunks/<hash>.js: שם הקובץ עוזר, ה־query לא.
    return `${u.host}${u.pathname}`.slice(0, 160);
  } catch {
    return KEYWORDS.has(v) ? v : "other";
  }
}

const directiveOf = (v: unknown) => {
  const s = short(v, 60);
  return s && /^[a-z-]+$/.test(s.split(" ")[0]) ? s.split(" ")[0] : "unknown";
};

const lineOf = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1e7 ? v : null);

function fromLegacy(r: Record<string, unknown>): CspViolation {
  return {
    directive: directiveOf(r["effective-directive"] ?? r["violated-directive"]),
    blocked: reduceBlocked(r["blocked-uri"]),
    page: reducePage(r["document-uri"]),
    source: reduceSource(r["source-file"]),
    line: lineOf(r["line-number"]),
    disposition: short(r["disposition"], 10),
  };
}

function fromReportingApi(b: Record<string, unknown>, url: unknown): CspViolation {
  return {
    directive: directiveOf(b.effectiveDirective ?? b.violatedDirective),
    blocked: reduceBlocked(b.blockedURL),
    page: reducePage(b.documentURL ?? url),
    source: reduceSource(b.sourceFile),
    line: lineOf(b.lineNumber),
    disposition: short(b.disposition, 10),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** מפענח את שני הפורמטים (report-uri הישן ו־Reporting API). קלט לא מוכר נותן רשימה ריקה. */
export function parseCspReports(body: unknown): CspViolation[] {
  if (isObj(body) && isObj(body["csp-report"])) return [fromLegacy(body["csp-report"])];
  if (Array.isArray(body)) {
    return body
      .filter((r): r is Record<string, unknown> => isObj(r) && r.type === "csp-violation" && isObj(r.body))
      .slice(0, CSP_REPORT_MAX_ITEMS)
      .map((r) => fromReportingApi(r.body as Record<string, unknown>, r.url));
  }
  return [];
}

/** תקרת רישום פשוטה לכל מופע: חלון של דקה. */
export function createReportBudget(perMinute = CSP_REPORT_LOGS_PER_MINUTE, now: () => number = Date.now) {
  let windowStart = 0;
  let used = 0;
  let dropped = 0;
  return {
    /** האם מותר לרשום עוד דיווח. כשנפתח חלון חדש, מחזיר גם כמה נזרקו בחלון הקודם. */
    take(): { allowed: boolean; droppedBefore: number } {
      const t = now();
      let droppedBefore = 0;
      if (t - windowStart >= 60_000) {
        droppedBefore = dropped;
        windowStart = t;
        used = 0;
        dropped = 0;
      }
      if (used < perMinute) {
        used++;
        return { allowed: true, droppedBefore };
      }
      dropped++;
      return { allowed: false, droppedBefore };
    },
  };
}

/** קורא את הגוף עד התקרה. null = גדול מדי. */
export async function readCappedText(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
