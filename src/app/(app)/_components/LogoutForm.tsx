"use client";

import { useRef, useState, type FormEvent } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { copy } from "@/content/copy.he";
import { releaseSubscriptionForLogout } from "@/lib/pwa/push-client";

/**
 * "יציאה". לפני השליחה מבטל את מנוי ההתראות של הדפדפן ושולח את הכתובת שלו, כדי שהשרת ימחק גם את השורה
 * (טלפון משותף לא ממשיך לקבל את התזכורות של מי שיצא). בלי JS הטופס עדיין עובד (יציאה בלי הניקוי הזה;
 * המנוי המקומי מתואם בכניסה הבאה, ראו reconcileSubscription).
 */
export function LogoutForm() {
  const form = useRef<HTMLFormElement>(null);
  const endpoint = useRef<HTMLInputElement>(null);
  const prepared = useRef(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (prepared.current) return; // השליחה השנייה: ממשיכים ל־logoutAction
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    endpoint.current!.value = (await releaseSubscriptionForLogout()) ?? "";
    prepared.current = true;
    form.current!.requestSubmit();
  }

  return (
    <form ref={form} action={logoutAction} onSubmit={onSubmit} className="app-foot">
      <input ref={endpoint} type="hidden" name="push_endpoint" defaultValue="" />
      <button type="submit" className="linkbtn" aria-busy={busy}>
        {copy.common.logout}
      </button>
    </form>
  );
}
