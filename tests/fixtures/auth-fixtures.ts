import { createHash, randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Auth } from "@auth/core";
import { createAuthConfig } from "../../src/lib/auth/config";
import {
  EXPECTED_ENDPOINTS,
  KMITL_DISCOVERY,
  KMITL_ISSUER,
  type Identity,
  type Member,
  type MemberRepository,
} from "../../src/lib/auth/domain";
import type { AuthSettings } from "../../src/lib/auth/settings";
export class MemoryMembers implements MemberRepository {
  users: Member[] = [];
  sessions = new Map<
    string,
    { userId: string; expiresAt: Date; revoked: boolean }
  >();
  loginCalls = 0;
  async login(identity: Identity, sid: string, expiresAt: Date) {
    this.loginCalls++;
    let member = this.users.find(
      (m) => m.issuer === identity.issuer && m.subject === identity.subject,
    );
    if (!member) {
      member = {
        ...identity,
        id: randomUUID(),
        nickname: "",
        thaiName: "",
        department: "",
        profileCompletedAt: null,
        policyVersion: null,
        policyAcceptedAt: null,
        status: "pending",
        role: "member",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(member);
    } else Object.assign(member, identity);
    this.sessions.set(sid, { userId: member.id, expiresAt, revoked: false });
    return member;
  }
  async activeSession(id: string) {
    const session = this.sessions.get(id);
    return session && !session.revoked && session.expiresAt > new Date()
      ? (this.users.find((u) => u.id === session.userId) ?? null)
      : null;
  }
  async revokeSession(id: string) {
    const session = this.sessions.get(id);
    if (session) session.revoked = true;
  }
  async find(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async saveProfile() {
    throw new Error("Not part of mock provider fixture");
  }
  async acknowledgePolicy() {
    throw new Error("Not part of mock provider fixture");
  }
  async list() {
    return this.users;
  }
  async setStatus() {
    throw new Error("Not part of mock provider fixture");
  }
}
export async function oidcFixture(
  fault?: "issuer" | "audience" | "signature" | "nonce" | "expiry" | "database",
) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = {
    ...(await exportJWK(publicKey)),
    kid: "fixture-key",
    use: "sig",
    alg: "RS256",
  };
  const repository = new MemoryMembers();
  if (fault === "database")
    repository.login = async () => {
      throw new Error("Fixture storage failure");
    };
  const settings: AuthSettings = {
    issuer: KMITL_ISSUER,
    clientId: "fixture-client",
    clientSecret: "fixture-client-secret",
    secret: "fixture-application-secret-that-is-at-least-32-characters",
    origin: "https://app.example",
    databaseUrl: "postgres://fixture/fixture",
  };
  let authorization: URL | undefined;
  let pkceChecked = false;
  const upstream: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === KMITL_DISCOVERY)
      return Response.json({
        ...EXPECTED_ENDPOINTS,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_basic"],
      });
    if (url === EXPECTED_ENDPOINTS.jwks_uri)
      return Response.json({ keys: [publicJwk] });
    if (url === EXPECTED_ENDPOINTS.token_endpoint) {
      const body =
        init?.body instanceof URLSearchParams
          ? init.body
          : new URLSearchParams(String(init?.body));
      const verifier = body.get("code_verifier") || "";
      if (
        createHash("sha256").update(verifier).digest("base64url") !==
        authorization?.searchParams.get("code_challenge")
      )
        throw new Error("PKCE fixture verification failed");
      if (
        body.get("redirect_uri") !==
        settings.origin + "/api/auth/callback/keycloak"
      )
        throw new Error("Callback mismatch");
      pkceChecked = true;
      let idToken = await new SignJWT({
        name: "Fictional Student",
        email: "fixture@example.invalid",
        email_verified: true,
        nonce:
          fault === "nonce"
            ? "wrong-nonce"
            : authorization!.searchParams.get("nonce"),
      })
        .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
        .setSubject("fictional-oidc-subject")
        .setIssuer(
          fault === "issuer" ? "https://untrusted.example" : KMITL_ISSUER,
        )
        .setAudience(
          fault === "audience" ? "untrusted-client" : settings.clientId,
        )
        .setIssuedAt()
        .setExpirationTime(
          fault === "expiry" ? 1 : Math.floor(Date.now() / 1000) + 300,
        )
        .sign(privateKey);
      if (fault === "signature") {
        const parts = idToken.split(".");
        parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
        idToken = parts.join(".");
      }
      return Response.json({
        access_token: "fictional-access-token",
        refresh_token: "fictional-refresh-token",
        token_type: "Bearer",
        expires_in: 300,
        id_token: idToken,
      });
    }
    throw new Error("Unexpected OIDC fixture request");
  };
  const config = createAuthConfig(settings, repository, upstream);
  config.logger = { error() {}, warn() {}, debug() {} };
  const jar = new Map<string, string>();
  async function request(path: string, method = "GET", body?: URLSearchParams) {
    const response = await Auth(
      new Request(settings.origin + "/api/auth" + path, {
        method,
        headers: {
          cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(body
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: body?.toString(),
      }),
      config,
    );
    for (const line of response.headers.getSetCookie()) {
      const first = line.split(";")[0],
        i = first.indexOf("=");
      const name = first.slice(0, i),
        value = first.slice(i + 1);
      if (/Max-Age=0/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  }
  async function begin() {
    const csrf = await (await request("/csrf")).json();
    const response = await request(
      "/signin/keycloak",
      "POST",
      new URLSearchParams({
        csrfToken: csrf.csrfToken,
        callbackUrl: settings.origin + "/",
      }),
    );
    authorization = new URL(response.headers.get("location")!);
    return authorization;
  }
  async function callback(state = authorization!.searchParams.get("state")!) {
    return request(
      "/callback/keycloak?" +
        new URLSearchParams({ code: "fictional-code", state }),
    );
  }
  return {
    settings,
    repository,
    jar,
    request,
    begin,
    callback,
    pkceChecked: () => pkceChecked,
  };
}
