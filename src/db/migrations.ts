import { readMigrationFiles } from "drizzle-orm/migrator";
import type { PoolClient } from "pg";
import { DatabaseConfigurationError } from "./connection";

export const MIGRATION_LOCK_KEY = 1263423049;
export const migrationFiles = () =>
  readMigrationFiles({ migrationsFolder: "drizzle" });
type MigrationFile = ReturnType<typeof migrationFiles>[number];
export type LedgerRow = { hash: string; created_at: string | number };

/** Drizzle's installed migrator uses timestamps but does not compare old hashes.
 * Require an exact contiguous, unedited ledger prefix before any DDL. */
export function verifyMigrationLedger(
  files: MigrationFile[],
  rows: LedgerRow[],
) {
  if (rows.length > files.length)
    throw new DatabaseConfigurationError("MIGRATION_LEDGER_AHEAD");
  for (let i = 0; i < rows.length; i++) {
    if (
      Number(rows[i].created_at) !== files[i].folderMillis ||
      rows[i].hash !== files[i].hash
    )
      throw new DatabaseConfigurationError("MIGRATION_LEDGER_MISMATCH");
  }
  return files.slice(rows.length);
}
export async function readLedger(client: PoolClient): Promise<LedgerRow[]> {
  const exists = await client.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  );
  if (!exists.rows[0].present) return [];
  return (
    await client.query<LedgerRow>(
      "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
    )
  ).rows;
}

/** Only called by an explicitly approved CLI invocation. One pinned direct or
 * session connection, advisory transaction lock, bounded DDL, atomic ledger. */
export async function executeReviewedMigrations(
  client: PoolClient,
  approvedThrough: string | undefined,
) {
  const files = migrationFiles();
  const index = Number(approvedThrough);
  if (
    !/^\d{4}$/.test(approvedThrough ?? "") ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= files.length
  )
    throw new DatabaseConfigurationError("MIGRATION_APPROVAL_REQUIRED");
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock($1) AS acquired",
      [MIGRATION_LOCK_KEY],
    );
    if (!lock.rows[0].acquired)
      throw new DatabaseConfigurationError("MIGRATION_ALREADY_RUNNING");
    const rows = await readLedger(client);
    verifyMigrationLedger(files, rows);
    if (rows.length > index + 1)
      throw new DatabaseConfigurationError("MIGRATION_APPROVAL_SCOPE_MISMATCH");
    const pending = files.slice(rows.length, index + 1);
    if (!pending.length) {
      await client.query("ROLLBACK");
      return 0;
    }
    if (rows.length === 2) {
      const conflict = await client.query(
        "SELECT to_regclass('public.application_settings') IS NOT NULL OR to_regclass('public.timetable_sync') IS NOT NULL OR to_regtype('public.timetable_sync_state') IS NOT NULL OR to_regclass('public.student_timetables') IS NOT NULL OR to_regclass('public.timetable_entries') IS NOT NULL AS present",
      );
      if (conflict.rows[0].present)
        throw new DatabaseConfigurationError("MIGRATION_OBJECT_CONFLICT");
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
    );
    for (const migration of pending) {
      if (migration.folderMillis === files[2]?.folderMillis) {
        const grants = await client.query(
          "SELECT EXISTS (SELECT 1 FROM pg_roles r CROSS JOIN (VALUES ('public.members'), ('public.application_sessions')) t(name) WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid,t.name,'TRUNCATE') OR has_table_privilege(r.oid,t.name,'TRIGGER') OR has_table_privilege(r.oid,t.name,'REFERENCES'))) AS unsafe",
        );
        if (grants.rows[0].unsafe)
          throw new DatabaseConfigurationError(
            "MIGRATION_UNSAFE_ACCOUNT_GRANTS",
          );
      }
      for (const sql of migration.sql) if (sql.trim()) await client.query(sql);
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1,$2)',
        [migration.hash, migration.folderMillis],
      );
    }
    await client.query("COMMIT");
    return pending.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
