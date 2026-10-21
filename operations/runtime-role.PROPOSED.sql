-- SEPARATE PROPOSAL ONLY. Not included in account-grant remediation approval.
-- Tested locally; never execute in production without a separately approved
-- role/policy/credential cutover. No password is embedded or provisioned here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
DO $$ BEGIN
  IF current_user <> 'postgres'
     OR EXISTS (SELECT FROM pg_roles WHERE rolname = 'koonpinai_runtime')
     OR (SELECT count(*) FROM pg_class WHERE oid IN
       ('public.members'::regclass, 'public.application_sessions'::regclass)
       AND relowner = 'postgres'::regrole AND relrowsecurity) <> 2
     OR EXISTS (SELECT FROM pg_policy WHERE polrelid IN
       ('public.members'::regclass, 'public.application_sessions'::regclass))
     OR EXISTS (SELECT FROM pg_roles r CROSS JOIN
       (VALUES ('public.members'::regclass),('public.application_sessions'::regclass)) t(id)
       WHERE r.rolname IN ('anon','authenticated') AND
       (has_table_privilege(r.oid,t.id,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(r.oid,t.id,'SELECT,INSERT,UPDATE,REFERENCES')))
  THEN RAISE EXCEPTION 'Runtime role proposal baseline mismatch'; END IF;
  IF NOT pg_try_advisory_xact_lock(1263423049) THEN
    RAISE EXCEPTION 'Another reviewed change is running';
  END IF;
END $$;
CREATE ROLE koonpinai_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
ALTER ROLE koonpinai_runtime SET search_path = pg_catalog, public;
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO koonpinai_runtime', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO koonpinai_runtime;
GRANT USAGE ON TYPE public.member_role, public.approval_status TO koonpinai_runtime;
-- Drizzle inserts explicitly list all model columns, including DEFAULT values.
-- Table INSERT is required; RLS restricts new identities to pending members.
GRANT SELECT, INSERT ON TABLE public.members, public.application_sessions
  TO koonpinai_runtime;
GRANT UPDATE (display_name, verified_email, last_login_at, updated_at, nickname,
 thai_name, department, profile_completed_at, policy_version, policy_accepted_at, status)
 ON public.members TO koonpinai_runtime;
GRANT UPDATE (revoked_at) ON public.application_sessions TO koonpinai_runtime;

-- This is a trusted server credential, never a browser/PostgREST identity.
-- App authorization still enforces identity, policy acknowledgement and approval.
-- PostgreSQL sees one server role, so these policies do not identify end users.
CREATE POLICY koonpinai_runtime_members_select ON public.members
  FOR SELECT TO koonpinai_runtime USING (true);
CREATE POLICY koonpinai_runtime_members_insert ON public.members
  FOR INSERT TO koonpinai_runtime WITH CHECK (role='member' AND status='pending');
CREATE POLICY koonpinai_runtime_members_update ON public.members
  FOR UPDATE TO koonpinai_runtime USING (true) WITH CHECK (true);
CREATE POLICY koonpinai_runtime_sessions_select ON public.application_sessions
  FOR SELECT TO koonpinai_runtime USING (true);
CREATE POLICY koonpinai_runtime_sessions_insert ON public.application_sessions
  FOR INSERT TO koonpinai_runtime WITH CHECK (true);
CREATE POLICY koonpinai_runtime_sessions_update ON public.application_sessions
  FOR UPDATE TO koonpinai_runtime USING (true) WITH CHECK (true);
DO $$ BEGIN
  IF has_schema_privilege('koonpinai_runtime', 'public', 'CREATE')
     OR has_schema_privilege('koonpinai_runtime', 'drizzle', 'USAGE')
     OR EXISTS (SELECT FROM pg_roles r
       WHERE r.rolname <> 'koonpinai_runtime'
         AND pg_has_role('koonpinai_runtime', r.oid, 'MEMBER'))
     OR NOT has_function_privilege('koonpinai_runtime', 'pg_catalog.gen_random_uuid()', 'EXECUTE')
     OR EXISTS (SELECT FROM (VALUES ('public.members'::regclass), ('public.application_sessions'::regclass)) t(id)
       WHERE has_table_privilege('koonpinai_runtime', t.id, 'DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
         OR NOT (has_table_privilege('koonpinai_runtime', t.id, 'SELECT')
           AND has_table_privilege('koonpinai_runtime', t.id, 'INSERT')
           AND has_any_column_privilege('koonpinai_runtime', t.id, 'UPDATE'))
         OR has_table_privilege('koonpinai_runtime',t.id,'UPDATE'))
     OR EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid='public.members'::regclass
       AND a.attnum>0 AND NOT a.attisdropped
       AND has_column_privilege('koonpinai_runtime',a.attrelid,a.attnum,'UPDATE') IS DISTINCT FROM
         (a.attname IN ('display_name','verified_email','last_login_at','updated_at','nickname',
           'thai_name','department','profile_completed_at','policy_version','policy_accepted_at','status')))
     OR EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid='public.application_sessions'::regclass
       AND a.attnum>0 AND NOT a.attisdropped
       AND has_column_privilege('koonpinai_runtime',a.attrelid,a.attnum,'UPDATE') IS DISTINCT FROM (a.attname='revoked_at'))
  THEN RAISE EXCEPTION 'Runtime role exceeds intended privileges or lacks required access'; END IF;
END $$;
COMMIT;
