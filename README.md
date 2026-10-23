# Koonpinai

Students maintain their own weekly timetables and see approved friends’ availability in **Asia/Bangkok**. Availability comes from class schedules, never GPS or attendance.

Next.js 16 App Router, TypeScript, Tailwind/shadcn, Auth.js + KMITL Keycloak, PostgreSQL, Drizzle and Zod. The active hosted database remains Supabase; a separate self-hosted PostgreSQL17 environment is prepared locally. **Database-first:** no external timetable provider, PDF/OCR or Supabase Auth.

Latest [release-readiness evidence](RELEASE_READINESS.md): private synthetic CloudStack functional tests passed. October 23 management checks passed on five fresh key-only SSH connections over 147 seconds; the tested application stack remains intentionally stopped after cleanup. An earlier failed probe is retained in the evidence. Production migration and cutover remain NO-GO. The sealed candidate/rollback images passed the actual Linux Compose rehearsal. Offsite recovery is deferred by the owner for disposable staging data only. See the [manual CloudStack firewall checklist and console diagnostics](operations/release/firewall-review.PLAN.md); no firewall settings were changed.

## Run locally

Use Node24 for the pinned managed-runtime artifact (ordinary development supports Node22.13+).

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Configure approved SSO and database credentials locally; never commit them.
npm run dev
```

Open [localhost:3000](http://localhost:3000). See [AUTH.md](AUTH.md) for the approved OIDC client and callback. TLS always validates the PostgreSQL server certificate and hostname; configure DATABASE_CA_FILE from a trusted source. Operational commands require a separate verified Direct/Session MIGRATION_DATABASE_URL or DIRECT_DATABASE_URL, never a runtime fallback.

**Production migration is not approved or applied.** The former unapplied API-first migration 0002 is preserved under operations/retired-api-first-0002; the active proposal is [0002_student_timetables.sql](drizzle/0002_student_timetables.sql). Do not run db:migrate until its new checksum, fresh production preflight, backup/recovery plan and explicit approval are established. If the old 0002 was applied elsewhere, stop: it needs a separate forward migration. The app honestly disables saves when storage tables are absent.

## Product flows

- KMITL SSO creates/reuses an account; profile, current sharing acknowledgement and approval govern shared access.
- My Timetable: set semester dates, add/edit/delete your own weekly sessions. Optional course code, section and location; required course name, day and exact times.
- Conflicts require explicit overlap acknowledgement; duplicates and stale-tab writes are rejected. Delete asks for confirmation.
- Pending students can prepare their own private timetable after setup/current policy. Suspended accounts cannot edit. Pending, suspended and policy-outdated schedules are excluded from shared reads.
- Administrators manage approvals; they cannot edit other students’ timetables.
- Policy 2026-10-22-student-v3 requires renewed acknowledgement without changing existing stored acknowledgements automatically.

[DATABASE_FIRST.md](DATABASE_FIRST.md) documents authorization, transaction-local RLS, schema, tests and migration readiness. The shared server runtime role does not use auth.uid() or Supabase Auth JWT claims. Its credentials never reach clients.

## Routes

| Route | Behavior |
| --- | --- |
| /login | KMITL SSO |
| /onboarding, /onboarding/policy | Profile and current sharing acknowledgement |
| /pending-approval | Actual pending/suspended status |
| / | Eligible members, search, availability filters and view switching |
| /friends/[id] | Read-only eligible member profile and responsive timetable |
| /my-timetable | Own persistent semester and class editor |
| /account | Profile, appearance, sharing and local logout |
| /admin, /admin/access | Administrator approval management and read-only timetable links |

Retired PDF routes remain 404. There are no API connection/synchronization controls. Existing Auth.js internal routes and Server Actions remain.

## Design and preview

Main’s approved Cloud & Sky palette, penguin branding, Mali headings, Kodchasan UI and Noto Sans Thai fallback are preserved. Light/Dark/System apply throughout the app; the approved login card stays light without changing the saved preference. Mobile uses day agendas; desktop uses accurately positioned overlapping lanes. See [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md).

For **fictional development only**, ENABLE_UI_PREVIEW=true with all auth/database credentials empty enables the design fixture. Partial credentials disable it; production never allows it. My Timetable starts empty, including in preview. Timetable preview edits remain in memory and reset on reload. Only theme preference persists locally.

## Verification

```powershell
npm run typecheck
npm run lint
$env:RUN_AUTH_DB_TESTS='false'
$env:RUN_DATABASE_TLS_TESTS='true'
npm test
npm run test:e2e
node scripts/build-runtime-artifact.mjs
```

The normal browser suite is credential-free on port3100. Do not substitute the production-configured authenticated suite without separate write-canary approval. Isolated PostgreSQL/real Server Action rehearsal helpers and evidence are documented in DATABASE_FIRST.md; external OIDC is mocked/synthetic there.

## Deployment safeguards

The managed launcher uses a max2 pool, awaited Session timeouts, exact-role/RLS readiness, a runtime-only external secret directory, pinned artifacts and graceful HTTP/Next/pool shutdown. No startup migration or automatic owner fallback exists. Windows DPAPI is not portable Linux secret storage. The proposed Docker/Compose configuration is not an executed production deployment.

Self-hosted deployment/cutover remains NO-GO pending Linux/container lifecycle tests, independently delivered backup keys/off-VM recovery, fresh final source backup and approved production canaries. See [self-hosted PostgreSQL operations](SELF_HOSTED_POSTGRES.md) for Compose, separate runtime/migration/admin identities, portable encrypted backup/restore, connection budget and freeze/rollback procedures. [Post-merge readiness](POST_MERGE_READINESS.md) records current evidence and limits. Existing backup/security assessments remain historical evidence; do not deploy, migrate or change production credentials merely because this code builds.

### Isolated PostgreSQL verification

```text
npm run db:portable -- audit --config=<external-private-readonly-config>
npm run test:selfhost -- --pg-bin=<existing-PG17-bin> --artifact=<secret-free-artifact> --approve-isolated-writes
npm run test:selfhost:docker
```

The native helper creates new loopback-only source/target databases with synthetic identities, verifies encrypted backup/restore and application authorization, then stops both clusters. It never loads dotenv. Use only approved existing PostgreSQL binaries; no system installation is automatic. The Docker helper requires Linux Docker and uses disposable labelled resources. It is not a production executor. CI validates pull requests with synthetic data and no production secrets; it neither publishes images nor deploys.

See [Linux staging verification](LINUX_STAGING_VERIFICATION.md) for actual Ubuntu Docker installation and synthetic Compose, migration, authorization, shutdown and portable recovery results. `npm run test:staging:compose` uses independent recovery volumes and refuses remote Docker contexts. Earlier [readiness evidence](LINUX_STAGING_READINESS.md) is preserved as history. Production migration and cutover remain unapproved.

## Brand assets and merge review

The true-vector penguin master and export provenance are in [public/brand](public/brand/README.md). Run `node scripts/generate-brand.mjs` only when intentionally updating derived assets; its canvas dependency is a development tool, not a PDF processor. Main’s compact workspace, responsive navigation, live Bangkok clock, reduced-motion handling and login feedback are retained.

See [MERGE_RECONCILIATION.md](MERGE_RECONCILIATION.md) for the exact branch comparison, conflict decisions and verification limits. No commit, push, production cutover or migration is implied by local reconciliation.
