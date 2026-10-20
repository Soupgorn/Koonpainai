import { customFetch, type NextAuthConfig } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { createRemoteJWKSet, customFetch as joseFetch, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { kmitlTransport } from "./discovery";
import {
  KMITL_ISSUER,
  SESSION_SECONDS,
  type Identity,
  type MemberRepository,
} from "./domain";
import type { AuthSettings } from "./settings";
export function createAuthConfig(
  settings: AuthSettings,
  repository: MemberRepository,
  upstream: typeof fetch = fetch,
): NextAuthConfig {
  const transport = kmitlTransport(upstream);
  let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
  async function verifyIdentity(
    idToken: unknown,
    profile: unknown,
  ): Promise<Identity> {
    if (typeof idToken !== "string" || !profile || typeof profile !== "object")
      throw new Error("Validated OIDC identity required");
    const metadata = await transport.discovery();
    keys ??= createRemoteJWKSet(new URL(metadata.jwks_uri), {
      [joseFetch]: transport.fetch,
    });
    const { payload } = await jwtVerify(idToken, keys, {
      issuer: KMITL_ISSUER,
      audience: settings.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iss", "aud", "exp", "iat"],
      clockTolerance: 5,
    });
    const source = profile as Record<string, unknown>;
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.sub.length > 255 ||
      source.iss !== KMITL_ISSUER ||
      source.sub !== payload.sub
    )
      throw new Error("OIDC identity mismatch");
    return {
      issuer: KMITL_ISSUER,
      subject: payload.sub,
      displayName:
        typeof payload.name === "string"
          ? payload.name.slice(0, 160)
          : "KMITL student",
      email:
        payload.email_verified === true && typeof payload.email === "string"
          ? payload.email.slice(0, 254)
          : null,
    };
  }
  return {
    secret: settings.secret,
    trustHost: true,
    debug: false,
    basePath: "/api/auth",
    session: { strategy: "jwt", maxAge: SESSION_SECONDS },
    jwt: { maxAge: SESSION_SECONDS },
    useSecureCookies: new URL(settings.origin).protocol === "https:",
    pages: { signIn: "/login", error: "/login" },
    providers: [
      Keycloak({
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        issuer: KMITL_ISSUER,
        checks: ["pkce", "state", "nonce"],
        idToken: true,
        client: {
          token_endpoint_auth_method: "client_secret_basic",
          id_token_signed_response_alg: "RS256",
        },
        authorization: {
          params: {
            scope: "openid profile email",
            response_type: "code",
            response_mode: "query",
          },
        },
        [customFetch]: transport.fetch,
      }),
    ],
    callbacks: {
      async redirect({ url }) {
        try {
          const target = new URL(url, settings.origin);
          if (target.origin === settings.origin) return target.href;
        } catch {}
        return settings.origin;
      },
      async jwt({ token, account, profile }) {
        if (account) {
          if (account.provider !== "keycloak" || account.type !== "oidc")
            return null;
          const identity = await verifyIdentity(account.id_token, profile);
          if (account.providerAccountId !== identity.subject) return null;
          const sid = randomUUID(),
            deadline = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
          const member = await repository.login(
            identity,
            sid,
            new Date(deadline * 1000),
          );
          return {
            sub: member.id,
            userId: member.id,
            sid,
            oidcIssuer: identity.issuer,
            oidcSubject: identity.subject,
            deadline,
            name: member.nickname || member.displayName,
          };
        }
        // Ignore all client-supplied session updates; authorization is re-read from storage.
        if (
          typeof token.sid !== "string" ||
          typeof token.userId !== "string" ||
          typeof token.deadline !== "number" ||
          token.deadline <= Date.now() / 1000
        )
          return null;
        const member = await repository.activeSession(token.sid);
        if (
          !member ||
          member.id !== token.userId ||
          member.issuer !== token.oidcIssuer ||
          member.subject !== token.oidcSubject
        )
          return null;
        return { ...token, name: member.nickname || member.displayName };
      },
      async session({ session, token }) {
        const expires = new Date(
          Math.min(Date.parse(session.expires), Number(token.deadline) * 1000),
        ).toISOString();
        return {
          expires,
          user: {
            id: String(token.userId),
            name: String(token.name ?? "KMITL student"),
          },
        };
      },
    },
    events: {
      async signOut(message) {
        if ("token" in message && typeof message.token?.sid === "string")
          await repository.revokeSession(message.token.sid);
      },
    },
    // Never log upstream error objects, causes, tokens, secrets or database URLs.
    logger: {
      error() {
        console.error("[auth] Authentication request failed.");
      },
      warn() {
        console.warn("[auth] Configuration notice.");
      },
      debug() {},
    },
  };
}
