import test from "node:test";
import assert from "node:assert/strict";
import {
  memberGate,
  POLICY_VERSION,
  profileInput,
  type Member,
} from "../src/lib/auth/domain";
import { EXPECTED_ENDPOINTS } from "../src/lib/auth/domain";
import { validateDiscovery, kmitlTransport } from "../src/lib/auth/discovery";
export const metadata = {
  ...EXPECTED_ENDPOINTS,
  response_types_supported: ["code"],
  code_challenge_methods_supported: ["S256"],
  id_token_signing_alg_values_supported: ["RS256"],
  token_endpoint_auth_methods_supported: ["client_secret_basic"],
};
const member: Member = {
  id: "fixture",
  issuer: EXPECTED_ENDPOINTS.issuer,
  subject: "fixture-subject",
  displayName: "Fictional student",
  email: null,
  nickname: "Mild",
  thaiName: "มายด์",
  department: "Engineering",
  profileCompletedAt: null,
  policyVersion: null,
  policyAcceptedAt: null,
  status: "pending",
  role: "member",
  createdAt: new Date(),
  updatedAt: new Date(),
};
test("discovery matches every supplied endpoint and rejects downgrade/mismatched metadata", () => {
  assert.equal(validateDiscovery(metadata).issuer, EXPECTED_ENDPOINTS.issuer);
  for (const key of Object.keys(EXPECTED_ENDPOINTS))
    assert.throws(() =>
      validateDiscovery({ ...metadata, [key]: "https://untrusted.example" }),
    );
  assert.throws(() =>
    validateDiscovery({
      ...metadata,
      code_challenge_methods_supported: ["plain"],
    }),
  );
  assert.throws(() =>
    validateDiscovery({ ...metadata, response_types_supported: ["token"] }),
  );
});
test("discovery transport rejects unexpected destinations and redirects", async () => {
  let redirect: RequestRedirect | undefined;
  const transport = kmitlTransport(async (_url, init) => {
    redirect = init?.redirect;
    return Response.json(metadata);
  });
  await transport.discovery();
  assert.equal(redirect, "error");
  await assert.rejects(transport.fetch("https://untrusted.example/token"));
});
test("shared timetable access requires profile, current policy and fresh approved status", () => {
  assert.equal(memberGate(member), "profile");
  const profiled = { ...member, profileCompletedAt: new Date() };
  assert.equal(memberGate(profiled), "policy");
  const policy = {
    ...profiled,
    policyVersion: POLICY_VERSION,
    policyAcceptedAt: new Date(),
  };
  assert.equal(memberGate(policy), "pending");
  assert.equal(memberGate({ ...policy, status: "approved" }), "allowed");
  assert.equal(memberGate({ ...policy, status: "suspended" }), "suspended");
  assert.equal(
    memberGate({ ...policy, status: "approved", policyVersion: "obsolete" }),
    "policy",
  );
  assert.equal(memberGate({ ...member, role: "admin" }), "profile");
});
test("profile validation rejects missing/oversized values without accepting identity/role fields", () => {
  assert.equal(
    profileInput.safeParse({
      nickname: " ",
      thaiName: "",
      department: "Engineering",
    }).success,
    false,
  );
  const value = profileInput.parse({
    nickname: " Mild ",
    thaiName: "มายด์",
    department: "Engineering",
    subject: "forged",
    role: "admin",
  });
  assert.equal(value.nickname, "Mild");
  assert.equal("role" in value, false);
  assert.equal("subject" in value, false);
});
