"use client";

import { useEffect, useState } from "react";

/**
 * כפתור הרשמה צף בתחתית המסך (הערת אביטל 9). מופיע רק כשגללו מעבר לכפתור הראשון ואף כפתור הרשמה אחר ([data-signup]) לא נראה,
 * כך שאף פעם אין שני כפתורים זה ליד זה ולא מכסים כפתור. בלי JavaScript הוא לא מוצג (כפתורי ההרשמה בדף עובדים בלעדיו).
 * השם הנגיש הוא הטקסט הגלוי (2.5.3). בסדר הפוקוס הוא אחרי התוכן, ולכן לא קוטע את הקריאה.
 */
export function FloatingCta({ href, label }: { href: string; label: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-signup]"));
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const update = () => {
      const first = targets[0].getBoundingClientRect();
      setShow(visible.size === 0 && first.bottom < 0);
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      update();
    });
    targets.forEach((t) => io.observe(t));
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="pt-float" data-show={show ? "1" : "0"} hidden={!show}>
      <a className="cta" href={href}>
        {label}
      </a>
    </div>
  );
}
