import type { PoolClient } from "pg";
import { TLSSocket } from "node:tls";
import {
  migrationFiles,
  readLedger,
  verifyMigrationLedger,
} from "./migrations";

/** Catalog metadata only. No member, session, credential or token rows. */
export async function auditDatabase(client: PoolClient) {
  await client.query("BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const identity = (
      await client.query(
        "SELECT current_user AS role, current_setting('server_version_num') AS version, current_setting('transaction_read_only') AS read_only, current_setting('row_security') AS row_security",
      )
    ).rows[0];
    const tls = (
      await client.query(
        "SELECT ssl, version, bits FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
      )
    ).rows[0];
    const tables = (
      await client.query(
        "SELECT n.nspname AS schema,c.relname AS name,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND ((n.nspname='public' AND c.relname IN ('members','application_sessions','student_timetables','timetable_entries','application_settings','timetable_sync')) OR (n.nspname='drizzle' AND c.relname='__drizzle_migrations')) ORDER BY 1,2",
      )
    ).rows;
    const columns = (
      await client.query(
        "SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE (table_schema='public' AND table_name IN ('members','application_sessions','student_timetables','timetable_entries','application_settings','timetable_sync')) OR (table_schema='drizzle' AND table_name='__drizzle_migrations') ORDER BY table_schema,table_name,ordinal_position",
      )
    ).rows;
    const enums = (
      await client.query(
        "SELECT t.typname AS name,pg_get_userbyid(t.typowner) AS owner,array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' AND t.typname IN ('approval_status','member_role','timetable_sync_state') GROUP BY t.oid,t.typname,t.typowner ORDER BY 1",
      )
    ).rows;
    const constraints = (
      await client.query(
        "SELECT c.conrelid::regclass::text AS table_name,c.conname AS name,c.contype AS type,c.convalidated AS validated,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c WHERE c.conrelid IN (SELECT cl.oid FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE (n.nspname='public' AND cl.relname IN ('members','application_sessions','student_timetables','timetable_entries','application_settings','timetable_sync')) OR (n.nspname='drizzle' AND cl.relname='__drizzle_migrations')) ORDER BY 1,2",
      )
    ).rows;
    const indexes = (
      await client.query(
        "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE (schemaname='public' AND tablename IN ('members','application_sessions','student_timetables','timetable_entries','application_settings','timetable_sync')) OR (schemaname='drizzle' AND tablename='__drizzle_migrations') ORDER BY 1,2,3",
      )
    ).rows;
    const policies = (
      await client.query(
        "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('members','application_sessions','student_timetables','timetable_entries','application_settings','timetable_sync') ORDER BY 1,2,3",
      )
    ).rows;
    const roles = (
      await client.query(
        "SELECT rolname AS name,rolsuper AS superuser,rolinherit AS inherit,rolcreaterole AS create_role,rolcreatedb AS create_db,rolcanlogin AS login,rolbypassrls AS bypass_rls FROM pg_roles WHERE rolname=current_user OR rolname IN ('anon','authenticated','service_role','supabase_admin') ORDER BY 1",
      )
    ).rows;
    const grants = (
      await client.query(
        "SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges WHERE (table_schema='public' AND table_name IN ('members','application_sessions','student_timetables','timetable_entries','application_settings','timetable_sync')) OR (table_schema='drizzle' AND table_name='__drizzle_migrations') ORDER BY 1,2,3,4",
      )
    ).rows;
    const schemaGrants = (
      await client.query(
        "SELECT r.rolname AS role,n.nspname AS schema,has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,has_schema_privilege(r.oid,n.oid,'CREATE') AS create FROM pg_roles r CROSS JOIN pg_namespace n WHERE (r.rolname=current_user OR r.rolname IN ('anon','authenticated','service_role')) AND n.nspname IN ('public','drizzle') ORDER BY 1,2",
      )
    ).rows;
    const defaultGrants = (
      await client.query(
        "SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname AS schema,d.defaclobjtype AS object_type,d.defaclacl::text AS acl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname IN ('public','drizzle') OR d.defaclnamespace=0",
      )
    ).rows;
    const membership = (
      await client.query(
        "SELECT r.rolname AS role,pg_has_role(current_user,r.oid,'MEMBER') AS member FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','supabase_admin') ORDER BY 1",
      )
    ).rows;
    const ledger = await readLedger(client),
      files = migrationFiles();
    let ledgerStatus = "match";
    try {
      verifyMigrationLedger(files, ledger);
    } catch {
      ledgerStatus = "mismatch";
    }
    return {
      observedAt: new Date().toISOString(),
      identity,
      clientCertificateVerified:
        client.connection.stream instanceof TLSSocket &&
        client.connection.stream.authorized === true,
      backendTls: tls,
      tables,
      columns,
      enums,
      constraints,
      indexes,
      policies,
      roles,
      grants,
      schemaGrants,
      defaultGrants,
      membership,
      ledgerStatus,
      ledger,
      localMigrations: files.map((f, index) => ({
        index,
        hash: f.hash,
        timestamp: f.folderMillis,
      })),
      pending0002:
        !tables.some((t) => ["student_timetables", "timetable_entries", "timetable_sync", "application_settings"].includes(t.name)) &&
        !enums.some((e) => e.name === "timetable_sync_state") &&
        ledger.length === 2,
    };
  } finally {
    await client.query("ROLLBACK");
  }
}
