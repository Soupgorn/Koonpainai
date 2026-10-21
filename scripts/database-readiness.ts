import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { mkdirSync, writeFileSync } from "node:fs";
import { databaseConfig, databaseErrorCode } from "../src/db/connection";
import { auditDatabase } from "../src/db/audit";
loadEnvConfig(process.cwd());
async function main() {
  let pool: Pool | undefined;
  try {
    const purpose = process.argv.includes("--runtime")
      ? "runtime"
      : "migration";
    pool = new Pool(databaseConfig(purpose));
    const client = await pool.connect();
    try {
      const report = await auditDatabase(client);
      mkdirSync(".private/database-readiness", { recursive: true });
      writeFileSync(
        `.private/database-readiness/${purpose}-audit.json`,
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(
        JSON.stringify(
          {
            purpose,
            serverVersion: report.identity.version,
            readOnly: report.identity.read_only,
            clientCertificateVerified: report.clientCertificateVerified,
            backendTls: report.backendTls?.ssl,
            ledgerStatus: report.ledgerStatus,
            appliedMigrationCount: report.ledger.length,
            pending0002: report.pending0002,
            accountTables: report.tables
              .filter((t) => t.schema === "public")
              .map((t) => ({
                name: t.name,
                rls: t.rls,
                forceRls: t.force_rls,
              })),
            policyCount: report.policies.length,
            report: "ignored private audit file",
          },
          null,
          2,
        ),
      );
      if (report.ledgerStatus !== "match" || !report.clientCertificateVerified)
        process.exitCode = 1;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "Read-only database audit failed (" +
        databaseErrorCode(error) +
        "). Details redacted.",
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
void main();
