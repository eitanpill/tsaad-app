import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { LIVE_REMINDER, REMINDERS } from "@/config/constants";
import { fill } from "@/lib/format";

export type PushMessage = { title: string; body: string; url: string; tag: string };

/**
 * נוסח התזכורת היומית: עוסק בתרגול של היום בלבד, בלי אזכור של הלייב (גם בימים 7 ו־14).
 * יש תוכן ליום: perDay עם ההרגל של היום; אחרת generic.
 */
export function buildReminderMessage(day: number): PushMessage {
  const content = DAYS.find((d) => d.day === day);
  const body = content
    ? fill(copy.push.perDay, { day, habit: content.habit.title })
    : fill(copy.push.generic, { day });
  return { title: copy.push.title, body, url: REMINDERS.openPath, tag: `day-${day}` };
}

/** נוסח תזכורת הלייב (נפרדת מהיומית): בלשון רבים, מפנה למסך הלייב באפליקציה. */
export function buildLiveReminderMessage(day: number): PushMessage {
  return { title: copy.push.liveTitle, body: copy.push.liveBody, url: LIVE_REMINDER.openPath, tag: `live-${day}` };
}
