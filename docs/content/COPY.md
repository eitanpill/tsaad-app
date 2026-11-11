# חוברת הקופי: צעד קטן ביום

נוצר אוטומטית מ־`src/content/copy.he.ts`. לא עורכים כאן. משנים בקוד ומריצים `node --experimental-strip-types scripts/gen-copy-deck.mjs`.

כללי הקול: רגוע, חם, ישיר, מקורקע. ניסוח ניטרלי למגדר (רבים, “אפשר”, שמות עצם). בלי הבטחות לתוצאה ובלי לחץ. בלי ספירה לאחור ובלי מספר מקומות מומצא. ערכים בסוגריים מסולסלים, כמו {day}, מתמלאים בקוד. ערכים בסוגריים מרובעים, כמו [START_DATE], הם מצייני מקום מהמפרט ולא ממציאים להם ערך.

תוכן 14 הימים נמצא ב־`src/content/days.ts`, מועתק כלשונו מקובץ התוכן של פיט מ־2026-11-10 (כולל משפט הפתיחה בצילום לכל יום).

## מותג

| מפתח | טקסט | הערות |
|---|---|---|
| `brand.name` | צעד קטן ביום |  |
| `brand.tagline` | 14 ימים של הרגל, תנועה ומדיטציה |  |
| `brand.byline` | עם אביטל פלס |  |
| `brand.pageTitle` | צעד קטן ביום, YOGIT | כותרת הדף, במקום שם העיצוב הפנימי. |

## ניווט תחתון

| מפתח | טקסט | הערות |
|---|---|---|
| `nav.today` | היום |  |
| `nav.path` | השביל |  |
| `nav.live` | לייב |  |
| `nav.reminders` | תזכורות |  |

## כללי

| מפתח | טקסט | הערות |
|---|---|---|
| `common.pauseMotion` | עצירת אנימציה |  |
| `common.retry` | לנסות שוב |  |
| `common.cancel` | ביטול |  |
| `common.undo` | ביטול הסימון |  |
| `common.close` | סגירה |  |
| `common.back` | חזרה |  |
| `common.save` | שמירה |  |
| `common.dayLabel` | יום {n} |  |
| `common.logout` | יציאה |  |
| `common.dayOfTotal` | יום {n} מתוך 14 | n מגיע מהקוד. |
| `common.countOfTotal` | {n} מתוך 14 |  |
| `common.actionTypes.habit` | הרגל |  |
| `common.actionTypes.move` | תנועה |  |
| `common.actionTypes.meditate` | מדיטציה |  |

## היום

| מפתח | טקסט | הערות |
|---|---|---|
| `today.greeting.morning` | בוקר טוב | בוקר עד 12:00, אחר כך שלום, ובערב ערב טוב. השעות לפי שעון ישראל. |
| `today.greeting.day` | שלום | בוקר עד 12:00, אחר כך שלום, ובערב ערב טוב. השעות לפי שעון ישראל. |
| `today.greeting.evening` | ערב טוב | בוקר עד 12:00, אחר כך שלום, ובערב ערב טוב. השעות לפי שעון ישראל. |
| `today.heroMorning` | הבוקר: {habit} | משתמשים בזה עד 12:00. אחרי זה heroDay. |
| `today.heroDay` | היום: {habit} |  |
| `today.heroLive` | היום יש מפגש לייב עם אביטל | בימים 7 ו־14. |
| `today.videoTitle` | התרגול של היום עם אביטל |  |
| `today.dayChip` | יום {n} |  |
| `today.counted` | ימים נספרו |  |
| `today.remaining.many` | עוד {remaining} ימים להשלמת האתגר | מחליף את “8 עד הסיום”. מבוסס על הכלל 12 מתוך 14. done מוצג מ־12 ימים ומעלה. |
| `today.remaining.one` | עוד יום אחד להשלמת האתגר | מחליף את “8 עד הסיום”. מבוסס על הכלל 12 מתוך 14. done מוצג מ־12 ימים ומעלה. |
| `today.remaining.done` | האתגר הושלם | מחליף את “8 עד הסיום”. מבוסס על הכלל 12 מתוך 14. done מוצג מ־12 ימים ומעלה. |
| `today.remaining.unreachable` | אפשר להמשיך לתרגל עד יום 14, גם בלי להשלים את האתגר. | מחליף את “8 עד הסיום”. מבוסס על הכלל 12 מתוך 14. done מוצג מ־12 ימים ומעלה. |
| `today.yesterday.prompt` | שכחת לסמן אתמול? אפשר עד חצות. |  |
| `today.yesterday.action` | לסימון אתמול |  |
| `today.afterCompletion` | אפשר להמשיך עד יום 14. |  |
| `today.ended` | האתגר הסתיים |  |
| `today.videoPending` | הסרטון יעלה לכאן בקרוב. |  |
| `today.yesterdayDayLabel` | הפעולות של יום {n} |  |
| `today.cup.empty` | כוס ריקה |  |
| `today.cup.one` | חצי כוס |  |
| `today.cup.two` | שלושה רבעים | שתי פעולות (או לייב לבד) = שלושה רבעים. אושר עם הקופי, 2026-11-08. |
| `today.cup.three` | כוס מלאה |  |
| `today.counts` | היום נחשב |  |
| `today.cupExplain` | פעולה אחת ממלאת חצי כוס, שתיים שלושה רבעים, ושלוש ממלאות אותה. כבר חצי כוס מספיקה כדי שהיום ייחשב. | מוצג פעם אחת, במסך הראשון. |
| `today.cupExplainLive` | היום יש שתי פעולות: ההרגל והלייב. הלייב נספר כשני צעדים, ויחד עם ההרגל הכוס מתמלאת. כל אחת מהן מספיקה כדי שהיום ייחשב. |  |
| `today.markHint` | מסמנים פעולה, והכוס עולה. |  |
| `today.liveAction` | לייב עם אביטל | בימים 7 ו־14 מחליף את התנועה והמדיטציה ונספר כשני צעדים בכוס (החלטת פית, 2026-11-08). |
| `today.liveActionHint` | הסימון לא חובה. |  |
| `today.greetingName` | {greeting}, {name} |  |
| `today.strip.link` | לשביל |  |
| `today.toastFirst` | צעד אחד. היום נחשב. |  |
| `today.toastFull` | הכוס מלאה. |  |
| `today.toastOffline` | יישמר כשהחיבור יחזור. | לא בשימוש: אין תור לא־מקוון (שלב 9). סימון צריך חיבור, ושגיאת שמירה מציגה “לנסות שוב”. |

## השביל

| מפתח | טקסט | הערות |
|---|---|---|
| `path.title` | השביל שלך |  |
| `path.intro` | אבן אחת בכל יום. 12 מתוך 14 מספיקות. |  |
| `path.counter` | {n} מתוך 14 |  |
| `path.stone.counted` | נספר |  |
| `path.stone.today` | היום |  |
| `path.stone.yesterday` | אפשר לסמן עד חצות | אתמול בלבד, עד חצות שעון ישראל (החלטת פית, 2026-11-08). |
| `path.stone.missed` | לא נספר | יום ישן יותר שלא סומן. סגור לסימון; הסרטון עדיין זמין לצפייה. |
| `path.stone.locked` | עוד לא נפתח |  |
| `path.liveTag` | לייב |  |
| `path.legend.counted` | נספר |  |
| `path.legend.today` | היום |  |
| `path.legend.missed` | לא נספר |  |
| `path.legend.locked` | עוד לא נפתח |  |
| `path.legend.live` | מפגש לייב |  |
| `path.completed` | {n} מתוך 14. האתגר הושלם. |  |
| `path.liveNote` | מפגשי לייב ביום 7 וביום 14. |  |

## day

| מפתח | טקסט | הערות |
|---|---|---|
| `day.videoTitle` | התרגול של יום {n} עם אביטל |  |
| `day.closedMissed` | הסימון של יום {n} נסגר, ולכן הוא לא נספר. אפשר לצפות בסרטון. |  |
| `day.closedCounted` | יום {n} נספר. הסימון נסגר, ואפשר לצפות בסרטון. |  |
| `day.notMarked` | לא סומן |  |
| `day.toPath` | חזרה לשביל |  |

## finish

| מפתח | טקסט | הערות |
|---|---|---|
| `finish.warm` | {n} ימים נספרו. צעד קטן אחרי צעד קטן, והגעתם. תודה שהייתם איתנו. |  |
| `finish.endedLine` | {n} ימים נספרו. כל צעד קטן נחשב. |  |
| `finish.countedDays` | הימים שנספרו |  |
| `finish.cups` | הכוסות שלכם |  |
| `finish.share` | שתפו |  |
| `finish.download` | להורדת התמונה |  |
| `finish.shareText` | השלמתי את צעד קטן ביום |  |
| `finish.toast` | האתגר הושלם. תודה שהייתם איתנו. |  |

## before

| מפתח | טקסט | הערות |
|---|---|---|
| `before.days` | ימים עד ההתחלה |  |
| `before.tomorrow` | מחר מתחילים |  |
| `before.today` | היום מתחילים |  |
| `before.expectHeading` | מה מחכה בכל יום |  |
| `before.prepare` | שתי הכנות קטנות |  |
| `before.remindersCta` | להפעלת תזכורות |  |
| `before.installCta` | להוספה למסך הבית |  |

## יום נעול

| מפתח | טקסט | הערות |
|---|---|---|
| `locked.title` | יום {n} נפתח מחר בבוקר |  |
| `locked.body` | הסרטון והפעולות יופיעו כאן ב־{unlockTime}. אם התזכורות פעילות, תגיע הודעה ב־{reminderTime}. | 05:00 ו־07:30 לפי ההחלטה. המשפט על ההודעה מותנה בכך שהתזכורות פעילות. |
| `locked.tomorrowTag` | נפתח מחר בבוקר |  |
| `locked.previousOpen` | את יום {prev} אפשר לסמן עד חצות |  |
| `locked.backToToday` | חזרה להיום |  |
| `locked.pastDays` | אפשר לראות שוב סרטון של יום קודם |  |
| `locked.pastDaysLink` | לצפייה בימים קודמים |  |
| `locked.schedule` | הימים נפתחים בשעה קבועה, בכל בוקר, לפי שעון ישראל. | מחליף את “השעון של השרת”. |
| `locked.farTitle` | יום {n} עוד לא נפתח |  |
| `locked.farBody` | כל בוקר ב־{unlockTime} נפתח יום אחד. אפשר לחזור מחר. |  |
| `locked.beforeStartTitle` | האתגר מתחיל ב־[START_DATE] | לפני תחילת האתגר. התאריך מהקונפיג. |
| `locked.beforeStartBody` | היום הראשון נפתח ב־[START_DATE] בשעה {unlockTime}. |  |

## לייב

| מפתח | טקסט | הערות |
|---|---|---|
| `live.title` | לייב |  |
| `live.count` | 2 מפגשים |  |
| `live.day7.tag` | מפגש לייב ביום 7 |  |
| `live.day7.title` | חצי הדרך, יחד עם אביטל |  |
| `live.day7.time` | [LIVE_DAY7_TIME] | מציין מקום מהמפרט. מוחלף מהקונפיג (LIVE_TIME_DAY7). כשלא הוגדר, המשתתפים רואים את live.timeTba. |
| `live.day7.hint` | ביום 14 יש גם הצעות להמשך, ואפשר להחליט בלי לחץ. | הרמז להצעה ביום 7, בלי פרטים. אושר עם הקופי, 2026-11-08. |
| `live.day14.tag` | מפגש לייב ביום 14 |  |
| `live.day14.title` | מפגש הסיום |  |
| `live.day14.time` | [LIVE_DAY14_TIME] | מציין מקום מהמפרט. מוחלף מהקונפיג (LIVE_TIME_DAY14). כשלא הוגדר, המשתתפים רואים את live.timeTba. |
| `live.timeTba` | השעה תפורסם בקרוב. | חדש בשלב 9 (בדיקת שער). מוצג למשתתפים כש־LIVE_TIME_DAYn לא הוגדר, במקום מציין המקום. מציין המקום נשאר בקופי ובתצורה. |
| `live.linkOpensLater` | הקישור ייפתח כאן שעה לפני המפגש. |  |
| `live.linkRegisteredOnly` | הקישור מופיע רק למי שנרשמו לאתגר. |  |
| `live.linkMissing` | הקישור למפגש עוד לא נוסף כאן. | חדש בשלב 9. החלון פתוח אבל LIVE_URL_DAYn לא הוגדר: לא ממציאים קישור ולא מבטיחים אחד. |
| `live.calendarUnavailable` | אפשר יהיה להוסיף ליומן כשהתאריך והשעה יתפרסמו. | חדש בשלב 9. אין START_DATE או LIVE_TIME_DAYn, ולכן אין קובץ יומן. |
| `live.join` | הצטרפות למפגש |  |
| `live.joinTarget` | [ZOOM_LINK] | הכפתור מוצג כלא פעיל כל עוד זה עדיין מציין מקום. |
| `live.addToCalendar` | הוספה ליומן |  |
| `live.attendedLabel` | הייתי במפגש |  |
| `live.attendedHint` | הסימון לא חובה. |  |
| `live.attendedDone` | סומן: הייתי במפגש |  |
| `live.ended` | המפגש הסתיים. |  |
| `live.cantAttend` | אי אפשר להגיע? | ללא שורת ההקלטה עד שיוחלט אם מקליטים. ראו שאלה 2. |
| `live.cantAttendBody` | אפשר לסמן את ההרגל, והיום ייספר גם בלי המפגש. |  |

## תזכורות

| מפתח | טקסט | הערות |
|---|---|---|
| `reminders.title` | תזכורת של בוקר |  |
| `reminders.intro` | הודעה אחת בכל בוקר ב־{reminderTime}, אחרי שהיום החדש נפתח. אפשר לכבות בכל רגע. |  |
| `reminders.previewLabel` | ככה זה ייראה |  |
| `reminders.toggleTitle` | התראה בטלפון |  |
| `reminders.toggleSub` | דרך האפליקציה שבמסך הבית |  |
| `reminders.whatsappTitle` | תזכורת בוואטסאפ |  |
| `reminders.timeLabel` | שעת התזכורת |  |
| `reminders.timeNote` | היום נפתח ב־{unlockTime}, והתזכורת מגיעה ב־{reminderTime}. |  |
| `reminders.iosNote` | באייפון ההתראות עובדות אחרי שמוסיפים את האפליקציה למסך הבית. |  |
| `reminders.installLink` | איך מוסיפים למסך הבית |  |
| `reminders.status.on` | ההתראות פעילות | מוצג באזור סטטוס מוקרא. |
| `reminders.status.off` | ההתראות כבויות | מוצג באזור סטטוס מוקרא. |
| `reminders.status.blocked` | ההתראות חסומות בהגדרות הטלפון | מוצג באזור סטטוס מוקרא. |
| `reminders.status.unsupported` | הדפדפן הזה לא תומך בהתראות. אפשר להוסיף את האפליקציה למסך הבית ולנסות שוב. | מוצג באזור סטטוס מוקרא. |
| `reminders.status.error` | לא הצלחנו להפעיל את ההתראות. אפשר לנסות שוב בעוד רגע. | מוצג באזור סטטוס מוקרא. |

## התקנה

| מפתח | טקסט | הערות |
|---|---|---|
| `install.title` | צעד קטן ביום, על המסך שלך |  |
| `install.lead` | כמה שלבים קצרים, ואז האפליקציה נפתחת כמו כל אפליקציה. | מחליף את “שתי לחיצות”, שלא היה מדויק. |
| `install.iphone.heading` | באייפון, בספארי |  |
| `install.iphone.step1` | לוחצים על כפתור השיתוף |  |
| `install.iphone.step1Sub` | הריבוע עם החץ, בתחתית המסך |  |
| `install.iphone.step2` | בוחרים “הוספה למסך הבית” |  |
| `install.iphone.step2Sub` | אם לא רואים, גוללים למטה ברשימה. |  |
| `install.iphone.step3` | פותחים מהאייקון החדש |  |
| `install.iphone.step3Sub` | ומאשרים התראות כשמופיעה השאלה. |  |
| `install.android.heading` | באנדרואיד |  |
| `install.android.body` | אם מופיע כפתור “התקנה”, לוחצים עליו. אם לא, פותחים את תפריט הדפדפן ובוחרים “התקנת אפליקציה” או “הוספה למסך הבית”. |  |
| `install.android.installButton` | התקנה |  |
| `install.why.heading` | בשביל התזכורת | במקום “למה זה חשוב”. הניסוח מדויק לאייפון בלבד. |
| `install.why.body` | באייפון, ככה מגיעה תזכורת הבוקר. | במקום “למה זה חשוב”. הניסוח מדויק לאייפון בלבד. |
| `install.done` | הוספתי, אפשר להתחיל |  |
| `install.later` | אחר כך |  |
| `install.installed` | האפליקציה כבר על המסך שלך. | חדש בשלב 9. מוצג במקום ההוראות כשהאפליקציה כבר נפתחה מהמסך הראשי. |

## admin

| מפתח | טקסט | הערות |
|---|---|---|
| `admin.stats.title` | סטטיסטיקה |  |
| `admin.stats.lead` | מספרים מצטברים בלבד. אין כאן שמות או פרטים אישיים. |  |
| `admin.stats.summary.heading` | במספרים |  |
| `admin.stats.summary.signedUp` | נרשמו |  |
| `admin.stats.summary.activated` | הפעילו חשבון |  |
| `admin.stats.summary.activatedLast7Days` | מתוכם הופעלו בשבוע האחרון |  |
| `admin.stats.summary.completed` | השלימו את האתגר ({done} ימים מתוך {total}) |  |
| `admin.stats.summary.remindersOptIn` | הפעילו תזכורות בטלפון |  |
| `admin.stats.perDay.heading` | פעילות לפי יום |  |
| `admin.stats.perDay.caption` | כמה משתמשים סימנו לפחות פעולה אחת בכל יום |  |
| `admin.stats.perDay.day` | יום |  |
| `admin.stats.perDay.active` | סימנו |  |
| `admin.stats.perDay.returning` | מתוכם חזרו |  |
| `admin.stats.distribution.heading` | כמה ימים נספרו |  |
| `admin.stats.distribution.caption` | משתמשים שהפעילו חשבון, לפי מספר הימים שנספרו להם |  |
| `admin.stats.distribution.counted` | ימים שנספרו |  |
| `admin.stats.distribution.users` | משתמשים |  |
| `admin.stats.offers.heading` | לחיצות על כפתורי ההצעות |  |
| `admin.stats.offers.caption` | מונים מצטברים, בלי מידע על מי לחץ |  |
| `admin.stats.offers.offer` | הצעה |  |
| `admin.stats.offers.total` | סך הכל |  |
| `admin.stats.offers.last7Days` | בשבוע האחרון |  |
| `admin.stats.offers.names.challenge` | הרשמה לאתגר (עמוד הנחיתה) |  |
| `admin.stats.offers.names.session` | פגישה אישית בזום |  |
| `admin.stats.offers.names.bundle` | באנדל |  |
| `admin.stats.offers.names.yesodot` | יסודות היוגה |  |
| `admin.stats.notes` | יום נספר מפעולה אחת ומעלה. ״חזרו״ נגזר מהסימונים: משתמש שסימן ביום הזה וגם ביום מוקדם יותר. אין מעקב אחרי כניסות, ואין עוגיות או כלי ניתוח של צד שלישי. |  |
| `admin.nav.label` | דפי הבעלים |  |
| `admin.nav.stats` | סטטיסטיקה |  |
| `admin.nav.participants` | משתתפים |  |
| `admin.participants.title` | משתתפים |  |
| `admin.participants.lead` | ניהול משתתפים ידני. הקישורים נוצרים כאן ונשלחים על ידכם בלבד: האפליקציה לא שולחת כלום. |  |
| `admin.participants.search.label` | חיפוש לפי שם, שם משתמש, אימייל או טלפון |  |
| `admin.participants.search.button` | חיפוש |  |
| `admin.participants.search.clear` | ניקוי החיפוש |  |
| `admin.participants.list.heading` | הרשימה |  |
| `admin.participants.list.count` | {n} משתתפים |  |
| `admin.participants.list.none` | אין משתתפים להצגה. |  |
| `admin.participants.list.username` | שם משתמש |  |
| `admin.participants.list.phone` | טלפון |  |
| `admin.participants.list.email` | אימייל |  |
| `admin.participants.list.created` | נרשמו |  |
| `admin.participants.list.activated` | הופעל |  |
| `admin.participants.list.disabled` | מושבת |  |
| `admin.participants.list.lastActivity` | פעילות אחרונה |  |
| `admin.participants.list.yes` | כן |  |
| `admin.participants.list.no` | לא |  |
| `admin.participants.list.never` | אין עדיין |  |
| `admin.participants.list.none2` | אין |  |
| `admin.participants.list.you` | (החשבון שלכם) |  |
| `admin.participants.list.prev` | הקודם |  |
| `admin.participants.list.next` | הבא |  |
| `admin.participants.list.pageOf` | עמוד {page} מתוך {pages} |  |
| `admin.participants.list.pagination` | דפדוף ברשימה |  |
| `admin.participants.add.heading` | הוספת משתתפת או משתתף ידנית |  |
| `admin.participants.add.name` | שם |  |
| `admin.participants.add.phone` | טלפון (אפשר להשאיר ריק אם יש אימייל) |  |
| `admin.participants.add.email` | אימייל (אפשר להשאיר ריק אם יש טלפון) |  |
| `admin.participants.add.submit` | יצירה וקבלת קישור |  |
| `admin.participants.add.note` | שם משתמש נוצר אוטומטית, באותו כלל כמו בהרשמה האוטומטית. |  |
| `admin.participants.link.showOnce` | הקישור מוצג פעם אחת. שלחו אותו בעצמכם בוואטסאפ או במייל. |  |
| `admin.participants.link.forActivate` | קישור הפעלה עבור {name} (שם משתמש: {username}). בתוקף עד {until}. |  |
| `admin.participants.link.forReset` | קישור לאיפוס סיסמה עבור {name} (שם משתמש: {username}). בתוקף עד {until}. |  |
| `admin.participants.link.label` | הקישור |  |
| `admin.participants.link.copy` | העתקת הקישור |  |
| `admin.participants.link.copied` | הקישור הועתק |  |
| `admin.participants.link.copyFailed` | ההעתקה לא הצליחה. סמנו את הקישור והעתיקו ידנית. |  |
| `admin.participants.link.issueActivate` | קישור הפעלה חדש |  |
| `admin.participants.link.issueReset` | קישור איפוס סיסמה |  |
| `admin.participants.link.issueActivateFor` | קישור הפעלה חדש עבור {name} |  |
| `admin.participants.link.issueResetFor` | קישור איפוס סיסמה עבור {name} |  |
| `admin.participants.disable.button` | השבתה |  |
| `admin.participants.disable.enable` | הפעלה מחדש |  |
| `admin.participants.disable.buttonFor` | השבתה של {name} |  |
| `admin.participants.disable.enableFor` | הפעלה מחדש של {name} |  |
| `admin.participants.disable.hint` | משתמש מושבת לא יכול להיכנס, נותקים אותו מיד, והוא לא מקבל תזכורות או קישורים. |  |
| `admin.participants.remove.button` | מחיקה |  |
| `admin.participants.remove.buttonFor` | מחיקה של {name} |  |
| `admin.participants.remove.heading` | מחיקה לצמיתות |  |
| `admin.participants.remove.warning` | מחיקת {name} היא לצמיתות: כל הנתונים של המשתתף או המשתתפת נמחקים, ואי אפשר לשחזר. כדי לאשר, הקלידו את שם המשתמש ({username}). |  |
| `admin.participants.remove.confirmLabel` | שם המשתמש לאישור |  |
| `admin.participants.remove.submit` | מחיקה סופית |  |
| `admin.participants.remove.cancel` | ביטול |  |
| `admin.participants.preview.heading` | תצוגה מקדימה של יום |  |
| `admin.participants.preview.lead` | לבדיקת האפליקציה לפני ההתחלה: ממשיכים לראות את מסכי היום, השביל והלייב כאילו זה יום מסוים. רק אצלכם, רק בחשבון המחובר. סימונים שתעשו נשמרים בחשבון שלכם. |  |
| `admin.participants.preview.dayLabel` | יום |  |
| `admin.participants.preview.start` | הפעלת תצוגה מקדימה |  |
| `admin.participants.preview.stop` | הפסקת התצוגה המקדימה |  |
| `admin.participants.preview.active` | תצוגה מקדימה פעילה: יום {n}. |  |
| `admin.participants.preview.toToday` | למסך היום |  |
| `admin.participants.errors.generic` | משהו השתבש. נסו שוב. |  |
| `admin.participants.errors.forbidden` | הבקשה נדחתה. |  |
| `admin.participants.errors.tooMany` | יותר מדי פעולות בזמן קצר. נסו שוב בעוד כמה דקות. |  |
| `admin.participants.errors.invalidName` | הכניסו שם. |  |
| `admin.participants.errors.invalidContact` | הכניסו טלפון תקין או אימייל תקין (לפחות אחד). |  |
| `admin.participants.errors.notFound` | המשתתף לא נמצא. |  |
| `admin.participants.errors.self` | אי אפשר לבצע את זה על החשבון שלכם. |  |
| `admin.participants.errors.disabledUser` | החשבון מושבת. הפעילו אותו מחדש כדי להנפיק קישור. |  |
| `admin.participants.errors.confirmMismatch` | שם המשתמש שהוקלד לא תואם. לא נמחק כלום. |  |
| `admin.participants.errors.invalidDay` | בחרו יום בין 1 ל־14. |  |
| `admin.participants.done.disabled` | {name} הושבת/ה. |  |
| `admin.participants.done.enabled` | {name} הופעל/ה מחדש. |  |
| `admin.participants.done.deleted` | המשתתף נמחק. |  |
| `admin.participants.done.previewStopped` | התצוגה המקדימה הופסקה. |  |
| `admin.previewBanner.text` | מצב תצוגה מקדימה: יום {n} |  |
| `admin.previewBanner.label` | תצוגה מקדימה |  |
| `admin.previewBanner.stop` | הפסקה |  |
| `admin.previewBanner.stopLabel` | הפסקה של מצב התצוגה המקדימה |  |

## כניסה

| מפתח | טקסט | הערות |
|---|---|---|
| `login.title` | כניסה לאתגר |  |
| `login.lead` | אפשר להיכנס עם שם המשתמש מההודעה שקיבלתם, או עם הטלפון או המייל שמסרתם בהרשמה, והסיסמה שבחרתם. |  |
| `login.username.label` | שם משתמש, טלפון או מייל |  |
| `login.password.label` | סיסמה |  |
| `login.submit` | כניסה |  |
| `login.submitting` | נכנסים… |  |
| `login.forgot` | שכחתי סיסמה |  |
| `login.firstTime.heading` | כניסה ראשונה? |  |
| `login.firstTime.body` | אחרי ההרשמה מגיע קישור אישי בוואטסאפ ובמייל. דרכו בוחרים סיסמה, ומכאן נכנסים איתה. |  |
| `login.notRegistered` | עוד לא נרשמתם? |  |
| `login.toLanding` | לפרטים על האתגר |  |
| `login.errors.usernameRequired` | יש להזין שם משתמש, טלפון או מייל. |  |
| `login.errors.passwordRequired` | יש להזין סיסמה. |  |
| `login.errors.invalid` | הפרטים או הסיסמה לא נכונים | אותו משפט לשני השדות, בכוונה. לא חושף מה שגוי. |
| `login.errors.tooMany` | היו כמה ניסיונות ברצף. אפשר לנסות שוב בעוד כמה דקות. |  |
| `login.errors.tooManyReset` | אפשר גם להיכנס עכשיו דרך |  |
| `login.errors.network` | אין חיבור כרגע. אפשר לנסות שוב כשהחיבור יחזור. |  |
| `login.errors.generic` | משהו לא עבד. אפשר לנסות שוב בעוד רגע. |  |

## הפעלה וקביעת סיסמה (מהקישור החד־פעמי)

| מפתח | טקסט | הערות |
|---|---|---|
| `activate.title` | בוחרים סיסמה ומתחילים |  |
| `activate.greeting` | שלום, כמה טוב שהגעתם |  |
| `activate.username.label` | שם המשתמש |  |
| `activate.username.hint` | נקבע בהרשמה ולא ניתן לשינוי. |  |
| `activate.password.label` | בחירת סיסמה |  |
| `activate.password.requirementsTitle` | דרישות לסיסמה |  |
| `activate.password.minLength` | לפחות 8 תווים | דרישות הסיסמה הן הצעה מהעיצוב. ראו שאלה 3. |
| `activate.password.digit` | לפחות ספרה אחת |  |
| `activate.confirm.label` | אימות הסיסמה |  |
| `activate.submit` | שמירה וכניסה |  |
| `activate.submitting` | שומרים… |  |
| `activate.success` | הסיסמה נשמרה. נכנסים לאתגר. |  |
| `activate.errors.passwordRequired` | יש לבחור סיסמה. |  |
| `activate.errors.tooShort` | הסיסמה קצרה מדי. נדרשים לפחות 8 תווים. |  |
| `activate.errors.noDigit` | הסיסמה צריכה לכלול לפחות ספרה אחת. |  |
| `activate.errors.tooLong` | הסיסמה ארוכה מדי. אפשר עד 128 תווים. |  |
| `activate.errors.sameAsUsername` | הסיסמה לא יכולה להיות זהה לשם המשתמש. |  |
| `activate.errors.confirmRequired` | יש להקליד את הסיסמה שוב. |  |
| `activate.errors.mismatch` | הסיסמאות לא זהות. כדאי להקליד שוב. |  |
| `activate.errors.network` | אין חיבור כרגע. אפשר לנסות שוב כשהחיבור יחזור. |  |
| `activate.errors.generic` | משהו לא עבד. אפשר לנסות שוב בעוד רגע. |  |
| `activate.expired.heading` | הקישור כבר לא בתוקף | מוצג במקום הטופס כשהקישור לא תקף או כבר נוצל. |
| `activate.expired.body` | הקישור עובד פעם אחת ולזמן מוגבל. אפשר לבקש קישור חדש לוואטסאפ ולמייל שמסרתם בהרשמה. | מוצג במקום הטופס כשהקישור לא תקף או כבר נוצל. |
| `activate.expired.action` | שליחת קישור חדש | מוצג במקום הטופס כשהקישור לא תקף או כבר נוצל. |

## שכחתי סיסמה

| מפתח | טקסט | הערות |
|---|---|---|
| `forgot.title` | שכחתי סיסמה |  |
| `forgot.lead` | כותבים את שם המשתמש, הטלפון או המייל, ונשלח לכם קישור לבחירת סיסמה חדשה. |  |
| `forgot.field.label` | שם משתמש, טלפון או מייל |  |
| `forgot.field.hint` | אותם פרטים שמסרתם בהרשמה. |  |
| `forgot.submit` | שליחת קישור |  |
| `forgot.submitting` | שולחים… |  |
| `forgot.backToLogin` | חזרה לכניסה |  |
| `forgot.errors.required` | יש להזין שם משתמש, טלפון או מייל. |  |
| `forgot.errors.tooMany` | היו כמה בקשות ברצף. אפשר לנסות שוב בעוד כמה דקות. |  |
| `forgot.errors.network` | אין חיבור כרגע. אפשר לנסות שוב כשהחיבור יחזור. |  |
| `forgot.errors.generic` | משהו לא עבד. אפשר לנסות שוב בעוד רגע. |  |
| `forgot.confirmation.heading` | אם הפרטים נכונים, יגיע קישור | אותו נוסח בדיוק בין אם יש חשבון ובין אם אין. |
| `forgot.confirmation.body` | אם יש חשבון עם הפרטים האלה, הקישור נשלח לוואטסאפ ולמייל שמסרתם בהרשמה, ובדרך כלל מגיע תוך כמה דקות. לא הגיע? כדאי לבדוק גם בתיקיית הספאם. | אותו נוסח בדיוק בין אם יש חשבון ובין אם אין. |
| `forgot.confirmation.resend` | שליחה מחדש | אותו נוסח בדיוק בין אם יש חשבון ובין אם אין. |
| `forgot.confirmation.resendWait` | אפשר לשלוח שוב בעוד {seconds} שניות | seconds מהמגבלה בפועל. |
| `forgot.forgotUsername.heading` | לא זוכרים את שם המשתמש? |  |
| `forgot.forgotUsername.body` | הוא מופיע בהודעה ששלחנו אחרי ההרשמה, בוואטסאפ ובמייל. |  |

## מצבים: שגיאה, אין חיבור, טעינה, הצלחה

| מפתח | טקסט | הערות |
|---|---|---|
| `states.videoError.heading` | הסרטון לא נטען |  |
| `states.videoError.body` | משהו השתבש בדרך. אפשר לנסות שוב בעוד רגע. |  |
| `states.videoError.retry` | לנסות שוב |  |
| `states.genericError.heading` | משהו לא עבד |  |
| `states.genericError.body` | אפשר לנסות שוב בעוד רגע. |  |
| `states.offline.heading` | אין חיבור לאינטרנט | שלב 9: אין תור לא־מקוון, ולכן הנוסח כבר לא מבטיח שמירה. אותו טקסט ב־public/offline.html (נבדק בבדיקה). |
| `states.offline.body` | סימון צריך חיבור לאינטרנט. כשהוא חוזר, אפשר לחזור ולסמן. | שלב 9: אין תור לא־מקוון, ולכן הנוסח כבר לא מבטיח שמירה. אותו טקסט ב־public/offline.html (נבדק בבדיקה). |
| `states.offline.back` | החיבור חזר. | שלב 9: אין תור לא־מקוון, ולכן הנוסח כבר לא מבטיח שמירה. אותו טקסט ב־public/offline.html (נבדק בבדיקה). |
| `states.loading` | טוענים את היום… |  |
| `states.saveFailed` | הסימון לא נשמר. אפשר לנסות שוב. |  |
| `states.saving` | שומרים… |  |
| `states.sessionEnded.heading` | ההתחברות הסתיימה |  |
| `states.sessionEnded.body` | אפשר להיכנס שוב ולהמשיך מאותו מקום. |  |
| `states.sessionEnded.action` | כניסה |  |
| `states.notFound.heading` | הדף לא נמצא |  |
| `states.notFound.body` | אולי הקישור השתנה. אפשר לחזור למסך היום. |  |
| `states.notFound.action` | חזרה להיום |  |
| `states.success.saved` | נשמר. הכוס עלתה. |  |
| `states.success.undo` | ביטול הסימון |  |
| `states.success.undone` | הסימון בוטל. |  |

## התראת בוקר (07:30)

| מפתח | טקסט | הערות |
|---|---|---|
| `push.title` | צעד קטן ביום |  |
| `push.generic` | יום {day} נפתח. דבר אחד קטן מספיק. | ברירת המחדל. דבר אחד קטן מספיק. |
| `push.perDay` | יום {day} נפתח. הרגל להיום: {habit}. | אופציונלי. נגזר מכותרת ההרגל של היום ב־days.ts, בלי טענות נוספות. |
| `push.liveDay` | יום {day} נפתח. היום יש מפגש לייב עם אביטל ב־{time}. | בימים 7 ו־14. time מהקונפיג. |
| `push.previewDay` | 5 | היום שמוצג בתצוגה המקדימה במסך התזכורות. |

## הודעות שהמערכת החיצונית תשלח (טיוטה, לא נשלח)

| מפתח | טקסט | הערות |
|---|---|---|
| `messages.status` | draft, not sent | כל ההודעות כאן הן טיוטה. אין שליחה. |
| `messages.activation.whatsapp` | שלום {name}, כמה טוב שהגעתם לצעד קטן ביום.<br>שם המשתמש: {username} (אפשר להיכנס גם עם הטלפון או המייל)<br>הקישור האישי לבחירת סיסמה: {link}<br>הקישור עובד פעם אחת ולזמן מוגבל. הוא אישי, ולא כדאי להעביר אותו לאף אחד.<br>האתגר מתחיל ב־[START_DATE]. | קישור חד־פעמי. אחריו בוחרים סיסמה לבד. אין סיסמה בהודעה, ויש בה בקשה לא להעביר את הקישור. |
| `messages.activation.emailSubject` | הקישור שלכם לצעד קטן ביום | קישור חד־פעמי. אחריו בוחרים סיסמה לבד. אין סיסמה בהודעה, ויש בה בקשה לא להעביר את הקישור. |
| `messages.activation.emailBody` | שלום {name},<br><br>כמה טוב שהגעתם לצעד קטן ביום.<br><br>שם המשתמש: {username} (אפשר להיכנס גם עם הטלפון או המייל)<br>לבחירת סיסמה ולכניסה: {link}<br><br>הקישור עובד פעם אחת ולזמן מוגבל. הוא אישי, ולא כדאי להעביר אותו לאף אחד. אם הוא כבר לא בתוקף, אפשר לבקש חדש במסך הכניסה, דרך “שכחתי סיסמה”.<br>האתגר מתחיל ב־[START_DATE].<br><br>אביטל, YOGIT | קישור חד־פעמי. אחריו בוחרים סיסמה לבד. אין סיסמה בהודעה, ויש בה בקשה לא להעביר את הקישור. |
| `messages.forgot.whatsapp` | שלום {name}, התקבלה בקשה לבחירת סיסמה חדשה.<br>הקישור: {link}<br>הוא עובד פעם אחת ולזמן מוגבל, ולא כדאי להעביר אותו לאף אחד. אם לא ביקשתם, אפשר להתעלם מההודעה. | נשלח רק כשיש חשבון, ורק לוואטסאפ ולמייל שנמסרו בהרשמה. המסך מציג תמיד את אותו אישור, ולכן הוא לא חושף אם יש חשבון. בלי סיסמה בהודעה. |
| `messages.forgot.emailSubject` | בחירת סיסמה חדשה לצעד קטן ביום | נשלח רק כשיש חשבון, ורק לוואטסאפ ולמייל שנמסרו בהרשמה. המסך מציג תמיד את אותו אישור, ולכן הוא לא חושף אם יש חשבון. בלי סיסמה בהודעה. |
| `messages.forgot.emailBody` | שלום {name},<br><br>התקבלה בקשה לבחירת סיסמה חדשה.<br>הקישור: {link}<br><br>הוא עובד פעם אחת ולזמן מוגבל, ולא כדאי להעביר אותו לאף אחד. אם לא ביקשתם, אפשר להתעלם מההודעה, והסיסמה הקיימת תישאר כמו שהיא.<br><br>שם המשתמש שלכם: {username} | נשלח רק כשיש חשבון, ורק לוואטסאפ ולמייל שנמסרו בהרשמה. המסך מציג תמיד את אותו אישור, ולכן הוא לא חושף אם יש חשבון. בלי סיסמה בהודעה. |
| `messages.day14.whatsapp` | יום 14, והגעתם לסוף. תודה שהייתם איתנו.<br>אפשר להמשיך בשתי דרכים:<br>פגישת זום אישית של 45 דקות, 271 ₪: {sessionLink}<br>באנדל של הקורסים “לשחרר את הכיסא” ו“ריסט”, 139 ₪: {bundleLink}<br>ההצעה פתוחה {hours} שעות מסוף הלייב.<br><br>ובנפרד, למי שרוצה להעמיק: מסלול יסודות היוגה, 1,265 ₪, באותו חלון זמן: {yesodotLink} | ההודעה הוגדרה במפרט. הנוסח טיוטה. Pit 2026-11-11: valid 48h from the end of the challenge, same window as the day-14 offers; no strikethrough price. |
| `messages.sessionReminder.whatsapp` | תזכורת: ההצעה לפגישת הזום האישית פתוחה עוד 24 שעות.<br>פגישה של 45 דקות, 271 ₪: {sessionLink}<br>באנדל של הקורסים “לשחרר את הכיסא” ו“ריסט”, 139 ₪: {bundleLink} | 24 שעות לפני סוף חלון ההצעה. שורת יסודות לכל המשתתפים, מוצגת בנפרד (החלטת פית, 2026-11-08). |
| `messages.sessionReminder.yesodotLine` | גם המחיר של מסלול יסודות היוגה, 1,265 ₪, תקף עוד 24 שעות: {yesodotLink} | 24 שעות לפני סוף חלון ההצעה. שורת יסודות לכל המשתתפים. Pit 2026-11-11: valid 48h from the end of the challenge, same window as the day-14 offers; no strikethrough price. |

## עמוד נחיתה /tsaad

| מפתח | טקסט | הערות |
|---|---|---|
| `landing.meta.title` | צעד קטן ביום: 14 ימים של הרגל, תנועה ומדיטציה \| YOGIT |  |
| `landing.meta.description` | 14 ימים, אבן אחת בכל יום. הרגל, תנועה ומדיטציה עם אביטל פלס. ההרשמה 79 ₪. |  |
| `landing.hero.title` | צעד קטן ביום |  |
| `landing.hero.subtitle` | 14 ימים של הרגל, תנועה ומדיטציה |  |
| `landing.hero.lead` | 14 ימים, אבן אחת בכל יום. דבר אחד קטן מספיק. |  |
| `landing.hero.cta` | אני בפנים |  |
| `landing.hero.ctaTarget` | [MORNING_URL_CHALLENGE_79] | הכפתור לא פעיל כל עוד זה מציין מקום. |
| `landing.hero.ctaDisabledNote` | ההרשמה תיפתח כאן. |  |
| `landing.hero.closed` | ההרשמה למחזור הזה נסגרה |  |
| `landing.hero.closedNext` | לעדכון על המחזור הבא |  |
| `landing.hero.price` | ההרשמה לאתגר היא 79 ₪. זה אינו מנוי. | 79 ₪ הרשמה לאתגר, לא מנוי. |
| `landing.hero.start` | האתגר מתחיל ב־[START_DATE]. |  |
| `landing.hero.startTba` | תאריך ההתחלה יפורסם בקרוב. | חדש בשלב 10. מוצג כש־START_DATE לא הוגדר, במקום השורה עם [START_DATE]. |
| `landing.hero.haveAccount` | כבר נרשמתם? |  |
| `landing.hero.login` | כניסה |  |
| `landing.how.heading` | איך זה עובד |  |
| `landing.how.lead` | שלוש פעולות ביום, ופעולה אחת מספיקה כדי שהיום ייחשב. |  |
| `landing.how.habit` | הרגל קטן |  |
| `landing.how.move` | תנועה |  |
| `landing.how.meditate` | מדיטציה |  |
| `landing.how.example` | למשל ביום 1: כוס מים חמימים עם לימון כשקמים, מתיחת בוקר עדינה בעמידה ודקה של נשימה עם כוס המים. | דוגמה אמיתית מיום 1 בתוכן. |
| `landing.how.completion` | 12 ימים מתוך 14 מספיקים כדי להשלים את האתגר. |  |
| `landing.how.daily` | כל יום נפתח ב־{unlockTime}. אם מפעילים תזכורת, מגיעה הודעה ב־{reminderTime}. |  |
| `landing.how.access` | אחרי ההרשמה מגיע קישור אישי בוואטסאפ ובמייל. דרכו בוחרים סיסמה ונכנסים. |  |
| `landing.map.heading` | מה יש ב־14 הימים |  |
| `landing.map.lead` | ביום 7 וביום 14 נפגשים בלייב עם אביטל. |  |
| `landing.map.liveTitle` | לייב עם אביטל |  |
| `landing.audience.heading` | למי זה מתאים | מחליף את “נשים וגברים בגילאי 30–55”. |
| `landing.audience.body` | למי שרוצה להתחיל בקטן. לא צריך ניסיון קודם ולא צריך גמישות. | מחליף את “נשים וגברים בגילאי 30–55”. |
| `landing.avital.heading` | אביטל פלס | בעמוד הנחיתה אביטל מדברת בגוף ראשון. |
| `landing.avital.body` | אני מורה ליוגה, ו־YOGIT היא יוגה לאנשים חושבים. ביום 7 וביום 14 אני איתכם בלייב. | בעמוד הנחיתה אביטל מדברת בגוף ראשון. |
| `landing.avital.media` | [MEDIA_*] | מציין מקום מהמפרט. |
| `landing.lives.heading` | שני מפגשי לייב |  |
| `landing.lives.day7` | יום 7: [LIVE_DAY7_TIME] |  |
| `landing.lives.day14` | יום 14: [LIVE_DAY14_TIME] |  |
| `landing.lives.note` | הקישור למפגש מופיע באפליקציה, למי שנרשמו לאתגר. |  |
| `landing.faq.heading` | שאלות ותשובות | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.0.q` | כמה זה עולה? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.0.a` | ההרשמה לאתגר היא 79 ₪. זה אינו מנוי. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.1.q` | מה נחשב יום? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.1.a` | מסמנים פעולה אחת, והיום נספר. שלוש פעולות ממלאות את הכוס, אבל אחת מספיקה. בימי הלייב, המפגש נספר כשני צעדים. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.2.q` | מה צריך כדי להשלים? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.2.a` | 12 ימים מתוך 14. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.3.q` | ואם יום אחד לא הולך? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.3.a` | יש מקום ל־2 ימים שלא נספרו. שכחת לסמן? אפשר לסמן את אתמול עד חצות. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.4.q` | איך נכנסים? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.4.a` | אחרי ההרשמה מגיע קישור אישי בוואטסאפ ובמייל. דרכו בוחרים סיסמה. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.5.q` | צריך להתקין משהו? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.5.a` | אפשר להשתמש בדפדפן. כדי לקבל תזכורת בבוקר, מוסיפים את האפליקציה למסך הבית. באייפון זה נדרש. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.6.q` | מה קורה ביום 14? | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.faq.items.6.a` | יש מפגש סיום בלייב, ואחריו הצעות להמשך למי שרוצה. | כל התשובות נגזרות מההחלטות. אין בהן טענות חדשות. |
| `landing.close.heading` | מתחילים ב־[START_DATE] |  |
| `landing.close.headingTba` | מתחילים בקרוב | חדש בשלב 10. מוצג כש־START_DATE לא הוגדר. |
| `landing.close.body` | צעד קטן ביום. מתחילים בקטן. |  |
| `landing.close.cta` | אני בפנים |  |
| `landing.footer.nav` | מידע משפטי וכניסה | חדש בשלב 10: תחתית הדף הציבורי. |
| `landing.footer.accessibility` | הצהרת נגישות | חדש בשלב 10: תחתית הדף הציבורי. |
| `landing.footer.privacy` | מדיניות פרטיות | חדש בשלב 10: תחתית הדף הציבורי. |
| `landing.footer.terms` | תנאי שימוש | חדש בשלב 10: תחתית הדף הציבורי. |
| `landing.footer.login` | כניסה למשתתפים | חדש בשלב 10: תחתית הדף הציבורי. |
| `landing.footer.copyright` | YOGIT, אביטל פלס | חדש בשלב 10: תחתית הדף הציבורי. |
| `landing.illustration` | אילוסטרציה של המסך היומי | חדש בשלב 10: תווית הרשימה המאוירת ב״איך זה עובד״. |

## הצעת יום 14 ויסודות היוגה

| מפתח | טקסט | הערות |
|---|---|---|
| `offer.notYet.heading` | ההצעה תופיע כאן ביום 14 |  |
| `offer.notYet.body` | אחרי מפגש הסיום נפתחות אפשרויות להמשך. |  |
| `offer.day14.heading` | ההמשך אחרי 14 הימים |  |
| `offer.day14.lead` | שתי אפשרויות. אפשר לבחור אחת, או לא לבחור. |  |
| `offer.day14.window` | ההצעה פתוחה {hours} שעות מסוף הלייב, עד {deadline}. | hours ו־deadline מהקונפיג בצד השרת. בלי ספירה לאחור. |
| `offer.day14.session.title` | פגישת זום אישית |  |
| `offer.day14.session.detail` | 45 דקות עם אביטל. שיחה אישית והכוונה להמשך. |  |
| `offer.day14.session.price` | 271 ₪ |  |
| `offer.day14.session.scope` | המחיר הזה תקף לכל מי שהשתתפו באתגר. |  |
| `offer.day14.session.spots` | {spots} מקומות. | spots מהקונפיג. מוצג רק אם יש מגבלה אמיתית, ראו שאלה 1. |
| `offer.day14.session.cta` | לקביעת הפגישה |  |
| `offer.day14.session.ctaTarget` | [MORNING_URL_SESSION_271] |  |
| `offer.day14.session.utm` | [UTM_SESSION] |  |
| `offer.day14.bundle.title` | באנדל שני קורסים | קישור הבאנדל עם UTM של וואטסאפ או אינסטגרם מהקונפיג. |
| `offer.day14.bundle.detail` | הקורסים “לשחרר את הכיסא” ו“ריסט”. | לפי פית: הקורסים “לשחרר את הכיסא” ו“ריסט”. |
| `offer.day14.bundle.price` | 139 ₪ | קישור הבאנדל עם UTM של וואטסאפ או אינסטגרם מהקונפיג. |
| `offer.day14.bundle.cta` | לפרטים ולהזמנה | קישור הבאנדל עם UTM של וואטסאפ או אינסטגרם מהקונפיג. |
| `offer.day14.bundle.ctaTarget` | [MORNING_URL_BUNDLE_139] | חדש בשלב 10. מציין מקום; הכפתור לא פעיל עד שמוגדר MORNING_URL_BUNDLE_139. |
| `offer.day14.bundle.utm` | [UTM_BUNDLE] | חדש בשלב 10. ערך utm_campaign מהקונפיג (OFFER_UTM_BUNDLE). |
| `offer.day14.disabled` | הכפתור יהיה פעיל כשהקישור יהיה מוכן. |  |
| `offer.day14.expired` | ההצעה הסתיימה. |  |
| `offer.yesodot.heading` | יסודות היוגה | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.lead` | מסלול ההמשך, פתוח לכל מי שהשתתפו באתגר. | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.price` | 1,265 ₪ | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.priceNote` | מחיר למשתתפי האתגר. | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.expiry` | המחיר הזה תקף עד {until}. | Pit 2026-11-11: valid 48h from the end of the challenge, same window as the day-14 offers; no strikethrough price. {until} הוא מועד סוף חלון יום 14. |
| `offer.yesodot.cta` | להרשמה ליסודות היוגה | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.ctaTarget` | [MORNING_URL_YESODOT_1265] | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.utm` | [UTM_YESODOT] | פתוח לכל המשתתפים (החלטת פית, 2026-11-08). האתגר מוביל ליסודות. |
| `offer.yesodot.emailTiming` | [YESODOT_EMAIL_TIMING] | מועד יציאת שני המיילים עוד פתוח. ראו שאלה 3. |
| `offer.yesodot.expiryTba` | תוקף המחיר יפורסם בקרוב. | חדש בשלב 10. מוצג כשאי אפשר לחשב את חלון יום 14 (חסר START_DATE או LIVE_TIME_DAY14), במקום expiry. |
| `offer.yesodot.expired` | המחיר הזה כבר לא תקף. | חדש בשלב 10. אחרי תום התוקף: בלי כפתור. |
| `offer.yesodot.more` | לפרטים על יסודות היוגה | חדש בשלב 10. כפתור בתקציר שבמסך ההצעות, מוביל ל־/yesodot. |
| `offer.yesodot.disabled` | הכפתור יהיה פעיל כשהקישור יהיה מוכן. | חדש בשלב 10 (כפל של offer.day14.disabled, למסך הנפרד). |
| `offer.entry.cta` | לצפייה בהצעות | חדש בשלב 10. אריח קטן במסך היום ביום 14 ואחריו. |

## החשבון ומחיקת חשבון (חדש בשלב 10)

| מפתח | טקסט | הערות |
|---|---|---|
| `account.title` | החשבון שלי | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.footerLink` | החשבון שלי | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.legalLink` | פרטיות ונגישות | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.details.heading` | פרטי החשבון | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.details.username` | שם משתמש | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.details.displayName` | שם | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.logout.heading` | יציאה | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.logout.lead` | היציאה מנתקת את ההתחברות במכשיר הזה. אפשר להיכנס שוב בכל זמן. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.legal.heading` | פרטיות ונגישות | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.legal.privacy` | מדיניות פרטיות | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.legal.accessibility` | הצהרת נגישות | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.legal.terms` | תנאי שימוש | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.heading` | מחיקת חשבון | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.lead` | אפשר למחוק את החשבון בכל זמן. המחיקה סופית ואי אפשר לשחזר אותה. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.whatHeading` | מה נמחק | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.whatItems.0` | שם המשתמש, השם, האימייל והטלפון שנשמרו באפליקציה. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.whatItems.1` | הסימונים וההתקדמות באתגר. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.whatItems.2` | ההתחברויות והתראות הטלפון. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.remains` | פרטי הקשר נשמרים גם במערכת ההרשמה של YOGIT, מחוץ לאפליקציה. מחיקה משם נעשית בפנייה אל YOGIT. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.passwordLabel` | סיסמה | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.passwordHint` | כדי למחוק צריך להקליד את הסיסמה של החשבון. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.submit` | מחיקת החשבון | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.busy` | מוחקים… | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.errors.required` | צריך להקליד את הסיסמה. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.errors.invalid` | הסיסמה לא נכונה. אפשר לנסות שוב. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.errors.tooMany` | יותר מדי ניסיונות. אפשר לנסות שוב בעוד כמה דקות. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.delete.errors.generic` | משהו לא עבד, והחשבון לא נמחק. אפשר לנסות שוב. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.deleted.title` | החשבון נמחק | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.deleted.body` | כל מה שנשמר באפליקציה נמחק, וההתחברות הסתיימה. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.deleted.outside` | פרטי הקשר נשמרים גם במערכת ההרשמה של YOGIT, מחוץ לאפליקציה. מחיקה משם נעשית בפנייה אל YOGIT. | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.deleted.toLanding` | לדף האתגר | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |
| `account.deleted.toPrivacy` | מדיניות פרטיות | חדש בשלב 10. נוסח מחיקת החשבון: מה נמחק ומה נשאר מחוץ לאפליקציה (במערכת ההרשמה); דורש אישור הבעלים ובדיקה משפטית. |

## דפים משפטיים: מילות ממשק (חדש בשלב 10)

| מפתח | טקסט | הערות |
|---|---|---|
| `legal.indexTitle` | מידע משפטי |  |
| `legal.indexLead` | הצהרת הנגישות, מדיניות הפרטיות ותנאי השימוש של האפליקציה. |  |
| `legal.updated` | עודכן לאחרונה: {date} |  |
| `legal.toc` | בדף הזה |  |
| `legal.back` | חזרה למידע המשפטי |  |
| `legal.contactLabel` | ליצירת קשר |  |
| `legal.contactTba` | פרטי הקשר ייוספו כאן בקרוב. | חדש בשלב 10. מוצג כשפרט הקשר לא הוגדר בקונפיג, במקום [ACCESSIBILITY_CONTACT], [PRIVACY_CONTACT] או [SUPPORT_CONTACT]. |
| `legal.home` | לדף האתגר |  |

## נגישות: תוויות, טקסט לקורא מסך, הודעות חיות

| מפתח | טקסט | הערות |
|---|---|---|
| `a11y.strip.region` | השביל של 14 הימים |  |
| `a11y.strip.counted` | יום {day} מתוך 14, {counted} ימים נספרו |  |
| `a11y.strip.oneCounted` | יום {day} מתוך 14, יום אחד נספר |  |
| `a11y.strip.noDay` | {counted} ימים נספרו מתוך 14 |  |
| `a11y.skipLink` | דילוג לתוכן |  |
| `a11y.mainNav` | ניווט ראשי |  |
| `a11y.logo` | YOGIT |  |
| `a11y.logoHome` | YOGIT, למסך היום |  |
| `a11y.pauseMotion` | עצירת אנימציה |  |
| `a11y.ring` | {n} מתוך 14 ימים |  |
| `a11y.cup.empty` | הכוס של היום, ריקה | טקסט חלופי לאיור הכוס. |
| `a11y.cup.one` | הכוס של היום, חצי מלאה | טקסט חלופי לאיור הכוס. |
| `a11y.cup.two` | הכוס של היום, שלושה רבעים | טקסט חלופי לאיור הכוס. |
| `a11y.cup.three` | הכוס של היום, מלאה | טקסט חלופי לאיור הכוס. |
| `a11y.action.name` | {type}, {title} | השם הנגיש של כפתור פעולה. המצב מגיע מ־aria-pressed. |
| `a11y.action.pressedHint` | סומן |  |
| `a11y.video.play` | הפעלת סרטון יום {n} |  |
| `a11y.video.frameTitle` | סרטון התרגול של יום {n} |  |
| `a11y.path.summary` | 14 ימים, {counted} נספרו. מפגשי לייב ביום 7 וביום 14 |  |
| `a11y.path.stone` | יום {n}, {state} |  |
| `a11y.path.stoneLive` | יום {n}, לייב, {state} |  |
| `a11y.locked.time` | נפתח מחר בבוקר ב־{unlockTime} |  |
| `a11y.live.addToCalendar7` | הוספה ליומן: המפגש ביום 7 | הטקסט הגלוי “הוספה ליומן” נמצא בתחילת השם הנגיש (WCAG 2.5.3). |
| `a11y.live.addToCalendar14` | הוספה ליומן: המפגש ביום 14 |  |
| `a11y.live.join7` | הצטרפות למפגש של יום 7 |  |
| `a11y.live.join14` | הצטרפות למפגש של יום 14 |  |
| `a11y.live.joinDisabled` | ההצטרפות עוד לא זמינה. הקישור ייפתח שעה לפני המפגש. |  |
| `a11y.live.joinOpened` | הקישור למפגש פתוח |  |
| `a11y.live.attended` | סימון: הייתי במפגש |  |
| `a11y.reminders.switchName` | התראה בטלפון |  |
| `a11y.reminders.switchOn` | פעילה |  |
| `a11y.reminders.switchOff` | כבויה |  |
| `a11y.reminders.preview` | דוגמה להתראה: {text} |  |
| `a11y.reminders.statusOn` | ההתראות פעילות |  |
| `a11y.reminders.statusBlocked` | ההתראות חסומות בהגדרות הטלפון |  |
| `a11y.install.later` | להתקין אחר כך |  |
| `a11y.install.stepList` | שלבי ההוספה למסך הבית |  |
| `a11y.forms.showPassword` | הצגת הסיסמה |  |
| `a11y.forms.showConfirmPassword` | הצגת אימות הסיסמה | לכפתור ההצגה של שדה האימות, כדי ששני הכפתורים לא יישמעו אותו דבר. |
| `a11y.forms.requirementsList` | דרישות לסיסמה |  |
| `a11y.forms.requirementDone` | , בוצע | טקסט מוסתר מהעין, נקרא בקורא מסך. |
| `a11y.forms.requirementPending` | , עוד לא |  |
| `a11y.forms.required` | שדה חובה |  |
| `a11y.forms.errorSummary` | הטופס לא נשלח. יש לתקן שדה אחד או יותר. |  |
| `a11y.forms.readonlyField` | שדה לקריאה בלבד |  |
| `a11y.forms.loginTitle` | פרטי כניסה |  |
| `a11y.forms.resendCountdown` | אפשר לשלוח שוב בעוד {seconds} שניות |  |
| `a11y.status.saved` | נשמר. הכוס עלתה. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.unmarked` | הסימון בוטל. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.offline` | אין חיבור לאינטרנט. סימון צריך חיבור. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.online` | החיבור חזר. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.loading` | טוענים את היום… | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.loaded` | היום נטען. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.error` | משהו לא עבד. אפשר לנסות שוב. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.confirmationSent` | אם הפרטים נכונים, יגיע קישור. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.status.passwordSaved` | הסיסמה נשמרה. | אזור role=status מנומס. לא מכריזים על כל הקשה. |
| `a11y.toast.region` | הודעות |  |
| `a11y.toast.undo` | ביטול הסימון האחרון |  |
| `a11y.illustration.lock` | מנעול |  |
| `a11y.illustration.emptyCup` | כוס ריקה |  |
| `a11y.landing.cta` | אני בפנים, להרשמה לאתגר | aria-label לכפתור “אני בפנים”. הטקסט הגלוי בתחילתו. |
| `a11y.landing.path` | שביל של 14 ימים, {counted} נספרו |  |
| `a11y.offer.sessionCta` | לקביעת הפגישה האישית בזום | aria-label לכפתורי ההצעה, כשהטקסט הגלוי לא ברור מחוץ להקשר. |
| `a11y.offer.bundleCta` | לפרטים ולהזמנה של הבאנדל | aria-label לכפתורי ההצעה, כשהטקסט הגלוי לא ברור מחוץ להקשר. |
| `a11y.help` | קשה להשתמש באפליקציה? אפשר לפנות: [ACCESSIBILITY_CONTACT] | מציין מקום מהמפרט. נוסח הצהרת הנגישות נכתב בשלב 10. |

## דפים משפטיים (DRAFT: טיוטה, ממתינה לבדיקה משפטית)

הנוסחים נמצאים ב־`src/content/legal.he.ts`. אין הערת טיוטה גלויה למשתמשים. כל סעיף ממופה ב־`docs/LEGAL_REVIEW.md`.

| מפתח | טקסט |
|---|---|
| `legal.accessibility.title` | הצהרת נגישות |
| `legal.accessibility.metaDescription` | הצהרת הנגישות של האפליקציה צעד קטן ביום: מה הונגש, מגבלות ידועות ודרכי פנייה. |
| `legal.accessibility.lead` | YOGIT ואביטל פלס רוצות שכל אחד ואחת יוכלו להשתמש באפליקציה ובעמודי האתגר, בנוחות ובעצמאות. |
| `legal.accessibility.sections.0.id` | a-standard |
| `legal.accessibility.sections.0.heading` | התקן והדין |
| `legal.accessibility.sections.0.body.0` | האפליקציה ועמודי האתגר נבנים בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח־1998, ולתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג־2013. |
| `legal.accessibility.sections.0.body.1` | היעד הוא עמידה בתקן הישראלי ת״י 5568, שמבוסס על הנחיות WCAG 2.0 ברמה AA, ובפועל בנינו לפי WCAG 2.1 ברמה AA. |
| `legal.accessibility.sections.1.id` | a-done |
| `legal.accessibility.sections.1.heading` | מה הונגש |
| `legal.accessibility.sections.1.body.0` | נבדקו ותוקנו, בין היתר, הדברים האלה: |
| `legal.accessibility.sections.1.body.1.list.0` | מבנה: כותרות לפי סדר, אזורי עמוד (ראש, תוכן, ניווט ותחתית) וקישור ״דילוג לתוכן״ בתחילת כל עמוד. |
| `legal.accessibility.sections.1.body.1.list.1` | מקלדת: אפשר להגיע לכל פקד ולהפעיל אותו במקלדת, בסדר הגיוני, עם סימון מיקוד ברור. |
| `legal.accessibility.sections.1.body.1.list.2` | גודל פקדים: אזורי לחיצה של לפחות 44 על 44 פיקסלים. |
| `legal.accessibility.sections.1.body.1.list.3` | צבעים: ניגודיות לפי התקן. מידע לא מועבר בצבע בלבד: למצב של כוס, אבן או פעולה יש גם טקסט, צורה או סימון. |
| `legal.accessibility.sections.1.body.1.list.4` | התאמה למסך: הגדלת טקסט עד 200 אחוזים ותצוגה במסך צר (320 פיקסלים) בלי גלילה לצדדים. |
| `legal.accessibility.sections.1.body.1.list.5` | טפסים: כל שדה עם תווית גלויה, הודעות שגיאה בטקסט ליד השדה, ומעבר המיקוד לשגיאה הראשונה. |
| `legal.accessibility.sections.1.body.1.list.6` | קורא מסך: תוויות לאיורים ולפקדים, והודעות סטטוס (למשל ״נשמר״) שנשמעות בלי להזיז את המיקוד. |
| `legal.accessibility.sections.1.body.1.list.7` | תנועה: כפתור ״עצירת אנימציה״ בכל מסך עם תנועה, והתחשבות בהעדפת המערכת להפחתת תנועה. |
| `legal.accessibility.sections.1.body.1.list.8` | שפה וכיוון: עברית, מימין לשמאל, עם סימון שפה נכון בקוד. |
| `legal.accessibility.sections.2.id` | a-method |
| `legal.accessibility.sections.2.heading` | איך נבדקה הנגישות |
| `legal.accessibility.sections.2.body.0` | הבדיקות כוללות בדיקה אוטומטית של כל מסך ומצב בכלי axe, ובדיקה ידנית של ניווט במקלדת, הגדלה ותצוגה בנייד. |
| `legal.accessibility.sections.2.body.1` | עד כה לא נערכה בדיקה של גורם חיצוני מוסמך, ולא נערכו בדיקות מקיפות עם כל סוגי הטכנולוגיות המסייעות. |
| `legal.accessibility.sections.3.id` | a-limits |
| `legal.accessibility.sections.3.heading` | מגבלות ידועות |
| `legal.accessibility.sections.3.body.0` | יש דברים שעוד לא הושלמו, ואנחנו מציינות אותם בגלוי: |
| `legal.accessibility.sections.3.body.1.list.0` | סרטוני התרגול: כתוביות בעברית עדיין לא נוספו לסרטונים, ואנחנו פועלות להוסיף אותן. |
| `legal.accessibility.sections.3.body.1.list.1` | נגן הסרטונים מסופק על ידי שירות חיצוני. ייתכן שחלק מהפקדים שבתוכו לא נגישים במלואם, והם לא בשליטתנו המלאה. |
| `legal.accessibility.sections.3.body.1.list.2` | מפגשי הלייב מתקיימים בשירות שיחות וידאו חיצוני, ובדף התשלום הנגישות היא של השירותים האלה. |
| `legal.accessibility.sections.3.body.1.list.3` | התראות בטלפון תלויות בהגדרות המכשיר והדפדפן ובתמיכה שלהם. |
| `legal.accessibility.sections.4.id` | a-date |
| `legal.accessibility.sections.4.heading` | תאריך הבדיקה האחרון |
| `legal.accessibility.sections.4.body.0` | הנגישות נבדקה לאחרונה בתאריך {accessibilityDate}. ההצהרה תתעדכן כשייעשו שינויים. |
| `legal.accessibility.sections.5.id` | a-contact |
| `legal.accessibility.sections.5.heading` | נתקלתם בקושי? אפשר לפנות |
| `legal.accessibility.sections.5.body.0` | אם משהו לא נגיש, אם יש הצעה לשיפור, או אם צריך את התוכן בדרך אחרת, אפשר לפנות אל רכז או רכזת הנגישות: [ACCESSIBILITY_CONTACT]. |
| `legal.accessibility.sections.5.body.1` | כדי לטפל מהר, כדאי לציין באיזה עמוד זה קרה, באיזה מכשיר ודפדפן, ואם משתמשים בטכנולוגיה מסייעת. |
| `legal.privacy.title` | מדיניות פרטיות |
| `legal.privacy.metaDescription` | מדיניות הפרטיות של האפליקציה צעד קטן ביום: איזה מידע נשמר, למה, אצל מי, לכמה זמן ואיך אפשר למחוק. |
| `legal.privacy.lead` | כאן מוסבר איזה מידע האפליקציה שומרת, בשביל מה, לכמה זמן, ומה אפשר לעשות איתו. המדיניות כתובה לפי חוק הגנת הפרטיות, התשמ״א־1981, כולל תיקון 13. |
| `legal.privacy.sections.0.id` | p-who |
| `legal.privacy.sections.0.heading` | מי אחראית על המידע |
| `legal.privacy.sections.0.body.0` | האפליקציה ״צעד קטן ביום״ מופעלת על ידי YOGIT, אביטל פלס (להלן: YOGIT). YOGIT מחזיקה את המידע שנאסף באפליקציה ואחראית לו. |
| `legal.privacy.sections.0.body.1` | לשאלות ולבקשות בנושא פרטיות: [PRIVACY_CONTACT]. |
| `legal.privacy.sections.1.id` | p-data |
| `legal.privacy.sections.1.heading` | איזה מידע נשמר |
| `legal.privacy.sections.1.body.0` | האפליקציה שומרת רק את מה שנחוץ להפעלת האתגר: |
| `legal.privacy.sections.1.body.1.list.0` | פרטי חשבון: שם משתמש, שם להצגה, אימייל ו/או טלפון (כפי שנמסרו בהרשמה), מזהה איש הקשר שלכם במערכת ההרשמה של YOGIT, ומועדי יצירת החשבון והפעלתו. |
| `legal.privacy.sections.1.body.1.list.1` | סיסמה: נשמרת רק בצורה מוצפנת חד־כיוונית (argon2id). אי אפשר לקרוא אותה, גם לא אנחנו. |
| `legal.privacy.sections.1.body.1.list.2` | התחברות: סימן התחברות אקראי (נשמר רק כגיבוב), מועד היצירה, התפוגה והפעילות האחרונה. |
| `legal.privacy.sections.1.body.1.list.3` | קישורי הפעלה ואיפוס סיסמה: נשמר רק גיבוב של הקישור, סוגו ותוקפו. |
| `legal.privacy.sections.1.body.1.list.4` | התקדמות באתגר: אילו פעולות סומנו (הרגל, תנועה, מדיטציה, לייב), באיזה יום ובאיזו שעה. |
| `legal.privacy.sections.1.body.1.list.5` | התראות בטלפון (רק למי שהפעילו): כתובת המנוי של הדפדפן והמפתחות הנדרשים לשליחה אליו, ויומן תזכורות עם התאריך והסטטוס. |
| `legal.privacy.sections.1.body.1.list.6` | אבטחה והגבלת קצב: ניסיונות כניסה כושלים ופעולות רגישות נרשמים כגיבוב של המזהה ושל כתובת ה־IP, בלי הערכים עצמם. |
| `legal.privacy.sections.1.body.1.list.7` | תור עדכונים למערכת ההרשמה: מזהה איש הקשר, מספר היום, כמה ימים נספרו, האם האתגר הושלם והאם סומנה נוכחות בלייב. בלי שם, אימייל או טלפון. |
| `legal.privacy.sections.1.body.1.list.8` | ספירות שימוש מצטברות, בלי קשר לאדם מסוים: כמה לחיצות נרשמו על כפתורי ההצעות (לפי הצעה ולפי יום). מספרים כלליים על האתגר (כמה נרשמו, הפעילו חשבון וסימנו בכל יום) נגזרים מהמידע שלמעלה, ומוצגים לבעלי האפליקציה רק כסיכום, בלי שמות. |
| `legal.privacy.sections.1.body.1.list.9` | נתונים טכניים של שירות האירוח: כתובת IP וכותרות בקשה, ביומני הפעלה זמניים. |
| `legal.privacy.sections.2.id` | p-not |
| `legal.privacy.sections.2.heading` | מה האפליקציה לא עושה |
| `legal.privacy.sections.2.body.0.list.0` | היא לא מבקשת ולא שומרת מידע רפואי או בריאותי. |
| `legal.privacy.sections.2.body.0.list.1` | היא לא כוללת פרסומות, כלי ניתוח התנהגות או מעקב של צד שלישי. |
| `legal.privacy.sections.2.body.0.list.2` | היא לא שומרת פרטי תשלום. התשלום מתבצע מחוץ לאפליקציה. |
| `legal.privacy.sections.3.id` | p-purpose |
| `legal.privacy.sections.3.heading` | למה משתמשים במידע |
| `legal.privacy.sections.3.body.0.list.0` | לפתוח חשבון, להתחבר ולהציג את התוכן והתקדמות באתגר. |
| `legal.privacy.sections.3.body.0.list.1` | לשלוח קישור הפעלה או איפוס סיסמה בוואטסאפ או באימייל. |
| `legal.privacy.sections.3.body.0.list.2` | לשלוח תזכורת בבוקר: התראה בטלפון למי שהפעילו אותה, ותזכורת בוואטסאפ למי שלא כיבו אותה. |
| `legal.privacy.sections.3.body.0.list.3` | לעדכן את מערכת ההרשמה של YOGIT בהתקדמות, כדי שאפשר יהיה לשלוח הודעות ולהציע המשך. |
| `legal.privacy.sections.3.body.0.list.4` | לשמור על אבטחת האפליקציה ולמנוע ניצול לרעה. |
| `legal.privacy.sections.3.body.0.list.5` | לעמוד בחובות לפי דין. |
| `legal.privacy.sections.3.body.1` | מסירת הפרטים אינה חובה על פי דין, אבל בלי פרטי קשר ושם משתמש אי אפשר לפתוח חשבון ולהשתמש באפליקציה. |
| `legal.privacy.sections.4.id` | p-processors |
| `legal.privacy.sections.4.heading` | מי עוד מטפל במידע |
| `legal.privacy.sections.4.body.0` | כדי להפעיל את האפליקציה אנחנו משתמשות בשירותים של חברות אחרות. הן מטפלות במידע רק בשבילנו ולפי ההסכמים איתן: |
| `legal.privacy.sections.4.body.1.list.0` | Vercel: אירוח האפליקציה ויומני הפעלה זמניים. |
| `legal.privacy.sections.4.body.1.list.1` | Neon: מסד הנתונים שבו נשמר המידע. המסד ממוקם בפרנקפורט, גרמניה (אזור aws-eu-central-1). |
| `legal.privacy.sections.4.body.1.list.2` | Bunny: הזרמת סרטוני התרגול. בזמן צפייה, השירות מקבל כתובת IP ונתונים טכניים של הצפייה. |
| `legal.privacy.sections.4.body.1.list.3` | GoHighLevel: מערכת ההרשמה, הדיוור וניהול הקשרים של YOGIT. ממנה מגיעים פרטי ההרשמה, ודרכה נשלחות הודעות הפעלה ואיפוס סיסמה בוואטסאפ ובאימייל, ותזכורת בוקר בוואטסאפ. לשם כך האפליקציה כותבת באיש הקשר שלכם ב־GoHighLevel קישור אישי קצר־תוקף ותג, ואינה שולחת לשם נתוני שימוש. |
| `legal.privacy.sections.4.body.1.list.4` | שירותי התראות של הדפדפן (לפי הדפדפן והמכשיר: Google, Apple, Mozilla או Microsoft): מקבלים את כתובת המנוי ואת תוכן ההתראה, רק למי שהפעילו התראות. |
| `legal.privacy.sections.4.body.2` | התשלום מתבצע בדף תשלום חיצוני (Morning) ומפגשי הלייב מתקיימים בשירות שיחות וידאו חיצוני. השירותים האלה מטפלים במידע לפי המדיניות שלהם. |
| `legal.privacy.sections.4.body.3` | איננו מוכרות מידע אישי ואיננו מעבירות אותו לצורך פרסום. |
| `legal.privacy.sections.5.id` | p-abroad |
| `legal.privacy.sections.5.heading` | העברת מידע אל מחוץ לישראל |
| `legal.privacy.sections.5.body.0` | חלק מהשירותים שמפורטים למעלה פועלים מחוץ לישראל. מסד הנתונים נמצא באירופה (גרמניה). אנחנו מעבירות מידע אל מחוץ לישראל רק לשירותים הדרושים להפעלת האפליקציה, ובהתאם לדין. |
| `legal.privacy.sections.6.id` | p-retention |
| `legal.privacy.sections.6.heading` | לכמה זמן שומרים |
| `legal.privacy.sections.6.body.0.list.0` | חשבון והתקדמות: נשמרים עד שמוחקים את החשבון. אפשר למחוק בכל זמן (ראו ״הזכויות שלכם״). |
| `legal.privacy.sections.6.body.0.list.1` | התחברות: עד {sessionAbsoluteDays} ימים מרגע הכניסה, או עד {sessionIdleDays} ימים בלי שימוש. אחר כך היא נמחקת. |
| `legal.privacy.sections.6.body.0.list.2` | קישורי הפעלה ואיפוס: נמחקים 7 ימים אחרי שפג תוקפם או שנעשה בהם שימוש. |
| `legal.privacy.sections.6.body.0.list.3` | ניסיונות כניסה והגבלת קצב: נמחקים אחרי יום. |
| `legal.privacy.sections.6.body.0.list.4` | מזהים טכניים של אירועי הרשמה: {webhookEventsDays} ימים. |
| `legal.privacy.sections.6.body.0.list.5` | עדכונים לתור הסנכרון: שנשלחו, {syncSentDays} ימים. שנכשלו סופית, {syncDeadDays} ימים לצורך בדיקה. |
| `legal.privacy.sections.6.body.0.list.6` | יומן תזכורות: {reminderLogDays} ימים. |
| `legal.privacy.sections.6.body.1` | מחיקת חשבון מוחקת את כל המידע שמפורט כאן, חוץ ממה שמוחזק במערכות חיצוניות (ראו ״מחיקת חשבון״), ומזהים טכניים מגובבים (של ניסיונות כניסה ושל אירועי הרשמה) שאינם כוללים שם או פרטי קשר ונמחקים במועדים שלמעלה. |
| `legal.privacy.sections.7.id` | p-cookies |
| `legal.privacy.sections.7.heading` | עוגיות ואחסון בדפדפן |
| `legal.privacy.sections.7.body.0` | האפליקציה משתמשת בעוגייה אחת בלבד: עוגיית התחברות חיונית. היא מוגדרת כ־HttpOnly, Secure ו־SameSite=Lax, ונמחקת ביציאה מהחשבון. אין עוגיות פרסום, מעקב או ניתוח. ספירות השימוש המצטברות נשמרות בשרת בלבד, בלי עוגיות ובלי כלי ניתוח של צד שלישי. |
| `legal.privacy.sections.7.body.1` | בדפדפן נשמרת גם ההעדפה ״עצירת אנימציה״ (אחסון מקומי, רק במכשיר שלכם), ומטמון של קבצים סטטיים ושל עמוד ״אין חיבור״, בלי מידע אישי. |
| `legal.privacy.sections.7.body.2` | נגן הסרטונים של Bunny פועל בדומיין שלו, ועשוי לשמור מידע בדפדפן לפי המדיניות של Bunny. |
| `legal.privacy.sections.8.id` | p-rights |
| `legal.privacy.sections.8.heading` | הזכויות שלכם |
| `legal.privacy.sections.8.body.0` | לפי חוק הגנת הפרטיות אפשר לבקש לעיין במידע שנשמר עליכם, לבקש לתקן מידע שגוי ולבקש למחוק אותו. |
| `legal.privacy.sections.8.body.1.list.0` | מחיקה: בדף ״החשבון שלי״ באפליקציה אפשר למחוק את החשבון בעצמכם. הסיסמה נדרשת כדי לוודא שזו בקשה שלכם. |
| `legal.privacy.sections.8.body.1.list.1` | עיון ותיקון: בפנייה אל [PRIVACY_CONTACT]. |
| `legal.privacy.sections.8.body.1.list.2` | התראות: אפשר לכבות בכל זמן בדף ״תזכורות״ או בהגדרות הדפדפן והמכשיר. תזכורת בוואטסאפ: אפשר לכבות בכל זמן בדף ״תזכורות״. |
| `legal.privacy.sections.8.body.2` | אם נראה לכם שנפגעה הפרטיות שלכם, אפשר גם לפנות אל הרשות להגנת הפרטיות. |
| `legal.privacy.sections.9.id` | p-delete |
| `legal.privacy.sections.9.heading` | מחיקת חשבון |
| `legal.privacy.sections.9.body.0` | מחיקת חשבון מוחקת מהאפליקציה את פרטי החשבון, ההתקדמות, ההתחברויות, ההתראות והתור, ומתנתקת מכל המכשירים. אי אפשר לשחזר. |
| `legal.privacy.sections.9.body.1` | פרטי הקשר שלכם נשמרים גם במערכת ההרשמה של YOGIT, מחוץ לאפליקציה. מחיקה משם נעשית בפנייה אל YOGIT: [PRIVACY_CONTACT]. |
| `legal.privacy.sections.10.id` | p-security |
| `legal.privacy.sections.10.heading` | אבטחה |
| `legal.privacy.sections.10.body.0` | אנחנו נוקטות אמצעים סבירים להגנה על המידע: חיבור מוצפן, סיסמאות מוצפנות חד־כיוונית, גיבוב של אסימונים, הגבלת ניסיונות כניסה וגישה מוגבלת למידע. אין מערכת שאפשר להבטיח עליה אבטחה מוחלטת. |
| `legal.privacy.sections.11.id` | p-changes |
| `legal.privacy.sections.11.heading` | שינויים במדיניות |
| `legal.privacy.sections.11.body.0` | אם המדיניות תשתנה, העמוד הזה יתעדכן, והתאריך שבראשו ישתנה. |
| `legal.terms.title` | תנאי שימוש |
| `legal.terms.metaDescription` | תנאי השימוש באפליקציה צעד קטן ביום: השירות, החשבון, שימוש מותר, זמינות, קניין רוחני ואחריות. |
| `legal.terms.lead` | התנאים האלה חלים על השימוש באפליקציה ״צעד קטן ביום״ של YOGIT, אביטל פלס. השימוש באפליקציה מהווה הסכמה להם. |
| `legal.terms.sections.0.id` | t-service |
| `legal.terms.sections.0.heading` | מה השירות |
| `legal.terms.sections.0.body.0` | האפליקציה מלווה את האתגר ״צעד קטן ביום״: 14 ימים עם סרטוני תרגול, סימון פעולות, שני מפגשי לייב עם אביטל (ביום 7 וביום 14) ותזכורות לבחירה. |
| `legal.terms.sections.1.id` | t-signup |
| `legal.terms.sections.1.heading` | הרשמה ותשלום |
| `legal.terms.sections.1.body.0` | ההרשמה לאתגר עולה 79 ₪. זה תשלום חד־פעמי ואינו מנוי. ההרשמה והתשלום מתבצעים מחוץ לאפליקציה, ואחריהם מגיע קישור אישי להפעלת החשבון. |
| `legal.terms.sections.1.body.1` | הצעות להמשך (למשל פגישה אישית או קורסים) הן שירותים נפרדים, ונרכשים מחוץ לאפליקציה, בהתאם לתנאים שמוצגים בעת הרכישה. |
| `legal.terms.sections.1.body.2` | ביטול הרשמה והחזר כספי כפופים לדין, ובכלל זה חוק הגנת הצרכן, התשמ״א־1981, ולמידע שמוצג בעת ההרשמה. |
| `legal.terms.sections.2.id` | t-health |
| `legal.terms.sections.2.heading` | אין כאן ייעוץ רפואי |
| `legal.terms.sections.2.body.0` | התוכן באפליקציה הוא תרגול כללי של הרגלים, תנועה, נשימה ומדיטציה. הוא אינו ייעוץ רפואי, אבחון או טיפול, ואינו מחליף התייעצות עם רופא או איש מקצוע מוסמך. |
| `legal.terms.sections.2.body.1` | מי שיש לו או לה מצב רפואי, הריון, פציעה או חשש לגבי התאמת התרגול, מתבקש להתייעץ עם רופא או איש מקצוע לפני ההתחלה. |
| `legal.terms.sections.2.body.2` | ההשתתפות היא באחריות כל אחד ואחת. מומלץ לפעול לפי היכולת, ולהפסיק כשצריך. |
| `legal.terms.sections.3.id` | t-account |
| `legal.terms.sections.3.heading` | החשבון |
| `legal.terms.sections.3.body.0.list.0` | החשבון אישי. אין להעביר את הקישור האישי, שם המשתמש או הסיסמה לאחרים. |
| `legal.terms.sections.3.body.0.list.1` | יש למסור פרטים נכונים ולשמור על סודיות הסיסמה. |
| `legal.terms.sections.3.body.0.list.2` | אם יש חשד לשימוש בלתי מורשה בחשבון, צריך לפנות אלינו בהקדם. |
| `legal.terms.sections.3.body.0.list.3` | אפשר למחוק את החשבון בכל זמן בדף ״החשבון שלי״. |
| `legal.terms.sections.4.id` | t-use |
| `legal.terms.sections.4.heading` | שימוש מותר |
| `legal.terms.sections.4.body.0` | השימוש הוא אישי בלבד, לצורך השתתפות באתגר. אסור: |
| `legal.terms.sections.4.body.1.list.0` | לשתף גישה לחשבון או לתוכן עם מי שלא נרשמו. |
| `legal.terms.sections.4.body.1.list.1` | להעתיק, להקליט, להפיץ או לפרסם סרטונים וחומרים מהאפליקציה. |
| `legal.terms.sections.4.body.1.list.2` | לעקוף את מנגנוני האפליקציה, כולל פתיחת הימים בשעות שנקבעו. |
| `legal.terms.sections.4.body.1.list.3` | לפגוע בפעולת האפליקציה, לסרוק אותה באופן אוטומטי או לנסות לחדור אליה. |
| `legal.terms.sections.5.id` | t-availability |
| `legal.terms.sections.5.heading` | זמינות השירות |
| `legal.terms.sections.5.body.0` | האפליקציה ניתנת כפי שהיא. אנחנו עושות מאמץ שתפעל באופן רציף, אבל ייתכנו הפסקות, תקלות ושינויים, ואין התחייבות לזמינות רציפה. |
| `legal.terms.sections.5.body.1` | כל יום באתגר נפתח ב־{unlockTime} לפי שעון ישראל. מועדי הלייב והקישורים אליו מוצגים באפליקציה. |
| `legal.terms.sections.6.id` | t-ip |
| `legal.terms.sections.6.heading` | קניין רוחני |
| `legal.terms.sections.6.body.0` | הסרטונים, הטקסטים, תוכני התרגול, הלוגו והעיצוב שייכים ל־YOGIT ולאביטל פלס, או לבעלי הזכויות בהם. ההרשמה נותנת רישיון אישי, מוגבל, לא בלעדי ולא ניתן להעברה, לצפות ולהשתמש בתוכן לצורך ההשתתפות באתגר. |
| `legal.terms.sections.7.id` | t-liability |
| `legal.terms.sections.7.heading` | הגבלת אחריות |
| `legal.terms.sections.7.body.0` | במידה המותרת בדין, YOGIT לא תישא באחריות לנזק עקיף או תוצאתי שנגרם מהשימוש באפליקציה או מחוסר היכולת להשתמש בה, וכן לשימוש בשירותים של צד שלישי שמופיעים בה. |
| `legal.terms.sections.7.body.1` | אין בסעיף הזה כדי לפגוע בזכויות שהדין לא מאפשר להתנות עליהן, ואין בו הגבלה של אחריות לנזק שנגרם בכוונה. |
| `legal.terms.sections.8.id` | t-suspend |
| `legal.terms.sections.8.heading` | השעיה וסיום |
| `legal.terms.sections.8.body.0` | YOGIT רשאית להשעות או לסגור חשבון שנעשה בו שימוש בניגוד לתנאים האלה. |
| `legal.terms.sections.9.id` | t-privacy |
| `legal.terms.sections.9.heading` | פרטיות |
| `legal.terms.sections.9.body.0` | המידע האישי באפליקציה מטופל לפי מדיניות הפרטיות. |
| `legal.terms.sections.10.id` | t-changes |
| `legal.terms.sections.10.heading` | שינויים בתנאים |
| `legal.terms.sections.10.body.0` | התנאים עשויים להתעדכן. הנוסח המעודכן יופיע בעמוד הזה, והתאריך שבראשו ישתנה. |
| `legal.terms.sections.11.id` | t-law |
| `legal.terms.sections.11.heading` | דין וסמכות שיפוט |
| `legal.terms.sections.11.body.0` | על התנאים האלה ועל השימוש באפליקציה יחולו דיני מדינת ישראל. סמכות השיפוט היא לבתי המשפט המוסמכים בישראל. |
| `legal.terms.sections.12.id` | t-contact |
| `legal.terms.sections.12.heading` | יצירת קשר |
| `legal.terms.sections.12.body.0` | לשאלות על התנאים: [SUPPORT_CONTACT]. |

## שאלות פתוחות לאישור

1. מקומות לפגישה: האם יש מגבלה אמיתית? אם לא, השורה לא מוצגת.
2. האם הלייבים מוקלטים? אם כן, אוסיף “ההקלטה תעלה לכאן אחרי המפגש”.
3. חשבון: כללי הסיסמה ו־[YESODOT_EMAIL_TIMING].
4. [ACCESSIBILITY_CONTACT] להצהרת הנגישות, ופרט אישי על אביטל לדף הנחיתה.
5. שלב 10: [PRIVACY_CONTACT], [SUPPORT_CONTACT] ו־[MORNING_URL_BUNDLE_139] חדשים. מחיר הבאנדל: קישור ו־UTM מהקונפיג.
6. שלב 10: הדפים המשפטיים הם טיוטה לבדיקת עורך דין (docs/LEGAL_REVIEW.md), כולל שאלות פתוחות על שמירת חשבונות ללא מחיקה.

## טענות טכניות לבדיקה בפועל (שלב 11)

- שמירת סימונים בלי אינטרנט: לא נבנתה (today.toastOffline לא בשימוש; states.offline אומר שסימון צריך חיבור).
- תזכורת בוקר בהתראה, כולל באייפון אחרי הוספה למסך הבית (reminders, install.why, landing.faq).
- שליחת קישור הפעלה ושחזור בוואטסאפ ובמייל (login.firstTime, forgot, messages).
- התקנה באנדרואיד (install.android, בנוסח מותנה).
- קישור הלייב מופיע שעה לפני המפגש (live).

סך הכול 734 מחרוזות.
