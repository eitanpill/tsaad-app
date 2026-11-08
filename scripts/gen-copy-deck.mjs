// Generates docs/content/COPY.md from src/content/copy.he.ts.
// Run: node --experimental-strip-types scripts/gen-copy-deck.mjs
import { writeFileSync } from "node:fs";
import { copy } from "../src/content/copy.he.ts";

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
  push: "התראת בוקר (07:30)",
  messages: "הודעות שהמערכת החיצונית תשלח (טיוטה, לא נשלח)",
  landing: "עמוד נחיתה /tsaad",
  offer: "הצעת יום 14 ויסודות היוגה",
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
  "today.cup.two": "שלושה רבעים הוא הצעה, לא החלטה. ראו שאלה 3.",
  "today.cupExplain": "מוצג פעם אחת, במסך הראשון.",
  "today.liveAction": "בימים 7 ו־14 מחליף את התנועה והמדיטציה. המיפוי לא הוחלט, ראו שאלה 2.",
  "today.toastOffline": "כשהסימון נשמר בתור ועוד לא נקלט.",
  "path.stone.open": "יום שעבר ולא נספר. לא ברור אם אפשר לסמן אותו בדיעבד.",
  "locked.body": "05:00 ו־07:30 לפי ההחלטה. המשפט על ההודעה מותנה בכך שהתזכורות פעילות.",
  "locked.schedule": "מחליף את “השעון של השרת”.",
  "locked.beforeStartTitle": "לפני תחילת האתגר. התאריך מהקונפיג.",
  "live.day7.time": "מציין מקום מהמפרט. מוחלף מהקונפיג.",
  "live.day7.hint": "הרמז להצעה ביום 7, בלי פרטים. הנוסח לאישור.",
  "live.day14.time": "מציין מקום מהמפרט. מוחלף מהקונפיג.",
  "live.joinTarget": "הכפתור מוצג כלא פעיל כל עוד זה עדיין מציין מקום.",
  "live.attended": "סימון נוכחות לא חובה.",
  "live.cantAttend": "ללא שורת ההקלטה, כי לא הוחלט להקליט. ראו שאלה 4.",
  "reminders.timeValue": "שעה קבועה לפי ההחלטה. לא ידוע אם אפשר לשנות.",
  "reminders.status": "מוצג באזור סטטוס מוקרא.",
  "install.lead": "מחליף את “שתי לחיצות”, שלא היה מדויק.",
  "install.why": "במקום “למה זה חשוב”. הניסוח מדויק לאייפון בלבד.",
  "login.errors.invalid": "אותו משפט לשני השדות, בכוונה. לא חושף מה שגוי.",
  "activate.password.minLength": "דרישות הסיסמה הן הצעה מהעיצוב ויאושרו בשלב החשבונות.",
  "activate.expired": "מוצג במקום הטופס כשהקישור לא תקף או כבר נוצל.",
  "forgot.confirmation": "אותו נוסח בדיוק בין אם יש חשבון ובין אם אין.",
  "forgot.confirmation.resendWait": "seconds מהמגבלה בפועל.",
  "states.offline": "הסימונים נשמרים בתור, לפי הערות הנגישות.",
  "push.generic": "ברירת המחדל. דבר אחד קטן מספיק.",
  "push.perDay": "אופציונלי. נגזר מכותרת ההרגל של היום ב־days.ts, בלי טענות נוספות.",
  "push.liveDay": "בימים 7 ו־14. time מהקונפיג.",
  "push.previewDay": "היום שמוצג בתצוגה המקדימה במסך התזכורות.",
  "messages.status": "כל ההודעות כאן הן טיוטה. אין שליחה.",
  "messages.activation": "קישור חד־פעמי. אחריו בוחרים סיסמה לבד. אין סיסמה בהודעה, ויש בה בקשה לא להעביר את הקישור.",
  "messages.forgot": "נשלח רק כשיש חשבון, ורק לוואטסאפ ולמייל שנמסרו בהרשמה. המסך מציג תמיד את אותו אישור, ולכן הוא לא חושף אם יש חשבון. בלי סיסמה בהודעה.",
  "messages.day14": "ההודעה הוגדרה במפרט. הנוסח טיוטה.",
  "messages.sessionReminder": "24 שעות לפני סוף חלון ההצעה. שורת יסודות רק למשלימים, והוגדרה במפרט כחלק מהתזכורת.",
  "landing.hero.ctaTarget": "הכפתור לא פעיל כל עוד זה מציין מקום.",
  "landing.hero.price": "79 ₪ הרשמה לאתגר, לא מנוי.",
  "landing.how.example": "דוגמה אמיתית מיום 1 בתוכן.",
  "landing.audience": "מחליף את “נשים וגברים בגילאי 30–55”.",
  "landing.avital": "בעמוד הנחיתה אביטל מדברת בגוף ראשון.",
  "landing.avital.media": "מציין מקום מהמפרט.",
  "landing.faq": "כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות.",
  "offer.day14.window": "hours ו־deadline מהקונפיג בצד השרת. בלי ספירה לאחור.",
  "offer.day14.session.spots": "spots מהקונפיג (10). מוצג רק אם המספר אמיתי, ראו שאלה 5.",
  "offer.day14.session.breakdown": "350 פחות 79. אצל משתתפי הפיילוט החינמי ראו שאלה 5.",
  "offer.day14.bundle.detail": "תיאור הבאנדל לא נמסר, ראו שאלה 4.",
  "offer.day14.bundle": "קישור הבאנדל עם UTM של וואטסאפ או אינסטגרם מהקונפיג.",
  "offer.yesodot": "מסלול נפרד למשלימים בלבד, לא כרטיס שלישי בהצעת יום 14.",
  "offer.yesodot.expiry": "מועד הסיום עוד פתוח.",
  "offer.yesodot.emailTiming": "מועד יציאת שני המיילים עוד פתוח.",
  "offer.pending": "מוצג כל עוד אין אימות זכאות בשרת.",
  "a11y.cup": "טקסט חלופי לאיור הכוס.",
  "a11y.action.name": "השם הנגיש של כפתור פעולה. המצב מגיע מ־aria-pressed.",
  "a11y.forms.requirementDone": "טקסט מוסתר מהעין, נקרא בקורא מסך.",
  "a11y.status": "אזור role=status מנומס. לא מכריזים על כל הקשה.",
  "a11y.live.addToCalendar7": "הטקסט הגלוי “הוספה ליומן” נמצא בתחילת השם הנגיש (WCAG 2.5.3).",
  "a11y.landing.cta": "aria-label לכפתור “אני בפנים”. הטקסט הגלוי בתחילתו.",
  "a11y.offer": "aria-label לכפתורי ההצעה, כשהטקסט הגלוי לא ברור מחוץ להקשר.",
  "a11y.forms.showConfirmPassword": "לכפתור ההצגה של שדה האימות, כדי ששני הכפתורים לא יישמעו אותו דבר.",
  "a11y.help": "מציין מקום מהמפרט. נוסח הצהרת הנגישות נכתב בשלב 10.",
};

const QUESTIONS = [
  "ניסוחי ההרגלים, התנועות והמדיטציות במפרט שונים כמעט בכל שורה מעמוד המעקב הישן (למשל “שבע דקות אור שמש” מול “7 דקות אמבטיית שמש”, “פתיחת בית החזה” מול “פתיחת לב”). נעתק מהמפרט כלשונו. ביום 13, מדיטציה, הניסוח במפרט חוזר על “הרגלים”: “שבע דקות על הרגלים וחשיבותם של הרגלים מיטיבים”. לפשט או להשאיר?",
  "בימים 7 ו־14 הלייב מחליף גם את התנועה וגם את המדיטציה. איך סימון “הייתי במפגש” מתמפה למעקב: סימון אחד שנספר כפעולה, שתי פעולות, או סימון נפרד שלא נספר? כרגע ההנחה היא שהסימון אופציונלי, שהיום נספר גם בלי הלייב כשמסמנים את ההרגל, ושבמסך היום מוצג כפתור לייב אחד.",
  "תצוגת שתי פעולות: הצעה לשלושה רבעים מהכוס (פעולה אחת חצי, שלוש מלאה). לאשר?",
  "פרטים חסרים שלא המצאתי: מה כולל הבאנדל ב־139 ₪, האם מציגים את פרטי קורס יסודות היוגה (בספר המותג יש 8 פרקים ו־30 שיעורים, אבל זה לא מהמפרט), והאם הלייב מוקלט (אם כן, אוסיף “ההקלטה תעלה לכאן אחרי המפגש”).",
  "פגישת 271 ₪: השורה “350 ₪ פחות 79 ₪” לא מסתדרת למשתתפי הפיילוט החינמי, שלא שילמו 79. להסיר את שורת החישוב ולהציג רק 271 ₪? והאם להציג “10 מקומות” בכלל, כשאין ספירה אמיתית של מקומות?",
  "הנחות החשבון: הקישור החד־פעמי ובחירת סיסמה עצמית (לא סיסמה זמנית, כמו שכתוב בתוכנית הקבצים, ולכן כאן אין מסך שינוי סיסמה). דרישות הסיסמה בעיצוב (8 תווים וספרה) לא אושרו. ועדיין פתוחים: [YESODOT_OFFER_EXPIRY] ו־[YESODOT_EMAIL_TIMING].",
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
  "תוכן 14 הימים נמצא ב־`src/content/days.ts`, מועתק מהמפרט כלשונו.",
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

lines.push("## שאלות לפית");
lines.push("");
QUESTIONS.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
lines.push("");
lines.push(`סך הכול ${total} מחרוזות.`);
lines.push("");

writeFileSync(new URL("../docs/content/COPY.md", import.meta.url), lines.join("\n"));
console.log(`wrote docs/content/COPY.md with ${total} strings`);
