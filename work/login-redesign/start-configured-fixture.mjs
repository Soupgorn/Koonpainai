import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// Inert local configuration renders the real enabled UI without a university login or database.
const env = { ...process.env, ENABLE_UI_PREVIEW: "", KOONPINAI_E2E: "" };
for (const key of Object.keys(env))
  if (/^(AUTH_|NEXTAUTH_|DATABASE_URL$|DIRECT_DATABASE_URL$)/.test(key)) env[key] = "";
Object.assign(env, {
  AUTH_URL: "http://127.0.0.1:3102",
  AUTH_SECRET: randomBytes(32).toString("hex"),
  AUTH_KEYCLOAK_ID: "local-ui-fixture",
  AUTH_KEYCLOAK_SECRET: randomBytes(32).toString("hex"),
  DATABASE_URL: "postgresql://local:local@127.0.0.1:1/unreachable",
});
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3102"], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
