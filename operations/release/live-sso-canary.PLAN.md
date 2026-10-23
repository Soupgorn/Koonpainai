# Live KMITL SSO canary — approval required

This plan has **not executed**. Synthetic OIDC tests passed; they are not live KMITL client verification. Read-only OIDC discovery from staging matched the supplied issuer/endpoints and advertised code flow/S256. Discovery does not validate client credentials, callback registration or a real login.

## Entry conditions

Use exactly two university-approved disposable identities: C (ordinary student) and A (approval administrator). Their issuer/subjects must be checked privately against the target and proven absent before creation. No real student account may be reused. No approved identities are currently supplied.

Require explicit approval for the named target, maintenance window, exact image/artifact pins, real SSO configuration, canonical HTTPS origin/callback registration, temporary A promotion and cleanup transaction. Keep public traffic closed; permit only the canary operators. Pin policy `2026-10-22-student-v3`, database identity and migration ledger0000–0002. Do not enable preview fixtures or forge a production session.

Before writes, record a private journal containing absent-prestate proof, exact paired issuer/subject/member IDs as they become known, every created session/class ID, term-owner IDs and each expected role/status/consent transition. Preserve a verified recoverable backup and all nonfixture full-row digests. Neither identifiers nor tokens belong in logs/PRs. Use the application's normal eight-hour session lifetime; complete cleanup before the approved deadline and never use expiry as cleanup.

## Controlled checks

1. C and A each complete real Keycloak Authorization Code + PKCE S256 with normal state/nonce checks and encrypted application sessions. New accounts must be `member/pending`; provider claims must not grant administrator access.
2. Each owner completes their profile and explicitly accepts the current sharing policy. Confirm pending users' schedules are not visible to shared viewers. Pending C can manage only its own timetable privately.
3. A separate, approved operator action promotes **only paired A issuer/subject/member ID** to `admin/approved`. Runtime credentials cannot promote accounts. Do not introduce a broad bootstrap or seed rule.
4. A uses the actual administrator UI to approve C. Confirm an ordinary account cannot approve users or alter roles, and a stale/pending/no-current-consent session cannot access shared data. Do not change a real member to create a negative test.
5. Add C's Friday08:45–10:15 and10:30–12:00 entries, edit location/course name, test an explicitly acknowledged overlap, then remove only the recorded synthetic entries. Check exact end boundaries, term limits and Asia/Bangkok availability.
6. Verify C cannot mutate A's schedule and **A's administrator role does not permit editing C's schedule**. Use normal authenticated application requests; never substitute a client-supplied member ID for authorization.
7. Re-login reuses the same issuer/subject member, profile edits persist, and local logout revokes only the fixture session. Do not assume local logout terminates Keycloak SSO. Full provider logout is not included without its own registered redirect/protocol approval.
8. Verify all nonfixture records, role/grant/RLS invariants and migration ledger are unchanged. Capture sanitized PASS/FAIL evidence, not callback queries, cookies, tokens or full user objects.

## Exact cleanup boundary and recovery

The operator cleanup must be prepared with the approved private journal and dry-run SELECT counts before execution. Runtime has no account DELETE privilege; use separate operational credentials. Do not use nickname prefixes, email domains or time ranges as deletion authority.

Freeze/drain canary writers. In one guarded transaction, use `lock_timeout='3s'`, bounded `statement_timeout` (10–15s), `idle_in_transaction_session_timeout='15s'` and try advisory lock1263423049. Lock and verify both fixture members, every expected role/status/policy value, their exact current sessions, terms and entries. Abort on unknown additional rows or any changed nonfixture digest.

Delete in FK-safe order: exact recorded `timetable_entries` IDs paired with fixture owner IDs; exact `student_timetables.member_id` rows; exact `application_sessions` IDs paired with fixture member IDs; finally exact paired member ID/subject values with the pinned issuer. For the last match use paired rows, e.g. `JOIN unnest($1::uuid[], $2::text[]) AS f(id, subject)` plus issuer, **not independent ANY lists that form unintended combinations**. Assert each affected count before commit. The ledger remains three rows and untouched. No TRUNCATE, reset, broad DELETE or schema rollback.

Require explicit commit acknowledgement and a fresh read-only verification of zero fixture rows, unchanged nonfixture full-row digests and security invariants. If commit is ambiguous, inspect before retrying. If cleanup fails, close canary admission, retain the private journal, inventory read-only and request only the additional recovery needed. Never restore an old whole database over legitimate concurrent activity. Any nonfixture change is a stop condition requiring separate investigation/recovery approval.

The current approval does not authorize any of these live writes, credential delivery or deployment. This document is the exact proposed scope for a future canary approval.
