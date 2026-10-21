# Koonpinai

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Radix dialogs and Lucide React. `next-themes` provides appearance preferences. Auth.js's official Keycloak provider connects the approved KMITL OIDC client; Drizzle/PostgreSQL persists accounts and revocable application-session records. The server-only friends repository reads approved member timetables from Drizzle/PostgreSQL; Zod validates student edits. There is no PDF/OCR, external timetable provider, Supabase Auth or public timetable publishing.

## Users
Approximately 50 university friends, primarily KMITL students, checking who has class and when they can meet. Shared access requires a completed profile, current policy acknowledgement and administrator approval. Administrators manage pending/approved/suspended accounts.

## Product Purpose
Help friends find a break together: show who is free, how long their free window lasts, and what comes next without messaging everyone individually.

## Positioning
Availability is calculated from recurring academic timetables in Asia/Bangkok. It describes a schedule, not attendance or physical location.

## Operating Context
Quick mobile checks between classes and weekly planning on larger screens. The Cloud & Sky interface uses compact search/filter workspaces, readable schedule rows and honest empty states. English interface copy and Thai names are supported; the official application name is always Koonpinai.

## Capabilities and Constraints
The directory and friend schedules require an approved account with the current policy acknowledgement and completed profile. Students set their semester and maintain their own classes through authenticated Server Actions. Ownership comes only from the validated Auth.js session. Administrators manage approvals and cannot edit another student’s classes. Pending students may prepare a private timetable after profile/policy setup; suspended users cannot edit. The server-only repository exposes fictional friends only in explicit credential-free development preview. Preserve exact class boundaries, semester dates, empty days and overlaps; missing schedules are not evidence of free time.

An account without timetable records starts empty, including My Timetable in development preview. Set semester and Add/Edit/Delete class actions replace import. Overlaps require explicit review; duplicates and stale revisions are rejected. Real schedules persist only when the new database-first migration is separately approved and applied. Preview changes reset on reload. The live Bangkok clock remains; the old preview-time control and fixed fictional clock stay removed. A small development-sample badge appears only in explicit fixture mode.

PDF import routes, extraction/OCR, review/export and university API synchronization are retired. The only active proposed 0002 is student_timetables; the obsolete, unapplied API-first proposal is archived for audit. Production migrations 0000/0001 remain byte-identical. No migration runs at application startup.

Profile setup, versioned policy acknowledgement, account approval/suspension and profile settings persist in PostgreSQL. Identity is the verified OIDC issuer/subject pair, never a nickname or email link. Auth.js encrypted JWT cookies are backed by active, expiring/revocable database session records. Local logout does not terminate the university SSO session. Only development timetable/profile/access previews remain temporary; real timetable changes persist through owner-scoped transactions and forced RLS. Appearance persists locally under `koonpinai-theme`.

The explicit `ENABLE_UI_PREVIEW=true` fictional mode is available only in development with all real client/session/database credentials absent. Partial real configuration disables it; production never allows it. `ENABLE_ADMIN_DEMO` no longer grants access. `/login` starts real KMITL sign-in when fully configured. Private routes fail closed; server reads/actions recheck identity, policy, approval and admin role independently of the proxy. Credentials, private backups and derived inspection files stay out of Git. The runtime pool enforces validated TLS, narrow capacity and lifecycle safeguards; runtime and migration credentials stay separate.

## Brand Commitments
The exact official name is Koonpinai, never a Thai translation or competing spelling. The user-approved pastel-blue peeking penguin is the sole mark: white face, navy outlines, paired highlighted eyes, warm beak, blue flippers and horizontal rail. The global Cloud & Sky system uses pale-blue/white surfaces, navy ink, accessible blue actions, Mali headings and Kodchasan body/UI. The existing shadcn Nova/Radix component foundation remains; the V3 palette, typography and mascot supersede prior directions. Dark/System preference derives navy surfaces, while login stays light. Green/amber schedule semantics and six course identities remain meaningful. Promotional slogans, decorative footer and preview-time controls are removed.

Visible branding and browser metadata use Koonpinai. Internal database, OAuth, callback, environment, package, cookie, storage and deployment identifiers retain compatibility; a visible brand migration does not rename infrastructure.

## Evidence on Hand
Shared primitives live in `src/app/globals.css`; semantic extensions and effective geometry live in `src/app/redesign.css`, layered after inherited composition rules. Mali and Kodchasan load once from the root layout through `next/font/google` with Thai/Latin subsets. Login reuses the same font instances and pins the light palette. `DESIGN.md` and `.impeccable/design.json` describe the implemented system.

`public/brand/koonpinai-mark.svg` is the manually traced true-vector master. `scripts/generate-brand.mjs` deterministically produces the vector/raster/icon variants using the existing canvas dependency; `scripts/brand-wordmark.svg` holds outlined Kodchasan lettering. `public/brand/README.md` and `provenance.json` record source, license and export provenance. Browser metadata supplies the exact title/template, favicon and Apple touch icon. No existing manifest, PWA infrastructure or public share metadata is present; icon exports do not establish installability.

Development fixtures are explicitly isolated from configured-user data. Synthetic isolated PostgreSQL and authenticated browser rehearsals cover ownership, policy/approval exclusion, exact times, optimistic concurrency, RLS and cleanup. External OIDC is mocked there, not proof of a live university sign-in. Test commands and scope are in README; final reconciliation results are reported separately.

## Product Principles
- A glance should answer who is free and for how long.
- Timetable truth, owner-controlled edits and explicit preview boundaries come first.
- Preserve mobile readability, keyboard operation and maintainable components.
- Theme preference must not turn private schedule data into persistent browser data.

## Accessibility & Inclusion
Visible keyboard focus, written availability labels, labeled native controls, Radix dialog interaction, skip navigation and reduced-motion support. Aim for normal text contrast of at least 4.5:1, large text 3:1, and discernible input/focus boundaries. Header theme targets are 44px. Phones use single-column free rows, current/next-class roster lines and fixed bottom navigation; weekly grids become a day agenda instead of shrinking seven columns.

## Open Decisions
Public KMITL discovery, local client configuration and PostgreSQL migration/connectivity were verified. The user encountered a 502 on the university SSO host during real browser sign-in, so a successful real callback/token exchange remains unverified. Complete that approved-client test and production callback/HTTPS checks before launch. RP-Initiated Logout requires confirmed client post-logout registration/token-hint handling. Policy/privacy/removal rules, backups, rate limits and session cleanup need operational review. Policy 2026-10-22-student-v3 requires renewed acknowledgement; stored acknowledgements are never silently upgraded. The new student migration, runtime credential cutover, real production canaries and CloudStack deployment require separate operational approval. See AUTH.md for configuration and exact test boundaries.
