# Koonpinai

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Radix dialogs and Lucide React. `next-themes` provides appearance preferences. Auth.js's official Keycloak provider connects the approved KMITL OIDC client; Drizzle/PostgreSQL persists accounts and revocable application-session records. Typed fictional data supplies guarded directory reads; PDF.js, Tesseract.js and Zod provide local document processing. No timetable publishing or university timetable API.

## Users
Approximately 50 university friends, primarily KMITL students, checking who has class and when they can meet. Shared access requires a completed profile, current policy acknowledgement and administrator approval. Administrators manage pending/approved/suspended accounts.

## Product Purpose
Help friends find a break together: show who is free, how long their free window lasts, and what comes next without messaging everyone individually.

## Positioning
Availability is calculated from recurring academic timetables in Asia/Bangkok. It describes a schedule, not attendance or physical location.

## Operating Context
Quick mobile checks between classes; weekly planning on larger screens. The approved Contemporary Social Utility (Concept C) interface leads with free-window rows, then a compact in-class roster. Twelve existing fictional people remain the public data set. English interface copy, Thai branding and Thai names are confirmed.

## Capabilities and Constraints
The directory and friend schedules require an approved account with a current policy acknowledgement and completed profile. Search nicknames, filter availability, inspect course/room/next-class information and open timetable details. Preserve exact class boundaries, semester dates, empty days and overlapping sessions. Records remain clearly fictional until a separately authorized timetable storage flow exists.

The real KMITL PDF importer uses positioned PDF.js text or local Thai/English OCR, editable source comparison, Zod validation, explicit review confirmation, private timetable/profile preview and canonical JSON export. Personal import reuses that workflow and can apply an accepted timetable to the in-memory My Timetable preview. Source PDFs keep their original colors in both themes. Original files, extracted text and imported schedules are not uploaded, logged or stored in browser persistence by the application.

Profile setup, versioned policy acknowledgement, account approval/suspension and profile settings persist in PostgreSQL. Identity is the verified OIDC issuer/subject pair, never a nickname or email link. Auth.js encrypted JWT cookies are backed by active, expiring/revocable database session records. Local logout does not terminate the university SSO session. Personal imported timetables and admin friend/schedule edits remain temporary and never publish; appearance persists locally under `koonpinai-theme`.

The explicit `ENABLE_UI_PREVIEW=true` fictional mode is available only in development with all real client/session/database credentials absent. Partial real configuration disables it; production never allows it. `ENABLE_ADMIN_DEMO` no longer grants access. `/login` starts real KMITL sign-in when fully configured. Private routes fail closed; server reads/actions recheck identity, policy, approval and admin role independently of the proxy. Private PDFs, credentials and derived inspection files stay out of Git.

## Brand Commitments
Koonpinai / คุณไปไหน. “Find a break together.” Preserve the approved geometric K wordmark and Contemporary Social Utility composition: self-hosted Manrope with Noto Sans Thai fallback, near-white canvas, white flat surfaces, navy text, periwinkle actions, rounded-square initials and ruled directory groups. Dark appearance uses blue-charcoal canvas, navy surfaces, off-white text and soft periwinkle. Green availability and amber class states are semantic; six course identities remain consistent across themes. The selected sibling prototype and PNGs are composition references, not new product records or a replacement schedule engine.

## Evidence on Hand
The approved Concept C prototype and desktop/mobile PNGs are in `D:/Project/Koonpinai-design-previews/design-previews/selected/`. Implementation tokens and responsive integration are in `src/app/redesign.css`, approved composition in `src/app/approved-design.css`, and shared/importer/admin styles in `src/app/globals.css`.

Public records are fictional; PDF fixtures are sanitized and generated in memory. A user-supplied two-page scanned KMITL PDF was tested locally without committing the original or private derived evidence; its detailed table yielded nine sessions. Automated suites cover schedule boundaries, parsing, real local OCR, review/export, theme tokens and browser behavior. Test commands and scope are in README; final verification is reported separately rather than assumed by this document.

## Product Principles
- A glance should answer who is free and for how long.
- Timetable truth, deliberate review and explicit preview boundaries come first.
- Preserve mobile readability, keyboard operation and maintainable components.
- Theme preference must not turn private schedule data into persistent browser data.

## Accessibility & Inclusion
Visible keyboard focus, written availability labels, labeled native controls, Radix dialog interaction, skip navigation and reduced-motion support. Aim for normal text contrast of at least 4.5:1, large text 3:1, and discernible input/focus boundaries. Header theme targets are 44px. Phones use single-column free rows, current/next-class roster lines and fixed bottom navigation; weekly grids become a day agenda instead of shrinking seven columns.

## Open Decisions
Public KMITL discovery, local client configuration and PostgreSQL migration/connectivity were verified. The user encountered a 502 on the university SSO host during real browser sign-in, so a successful real callback/token exchange remains unverified. Complete that approved-client test and production callback/HTTPS checks before launch. RP-Initiated Logout requires confirmed client post-logout registration/token-hint handling. Policy/privacy/removal rules, backups, rate limits and session cleanup need operational review. Timetable persistence, GitHub JSON storage, the university timetable API and deployment remain out of scope. See AUTH.md for configuration and exact test boundaries.
