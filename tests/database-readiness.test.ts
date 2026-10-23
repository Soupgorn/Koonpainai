import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import type { PoolClient } from "pg";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, connect, type ConnectionOptions } from "node:tls";
import { once } from "node:events";
import { databaseConfig, databaseErrorCode } from "../src/db/connection";
import {
  migrationFiles,
  verifyMigrationLedger,
  executeReviewedMigrations,
} from "../src/db/migrations";
const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://fixture:fixture@db.example.invalid:5432/fixture",
};
test("database TLS is mandatory; pg cannot overwrite chain/hostname verification with URL flags", () => {
  const config = databaseConfig("runtime", env);
  assert.equal(config.connectionString, undefined);
  const client = new Client(config);
  assert.equal(typeof client.ssl, "object");
  const ssl = (client as unknown as { ssl: ConnectionOptions }).ssl;
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.minVersion, "TLSv1.2");
  assert.equal(typeof ssl.checkServerIdentity, "function");
  for (const suffix of [
    "?sslmode=disable",
    "?sslmode=no-verify",
    "?sslmode=require",
    "?sslmode=verify-ca",
    "?uselibpqcompat=true",
    "?sslrootcert=unknown",
    "?host=attacker.invalid",
    "?options=-c%20statement_timeout=0",
  ])
    assert.throws(() =>
      databaseConfig("runtime", {
        ...env,
        DATABASE_URL: env.DATABASE_URL + suffix,
      }),
    );
  assert.throws(() =>
    databaseConfig("runtime", { ...env, NODE_TLS_REJECT_UNAUTHORIZED: "0" }),
  );
  assert.throws(() =>
    databaseConfig("runtime", {
      ...env,
      DATABASE_CA_FILE: "not-a-real-certificate",
    }),
  );
  assert.equal(
    (
      databaseConfig("runtime", {
        ...env,
        DATABASE_URL: env.DATABASE_URL + "?sslmode=verify-full",
      }).ssl as ConnectionOptions
    ).rejectUnauthorized,
    true,
  );
});
test("migration connections reject transaction pooling and use one bounded direct/session connection", () => {
  const transaction =
    "postgresql://fixture:fixture@test.pooler.supabase.com:6543/fixture";
  assert.throws(() =>
    databaseConfig("migration", {
      ...env,
      MIGRATION_DATABASE_URL: transaction,
    }),
  );
  const config = databaseConfig("migration", {
    ...env,
    MIGRATION_DATABASE_URL: transaction.replace(":6543", ":5432"),
  });
  assert.equal(config.max, 1);
  assert.match(config.options!, /lock_timeout=5s/);
  assert.match(config.options!, /statement_timeout=60s/);
  assert.match(config.options!, /idle_in_transaction_session_timeout=60s/);
});
test("operational credentials are explicit and never fall back to the web runtime secret", () => {
  assert.throws(
    () => databaseConfig("migration", env),
    (e: unknown) =>
      (e as { code: string }).code === "MIGRATION_CREDENTIAL_REQUIRED",
  );
  const split = {
    ...env,
    DATABASE_URL:
      "postgresql://koonpinai_runtime:runtime-secret@session.pooler.supabase.com:5432/fixture",
    MIGRATION_DATABASE_URL:
      "postgresql://postgres:operator-secret@session.pooler.supabase.com:5432/fixture",
  };
  assert.equal(databaseConfig("runtime", split).user, "koonpinai_runtime");
  assert.equal(databaseConfig("runtime", split).password, "runtime-secret");
  assert.equal(databaseConfig("migration", split).user, "postgres");
  assert.equal(databaseConfig("migration", split).password, "operator-secret");
  assert.equal(
    databaseConfig("migration", {
      ...env,
      DIRECT_DATABASE_URL: split.MIGRATION_DATABASE_URL,
    }).user,
    "postgres",
  );
  assert.throws(() =>
    databaseConfig("runtime", {
      NODE_ENV: "test",
      MIGRATION_DATABASE_URL: split.MIGRATION_DATABASE_URL,
    }),
  );
  const session = databaseConfig("runtime", {
    ...env,
    DATABASE_URL:
      "postgresql://koonpinai_runtime.fixture:runtime-secret@session.pooler.supabase.com:5432/fixture",
  });
  assert.equal(session.user, "koonpinai_runtime.fixture");
  assert.equal(session.port, 5432);
  assert.equal((session.ssl as ConnectionOptions).rejectUnauthorized, true);
});
test("errors expose only classified codes; nested driver secrets and unknown messages are omitted", () => {
  assert.equal(
    databaseErrorCode({
      cause: {
        code: "SELF_SIGNED_CERT_IN_CHAIN",
        message: "fixture-secret-url",
      },
    }),
    "SELF_SIGNED_CERT_IN_CHAIN",
  );
  assert.equal(
    databaseErrorCode(new Error("fixture-secret-url")),
    "DATABASE_OPERATION_FAILED",
  );
  assert.equal(
    databaseErrorCode({
      errors: [{ code: "ENOTFOUND", hostname: "private-host" }],
    }),
    "ENOTFOUND",
  );
});
test("ledger comparison rejects edited, reordered, missing and unknown migrations", () => {
  const files = migrationFiles(),
    rows = files
      .slice(0, 2)
      .map((f) => ({ hash: f.hash, created_at: f.folderMillis }));
  assert.equal(verifyMigrationLedger(files, rows).length, 1);
  assert.throws(() =>
    verifyMigrationLedger(files, [{ ...rows[0], hash: "changed" }]),
  );
  assert.throws(() => verifyMigrationLedger(files, [rows[1]]));
  assert.throws(() => verifyMigrationLedger(files, [...rows, ...rows]));
});
test("migration execution requires explicit scope, rollback on lock contention, and never advances on checksum drift", async () => {
  const calls: string[] = [];
  const fake = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("pg_try_advisory"))
        return { rows: [{ acquired: false }] };
      return { rows: [] };
    },
  } as unknown as PoolClient;
  await assert.rejects(executeReviewedMigrations(fake, undefined));
  assert.equal(calls.length, 0);
  await assert.rejects(executeReviewedMigrations(fake, "0002"));
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(
    calls.some((s) => s.startsWith("CREATE")),
    false,
  );
});
test(
  "actual TLS handshake accepts the configured CA and rejects untrusted roots and wrong hostnames",
  { skip: process.env.RUN_DATABASE_TLS_TESTS !== "true" },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "koonpinai-tls-"));
    const key = join(directory, "server.key"),
      cert = join(directory, "ca.crt");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
        "-addext",
        "basicConstraints=critical,CA:TRUE",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    const server = createServer(
      { key: readFileSync(key), cert: readFileSync(cert) },
      (socket) => socket.end(),
    );
    server.on("tlsClientError", () => {});
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const handshake = (trusted: boolean, hostname: string) =>
      new Promise<void>((success, failure) => {
        const ssl = databaseConfig("runtime", {
          ...env,
          DATABASE_URL: `postgresql://fixture:fixture@${hostname}:5432/fixture`,
          ...(trusted ? { DATABASE_CA_FILE: cert } : {}),
        }).ssl as ConnectionOptions;
        const socket = connect({
          ...ssl,
          host: "127.0.0.1",
          port: address.port,
        });
        socket.once("secureConnect", () => {
          try {
            assert.equal(socket.authorized, true);
            success();
          } catch (error) {
            failure(error);
          } finally {
            socket.destroy();
          }
        });
        socket.once("error", failure);
      });
    try {
      await handshake(true, "localhost");
      await assert.rejects(handshake(false, "localhost"));
      await assert.rejects(
        handshake(true, "wrong.example.invalid"),
        (error: unknown) =>
          databaseErrorCode(error) === "ERR_TLS_CERT_ALTNAME_INVALID",
      );
    } finally {
      try {
        await new Promise<void>((done) => server.close(() => done()));
      } finally {
        assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
        assert.ok(basename(directory).startsWith("koonpinai-tls-"));
        rmSync(directory, { recursive: true, force: true });
      }
    }
  },
);
