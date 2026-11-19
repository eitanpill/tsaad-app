import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { EVENING, LIVE_REMINDER, REMINDERS } from "@/config/constants";
import type { EveningContent } from "@/lib/evening/content";
import { fill } from "@/lib/format";

export type PushMessage = { title: string; body: string; url: string; tag: string };

/** סיומת התזכורת היומית: אמוג'י בקוד, כי הקופי נבדק שלא יכיל אמוג'י (כמו הירח בתזכורת הערב). */
const MORNING_EMOJI = "\u{1F9D8}\u200D\u2640\uFE0F";

/** גוף ההתראה היומית כפי שהיא מגיעה, כולל האמוג'י. משמש גם את הדוגמה במסך התזכורות. */
export function morningPushBody(template: string, day: number): string {
  return `${fill(template, { day })} ${MORNING_EMOJI}`;
}

/**
 * נוסח התזכורת היומית: עוסק בתרגול של היום בלבד, בלי אזכור של הלייב (גם בימים 7 ו־14).
 * יש תוכן ליום: perDay; אחרת generic. (שני הנוסחים זהים, בלי שם ההרגל.)
 */
export function buildReminderMessage(day: number): PushMessage {
  const content = DAYS.find((d) => d.day === day);
  const body = morningPushBody(content ? copy.push.perDay : copy.push.generic, day);
  return { title: copy.push.title, body, url: REMINDERS.openPath, tag: `day-${day}` };
}

/** נוסח תזכורת הלייב (נפרדת מהיומית): בלשון רבים, מפנה למסך הלייב באפליקציה. */
export function buildLiveReminderMessage(day: number): PushMessage {
  return { title: copy.push.liveTitle, body: copy.push.liveBody, url: LIVE_REMINDER.openPath, tag: `live-${day}` };
}

/** כותרת תזכורת הערב: "ערב טוב" + ירח (האמוג'י בקוד, כי הקופי נבדק שלא יכיל אמוג'י). */
const EVENING_MOON = "\u{1F319}";

/** נוסח תזכורת הערב לפי הגרסה (open / done / last), בלשון רבים. ההרגל של מחר רק ב־open ו־done. */
export function buildEveningReminderMessage(content: EveningContent, day: number): PushMessage {
  const body =
    content.variant === "last"
      ? copy.evening.pushLast
      : fill(content.variant === "open" ? copy.evening.pushOpen : copy.evening.pushDone, { habit: content.habit ?? "" });
  return { title: `${copy.evening.pushTitle} ${EVENING_MOON}`, body, url: EVENING.openPath, tag: `evening-${day}` };
}
