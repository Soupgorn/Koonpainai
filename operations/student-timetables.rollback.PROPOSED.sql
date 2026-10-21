-- PROPOSED ONLY: separate approval required for production.
-- Empty, freshly migrated tables only. Never discard student timetable data.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $$ BEGIN
 IF current_user <> 'postgres' OR NOT pg_try_advisory_xact_lock(1263423049)
 OR (SELECT count(*) FROM drizzle.__drizzle_migrations)<>3
 OR NOT EXISTS(SELECT FROM drizzle.__drizzle_migrations WHERE hash='3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a' AND created_at=1792605397521)
 OR (SELECT max(created_at) FROM drizzle.__drizzle_migrations)<>1792605397521
 OR (SELECT count(*) FROM pg_class WHERE oid IN ('public.student_timetables'::regclass,'public.timetable_entries'::regclass) AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity)<>2
 THEN RAISE EXCEPTION 'Student timetable rollback precondition mismatch'; END IF;
END $$;
LOCK TABLE public.student_timetables,public.timetable_entries IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN IF EXISTS(SELECT FROM public.student_timetables) OR EXISTS(SELECT FROM public.timetable_entries) THEN RAISE EXCEPTION 'Refuse rollback with timetable data; retain schema and investigate'; END IF; END $$;
DROP TABLE public.timetable_entries;
DROP TABLE public.student_timetables;
DELETE FROM drizzle.__drizzle_migrations WHERE hash='3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a' AND created_at=1792605397521;
COMMIT;
