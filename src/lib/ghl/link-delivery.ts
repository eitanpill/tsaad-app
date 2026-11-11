import "server-only";
import { getConfig, readEnv } from "@/config";
import { getDb, type Db } from "@/db";
import { getActivationTtlMinutes, getAppOrigin } from "@/lib/auth/config";
import { issueToken } from "@/lib/auth/tokens";
import { logger, type Logger } from "@/lib/logger";
import { createGhlClient, setFieldAndTag, type GhlClient } from "./client";
import { getGhlConfig, type GhlConfig } from "./config";
import { cancelQueuedLink, enqueueLink, runGhlOutbox, type GhlRunResult, type LinkKind } from "./outbox";

export type LinkDeliveryRequest = { userId: string; ghlContactId: string; kind: LinkKind; link: string };
export type LinkDeliveryOutcome = "sent" | "dry" | "queued" | "dropped";

export interface LinkDelivery {
  deliver(req: LinkDeliveryRequest): Promise<LinkDeliveryOutcome>;
}

/**
 * מסירת קישור חד־פעמי דרך GHL: כותב את הקישור לשדה מותאם ומוסיף תג, ו־Workflow ב־GHL שולח ווטסאפ ומייל.
 * dry: רושם מה היה נשלח (בלי הקישור) ולא קורא ל־GHL. live: ניסיון מיידי; כשל זמני נכנס ל־outbox לניסיון חוזר
 * (האסימון לא נשמר, ובשליחה החוזרת מונפק אסימון חדש). הקישור לעולם לא נרשם ביומן.
 */
export function createLinkDelivery(deps: { cfg: GhlConfig; client: GhlClient | null; db: () => Db; log?: Logger }): LinkDelivery {
  const log = deps.log ?? logger;
  return {
    async deliver(req) {
      const { cfg } = deps;
      const tag = req.kind === "activate" ? cfg.tags.accountReady : cfg.tags.resetReady;
      if (cfg.deliveryMode !== "live" || !deps.client) {
        log.info("ghl link delivery dry-run (not sent)", { kind: req.kind, userId: req.userId, field: cfg.fields.activationUrl, tag });
        return "dry";
      }
      const r = await setFieldAndTag(deps.client, {
        contactId: req.ghlContactId,
        fieldKey: cfg.fields.activationUrl,
        fieldId: cfg.fields.activationUrlId,
        value: req.link,
        tag,
        rearm: true,
        locationId: cfg.locationId,
      });
      if (r.ok) {
        await cancelQueuedLink(deps.db(), req.userId, req.kind);
        log.info("ghl link delivered", { kind: req.kind, userId: req.userId });
        return "sent";
      }
      if (!r.retryable) {
        log.error("ghl link delivery failed, not retrying", { kind: req.kind, userId: req.userId, error: r.error });
        return "dropped";
      }
      await enqueueLink(deps.db(), req.userId, req.kind, r.retryAfterSeconds);
      log.warn("ghl link delivery failed, queued for retry", { kind: req.kind, userId: req.userId, error: r.error });
      return "queued";
    },
  };
}

/** לקוח אמיתי רק כש־live מותר (ראו getGhlConfig); אחרת null. */
export function buildClient(cfg: GhlConfig): GhlClient | null {
  const live = cfg.reminderMode === "live" || cfg.deliveryMode === "live";
  return live && cfg.token ? createGhlClient({ token: cfg.token }) : null;
}

let cached: { cfg: GhlConfig; client: GhlClient | null } | undefined;
export function getGhl() {
  if (!cached) {
    const cfg = getGhlConfig(getConfig().env, readEnv());
    if (cfg.liveRefused) logger.error("ghl: live mode refused, running as off", { reason: cfg.liveRefused });
    cached = { cfg, client: buildClient(cfg) };
  }
  return cached;
}

/** null כש־GHL_DELIVERY_MODE הוא off: אז ההתנהגות כמו קודם (שולח יבש). */
export function getLinkDelivery(): LinkDelivery | null {
  const { cfg, client } = getGhl();
  return cfg.deliveryMode === "off" ? null : createLinkDelivery({ cfg, client, db: getDb });
}

/** מריץ את ה־outbox של GHL עם הלקוח והתצורה האמיתיים. */
export async function drainGhlOutbox(db: Db, now?: Date): Promise<GhlRunResult> {
  const { cfg, client } = getGhl();
  const config = getConfig();
  const env = readEnv();
  return runGhlOutbox({
    db,
    cfg,
    client,
    now,
    timeZone: config.timeZone,
    origin: getAppOrigin(env),
    makeLink: async (userId, purpose) => {
      const { token } = await issueToken(db, { userId, purpose, ttlMinutes: getActivationTtlMinutes(env) });
      return `${getAppOrigin(env)}/activate?token=${token}`;
    },
  });
}
