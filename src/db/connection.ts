import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import type { PoolConfig } from "pg";

export class DatabaseConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DatabaseConfigurationError";
  }
}

export type ConnectionPurpose = "runtime" | "migration";
export type ConnectionMode =
  "direct" | "session-pooler" | "transaction-pooler" | "other";
export function connectionMode(url: URL): ConnectionMode {
  if (url.hostname.endsWith(".pooler.supabase.com"))
    return url.port === "6543"
      ? "transaction-pooler"
      : url.port === "5432" || !url.port
        ? "session-pooler"
        : "other";
  return url.hostname.startsWith("db.") && url.hostname.endsWith(".supabase.co")
    ? "direct"
    : "other";
}

/** No connectionString is passed to pg: its URL SSL options can replace ssl.
 * Every connection, including loopback tests, verifies the chain AND hostname.
 * CA files must come from an independently trusted source, never the peer. */
export function databaseConfig(
  purpose: ConnectionPurpose = "runtime",
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    throw new DatabaseConfigurationError("GLOBAL_TLS_BYPASS_FORBIDDEN");
  if (
    purpose === "migration" &&
    !env.MIGRATION_DATABASE_URL &&
    !env.DIRECT_DATABASE_URL
  )
    throw new DatabaseConfigurationError("MIGRATION_CREDENTIAL_REQUIRED");
  const raw =
    purpose === "migration"
      ? env.MIGRATION_DATABASE_URL || env.DIRECT_DATABASE_URL
      : env.DATABASE_URL;
  let url: URL;
  try {
    url = new URL(raw ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2 ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new DatabaseConfigurationError("DATABASE_URL_INVALID");
  }
  // Reject query overrides (host, credentials, TLS options, options/search_path)
  // rather than letting pg silently override explicit security configuration.
  for (const [key, value] of url.searchParams) {
    if (key !== "sslmode" || value !== "verify-full")
      throw new DatabaseConfigurationError("DATABASE_URL_QUERY_FORBIDDEN");
  }
  if (purpose === "migration" && connectionMode(url) === "transaction-pooler")
    throw new DatabaseConfigurationError(
      "MIGRATION_REQUIRES_DIRECT_OR_SESSION",
    );
  const runtimeMax = Number(env.DATABASE_POOL_MAX ?? "2");
  if (purpose === "runtime" && (!/^[12]$/.test(env.DATABASE_POOL_MAX ?? "2") || !Number.isInteger(runtimeMax)))
    throw new DatabaseConfigurationError("RUNTIME_POOL_LIMIT_INVALID");
  const caFile =
    purpose === "migration"
      ? env.MIGRATION_DATABASE_CA_FILE || env.DATABASE_CA_FILE
      : env.DATABASE_CA_FILE;
  let ca: string | undefined;
  if (caFile) {
    try {
      ca = readFileSync(caFile, "utf8");
      const certs = ca.match(
        /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
      );
      if (!certs?.length) throw new Error();
      for (const pem of certs) {
        const cert = new X509Certificate(pem);
        if (
          !cert.ca ||
          Date.parse(cert.validFrom) > Date.now() ||
          Date.parse(cert.validTo) <= Date.now()
        )
          throw new Error();
      }
    } catch {
      throw new DatabaseConfigurationError("DATABASE_CA_FILE_INVALID");
    }
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  try {
    return {
      host,
      port: url.port ? Number(url.port) : 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: {
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        ...(ca ? { ca } : {}),
        ...(isIP(host) ? {} : { servername: host }),
        checkServerIdentity: (_hostname, cert) =>
          checkServerIdentity(host, cert),
      },
      max: purpose === "migration" ? 1 : runtimeMax,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: purpose === "migration" ? 30000 : 10000,
      ...(purpose === "runtime" ? { maxLifetimeSeconds: 300 } : {}),
      ...(purpose === "runtime" ? { query_timeout: 16000 } : {}),
      ...(purpose === "runtime" && connectionMode(url) !== "transaction-pooler"
        ? { onConnect: async (client: import("pg").ClientBase) => {
            // Hosted Supavisor can ignore startup options. Session mode keeps
            // this backend assigned; pg-pool awaits this hook before leasing it.
            const configure = { text: "SET statement_timeout='15s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'", query_timeout: 3000 };
            const verify = { text: "SELECT current_setting('statement_timeout') AS statement,current_setting('lock_timeout') AS lock,current_setting('idle_in_transaction_session_timeout') AS idle", query_timeout: 3000 };
            await client.query(configure);
            const r = (await client.query(verify)).rows[0];
            if (r.statement !== "15s" || r.lock !== "3s" || r.idle !== "15s")
              throw new DatabaseConfigurationError("RUNTIME_SESSION_TIMEOUTS_UNVERIFIED");
          } }
        : {}),
      application_name:
        purpose === "migration" ? "koonpinai-migration" : "koonpinai-runtime",
      ...(purpose === "migration"
        ? {
            options:
              "-c lock_timeout=5s -c statement_timeout=60s -c idle_in_transaction_session_timeout=60s",
          }
        : { options: "-c lock_timeout=3s -c statement_timeout=15s -c idle_in_transaction_session_timeout=15s" }),
    };
  } catch {
    throw new DatabaseConfigurationError("DATABASE_URL_INVALID");
  }
}

/** Deliberately never returns driver messages, SQL details, URLs or hostnames. */
export function databaseErrorCode(error: unknown): string {
  if (error instanceof DatabaseConfigurationError) return error.code;
  const allowed = new Set([
    "ENOTFOUND",
    "ENOENT",
    "EAI_AGAIN",
    "ENETUNREACH",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "28000",
    "28P01",
    "42501",
    "55P03",
    "57014",
    "25P03",
  ]);
  const pending: unknown[] = [error];
  for (let i = 0; i < pending.length && i < 12; i++) {
    const item = pending[i];
    if (item && typeof item === "object") {
      const value = item as {
        code?: unknown;
        cause?: unknown;
        errors?: unknown[];
      };
      if (typeof value.code === "string" && allowed.has(value.code))
        return value.code;
      if (value.cause) pending.push(value.cause);
      if (Array.isArray(value.errors)) pending.push(...value.errors);
    }
  }
  return "DATABASE_OPERATION_FAILED";
}
