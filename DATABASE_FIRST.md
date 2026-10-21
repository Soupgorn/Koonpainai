# Student-owned timetables

Owner-confirmed product decision, 22 October 2026. Students maintain their own schedules. The application uses Auth.js/KMITL Keycloak and Drizzle/PostgreSQL; no Supabase Auth, PDF/OCR or external university timetable provider is used.

## Application architecture

- `src/lib/timetable/model.ts`: strict Zod entry/semester/delete inputs, minute precision, date validation, overlap detection, stable course identity and safe errors.
- `src/lib/timetable/actions.ts`: authenticated Server Actions; the actor is always derived from the validated Auth.js session. No browser-supplied member ID is accepted. Framework Origin/Host protection is retained; it does not replace authorization.
- `src/db/timetable-repository.ts`: persistent Drizzle CRUD, actor re-read/lock in each transaction, explicit owner predicates, locked parent revision, duplicate/overlap checks and minimal shared projections. Parameterized queries and transaction-local context are used throughout.
- `src/lib/friends-repository.ts`: request-scoped private/shared reads; eligible members only. Missing storage tables produce an honest unavailable state, not mock success. Other database errors fail closed.
- `src/components/my-timetable.tsx`: semester setup, Add/Edit/Delete, explicit conflict acknowledgement, delete confirmation, save/error feedback and labeled preview behavior. Existing weekly grid and mobile agenda remain.

Each student has **one current semester**. Changing dates preserves class entries and is an explicit owner action. Historical multi-semester archives are outside this change. Course name, weekday and start/end times are required; code, section and room/location can be empty. Weekdays are **Sunday=0 through Saturday=6**, exactly matching the existing Asia/Bangkok engine. Intervals are start-inclusive/end-exclusive. Overnight classes must be split into separate day entries.

Exact duplicates are rejected, distinct sections/sessions are retained. Conflicts are never silently merged or shifted: the server checks for overlaps and requires `allowOverlap=true`; the editor lists the conflicting sessions. The existing grid assigns separate lanes. At most 200 classes per student; concurrent updates lock the timetable row and compare its revision. A stale request returns a reload instruction rather than overwriting newer work.

## Access and privacy

| Operation | Requirement |
| --- | --- |
| Own read/create/update/delete | Valid, unrevoked Auth.js session; profile complete; current sharing acknowledgement; not suspended. Pending students may prepare privately |
| Shared timetable/directory read | Both viewer and target approved, profile complete and current acknowledgement |
| Administrator approval | Existing fresh administrator/account checks retained |
| Administrator edit of another timetable | Denied; no override or special editor exists |

All mutation endpoints authenticate independently. The repository rechecks the actor inside the transaction, including when the active application still uses the privileged owner credential that bypasses RLS. It always scopes class IDs by the authenticated owner. Shared SQL/projections explicitly exclude ineligible accounts even for owner connections. Issuer, subject, email, tokens and raw member records never become timetable DTOs.

Policy **2026-10-22-student-v3** explains student-entered persistent sharing. Old `2026-10-21` and `2026-10-21-api-v2` acknowledgements are retained but do not satisfy the new gate. No existing acknowledgement is rewritten or automatically accepted. The managed artifact verifier/package step pins the new policy; reverting to an old artifact must not silently weaken acknowledgement requirements.

RLS uses transaction-local `app.member_id` and `app.policy_version`, set with parameterized `set_config(..., true)` only after server authentication. These are **not Supabase JWT claims** and do not call `auth.uid()`. PostgreSQL sees the shared trusted runtime role, not individual SSO users: anyone possessing that server credential can set custom GUCs and impersonate an actor. RLS is defense against missing/wrong query predicates and missing context, not a substitute for server authentication or protection from a compromised runtime credential. The role must never be given to browsers/PostgREST clients. Local context is cleared on commit/rollback and tested for pool leakage.

## Replacement migration 0002

`drizzle/0002_student_timetables.sql` replaces only the **unapplied** API-first proposal. Original SQL, snapshot and journal are preserved under `operations/retired-api-first-0002/`; old SQL SHA-256 is `951df22ac154eb63fe7116292c5308c630f3fe4559e4f913e23280eb2064b518`. Applied `0000`/`0001` files/timestamps are unchanged. The new journal has one idx2 and a new timestamp/hash. The runner compares the complete applied ledger prefix, so a database where the old 0002 was applied will fail rather than accept edited history. Such a database requires a separately reviewed forward migration.

The migration adds only:

| Object | Contents |
| --- | --- |
| `public.student_timetables` | Owner member FK/PK, semester name/start/end, revision and saved timestamp |
| `public.timetable_entries` | UUID, owner FK, course name/code, section, weekday, exact start/end, room |
| Constraints/indexes | Required/length/date/time/day checks; owner index; exact duplicate uniqueness |
| RLS | Enabled and forced on both tables; seven scoped read/create/update/delete policies |

No existing table/data, account policy, default ACL, role attribute, password or service_role permission is modified. Existing service_role/provider bypass capabilities remain a separate operational risk; the application does not use those credentials.

### Proposed runtime privileges on new objects only

- `SELECT, INSERT` on both tables.
- Column `UPDATE` on semester `name,start_date,end_date,revision,updated_at` and class `course_name,course_code,section,day,start_time,end_time,room`.
- `DELETE` on class entries only, owner-restricted by RLS; no timetable-table delete grant.
- No owner/ID reassignment, table-wide UPDATE, TRUNCATE, REFERENCES, TRIGGER, schema creation or new role membership.
- Explicit removal of new-table grants from PUBLIC/anon/authenticated; no changes to their existing account-table grants, default ACLs or service_role.

The reviewed `koonpinai_runtime` role must already exist with its account-table permissions/policies. The migration guard rejects missing/unsafe runtime-role basics or retired API objects; the existing runner rejects new-object conflicts, unsafe client account grants and ledger drift. Full production identity/security verification remains mandatory. Both owner and dedicated-role application paths were considered; runtime credential cutover remains a separate action.

### Execution/recovery procedure — not production approval

1. Keep production unchanged until the new migration SQL/rollback checksums, fresh 0000/0001 ledger, runtime-role catalog, default ACL/RLS and target identity have been independently reviewed. Confirm the old API proposal was not applied. Recheck the provider transport/capacity gates.
2. Obtain a fresh approved encrypted application backup outside Git and verify restore/digests, including the new tables in future post-migration backups. Preserve all previous backup/baseline evidence. `scripts/database-backup.ts` now includes timetable counts/digests when tables exist; it still dumps public/drizzle together. No new production backup was taken here.
3. Use separately delivered migration credentials, never web credentials. The reviewed migration runner uses one verified Direct/Session connection, advisory transaction lock, lock timeout5s, statement timeout60s and idle-transaction timeout60s; DDL and ledger commit atomically. Startup never calls it. A reviewed command would be `npm run db:migrate -- --approve-through=0002`, **only after explicit new production approval**.
4. Compare account/session digests and existing security catalog before/after; verify the two new tables, checks/indexes, exact new ledger hash, seven policies, effective PUBLIC/client/runtime table/column privileges and no owner-changing grant. Do not print account identifiers or credentials.
5. Separately approved application canaries must use disposable identities and exact cleanup; a local synthetic result is not live KMITL SSO proof. Preserve policy renewal. Do not edit real students to make a test pass.
6. Before timetable writes begin, the pinned `operations/student-timetables.rollback.PROPOSED.sql` can undo **only empty new tables** and its exact new ledger row. It requires the owner role, exact last migration/no later migrations, expected table ownership/forced RLS, advisory lock and bounded timeouts, then exclusive locks and emptiness checks. It refuses populated tables. Execute only with separate production recovery approval.
7. If students have saved data, keep schema/data and use a compatible application rollback/forward repair. Never drop their timetables, rewrite the ledger or restore an older backup automatically. An application rollback must preserve current policy requirements and existing credentials/permissions.

The older backup-recovery script remains a pre-0002 two-account-table recovery rehearsal; its schema checks now target the student tables and its local role placeholders include the runtime role. It is not a general post-0002 recovery executor. Post-migration backups require a separately rehearsed complete timetable restore before production acceptance; never silently reuse historic approval/evidence for a changed migration.

## Verification and readiness

Local verification covers strict inputs, optional fields, exact Friday 08:45–10:15 /10:30–12:00 and 16:00 boundaries, overlap lanes, Bangkok availability, real restricted Drizzle CRUD, cross-owner/admin denials, pending/old-policy/suspension gates, concurrency, context cleanup, migration failure/idempotency/rollback and exact fixture cleanup. Existing account, TLS, theme and responsive regressions are retained. External university OIDC remains mocked/synthetic in isolated testing.

Private execution evidence and exact final checksums/results are recorded in the local delivery report. Sanitized source rehearsal helpers are `scripts/rehearse-student-timetables.ts` and `scripts/rehearse-student-browser.ts`; both reject hosted targets and require a new marked loopback cluster/database/data directory. Browser tests use the normal fictional port3100 fixture; no production authenticated browser suite is run.

Verified 22 October 2026 locally:

| Check | Result |
| --- | --- |
| TypeScript / ESLint | PASS |
| Staged-only publication unit suite / TypeScript | 58 passed, 1 production-configured suite skipped / PASS |
| Full local working-tree unit regressions, including private-readiness helpers and CA/hostname handshakes | 84 passed; 1 production-configured database suite deliberately skipped |
| Responsive/browser/theme regression suite | 22 passed, desktop/mobile; additional editor light/dark checks run separately |
| Existing restricted Auth.js/Drizzle canary | 12 groups passed, OIDC mocked |
| Replacement migration, RLS/CRUD/concurrency and guarded rollback | 13 groups passed on new PostgreSQL17.11 with verified TLS1.3 |
| Built Next application + real Server Actions + restricted database | 4 groups passed: semester/create/edit/reload persistence, read-only peer/pending access, confirmed persistent deletion and revoked-session denial |
| Secret-free production build/package | PASS, exact Next16.4.2/Node24; no production connection or startup migration |

The isolated browser fixture intercepted `https://app.example` in process and proxied requests to the loopback build, preserving Host/Origin and actual Server Action bodies. Its signed session was synthetic; real KMITL OIDC was not called. PostgreSQL independently used verified certificate/hostname TLS1.3. Exact fixture cleanup preserved the control-record digest, drained runtime connections and stopped the new local cluster. This is not a hosted SSO or Linux Docker deployment test.

| Pinned review artifact | SHA-256 |
| --- | --- |
| New migration 0002 | `3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a` |
| Empty-table rollback proposal | `3fa7a0f7ac71748456b0ca205f7640020e7b2fc8bb27790e48ca59278a7324ff` |
| Successful isolated evidence report, retained privately | `e0b5406fb33d8406149ff8e0a63849eea4342061622eb1bbe8d9319d8e68c929` |
| Windows candidate artifact manifest | `b84c5f2f2280ed6ad39cf296cb5132128197193b20cb5be0b141b8f0b354c1da` |

The candidate is outside the repository, built from input digest `3ef06bb4807157b7342d0662e3eea135aaa8b0f1a40c35773793c62f91c750ef`. It is not the Linux deployment image. Current evidence must be reviewed again if any pinned SQL or release input changes. The original approved backups, active account baseline and previous security/recovery evidence remain untouched.

**Readiness:** local implementation can be reviewed; production schema execution remains **NO-GO pending a fresh approved migration/backup/security review**. Phase3 runtime cutover is separately NO-GO pending target Linux lifecycle/rollback, secret delivery, bounded connection capacity, upstream transport assurance and authorized production canaries. No active connection, password, production schema/data/grant/role/policy or backup baseline was changed. Git publication does not authorize deployment or database changes.
