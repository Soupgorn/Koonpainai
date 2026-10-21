import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { createHash, randomUUID, X509Certificate } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { resolve, relative, join, isAbsolute, sep } from "node:path";
import {
  databaseConfig,
  databaseErrorCode,
  DatabaseConfigurationError,
} from "../src/db/connection";
import { migrationFiles } from "../src/db/migrations";
loadEnvConfig(process.cwd());
const arg = (key: string) =>
  process.argv.find((s) => s.startsWith(key + "="))?.slice(key.length + 1);
async function main() {
  let pool: Pool | undefined;
  let directory: string | undefined;
  try {
    const root = resolve(arg("--output-root") ?? "");
    const fromRepo = relative(process.cwd(), root);
    if (
      !arg("--output-root") ||
      (!(fromRepo === ".." || fromRepo.startsWith(".." + sep)) &&
        !isAbsolute(fromRepo))
    )
      throw new DatabaseConfigurationError("BACKUP_MUST_BE_OUTSIDE_REPOSITORY");
    const bin = arg("--pg-bin");
    if (!bin) throw new DatabaseConfigurationError("PG_BIN_REQUIRED");
    const config = databaseConfig("migration");
    const ca =
      process.env.MIGRATION_DATABASE_CA_FILE || process.env.DATABASE_CA_FILE;
    if (!ca) throw new DatabaseConfigurationError("BACKUP_CA_FILE_REQUIRED");
    directory = join(
      root,
      new Date().toISOString().replace(/[:.]/g, "-") +
        "-" +
        randomUUID().slice(0, 8),
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
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
          directory,
          "/inheritance:r",
          "/grant:r",
          "*" + sid + ":(OI)(CI)F",
          "*S-1-5-18:(OI)(CI)F",
        ],
        { stdio: "ignore" },
      );
    }
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: config.host,
      PGPORT: String(config.port),
      PGDATABASE: String(config.database),
      PGUSER: config.user,
      PGPASSWORD:
        typeof config.password === "string" ? config.password : undefined,
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: resolve(ca),
      PGCONNECT_TIMEOUT: "5",
      PGAPPNAME: "koonpinai-readonly-backup",
      PGOPTIONS:
        "-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000",
    };
    delete env.PGSERVICE;
    delete env.PGSERVICEFILE;
    delete env.PGSSLCERT;
    delete env.PGSSLKEY;
    const run = (tool: string, args: string[], capture = false) =>
      new Promise<string>((resolveCommand, reject) => {
        const child = spawn(
          join(bin, tool + (process.platform === "win32" ? ".exe" : "")),
          args,
          { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
        );
        let output = "";
        child.stdout.on("data", (chunk) => {
          if (capture) output += chunk.toString();
        });
        child.stderr.resume();
        child.on("error", () =>
          reject(new DatabaseConfigurationError("BACKUP_TOOL_FAILED")),
        );
        child.on("exit", (code) =>
          code === 0
            ? resolveCommand(output)
            : reject(new DatabaseConfigurationError("BACKUP_TOOL_FAILED")),
        );
      });
    const toolVersion = (await run("pg_dump", ["--version"], true)).trim();
    pool = new Pool(config);
    const client = await pool.connect();
    client.on("error", () => {});
    const keepAlive = setInterval(() => {
      void client.query("SELECT 1").catch(() => {});
    }, 15000);
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout='120s'");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      const snapshot = (
        await client.query("SELECT pg_export_snapshot() AS snapshot")
      ).rows[0].snapshot;
      const tables = (
        await client.query(
          "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY 1,2",
        )
      ).rows;
      const evidence = [];
      for (const table of ["members", "application_sessions", "student_timetables", "timetable_entries"].filter(name => tables.some(t => t.schemaname === "public" && t.tablename === name))) {
        const order = table === "student_timetables" ? "member_id" : "id";
        const result = await client.query(
          `SELECT count(*)::text AS rows,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY ${order})::text,'[]')) AS digest FROM public.${table} t`,
        );
        evidence.push({ table, ...result.rows[0] });
      }
      await run("pg_dump", [
        "--format=custom",
        "--no-password",
        "--lock-wait-timeout=5s",
        "--snapshot=" + snapshot,
        "--file=" + join(directory, "database-full.dump"),
      ]);
      await run("pg_dump", [
        "--format=custom",
        "--no-password",
        "--lock-wait-timeout=5s",
        "--snapshot=" + snapshot,
        "--schema=public",
        "--schema=drizzle",
        "--file=" + join(directory, "koonpinai-application.dump"),
      ]);
      // Password verifiers are explicitly excluded from role metadata.
      await run("pg_dumpall", [
        "--roles-only",
        "--no-role-passwords",
        "--no-password",
        "--file=" + join(directory, "roles-no-passwords.sql"),
      ]);
      const artifacts: Array<{
        file: string;
        bytes: number;
        sha256: string;
        tocEntries?: number;
        decodeVerified?: boolean;
      }> = [];
      for (const name of ["database-full.dump", "koonpinai-application.dump"]) {
        const toc = await run(
          "pg_restore",
          ["--list", join(directory, name)],
          true,
        );
        for (const table of evidence.map(e => e.table))
          if (!toc.includes("TABLE DATA public " + table + " "))
            throw new DatabaseConfigurationError(
              "BACKUP_APPLICATION_DATA_MISSING",
            );
        writeFileSync(join(directory, name + ".toc"), toc, { mode: 0o600 });
        // Decode every archive block offline; no --dbname, no database writes.
        await run("pg_restore", [
          "--file=" + (process.platform === "win32" ? "NUL" : "/dev/null"),
          join(directory, name),
        ]);
        const data = readFileSync(join(directory, name));
        artifacts.push({
          file: name,
          bytes: data.length,
          sha256: createHash("sha256").update(data).digest("hex"),
          tocEntries: toc.split("\n").filter((s) => s && !s.startsWith(";"))
            .length,
          decodeVerified: true,
        });
      }
      const roles = readFileSync(join(directory, "roles-no-passwords.sql"));
      artifacts.push({
        file: "roles-no-passwords.sql",
        bytes: roles.length,
        sha256: createHash("sha256").update(roles).digest("hex"),
      });
      const manifest = {
        status: "archive-verified-restore-pending",
        createdAt: new Date().toISOString(),
        serverVersion: (await client.query("SHOW server_version_num")).rows[0]
          .server_version_num,
        toolVersion,
        scope:
          "Full logical database archive plus separately recoverable public/drizzle application archive; not Storage object files, platform secrets or physical/PITR backup.",
        tls: "verify-full",
        caFingerprint: new X509Certificate(readFileSync(ca)).fingerprint256,
        tables,
        evidence,
        artifacts,
        migrations: migrationFiles().map((f, index) => ({
          index,
          hash: f.hash,
          timestamp: f.folderMillis,
        })),
        applicationRestoreVerified: false,
        fullManagedRestoreVerified: false,
      };
      writeFileSync(
        join(directory, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
        { mode: 0o600 },
      );
      if (process.platform !== "win32")
        for (const name of [
          "database-full.dump",
          "koonpinai-application.dump",
          "roles-no-passwords.sql",
        ])
          chmodSync(join(directory, name), 0o600);
      console.log("Read-only backup complete. Local directory:", directory);
      console.log(
        "Archives listed and SHA-256 recorded; restore is NOT yet verified. No database writes performed.",
      );
    } finally {
      clearInterval(keepAlive);
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  } catch (error) {
    console.error(
      "Backup failed (" +
        databaseErrorCode(error) +
        "). Details redacted. Any partial artifacts must not be treated as verified.",
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
void main();
