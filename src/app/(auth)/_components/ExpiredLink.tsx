import Link from "next/link";
import { copy } from "@/content/copy.he";
import { FocusHeading } from "./FocusHeading";

/** קישור שנוצל או שפג תוקפו: מוצג במקום הטופס, עם דרך לבקש קישור חדש (מסך "שכחתי סיסמה"). */
export function ExpiredLink() {
  return (
    <section className="tile tile--sand" aria-labelledby="expired-title">
      <FocusHeading id="expired-title" className="note-title">{copy.activate.expired.heading}</FocusHeading>
      <p className="note-body">{copy.activate.expired.body}</p>
      <div style={{ marginTop: 16 }}>
        <Link href="/forgot" className="btn btn--secondary">
          {copy.activate.expired.action}
        </Link>
      </div>
    </section>
  );
}
