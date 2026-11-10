import "server-only";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { readEnv } from "@/config";
import { logger, type Logger } from "@/lib/logger";

export type MessageChannel = "whatsapp" | "email";
export type MessageKind = "activation" | "reset";

export type OutgoingMessage = {
  kind: MessageKind;
  channel: MessageChannel;
  userId: string;
  name: string;
  username: string;
  /** הקישור החד־פעמי המלא. אסור לרשום אותו ביומן. */
  link: string;
};

export interface MessageSender {
  send(message: OutgoingMessage): Promise<void>;
}



/** טקסט ההודעה לפי הנוסח המאושר ב־copy.messages (שלב 9א ישתמש בו לשליחה אמיתית). */
export function renderMessage(m: OutgoingMessage): { subject?: string; body: string } {
  const set = m.kind === "activation" ? copy.messages.activation : copy.messages.forgot;
  const values = { name: m.name, username: m.username, link: m.link };
  return m.channel === "whatsapp"
    ? { body: fill(set.whatsapp, values) }
    : { subject: set.emailSubject, body: fill(set.emailBody, values) };
}

/**
 * שולח "יבש": לא שולח כלום. רושם ביומן (דרך הלוגר המסתיר) רק מטא־נתונים: סוג, ערוץ ואורך.
 * הקישור והאסימון אף פעם לא נרשמים בפרודקשן; בפיתוח בלבד (NODE_ENV=development)
 * נרשם נתיב הקישור ברמת debug, כדי שאפשר יהיה לנסות את הזרימה מקומית.
 * שליחה אמיתית (GHL) כבויה עד שער מאוחר יותר.
 */
export function createDryRunSender(log: Logger = logger, env: Record<string, string | undefined> = readEnv()): MessageSender {
  return {
    async send(message) {
      const rendered = renderMessage(message);
      log.info("message dry-run (not sent)", {
        kind: message.kind,
        channel: message.channel,
        userId: message.userId,
        bodyLength: rendered.body.length,
      });
      if (env.NODE_ENV === "development") {
        const u = new URL(message.link);
        log.debug("dry-run link (development only)", { devPath: `${u.pathname}${u.search}` });
      }
    },
  };
}

let sender: MessageSender | undefined;

/** כרגע רק dry-run. שליחה אמיתית תתווסף בשער מאוחר, מאחורי דגל מפורש. */
export function getMessageSender(): MessageSender {
  sender ??= createDryRunSender();
  return sender;
}
