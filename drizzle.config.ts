import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";
import { databaseConfig } from "./src/db/connection";
import type { ConnectionOptions } from "node:tls";
loadEnvConfig(process.cwd());
const connection =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DIRECT_DATABASE_URL
    ? databaseConfig("migration")
    : undefined;
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: connection
    ? {
        host: connection.host!,
        port: connection.port,
        user: connection.user,
        password:
          typeof connection.password === "string"
            ? connection.password
            : undefined,
        database: String(connection.database),
        ssl: connection.ssl as ConnectionOptions,
      }
    : { url: "" },
  strict: true,
  verbose: false,
});
