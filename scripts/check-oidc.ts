import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { kmitlTransport } from "../src/lib/auth/discovery";
import { readAuthSettings } from "../src/lib/auth/settings";
import { databaseConfig, databaseErrorCode } from "../src/db/connection";
loadEnvConfig(process.cwd());
async function main() {
  try {
    const metadata = await kmitlTransport().discovery();
    console.log(
      "Live discovery: issuer, authorization, token, UserInfo, logout and JWKS match; code + PKCE S256 supported.",
    );
    console.log(
      "RP-initiated logout endpoint advertised:",
      Boolean(metadata.end_session_endpoint),
    );
    const settings = readAuthSettings();
    console.log(
      "Local client/session/database configuration complete:",
      Boolean(settings),
    );
    if (settings) {
      console.log(
        "Register exactly this callback with the approved client:",
        settings.origin + "/api/auth/callback/keycloak",
      );
      const pool = new Pool(databaseConfig());
      try {
        await pool.query("select 1");
        const result = await pool.query(
          "select to_regclass('members') is not null as present",
        );
        console.log(
          "Database reachable; member schema present:",
          result.rows[0].present,
        );
      } finally {
        await pool.end();
      }
    }
    console.log(
      "This checks metadata/configuration only. It does not verify client approval, redirect registration or a real user login.",
    );
  } catch (error) {
    console.error(
      "OIDC/database preflight failed (" +
        databaseErrorCode(error) +
        "). Details redacted.",
    );
    process.exitCode = 1;
  }
}
void main();
