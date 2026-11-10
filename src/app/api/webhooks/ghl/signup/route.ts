import { after } from "next/server";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { getSignupDelivery, signupStartDate } from "@/lib/webhooks/ghl/delivery";
import { handleGhlSignup } from "@/lib/webhooks/ghl/handler";

/**
 * POST /api/webhooks/ghl/signup: הרשמה מ־GoHighLevel. אימות בסוד משותף (ראו lib/webhooks/ghl/auth.ts),
 * אידמפוטנטי, ובלי אסימון או פרטים אישיים בתשובה. המשלוח (dry-run כרגע) רץ ב־after().
 * אין בדיקת Origin: זו קריאה בין שרתים, לא מדפדפן.
 */
export async function POST(req: Request) {
  return handleGhlSignup(req, {
    db: getDb,
    log: logger,
    delivery: getSignupDelivery(),
    after: (task) => after(task),
    startDate: signupStartDate,
  });
}
