ALTER TABLE "reminder_log" DROP CONSTRAINT "reminder_log_user_date";--> statement-breakpoint
ALTER TABLE "reminder_log" ADD COLUMN "channel" text DEFAULT 'push' NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_user_date_channel" UNIQUE("user_id","date","channel");--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_channel" CHECK ("reminder_log"."channel" in ('push','ghl'));