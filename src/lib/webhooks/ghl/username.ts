/**
 * כלל שם המשתמש בהרשמה דרך GHL: פשוט, קל לזכור, ייחודי.
 *  1. החלק שלפני ה־@ באימייל: אותיות קטנות, הדגשים הוסרו (NFKD), רק a-z 0-9 . _ -  (שאר התווים נמחקים),
 *     בלי נקודה/מקף/קו תחתון בקצוות, עד 20 תווים. מינימום 3 תווים, ולא שם שמור (admin, support וכו', ראו למטה).
 *  2. אחרת (אין אימייל, או שאחרי הניקוי נשאר פחות מ־3 תווים, למשל שם מקומי בעברית): ספרות הטלפון בצורה הלאומית
 *     (0521234567).
 *  3. אחרת: "yogi" ואחריו 5 ספרות אקראיות.
 * התנגשות: סיומת מספרית 2, 3, ... ("dana", "dana2", "dana3"). הסיומת נחתכת מהבסיס כדי שהאורך המרבי יישמר.
 * אחרי SEQUENTIAL_USERNAME_TRIES סיומות רציפות: סיומת אקראית של 6 ספרות (ראו signup.ts).
 * השם הוא מזהה כניסה בלבד ואינו סוד; הוא נשלח למשתתף/ת בהודעה.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/**
 * שמות שלא ניתנים אוטומטית (גם לא עם סיומת): נשמעים כמו צוות, מערכת או התוכנית, ושם המשתמש מופיע בהודעות.
 * בסיס שמור (או שמתחיל באחד מהם) נופל לחלופה הבאה בכלל (טלפון, ואחריו yogi).
 */
const RESERVED_PREFIXES = ["admin", "support", "tsaad", "official", "moderator", "noreply", "security", "system", "staff"];
const RESERVED_EXACT = new Set([
  "root", "help", "info", "team", "owner", "service", "api", "ghl", "test", "null", "undefined", "yesodot",
  "postmaster", "webmaster", "contact", "office",
]);
export const isReservedUsername = (base: string) => {
  const b = base.replace(/[._-]/g, "");
  return RESERVED_EXACT.has(b) || RESERVED_PREFIXES.some((r) => b.startsWith(r));
};

const stripEdges = (s: string) => s.replace(/^[._-]+|[._-]+$/g, "");

export function sanitizeLocalPart(local: string): string {
  const ascii = local
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/([._-])[._-]+/g, "$1");
  return stripEdges(ascii).slice(0, USERNAME_MAX).replace(/[._-]+$/g, "");
}

/** הבסיס (בלי סיומת). random: להזרקה בבדיקות. */
export function usernameBase(
  args: { email?: string | null; phoneE164?: string | null },
  random: () => number = Math.random,
): string {
  const local = args.email?.split("@")[0] ?? "";
  const fromEmail = sanitizeLocalPart(local);
  if (fromEmail.length >= USERNAME_MIN && !isReservedUsername(fromEmail)) return fromEmail;
  if (args.phoneE164?.startsWith("+972")) return `0${args.phoneE164.slice(4)}`;
  if (args.phoneE164) {
    const d = args.phoneE164.replace(/\D/g, "").slice(0, USERNAME_MAX);
    if (d.length >= USERNAME_MIN) return d;
  }
  return `yogi${String(Math.floor(random() * 100000)).padStart(5, "0")}`;
}

/**
 * מועמד חלופי כשהסיומות הרציפות נגמרו (הרבה שמות זהים, או ניסיון מכוון למלא אותן): הבסיס ו־6 ספרות אקראיות.
 */
export function usernameRandomCandidate(base: string, random: () => number = Math.random): string {
  const suffix = String(Math.floor(random() * 1_000_000)).padStart(6, "0");
  return stripEdges(base.slice(0, USERNAME_MAX - suffix.length)) + suffix;
}

/** המועמד ה־n (n=1: הבסיס עצמו). */
export function usernameCandidate(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = String(n);
  return stripEdges(base.slice(0, USERNAME_MAX - suffix.length)) + suffix;
}
