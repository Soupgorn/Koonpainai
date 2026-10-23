# Production release and database cutover — NOT AUTHORIZED

Private synthetic staging functional tests: PASS. Restored management-access checks: PASS in the measured October 23 window; rehearsal containers remain intentionally removed and an earlier failed probe is retained. Production migration/cutover: NO-GO. This sequence separates preparation, production writes and traffic activation. No automatic migration occurs on application startup.

## Required separate approvals

1. Resolve/account for outstanding account/session provenance and consent review; separately approve any refreshed baseline adoption. Old consent must be renewed through the application, never backfilled.
2. Approve the production target, private network/firewall/HTTPS proxy settings, secret custody, recoverable offsite backup destination and maintenance/write-freeze window. Staging-only data-loss acceptance does not waive production recovery.
3. Approve production backup/export, empty-target initialization/role provisioning, restore and exact Database-First migration0002 **on the named target**. No in-place Supabase migration is implied.
4. Approve runtime credential delivery/restart and the [disposable live SSO canary and cleanup](live-sso-canary.PLAN.md).
5. Approve traffic cutover after the evidence is accepted. No approval here permits deleting Supabase or previous backups.

## Ordered execution proposal

1. Fresh read-only preflight: source identity, validated TLS/hostname, complete application schema/RLS/grants/default ACLs, administrator/approval invariants, current consent, full-row inventory and exact migration checksums. Source was last observed at0000/0001; stop on unexpected ledger/DDL or security changes. Normal lifecycle changes need review, not silent baseline replacement.
2. Verify the chosen image/archive checksums, artifact/source pins, current policy and rollout compatibility. The sealed rollback pair is a tested previous **staging** build with the same policy; an unknown older production image has not been validated. Preserve an independent operator copy.
3. Start the approved maintenance window. Freeze **all** source writers, including SSO callbacks, background jobs and old application processes; drain requests and close old pools. Keep public application admission closed. Confirm no surviving source writer before final snapshot.
4. Create a new consistent encrypted application backup with the reviewed portable exporter. Verify manifest/HMAC, ciphertext, pg_restore listing, full-record/schema/ledger inventory and an independent offsite copy with separately protected key. DDL must also be frozen. Do not overwrite existing archives.
5. Initialize a new private PostgreSQL17 target using separate administrator, migrator and restricted runtime secrets. No Supabase infrastructure-role import. Use CA/SAN-validated TLS; PostgreSQL has no public port. The web container must not mount operator/migration credentials.
6. Restore the source application0000/0001 snapshot to the empty target with original IDs/FKs/ledger preserved. Rebuild reviewed target grants/ownership, verify every row and security object, then apply the exact approved0002 using the guarded migration runner. Expected SHA256: `3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a`. Use reviewed3s lock/30s statement/60s idle-transaction timeouts and advisory lock1263423049. Stop on checksum/ledger/precondition mismatch; no schema push or history rewrite.
7. Verify target constraints/indexes, forced RLS, effective runtime privileges, no anon/authenticated access, owner isolation and ledger0000–0002. Health checks require the final schema; a healthy source connection alone is insufficient. Do not broaden runtime grants to bypass failure.
8. Deliver only the runtime secret bundle and its exact artifact manifest to the nonroot web container. Keep migration/admin secrets outside its mounts and environment. Launch the sealed image privately, verify health/TLS/exact role and bounded pool, then execute only the separately approved live canary and cleanup.
9. Compare all nonfixture records and source snapshot again. Activate one canonical HTTPS application route with approved callback registration. Record the time of first accepted nonfixture target write. Keep source writers frozen to avoid split brain. Monitor readiness, auth failures, pool usage, request drain and backup alerts.
10. Accept the new system only after explicit owner review, verified production recovery and the observation window. Keep Supabase and all prior recovery artifacts intact until separately authorized retirement.

## Rollback boundaries

**Before target nonfixture writes:** close/drain the target, remove only approved canary data with its journal, verify unchanged source and nonfixture digests, restore the previous route/runtime bundle, and resume exactly one source writer. No grants must change merely to return to the original postgres connection. Actual old-production image compatibility remains a release prerequisite.

**After target nonfixture writes:** target is authoritative. Prefer the tested same-policy image-only rollback **against the same target database**. Do not point traffic back to stale Supabase and discard new writes. If the database is incompatible, keep maintenance closed and request a forward fix or a separately approved restore/reconciliation plan. The populated0002 rollback refuses destructive table removal. No down migration or full restore is automatically authorized.

For ambiguous backup, migration or deployment outcomes, inspect state before retrying. Preserve exact logs/checksums, do not rotate credentials or expand permissions to force a green check. Revalidate database identity before every write-capable operation.
