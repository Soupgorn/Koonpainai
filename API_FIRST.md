> Historical API-first exploration, retired by the owner-confirmed student-managed database-first decision. See [DATABASE_FIRST.md](DATABASE_FIRST.md). Its migration, provider and sync instructions are not current execution guidance.

# API-first integration boundary

## Provider and runtime

`TimetableProvider.getTimetable(context): Promise<NormalizedTimetable>` separates university integration from schedule/UI logic. Context carries internal member ID, optional semester/private source reference, a separately validated delegated grant reference/expiry and optional AbortSignal. Source identity is not the authentication identity.

The only registered real provider, in `server-provider.ts`, has `available: false` and throws `api-unavailable`. It has no URL, fetch or fake successful result. The injectable JSON adapter is a tested foundation: future transport returns a JSON string and a university-specific mapper translates it to our bridge. **The bridge is our format, not KMITL’s undocumented response schema.** Fixtures are never registered in configured mode.

The adapter caps JSON text at 1,000,000 characters, validates parsed records, checks delegated authorization/expiry and cancellation, and redacts failures. Future HTTP transport must enforce streamed limits, destination restrictions, deadlines and AbortSignal. No background jobs or token storage were added.

## Canonical records

Zod schemas/types live in `schema.ts`. Canonical weekdays are **Sunday=0, Monday=1, … Saturday=6**. Zone is **Asia/Bangkok**; exact times are zero-padded HH:mm.

```ts
type NormalizedTimetable = {
  schemaVersion: 2;
  timeZone: "Asia/Bangkok";
  semester: { id: string; name: string; start: string; end: string };
  sessions: Array<{
    id: string; code: string; name: string; section: string;
    day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    start: string; end: string; room: string; color: number;
  }>;
  source: { provider: "kmitl" | "fixture"; label: string; fetchedAt: string };
  duplicatesRemoved: number;
};
```

Dates are actual ISO calendar dates with inclusive semester bounds. Required course/section/room/time fields cannot be missing; no values are invented. A validated empty session list is a known empty semester; missing/unavailable data remains unknown.

Our bridge explicitly declares Sunday-zero/ISO/English/Thai weekday conventions and Bangkok or UTC. UTC conversion preserves day/week rollover. DST zones and sessions crossing local midnight are rejected until their representation is specified. Buddhist-era dates, holidays, date exceptions and multi-term responses require the real mapper contract.

Whitespace is normalized. Stable SHA-256 IDs cover the complete semantic session tuple. Only exact duplicates are removed; distinct sections/rooms/times/courses/overlaps survive. Course colors are stable. Unknown sensitive fields are stripped. Canonical sessions directly fit the existing visualization model and preserve 08:45–10:15, 10:30–12:00 and 16:00 ends.

## Access and privacy

- Active Auth.js session backed by fresh unrevoked database session.
- Completed profile, current policy and approved account on server reads/actions.
- Independently permitted university data retrieval.
- Separate current delegated grant, correctly verified/bound to the source person by future integration.
- Separate permission to retain and share normalized data.

`retrieveAuthorizedTimetable` checks account/context binding and retrieval gates before invoking a provider. `projectSharedMember` checks viewer and target eligibility and only exposes validated Synced snapshots with a current grant and sharing permission. Non-synced data is conservatively hidden. Projections omit issuer, subject, email, raw response and source identifiers.

Current runtime passes no snapshots and all permission flags default false. Policy version `2026-10-21-api-v2` requires renewed acknowledgement while preserving existing records. It does not grant university access. Never reuse SSO tokens for timetable requests without explicit audience/scope/consent approval. No access/refresh token storage was added.

## Database plan

Migration `0002_api_first_metadata.sql` adds the sync enum, `application_settings` and `timetable_sync`. Settings have independent retrieval/storage/sharing booleans defaulting false. Sync metadata has internal member/provider, state, attempt/success dates and generic error code. Both tables enable RLS. No web writes, client grants, raw payloads, source identities or snapshot tables were introduced.

The migration is additive, changes/deletes no existing account/session records and **has not been applied**. Operator plan: review SQL/ledger, back up, verify approved migration connection, apply through the existing migration command in an authorized maintenance step, then inspect schema/RLS/repository behavior. Runtime remains usable without the new tables because the unavailable provider never queries them.

The internal metadata repository is prepared for future orchestration after migration; fresh server authorization and approved policy decisions are still required. Snapshot storage requires explicit storage/sharing/retention permission and a separately reviewed schema. No existing records were erased.

## Synchronization

States: Not connected, Permission required, Syncing, Synced, Outdated, Sync failed and API unavailable. Pure transitions record attempts, require an active attempt for success, reject duplicate starts, retain previous success on failure and clear metadata on disconnect. The unavailable provider never returns a successful sync.

No operational job/lock, polling or guessed stale interval exists. Future orchestration needs request deduplication/locking, revocation, permission rechecks, atomic snapshots, rate limits and a university-defined freshness policy. Current UI has no fabricated last-sync date and disables Refresh with an explanation.

## Retired PDF workflow

Import routes/components, PDF/OCR parsers, document workers, preparation hooks, fixtures/tests and dependencies were removed. Shared validation moved to `timetable/validation.ts`; typed schedules, exact-time engine and responsive visualization remain. Generated document assets are no longer served. Private PDFs remain ignored and unpublished.

## Required university handoff

1. Official documentation, approved environments/base URLs, versioned endpoint/method/query contract and sanitized JSON/error responses.
2. Authorization protocol/client registration, audience/scopes, consent, delegated identity binding, expiry/refresh/revocation and token requirements; clarify whether an independent grant is needed.
3. Field semantics for courses/sections/sessions, classroom, weekday convention, timezone/time precision, semester/calendar/date system, holidays/exceptions and overnight/multiple-term sessions.
4. Pagination/response limits, duplicates/corrections, conditional requests, rate limits/Retry-After, refresh cadence, outage behavior and support.
5. Written permission for retrieval, normalized storage and sharing with approved members, retention/deletion/export, consent withdrawal, audit and identifier restrictions.

Only then enable a reviewed transport/mapper, grant flow, permission-governed snapshots, migration and refresh orchestration. No API endpoint, OAuth scope or credential variable has been invented here.
