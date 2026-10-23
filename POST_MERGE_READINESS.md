# Post-merge and self-hosted PostgreSQL readiness

**Latest execution:** [Linux staging verification](LINUX_STAGING_VERIFICATION.md) supersedes this report's Docker availability, staging test results and installation approval request. The intermediate [readiness report](LINUX_STAGING_READINESS.md) and original evidence below remain historical; no account baseline or previous backup was replaced. Production cutover remains NO-GO.

Local engineering review, **22 October 2026**. Production deployment, credential cutover, account changes, role/grant changes and migration execution are **not authorized or performed**. Read-only source queries and a new encrypted read-only application backup were performed; all restores, migration/permission writes and application write tests used new isolated local databases.

## Git and preservation

- Latest fetched `origin/main`: **`69899885aaf32f692775df68da384511d7c99562`**, merge of reconciliation PR2. The final fetch still points there.
- New branch: `feat/selfhost-postmerge-1792639921257`, based directly on that merge.
- Isolated checkout: `D:\Project\Koonpinai-selfhost-1792639921257`.
- Original checkout remains on `feat/database-first-timetables` at `c442f10`; the reconciliation checkout remains at `14e53fb`. Local main was not reset/advanced. No main history was rewritten.
- Original dirty/untracked inventory: **43 files** (one modified generated file plus42 untracked files), preserved separately with SHA256 fingerprints in ignored operational evidence. Its uncommitted operational documents, baseline, credentials and generated Next file are not part of this branch.
- No commits, pushes, merges or deployments were performed. New code remains uncommitted for review. The isolated checkout's generated `next-env.d.ts` change is not an intended source change.

## Post-merge findings and fixes

No unresolved merge markers or functional UI/authentication regression was found in merged main. Penguin branding, Cloud & Sky colors/type, desktop/mobile navigation, Light/Dark/System, policy onboarding, approvals, shared availability and student timetable editor were retained. Desktop light timetable and mobile dark dashboard screenshots were inspected after the credential-free browser suite.

The main managed launcher accepted only the hosted Session Pooler route. It now also accepts an **explicitly pinned self-hosted host/port/database with the exact runtime role**, retaining hosted behavior and verified TLS. It refuses owner/migrator credentials, mismatched targets, provider hosts disguised as self-hosted endpoints and URL security overrides. Runtime readiness also rejects privileged role attributes/memberships/ownership, schema CREATE/account-role UPDATE, and missing/non-forced-RLS timetable tables. The application still cannot read its migration ledger; operator preflight verifies that separately.

New recovery tooling initially exposed and fixed:

1. Canonical row fingerprints varied between Bangkok/UTC sessions. Full backup projection and fixture control pools now normalize timestamps to UTC, preserving every field in the digest. Backup row/catalog ordering explicitly uses C collation, independent of host locale.
2. A restored database needed its own database-local CONNECT/CREATE/default ACL setup; cluster-level role creation alone was insufficient.
3. The migration role's `pg_catalog,public` search path sent unqualified Drizzle CREATE TABLE to pg_catalog. Its new self-hosted setting is `public,pg_catalog`; only that trusted migrator has public CREATE. Runtime keeps pg_catalog first and has no DDL privileges.
4. A schema-local function EXECUTE REVOKE did not remove PostgreSQL's global PUBLIC default. The dedicated self-hosted migrator's global function default is now revoked and tested with a disposable function.
5. Restore reconstruction now transfers tables before owned sequences, and uses an unambiguous PL/pgSQL record name. A non-empty target, failed authentication, ciphertext tampering and RLS-drift candidate all fail closed.

These were local implementation/rehearsal fixes, not production schema/grant changes. Two dead links in the historical API-first review now identify their unavailable local-only evidence and point to current operational guidance.

### Changed files

| Area | Files |
| --- | --- |
| Runtime compatibility/readiness | `runtime/secrets.mjs`, `src/db/runtime-lifecycle.ts` |
| Portable operations | `scripts/portable-database.ts`, `scripts/portable/access.ts`, `scripts/portable/crypto.ts`, `scripts/portable/database.ts`, `scripts/portable/permissions.ts` |
| Native/container/browser rehearsal | `scripts/rehearse-selfhost.ts`, `scripts/rehearse-selfhost-docker.mjs`, `scripts/rehearse-runtime.ts`, `scripts/rehearse-runtime-docker.mjs`, `scripts/rehearse-student-browser.ts` |
| Self-hosted configuration | `operations/selfhost/compose.yaml`, `postgresql.conf`, `pg_hba.conf`, `roles.sql`, `Dockerfile.tools`, `compose-paths.EXAMPLE.conf`, `operator-config.EXAMPLE.json`, `runtime-manifest.EXAMPLE.json`, `koonpinai-backup.service`, `koonpinai-backup.timer` (all under that directory) |
| Regression/CI | `tests/portable-backup.test.ts`, `tests/selfhost-runtime.test.ts`, `.github/workflows/verify.yml` |
| Configuration/guardrails | `package.json`, `.env.example`, `.gitignore`, `.dockerignore` |
| Documentation | `README.md`, `AUTH.md`, `DATABASE_FIRST.md`, `PRODUCT.md`, `API_FIRST_REVIEW.md`, `SELF_HOSTED_POSTGRES.md`, `POST_MERGE_READINESS.md` |

Generated-only `next-env.d.ts` remains uncommitted and outside the intended change. No package dependency or lockfile, migration, production environment, original working-tree document or active baseline was changed. New self-hosted role SQL SHA256: `f3261e051df82a5fec9809bd74cc5db246d6f77a4dce29eaeedc52dbf514ee5f`; access reconstruction source SHA256: `55bfa0abf95d57c45cedd394850328111d87ccd8f36b8cf7d9408925753daa83`. These are new-target review pins, not authorization to run them on Supabase.

## Database-first schema and migration

Existing `src/db/schema.ts`, application CRUD and all Drizzle migration bytes/journal/snapshots remain unchanged from merged main. Student-owned term/date/revision metadata and recurring entries preserve exact minute times, optional code/section/location, constraints, FK cascades, owner index and exact-duplicate uniqueness. Overlap requires explicit acknowledgement; separate lanes retain conflicting sessions. Weekdays Sunday0–Saturday6 and Asia/Bangkok availability are unchanged.

Every Server Action derives ownership from the verified Auth.js session; client member IDs are rejected. The repository rechecks profile/current policy/status and scopes mutations by the actor, including administrator requests. Runtime RLS uses transaction-local trusted server settings, not Supabase Auth. Pending schedules remain private; suspended/policy-outdated accounts are excluded as appropriate. The shared database credential remains a trusted-server capability and must never reach clients.

Fresh read-only source verification confirms **only0000/0001 applied**;0002 remains pending. The obsolete API-first0002 remains archived. The merged Database-First replacement is appropriate for this verified source; no successor or applied-history rewrite is needed. Any other environment with a different0002 hash must stop and obtain a forward migration review.

| Pinned file | SHA256 |
| --- | --- |
| `drizzle/0002_student_timetables.sql` | `3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a` |
| `operations/student-timetables.rollback.PROPOSED.sql` | `3fa7a0f7ac71748456b0ca205f7640020e7b2fc8bb27790e48ca59278a7324ff` |

The runner retains strict exact-prefix checksum verification, explicit approval-through, advisory lock,5s lock/60s statement/idle-transaction timeouts and atomic DDL/ledger. No web startup applies migrations. The existing empty-table rollback pins Supabase owner assumptions; it is not an automatically authorized self-hosted ownership rollback. Populated timetables require forward repair or verified empty-database recovery, not table deletion.

## Source and backup evidence

The first sanitized source assessment at **2026-10-22 11:03:32 Bangkok** found PostgreSQL17.11,2 members,7 sessions, ledger length2 and no timetable tables. Against the approved identity reference: no added/removed member or issuer/subject, administrator-role or approval changes. Both client roles retain zero effective account permissions. `koonpinai_runtime` remains LOGIN without superuser/BYPASSRLS/CREATEROLE/CREATEDB/replication capabilities. Existing production records/security were not altered.

Stored acknowledgements include one old `2026-10-21` and one current `2026-10-22-student-v3`. The current release still requires renewal from old policy versions; no consent was upgraded, baseline activated or session-lifecycle change silently authorized. Session counts are observations, not permission to modify a baseline.

The original approved backup at `D:\Backups\Koonpinai\2026-10-21T13-23-18-226Z-c3e1b806-encrypted` retains manifest SHA256 `07d7683ca0b18a1bdeda1fd23a768023f58a2174b58ae12ee46552dcb157cfd0`. Its2 members/4 sessions were restored privately, compared against every recorded digest and exact ledger, converted to portable encrypted backup and independently restored. Isolated0002 preserves all historical account/session values. All original backup-file hashes were rechecked unchanged after rehearsals.

A **new read-only source snapshot** was encrypted and verified at **2026-10-22 11:32:23 Bangkok**:

```text
D:\Backups\Koonpinai\portable-source-2026-10-22T04-31-55-560Z-009eeb95\2026-10-22T04-31-57-403Z-e85726f4
```

| Artifact | SHA256 |
| --- | --- |
| Signed manifest file | `8eeb8a0e83ced44836232fb35cdb3ea14063b899251ac9630b8e70ee3f33684f` |
| Encrypted application archive | `bb35a3e63fad9320a151b865834d1a45f1d62f7306137609f55d271c10c0b9aa` |
| Decrypted archive, verified in private memory/workspace only | `671661e6cbc1537709a228037b463bcfa863f41173a28f4bc3da514070b3991b` |

This snapshot has2 members/7 sessions and2 ledger rows. Client certificate/hostname validation, target fingerprint, approved member-security fields and runtime/client permissions were checked before export. The security catalog matched afterward. Keys are separately protected outside Git in `D:\Secrets\Koonpinai`; key values are never reported. A second authenticated encrypted **local** copy was verified; this is not off-VM durability evidence. The active account baseline and every prior backup remain unchanged. A final frozen cutover snapshot will still be required later.

## Self-hosted implementation

See [SELF_HOSTED_POSTGRES.md](SELF_HOSTED_POSTGRES.md) for exact commands, secret layouts and recovery/cutover boundaries.

- `operations/selfhost/`: pinned Compose/PostgreSQL17 config, SCRAM/private-network/TLS setup, separate role bootstrap, operator/runtime examples, nonroot tools image and opt-in daily backup timer.
- `scripts/portable/`: streaming authenticated encryption, private path/ACL checks, consistent application export, signed/checksummed manifests, empty-target transactional restore, full-record/ledger/schema comparison, scoped privilege reconstruction, encrypted replication and non-destructive retention planning.
- `scripts/portable-database.ts`: explicit private file-based operator CLI; no dotenv or runtime fallback. Mutating commands require a self-hosted config plus explicit matching target approval; migrations also require a separate migrator and approval-through.
- `scripts/rehearse-selfhost.ts`: independent new loopback TLS source/target clusters, application/security canaries, synthetic four-table recovery, historical/fresh snapshot restore, migration, failure recovery, fresh install and restart checks. No source connection is used by the restore/application-write rehearsal.
- `.github/workflows/verify.yml`: pull-request-only checks with pinned actions, no production credentials, image publication or deployment. Docker helpers prepare Linux/native and actual-container lifecycle tests; CI has not run because nothing was pushed.

Connection budget:30 total minus3 superuser/2 reserved=25 ordinary slots. Two overlapping max2 web pools,2 backup,1 migration,2 operations plus8 safety reserve=17;8 additional ordinary slots remain. The new server runtime role's connection limit8 is separate from pool max2. Hosted Pooler client limits are not interpreted as PostgreSQL backend capacity.

The web mount contains exactly its own five files and no migration/admin/backup secrets. Linux uses private text files and portable encryption keys, not DPAPI. Native Windows tests use private ACLs and separately delivered raw backup keys; actual Linux ownership/mount checks remain a staging gate. No unnecessary Supabase schemas/roles/default privileges are imported. Administration, migrator ownership and runtime access are distinct.

## Verification

| Check | Result / scope |
| --- | --- |
| TypeScript and ESLint | PASS |
| Unit/security/TLS/schedule/theme tests | **63 PASS,1 SKIP**,64 total; skipped production-configured database test intentionally not run |
| Credential-free Playwright | **34 PASS**, desktop/mobile; themes, navigation, approvals preview, editor validation and visual screenshots |
| Production smoke | PASS; private redirects, no preview bypass, canonical callback, secure cookies, referrer/host checks; fixture configuration only |
| Secret-free production artifact | PASS; Next16.4.2, policy2026-10-22-student-v3, no dotenv/operational credentials |
| Restricted account/Auth.js integration |12 groups PASS; real Drizzle/PostgreSQL, mocked OIDC |
| Timetable/migration/RLS integration |13 groups PASS; exact times, cross-owner/admin denial, overlap/duplicates/revision, context cleanup, atomic failure/empty rollback/reapply |
| Runtime lifecycle | Distinct same-policy local build rollback, max2 exhaustion/acquisition, SQL cancellation, failed candidate, private secret loader, active-request drain and closed clients PASS; Windows IPC exercises shutdown handler, **not POSIX SIGTERM** |
| Real Server Action browser/database |4 groups PASS; persistent CRUD/reload, peer read-only, pending privacy, revoked session and exact cleanup; synthetic sessions |
| Four-table portable recovery | PASS; full-row UTC fingerprints, schema/ledger/policy comparison, separately delivered raw key, tamper/non-empty-target rejection and verified replica |
| Historical approved source recovery | PASS;2 members/4 sessions, exact digests, independent portable restore and isolated0002; accounts unchanged |
| Fresh source recovery | **PASS**;2 members/7 sessions, all-row/schema/ledger match on independent restore; isolated0002 advances only its ledger and preserves account data; source export remained read-only |
| Fresh installation | All0000–0002 as non-superuser migrator, no-op repeat and safe future table/function defaults PASS |
| Database restart | PASS; persistent records/fingerprints and fresh TLS acquisition using the existing runtime pool |
| Compose/CI YAML and static mount/network review | PASS; not equivalent to container execution |
| Actual Docker/Linux | **NOT RUN**: Docker/Podman absent and no usable WSL Linux. No system dependency was installed |
| PR CI | Prepared, **not run remotely**; no push/commit performed |
| Production SSO/write/cutover | **NOT RUN**, not authorized |

The final native rehearsal completed at **2026-10-22 11:41:14 Bangkok**, using the final built artifact's actual production launcher for both lifecycle and browser tests. Its9 lifecycle groups include timetable RLS startup rejection and rollback between two distinct same-policy **local** artifacts (not a previous production deployment). All38 account/timetable/lifecycle/browser groups, portable recovery checks, fresh-source recovery and historical checks pass. Full private report: `.private/selfhost-rehearsal-1792644121286.json`. Local test database files are stopped and sealed, and portable archives remain AES-encrypted outside Git.

Final secret-free application artifact: source SHA256 `173aadfdaf3cf9b1397b9f0cae6450636ed1ace8f5ec6cf1a6bf362ae40c75c8`, manifest SHA256 `774b2e61cf0dba5458ffde867a80475056042be3bdd14de6e7410639edf29bdb`. It is stored outside Git at `C:\Users\supakorn\AppData\Local\Temp\koonpinai-artifact-8ac5d437-cb5b-4401-ba28-163d35253e80\artifact`. Operator/tooling code is a separate image/source review; these are application artifact pins, not permission to deploy.

The final privacy scan checked224 source files against configured secret values without printing them: zero matches, zero private backup/environment artifacts, zero conflict markers. All43 original working-file fingerprints remain unchanged. The scan is evidence against known configured secrets, not a claim that arbitrary undisclosed credentials can always be detected.

## Security limits and remaining gates

Source client-to-pooler TLS validates the certificate/hostname. The database backend reports `pg_stat_ssl.ssl=false`; provider-managed upstream transport is a separate observed leg. Its private-network threat controls are unverified. The [provider's incoming SSL documentation](https://supabase.com/docs/guides/platform/ssl-enforcement) does not prove upstream encryption. No client verification was weakened. Source `service_role` privileges/provider default ACLs were inspected, not changed or cloned into the new target.

Local copying/separately loading a portable key is not a proven independent-machine/Linux recovery. Off-VM key escrow, off-VM archive durability, monitoring, actual certificate renewal, Linux ownership/cgroups/networking and real Docker SIGTERM/replacement remain unverified. Retention is configurable but **plan-only**, so no historical archive is deleted. Test workload success is not a production load/capacity measurement.

Production must use the same-policy compatible rollback image and an independently reviewed final backup. Live KMITL SSO, cookie/session continuity, disposable profile/policy/admin/CRUD canaries and exact cleanup require separate approval. After target writes begin, automatic fallback to the stale source would lose data; freeze and reconcile first. The active hosted application still uses its existing connection and grants.

## Separate readiness decisions

| Action | Decision | Evidence / remaining requirement |
| --- | --- | --- |
| Source-code review/local integration | **GO for review** | Main preserved; local checks/build/native recovery pass. No automatic merge/push; Linux CI still pending |
| Local self-hosted PostgreSQL | **GO native / NO-GO container acceptance** | Two independent PG17.11/TLS clusters and app persistence/restart/recovery pass; Docker/Compose actual execution unavailable |
| Database migration | **GO isolated / NO-GO production execution** | Exact0002 tested atomically, least-privilege migrator and account preservation verified; fresh frozen final backup/security preflight and explicit production approval remain mandatory |
| CloudStack staging deployment | **NO-GO** | Actual Linux Compose/certificates/permissions/lifecycle/resource and independent recovery verification still required, plus staging infrastructure approval |
| Production cutover | **NO-GO** | Staging acceptance, independent off-VM recovery, write freeze/final snapshot, rollback artifact, approved real SSO/application canaries/cleanup and explicit cutover permission |

Next approval should be limited to a **separate non-production Linux/Docker staging rehearsal**, or system-level Docker/WSL installation on an approved local machine if needed. It does not authorize production migration or cutover. After staging/recovery acceptance, obtain a distinct production approval naming the reviewed0002 hash, source write freeze/final export, target initialization/restore/access setup, secret delivery, connection/proxy cutover, disposable SSO/write canaries/cleanup and split-brain-safe rollback. None is executed by this report.
