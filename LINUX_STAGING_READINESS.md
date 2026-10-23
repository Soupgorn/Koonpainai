# Linux staging readiness — October 22, 2026

**Historical pre-installation assessment.** The owner subsequently authorized Docker installation and synthetic-only rehearsal. [LINUX_STAGING_VERIFICATION.md](LINUX_STAGING_VERIFICATION.md) supersedes this document's environment availability, execution status and staging approval request. Findings below describe the earlier read-only inspection; they are preserved rather than rewritten. Production cutover remains NO-GO.

This report supersedes the environment-availability and test-count sections of the earlier [post-merge report](POST_MERGE_READINESS.md). Earlier evidence remains preserved. [Self-hosting operations](SELF_HOSTED_POSTGRES.md) describes the proposed architecture; neither document authorizes deployment.

## Source and preservation

- Worktree: `D:\Project\Koonpinai-selfhost-1792639921257`.
- Branch: `feat/selfhost-postmerge-1792639921257`.
- HEAD and freshly fetched `origin/main`: `69899885aaf32f692775df68da384511d7c99562`; intended merged main is still the ancestor. No history was rewritten.
- All 43 original modified/untracked file fingerprints in `D:\Project\Koonpinai` remain unchanged. Generated `next-env.d.ts` changes remain uncommitted.
- No commit, push, production migration, live SSO write canary or cutover was performed.

## Read-only Ubuntu inspection

SSH used key authentication, batch mode, strict host-key checking and bounded timeouts. Final inventory: **2026-10-22 13:54:55 Bangkok**.

| Item | Observed result |
| --- | --- |
| OS / architecture | Ubuntu 26.04 Resolute / x86_64 |
| CPU / memory | 2 CPUs; approximately 3.8 GiB RAM |
| Root filesystem | Approximately 47.3 GiB total / 41.3 GiB available |
| Host tools | Node 22.22.1, npm 9.2.0, OpenSSL 3.5.5 |
| Docker / Podman | Neither installed |
| Visible application/database listeners | None on 80, 443, 3000, 5432, 55435 or 55436 |
| Visible application/database services | No Docker, Podman, PostgreSQL, nginx, Apache or Koonpinai running service |
| SSH identity | Nonroot; earlier read-only sudo-policy query succeeded |
| Production use | **Not established**; owner confirmation required before staging writes |

UFW was enabled in the earlier read-only service check. This is not a CloudStack security-group audit or proof that no other workload exists. No elevated installation or service operation was executed. Private local evidence: `.private/staging-environment-readonly.json`.

Docker's [official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/) list Ubuntu 26.04 and amd64 as supported. Docker creates bridge/firewall rules and may enable forwarding; published ports can bypass UFW. See [Docker firewall behavior](https://docs.docker.com/engine/network/packet-filtering-firewalls/). Approval must cover Docker-managed networking. Do not disable firewall management, weaken TLS or publish PostgreSQL as a workaround.

## Implementation completed locally

| Files | Change |
| --- | --- |
| `scripts/rehearse-compose.ts` | Rehearses the actual production Compose definition; rejects remote Docker contexts; explicit isolated-write opt-in |
| `scripts/staging/fixture.ts` | Private synthetic fixtures, independent projects/credentials, complete production-input build pin, mount/network ownership guards |
| `scripts/staging/probe.ts` | Real Drizzle account/session/policy/admin/timetable exercises and exact identity cleanup; no live SSO or dotenv |
| `scripts/rehearse-selfhost.ts` | Runs the same probe natively, including wrong-marker, tampered-cleanup and repeated-cleanup rejection |
| `scripts/portable/crypto.ts` | Fixes external-path validation across Windows drives; encryption format and backup compatibility unchanged |
| `tests/staging.test.ts`, `tests/portable-backup.test.ts` | Fixture separation, actual Compose contract, source-pin invalidation and cross-drive regressions |
| `operations/selfhost/compose.yaml` | Configurable loopback web port for ephemeral rehearsal ports; default3000 unchanged; no PostgreSQL publication |
| `package.json`, `.github/workflows/verify.yml` | Adds `test:staging:compose` and a PR-only synthetic job; no deployment or production secrets |

No dependency was added. Original schema and migration files remain unchanged from main. Web mounts only its five runtime files; migration/admin secrets remain separate.

The new Compose harness builds production images, creates two independent PG17.11 services/volumes, applies migrations only to synthetic data, verifies least privilege, exercises persistent CRUD, creates an encrypted replica, restores it into the independent target, compares all records/schema/ledger, and checks UID/mount/resource settings, outage/restart, SIGTERM drain, rejected candidate and same-image restart. Both output streams are checked for generated passwords; cleanup checks ownership and removes only its new labelled resources. Docker-specific checks are **implemented, not executed**. Native probe success does not establish container compatibility.

## Fresh verification results

| Check | Result and scope |
| --- | --- |
| TypeScript / ESLint | PASS |
| Unit/security/TLS | **67 PASS, 1 SKIP**,68 total with `RUN_DATABASE_TLS_TESTS=true`; skipped opt-in database test never connects to production |
| Desktop/mobile browser suite | **34 PASS**: Penguin, Cloud & Sky, Light/Dark/System, accessibility checks and editor; fictional preview |
| Production build/package | PASS, Next16.4.2, secret-free standalone artifact |
| Production authentication smoke | PASS with fixture configuration; callbacks/cookies/private routes/host checks; no live KMITL login |
| Isolated account integration |12 groups PASS, real restricted Drizzle/PostgreSQL, mocked OIDC |
| Timetable/migration/security |13 groups PASS: exact times, overlaps, ownership/admin isolation, forced RLS, atomic failure and guarded rollback/reapply |
| Native lifecycle |9 groups PASS: pool exhaustion/acquisition, SQL cancellation, failed candidate, active-request drain, closed connections, distinct same-policy artifact rollback |
| Built app + database browser |4 groups PASS: real Server Actions persist/reload CRUD; pending/peer/privacy/session checks and exact cleanup |
| Additional Compose probe | PASS natively over verified TLS1.3, including marker/mutation/cleanup guards |
| Fresh installation |0000–0002 apply as non-superuser migrator; repeat is a no-op; safe future table/function defaults |
| Restart/persistence | PASS on independent native PG17.11 clusters; full records survive restart; pool obtains a new verified TLS connection |
| Portable recovery | PASS: AES-GCM, separate raw keys, replica integrity, tamper/non-empty-target rejection and full-row/schema/ledger equality |
| Historical/latest source backup restores | PASS:2 members/4 sessions and2 members/7 sessions; isolated0002 preserves accounts |
| Actual Compose / other Docker helpers | **NOT RUN / unavailable**, explicit nonzero status; Docker absent locally and remotely |
| PR CI | Prepared, not executed; no push |

Native rehearsal passed at **13:50:25 Bangkok**: `.private/selfhost-rehearsal-1792651879579.json`. Both clusters stopped; temporary working database files sealed. Portable archives remain encrypted outside Git, keys in a separate restricted directory, original backup inventory unchanged. Windows shutdown uses IPC to invoke the production handler: **POSIX SIGTERM is not verified**. Distinct-artifact rollback is local/same-policy, not an actual production rollback.

Final application artifact outside Git:

```text
C:\Users\supakorn\AppData\Local\Temp\koonpinai-artifact-3beb1419-da6d-42a0-8145-3e9c50203df2\artifact
source SHA256:   82557e597203eb87899696442ccb1f3654f3b197dbaa1309a0556334bed28803
manifest SHA256: 27498ffcb5ecc5339483522821ff47121a225d807b69747ce4dd01d653bfaf14
```

This application pin does not pin the separate tools source. Review the complete diff and tools image before deployment. Policy `2026-10-22-student-v3` stays mandatory; existing acknowledgements were not changed.

## Backup portability and limits

A 4,177-byte synthetic payload encrypted with the actual Windows encoder was sent over SSH stdin to an in-memory Ubuntu Node process. Ubuntu independently verified HKDF/HMAC, AES-256-GCM decryption and plaintext SHA256, and rejected tampering/wrong key. PASS at **13:49:32 Bangkok**. No remote files, real account data, backup, real key, password or university token were transferred. Private report: `.private/linux-crypto-readonly.json`.

This proves encryption-format compatibility only. **Linux PostgreSQL restore, independent-machine full backup recovery and off-VM disaster recovery remain unverified.** Native portable restores use raw keys, not DPAPI; Windows temporary-file sealing is separate housekeeping. No remote backup timer was enabled. Retention tests cover 7 daily / 4 weekly / 3 monthly and protected migration backups, but retention is plan-only and deletes nothing. Off-VM archive durability, independent key escrow, monitoring and approved retention enforcement remain operational gates.

## Account baseline review — no adoption

Offline comparison used the verified active October21 20:23:26 Bangkok snapshot (2/4) and October22 11:32:15 Bangkok backup (2/7). It did not query production or establish current live counts. Active-reference/proposal hashes and both backup integrity checks passed.

| Category | Difference |
| --- | --- |
| Members added / removed |0/0 |
| Existing members modified |2 |
| Changed member fields | `last_login_at`:2; `updated_at`:2; `policy_accepted_at`:2; `profile_completed_at`:1; `policy_version`:1 |
| Sessions added / removed |3/0 |
| Existing sessions changed |1, `revoked_at` only |
| Identity, administrator role, approval and session-binding invariants | PASS; no changes detected |
| Provenance / consent review | **REVIEW REQUIRED**; plausible lifecycle activity is not proof of authorized SSO or acceptance |

Prior owner confirmation of repeat sign-in is relevant but does not automatically authorize every session/consent transition/revocation. No baseline replacement or consent upgrade occurred. Aggregate-only evidence: `.private/account-baseline-offline-comparison.json`. Fresh production security preflight and separate lifecycle review remain necessary before production operations.

## Staging prerequisites and commands — not executed

1. Obtain confirmation that `koonpinai-staging` is non-production and approval for Docker installation, services and **synthetic-only** containers/networking. Real backup/key/credential transfers are excluded.
2. Use Docker's signed Ubuntu repository; review/record exact resolute/amd64 package versions. Existing Node meets `>=22.13`; verify Git/curl/OpenSSL. No broad upgrades, `curl | sh`, UFW or CloudStack rule changes.
3. After approval only, configure the official repository and use:

   ```sh
   apt-cache madison docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   # Record/review all five versions first. No automatic latest-version selection.
   sudo apt-get install --no-install-recommends \
     "docker-ce=${DOCKER_ENGINE_VERSION:?review exact version}" \
     "docker-ce-cli=${DOCKER_CLI_VERSION:?review exact version}" \
     "containerd.io=${CONTAINERD_VERSION:?review exact version}" \
     "docker-buildx-plugin=${BUILDX_VERSION:?review exact version}" \
     "docker-compose-plugin=${COMPOSE_VERSION:?review exact version}"
   sudo docker version
   sudo docker compose version
   ```

   Docker startup can change forwarding and Docker-managed firewall rules. Review these effects without manually changing UFW/CloudStack rules. Prefer existing sudo access over permanent root-equivalent Docker-group membership. The harness requires a local rootful Linux Unix-socket engine.

4. Deliver an allowlisted source archive to a new mode-0700 staging workspace. Include reviewed uncommitted files: `git archive HEAD` alone would omit them. Exclude `.env*` secrets, `.private`, real backups/keys, `node_modules`, caches and unrelated work. Verify archive hashes at both ends. Install lockfile dependencies there as nonroot with `npm ci --ignore-scripts --no-audit --no-fund`; never use real SSO credentials.
5. With approved local Docker privileges, run sequentially:

   ```sh
   npm run typecheck
   npm run lint
   RUN_DATABASE_TLS_TESTS=true npm test
   npm run test:selfhost:docker
   node scripts/rehearse-runtime-docker.mjs
   npm run test:staging:compose
   ```

   These create temporary test resources, not production services. Exact Compose generates independent passwords/certificates/markers/accounts; only ephemeral loopback HTTP is published, never PostgreSQL. Cleanup targets only its random labelled projects. Never use generic `compose down -v` on a real deployment.

6. Record actual UID/mount/network/cgroup behavior, memory/disk peaks, OOM/restart events, fresh-instance restore, SIGTERM, candidate rejection and rollback. With 3.8 GiB RAM, avoid simultaneous builds/rehearsals; capacity is not yet load-tested. Do not silently add swap, resize the VM or alter limits.
7. Later approve an independent recovery machine plus separate archive/key delivery. Use synthetic data until real backup handling is approved. Verify full-row/schema/ledger/privilege equality; same-host replicas do not establish disaster recovery.

## Security and capacity

- Runtime max2/process. Proposed PostgreSQL30 minus3 superuser/2 reserved =25 ordinary slots. Overlapping web4 + backup2 + migrator1 + operations2 + safety8 =17 budgeted,8 extra. This is a connection budget, not measured VM performance. Hosted settings unchanged.
- Runtime/migrator/admin are separate; no startup migrations. Readiness rejects unsafe roles or missing forced-RLS timetable tables. Identity comes from Auth.js/server context, not `auth.uid()`; shared runtime credentials remain trusted server credentials. Real Drizzle/Server Action owner/admin tests pass.
- Source client-to-pooler certificate/hostname validation remains mandatory. Historical source evidence reported an unencrypted provider-managed backend leg, separate from client TLS. No new provider assurance was obtained and no verification weakened.
- Snapshot ledger contains0000/0001. Unchanged Database-First0002 passed isolated rollback/reapply; SHA256 `3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a`. Production0002 was not applied. Future frozen snapshot/ledger preflight remains mandatory.
- Source scans found no merge markers, private environment/backup artifacts or configured secret matches. This does not prove absence of unknown secrets or safety of images not yet tested on Linux.

## Separate decisions and approval boundaries

| Action | Assessment |
| --- | --- |
| Source review / native database and recovery | **GO for review**, checks pass; uncommitted |
| Read-only Ubuntu inspection | **COMPLETE**, no remote changes |
| Linux/Docker staging execution | **NO-GO** pending installation/test approval, non-production confirmation and actual results |
| Production migration0002 | **NO-GO**, isolated verification only; no production authorization |
| Production cutover | **NO-GO**, Linux acceptance, off-VM recovery, lifecycle/consent review, frozen backup, approved live SSO/write canaries/cleanup and reviewed rollback remain |

Next approval: install reviewed Docker prerequisites on the confirmed non-production VM and run synthetic-only isolated rehearsals, including Docker-managed private networks and labelled-resource cleanup. Excludes real backups/keys/credentials, live SSO, source writes, production0002, active connection changes, production deployment, commit and push.
