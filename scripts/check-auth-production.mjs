import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { osEnvironment } from "../runtime/secrets.mjs";
import { request as httpRequest } from "node:http";
const base = "http://127.0.0.1:3200",
  canonical = "https://app.example";
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "ignore",
  env: {
    ...osEnvironment(),
    NODE_ENV: "production",
    PORT: "3200",
    HOSTNAME: "127.0.0.1",
    ENABLE_UI_PREVIEW: "true",
    ENABLE_ADMIN_DEMO: "true",
    AUTH_URL: canonical,
    AUTH_REDIRECT_PROXY_URL: "",
    AUTH_SECRET: "production-smoke-fixture-secret-at-least-32-characters",
    AUTH_KEYCLOAK_ID: "fixture-client",
    AUTH_KEYCLOAK_SECRET: "fixture-secret",
    AUTH_KEYCLOAK_ISSUER: "https://sso.kmitl.ac.th/realms/kmitl",
    DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/fixture",
    DIRECT_DATABASE_URL: "",
  },
});
function request(path, headers = {}) {
  // Node fetch normalizes Host to its URL. Simulate TLS termination explicitly
  // with node:http so the canonical external Host reaches the loopback server.
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      base + path,
      { headers: { host: "app.example", ...headers } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers))
            for (const v of Array.isArray(value) ? value : [value])
              if (v !== undefined) responseHeaders.append(key, v);
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: responseHeaders,
            }),
          );
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Smoke timeout")));
    req.end();
  });
}
let stage = "startup";
try {
  let ready = false;
  for (let n = 0; n < 40; n++) {
    try {
      if ((await request("/login")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "Start the built app on the reserved smoke-test port");
  stage = "private routes";
  for (const path of [
    "/",
    "/friends/bean",
    "/account",
    "/onboarding",
    "/admin/access",
    "/my-timetable/import",
  ]) {
    const r = await request(path);
    assert.equal(r.status, 307);
    assert.equal(r.headers.get("location"), canonical + "/login");
  }
  stage = "canonical callback";
  const providerResponse = await request("/api/auth/providers");
  const providers = await providerResponse.json();
  assert.equal(
    providers.keycloak.callbackUrl,
    canonical + "/api/auth/callback/keycloak",
  );
  stage = "cookie and referrer attributes";
  const csrf = await request("/api/auth/csrf");
  assert.equal(csrf.headers.get("referrer-policy"), "no-referrer");
  const cookies = csrf.headers.getSetCookie();
  assert.ok(cookies.length);
  for (const cookie of cookies) {
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /; HttpOnly/i);
    assert.match(cookie, /; SameSite=Lax/i);
  }
  stage = "forwarded host rejection";
  const rejected = await request("/api/auth/providers", {
    "x-forwarded-host": "untrusted.example",
  });
  assert.equal(rejected.status, 400);
  stage = "anonymous session";
  assert.equal(await (await request("/api/auth/session")).json(), null);
  console.log(
    "Production smoke passed: private routes, no preview bypass, canonical callback, Secure/HttpOnly/SameSite cookies, referrer policy, host rejection and anonymous session.",
  );
  console.log(
    "Fixture credentials only; no database connection, live login, token exchange or deployment tested.",
  );
} catch {
  console.error(
    "Production auth smoke failed at " +
      stage +
      "; request/cookie details are redacted.",
  );
  process.exitCode = 1;
} finally {
  child.kill();
}
