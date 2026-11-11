import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";

/**
 * שורש האתר: מחובר/ת ל־/today; אחרת לדף הנחיתה הציבורי /tsaad (מי שמגיע לכתובת הראשית ללא התחברות הוא בדרך כלל
 * מי שעוד לא נרשמו, והדף מסביר את האתגר). המשתתפים הקיימים נכנסים דרך /login, שנשאר זמין: קישור "כניסה" בדף הנחיתה,
 * ו־/today (כתובת ההתחלה של האפליקציה המותקנת) מפנה אליו כשאין סשן.
 */
export default async function Home() {
  redirect((await verifySession()) ? "/today" : "/tsaad");
}
