ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "login_attempts_user_idx";--> statement-breakpoint
ALTER TABLE "login_attempts" DROP COLUMN "user_id";