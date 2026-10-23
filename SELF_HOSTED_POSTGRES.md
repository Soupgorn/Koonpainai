# Self-hosted PostgreSQL operations

This is a locally rehearsed proposal, not permission to deploy or change Supabase. The approved application remains Database-First: Auth.js/KMITL Keycloak, student-owned timetable CRUD, current sharing acknowledgement and account approval. No university timetable API, PDF/OCR, Supabase Auth or startup migrations are introduced.

See [POST_MERGE_READINESS.md](POST_MERGE_READINESS.md) for executed tests and remaining gates. Never substitute a successful synthetic OIDC test for live KMITL verification.

Latest execution: [LINUX_STAGING_VERIFICATION.md](LINUX_STAGING_VERIFICATION.md). Docker was installed on the owner-approved isolated Ubuntu VM. Actual Compose and cross-machine synthetic portable recovery were exercised. The earlier [readiness report](LINUX_STAGING_READINESS.md) remains historical evidence. Production migration and cutover are separate unapproved actions.

Latest follow-up: [RELEASE_READINESS.md](RELEASE_READINESS.md) records the sealed distinct-image rollback, fresh read-only account review and production gates. The owner defers offsite disaster recovery and accepts synthetic staging data loss only; this does not block private staging and does not waive production backups. The optional [ciphertext-only offsite helper](operations/release/offsite.PLAN.md) has Windows/Linux tests with mocked transport, but no destination is configured or contacted. Use the [manual CloudStack checklist](operations/release/firewall-review.PLAN.md) before requesting any network changes.

October 23: retained functional rehearsals remain PASS. After the owner's connectivity fix, five fresh key-only SSH checks over 147 seconds and current host diagnostics passed; an earlier failed probe remains recorded for monitoring. Rehearsal containers are intentionally removed, so this does not claim a running application stack. The network comparison and remaining edge/firewall review limits are in RELEASE_READINESS.md. No firewall reset, network change or service restart was performed.

## Services and version pins

`operations/selfhost/compose.yaml` separates the web service, PostgreSQL and opt-in operator tools. PostgreSQL is **17.11**, matching the inspected source major/version, pinned to `postgres:17.11-bookworm@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27`. The Node base is digest-pinned in both Dockerfiles. `npm ci` uses the committed lockfile; the managed launcher requires Next **16.4.2**. Review pins together before upgrading.

| Service | Access and lifecycle | Initial limits |
| --- | --- | --- |
| PostgreSQL | UID999, persistent named volume, internal network, **no published database port**, verified TLS/SCRAM, 60s stop grace | 512MiB, 1 CPU, 30 connections, 128 PIDs |
| Web | UID1001, read-only root, no capabilities, only five runtime files, loopback HTTP publication, external HTTPS reverse proxy, 40s stop grace | 1GiB, 1 CPU, max2 database clients, 128 PIDs |
| Operator tools | UID1002, opt-in `operations` profile, separate secrets, no web credential mount, bounded private `/work` tmpfs | 512MiB, 1 CPU, 64 PIDs |

PostgreSQL configuration enforces TLS1.3 minimum and SCRAM; SQL/parameter logging is disabled. The application and PostgreSQL tools require certificate **and hostname** validation. Supply a privately controlled CA and server certificate with SANs `postgres` and `localhost`; copy only its trusted public CA to web/operator directories. The private key stays in the database-only mount. Renew certificates before expiry. Never disable verification or use an IP absent from the certificate SAN.

`pg_isready` is a server-accepting-connections probe, not proof of a successful authenticated application query. Web readiness performs stricter role/TLS/account-RLS and forced-timetable-RLS checks. The ledger remains operator-only and is verified separately during preflight, not granted to web. Compose does not automatically replace an unhealthy service; monitor readiness and have the operator keep failed candidates out of proxy traffic.

### Connection budget

For self-hosting, PostgreSQL30 minus3 superuser-reserved minus2 reserved slots gives **25 ordinary slots**. One web process uses max2; old/new overlapping candidates use at most4. Reserve2 for a consistent backup (snapshot holder plus `pg_dump`),1 migration,2 operations and8 safety slots: **17 budgeted /25**, leaving8 additional ordinary slots. The runtime role has a cluster connection limit8, no membership in `pg_use_reserved_connections`, and cannot use reserved slots. A third concurrent web candidate is outside the planned rollout.

Client pools are not backend connection guarantees. The existing hosted Session Pooler settings (15 pool size, 200 clients) are not copied to self-hosted PostgreSQL. Neither setting makes 200 PostgreSQL backends available. Application bounds remain max2, acquire5s, SQL15s, client query16s, idle10s and lifetime300s. Operator pool max1; a backup intentionally uses a second libpq connection. `pool.end()` is awaited after HTTP draining. Reserve memory for the VM/OS/proxy and container overhead in addition to the service limits; size the VM from measured load, not these limits alone.

## Roles and trust model

| Identity | Purpose | Privileges |
| --- | --- | --- |
| `postgres` | Database administration, initial empty-target restore and backup | Superuser; never mounted into web |
| `koonpinai_migrator` | Explicitly approved schema changes | Owns application objects and ledger; CONNECT/CREATE on the application database; no superuser, BYPASSRLS, role creation, database creation, replication or memberships |
| `koonpinai_runtime` | Next/Auth.js/Drizzle account and timetable operations | CONNECT, public schema/type USAGE, exact SELECT/INSERT/column UPDATE grants, DELETE only on class entries; no DDL, ledger access, table ownership, memberships, account-role UPDATE or TRUNCATE |

`roles.sql` creates these roles **only on a new isolated self-hosted target**. The CLI derives SCRAM verifiers from distinct strong password files; it does not print passwords or accept them as arguments. It does not import Supabase roles/passwords. Public CONNECT/TEMP/CREATE is revoked for the application database. Runtime `search_path` is `pg_catalog,public`; migration `search_path` is `public,pg_catalog` so unqualified Drizzle DDL targets public. Only the trusted migrator may create in public. PostgreSQL documents the security significance of the [first schema in search_path](https://www.postgresql.org/docs/17/ddl-schemas.html).

`access` reconstructs only application ownership/grants after a `--no-owner --no-acl` restore. It transfers table/sequence/type/schema ownership to the migrator; restores the six account policies if absent; preserves existing policies; and grants exact reviewed runtime permissions. It sets database-local CONNECT/CREATE and migrator defaults on each restored database. PUBLIC receives no new table/sequence permissions; the migrator's **global** function EXECUTE default is revoked because a schema-local REVOKE cannot undo the global default. This applies only to the dedicated self-hosted role, not Supabase-managed roles.

The seven timetable policies remain enabled and forced. Server Actions derive the actor from an unrevoked Auth.js session, re-read eligibility, set transaction-local `app.member_id`/`app.policy_version`, and use explicit ownership predicates. An administrator cannot edit another student's timetable. Approved/current-policy viewers see only approved/current-policy targets. Pending timetables remain private; suspended actors cannot edit.

These settings are trusted-server context, **not authenticated PostgreSQL identities**. Anyone stealing the runtime credential can set the custom GUCs. RLS protects against missing context and query mistakes; server authentication and credential isolation are essential. Auth.js does not supply Supabase JWT claims or `auth.uid()`. The account role's INSERT policy permits only member/pending accounts; admin role assignment remains separately controlled.

## Secret delivery

No real secret belongs in this repository, Docker build context, image, Compose environment file, process arguments, report or Git. Do not point these examples at the existing production environment.

- Copy `compose-paths.EXAMPLE.conf` outside Git. It contains only external paths and reviewed image IDs. Review image IDs/content hashes before use; never roll a mutable `latest` tag.
- Database admin directory: root-controlled, readable only by UID999, containing `password`. PostgreSQL uses `POSTGRES_PASSWORD_FILE`, supported by the [official image](https://hub.docker.com/_/postgres).
- Database TLS directory: UID999 private directory, `server.key`0400, certificates readable by that service. Parent paths and host permissions must prevent untrusted modification.
- Web directory: UID1001, directory0700, files0400; **exactly** `koonpinai-runtime-manifest.json`, `database`, `auth`, `oidc`, `ca.crt`. Copy `runtime-manifest.EXAMPLE.json` under that runtime filename and replace all placeholders. It matches the image's default command. `database` contains only the dedicated role URL for the pinned endpoint; the loader rejects owner/migrator credentials and host/port/database drift.
- Operator directory: UID1002, directory0700, files0600/0400, separate admin/migrator config files and URL files, public CA, external backup key and initial role password files. Use `operator-config.EXAMPLE.json`; after bootstrap, remove its password-file references from ordinary backup/migration configs and deliver provisioning files only for an approved initialization. Do not reuse the admin password.
- Migration config changes `expectedRole` to `koonpinai_migrator`, points `urlFile` to its separate secret, and omits provisioning fields. The web container never mounts this directory or receives migration environment variables. No `.env` files enter the secret-free build/runtime bundle.

Use a secret manager or protected file editor/stdin-based provisioning on the target machine, with shell tracing disabled. Do not paste URLs/passwords into commands. A root operator controls initial host ownership, mounts and secrets. UID/group assumptions must be validated on the actual Linux host; Docker-daemon administrators are trusted operators, not an isolation boundary.

Windows development may use existing DPAPI formats or private text files. DPAPI payloads **cannot be used by Linux**. Deliver independently protected Linux text secret files through an approved channel; do not copy the Windows encrypted blob and expect it to decrypt. No active production secret or DATABASE_URL was changed in this work.

## Build and initialize a NEW isolated/staging target

These commands are examples for an explicitly approved **new target**. Linux/Docker execution was rehearsed on the isolated staging VM with synthetic data; Docker remains unavailable on the Windows workstation. No production permission is implied.

1. Build an immutable web artifact/image using `Dockerfile` and a reproducible source hash. Build tools with `docker build -f operations/selfhost/Dockerfile.tools --target tools -t <reviewed-tools-image> .`. The optional `verification` target adds test browsers; never deploy it as web/tools.
2. Prepare certificate and separate private secret directories above. Mount a genuinely independent encrypted-backup destination. Validate: `docker compose --env-file <paths-file> -f operations/selfhost/compose.yaml config --quiet`. Do not print rendered configuration containing secrets.
3. Start **only postgres**, wait for healthy state, and inspect private authenticated readiness. The private named volume must be writable by UID999. Never use `down --volumes` during upgrades/recovery.
4. Run `tools bootstrap --config=/run/operator/admin.json --approve-target=koonpinai`. The guard rejects existing app objects/provider schemas/roles. It creates roles/permissions but applies no migration.
5. Choose one path, never mix them:
   - **Empty installation:** use migrator config: `tools migrate --config=/run/operator/migration.json --approve-target=koonpinai --approve-through=0002`. Then admin `tools access --config=/run/operator/admin.json --approve-target=koonpinai` to set account grants/policies/ownership.
   - **Restore:** run `tools restore --config=/run/operator/admin.json --approve-target=koonpinai --approve-empty-target --backup=/backups/<approved-id>`. Then `access` with admin config. Review ledger; if it has only0000/0001, a separately approved `migrate --approve-through=0002` uses the migrator. Do not rewrite an existing API-first0002 ledger.
6. Run `audit` and independently verify runtime effective permissions, table counts/digests, ledger, forced RLS and policy definitions. Start web only after approval/validation; its readiness refuses a missing timetable migration. Confirm `/ready` on the private health port, `/live`, login and expected private redirects. Reverse proxy must forward only the canonical HTTPS host/proto, and route traffic only to ready instances.

Compose operational invocation prefix is `docker compose --env-file <paths-file> -f operations/selfhost/compose.yaml --profile operations run --rm tools`. Runtime/migration credentials are never interchangeable. There is **no** automatic schema change in web startup/health checks.

## Portable encrypted backups

The new `db:portable` CLI never loads dotenv. It requires a private, explicit operational JSON config that pins expected host/port/database/role and a private URL file. `source-readonly` configs can back up/audit the authorized source but cannot invoke bootstrap/access/migrate/restore. These commands do not replace previous DPAPI archives or the active account baseline.

```text
npm run db:portable -- keygen --key-file=<new-external-private-directory>/portable.backup-key.json
npm run db:portable -- backup --config=<private-config> --reason=scheduled
npm run db:portable -- verify --config=<private-config> --backup=<encrypted-archive-directory>
npm run db:portable -- replicate --config=<private-config> --backup=<archive> --replica-root=<independent-mount>
npm run db:portable -- retention --config=<private-config> --daily=7 --weekly=4 --monthly=3
```

`keygen` refuses an existing file. Preserve every key needed by retained archives; never overwrite/rotate away the only recovery key. Store a separately protected offline copy with a tested recovery operator. Keys are raw32-byte random secrets in a private JSON file, independent of Windows accounts. A lost key makes its encrypted archives unrecoverable. Test key delivery to an independent machine before production acceptance.

The implementation uses built-in Node crypto: streaming AES-256-GCM, unique random96-bit nonce, authenticated format header, authentication tag, HKDF-SHA256-separated archive/manifest keys, signed HMAC-SHA256 manifest and ciphertext/plaintext SHA256. Fingerprints use UTC timestamps and explicit C-collation ordering so host timezone/locale does not change the comparison. No paid service or external encryption package is required. Key buffers are cleared where practical; JavaScript/password strings and a running privileged process remain sensitive. Host disk encryption, protected swap and restricted debugging still matter.

Backup holds a repeatable-read **read-only exported snapshot**, computes complete-row UTC-normalized fingerprints/ledger/schema, and gives the same snapshot to PG17 `pg_dump` in custom format. Includes `public` and `drizzle`: every member/session/timetable field, identifiers/FKs, constraints, indexes, enums, RLS/policies, sequence state and migration ledger. Owner/ACL/security-label transfer is intentionally excluded: target access is separately rebuilt. Source requires a reviewed role able to read every row; no rows may be silently filtered by RLS. The present controlled backup path uses administrator/operator credentials only. No source passwords or roles are exported.

`pg_restore --list` validates structure before acceptance. The temporary plaintext dump lives in a private directory and is removed on completion/failure; Linux tools use private `/work` tmpfs for restore plaintext. Archives and signed manifests are encrypted/authenticated and timestamped. The directory must not be in Git. Restore first authenticates the entire ciphertext/plaintext hash, then uses one error-stopping transaction against a pinned, empty database. It refuses occupied targets and compares every table's count/full-row digest, exact ledger and schema/policy fingerprint afterward. Keep web stopped until grant reconstruction/verification succeeds.

Schema filtering is not a general dependency resolver. The guard rejects unexpected public/drizzle tables/views and application routines. Extensions/custom types/functions outside the approved application schema need explicit review; do not broaden filters or import Supabase platform schemas to make a restore pass. PostgreSQL explains [schema-filter and snapshot limitations](https://www.postgresql.org/docs/17/app-pgdump.html) and [transactional no-owner/no-acl restore](https://www.postgresql.org/docs/17/app-pgrestore.html). DDL/migrations must be frozen during a cutover backup; do not assume a row snapshot makes concurrent schema changes safe.

Scheduled/pre-migration CLI backups require a replica destination and verify the encrypted copy. A local directory copy is **not proof of off-VM storage**: verify the mount's remote failure domain, permissions, durability and a remote receipt independently. The local rehearsal proves authenticated copy/restore, not cloud storage delivery.

The sample systemd timer runs daily03:00 Asia/Bangkok with jitter. Install/enable only after staging validation and approval. Alert on failed/missing backups, replica or restore tests. Default retention selects the newest archive for each of7 daily,4 weekly and3 monthly buckets; pre-migration archives are always protected. Retention currently **reports candidates only**: no deletion is automated, and no previous backup is deleted. Approve a separate pruning policy only after off-VM and independent recovery are verified. Run an extra backup before each approved migration; periodically restore into a **new isolated database** and compare full fingerprints, not just archive existence.

## Supabase export/restore and cutover

Fresh source inspection is read-only. Do not activate or regenerate a security baseline to hide account changes. The approved historical backup is older than current live session/policy activity; it is a recovery rehearsal source, **not a final cutover snapshot**.

1. Obtain separate approval for production migration/cutover, a maintenance window, final read-only export, target initialization and disposable live SSO/application canaries with cleanup. Reconfirm source identity, CA/hostname, exact ledger prefix, migration hash, runtime catalog/grants/defaults/RLS, policy versions and account-security changes.
2. Freeze all source application writes/logins and stop/drain old web processes; verify no writers remain. Supabase stays available, protected and unchanged for recovery. Never have independent source/target applications accepting writes simultaneously.
3. Make a **fresh final consistent encrypted backup**, signed manifest and independently verified off-VM copy. Preserve historical backups, keys and active baseline. Check all data/roles/statuses/policy fields; unexpected security changes stop cutover. Do not reuse the historical2-member/4-session archive as current data.
4. On the new private target, initialize only required roles; restore without platform roles/ACLs. Rebuild target ownership/grants, compare full table/ledger/schema fingerprints, verify foreign keys/constraints/indexes/RLS and runtime credential denial tests. Apply reviewed0002 only after its separate approval if still pending; verify old account rows unchanged.
5. Deliver runtime-only target secrets for the reviewed artifact without replacing migration secrets or weakening acknowledgement requirements. Validate read-only readiness. Stage a candidate on a private port, keep the current healthy version available but source writes frozen. Match canonical OIDC callback/host and policy version.
6. Obtain/run approved disposable SSO canaries: login/session, profile, policy renewal, member/pending/admin approval and owner-only timetable mutations; explicitly revoke/delete only the exact disposable fixtures using reviewed admin cleanup. No real student editing. Synthetic local authentication is not this gate.
7. Switch proxy traffic only to the ready candidate, drain old requests and await pool closure. Record the exact first target write, freeze end, source/target counts/digests, health and secret/artifact IDs without secrets. Observe errors/connection usage and obtain independent acceptance before retiring any recovery source.

### Rollback without split-brain

- **Before target writes:** keep traffic frozen, stop failed candidate, restore the previous ready image/secret manifest and source connection, verify readiness, then explicitly unfreeze source. Original hosted grants/credentials were not changed here. Rehearse on staging; do not assume the previous image accepts a self-hosted manifest or the current policy.
- **After target writes:** freeze target traffic/writers first, take/verify a fresh target backup and preserve both sides. Prefer a same-policy application rollback against the **same current target database** or forward repair. Returning to stale Supabase would lose changes. Reconcile/export current target data into a separately approved source recovery plan before any source unfreeze. Do not automatically switch back or restore over an occupied database.
- Migration0002 DDL/ledger is atomic under advisory lock/timeouts. The existing empty-table Supabase rollback proposal pins owner assumptions; **do not reuse it blindly after migrator ownership transfer**. A populated timetable requires forward repair or a new verified empty recovery database, never automatic table drops or ledger edits. Database/role/volume deletion is not part of these tools.

## Ubuntu CloudStack staging checklist

Prepare an approved Ubuntu VM with supported Docker/Compose, security updates, host firewall and restricted SSH; no host PostgreSQL exposure. Install nothing on this workstation or live VM through this task. Configure canonical HTTPS reverse proxy and trusted forwarded headers; verify client TLS1.3/CA/SAN failures fail closed. Confirm persistent volume/UID permissions, disk space, resource limits, log rotation, time sync, egress for KMITL SSO, private backup mount and offline key escrow. Use a staging OIDC client/callback or approved canary, never copy real student data into public fixtures.

Run the prepared PR CI/container tests, then actual Compose initialization, authenticated health, timetable/security browser tests, database restart/persistence, failed candidate, graceful SIGTERM and rollback under traffic. Native Windows IPC-drain testing does not prove Linux signal/network/cgroup behavior. Rehearse recovery with a separately delivered key on another host. No automatic production deployment workflow is configured.

Supabase client-to-pooler TLS was validated. The source backend reported `pg_stat_ssl.ssl=false`; this is the observed database backend transport, not a client TLS failure. Provider private-network exposure/threat controls are not established by that row or by the [incoming SSL enforcement documentation](https://supabase.com/docs/guides/platform/ssl-enforcement). Obtain provider assurance if continuing hosted operations; do not claim end-to-end provider TLS or weaken the client to compensate. The proposed self-hosted app-to-PostgreSQL leg uses verified TLS even inside Docker.
