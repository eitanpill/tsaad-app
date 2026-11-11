import "server-only";
import { logger } from "@/lib/logger";

/**
 * "הודעת מחיקה" (פורט, לשער G3). אחרי שחשבון נמחק, ל־GHL עדיין יש את איש הקשר: מחיקה שם נעשית ידנית על ידי הבעלים
 * (ראו docs/LEGAL_REVIEW.md). הפורט הזה הוא המקום שבו אפשר יהיה לחבר מחיקה/סימון אוטומטי ב־GHL.
 * היום יש רק מתאם יבש: רושם ביומן מי הסוג (יש/אין איש קשר), בלי מזהים, בלי פרטים אישיים, ולא שולח כלום ולא ממלא את ה־outbox.
 */
export type DeletionNotice = { hadGhlContact: boolean };

export interface DeletionNoticePort {
  notify(notice: DeletionNotice): Promise<void>;
}

export const dryRunDeletionNotice: DeletionNoticePort = {
  async notify(notice) {
    logger.info("account deleted: GHL deletion notice (dry run, nothing sent)", { hadGhlContact: notice.hadGhlContact });
  },
};

export function getDeletionNotice(): DeletionNoticePort {
  return dryRunDeletionNotice;
}
