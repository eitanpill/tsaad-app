ALTER TABLE "live_attendance" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "live_attendance" CASCADE;--> statement-breakpoint
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_kind";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_kind" CHECK ("login_attempts"."kind" in ('login','forgot','toggle','push','webhook'));