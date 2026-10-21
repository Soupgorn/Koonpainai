import { Pool } from "pg";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, relative, isAbsolute, sep } from "node:path";
import assert from "node:assert/strict";
import {
  databaseConfig,
  databaseErrorCode,
  DatabaseConfigurationError,
} from "../src/db/connection";
import {
  executeReviewedMigrations,
  migrationFiles,
  readLedger,
  verifyMigrationLedger,
} from "../src/db/migrations";
import { auditDatabase } from "../src/db/audit";

// Intentionally does NOT load .env files. Production credentials are never used.
const arg = (key: string) =>
  process.argv.find((s) => s.startsWith(key + "="))?.slice(key.length + 1);
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
async function main() {
  let started = false;
  let pool: Pool | undefined;
  let stage = "plan";
  const backup = resolve(arg("--backup-dir") ?? "");
  const bin = resolve(arg("--pg-bin") ?? "");
  const root = resolve(arg("--test-root") ?? "");
  const data = join(root, "data");
  let run: (
    name: string,
    args: string[],
    env?: NodeJS.ProcessEnv,
  ) => Promise<string>;
  try {
    for (const path of [backup, root]) {
      const rel = relative(process.cwd(), path);
      if (!(rel === ".." || rel.startsWith(".." + sep)) && !isAbsolute(rel))
        throw new DatabaseConfigurationError(
          "RECOVERY_MUST_BE_OUTSIDE_REPOSITORY",
        );
    }
    if (!arg("--backup-dir") || !arg("--pg-bin") || !arg("--test-root"))
      throw new DatabaseConfigurationError("RECOVERY_PATHS_REQUIRED");
    const manifest = JSON.parse(
      readFileSync(join(backup, "manifest.json"), "utf8"),
    );
    for (const artifact of manifest.artifacts) {
      const content = readFileSync(join(backup, artifact.file));
      assert.equal(
        createHash("sha256").update(content).digest("hex"),
        artifact.sha256,
      );
    }
    const migrations = migrationFiles();
    // Pending SQL may be hardened after a backup; applied 0000/0001 never change.
    assert.deepEqual(
      manifest.migrations.slice(0, 2),
      migrations.slice(0, 2).map((f, index) => ({
        index,
        hash: f.hash,
        timestamp: f.folderMillis,
      })),
    );
    console.log(
      "Plan: new local PostgreSQL 17.11 cluster; TLS verify-full; 127.0.0.1:55432 only.",
    );
    console.log(
      "Restore the public/drizzle application archive into two new local databases; compare data digests and ledger; rehearse 0002 transaction rollback and commit locally; stop server.",
    );
    console.log(
      "Production is never connected. No DROP/--clean command. Full Supabase-managed schema restore is outside this native PostgreSQL rehearsal.",
    );
    if (!process.argv.includes("--approve-isolated-writes")) {
      console.log("PLAN ONLY: no database writes. Awaiting explicit approval.");
      return;
    }
    if (existsSync(root))
      throw new DatabaseConfigurationError("RECOVERY_TARGET_MUST_BE_NEW");
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (process.platform === "win32") {
      const sid = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      execFileSync(
        "icacls.exe",
        [
          root,
          "/inheritance:r",
          "/grant:r",
          "*" + sid + ":(OI)(CI)F",
          "*S-1-5-18:(OI)(CI)F",
        ],
        { stdio: "ignore" },
      );
    }
    const baseEnv = { ...process.env };
    for (const key of Object.keys(baseEnv))
      if (
        /^(PG|AUTH_|NEXTAUTH_|DATABASE|DIRECT_DATABASE|MIGRATION_DATABASE)/.test(
          key,
        )
      )
        delete baseEnv[key];
    run = (name, args, env = baseEnv) =>
      new Promise((success, failure) => {
        const exe =
          name === "openssl"
            ? "openssl"
            : join(bin, name + (process.platform === "win32" ? ".exe" : ""));
        const child = spawn(exe, args, {
          env,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "",
          error = "";
        child.stdout.on("data", (chunk) => (output += chunk.toString()));
        child.stderr.on("data", (chunk) => (error += chunk.toString()));
        child.on("error", () =>
          failure(new DatabaseConfigurationError("LOCAL_TOOL_FAILED")),
        );
        child.on("exit", (code) => {
          if (code === 0) success(output);
          else {
            writeFileSync(join(root, "failed-tool.log"), error, {
              mode: 0o600,
            });
            failure(new DatabaseConfigurationError("LOCAL_TOOL_FAILED"));
          }
        });
      });
    stage = "initialize isolated cluster";
    const password = randomBytes(32).toString("hex"),
      pwFile = join(root, "local-password");
    writeFileSync(pwFile, password, { mode: 0o600 });
    await run("initdb", [
      "--pgdata=" + data,
      "--username=postgres",
      "--pwfile=" + pwFile,
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
      "--no-instructions",
    ]);
    const ca = join(root, "ca.crt"),
      key = join(root, "server.key"),
      cert = join(root, "server.crt");
    await run("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(root, "ca.key"),
      "-out",
      ca,
      "-days",
      "2",
      "-subj",
      "/CN=Koonpinai isolated test CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
    ]);
    await run("openssl", [
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      join(root, "server.csr"),
      "-subj",
      "/CN=localhost",
    ]);
    writeFileSync(
      join(root, "extensions.cnf"),
      "subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n",
    );
    await run("openssl", [
      "x509",
      "-req",
      "-in",
      join(root, "server.csr"),
      "-CA",
      ca,
      "-CAkey",
      join(root, "ca.key"),
      "-CAcreateserial",
      "-out",
      cert,
      "-days",
      "2",
      "-extfile",
      join(root, "extensions.cnf"),
    ]);
    const configPath = (p: string) =>
      p.replaceAll("\\", "/").replaceAll("'", "''");
    writeFileSync(
      join(data, "postgresql.conf"),
      readFileSync(join(data, "postgresql.conf"), "utf8") +
        `\nlisten_addresses='127.0.0.1'\nport=55432\nssl=on\nssl_cert_file='${configPath(cert)}'\nssl_key_file='${configPath(key)}'\n`,
    );
    await run("pg_ctl", [
      "-D",
      data,
      "-l",
      join(root, "server.log"),
      "-w",
      "start",
    ]);
    started = true;
    const env: NodeJS.ProcessEnv = {
      ...baseEnv,
      PGHOST: "127.0.0.1",
      PGPORT: "55432",
      PGUSER: "postgres",
      PGPASSWORD: password,
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: ca,
      PGCONNECT_TIMEOUT: "5",
    };
    const localConfig = (database: string) =>
      databaseConfig("runtime", {
        NODE_ENV: "test",
        DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:55432/${database}`,
        DATABASE_CA_FILE: ca,
      });
    pool = new Pool(localConfig("postgres"));
    const control = await pool.connect();
    try {
      assert.equal(
        resolve(
          (await control.query("SHOW data_directory")).rows[0].data_directory,
        ).toLowerCase(),
        resolve(data).toLowerCase(),
      );
      assert.equal(
        (await control.query("SHOW server_version_num")).rows[0]
          .server_version_num,
        manifest.serverVersion,
      );
      for (const role of [
        "koonpinai_runtime",
        "anon",
        "authenticated",
        "service_role",
        "supabase_admin",
        "authenticator",
        "supabase_auth_admin",
        "supabase_storage_admin",
        "supabase_realtime_admin",
        "supabase_replication_admin",
      ]) {
        if (
          !(
            await control.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
              role,
            ])
          ).rowCount
        )
          await control.query("CREATE ROLE " + quote(role) + " NOLOGIN");
      }
      await control.query("CREATE DATABASE koonpinai_rehearsal");
      await control.query("CREATE DATABASE koonpinai_recovery");
    } finally {
      control.release();
    }
    const toc = await run(
      "pg_restore",
      ["--list", join(backup, "koonpinai-application.dump")],
      env,
    );
    const list = join(root, "application.restore-list");
    writeFileSync(
      list,
      toc
        .split("\n")
        .filter((line) => !/^\d+;.* SCHEMA - public /.test(line))
        .join("\n"),
    );
    const checkData = async (client: Parameters<typeof auditDatabase>[0]) => {
      await client.query("SET TIME ZONE 'UTC'");
      for (const expected of manifest.evidence) {
        assert.ok(["members", "application_sessions"].includes(expected.table));
        const actual = (
          await client.query(
            `SELECT count(*)::text AS rows,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS digest FROM public.${expected.table} t`,
          )
        ).rows[0];
        assert.equal(actual.rows, expected.rows);
        assert.equal(actual.digest, expected.digest);
      }
    };
    const restore = async (database: string) => {
      await run(
        "pg_restore",
        [
          "--exit-on-error",
          "--no-password",
          "--use-list=" + list,
          "--dbname=" + database,
          join(backup, "koonpinai-application.dump"),
        ],
        { ...env, PGDATABASE: database },
      );
      const connection = new Pool(localConfig(database)),
        client = await connection.connect();
      try {
        await checkData(client);
        verifyMigrationLedger(migrations, await readLedger(client));
        assert.equal((await readLedger(client)).length, 2);
        return await auditDatabase(client);
      } finally {
        client.release();
        await connection.end();
      }
    };
    stage = "restore application archive";
    const before = await restore("koonpinai_rehearsal");
    assert.ok(before.pending0002);
    const rehearsal = new Pool(localConfig("koonpinai_rehearsal")),
      client = await rehearsal.connect();
    let after;
    try {
      stage = "transaction rollback rehearsal";
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='60s'");
      for (const sql of migrations[2].sql)
        if (sql.trim()) await client.query(sql);
      assert.ok(
        (
          await client.query(
            "SELECT to_regclass('public.student_timetables') IS NOT NULL AS present",
          )
        ).rows[0].present,
      );
      await client.query("ROLLBACK");
      assert.equal(
        (
          await client.query(
            "SELECT to_regclass('public.student_timetables') IS NULL AS absent",
          )
        ).rows[0].absent,
        true,
      );
      assert.equal((await readLedger(client)).length, 2);
      await checkData(client);
      stage = "local migration commit rehearsal";
      // Apply the proposed grant repair only on this isolated restored copy.
      if (
        before.grants.some(
          (g) =>
            ["anon", "authenticated"].includes(g.grantee) &&
            g.privilege_type === "TRUNCATE",
        )
      ) {
        await assert.rejects(
          executeReviewedMigrations(client, "0002"),
          (error: unknown) =>
            (error as { code: string }).code ===
            "MIGRATION_UNSAFE_ACCOUNT_GRANTS",
        );
        await client.query(
          readFileSync(
            "operations/account-grants-remediation.PROPOSED.sql",
            "utf8",
          ),
        );
      }
      assert.equal(await executeReviewedMigrations(client, "0002"), 1);
      await checkData(client);
      after = await auditDatabase(client);
      assert.equal(after.ledger.length, 3);
      assert.equal(after.ledgerStatus, "match");
      for (const name of ["student_timetables", "timetable_entries"])
        assert.equal(after.tables.find((t) => t.name === name)?.rls, true);
      assert.equal(
        after.grants.some(
          (g) =>
            ["anon", "authenticated", "PUBLIC"].includes(g.grantee) &&
            ["student_timetables", "timetable_entries"].includes(g.table_name),
        ),
        false,
      );
      const revisionDefault = (await client.query("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='student_timetables' AND column_name='revision'")).rows[0];
      assert.equal(revisionDefault.column_default, '0');
      assert.equal(await executeReviewedMigrations(client, "0002"), 0);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      await rehearsal.end();
    }
    stage = "recovery to a second fresh database";
    const recovered = await restore("koonpinai_recovery");
    assert.ok(recovered.pending0002);
    const report = {
      completedAt: new Date().toISOString(),
      status: "application-restore-and-local-migration-verified",
      productionWrites: false,
      archiveSha256Verified: true,
      dataDigestsMatch: true,
      ledgerChecksumsMatch: true,
      transactionRollbackVerified: true,
      recoveryToPre0002Verified: true,
      serverVersion: manifest.serverVersion,
      tlsVerified:
        before.clientCertificateVerified && after.clientCertificateVerified,
      fullSupabaseManagedRestoreVerified: false,
      sourceArchive: manifest.artifacts.find(
        (a: { file: string }) => a.file === "koonpinai-application.dump",
      ),
      before,
      after,
      recovered,
    };
    writeFileSync(
      join(root, "verification.json"),
      JSON.stringify(report, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log(
      "Isolated application restore, data comparison, ledger, migration 0002 and rollback/recovery checks passed. Production was not connected.",
    );
    console.log("Private evidence directory:", root);
  } catch (error) {
    console.error(
      "Isolated verification stopped at " +
        stage +
        " (" +
        databaseErrorCode(error) +
        "). Details retained privately.",
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
    if (started) {
      try {
        await run!("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
      } catch {
        console.error(
          "Stop the isolated server using pg_ctl and its documented data directory.",
        );
        process.exitCode = 1;
      }
    }
  }
}
void main();
