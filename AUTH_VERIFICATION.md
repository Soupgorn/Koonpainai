# OIDC implementation verification — 21 October 2026

## Implemented

- Auth.js v5 official Keycloak provider with live discovery assertions for the supplied issuer, authorization, token, UserInfo and logout endpoints, plus JWKS.
- Authorization Code Flow with PKCE S256, state and nonce; independent JOSE verification of ID-token signature, audience, issuer, required claims and validity before persistence.
- Encrypted eight-hour application JWT sessions, HttpOnly/SameSite cookies and Secure cookies on HTTPS, backed by expiring/revocable PostgreSQL session records. No provider tokens in session JSON, browser storage or database records.
- Drizzle members keyed by validated issuer/subject, first-login pending creation and subsequent identity reuse, persistent nickname/programme, versioned policy acknowledgement, pending/approved/suspended access and trusted admin approval actions.
- Fresh server-side authorization at data/action boundaries, dynamic private pages, no production or partially configured authentication preview bypass, canonical auth Host/redirect checks and privacy-conscious logging.
- Local logout revokes the application session and clears its cookie. University SSO logout is explicitly separate and remains unimplemented pending confirmed client post-logout registrations and token-hint handling.
- Original approved Contemporary Social Utility composition, typography, semantic colors and Light/Dark/System behavior preserved. PDF/OCR/parser/export and timetable calculations retained. No KMITL timetable API or timetable publishing added.

## Live observations versus test fixtures

| Check | Evidence and limit |
| --- | --- |
| Public KMITL discovery | HTTP 200; all supplied endpoint assertions matched. Code/S256, RS256, client-secret authentication and RP logout capabilities advertised. This does not verify client-specific registration. |
| Local configuration | Ignored `.env.local` loaded; added the missing non-secret `AUTH_URL=http://localhost:3000`. No credentials/tokens printed. |
| Database | Actual PostgreSQL connection succeeded. Both account migrations applied, including row-level security on the two account tables. |
| Direct migration URL | Supplied direct hostname failed DNS (`ENOTFOUND`). Used the reachable runtime URL explicitly with `db:migrate -- --runtime-url`; direct connection still needs correction/verification. |
| Login initiation | Application generated the official authorization endpoint, exact development callback, code response type, S256 challenge, state and nonce. An anonymous direct HTTP request returned 200; this is not proof of a browser login. |
| Real browser login | User reported **502 Bad Gateway on `sso.kmitl.ac.th`**. A real callback, client-secret/code exchange, real-user record and successful university session remain unverified. Root cause of the upstream browser failure is unresolved. |
| Mock OIDC | In-process Auth.js/JOSE tests use ephemeral RSA keys and a fake provider transport/repository. They prove local code behavior, not real KMITL acceptance. |
| Database repository test | Uses the actual configured PostgreSQL connection with transaction-bound temporary tables and fictional identities. Tests reuse, profile/policy gates, approval, self-change refusal, expiry and revocation; no fixture user enters permanent account tables. |
| Auth browser tests | Disposable fictional members, synthesized JWE cookies from the Node test harness, real PostgreSQL and real Server Actions. Tests do not issue a real KMITL token. Fixture rows are removed in `finally`; no runtime session-bypass endpoint exists. |

## Automated results

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no warnings |
| `npm test` | 46 passed; optional PostgreSQL test skipped by default and run separately below |
| `RUN_AUTH_DB_TESTS=true npm run test:auth:db` | 1 real PostgreSQL integration test passed |
| `npm run test:e2e` | 30 passed; 2 optional private-PDF tests skipped because no input was configured for this run |
| `npm run test:auth:e2e` | 4 desktop/mobile tests passed, covering anonymous denial, both appearances, onboarding/policy persistence, approval gates, admin denial/approval/suspension, self-access protection, empty personal timetable, profile saves, policy renewal, suspension and local logout/replay rejection |
| `npm run build` | Passed; all account, directory, profile and auth pages are dynamic |
| `npm run test:auth:production` | Passed using an isolated compiled app, synthetic HTTPS proxy host and fixture credentials; verifies private-route denial, no preview bypass, canonical callback, cookie flags, referrer policy and host rejection |
| Configured-secret scan | Zero matches in tracked/unignored source, examples or documentation; zero matches in built browser chunks |
| `npm audit --omit=dev` | Zero production dependency vulnerabilities at verification time |
| Full dependency audit | 9 development-tool advisories: 5 high in the ESLint dependency chain, 4 moderate in Drizzle Kit/esbuild tooling. Suggested npm force fixes would downgrade major tooling; not applied. Review supported upstream fixes before deployment. |
| `git diff --check` | Passed |

Regular PDF/browser checks still exercise actual local Thai/English OCR, mixed pages, review/edit/export, exact Friday minute boundaries and semester-aware Bangkok availability. Browser coverage is Chromium with desktop and emulated mobile viewports; it is not a physical-device or university infrastructure certification. Auth tests disable traces/videos and never take screenshots of real member lists.

## Design review

Applied the existing frontend-design direction and Impeccable hardening/polish guidance, preserving the approved visual world. Rendered desktop/mobile account states were reviewed in two passes. Removed duplicate profile headings and duplicate theme disclosures, preserved the profile-save confirmation through server refresh, made pending/suspended progress reflect stored truth, clarified the empty import state and separated local logout from SSO logout in the copy. Real admin controls keep the existing ruled-row styling, with grouped touch-friendly controls on mobile and wrapping for long names.

Automated WCAG A/AA checks reported no violations on configured login/account screens in both themes and on the real admin fixture controls. Keyboard focus, native labels/fieldset controls and viewport overflow were checked. Manual screen-reader and physical-device testing remains outside this run.

Only fictional fixture screenshots are exported under the ignored `.impeccable/review/oidc/`:

- `account-desktop-light.png`, `account-desktop-dark.png`
- `account-mobile-light.png`, `account-mobile-dark.png`
- `access-row-desktop-light.png`, `access-row-desktop-dark.png`
- `access-row-mobile-light.png`, `access-row-mobile-dark.png`

## Source changes

| Area | Files |
| --- | --- |
| Auth configuration and gates | `src/auth.ts`, `src/lib/auth/{config,discovery,domain,settings,access,actions,member-view}.ts`, `src/types/next-auth.d.ts`, `src/proxy.ts`, `src/app/api/auth/[...nextauth]/route.ts` |
| PostgreSQL | `src/db/{schema,index,member-repository}.ts`, `drizzle.config.ts`, `drizzle/0000_damp_nekra.sql`, `drizzle/0001_account_table_rls.sql`, migration metadata |
| Existing route integration | Root layout/page, login, friend detail, account/onboarding/policy/pending pages, personal timetable/import pages, admin layout/access, `src/lib/friends-repository.ts`, `src/lib/preview.ts` |
| Shared interface | `member-account.tsx`, login in `account-screens.tsx`, `personal-preview-provider.tsx`, `site-header.tsx`, `theme-provider.tsx`, empty-import copy in `friend-profile.tsx`, scoped access-control layout in `redesign.css` |
| Operations and tests | `scripts/{account-db,check-oidc}.ts`, `scripts/{start-browser-fixture,check-auth-production}.mjs`, Auth/DB/browser fixtures and tests, Playwright configs, PDF browser test's same-origin assertion |
| Configuration/docs | `.env.example`, `.gitignore`, `package.json`, lockfile, test output configuration, `README.md`, `AUTH.md`, `AUTH_VERIFICATION.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/direction.md` |

Pre-existing audit/review and unrelated working-tree files were left alone. Credentials remain ignored. No commit, push or deployment was performed.

## Remaining work

Resolve the reported KMITL browser 502 and complete a real approved-client login/logout test. Verify production callback and canonical HTTPS/reverse-proxy settings. Correct the optional direct database hostname, establish admin bootstrap/operations, review sharing policy/privacy/removal requirements, manage backups/session cleanup/rate limits and review the Auth.js beta/tooling advisories. Full RP-Initiated Logout, authorized timetable persistence, GitHub JSON storage and the university timetable API remain separate work. See [AUTH.md](AUTH.md) for setup and protocol details.
