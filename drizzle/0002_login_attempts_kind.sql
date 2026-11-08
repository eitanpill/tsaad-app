DROP INDEX "login_attempts_identifier_idx";--> statement-breakpoint
DROP INDEX "login_attempts_ip_idx";--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "kind" text DEFAULT 'login' NOT NULL;--> statement-breakpoint
CREATE INDEX "login_attempts_identifier_idx" ON "login_attempts" USING btree ("kind","identifier_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("kind","ip_hash","attempted_at");--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_kind" CHECK ("login_attempts"."kind" in ('login','forgot'));