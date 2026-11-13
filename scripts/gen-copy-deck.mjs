// Generates docs/content/COPY.md from src/content/copy.he.ts.
// Run: node --experimental-strip-types scripts/gen-copy-deck.mjs
import { writeFileSync } from "node:fs";
import { copy } from "../src/content/copy.he.ts";
import { legal } from "../src/content/legal.he.ts";

const GROUP_TITLES = {
  brand: "מותג",
  nav: "ניווט תחתון",
  common: "כללי",
  today: "היום",
  path: "השביל",
  locked: "יום נעול",
  live: "לייב",
  reminders: "תזכורות",
  install: "התקנה",
  login: "כניסה",
  activate: "הפעלה וקביעת סיסמה (מהקישור החד־פעמי)",
  forgot: "שכחתי סיסמה",
  states: "מצבים: שגיאה, אין חיבור, טעינה, הצלחה",
  push: "התראה יומית (בשעה שבחרתם)",
  messages: "הודעות שהמערכת החיצונית תשלח (טיוטה, לא נשלח)",
  landing: "עמוד נחיתה /tsaad",
  offer: "הצעת יום 14 ויסודות היוגה",
  account: "החשבון ומחיקת חשבון (חדש בשלב 10)",
  legal: "דפים משפטיים: מילות ממשק (חדש בשלב 10)",
  a11y: "נגישות: תוויות, טקסט לקורא מסך, הודעות חיות",
};

// Notes are matched by the longest dotted-path prefix.
const NOTES = {
  "brand.pageTitle": "כותרת הדף, במקום שם העיצוב הפנימי.",
  "common.dayOfTotal": "n מגיע מהקוד.",
  "today.greeting": "בוקר עד 12:00, אחר כך שלום, ובערב ערב טוב. השעות לפי שעון ישראל.",
  "today.heroMorning": "משתמשים בזה עד 12:00. אחרי זה heroDay.",
  "today.heroLive": "בימים 7 ו־14.",
  "today.remaining": "מחליף את “8 עד הסיום”. מבוסס על הכלל 12 מתוך 14. done מוצג מ־12 ימים ומעלה.",
  "today.cup.two": "שתי פעולות (או לייב לבד) = שלושה רבעים. אושר עם הקופי, 2026-11-08.",
  "today.cupExplain": "מוצג פעם אחת, במסך הראשון.",
  "today.liveAction": "בימים 7 ו־14 מחליף את התנועה והמדיטציה ונספר כשני צעדים בכוס (החלטת פית, 2026-11-08).",
  "today.toastOffline": "לא בשימוש: אין תור לא־מקוון (שלב 9). סימון צריך חיבור, ושגיאת שמירה מציגה “לנסות שוב”.",
  "path.stone.yesterday": "אתמול בלבד, עד חצות שעון ישראל (החלטת פית, 2026-11-08).",
  "path.stone.missed": "יום ישן יותר שלא סומן. סגור לסימון; הסרטון עדיין זמין לצפייה.",
  "locked.body": "05:00 הוא שעת הפתיחה. השעה של ההודעה היא בחירת המשתתפים, ברירת המחדל 07:30 (החלטת פית). המשפט על ההודעה מותנה בכך שהתזכורות פעילות.",
  "reminders.timeNote": "חדש: שעת התזכורת נבחרת בדף התזכורות, כל 30 דקות בין 05:30 ל־21:00, ואחת לשני הערוצים (התראה ווטסאפ). ההודעה לא מבטיחה זמן מעבר ל“בשעה שבחרתם”.",
  "locked.schedule": "מחליף את “השעון של השרת”.",
  "locked.beforeStartTitle": "לפני תחילת האתגר. התאריך מהקונפיג.",
  "live.day7.time": "מציין מקום מהמפרט. מוחלף מהקונפיג (LIVE_TIME_DAY7). כשלא הוגדר, המשתתפים רואים את live.timeTba.",
  "live.day7.hint": "הרמז להצעה ביום 7, בלי פרטים. אושר עם הקופי, 2026-11-08.",
  "live.day14.time": "מציין מקום מהמפרט. מוחלף מהקונפיג (LIVE_TIME_DAY14). כשלא הוגדר, המשתתפים רואים את live.timeTba.",
  "live.joinTarget": "הכפתור מוצג כלא פעיל כל עוד זה עדיין מציין מקום.",
  "live.attended": "סימון נוכחות לא חובה.",
  "live.timeTba": "חדש בשלב 9 (בדיקת שער). מוצג למשתתפים כש־LIVE_TIME_DAYn לא הוגדר, במקום מציין המקום. מציין המקום נשאר בקופי ובתצורה.",
  "live.linkMissing": "חדש בשלב 9. החלון פתוח אבל LIVE_URL_DAYn לא הוגדר: לא ממציאים קישור ולא מבטיחים אחד.",
  "live.calendarUnavailable": "חדש בשלב 9. אין START_DATE או LIVE_TIME_DAYn, ולכן אין קובץ יומן.",
  "install.installed": "חדש בשלב 9. מוצג במקום ההוראות כשהאפליקציה כבר נפתחה מהמסך הראשי.",
  "live.cantAttend": "ללא שורת ההקלטה עד שיוחלט אם מקליטים. ראו שאלה 2.",
  "reminders.status": "מוצג באזור סטטוס מוקרא.",
  "install.lead": "מחליף את “שתי לחיצות”, שלא היה מדויק.",
  "install.why": "במקום “למה זה חשוב”. הניסוח מדויק לאייפון בלבד.",
  "login.errors.invalid": "אותו משפט לשני השדות, בכוונה. לא חושף מה שגוי.",
  "activate.password.minLength": "דרישות הסיסמה הן הצעה מהעיצוב. ראו שאלה 3.",
  "activate.expired": "מוצג במקום הטופס כשהקישור לא תקף או כבר נוצל.",
  "forgot.confirmation": "אותו נוסח בדיוק בין אם יש חשבון ובין אם אין.",
  "forgot.confirmation.resendWait": "seconds מהמגבלה בפועל.",
  "states.offline": "שלב 9: אין תור לא־מקוון, ולכן הנוסח כבר לא מבטיח שמירה. אותו טקסט ב־public/offline.html (נבדק בבדיקה).",
  "push.generic": "ברירת המחדל. דבר אחד קטן מספיק.",
  "push.perDay": "אופציונלי. נגזר מכותרת ההרגל של היום ב־days.ts, בלי טענות נוספות.",
  "push.liveDay": "בימים 7 ו־14. time מהקונפיג.",
  "push.previewDay": "היום שמוצג בתצוגה המקדימה במסך התזכורות.",
  "messages.status": "כל ההודעות כאן הן טיוטה. אין שליחה.",
  "messages.activation": "קישור חד־פעמי. אחריו בוחרים סיסמה לבד. אין סיסמה בהודעה, ויש בה בקשה לא להעביר את הקישור.",
  "messages.forgot": "נשלח רק כשיש חשבון, ורק למייל שנמסר בהרשמה (בלי מייל: לא נשלח כלום). המסך מציג תמיד את אותו אישור, ולכן הוא לא חושף אם יש חשבון. בלי סיסמה בהודעה.",
  "messages.day14": "ההודעה הוגדרה במפרט. הנוסח טיוטה.",
  "messages.sessionReminder": "24 שעות לפני סוף חלון ההצעה. שורת יסודות לכל המשתתפים, מוצגת בנפרד (החלטת פית, 2026-11-08).",
  "landing.hero.ctaTarget": "הכפתור לא פעיל כל עוד זה מציין מקום.",
  "landing.hero.price": "79 ₪ הרשמה לאתגר, לא מנוי.",
  "landing.how.example": "דוגמה אמיתית מיום 1 בתוכן.",
  "landing.audience": "מחליף את “נשים וגברים בגילאי 30–55”.",
  "landing.avital": "בעמוד הנחיתה אביטל מדברת בגוף ראשון.",
  "landing.avital.media": "מציין מקום מהמפרט.",
  "landing.faq": "כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות.",
  "offer.day14.window": "hours ו־deadline מהקונפיג בצד השרת. בלי ספירה לאחור.",
  "offer.day14.session.spots": "spots מהקונפיג. מוצג רק אם יש מגבלה אמיתית, ראו שאלה 1.",
  "offer.day14.bundle.detail": "לפי פית: הקורסים “לשחרר את הכיסא” ו“ריסט”.",
  "offer.day14.bundle": "קישור הבאנדל עם UTM של וואטסאפ או אינסטגרם מהקונפיג.",
  "offer.yesodot": "פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות.",
  "offer.yesodot.expiry": "Pit 2026-11-11: valid 48h from the end of the challenge, same window as the day-14 offers; no strikethrough price. {until} הוא מועד סוף חלון יום 14.",
  "messages.day14.whatsapp": "ההודעה הוגדרה במפרט. הנוסח טיוטה. Pit 2026-11-11: valid 48h from the end of the challenge, same window as the day-14 offers; no strikethrough price.",
  "messages.sessionReminder.yesodotLine": "24 שעות לפני סוף חלון ההצעה. שורת יסודות לכל המשתתפים. Pit 2026-11-11: valid 48h from the end of the challenge, same window as the day-14 offers; no strikethrough price.",
  "offer.yesodot.emailTiming": "מועד יציאת שני המיילים עוד פתוח. ראו שאלה 3.",
  "a11y.cup": "טקסט חלופי לאיור הכוס.",
  "a11y.action.name": "השם הנגיש של כפתור פעולה. המצב מגיע מ־aria-pressed.",
  "a11y.forms.requirementDone": "טקסט מוסתר מהעין, נקרא בקורא מסך.",
  "a11y.status": "אזור role=status מנומס. לא מכריזים על כל הקשה.",
  "a11y.live.addToCalendar7": "הטקסט הגלוי “הוספה ליומן” נמצא בתחילת השם הנגיש (WCAG 2.5.3).",
  "a11y.landing.cta": "aria-label לכפתור “אני בפנים”. הטקסט הגלוי בתחילתו.",
  "a11y.offer": "aria-label לכפתורי ההצעה, כשהטקסט הגלוי לא ברור מחוץ להקשר.",
  "a11y.forms.showConfirmPassword": "לכפתור ההצגה של שדה האימות, כדי ששני הכפתורים לא יישמעו אותו דבר.",
  "landing.hero.startTba": "חדש בשלב 10. מוצג כש־START_DATE לא הוגדר, במקום השורה עם [START_DATE].",
  "landing.close.headingTba": "חדש בשלב 10. מוצג כש־START_DATE לא הוגדר.",
  "landing.footer": "חדש בשלב 10: תחתית הדף הציבורי.",
  "landing.illustration": "חדש בשלב 10: תווית הרשימה המאוירת ב״איך זה עובד״.",
  "offer.day14.bundle.ctaTarget": "חדש בשלב 10. מציין מקום; הכפתור לא פעיל עד שמוגדר MORNING_URL_BUNDLE_139.",
  "offer.day14.bundle.utm": "חדש בשלב 10. ערך utm_campaign מהקונפיג (OFFER_UTM_BUNDLE).",
  "offer.yesodot.expiryTba": "חדש בשלב 10. מוצג כשאי אפשר לחשב את חלון יום 14 (חסר START_DATE או LIVE_TIME_DAY14), במקום expiry.",
  "offer.yesodot.expired": "חדש בשלב 10. אחרי תום התוקף: בלי כפתור.",
  "offer.yesodot.more": "חדש בשלב 10. כפתור בתקציר שבמסך ההצעות, מוביל ל־/yesodot.",
  "offer.yesodot.disabled": "חדש בשלב 10 (כפל של offer.day14.disabled, למסך הנפרד).",
  "offer.entry": "חדש בשלב 10. אריח קטן במסך היום ביום 14 ואחריו.",
  "account": "חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית.",
  "legal.contactTba": "חדש בשלב 10. מוצג כשפרט הקשר לא הוגדר בקונפיג, במקום [ACCESSIBILITY_CONTACT], [PRIVACY_CONTACT] או [SUPPORT_CONTACT].",
  "a11y.help": "מציין מקום מהמפרט. נוסח הצהרת הנגישות נכתב בשלב 10.",
};

const QUESTIONS = [
  "מקומות לפגישה: האם יש מגבלה אמיתית? אם לא, השורה לא מוצגת.",
  "האם הלייבים מוקלטים? אם כן, אוסיף “ההקלטה תעלה לכאן אחרי המפגש”.",
  "חשבון: כללי הסיסמה ו־[YESODOT_EMAIL_TIMING].",
  "[ACCESSIBILITY_CONTACT] להצהרת הנגישות, ופרט אישי על אביטל לדף הנחיתה.",
  "שלב 10: [PRIVACY_CONTACT], [SUPPORT_CONTACT] ו־[MORNING_URL_BUNDLE_139] חדשים. מחיר הבאנדל: קישור ו־UTM מהקונפיג.",
  "שלב 10: הדפים המשפטיים הם טיוטה לבדיקת עורך דין (docs/LEGAL_REVIEW.md), כולל שאלות פתוחות על שמירת חשבונות ללא מחיקה.",
];

// טענות טכניות בקופי. כל אחת נבדקת בפועל בשלב 11 (QA) לפני שהנוסח נשאר.
const CLAIMS = [
  "שמירת סימונים בלי אינטרנט: לא נבנתה (today.toastOffline לא בשימוש; states.offline אומר שסימון צריך חיבור).",
  "תזכורת בוקר בהתראה, כולל באייפון אחרי הוספה למסך הבית (reminders, install.why, landing.faq).",
  "שליחת קישור הפעלה ושחזור במייל בלבד (login.firstTime, forgot, messages).",
  "התקנה באנדרואיד (install.android, בנוסח מותנה).",
  "קישור הלייב מופיע שעה לפני המפגש (live).",
];

const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, "<br>");

function noteFor(path) {
  let best = "";
  let bestLen = -1;
  for (const [k, v] of Object.entries(NOTES)) {
    if ((path === k || path.startsWith(k + ".")) && k.length > bestLen) {
      best = v;
      bestLen = k.length;
    }
  }
  return best;
}

function leaves(obj, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push([path, v]);
    else if (typeof v === "number") out.push([path, String(v)]);
    else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "string") out.push([`${path}.${i}`, item]);
        else out.push(...leaves(item, `${path}.${i}`));
      });
    } else out.push(...leaves(v, path));
  }
  return out;
}

const lines = [];
lines.push("# חוברת הקופי: צעד קטן ביום");
lines.push("");
lines.push(
  "נוצר אוטומטית מ־`src/content/copy.he.ts`. לא עורכים כאן. משנים בקוד ומריצים `node --experimental-strip-types scripts/gen-copy-deck.mjs`.",
);
lines.push("");
lines.push(
  "כללי הקול: רגוע, חם, ישיר, מקורקע. ניסוח ניטרלי למגדר (רבים, “אפשר”, שמות עצם). בלי הבטחות לתוצאה ובלי לחץ. בלי ספירה לאחור ובלי מספר מקומות מומצא. ערכים בסוגריים מסולסלים, כמו {day}, מתמלאים בקוד. ערכים בסוגריים מרובעים, כמו [START_DATE], הם מצייני מקום מהמפרט ולא ממציאים להם ערך.",
);
lines.push("");
lines.push(
  "תוכן 14 הימים נמצא ב־`src/content/days.ts`, מועתק כלשונו מקובץ התוכן של פיט מ־2026-11-10 (כולל משפט הפתיחה בצילום לכל יום).",
);
lines.push("");

let total = 0;
for (const [group, value] of Object.entries(copy)) {
  lines.push(`## ${GROUP_TITLES[group] ?? group}`);
  lines.push("");
  lines.push("| מפתח | טקסט | הערות |");
  lines.push("|---|---|---|");
  for (const [path, text] of leaves(value, group)) {
    total += 1;
    lines.push(`| \`${path}\` | ${esc(text)} | ${esc(noteFor(path))} |`);
  }
  lines.push("");
}

// דפים משפטיים: טיוטה, ממתינה לבדיקה משפטית (src/content/legal.he.ts, docs/LEGAL_REVIEW.md).
lines.push("## דפים משפטיים (DRAFT: טיוטה, ממתינה לבדיקה משפטית)");
lines.push("");
lines.push("הנוסחים נמצאים ב־`src/content/legal.he.ts`. אין הערת טיוטה גלויה למשתמשים. כל סעיף ממופה ב־`docs/LEGAL_REVIEW.md`.");
lines.push("");
lines.push("| מפתח | טקסט |");
lines.push("|---|---|");
for (const [path, text] of leaves(legal, "legal")) {
  total += 1;
  lines.push(`| \`${path}\` | ${esc(text)} |`);
}
lines.push("");

lines.push("## שאלות פתוחות לאישור");
lines.push("");
QUESTIONS.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
lines.push("");
lines.push("## טענות טכניות לבדיקה בפועל (שלב 11)");
lines.push("");
CLAIMS.forEach((c) => lines.push(`- ${c}`));
lines.push("");
lines.push(`סך הכול ${total} מחרוזות.`);
lines.push("");

writeFileSync(new URL("../docs/content/COPY.md", import.meta.url), lines.join("\n"));
console.log(`wrote docs/content/COPY.md with ${total} strings`);
