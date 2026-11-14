CREATE TABLE "habit_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" smallint NOT NULL,
	"habit_day" smallint NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_checks_user_day_habit" UNIQUE("user_id","day","habit_day"),
	CONSTRAINT "habit_checks_day" CHECK ("habit_checks"."day" between 1 and 14),
	CONSTRAINT "habit_checks_habit_day" CHECK ("habit_checks"."habit_day" >= 1 and "habit_checks"."habit_day" < "habit_checks"."day")
);
--> statement-breakpoint
ALTER TABLE "habit_checks" ADD CONSTRAINT "habit_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "habit_checks_user_day_idx" ON "habit_checks" USING btree ("user_id","day");