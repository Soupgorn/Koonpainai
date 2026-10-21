import test from "node:test";
import assert from "node:assert/strict";
import { decode } from "next-auth/jwt";
import { oidcFixture } from "./fixtures/auth-fixtures";
import { EXPECTED_ENDPOINTS } from "../src/lib/auth/domain";
test("redirects remain on the configured origin, including backslash URL variants", async () => {
  const f = await oidcFixture();
  for (const callbackUrl of [
    "https://untrusted.example/",
    "//untrusted.example/",
    "/\\untrusted.example/",
  ]) {
    const csrf = await (await f.request("/csrf")).json();
    await f.request(
      "/signin/keycloak",
      "POST",
      new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl }),
    );
    const callbackCookie = [...f.jar].find(([name]) =>
      name.endsWith(".callback-url"),
    );
    assert.ok(callbackCookie);
    assert.equal(
      new URL(decodeURIComponent(callbackCookie[1])).origin,
      f.settings.origin,
    );
  }
});
test("mocked OIDC code flow uses S256/state/nonce and persists/reuses the issuer-subject user", async () => {
  const f = await oidcFixture(),
    url = await f.begin();
  assert.equal(
    url.origin + url.pathname,
    EXPECTED_ENDPOINTS.authorization_endpoint,
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("state"));
  assert.ok(url.searchParams.get("nonce"));
  let response = await f.callback();
  assert.equal(response.headers.get("location"), f.settings.origin + "/");
  assert.ok(f.pkceChecked());
  const issued = response.headers
    .getSetCookie()
    .find((c) => c.includes(".session-token="));
  assert.ok(issued);
  assert.match(issued, /; Secure/i);
  assert.match(issued, /; HttpOnly/i);
  assert.match(issued, /; SameSite=Lax/i);
  const session = await (await f.request("/session")).json();
  assert.equal(session.user.id, f.repository.users[0].id);
  assert.equal(f.repository.users[0].status, "pending");
  const [name, cookie] = [...f.jar].find(([k]) =>
    k.endsWith(".session-token"),
  )!;
  assert.equal(cookie.split(".").length, 5);
  const token = await decode({
    token: cookie,
    secret: f.settings.secret,
    salt: name,
  });
  assert.ok(token?.sid);
  assert.equal(token?.access_token, undefined);
  assert.equal(token?.refresh_token, undefined);
  assert.equal(token?.id_token, undefined);
  assert.equal(
    JSON.stringify(session).includes("fictional-oidc-subject"),
    false,
  );
  await f.begin();
  response = await f.callback();
  assert.equal(response.headers.get("location"), f.settings.origin + "/");
  assert.equal(f.repository.users.length, 1);
  assert.equal(f.repository.loginCalls, 2);
});
test("provider admin claims cannot promote a normal Koonpinai sign-in", async () => {
  const f = await oidcFixture(undefined, {
    role: "admin",
    status: "approved",
    realm_access: { roles: ["admin"] },
    groups: ["admin"],
  });
  const received: Record<string, unknown>[] = [];
  const login = f.repository.login.bind(f.repository);
  f.repository.login = async (identity, sid, expiresAt) => {
    received.push({ ...identity });
    return login(identity, sid, expiresAt);
  };
  await f.begin();
  await f.callback();
  assert.equal(received.length, 1);
  assert.deepEqual(Object.keys(received[0]).sort(), [
    "displayName", "email", "issuer", "subject",
  ]);
  assert.equal(f.repository.users[0].role, "member");
  assert.equal(f.repository.users[0].status, "pending");
});

for (const fault of [
  "issuer",
  "audience",
  "signature",
  "nonce",
  "expiry",
  "database",
] as const)
  test(`mocked OIDC ${fault} failure never issues an application session`, async () => {
    const f = await oidcFixture(fault);
    await f.begin();
    const response = await f.callback();
    assert.notEqual(response.headers.get("location"), f.settings.origin + "/");
    assert.equal(
      [...f.jar.keys()].some((k) => k.endsWith(".session-token")),
      false,
    );
    assert.equal(f.repository.users.length, 0);
  });
test("tampered state and CSRF-less sign-in are rejected", async () => {
  const f = await oidcFixture();
  const rejected = await f.request(
    "/signin/keycloak",
    "POST",
    new URLSearchParams({ callbackUrl: f.settings.origin + "/" }),
  );
  assert.notEqual(
    rejected.headers
      .get("location")
      ?.startsWith(EXPECTED_ENDPOINTS.authorization_endpoint),
    true,
  );
  await f.begin();
  const r = await f.callback("tampered");
  assert.notEqual(r.headers.get("location"), f.settings.origin + "/");
  assert.equal(f.repository.users.length, 0);
});
test("local logout revokes the encrypted app session without contacting Keycloak logout", async () => {
  const f = await oidcFixture();
  await f.begin();
  await f.callback();
  const saved = [...f.jar].filter(([name]) => name.includes("session-token"));
  await f.request("/signout");
  assert.equal(f.repository.sessions.values().next().value?.revoked, false);
  const csrf = await (await f.request("/csrf")).json();
  await f.request(
    "/signout",
    "POST",
    new URLSearchParams({
      csrfToken: csrf.csrfToken,
      callbackUrl: f.settings.origin + "/login?signedOut=local",
    }),
  );
  assert.equal(f.repository.sessions.values().next().value?.revoked, true);
  assert.equal(
    [...f.jar.keys()].some((k) => k.includes("session-token")),
    false,
  );
  for (const [k, v] of saved) f.jar.set(k, v);
  const replay = await (await f.request("/session")).json();
  assert.equal(replay, null);
});
