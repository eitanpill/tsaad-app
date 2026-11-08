import { copy } from "@/content/copy.he";
import { DAYS } from "@/content/days";
import { REMINDERS } from "@/config/constants";
import { fill } from "@/lib/format";
import { isLiveDay } from "@/lib/days/schedule";

export type PushMessage = { title: string; body: string; url: string; tag: string };

/**
 * נוסח התזכורת של יום. יום לייב עם שעה מוגדרת: liveDay; יום לייב בלי שעה: generic
 * (לא ממציאים שעה); יום רגיל: perDay עם ההרגל של היום.
 */
export function buildReminderMessage(day: number, liveTimes: { 7?: string; 14?: string }): PushMessage {
  const content = DAYS.find((d) => d.day === day);
  let body: string;
  if (isLiveDay(day)) {
    const time = day === 7 ? liveTimes[7] : liveTimes[14];
    body = time ? fill(copy.push.liveDay, { day, time }) : fill(copy.push.generic, { day });
  } else if (content) {
    body = fill(copy.push.perDay, { day, habit: content.habit.title });
  } else {
    body = fill(copy.push.generic, { day });
  }
  return { title: copy.push.title, body, url: REMINDERS.openPath, tag: `day-${day}` };
}
