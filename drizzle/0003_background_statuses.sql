ALTER TABLE "reminder_log" DROP CONSTRAINT "reminder_log_status";--> statement-breakpoint
ALTER TABLE "sync_outbox" DROP CONSTRAINT "sync_outbox_status";--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_status" CHECK ("reminder_log"."status" in ('pending','dry_run','sent','failed'));--> statement-breakpoint
ALTER TABLE "sync_outbox" ADD CONSTRAINT "sync_outbox_status" CHECK ("sync_outbox"."status" in ('pending','sent','failed','dead'));