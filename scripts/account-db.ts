import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { members } from "../src/db/schema";
import { KMITL_ISSUER } from "../src/lib/auth/domain";
import {
  databaseConfig,
  databaseErrorCode,
  DatabaseConfigurationError,
} from "../src/db/connection";
import { executeReviewedMigrations } from "../src/db/migrations";
loadEnvConfig(process.cwd());
async function main() {
  const operation = process.argv[2];
  let pool: Pool | undefined;
  try {
    if (
      operation === "migrate" &&
      !process.argv.some((arg) => /^--approve-through=\d{4}$/.test(arg))
    )
      throw new DatabaseConfigurationError("MIGRATION_APPROVAL_REQUIRED");
    if (process.argv.includes("--runtime-url"))
      throw new DatabaseConfigurationError(
        "RUNTIME_CREDENTIAL_OVERRIDE_FORBIDDEN",
      );
    // Both migrations and administrator promotion are operational actions.
    // Neither may borrow the web runtime credential.
    const config = databaseConfig("migration");
    pool = new Pool(config);
    const db = drizzle(pool);
    if (operation === "migrate") {
      const approval = process.argv
        .find((arg) => arg.startsWith("--approve-through="))
        ?.split("=")[1];
      const client = await pool.connect();
      try {
        const applied = await executeReviewedMigrations(client, approval);
        console.log("Reviewed migrations applied:", applied);
      } finally {
        client.release();
      }
    } else if (operation === "promote-admin") {
      const subject = process.argv[3];
      if (!subject) throw new Error();
      const changed = await db
        .update(members)
        .set({ role: "admin", status: "approved", updatedAt: new Date() })
        .where(
          and(eq(members.issuer, KMITL_ISSUER), eq(members.subject, subject)),
        )
        .returning({ id: members.id });
      if (changed.length !== 1) throw new Error();
      console.log(
        "Existing account promoted. Profile and policy gates still apply.",
      );
    } else throw new Error();
  } catch (error) {
    console.error(
      "Account database operation failed (" +
        databaseErrorCode(error) +
        "). Details redacted.",
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
void main();
