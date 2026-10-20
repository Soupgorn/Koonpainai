# KMITL authentication and account access

The existing Contemporary Social Utility interface now uses Auth.js v5's official Keycloak provider, PostgreSQL and Drizzle. The documented v5 release is currently installed as `next-auth@5.0.0-beta.32`; review upgrades before deployment. No university timetable API or timetable publishing is implemented.

## Local setup

Copy `.env.example` to the ignored `.env.local` and configure:

| Variable | Purpose |
| --- | --- |
| `AUTH_URL` | Canonical origin, `http://localhost:3000` for development, HTTPS in production |
| `AUTH_SECRET` | At least 32 random bytes; server-only JWE encryption material |
| `AUTH_KEYCLOAK_ID` | Approved KMITL confidential OIDC client ID |
| `AUTH_KEYCLOAK_SECRET` | Approved client secret, server-only |
| `AUTH_KEYCLOAK_ISSUER` | Optional explicit issuer; any value other than the pinned KMITL issuer fails closed |
| `DATABASE_URL` | Runtime PostgreSQL connection, including the provider's verified TLS configuration |
| `DIRECT_DATABASE_URL` | Optional direct/session connection for migrations |

Never use `NEXT_PUBLIC_` for credentials. Never paste credentials, callback query strings, tokens or database URLs into issues or logs. `.env*`, private PDFs and `.private/` are ignored. Keep production secret management outside source control.

```powershell
npm ci
npm run auth:check
npm run db:migrate
npm run dev
```

`auth:check` fetches live public metadata, validates the endpoints/capabilities and checks database connectivity/schema presence when configured. It never tests the client secret or claims that a real login succeeded. Migrations are explicit, additive and tracked under `drizzle/`; app startup never migrates automatically. If an intentionally supplied runtime/session URL is appropriate for migration while the direct hostname is unavailable, run `npm run db:migrate -- --runtime-url`. Check your database provider's pooler/migration requirements before production use.

Register these exact callbacks with KMITL:

- Development: `http://localhost:3000/api/auth/callback/keycloak`
- Production: `https://YOUR-DOMAIN/api/auth/callback/keycloak`

The client must permit standard Authorization Code Flow, PKCE **S256**, the requested `openid profile email` scopes, `client_secret_basic` client authentication and RS256 ID token signatures. Discovery advertising a capability does not prove that this particular client is configured for it. Disable implicit/password grants for this application. Avoid wildcard redirect registrations.

Open `/login`, choose **Continue with KMITL SSO**, and complete the university sign-in in your browser. A first successful login creates a pending account and redirects private-page access to profile setup. No account is created by merely opening the authorization page.

## Discovery and token validation

Issuer: `https://sso.kmitl.ac.th/realms/kmitl`.

Discovery: `https://sso.kmitl.ac.th/realms/kmitl/.well-known/openid-configuration`.

Auth.js performs discovery. Constants in `src/lib/auth/domain.ts` are assertions against discovered metadata, not replacements for discovery:

| Metadata field | Expected path after the issuer |
| --- | --- |
| `authorization_endpoint` | `/protocol/openid-connect/auth` |
| `token_endpoint` | `/protocol/openid-connect/token` |
| `userinfo_endpoint` | `/protocol/openid-connect/userinfo` |
| `end_session_endpoint` | `/protocol/openid-connect/logout` |
| `jwks_uri` | `/protocol/openid-connect/certs` |

The transport rejects unexpected destinations and redirects, enforces request timeouts, and validates issuer, all endpoints, code/S256, signing and client-auth capabilities. The authorization request explicitly uses code + PKCE S256, state and nonce. Auth.js validates the callback, including nonce and PKCE. Before persistence, JOSE independently verifies the ID token's JWKS signature, issuer, audience and time claims; its subject must match Auth.js's validated profile/provider identity. Unverified email is not retained and email never links accounts.

The auth handler checks the canonical external Host and rejects conflicting forwarded hosts. Auth.js derives redirects from `AUTH_URL`; arbitrary return URLs cannot leave that origin. Configure the reverse proxy to preserve the canonical external Host, terminate HTTPS securely and reject untrusted forwarded headers. Do not expose the app server directly as a proxy bypass. `AUTH_REDIRECT_PROXY_URL` is unsupported and fails configuration validation.

Next development request/Server Action/browser-forwarding logs are disabled to avoid printing callback codes or profile arguments. Auth responses send `Referrer-Policy: no-referrer`. Production infrastructure must also redact query strings on `/api/auth/*`, cookies and authorization headers; application logging configuration cannot sanitize an external reverse proxy or hosting service's logs.

## Application sessions

Sessions use Auth.js encrypted JWTs (JWE), not signed-only browser tokens. Auth.js manages HttpOnly, SameSite=Lax cookies; HTTPS production uses Secure cookies. Loopback HTTP development is the only permitted non-HTTPS origin. There is no client-side token storage or SessionProvider exposing provider tokens.

The cookie contains internal member/session IDs, issuer/subject and an absolute eight-hour deadline. It never contains provider access, refresh or ID tokens. Session JSON exposes only the internal member ID, display name and expiry. Database session records supply expiry and revocation; each authenticated read validates the active record. Access status, role, profile and policy are read from the database, never trusted from a stale browser claim. Client `session.update()` payloads do not change identity or authorization. Old expired/revoked session records need an operational retention/cleanup job.

## Persistence and gates

`members` uses a unique **(OIDC issuer, subject)** index. First login inserts a pending member. Subsequent logins update only verified identity display data and last-login time, preserving nickname, policy, approval and role. No provider token is persisted. `application_sessions` stores session IDs, member references, expiration and revocation timestamps.

Both account tables enable PostgreSQL row-level security with no public policies, preventing ordinary database/API roles from reading or changing them. The server connection must be a trusted table owner or an appropriately configured server role; never distribute that credential to the browser. This matters particularly for providers that expose public-schema tables through a data API. See [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). Review least-privilege server roles for your deployment.

Private routes require:

1. A valid encrypted application session and active database session record.
2. A completed nickname/programme profile.
3. Acknowledgement of the current versioned sharing policy.
4. `approved` account status.

Suspension blocks shared access even if the other gates are satisfied. Account settings and policy/profile pages remain available to signed-in pending members. `/admin` additionally requires a fresh admin role. Server Actions authenticate independently; profile input cannot set an issuer, subject, role or approval. Access changes recheck the acting admin inside a database transaction, and admins cannot change their own access through this interface.

`src/proxy.ts` performs an optimistic cookie check only. Server-side data access and actions enforce the authoritative checks. Friend metadata/read helpers are guarded, and friend profiles are dynamic rather than statically generated. Database failures deny access.

To bootstrap an administrator, first complete an actual successful login and its profile/policy steps. A trusted database operator can then run:

```powershell
npm run users:promote-admin -- '<existing OIDC subject>'
```

The command matches the fixed issuer and exact subject, updates an existing record only, and does not print it. It requires possession of the local database credentials; it is never exposed as a web endpoint. Avoid retaining personal subjects in shared shell history. Administrator access management at `/admin/access` changes real pending/approved/suspended records. Existing `/admin` friend/schedule management remains an explicitly labeled temporary demo and does not publish timetables.

## Logout: local versus university SSO

**Sign out of Koonpinai** is a protected POST/Server Action. It revokes the application session record, clears the Auth.js cookie and returns to `/login?signedOut=local`. Replaying that revoked cookie is rejected. Clearing this application session **does not terminate the KMITL Keycloak session**; the interface says so. Database availability is required to persist revocation, and database reads fail closed during an outage.

Discovery advertises RP-Initiated Logout and an end-session endpoint. Full university SSO logout is deliberately **not enabled**: the client's registered `post_logout_redirect_uri` and ID-token-hint requirements have not been verified. Provider ID tokens are intentionally not retained. A future implementation must verify the actual client registrations, protect the logout initiation and return state, and use the provider-supported protocol and a server-held ID token hint if required. Do not replace logout with an unauthenticated link or the legacy refresh-token POST mechanism.

## Fictional UI and document privacy

`ENABLE_UI_PREVIEW=true` works only in development when **all** real client/session/database values are absent. Even a partial real configuration disables it, and production never permits this bypass. The old `ENABLE_ADMIN_DEMO` flag no longer grants access. Real configured mode protects the fictional friend dataset behind approval; it does not magically turn those examples into real saved schedules.

Profile, policy, account status and session records persist in PostgreSQL. PDF.js, Thai/English OCR, review, export and temporary personal timetable previews remain browser-side. Imported timetables are not saved or shared, original PDFs are not uploaded, and GitHub JSON storage and the KMITL timetable API remain unimplemented.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
# Real PostgreSQL repository exercise, using temporary fixture tables:
$env:RUN_AUTH_DB_TESTS='true'
npm run test:auth:db
Remove-Item Env:RUN_AUTH_DB_TESTS
# Keep the configured development app running on localhost:3000:
npm run test:auth:e2e
npm run build
npm run test:auth:production
```

The regular browser suite runs an isolated, explicitly fictional child server on port 3100 with `.next-e2e` output and blank auth/database environment values. It does not change the credentials or server on port 3000. Auth browser tests use disposable fictional database members and synthesized encrypted cookies from the **test harness**, not a runtime bypass route. They verify the application's gates, real server actions, profile/policy persistence, themes and logout. They do not prove KMITL's token exchange works. No auth traces/videos or real-account screenshots are captured; fixture account screenshots are under the ignored `.impeccable/review/oidc/`.

The production smoke command starts the compiled app on reserved loopback port 3200 with fixture credentials and a synthetic HTTPS proxy host. It checks canonical callbacks, production cookie flags, private-route denial, host validation and the lack of a preview bypass, without connecting to a database or completing a university login. This is not deployment verification.

Live verification so far: public discovery matched; PostgreSQL connected and the account migration applied. Authorization initiation produced the official endpoint, expected callback and code/S256/state/nonce parameters. The user reported **502 Bad Gateway on `sso.kmitl.ac.th`** during browser login. A real callback, code exchange, approved-client secret validation, real-user creation and real SSO session are therefore **unverified**. Retry with KMITL when that browser path is available; do not bypass the issuer or simulate success.

## Before production

Complete a real approved-client login/logout test, verify production callback registrations and canonical HTTPS/proxy settings, fix/verify the direct migration connection, review policy/privacy/removal rules, establish admin operations and backups, rotate credentials according to policy, add deployment rate limits/monitoring without sensitive logs, and schedule revoked/expired-session cleanup. Evaluate the pinned Auth.js beta and migration tooling advisories before release. Implement deliberate authorized timetable persistence/sharing separately; no university timetable API is included in this milestone.

References: [Auth.js Keycloak](https://authjs.dev/getting-started/providers/keycloak), [Auth.js installation](https://authjs.dev/getting-started/installation), [Keycloak OIDC endpoints/logout](https://www.keycloak.org/securing-apps/oidc-layers), [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new).
