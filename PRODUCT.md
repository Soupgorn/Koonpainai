# Koonpinai

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Radix dialogs and Lucide React. `next-themes` provides appearance preferences. Typed fictional data supplies public reads; PDF.js, Tesseract.js and Zod provide real local document processing. No connected authentication, database or write API.

## Users
Approximately 50 university friends, primarily KMITL students, checking who has class and when they can meet. The planned service includes approved student accounts and administrator oversight; current account/access screens are previews.

## Product Purpose
Help friends find a break together: show who is free, how long their free window lasts, and what comes next without messaging everyone individually.

## Positioning
Availability is calculated from recurring academic timetables in Asia/Bangkok. It describes a schedule, not attendance or physical location.

## Operating Context
Quick mobile checks between classes; weekly planning on larger screens. The approved Contemporary Social Utility (Concept C) interface leads with free-window rows, then a compact in-class roster. Twelve existing fictional people remain the public data set. English interface copy, Thai branding and Thai names are confirmed.

## Capabilities and Constraints
The current public directory and friend schedules need no account. Search nicknames, filter availability, inspect course/room/next-class information and open timetable details. Preserve exact class boundaries, semester dates, empty days and overlapping sessions.

The real KMITL PDF importer uses positioned PDF.js text or local Thai/English OCR, editable source comparison, Zod validation, explicit review confirmation, private timetable/profile preview and canonical JSON export. Personal import reuses that workflow and can apply an accepted timetable to the in-memory My Timetable preview. Source PDFs keep their original colors in both themes. Original files, extracted text and imported schedules are not uploaded, logged or stored in browser persistence by the application.

Profile setup, policy acknowledgment, pending approval, account settings, personal timetable and access management are frontend demonstrations. They do not create an SSO session, submit an approval request or grant access. Profile and policy progress reflects actual in-memory booleans. Personal state resets on reload; admin management state is temporary. Only the visual theme preference persists locally, under `koonpinai-theme`.

Preview routes are enabled in development or with `ENABLE_UI_PREVIEW=true`; admin routes have the separate development/`ENABLE_ADMIN_DEMO=true` guard. Both groups return 404 by default in production. `/login` remains an informational public page with disconnected SSO, and hides preview entry links when previews are disabled. Neither flag authorizes server writes. Private PDFs and derived inspection files stay out of Git.

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
The planned connected flow is university sign-in, profile setup, policy acknowledgment, administrator approval and authorized timetable sharing. The implementation does not connect SSO/Keycloak, PostgreSQL/Drizzle, an API, GitHub JSON storage or hosting. Authentication, server authorization, approved persistence, privacy/removal rules, timetable exceptions and deployment must be resolved before production service use. No new backend architecture is selected by this frontend implementation.
