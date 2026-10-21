import { spawn } from "node:child_process";
const env = {
  ...process.env,
  ENABLE_UI_PREVIEW: "true",
  KOONPINAI_E2E: "true",
};
// Empty values override dotenv in this child only. Port 3000 stays configured.
for (const key of [
  ...Object.keys(env),
  "AUTH_SECRET",
  "AUTH_KEYCLOAK_ID",
  "AUTH_KEYCLOAK_SECRET",
  "AUTH_KEYCLOAK_ISSUER",
  "AUTH_URL",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "MIGRATION_DATABASE_CA_FILE",
  "DATABASE_CA_FILE",
  "DATABASE_POOL_MAX",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
])
  if (/^(AUTH_|NEXTAUTH_|DATABASE_|DIRECT_DATABASE_|MIGRATION_|PG|SUPABASE_)/i.test(key))
    env[key] = "";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
