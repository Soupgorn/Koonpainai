# Linux staging execution — October 22, 2026

Execution is authorized only on the owner-confirmed isolated non-production VM `koonpinai-staging`, using synthetic data. Supabase production, real KMITL credentials, production migration0002, deployment, commit and push remain outside scope.

**Status: actual Compose and exact Linux verification-image regressions PASS. Production cutover remains NO-GO.** Final owned-resource cleanup is recorded below.

**October 23 restored-access verification:** five independent key-only SSH connections passed between 06:50:09 and 06:52:38 UTC, spanning 147 seconds between probe starts. Each matched the saved VM identity, found SSH/Docker/containerd active and passed `sshd -t`. One earlier bounded probe exited 255 before identity/service output; both immediate retries and the five-probe window succeeded. This is a bounded management-access result, not a continuous-availability claim.

The historical Compose tests below remain PASS evidence. Their containers were intentionally removed after rehearsal; there is no running application stack to health-check. A fresh `docker compose config --quiet` passed against the same Compose-file hash, without loading secrets or starting services. The candidate/rollback images, Linux and Windows archive hashes, saved test evidence and five preserved volumes remain intact. No new Compose rehearsal, deployment, production connection, networking change or service restart was performed.

The [network comparison](operations/release/firewall-review.PLAN.md#october-23-restored-access-comparison) records unchanged physical/local routes, UFW configuration, SSH policy and forwarding settings; an empty raw-table difference; a rewritten netplan file; and the limits of attributing the owner's manual fix. Current release status is in [RELEASE_READINESS.md](RELEASE_READINESS.md).

Follow-up evidence: [RELEASE_READINESS.md](RELEASE_READINESS.md) adds the actual distinct sealed-image rollback, fresh source/account review and manual CloudStack checks. The owner subsequently deferred offsite recovery for disposable staging data only. This report's original observations remain historical evidence; no original backup or account baseline was replaced.

## Environment and installation

The fresh SSH preflight reconfirmed Ubuntu26.04 Resolute/amd64,2 CPUs, approximately3.8GiB RAM and41GiB free storage. The hashed machine identity matched after installation. Key-based SSH and strict host-key checking were used throughout.

No production application/database service or disruptive bridge/tunnel dependency was found. Network routes, listeners, service/package inventory, sysctls, existing UFW configuration and firewall rulesets were preserved in a private execution directory before installation:

`/var/tmp/koonpinai-staging-20261022-44b0370b8b`

**Correction to the earlier readiness inventory:** the UFW service being enabled did not establish active filtering. The execution preflight found `Status: inactive` and empty iptables/nftables rulesets. That existing state was preserved; UFW was neither enabled nor disabled. Docker-managed bridge/forwarding rules were authorized; no manual UFW or CloudStack security-rule changes were made.

The installation used Docker's official signed HTTPS APT repository for resolute/amd64, checked its signing-key fingerprint and independently verified its signed InRelease metadata with `gpgv`. The simulated transaction rejected removals and unrelated installed-package replacements before installation. No convenience script, broad upgrade, insecure repository option or Docker-group membership was used.

| Package | Exact installed version |
| --- | --- |
| docker-ce / docker-ce-cli | `5:29.9.2-1~ubuntu.26.04~resolute` |
| containerd.io | `2.4.2-3~ubuntu.26.04~resolute` |
| docker-buildx-plugin | `0.38.1-1~ubuntu.26.04~resolute` |
| docker-compose-plugin | `5.6.1-1~ubuntu.26.04~resolute` |

Engine/client29.9.2, Compose5.6.1, healthy Docker/containerd, cgroupv2 and the overlayfs image store were verified. The signing-key fingerprint was `9DC858229FC7DD38854AE2D88D81803C0EBFCD88`; signed metadata SHA256 was `1920e4bdd935e64a848a465c0c663156aa4364562a62e182e72b1b834df94687`. Subsequent independent SSH connections succeeded.

The installation followed [Docker's Ubuntu guidance](https://docs.docker.com/engine/install/ubuntu/). Docker bridge/firewall behavior is documented [here](https://docs.docker.com/engine/network/packet-filtering-firewalls/); these changes are distinct from changing UFW configuration.

## Source and fixes

Branch `feat/selfhost-postmerge-1792639921257` remains based on merged main `69899885aaf32f692775df68da384511d7c99562`. Original unrelated work remains in `D:\Project\Koonpinai`; its43 recorded file fingerprints are checked separately. No production schema or migration history was edited.

The initial allowlisted source bundle contained224 files and had SHA256 `e4452759ac07fb13148985a72ef0b505fd9705410be6d5b94776fa8c3c3d3cda`. Environment files, private operational state, backups, keys, real PDFs, Git metadata and build/dependency directories were excluded. Subsequent reviewed fixes were transferred explicitly; the initial archive remains historical evidence rather than a claim that it contains the final fixes.

| Files | Observed issue and resolution |
| --- | --- |
| `package-lock.json` | Clean Linux installation rejected four missing optional WASM dependency records. Added only those records; every pre-existing package version, resolved URL and integrity value remains unchanged |
| `Dockerfile`, `next.config.ts` | Turbopack/compiler and TypeScript overlap did not reliably fit the bounded builder. Docker now uses Next16's supported Webpack worker with memory optimizations and a configurable384MiB Node heap; clean-build Turbopack disk-cache serialization is disabled. Type checking remains enabled |
| `scripts/package-runtime.mjs` | Packaging errors now expose allowlisted codes only. Existing environment, version, policy and no-symlink artifact guards remain intact |
| `operations/selfhost/Dockerfile.tools` | Debian already has an `operator` group. Use `koonpinai_operator`, retaining UID/GID1002. Include the two required SQL fixtures only in the verification target |
| `scripts/staging/fixture.ts`, `scripts/rehearse-selfhost-docker.mjs`, operator example | Correct PostgreSQL tool directory to `/usr/lib/postgresql/17/bin`; confirmed inside the pinned PostgreSQL image |
| `operations/selfhost/compose.yaml`, staging tests | Give read-only tools a private32MiB `/tmp` tmpfs for tsx IPC, retaining the separate128MiB `/work` tmpfs and read-only secret mounts |
| `scripts/rehearse-compose.ts`, `scripts/staging/probe.ts` | Keep the shutdown test's lock hold below the application's five-second lock timeout; avoid cold-tool startup in the blocked-request check; collect only sanitized lifecycle evidence; rediscover Docker's ephemeral loopback port after restart |
| `scripts/staging/fixture.ts`, `scripts/build-runtime-artifact.mjs`, staging tests | Replace locale-dependent sorting with code-point ordering. Windows and Linux now produce the same Compose source identity for the same bytes; a regression check rejects host collation |
| `operations/selfhost/Dockerfile.tools` verification target | Include synthetic authentication fixtures; bootstrap the CA package through signed APT metadata before HTTPS browser dependency downloads. Certificate verification stays enabled |
| `scripts/rehearse-selfhost.ts` | Put native test-cluster Unix sockets in their private writable fixture directory on Linux; preserve Windows' empty socket setting. The production Compose database configuration is unchanged |
| `scripts/rehearse-runtime-docker.mjs`, CI | Retire the duplicate shared-network-namespace fixture in favor of the actual Compose topology. Keep the old command as a compatibility entry point and remove its duplicate CI execution |
| Detached Compose lock probe, TLS regression test | Automatically remove the detached one-off container and its anonymous volume; clean newly created test TLS keys after closing the server |

The staging-only sudo wrapper forwards an exact allowlist of non-secret Compose image/path settings. It does not preserve arbitrary environment variables or forward credentials. The workspace uses an isolated npm home/cache. Initial npm9 rejected the original lock; npm11.6.2 installed it, and the stricter npm11.19.1 inside the production image confirmed the missing-record defect. The repaired lock passed that clean container installation.

## Actual Compose results

The final full rehearsal passed at **2026-10-22 17:51:32 Bangkok**. Execution log: `compose-attempt-10.log` in the private execution directory. Temporary source and recovery databases ran on independent PostgreSQL17.11 containers and named volumes.

| Requirement | Confirmed result |
| --- | --- |
| Production Next image | Compiled, type-checked, packaged and started using the real managed launcher; no preview bypass |
| Container identities/security | PostgreSQL UID999, web UID1001, tools UID1002; web read-only root, private runtime-only mount, dropped capabilities and configured memory/CPU/PID limits |
| Network/TLS | PostgreSQL has no published port; diagnostic HTTP is loopback-only; runtime authenticated with the exact dedicated role using verified TLS1.3 |
| Migrations |0000,0001,0002 applied only inside the isolated database; exact ledger/schema validated |
| Authorization | Profile/policy/session operations work; admin approval works; ordinary approval and role elevation fail; pending timetables stay private; administrators cannot edit another owner's classes |
| Timetable CRUD | Real restricted Drizzle Add/Edit/Delete, exact Friday08:45–10:15 and10:30–12:00, overlap confirmation and owner isolation pass |
| Persistence/recovery | Named-volume stop/start preserves full record digests and ledger; web becomes unhealthy during database outage and recovers afterward |
| Failed candidate | Wrong credential exits without taking traffic; the existing healthy instance remains available |
| SIGTERM | Real Compose signal drains a blocked authenticated SQL request, exits cleanly and closes every runtime backend |
| Restart/rollback | Same-image restart retains the encrypted session and timetable data; the test discovers the newly allocated ephemeral loopback port |
| Backup/restore | AES-GCM backup, separately delivered raw key, encrypted replica and independent fresh-container restore match complete records/schema/ledger; retention deletes nothing |
| Cleanup/logging | Exact synthetic-account cleanup and owned-resource teardown complete; generated passwords are absent from inspected container output and image history |

Application source pin: `b34eb423d75406548f2595e9ea239d958e092ea0ac5eefa5898980bcc19b59ce`.
Runtime artifact manifest SHA256: `fe0ef60fa408e95a7710723199b0fdd75c731eae76da342d0dfa0c533aaffcfd`.
Policy remains `2026-10-22-student-v3`. No schema migration runs on application startup.

The preceding successful run used the original locale-dependent pin. Final code-point source identity is `41ce8d886a709cfae548557c9685af1c4c681ea67041be5d5cb9b5f173a42b55`, verified equal on both operating systems. All 108 production build input files were also compared by individual SHA256 and matched; the identity correction does not represent a different UI or business implementation.

The earlier shutdown assertion was not evidence of a failed application drain. Sanitized lifecycle evidence confirmed `ready → draining → drained → ready`, clean exit and no container OOM; the failure was a connection to the old ephemeral port after restart. Earlier failed attempts and fixes remain preserved rather than replaced by the final passing log.

## Portable recovery outside the VM

A Linux-created **synthetic-only** backup was transferred as encrypted ciphertext to a new private directory outside Git on Windows. Its portable key was transferred separately into a different restricted directory. No real student backup, production credential or KMITL secret was transferred.

| Artifact | SHA256 |
| --- | --- |
| Signed manifest | `9007a464fdb1740c7df2ac7b0b6d1c89557d74923a728ea33f4bbace4af00978` |
| Encrypted archive | `5aac63b32b81eb210c926210986d2ef00f4be3d5e1578a0d473e31f9859953b4` |

The receiving PostgreSQL17.11 rehearsal passed at **17:42:51 Bangkok**:3 members,3 sessions,3 migration records and every timetable row/schema fingerprint matched. It also exercised the actual restricted repositories, Server Actions/browser checks and recovery guards. Temporary receiving clusters stopped and their working files were sealed. The portable archive/key remain separate and outside Git.

This is actual recovery outside the VM and across operating systems. The portable decryption uses the raw portable key, not Windows DPAPI. DPAPI sealing of temporary Windows working files is separate housekeeping. **Independent physical failure-domain storage, offsite durability and production key escrow have not been established.** No real source backup was tested on the staging VM. Retention remains non-destructive planning; no previous backup was deleted.

## Capacity and safeguards

The owner requires existing VS Code/Copilot processes to remain running. The VM initially had about1.8GiB available RAM and no swap. No editor process was stopped, VM resized or swap installed. A dedicated BuildKit container is limited to1,200MiB and one CPU with one build task at a time. The aggregate verification-only container is capped separately; production Compose service limits remain unchanged. Monitoring samples memory, CPU/load, disk and container statistics.

Two early OOM events were confined to the bounded build cgroup; kernel review found no global OOM event. The accepted Webpack build retained TypeScript validation. Its longer compilation time is preferable to weakening checks or consuming unbounded host memory. This is a functional rehearsal, not a50-student load test. Production images should be built in CI or a dedicated builder rather than alongside interactive editor sessions.

The proposed self-hosted connection budget remains25 ordinary slots after reservations; overlapping web pools4 + backup2 + migrator1 + operations2 + safety8 =17, leaving8 additional slots. No hosted pool setting or production connection string changed.

## Application regression checks

Windows TypeScript and ESLint pass. Unit/security tests: **67 PASS, 1 SKIP** (68 total); the skipped opt-in external database test was not pointed at production. Desktop/mobile browser tests: **34 PASS**, covering penguin branding, fonts, responsive navigation, themes, timetable interactions, accessibility and honest preview boundaries. GitHub CI is prepared but has not run; nothing was pushed.

The final secret-free Windows production build passed in `D:\Temp\Koonpinai-verification\final-artifact-20261022-44b0370b8b\artifact`: 1,781 files, source digest `995b4067d4ed0e466f3b6aea421ac2c83083f97fb6107d34dbac4c801fd06b2f`, artifact manifest `618c460bc30fcf77e18753d81d478ca452c2e5e7e1258056487c4bb80878ab13`. Artifact and Compose source digests have different input sets and are not interchangeable. An earlier repeated Windows build failed because drive C: filled; the successful repeat used a new D: directory and isolated npm/temp paths. Automatic approval review rejected removal of that failed C: scratch directory; it was left untouched.

The final `node scripts/rehearse-selfhost-docker.mjs` execution passed after building the exact verification target, with no source overlay: **12 authentication checks, 13 timetable/migration checks, 8 lifecycle checks, 4 real Server Action/browser checks and 9 recovery/security checks**. PostgreSQL initialization, TLS1.3, restricted roles, rollback/reapply, full-table restore comparison and cleanup ran in Linux containers. Its nested report says `docker:false` because that inner harness manages native PostgreSQL processes; the outer Docker helper supplied the Linux container. This is separate from the actual multi-container Compose rehearsal.

Linux host TypeScript/ESLint pass. Its Node22 unit run reports **66 PASS, 2 SKIP**: the opt-in external database case and a Node24-only artifact test. A separate Node24 Linux container ran all **6 lifecycle unit tests successfully**, including artifact integrity. After TLS fixture cleanup changed, the **7 database/TLS regression tests passed on both Windows and Linux**.

The compatibility command passed the actual Compose rehearsal with code-point source pin `41ce8d886a709cfae548557c9685af1c4c681ea67041be5d5cb9b5f173a42b55` and artifact manifest `58f7c49fb10b24e14177f9ee621775e69d5f7270243193fe206dd2ae43b713b9`. The final repeated run additionally checks that the detached-probe fix leaves no new anonymous volumes.

That final run **PASSed**, with zero new anonymous volumes and all pre-existing volumes preserved. `final-complete-status.json` records exit0 for Linux typecheck, lint, units, compatibility Compose and exact verification-image execution; `final-alias-status.json` records the final cleanup-regression success.

Rollback scope is explicit: Linux verifies failed-candidate isolation and same-artifact restart. The earlier Windows native rehearsal at **13:50:25 Bangkok** separately passed rollback between two distinct same-policy artifacts (`rollbackDistinctArtifact:true`); its shutdown used IPC. Linux supplies actual POSIX SIGTERM coverage. Neither proves compatibility with an unreviewed previous production release.

Production dependencies currently have0 npm advisories; the complete development tree has9 advisories (4 moderate,5 high), affecting development tools. No forced dependency fix or incompatible Next/Drizzle downgrade was attempted. Image/OS vulnerability scanning is not implied by an npm audit.

## Source accounts and preservation

This staging execution never connected to Supabase. The previously verified October 22 offline backup contains **2 members and 7 sessions**, compared with the active **2/4** reference. Offline comparison found no added/removed member, identity, administrator-role, approval-status or session-binding drift. Two existing members have timestamp/consent-field changes; three sessions were added and one existing session has a `revoked_at` change. These activity/consent differences still require provenance review; the report does not classify every change as an authorized logout or adopt them automatically.

The active baseline SHA256 remains `829fde1b69a786156f7376a9e269b1ce464a95462a9f4c5b5b16bd0802ca4e97`. The earlier verified backup manifest still matches `07d7683ca0b18a1bdeda1fd23a768023f58a2174b58ae12ee46552dcb157cfd0`. Original backups and account references are unchanged. Migration0002 still matches main's `3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a`; no SQL/migration-history change was needed here.

The fresh fetch still points `origin/main` to `69899885aaf32f692775df68da384511d7c99562`. All43 original file fingerprints are intact. The source scan found zero configured secret matches, private backup/credential artifacts or merge markers. Generated `next-env.d.ts` remains uncommitted. Nothing was committed, pushed or merged.

## Final host audit and cleanup

- **PASS:** matching VM identity; SSH, Docker and containerd remain active; Docker group has no added members.
- **PASS:** all11 original non-Docker IPv4/IPv6 routes across all routing tables match; UFW file hashes are unchanged. UFW remains inactive as found. Only authorized Docker-managed forwarding/bridge rules were introduced; no CloudStack firewall rule was changed or audited.
- **PASS:** no remaining container and no application, PostgreSQL or Docker TCP listener on the inspected service ports. Diagnostic HTTP was loopback-only throughout; PostgreSQL had no published port.
- **PASS:**673 monitoring samples; lowest observed available RAM504MiB, lowest free disk22.5GiB. After builder removal, about1.68GiB RAM and33.1GiB disk were available. Two early builder-cgroup OOM events, zero global OOM events. Existing editors were not terminated.
- **PASS:** removed the dedicated Buildx builder/cache, eight marker/log-verified Compose fixture directories, three legacy fixture directories and the temporary exported synthetic key copy. Original Windows backups and the separately stored portable receiver archive/key remain intact.
- **PASS:**160 generated secret values checked across125 private logs, zero matches. No credential-bearing evidence directory was exported wholesale.
- **Preserved:** five unattached anonymous volumes were verified empty and left untouched because reliable per-volume ownership labels were unavailable. They contain no database records. The corrected final probe created none. Stopped, credential-free test images and private source/log evidence are retained for review.

The route audit initially compared the full original inventory with only the current main routing table. Repeating the exact IPv4/IPv6/all-table scope confirmed all11 physical/local routes unchanged; no network setting was adjusted to obtain that result.

Private evidence is retained at `/var/tmp/koonpinai-staging-20261022-44b0370b8b` and copied into the worktree's ignored `.private/linux-staging-evidence-20261022` directory. Relevant records include installation/preflight, final suite and alias statuses, exact native/Compose logs, `final-host-audit.json`, cleanup reports and resource samples. Historical failed attempts remain on the VM. No production data is in that evidence.

| Assessment | Result |
| --- | --- |
| Source and local application | **GO for review**, checks/build pass; changes remain uncommitted and remote CI unexecuted |
| Isolated self-hosted PostgreSQL17 | **GO**, migrations, RLS, grants, persistence, CRUD and portable restore verified |
| CloudStack private synthetic staging | **GO — executed successfully**, stopped and cleaned up |
| Production migration0002 | **NO-GO**, no production execution approval or fresh final source preflight/write freeze |
| Production cutover | **NO-GO**, remaining requirements below |

## Production boundaries

Production cutover remains **NO-GO** pending fresh authorized source/security/ledger and account-lifecycle review, a final consistent frozen backup, approved real-data handling, durable independent backup/key custody, accepted rollout/rollback artifacts and separately authorized live KMITL/application write canaries with exact cleanup. Existing consent values must not be upgraded silently. UFW was already inactive; a reviewed host/CloudStack firewall policy is required before any public production deployment. No public service was deployed here.

Live KMITL SSO was not configured or tested. Mocked OIDC and synthetic encrypted sessions are labelled as such. Migration0002 was executed only in disposable databases. Nothing in this report authorizes production changes, commit, push or deployment.
