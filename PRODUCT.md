# Koonpinai

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-requested Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui and Lucide React. Typed local mock data; no database.

## Users
Approximately 50 university friends, primarily KMITL students, checking who has class and when they can meet. One administrator manages timetables.

## Product Purpose
Answer where friends have class, what they study, and when they are free, without messaging everyone individually.

## Positioning
Availability is calculated from weekly academic timetables in Asia/Bangkok. This is not GPS tracking.

## Operating Context
Quick checks between classes on phones; weekly planning on larger screens. The local administrator interface reads KMITL timetable PDFs, supports review and correction, and exports private schedules. Authenticated publishing is future work.

## Capabilities and Constraints
Public browsing needs no account. Search nicknames, filter availability, inspect current/upcoming classes and weekly schedules. Respect exact class boundaries, semester dates, empty days and overlapping classes. PDF.js reads positioned text; Thai/English OCR handles scanned pages locally. Review, validation, timetable/profile preview and JSON export are functional. Friend management remains temporary. No database, client secrets, fabricated extraction, or permanent schedule storage. Private PDFs and derived inspection data stay out of Git. Production writes require server-side authorization; admin routes are disabled by default in production. Source-code publication to the requested GitHub repository is explicitly authorized by the user.

## Brand Commitments
Koonpinai / คุณไปไหน. “Where are your friends?” Premium, minimalist, primarily black and white; contemporary editorial sans-serif typography supporting Thai, restrained semantic colors, purposeful motion. User references: Linear, Vercel, Raycast; do not copy them.

## Evidence on Hand
Fictional public records and sanitized generated PDF fixtures. A user-supplied two-page scanned KMITL PDF was tested locally without committing the original or derived private data. Its detailed table yielded nine individual sessions. No persistence backend or authentication exists yet.

## Product Principles
- A glance should answer who is free.
- Timetable truth and explicit demo boundaries come first.
- Prioritize mobile readability and maintainable, small components.

## Accessibility & Inclusion
Keyboard operation, strong contrast, visible focus, text status labels, reduced motion, and intentional mobile layouts.

## Open Decisions
Working assumption after optional language clarification: English interface with Thai branding and fictional Thai nicknames. Deployment destination and real administrator identity provider are undecided.
