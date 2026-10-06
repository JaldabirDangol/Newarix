CREATE TYPE "public"."history_action" AS ENUM('added', 'status', 'progress', 'completed', 'scored', 'removed');--> statement-breakpoint
CREATE TYPE "public"."list_status" AS ENUM('current', 'completed', 'planned', 'on_hold', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('anime', 'manga');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"mal_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_media_type_mal_id_pk" PRIMARY KEY("user_id","media_type","mal_id")
);
--> statement-breakpoint
CREATE TABLE "list_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mal_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"status" "list_status" NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_volumes" integer DEFAULT 0 NOT NULL,
	"score" smallint,
	"notes" text,
	"title" text NOT NULL,
	"image_url" text,
	"total" integer,
	"total_volumes" integer,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_entries_score_ck" CHECK ("list_entries"."score" between 1 and 10),
	CONSTRAINT "list_entries_progress_ck" CHECK ("list_entries"."progress" >= 0 and "list_entries"."progress_volumes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mal_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"action" "history_action" NOT NULL,
	"progress" integer,
	"status" "list_status",
	"score" smallint,
	"title" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_entries" ADD CONSTRAINT "list_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "list_entries_user_media_uq" ON "list_entries" USING btree ("user_id","media_type","mal_id");--> statement-breakpoint
CREATE INDEX "list_entries_user_status_idx" ON "list_entries" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "watch_history_user_created_idx" ON "watch_history" USING btree ("user_id","created_at");