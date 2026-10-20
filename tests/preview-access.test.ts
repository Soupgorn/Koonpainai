import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { isFictionalPreview, readAuthSettings } from "../src/lib/auth/settings";
import { KMITL_ISSUER } from "../src/lib/auth/domain";
async function withFlags(
  values: Record<string, string | undefined>,
  check: () => Promise<void> | void,
) {
  const before = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
  try {
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await check();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
const response = (path: string) =>
  proxy(new NextRequest(`http://localhost:3000${path}`));
const unset = {
  AUTH_SECRET: undefined,
  AUTH_KEYCLOAK_ID: undefined,
  AUTH_KEYCLOAK_SECRET: undefined,
  DATABASE_URL: undefined,
  AUTH_URL: undefined,
  DIRECT_DATABASE_URL: undefined,
};
test("all timetable and account paths require login by default", async () => {
  await withFlags(
    {
      ...unset,
      NODE_ENV: "production",
      ENABLE_UI_PREVIEW: "true",
      ENABLE_ADMIN_DEMO: "true",
    },
    async () => {
      for (const path of [
        "/",
        "/friends/bean",
        "/admin",
        "/admin/import",
        "/admin/access",
        "/onboarding",
        "/onboarding/policy",
        "/pending-approval",
        "/my-timetable",
        "/my-timetable/import",
        "/account",
      ]) {
        const r = await response(path);
        assert.equal(r.status, 307, path);
        assert.equal(new URL(r.headers.get("location")!).pathname, "/login");
      }
    },
  );
});
test("fictional UI requires explicit development opt-in and disappears with partial credentials", async () => {
  await withFlags(
    { ...unset, NODE_ENV: "development", ENABLE_UI_PREVIEW: undefined },
    async () => {
      assert.equal((await response("/")).status, 307);
    },
  );
  await withFlags(
    { ...unset, NODE_ENV: "development", ENABLE_UI_PREVIEW: "true" },
    async () => {
      assert.ok(isFictionalPreview());
      assert.equal((await response("/")).status, 200);
    },
  );
  await withFlags(
    {
      ...unset,
      NODE_ENV: "development",
      ENABLE_UI_PREVIEW: "true",
      AUTH_KEYCLOAK_ID: "fixture-client",
    },
    async () => {
      assert.equal(isFictionalPreview(), false);
      assert.equal((await response("/")).status, 307);
    },
  );
});
test("settings pin issuer, require high-entropy session material and a canonical HTTPS production origin", () => {
  const env = {
    NODE_ENV: "development",
    AUTH_URL: "http://localhost:3000",
    AUTH_SECRET: "fixture-session-secret-with-more-than-32-characters",
    AUTH_KEYCLOAK_ID: "fixture-client",
    AUTH_KEYCLOAK_SECRET: "fixture-secret",
    DATABASE_URL: "postgres://fixture:fixture@localhost/fixture",
  } as NodeJS.ProcessEnv;
  assert.equal(readAuthSettings(env)?.issuer, KMITL_ISSUER);
  for (const changes of [
    { AUTH_SECRET: "short" },
    { AUTH_KEYCLOAK_ISSUER: "https://untrusted.example" },
    { AUTH_URL: "https://app.example/path" },
    { AUTH_URL: "http://remote.example" },
    { DATABASE_URL: "https://db.example" },
    { NODE_ENV: "production" },
  ] as Partial<NodeJS.ProcessEnv>[])
    assert.equal(readAuthSettings({ ...env, ...changes }), null);
  assert.ok(
    readAuthSettings({
      ...env,
      NODE_ENV: "production",
      AUTH_URL: "https://app.example",
    }),
  );
});
