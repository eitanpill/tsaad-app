import { LIVE } from "@/config/constants";

/** קובץ יומן (RFC 5545) לאירוע בודד. הזמנים ב־UTC (Z), ולכן אין תלות בטבלת אזורי זמן, והמרת Asia/Jerusalem נעשית במודל. */

const pad = (n: number) => String(n).padStart(2, "0");

export function icsUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** קיפול שורות ל־75 בתים לכל היותר (UTF-8), בלי לחתוך תו באמצע. המשך השורה מתחיל ברווח. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
      limit = 74; // הרווח המוביל נספר
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export type IcsEvent = {
  uid: string;
  startsAt: Date;
  /** ברירת מחדל LIVE.calendarDurationMinutes. */
  durationMinutes?: number;
  summary: string;
  description?: string;
  url?: string;
  stamp: Date;
};

export function buildIcs(e: IcsEvent): string {
  const end = new Date(e.startsAt.getTime() + (e.durationMinutes ?? LIVE.calendarDurationMinutes) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YOGIT//Tsaad Katan Beyom//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsUtc(e.stamp)}`,
    `DTSTART:${icsUtc(e.startsAt)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${icsEscape(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
