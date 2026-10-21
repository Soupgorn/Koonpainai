> Historical API-first exploration, retired by the owner-confirmed student-managed database-first decision. See [DATABASE_FIRST.md](DATABASE_FIRST.md). Its migration, provider and sync instructions are not current execution guidance.

# Koonpinai v2 verification and handoff

Verified locally on 21 October 2026. This milestone prepares an API-first boundary; **no university timetable request or successful live synchronization exists**.

Later TLS, backup, grants and isolated migration verification are in [MIGRATION_READINESS.md](MIGRATION_READINESS.md). That work hardens the still-unapplied `0002`; its current checksum and production NO-GO decision supersede the earlier migration review below.

## Delivered

- A server-only unavailable real provider plus an injectable, tested JSON adapter factory. No invented university endpoint, OAuth scope or response contract.
- Zod application bridge/canonical schemas, semester/calendar validation, explicit Sunday-zero/ISO/English/Thai weekdays, UTC-to-Bangkok rollover, exact times and stable course/session identities.
- Exact duplicate removal while preserving separate sections, rooms, times and overlaps. Invalid/incomplete responses fail; unknown raw fields are stripped.
- Independent retrieval/storage/sharing permissions and separate delegated authorization references/expiry. Account/context binding, approval/current-policy gates and sanitized shared-member projections.
- Seven typed sync states and guarded pure transitions. No background job, guessed freshness interval or fake refresh success.
- Actual eligible approved PostgreSQL members in configured mode, with unknown availability until authorized data exists. The user-requested fictional timetable preview remains labeled and restricted to credential-free development.
- Updated My Timetable, Settings, onboarding/policy and read-only admin overview. Source and real last-sync metadata have clear missing states. Refresh is disabled and explained.
- PDF routes, components, parser/OCR code, document worker hooks, dependencies and obsolete selectors retired. Reusable models, validation, Bangkok availability and timetable visualization retained.
- Metadata-only Drizzle schema/migration, conservative defaults/RLS and repository factory; **migration 0002 not applied**, no snapshot storage or existing-record deletion.
- Linux Node 24 multi-stage non-root Dockerfile and standalone output. No infrastructure migration/deployment.

## Files and boundaries

| Area | Files |
| --- | --- |
| Provider/validation | `src/lib/timetable/contracts.ts`, `schema.ts`, `provider.ts`, `server-provider.ts`, `service.ts`, `sync.ts`, `validation.ts` |
| Persistent metadata preparation | `src/db/schema.ts`, `src/db/timetable-repository.ts`, `drizzle/0002_api_first_metadata.sql`, `drizzle/meta/0002_snapshot.json`, migration journal |
| Member/schedule projection | `src/lib/friends-repository.ts`, `src/lib/types.ts`, `src/lib/schedule.ts`, `src/lib/auth/domain.ts` |
| Shared interface | `src/components/timetable-connection.tsx`, `friends-directory.tsx`, `friend-profile.tsx`, `weekly-timetable.tsx`, `my-timetable.tsx`, `admin-dashboard.tsx`, `member-account.tsx`, `account-screens.tsx`, `personal-preview-provider.tsx`, `shared.tsx` |
| Routes/styles | Root layout/page, friends profile, admin, My Timetable; `globals.css`, `approved-design.css`, `redesign.css`; old import routes removed |
| Tests | `tests/timetable-api.test.ts`, `tests/fixtures/timetable-fixtures.ts`, `tests/browser/api-first.spec.ts`, retained schedule/theme/auth/browser suites; PDF-only tests retired |
| Tooling/docs | `package.json`, lockfile, `.env.example`, `next.config.ts`, `Dockerfile`, `.dockerignore`, production smoke script, README/PRODUCT/DESIGN/AUTH, `.impeccable/direction.md`, API_FIRST.md |

Pre-existing unrelated audit/not-found/report changes were preserved. Additional app-title/header-copy edits that appeared during verification were retained. No Git commit or push was created.

## Design review

Used the installed frontend-design skill and Impeccable context, Operate, hardening and polish guidance. The existing approved Contemporary Social Utility design and Light/Dark/System tokens remain the visual basis. This was a scoped refinement, not a new concept or formal dual-agent critique.

First rendered pass reviewed connection information, profile timetables and Account settings at desktop/mobile sizes in both themes. It found a narrow nested desktop Account connection column and refresh helper text too close to the following summary. Second pass stacked Account connection details/actions, separated helper copy, corrected remaining preview copy and retired unused PDF-specific selectors. Fresh screenshots confirmed the result. API-unavailable screens for disposable authenticated members were also inspected in both themes.

The directory, typography, spacing system, course colors and precise timetable geometry remain intact. Missing data never receives a Free label. Fixed mobile bottom navigation is retained; full-page captures show it at the initial viewport position, while interactive scrolling reserves bottom content space.

## Measured verification

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 44 passed, 1 opt-in database test skipped |
| `RUN_AUTH_DB_TESTS=true npm run test:auth:db` | 1 passed, real PostgreSQL transaction-local temporary tables |
| `npm run test:e2e` | 22 passed, desktop/mobile |
| Final focused theme/API browser rerun | 10 passed after styling refinement/retirement |
| `npm run test:auth:e2e` | 4 passed, synthesized fixture sessions and disposable PostgreSQL members |
| `npm run build` | Passed, Next.js 16.4.2 standalone output; import pages absent |
| `npm run test:auth:production` | Passed with fixture credentials, synthetic HTTPS host and no database connection |
| `git diff --check` | Passed |

Coverage includes malformed/missing JSON, calendar/time validation, exact Friday 08:45–10:15 and 10:30–12:00 boundaries, 12:00/16:00 ends, sections/rooms, duplicate/overlapping sessions, weekday conventions, UTC week rollover, permission/approval/policy denial, expired grants, safe projections, sync transitions, existing timetable rendering, weekends/term boundaries and clock updates.

Browser coverage includes search/Thai names, filters/view switching, dialogs, empty states, retired route 404s, disabled refresh, OS/manual theme selection, reload persistence, keyboard focus, onboarding/profile/policy/access/logout and responsive checks at 320/390/768/1024/1440 widths. Axe WCAG A/AA scans passed on the exercised routes in both themes, including actual configured-mode API-unavailable screens. Token contrast tests passed for normal text, semantic statuses, six course pairs, inputs and focus. These automated checks do not replace a complete manual assistive-technology audit; browser execution used Chromium with emulated touch/viewport, not physical-device testing.

The database test also exercised prepared metadata permissions/upserts and invalid-input rejection against temporary tables without applying migration 0002 or changing real settings. Authentication browser fixtures are removed in `finally`; no actual member was promoted by this task.

## Screenshots

Local ignored gallery: [.impeccable/review/api-first/index.html](.impeccable/review/api-first/index.html), containing **44 PNGs**. Click a thumbnail for full resolution.

For each screen below there are `-desktop-light.png`, `-desktop-dark.png`, `-mobile-light.png` and `-mobile-dark.png` variants in that directory:

`dashboard`, `friend-profile`, `my-timetable`, `login`, `admin`, `onboarding`, `policy`, `approval`, `account`, `admin-access`, `api-unavailable`.

The first ten screens use clearly fictional preview data. `api-unavailable` captures configured mode with a disposable fictional test account and no timetable. No real student PDF, identity or raw university response appears in this gallery.

## Limits and next integration

- No actual university API contract or authorized timetable sample was supplied. Fixtures are our application bridge, not a guessed KMITL schema.
- No real timetable transport/grant flow, snapshot persistence, background synchronization or working Refresh action. Permission expiry is checked, but the future authorization adapter must verify grant authenticity, revocation and source-member binding.
- No metadata migration was applied. Public schema enum/FK/RLS execution requires the reviewed operator migration step; the metadata repository was tested with temporary tables.
- No Docker executable was available locally, so the Docker image was not built/run. Standalone production build and auth smoke were verified; Linux container/VM/proxy verification remains.
- The earlier real KMITL browser login reported a 502 on the university host. Successful live code/token exchange remains unverified and is separate from mocked OIDC and synthesized-session tests.
- DST source zones, local-midnight-crossing sessions, calendar exceptions and Buddhist-era/multi-term formats need explicit API mapping rules. Unknown/missing required values are rejected rather than invented.
- Operational account deletion/export, delegated consent withdrawal, retention, backups and session cleanup remain future work. No GitHub JSON storage was added.

The exact official schema, authorization, identity-binding, rate-limit and retrieval/storage/sharing permission handoff is listed in [API_FIRST.md](API_FIRST.md). Implement and enable the real provider only after those requirements are confirmed.
