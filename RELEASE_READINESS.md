# Release readiness — October 22, 2026

**Private staging functional verification: PASS (retained rehearsal evidence). Restored management-access checks: PASS in the measured window. Application stack: intentionally stopped. Production migration: NO-GO. Production cutover: NO-GO.** This report supersedes older staging blockers only where fresh evidence is recorded. It does not authorize deployment, baseline adoption, production writes or Git publication.

The owner explicitly accepts loss of disposable staging data and defers offsite disaster-recovery testing. No destination is approved and none was configured/contacted. This acceptance does **not** cover Supabase production data or a future production deployment.

October 23 restored-access follow-up: the owner repaired SSH connectivity. Five independent strict-host-key, public-key-only probes passed over 147 seconds at 06:50–06:52 UTC, with matching VM identity, active SSH/Docker/containerd and valid SSH configuration. One earlier bounded probe exited 255 before identity/service output; immediate default/strict retries and the measured window succeeded. Retain that failure and monitor recurrence; these checks establish a passing window, not continuous reliability.

The same 11 physical/local routes, UFW files, forwarding sysctls and previously recorded SSH policy remain unchanged. IPv4 firewall comparison differs only by absent empty ACCEPT raw-table chains after counter normalization; IPv6 rules match. The VM rebooted at 05:15:43 UTC, now has about 7.8 GiB RAM, and netplan was rewritten at 05:47:58 UTC. The original netplan/DNS configuration and CloudStack change history were not saved, so exact manual-fix attribution is unknown. No observed difference broadens host filtering; the pre-existing inactive UFW, password-enabled SSH and unaudited CloudStack edge controls remain review items. See the [current comparison](operations/release/firewall-review.PLAN.md#october-23-restored-access-comparison).

No host PostgreSQL listener or Docker port publication exists. The VM has only its private IPv4 and link-local IPv6 addresses. This confirms host-side non-exposure of 5432; independent public-edge/NAT/security-group verification remains unavailable.

## Source and preservation

- Worktree: `D:\Project\Koonpinai-selfhost-1792639921257`; branch `feat/selfhost-postmerge-1792639921257`.
- HEAD and freshly fetched `origin/main`: `69899885aaf32f692775df68da384511d7c99562`. Main remains authoritative; no new commits, push, merge or deployment occurred.
- The original checkout's43 recorded modified/untracked files are independently fingerprinted. They are not imported into this branch. Its active account baseline and all previous backups remain unchanged.
- The unrelated generated `next-env.d.ts` diff remains uncommitted and excluded from the proposed PR file list.
- Penguin branding, Cloud & Sky styling, responsive navigation, light/dark/system themes, Auth.js/KMITL, approval/consent and student-owned timetable CRUD remain intact. No API provider, PDF/OCR or Supabase Auth was reintroduced.

## Fresh staging verification

The full Linux installation/build/database evidence remains in [LINUX_STAGING_VERIFICATION.md](LINUX_STAGING_VERIFICATION.md). Its24 previously copied evidence artifacts retain their checksum record. The follow-up execution directory is the same private, owner-confirmed isolated VM workspace:

`/var/tmp/koonpinai-staging-20261022-44b0370b8b`

The **new exact sealed-image Compose rehearsal passed at2026-10-22T16:08:50.428Z** (`release-pair-retry.log`). It validates:

| Check | Actual result |
| --- | --- |
| PostgreSQL17.11, migrations0000–0002 | PASS; isolated only, exact schema/ledger, constraints and grants |
| Restricted runtime/RLS | PASS; pending privacy, ordinary-role denial, owner-only CRUD, no administrator cross-owner editing |
| Account operations | PASS; profile, renewed policy, session revocation and administrator approval using synthetic identities |
| Timetable | PASS; exact Friday08:45–10:15 /10:30–12:00, overlap confirmation, database-backed rendering |
| Persistence/outage | PASS; full-record/ledger digests survive volume restart; readiness fails during outage then recovers |
| SIGTERM | PASS; active authenticated SQL request drains, clean exit and zero remaining runtime backends |
| Failed candidate | PASS; wrong-credential candidate exits without replacing the healthy instance |
| Image rollback | PASS; **distinct sealed same-policy rollback image** starts healthy against the same database and preserves encrypted session, every record and ledger |
| Portable recovery | PASS; independently restored PostgreSQL container/volume matches full records/schema/ledger; no DPAPI dependency |
| Container security | PASS; web UID1001, PostgreSQL999, tools1002, read-only web root, dropped capabilities, bounded resources, runtime-only secret mount, private PG network, loopback-only diagnostic HTTP |

The first new image-pair run exposed EACCES when the SSH operator tried to update the synthetic manifest owned by the web UID. The fix preserves0700/0600 isolation and uses the already-authorized bounded sudo operator, validates the fixture marker/path/old artifact pin and changes only the fixture's public artifact pin. Its failure log is retained; it is not hidden by the passing retry.

Final independent SSH audit at2026-10-22T16:18:34Z (October23 Bangkok) found zero containers, only Docker's default networks, the same five preserved volumes, healthy SSH/Docker, no PostgreSQL/app listeners and zero generated-secret matches in the new rehearsal logs (20 fixture values checked). Available RAM was approximately3.16GiB and disk32.9GiB. The earlier bounded build attempts recorded two container-limit OOM events and zero host-wide OOM events; the final successful builds/rehearsals are recorded separately. Protected fixture backups/keys and evidence remain preserved; no unowned volume, original backup or C: scratch directory was deleted.

**Subsequent connectivity limitation:** copying the new follow-up logs to Windows failed when SSH connectivity timed out before authentication; an independent SSH retry also timed out. The successful execution/audit above was captured through SSH before that loss of connectivity. The follow-up files remained on the VM at that time. On October 23, nine explicit release evidence files were recovered to the ignored local evidence directory and every copied SHA256 matched the VM; the previous evidence/checksum record was preserved. This does not establish a VM/service/firewall failure, but present management reachability must be rechecked after the required network/VPN is restored. No network or firewall change was attempted. Private staging GO refers to the completed synthetic verification, not a claim of continuous current reachability.

Synthetic OIDC/session fixtures are **not live KMITL SSO verification**. Read-only provider discovery succeeded, matched the official endpoints and advertised S256/code flow; real client/callback/login testing remains unexecuted.

## Immutable image pair

`scripts/release-images.ts` deep-verifies the actual runtime artifact/files, source pin, nonroot launcher, environment allowlist and policy before exporting. Exported archives were hashed, reloaded on Linux and independently verified after copying to a private Windows directory. No registry push or public service was used.

| Artifact | Pin |
| --- | --- |
| Candidate image ID | `sha256:4cf57217fd3b8758dc54ba2b7ec1421b0276d353f06fb325206986e9b672cb7d` |
| Candidate source | `41ce8d886a709cfae548557c9685af1c4c681ea67041be5d5cb9b5f173a42b55` |
| Candidate runtime manifest | `58f7c49fb10b24e14177f9ee621775e69d5f7270243193fe206dd2ae43b713b9` |
| Candidate archive SHA256 | `03da3de719957051186ba637ae9d4ff4d47b296c3ddcc51532163bac4ca24fcc` |
| Rollback image ID | `sha256:3287c8e5911eee67fe1b5c83ea5d765de827058486e9e7e27d94e6e9eb77d79d` |
| Rollback runtime manifest | `fe0ef60fa408e95a7710723199b0fdd75c731eae76da342d0dfa0c533aaffcfd` |
| Rollback archive SHA256 | `65ed355f06fff2fb82d60d38a6fd18c73113095169a39774d78873da9a504872` |

Both archives are105,946,112 bytes. Linux: `/var/tmp/koonpinai-release-20261022-44b0370b8b`; independent Windows copy: `D:\Artifacts\Koonpinai\release-20261022-44b0370b8b`. Both include `release-pair.json`; neither is in Git. Restricted file ownership/permissions were checked. The archives preserve the exact reviewed output: **byte-identical rebuilding has not been proven**, and is not needed to reload/promote these verified bytes. The sealed rollback is an earlier accepted staging build with the same policy, not an independently identified old production artifact. Operational additions after sealing do not change the108 production build input hashes/source pin.

All image manifests/blobs and16 image layers were scanned for six known configured secret values: zero matches. No image layers were extracted onto disk by that scanner. This is a known-secret scan, not a claim of exhaustive vulnerability or unknown-secret detection.

October23 Git-byte audit: `core.autocrlf=true` normalizes92 of108 current production inputs when stored in Git. The sealed pair is verified against the exact current working-tree snapshot; it is not yet a final committed-release build. After commit approval, build/rehearse from the clean exact committed tree and record commit/image/archive/manifest pins before production promotion. A changed raw source pin after LF normalization must be reviewed, not bypassed. No Git objects/index or source line endings were changed by this read-only hash comparison.

## Account and consent review

Fresh production investigation was **read-only** at2026-10-22T15:49:29.104Z, with certificate/hostname verification, bounded read-only transaction and rollback. It found PostgreSQL17.11, only0000/0001 in the matching migration ledger,2 members and7 sessions. No identity, administrator-role or approval-status changes relative to the approved reference were found; anon/authenticated effective unsafe account grants were zero. The dedicated role retains LOGIN and none of SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION. This is not an exhaustive fresh comparison of every production catalog object; execution still requires full scoped preflight.

The independently verified backup comparison against the active2-member/4-session baseline finds:

- No added/deleted members or changed administrator/approval/identity fields. Both members remain administrators; the owner explicitly authorized the second account's designation and reports SQL Editor/another SQL client as the mechanism. Independent provider SQL audit evidence is unavailable.
- Three added sessions, all linked to existing members; one existing session changed only in `revoked_at`. No sessions were removed.
- Both members changed login/update and policy-acceptance timestamps; one changed profile-completion time and one policy version. These field changes are observed facts. The owner's earlier confirmation of signing in again supports some activity, but does not independently attribute every session, revocation or consent transition. No conclusion of unauthorized access is made.
- Current main and working tree both require `2026-10-22-student-v3`. One member has accepted it; one still stores `2026-10-21` and must renew before shared access, including administrators. The historical committed21/API-v2 code mismatch is superseded; no stored acknowledgement was rewritten.

Routine provenance remains REVIEW_REQUIRED, distinct from the passing role/identity invariants. The baseline was **not** updated. Its SHA256 stays `829fde1b69a786156f7376a9e269b1ce464a95462a9f4c5b5b16bd0802ca4e97`. Private sanitized evidence: `.private/release-account-comparison.json` and `.private/release-source-assessment.json`. Original backups/manifests and historical account-review evidence remain preserved.

## Backup portability and deferred offsite work

Previous Linux→Windows synthetic archive/key transfer and isolated native restore passed, as recorded in the staging report. That is a one-time cross-machine recovery result, **not proof of an approved durable offsite service or automated disaster recovery**.

New `scripts/portable/offsite.ts` / `scripts/offsite-backup.ts` prepare an explicit synthetic-only ciphertext transfer and independent retrieval boundary. No destination is activated. Tests on Windows and Linux use a mocked SSH/SCP transport, actual authenticated encryption and source-archive deletion before retrieval. They verify destination/host checks, injection rejection, no key upload, overwrite refusal and tamper detection. Live offsite delivery remains deferred by owner instruction.

For future separately approved nonproduction testing, see [offsite tooling](operations/release/offsite.PLAN.md). Production backups still need a separately approved independent failure domain, separately protected keys, durable delivery and actual restore testing. Existing retention remains a7-daily/4-weekly/3-monthly **selection-only** policy; no prior backups were pruned.

## Network, provider and retained-resource risks

The [manual CloudStack Dashboard checklist](operations/release/firewall-review.PLAN.md) distinguishes verified host state from unverified edge rules. Host UFW is inactive and SSH permits password authentication; both are proposals for later scoped hardening, not changes made in this run. Only SSH22 remains externally bound after teardown; PostgreSQL and Docker API are not published. Public deployment remains blocked pending actual edge/HTTPS review.

Client→Supabase Session Pooler TLS remains certificate/hostname-validated. Source `pg_stat_ssl` reports the provider-managed backend leg as not using PostgreSQL SSL. That is a confirmed observation about that connection, not proof of public plaintext or absence of provider lower-layer encryption. Provider-managed transport guarantees remain unverified; ask Supabase for project/region-specific clarification. The independent self-hosted path was actually tested with TLS1.3 and validated CA/SAN, avoiding reliance on that hosted hop.

Five anonymous Docker volumes remain untouched: prefixes `4a8274cd`, `5f00af81`, `9fa51ac6`, `0876ec98`, `e608c6fc`. Only anonymous labels exist;125 retained logs/JSON did not independently attribute them. Their timestamps and old PostgreSQL tool probes suggest a cause but do not establish ownership. No deletion is recommended without attribution.

The failed C: scratch build `C:\Users\supakorn\AppData\Local\Temp\koonpinai-artifact-0510925c-0495-404b-95fd-bb67a7b8797a` remains intact. Its exact path/time matches the recorded failed ENOSPC build, distinguishing it from unattributed volumes. Preservation remains the instruction; no cleanup was attempted.

## Verification and PR preparation

- TypeScript and ESLint: PASS.
- October 23 resumed checks: TypeScript and ESLint PASS; ordinary unit suite 71 PASS / 2 SKIP / 0 FAIL. The skips are the opt-in external database and TLS cases. The separately enabled local TLS suite then passed all 7 checks, including trusted-CA and wrong-host rejection. No production database test was enabled.
- The exact 57-file allowlist contains 20 tracked modifications and 37 new files. No EOL-only file changes, missing local Markdown links, merge markers, forbidden private artifacts, configured-secret matches or generic credential signatures were found. All 239 distributable source files were checked; 10 identifying field values from the existing 2-member encrypted backup had zero matches. Backup decryption stayed local/in memory; no plaintext archive was written or uploaded. This is a scoped scan, not proof against every possible unknown secret.
- All 43 original dirty-file fingerprints and all 108 production input hashes remain intact; source pin still matches the sealed candidate. Linux and Windows candidate/rollback archive hashes match their sealed pair. Both archive manifests/blob hashes and all 16 image-layer known-secret scans pass (6 configured values checked). No application/build input changed; production build, browser and Compose results below remain historical evidence rather than a new execution.
- Fresh dependency audits retain 0 runtime advisories and 9 development advisories (4 moderate / 5 high). No dependency upgrade was applied. Git index remains empty; no commit, push or PR publication occurred.
- Unit/security tests:73 total,72 PASS,1 opt-in production-independent PostgreSQL test SKIP on the ordinary Windows suite. Isolated PostgreSQL canaries run separately and passed; skipped is not counted as passed.
- Browser tests:34 PASS across desktop/mobile, including branding, theme persistence, accessibility, policy/approval previews and timetable editor. Preview tests are labeled as such.
- Five new release-readiness tests also PASS on Linux. The final focused Windows rerun covers the post-download locator-checksum guard.
- Actual production-style image compile/typecheck/package and deep artifact verification: PASS. Exact current source inputs match the tested sealed candidate; no schema changes at startup.
- Live KMITL account canary: NOT RUN. No production account writes.
- Existing dependency audit: runtime0 advisories; development tree9 (4moderate/5high). No unreviewed forced dependency changes. This does not constitute a full OS/image vulnerability scan.
- Proposed GitHub Actions workflow validates PRs only, has read-only contents permission, pinned actions, synthetic databases and no production credentials/publication/deployment. It has not run on GitHub because this branch is not pushed.

New release helpers/tests and the reviewed Compose rollback mode are the principal additions in this follow-up. Full feature-branch changes are listed in the private PR allowlist/body; generated `next-env.d.ts`, environment files, credentials, backups, archives and private evidence are excluded. No staged commit or GitHub PR was created without approval.

## Decisions and next approvals

| Action | Assessment | Remaining gate |
| --- | --- | --- |
| Local source/PR review | GO for review | Owner approval before commit/push; review development advisories |
| Private synthetic staging functional tests | PASS | Offsite deferred by explicit staging-only risk acceptance; keep services private |
| Staging management access | PASS in measured window | Five key-only checks over 147 seconds; retain the earlier failed probe and monitor recurrence. Application stack is intentionally stopped |
| Production0002 migration | NO-GO | Fresh full preflight, source/activity review, approved recoverable production backup/target and exact migration execution approval |
| Production cutover | NO-GO | Production network/HTTPS/secret approval, live approved disposable SSO canary/cleanup, independently verified production recovery and explicit traffic-switch approval |

Use the [ordered cutover and rollback proposal](operations/release/cutover.PLAN.md) and [exact live canary boundary](operations/release/live-sso-canary.PLAN.md). Keep one writable canonical database: after real target writes, rollback the application against that target; never flip back to stale Supabase. No additional production action is taken by preparing these documents.
