-- Replacement for UNAPPLIED API-first 0002 only. Execute via reviewed runner.
-- This migration creates only two student-owned tables and their scoped ACLs.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='koonpinai_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
 OR to_regclass('public.application_settings') IS NOT NULL OR to_regclass('public.timetable_sync') IS NOT NULL OR to_regtype('public.timetable_sync_state') IS NOT NULL
 THEN RAISE EXCEPTION 'Student timetable migration precondition mismatch'; END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "student_timetables" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timetable_dates" CHECK ("student_timetables"."start_date" <= "student_timetables"."end_date"),
	CONSTRAINT "timetable_name" CHECK (length(btrim("student_timetables"."name")) BETWEEN 1 AND 100),
	CONSTRAINT "timetable_revision" CHECK ("student_timetables"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "student_timetables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "timetable_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"course_name" text NOT NULL,
	"course_code" text DEFAULT '' NOT NULL,
	"section" text DEFAULT '' NOT NULL,
	"day" smallint NOT NULL,
	"start_time" time(0) NOT NULL,
	"end_time" time(0) NOT NULL,
	"room" text DEFAULT '' NOT NULL,
	CONSTRAINT "entry_name" CHECK (length(btrim("timetable_entries"."course_name")) BETWEEN 1 AND 240),
	CONSTRAINT "entry_optional_lengths" CHECK (length("timetable_entries"."course_code") <= 64 AND length("timetable_entries"."section") <= 24 AND length("timetable_entries"."room") <= 160),
	CONSTRAINT "entry_weekday" CHECK ("timetable_entries"."day" BETWEEN 0 AND 6),
	CONSTRAINT "entry_times" CHECK ("timetable_entries"."start_time" < "timetable_entries"."end_time" AND "timetable_entries"."end_time" < time '24:00' AND extract(second from "timetable_entries"."start_time") = 0 AND extract(second from "timetable_entries"."end_time") = 0)
);
--> statement-breakpoint
ALTER TABLE "timetable_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_timetables" ADD CONSTRAINT "student_timetables_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_member_id_student_timetables_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."student_timetables"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timetable_entries_owner" ON "timetable_entries" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_entries_duplicate" ON "timetable_entries" USING btree ("member_id","course_name","course_code","section","day","start_time","end_time","room");
--> statement-breakpoint
REVOKE ALL ON public.student_timetables, public.timetable_entries FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON public.student_timetables, public.timetable_entries FROM %I',r); END IF; END LOOP; END $$;
GRANT SELECT, INSERT ON public.student_timetables, public.timetable_entries TO koonpinai_runtime;
GRANT UPDATE(name,start_date,end_date,revision,updated_at) ON public.student_timetables TO koonpinai_runtime;
GRANT UPDATE(course_name,course_code,section,day,start_time,end_time,room) ON public.timetable_entries TO koonpinai_runtime;
GRANT DELETE ON public.timetable_entries TO koonpinai_runtime;
ALTER TABLE public.student_timetables FORCE ROW LEVEL SECURITY;
CREATE POLICY student_timetables_read ON public.student_timetables FOR SELECT TO koonpinai_runtime USING ((member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),''))) OR (EXISTS (SELECT 1 FROM public.members viewer WHERE viewer.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND viewer.status='approved' AND viewer.profile_completed_at IS NOT NULL AND viewer.policy_accepted_at IS NOT NULL AND viewer.policy_version=NULLIF(current_setting('app.policy_version',true),'')) AND EXISTS (SELECT 1 FROM public.members target WHERE target.id=member_id AND target.status='approved' AND target.profile_completed_at IS NOT NULL AND target.policy_accepted_at IS NOT NULL AND target.policy_version=NULLIF(current_setting('app.policy_version',true),''))));
CREATE POLICY student_timetables_create ON public.student_timetables FOR INSERT TO koonpinai_runtime WITH CHECK (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),'')));
CREATE POLICY student_timetables_edit ON public.student_timetables FOR UPDATE TO koonpinai_runtime USING (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),''))) WITH CHECK (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),'')));
ALTER TABLE public.timetable_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY timetable_entries_read ON public.timetable_entries FOR SELECT TO koonpinai_runtime USING ((member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),''))) OR (EXISTS (SELECT 1 FROM public.members viewer WHERE viewer.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND viewer.status='approved' AND viewer.profile_completed_at IS NOT NULL AND viewer.policy_accepted_at IS NOT NULL AND viewer.policy_version=NULLIF(current_setting('app.policy_version',true),'')) AND EXISTS (SELECT 1 FROM public.members target WHERE target.id=member_id AND target.status='approved' AND target.profile_completed_at IS NOT NULL AND target.policy_accepted_at IS NOT NULL AND target.policy_version=NULLIF(current_setting('app.policy_version',true),''))));
CREATE POLICY timetable_entries_create ON public.timetable_entries FOR INSERT TO koonpinai_runtime WITH CHECK (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),'')));
CREATE POLICY timetable_entries_edit ON public.timetable_entries FOR UPDATE TO koonpinai_runtime USING (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),''))) WITH CHECK (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),'')));
CREATE POLICY timetable_entries_delete ON public.timetable_entries FOR DELETE TO koonpinai_runtime USING (member_id=NULLIF(current_setting('app.member_id',true),'')::uuid AND EXISTS (SELECT 1 FROM public.members a WHERE a.id=NULLIF(current_setting('app.member_id',true),'')::uuid AND a.status<>'suspended' AND a.profile_completed_at IS NOT NULL AND a.policy_accepted_at IS NOT NULL AND a.policy_version=NULLIF(current_setting('app.policy_version',true),'')));
