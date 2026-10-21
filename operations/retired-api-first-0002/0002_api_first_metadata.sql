CREATE TYPE "public"."timetable_sync_state" AS ENUM('not-connected', 'permission-required', 'syncing', 'synced', 'outdated', 'sync-failed', 'api-unavailable');--> statement-breakpoint
CREATE TABLE "application_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"timetable_retrieval_permitted" boolean DEFAULT false NOT NULL,
	"timetable_storage_permitted" boolean DEFAULT false NOT NULL,
	"timetable_sharing_permitted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "timetable_sync" (
	"member_id" uuid NOT NULL,
	"provider" text DEFAULT 'kmitl' NOT NULL,
	"state" timetable_sync_state DEFAULT 'not-connected' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"error_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timetable_sync_member_id_provider_pk" PRIMARY KEY("member_id","provider")
);
--> statement-breakpoint
ALTER TABLE "timetable_sync" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "timetable_sync" ADD CONSTRAINT "timetable_sync_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- RLS does not govern TRUNCATE/REFERENCES/TRIGGER. Supabase default ACLs can
-- retain these privileges even after client SELECT/INSERT/UPDATE/DELETE removal.
-- These are server-only tables; revoke client grants in the same transaction.
REVOKE ALL PRIVILEGES ON TABLE "public"."application_settings", "public"."timetable_sync" FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.application_settings, public.timetable_sync FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
