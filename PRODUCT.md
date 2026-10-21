# Koonpinai

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js 16 App Router, TypeScript, Tailwind/shadcn/Radix, Auth.js with the official KMITL Keycloak provider, Supabase PostgreSQL, Drizzle and Zod. Light/Dark/System use next-themes. Supabase Auth, university timetable APIs and PDF/OCR are not product dependencies.

## Users
KMITL students with individual SSO accounts. Administrators approve/suspend accounts; they have no timetable-edit override. No groups, invitations or friendship requests.

## Product Purpose
Find a break together. Students create and maintain their own weekly classes; approved members with the current sharing acknowledgement can see shared schedules and timetable-based availability.

## Operating Context
Quick mobile checks between classes and desktop weekly planning. English interface with Thai names. Preserve approved Contemporary Social Utility: geometric K, Manrope/Noto Sans Thai, periwinkle actions, green free, amber in class, stable muted subject colors and equivalent light/dark hierarchy. Mobile uses a day selector and agenda, never a squeezed grid.

## Capabilities and Constraints
Each student has one current semester with explicit start/end dates and recurring class entries. Course name, weekday and exact start/end times are required; course code, section and location are optional. Add/Edit/Delete persist through authenticated Server Actions. Same-day overlaps require explicit confirmation; exact duplicates are rejected, concurrency uses a locked revision. Changing semester dates keeps classes and is explicit. Historical multi-term archives are not implemented.

Profile completion and current acknowledgement are required to manage a timetable. Pending students can prepare privately. Suspended accounts cannot edit. Shared reads require viewer and target approval, profile completion and current acknowledgement. Missing timetable means unknown availability; a saved semester with no classes is an explicitly empty week. Asia/Bangkok schedules describe availability, not attendance or GPS.

Runtime and migration credentials remain separate. The server derives ownership from the verified Auth.js session, never a client member ID. Transaction-local RLS context supports the shared server role without Supabase JWT claims or auth.uid(). The dedicated role is trusted server infrastructure, never browser credentials.

## Policy and Privacy
Policy version 2026-10-22-student-v3 explains persistent student-entered timetable sharing and requires renewed acknowledgement. Earlier acknowledgements remain stored and are never automatically upgraded. Only nickname, programme, semester and class details are projected to eligible members; email and university identity are not shared. Local logout ends the application session, not necessarily KMITL SSO.

## Preview and Release Boundaries
Credential-free development alone permits explicitly fictional in-memory schedules. Preview edits reset on reload and never call persistence. Production has no preview bypass. Until the reviewed replacement migration is separately approved/applied, real accounts see a storage-not-enabled state, not simulated success.

## Accessibility & Inclusion
Written statuses, visible focus, Radix focus management, labeled native time/date fields, explicit delete confirmation, reduced motion, Thai support and AA theme contrast. Keep mobile touch controls at least 44px and show errors next to the task.

## Evidence and Open Work
See DATABASE_FIRST.md for schema, RLS/grants, isolated tests and migration plan. Existing account/security/backup evidence is preserved. Production migration, runtime credential cutover, Linux deployment and real SSO write canaries require separate approval. No production change is implied by local implementation or Git publication.
