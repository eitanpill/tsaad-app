import { after } from "next/server";
import { getDb } from "@/db";
import { copy } from "@/content/copy.he";
import { logger } from "@/lib/logger";
import { sendPurchase } from "@/lib/meta/capi";
import { getSignupDelivery, signupStartDate } from "@/lib/webhooks/ghl/delivery";
import { handleGhlSignup } from "@/lib/webhooks/ghl/handler";

/**
 * POST /api/webhooks/ghl/signup: הרשמה מ־GoHighLevel. אימות בסוד משותף (ראו lib/webhooks/ghl/auth.ts),
 * אידמפוטנטי, ובלי אסימון או פרטים אישיים בתשובה. המשלוח (dry-run כרגע) רץ ב־after().
 * אין בדיקת Origin: זו קריאה בין שרתים, לא מדפדפן. על הרשמה חדשה נשלח גם Purchase למטא (lib/meta/capi.ts; כבוי כברירת מחדל).
 */
export async function POST(req: Request) {
  return handleGhlSignup(req, {
    db: getDb,
    log: logger,
    delivery: getSignupDelivery(),
    after: (task) => after(task),
    startDate: signupStartDate,
    conversions: (ev) => sendPurchase(ev, { log: logger }),
    purchaseValue: Number(copy.landing.price.amount),
  });
}
