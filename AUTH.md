# KMITL authentication and account access

The existing Contemporary Social Utility interface now uses Auth.js v5's official Keycloak provider, PostgreSQL and Drizzle. The documented v5 release is currently installed as `next-auth@5.0.0-beta.32`; review upgrades before deployment. Student-owned timetables use authenticated Server Actions and PostgreSQL; no university timetable provider is used.

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
| `MIGRATION_DATABASE_URL` | Explicit Direct or Session Pooler migration target; takes precedence |
| `DATABASE_CA_FILE` | Trusted PEM CA bundle for runtime chain and hostname validation |
| `MIGRATION_DATABASE_CA_FILE` | Optional migration CA override |

Never use `NEXT_PUBLIC_` for credentials. Never paste credentials, callback query strings, tokens or database URLs into issues or logs. `.env*`, private PDFs and `.private/` are ignored. Keep production secret management outside source control.

```powershell
npm ci
npm run auth:check
# Read-only inspection; do not migrate until separately approved.
npm run db:audit
npm run dev
```

`auth:check` fetches public metadata and checks verified database connectivity; it does not verify a real login. All database entry points share `src/db/connection.ts`: TLS 1.2+, chain validation and hostname matching are mandatory. Only `sslmode=verify-full` is accepted as a URL query option; driver URL parsing cannot replace TLS settings. Mount the trusted provider CA in production and configure its server-only path. Never disable verification.

### Database certificate prerequisite

For this project's Supabase connection, `DATABASE_CA_FILE` is required: Node's default roots do not trust the presented Supabase CA. Without it, verified OIDC sign-in cannot persist the member/application session and the callback fails. Set an absolute path to a trusted PEM CA bundle in the local environment, then restart the app and run `npm run auth:check`. A missing CA produces `SELF_SIGNED_CERT_IN_CHAIN`; it is not evidence of a wrong OAuth client secret.

Obtain the CA through [Supabase Database Settings → SSL Configuration](https://supabase.com/docs/guides/platform/ssl-enforcement). Supabase's [official Studio certificate URL configuration](https://github.com/supabase/supabase/blob/60b51d74d53c788d120b6dd656f137828a8cc9e3/apps/studio/hooks/custom-content/custom-content.json) also identifies the [production CA download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). The certificate used for the local repair has SHA-256 fingerprint `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA` and expires on 26 April 2031. Treat this as provenance for this repair, not a permanent certificate pin; verify a rotated CA independently with the provider.

Keep the local file in ignored `.private/certificates/`; production needs its own mounted file and `DATABASE_CA_FILE` setting. Do not obtain trust anchors from an unverified database peer, add `sslmode=no-verify`, set `rejectUnauthorized: false`, or disable TLS verification globally. `MIGRATION_DATABASE_CA_FILE` is needed only for an operational endpoint with a different trusted CA; migrations still require separate authorization.

Auth.js errors retain only allowlisted type/code identifiers in structured `AUTH_FAILED` logs. Unknown errors remain `UNCLASSIFIED`; error messages, stacks, token values, identities, URLs and raw causes are never emitted. Login shows safe retry/denial categories and keeps a generic fallback; a generic Auth.js configuration error does not establish that the user's account was denied or the sign-in transaction expired.

The migration runner requires an explicitly approved target, compares the complete applied ledger/checksums, rejects transaction pooling and unsafe account-table client grants, and uses an advisory transaction lock and bounded DDL. App startup never migrates. Operational commands require MIGRATION_DATABASE_URL or DIRECT_DATABASE_URL and never fall back to the web DATABASE_URL; legacy `--runtime-url` is rejected. Administrator promotion also uses the operational credential. See [DATABASE_FIRST.md](DATABASE_FIRST.md) for the replacement student timetable migration. Production migration and runtime credential cutover remain separately gated; local code does not authorize either.

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

Both account tables enable RLS with no policies. **RLS does not protect TRUNCATE or REFERENCES.** The explicitly approved account-grant remediation removed residual `TRUNCATE`/`TRIGGER`/`REFERENCES`/`MAINTAIN` grants from `anon` and `authenticated`; all their account-table/column rights are now absent. Production verification passed. The server still owns these tables and has BYPASSRLS/role/database-creation privileges, so server guards remain essential and least-privilege separation needs review. Never expose that credential to the browser. See [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Scoped account/default privilege repairs and dedicated runtime-role provisioning were completed separately. Their private execution evidence is preserved locally. The active runtime credential cutover is not authorized by this application change.

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

The command matches the fixed issuer and exact subject, updates an existing record only, and does not print it. It requires possession of the local database credentials; it is never exposed as a web endpoint. Avoid retaining personal subjects in shared shell history. Administrator access management at `/admin/access` changes real pending/approved/suspended records. The read-only `/admin` overview reports member/connection state and links to access management; no schedule publishing exists.

## Logout: local versus university SSO

**Sign out of Koonpinai** is a protected POST/Server Action. It revokes the application session record, clears the Auth.js cookie and returns to `/login?signedOut=local`. Replaying that revoked cookie is rejected. Clearing this application session **does not terminate the KMITL Keycloak session**; the interface says so. Database availability is required to persist revocation, and database reads fail closed during an outage.

Discovery advertises RP-Initiated Logout and an end-session endpoint. Full university SSO logout is deliberately **not enabled**: the client's registered `post_logout_redirect_uri` and ID-token-hint requirements have not been verified. Provider ID tokens are intentionally not retained. A future implementation must verify the actual client registrations, protect the logout initiation and return state, and use the provider-supported protocol and a server-held ID token hint if required. Do not replace logout with an unauthenticated link or the legacy refresh-token POST mechanism.

## Student timetable ownership and privacy

Students manage their own persistent timetable entries. Every Server Action derives its actor from the validated Auth.js session, and the repository rechecks profile/current policy/status inside the transaction. Pending students may prepare privately; suspended users cannot edit. Shared reads require viewer and target approval/current acknowledgement. Administrators cannot edit another student's classes. RLS uses transaction-local server context, never Supabase Auth JWTs or auth.uid().

Policy 2026-10-22-student-v3 requires renewed acknowledgement; stored earlier acknowledgements remain unchanged. The unapplied API metadata migration is retired and preserved, not silently applied. See [DATABASE_FIRST.md](DATABASE_FIRST.md) for schema, RLS, replacement checksums and approval boundaries. No university timetable API, PDF/OCR or university tokens are involved.

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

Live verification on 23 October 2026: public discovery matched and authorization initiation reached the real KMITL page with HTTP 200, the expected localhost callback and code/S256/state/nonce parameters. An earlier browser attempt had reported an IdP 502; that was not reproduced in this run. The local database initially failed with `SELF_SIGNED_CERT_IN_CHAIN`; configuring the independently sourced Supabase CA restored verified read-only connectivity. Both account tables, required columns, identity index and table privileges were checked without reading member rows or writing data. A real callback, code exchange, approved-client secret validation, real-user creation and real SSO session remain **unverified**, because no authorized test identity/session was available. Complete that test in an authorized browser; do not bypass the issuer or simulate success.

## Before production

Complete a real approved-client login/logout test, verify production callback registrations and canonical HTTPS/proxy settings, fix/verify the direct migration connection, review policy/privacy/removal rules, establish admin operations and backups, rotate credentials according to policy, add deployment rate limits/monitoring without sensitive logs, and schedule revoked/expired-session cleanup. Evaluate the pinned Auth.js beta and migration tooling advisories before release. Review the new student timetable migration, new-table grants/RLS and backup/restore evidence separately before schema deployment. Preserve renewed sharing acknowledgement; do not reintroduce an external provider as an authentication dependency.

References: [Auth.js Keycloak](https://authjs.dev/getting-started/providers/keycloak), [Auth.js installation](https://authjs.dev/getting-started/installation), [Keycloak OIDC endpoints/logout](https://www.keycloak.org/securing-apps/oidc-layers), [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new).
