import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";

/** שורש האתר: מחובר/ת ל־/today, אחרת ל־/login. (דף הנחיתה /tsaad הוא שלב 10.) */
export default async function Home() {
  redirect((await verifySession()) ? "/today" : "/login");
}
