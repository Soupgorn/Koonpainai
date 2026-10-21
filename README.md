# Koonpinai / คุณไปไหน

Find a break together. Students maintain their own weekly timetables and see approved friends’ availability in **Asia/Bangkok**. Availability comes from class schedules, never GPS or attendance.

Next.js 16 App Router, TypeScript, Tailwind/shadcn, Auth.js + KMITL Keycloak, Supabase PostgreSQL, Drizzle and Zod. **Database-first:** no external timetable provider, PDF/OCR or Supabase Auth.

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

Approved Contemporary Social Utility, Manrope/Noto Sans Thai and Light/Dark/System are preserved. Mobile uses day agendas; desktop uses accurately positioned overlapping lanes. See [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md).

For **fictional development only**, ENABLE_UI_PREVIEW=true with all auth/database credentials empty enables the design fixture. Partial credentials disable it; production never allows it. Timetable preview edits remain in memory and reset on reload. Only theme preference persists locally.

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

Phase3 runtime cutover remains NO-GO pending target Linux/container lifecycle tests, actual production rollback artifacts, capacity bounds, provider transport assurance and approved production canaries. See [deployment/migration boundaries](DATABASE_FIRST.md). Existing backup/security assessments are historical evidence; this timetable migration requires a new review. Do not deploy, migrate or change production credentials merely because this code builds.
