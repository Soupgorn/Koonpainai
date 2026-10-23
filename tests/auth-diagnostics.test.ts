import test from "node:test";
import assert from "node:assert/strict";
import { AuthError } from "next-auth";
import { authFailureDetails } from "../src/lib/auth/diagnostics";
import { oidcFixture } from "./fixtures/auth-fixtures";

test("verified OIDC identity plus an untrusted database certificate fails closed with a safe diagnostic", async () => {
  const fixture = await oidcFixture();
  fixture.repository.login = async () => {
    throw Object.assign(new Error("postgres://private-user:private-password@private-host/db"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    });
  };
  await fixture.begin();
  const response = await fixture.callback();
  assert.equal(fixture.pkceChecked(), true);
  assert.notEqual(response.headers.get("location"), fixture.settings.origin + "/");
  assert.equal(fixture.repository.users.length, 0);
  assert.equal(fixture.repository.sessions.size, 0);
  assert.equal([...fixture.jar.keys()].some((key) => key.endsWith(".session-token")), false);
  assert.deepEqual(authFailureDetails(fixture.failures[0]), {
    event: "AUTH_FAILED",
    type: "CallbackRouteError",
    code: "SELF_SIGNED_CERT_IN_CHAIN",
  });
});

test("unknown error types, messages, causes and unapproved codes never appear in auth diagnostics", () => {
  const error = new AuthError("private-token", {
    cause: { err: Object.assign(new Error("private-database-url"), { code: "private-student-id" }) },
  });
  Object.assign(error, { type: "private-client-secret" });
  assert.deepEqual(authFailureDetails(error), {
    event: "AUTH_FAILED",
    type: "AuthenticationError",
    code: "UNCLASSIFIED",
  });
});
