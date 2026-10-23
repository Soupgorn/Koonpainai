-- Run ONLY against a separately approved NEW self-hosted database as its administrator.
-- No passwords, Supabase roles, platform schemas or membership are imported.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN ('koonpinai_migrator','koonpinai_runtime'))
 OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('auth','storage','supabase_functions'))
 THEN RAISE EXCEPTION 'New self-hosted target required'; END IF;
END $$;
CREATE ROLE koonpinai_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
CREATE ROLE koonpinai_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 8 PASSWORD NULL;
ALTER ROLE koonpinai_runtime SET search_path=pg_catalog,public;
-- Unqualified Drizzle CREATE TABLE must target public, never pg_catalog.
-- Only the trusted migration role may CREATE in public.
ALTER ROLE koonpinai_migrator SET search_path=public,pg_catalog;
DO $$ BEGIN
 EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC',current_database());
 EXECUTE format('GRANT CONNECT,CREATE ON DATABASE %I TO koonpinai_migrator',current_database());
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO koonpinai_runtime',current_database());
END $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO koonpinai_migrator;
GRANT USAGE ON SCHEMA public TO koonpinai_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE koonpinai_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE koonpinai_migrator IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
-- Functions grant PUBLIC EXECUTE globally by default. A schema-local REVOKE
-- cannot cancel that global default. This dedicated role owns only this app.
ALTER DEFAULT PRIVILEGES FOR ROLE koonpinai_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
