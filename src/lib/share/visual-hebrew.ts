/**
 * satori (next/og) מסדר את המילים בשורה מימין לשמאל, אבל מצייר את התווים שבתוך כל מילה משמאל לימין, לפי סדר הקלט.
 * לכן כל מילה שיש בה עברית נבנית כאן בסדר החזותי (משמאל לימין): רצפי ספרות ולטינית ("14", "YOGIT", "3.5") נשמרים
 * כמות שהם ובסדרם הפנימי, ושאר התווים (אותיות עבריות, פיסוק, מקף) מתהפכים. כך "ה־14" ו"ביום." נקראים נכון.
 * סוגריים מתחלפים (פתיחה/סגירה) כשהם מתהפכים. מילה בלי עברית לא משתנה.
 * מגבלה: רצף של כמה מילים לטיניות ברצף יתהפך בסדר המילים; הקופי של הכרטיס לא מכיל רצף כזה (נבדק בבדיקה).
 */
const HEBREW = /[֐-׿]/;
const LTR_RUN = /[0-9A-Za-z]+(?:[.,:/][0-9A-Za-z]+)*/g;
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<" };

function visualWord(w: string): string {
  if (!HEBREW.test(w)) return w;
  const runs: string[] = [];
  let last = 0;
  for (const m of w.matchAll(LTR_RUN)) {
    if (m.index > last) runs.push(rtlRun(w.slice(last, m.index)));
    runs.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < w.length) runs.push(rtlRun(w.slice(last)));
  return runs.reverse().join("");
}

const rtlRun = (s: string) => [...s].reverse().map((c) => MIRROR[c] ?? c).join("");

export function visualHebrew(text: string): string {
  return text.split(" ").map(visualWord).join(" ");
}
