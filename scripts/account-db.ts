import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { members } from "../src/db/schema";
import { KMITL_ISSUER } from "../src/lib/auth/domain";
loadEnvConfig(process.cwd());
async function main() {
  const operation = process.argv[2];
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not configured.");
    process.exit(1);
  }
  const connectionString = process.argv.includes("--runtime-url")
    ? process.env.DATABASE_URL
    : process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    const db = drizzle(pool);
    if (operation === "migrate") {
      await migrate(db, { migrationsFolder: "drizzle" });
      console.log("Account schema migrations applied.");
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
  } catch {
    console.error(
      "Account database operation failed. Check local configuration and operation; no credentials are logged.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void main();
