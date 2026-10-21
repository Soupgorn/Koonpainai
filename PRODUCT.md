# Koonpinai

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Radix dialogs and Lucide React. `next-themes` provides appearance preferences. Auth.js's official Keycloak provider connects the approved KMITL OIDC client; Drizzle/PostgreSQL persists accounts and revocable application-session records. The server-only friends repository exposes typed fixtures only in explicit credential-free development mode and returns no shared timetables for configured users; PDF.js, Tesseract.js and Zod provide local document processing. No timetable publishing or university timetable API.

## Users
Approximately 50 university friends, primarily KMITL students, checking who has class and when they can meet. Shared access requires a completed profile, current policy acknowledgement and administrator approval. Administrators manage pending/approved/suspended accounts.

## Product Purpose
Help friends find a break together: show who is free, how long their free window lasts, and what comes next without messaging everyone individually.

## Positioning
Availability is calculated from recurring academic timetables in Asia/Bangkok. It describes a schedule, not attendance or physical location.

## Operating Context
Quick mobile checks between classes and weekly planning on larger screens. The Cloud & Sky interface uses compact search/filter workspaces, readable schedule rows and honest empty states. English interface copy and Thai names are supported; the official application name is always Koonpinai.

## Capabilities and Constraints
The directory and friend schedules require an approved account with a current policy acknowledgement and completed profile. The server-only repository returns fixture friends only in explicit credential-free development preview; configured users receive an empty directory until a separately authorized real shared-timetable adapter exists. No real shared-timetable backend is implemented. Search, availability filters and class details operate on available authorized records. Preserve exact class boundaries, semester dates, empty days and overlaps; missing schedules are not evidence of free time.

My Timetable always starts with no sessions, including in development preview. Its existing update/import action can apply a reviewed real timetable to in-memory state, never fake initial classes. The live Bangkok clock remains; the old preview-time control and fixed fictional clock are removed. A small development-sample badge appears only in the explicit fixture mode.

The real KMITL PDF importer uses positioned PDF.js text or local Thai/English OCR, editable source comparison, Zod validation, explicit review confirmation, private timetable/profile preview and canonical JSON export. Personal import reuses that workflow and can apply an accepted timetable to the in-memory My Timetable preview. Source PDFs keep their original colors in both themes. Original files, extracted text and imported schedules are not uploaded, logged or stored in browser persistence by the application.

Profile setup, versioned policy acknowledgement, account approval/suspension and profile settings persist in PostgreSQL. Identity is the verified OIDC issuer/subject pair, never a nickname or email link. Auth.js encrypted JWT cookies are backed by active, expiring/revocable database session records. Local logout does not terminate the university SSO session. Personal imported timetables and admin friend/schedule edits remain temporary and never publish; appearance persists locally under `koonpinai-theme`.

The explicit `ENABLE_UI_PREVIEW=true` fictional mode is available only in development with all real client/session/database credentials absent. Partial real configuration disables it; production never allows it. `ENABLE_ADMIN_DEMO` no longer grants access. `/login` starts real KMITL sign-in when fully configured. Private routes fail closed; server reads/actions recheck identity, policy, approval and admin role independently of the proxy. Private PDFs, credentials and derived inspection files stay out of Git.

## Brand Commitments
The exact official name is Koonpinai, never a Thai translation or competing spelling. The user-approved pastel-blue peeking penguin is the sole mark: white face, navy outlines, paired highlighted eyes, warm beak, blue flippers and horizontal rail. The global Cloud & Sky system uses pale-blue/white surfaces, navy ink, accessible blue actions, Mali headings and Kodchasan body/UI. The existing shadcn Nova/Radix component foundation remains; the V3 palette, typography and mascot supersede prior directions. Dark/System preference derives navy surfaces, while login stays light. Green/amber schedule semantics and six course identities remain meaningful. Promotional slogans, decorative footer and preview-time controls are removed.

Visible branding and browser metadata use Koonpinai. Internal database, OAuth, callback, environment, package, cookie, storage and deployment identifiers retain compatibility; a visible brand migration does not rename infrastructure.

## Evidence on Hand
Shared primitives live in `src/app/globals.css`; semantic extensions and effective geometry live in `src/app/redesign.css`, layered after inherited composition rules. Mali and Kodchasan load once from the root layout through `next/font/google` with Thai/Latin subsets. Login reuses the same font instances and pins the light palette. `DESIGN.md` and `.impeccable/design.json` describe the implemented system.

`public/brand/koonpinai-mark.svg` is the manually traced true-vector master. `scripts/generate-brand.mjs` deterministically produces the vector/raster/icon variants using the existing canvas dependency; `scripts/brand-wordmark.svg` holds outlined Kodchasan lettering. `public/brand/README.md` and `provenance.json` record source, license and export provenance. Browser metadata supplies the exact title/template, favicon and Apple touch icon. No existing manifest, PWA infrastructure or public share metadata is present; icon exports do not establish installability.

Development fixtures are explicitly isolated from configured-user data. PDF fixtures are sanitized and generated in memory. A user-supplied two-page scanned KMITL PDF was tested locally without committing the original or private derived evidence; its detailed table yielded nine sessions. Automated suites cover schedule boundaries, parsing, local OCR, review/export, theme tokens and browser behavior. Test commands and scope are in README; final verification is reported separately rather than assumed by this document.

## Product Principles
- A glance should answer who is free and for how long.
- Timetable truth, deliberate review and explicit preview boundaries come first.
- Preserve mobile readability, keyboard operation and maintainable components.
- Theme preference must not turn private schedule data into persistent browser data.

## Accessibility & Inclusion
Visible keyboard focus, written availability labels, labeled native controls, Radix dialog interaction, skip navigation and reduced-motion support. Aim for normal text contrast of at least 4.5:1, large text 3:1, and discernible input/focus boundaries. Header theme targets are 44px. Phones use single-column free rows, current/next-class roster lines and fixed bottom navigation; weekly grids become a day agenda instead of shrinking seven columns.

## Open Decisions
Public KMITL discovery, local client configuration and PostgreSQL migration/connectivity were verified. The user encountered a 502 on the university SSO host during real browser sign-in, so a successful real callback/token exchange remains unverified. Complete that approved-client test and production callback/HTTPS checks before launch. RP-Initiated Logout requires confirmed client post-logout registration/token-hint handling. Policy/privacy/removal rules, backups, rate limits and session cleanup need operational review. Timetable persistence, GitHub JSON storage, the university timetable API and deployment remain out of scope. See AUTH.md for configuration and exact test boundaries.
