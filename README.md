# Koonpinai / คุณไปไหน

Find a break together.

A Next.js application that calculates friends’ availability from class timetables in **Asia/Bangkok**. It includes an approved-account directory, KMITL OIDC sign-in, PostgreSQL account storage, and a **real, browser-side KMITL timetable PDF importer**. Availability describes the timetable, not attendance or GPS location. Directory schedules are still fictional; imported schedules are temporary until explicitly exported.

## Run locally

Use **Node.js 22.13+ or Node.js 24+**, with npm. PDF.js 6 requires the newer Node runtime.

```powershell
npm ci
npm run auth:check
npm run db:migrate
npm run dev
```

Configure the ignored `.env.local` using [.env.example](.env.example), then open [Login](http://localhost:3000/login). See [AUTH.md](AUTH.md) for approved-client settings, exact callback registration, database migration, admin bootstrap and the distinction between local logout and university SSO logout. New accounts must complete profile/policy steps and receive approval before shared timetable access.

For fictional UI review without credentials, leave all auth/database values empty and explicitly set `ENABLE_UI_PREVIEW=true` in development. This never bypasses production authorization and disappears as soon as any real credential is configured. Browser-side PDF processing itself needs no external paid OCR service.

`postinstall`, `predev`, and `prebuild` prepare the matching PDF.js worker, fonts, WASM files, Tesseract worker/core, and Thai/English language models in `public/vendor/`. These generated assets are ignored by Git. They are served by this app; OCR does not contact a paid service or CDN. Dependency installation requires npm network access; processing uses the installed, same-origin assets.

```powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Browser regressions start an isolated fictional child server on port 3100 with separate `.next-e2e` output and no credentials. They leave the configured app on port 3000 intact. To run only theme checks, use `npm run test:e2e -- tests/browser/themes.spec.ts`. `npm run test:auth:e2e` separately exercises the configured development app using disposable database members and synthesized test sessions; it does not prove a real KMITL login succeeded. See [AUTH.md](AUTH.md) for opt-in real PostgreSQL tests and verification limits.

## Pages

| Route | Functionality |
| --- | --- |
| `/` | Twelve fictional friends; English/Thai nickname search, availability filters, two-column free-window rows/list alternative, and a ruled in-class roster |
| `/friends/[id]` | Current availability, Monday–Sunday desktop timetable, mobile/tablet day agenda, exact class positions/overlaps, and class-detail dialogs |
| `/login` | Public entry; approved-client Auth.js/Keycloak sign-in when configured, disabled with an explanation otherwise |
| `/onboarding` | Authenticated profile setup saved to PostgreSQL |
| `/onboarding/policy` | Versioned sharing-policy acknowledgement saved to the account |
| `/pending-approval` | Actual pending/suspended account status, rechecked on the server |
| `/my-timetable` | Temporary personal timetable; can display a reviewed real import without publishing it |
| `/my-timetable/import` | Real browser-side PDF importer reused for the temporary personal timetable |
| `/account` | Persistent profile settings, local appearance preference, policy review and application logout |
| `/admin` | Temporary friend management; changes reset on reload and do not update the public directory |
| `/admin/access` | Admin-only persistent Pending/Approved/Suspended account management |
| `/admin/import` | Real PDF selection, text/OCR extraction, source preview, editable review, validation, private timetable/profile preview, and JSON export |

Shared directory/profile and personal timetable/import routes require an active application session, completed profile, current policy acknowledgement and approval. Admin routes additionally require an admin role. Pending members can still edit their account/profile and acknowledge policy. Server-side reads and actions enforce these checks independently of the optimistic proxy. The explicit credential-free development preview retains the old fictional flow; no flag bypasses configured or production access checks. Friend/schedule management remains a labeled temporary demo even for authenticated admins; only account/access data persists.

The public directory still contains twelve explicitly fictional friends. “Try a class-time preview” switches the app clock to Tuesday 20 October 2026 at 10:30 Bangkok time. The preview is labeled above the directory and can be switched back to the live clock. Imported timetable preview also discloses the selected clock; it does not label imported data as fictional.

## Interface and appearance

The approved **Contemporary Social Utility (Concept C)** composition puts free-window length first, followed by current course/room and next-class details. The geometric K wordmark, self-hosted Manrope with Noto Sans Thai fallback, near-white canvas, flat white surfaces, periwinkle actions and navy text replace the earlier Blue Mist treatment. Green availability and amber class states remain separate from six stable course-color identities. English is the interface language; Thai branding and names are supported.

Desktop uses two-column free-person rows and a ruled in-class roster. At 760px or less, the directory becomes one column and navigation moves to a fixed bottom bar; next-class time and course name remain visible. At 900px or less, weekly timetables switch to a day agenda. Mobile PDF review has Source/Review controls; desktop shows both panels. The original PDF retains its source colors in either theme.

Light, Dark and System appearance use `next-themes`. The default follows the operating system. The header Sun/Moon toggle and preference disclosure each have a 44px target; the disclosure offers labeled Light/Dark/System radio choices. Account preview offers the same preferences. Only this visual preference persists in local storage, under `koonpinai-theme`. A pre-hydration theme script, root hydration-warning suppression and mount-aware controls handle initial theme resolution.

Keyboard focus, written status labels, native labeled forms, Radix dialogs, a skip link and reduced-motion behavior are part of the interface. Contrast targets are 4.5:1 for normal text, 3:1 for large text, and discernible input/focus boundaries. Source tokens are in `src/app/redesign.css`, the approved composition is in `src/app/approved-design.css`, and importer/admin/shared styles remain in `src/app/globals.css`; the root layout loads globals, approved composition, then redesign overrides. See [DESIGN.md](DESIGN.md) for the implemented system.

## Import a real KMITL timetable

1. Export your timetable as a PDF, normally the visual weekly grid followed by detailed course records.
2. As an approved member, open `/my-timetable/import` (or `/admin/import` as an admin), select or drop **one PDF**, and choose **Read timetable**.
3. The app checks each page independently. Usable embedded text is read directly; image-only or insufficient-text pages run Thai and English OCR. Mixed documents are supported.
4. Compare the original PDF with each extracted session. Use the page controls, zoom, or a session’s page reference. On tablet widths the source and editor stack vertically; at mobile widths use Source/Review controls to switch panels.
5. Enter your chosen nickname and the **actual academic start/end dates**. The document’s creation date is never treated as the semester start.
6. Correct missing/uncertain fields. Add or remove sessions when needed, then confirm that you checked the records against the PDF.
7. Preview the weekly timetable or the existing friend-profile UI. Download the validated JSON.

There is **no public publish action**. Reloading or leaving the import page clears the importer state. Downloading JSON does not save anything to a server or modify the public directory. In `/my-timetable/import`, a validated, explicitly reviewed preview can also be applied with **Use in my temporary preview**. That timetable remains in the in-memory personal provider during client navigation and resets on reload; it is never added to the public directory.

### File and resource limits

- PDF extension, MIME type when supplied, header, and size are checked before processing.
- Default maximum: **10 MiB**, **20 pages**, and **14 million rendered pixels per OCR page**.
- `NEXT_PUBLIC_PDF_MAX_MB` can set a build-time limit from 1 to 50 MiB. This setting is public configuration, not a secret.
- A three-minute processing limit prevents a document from running indefinitely. Password-protected or damaged PDFs produce an error.
- Cancellation stops the active render, initialized OCR worker, and PDF task. If cancellation occurs during Tesseract initialization, the UI stops immediately and terminates that worker when initialization resolves; startup itself is not always immediately interruptible.

## Extraction architecture

```text
Selected File
  -> validate type, size, header
  -> lazy-load PDF.js and its same-origin worker
  -> inspect every page's positioned text
       -> usable text: preserve text items and PDF-point coordinates
       -> insufficient text: render page -> lazy-load Thai + English OCR
  -> normalize coordinates to PDF points, top-left origin
  -> reconstruct KMITL detailed rows and columns
  -> retain every individual session and source-page reference
  -> edit + Zod validation + reviewer confirmation
  -> canonical JSON + existing timetable/profile preview
```

### PDF reading and OCR

`src/lib/pdf/process-pdf.ts` owns the document, render task, cancellation signal, progress, and OCR worker. One OCR worker is reused across scanned pages, then terminated. PDF tasks are destroyed and temporary canvases cleared. No selected-file bytes or extracted text are sent to an application endpoint, persisted to browser storage, or logged by the application.

OCR uses `tesseract.js` with the `tha` and `eng` LSTM language models. It runs in a Web Worker using WASM, with model caching disabled. Progress percentages are shown only when the engine reports measured recognition progress. Embedded-text pages have no fabricated confidence score. OCR page/field confidence comes from recognized words and only prioritizes human review; it is not a correctness guarantee.

The source preview also uses PDF.js. It is a separate, disposable document instance so changing source pages cannot cancel extraction or leak a shared render task.

### KMITL parser

`src/lib/pdf/kmitl-parser.ts` prefers the detailed course table. It groups code anchors into rows, reconstructs name/section/day-time/room columns from position, and reads multiple time lines in one row as separate sessions. It handles Thai/English weekdays, Thai numerals, wrapped names, non-hour-aligned times, section changes, and OCR spacing.

The visual grid is secondary context. Course codes seen there but missing from detailed rows produce a warning. The parser does **not** invent precise start/end times from a visual block’s approximate width. A visual-only or unrecognized layout can require manual session entry; no successful timetable import is claimed when reliable detailed records are absent.

No distinct sessions or sections are silently merged. Potential duplicates and overlaps are retained for review. A missing range dash can be reconstructed from two positioned times in the day/time cell, with both time fields marked for review. Ambiguous code characters are retained and fail validation instead of being silently changed into digits. Unknown weekdays remain unselected.

### Canonical JSON and validation

`src/lib/pdf/schema.ts` defines Zod schemas for semesters, sessions, and the export envelope. The weekday convention is **0 Sunday, 1 Monday, …, 6 Saturday**.

```json
{
  "schemaVersion": 1,
  "timeZone": "Asia/Bangkok",
  "weekdayConvention": "0=Sunday,1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday",
  "nickname": "Fictional friend",
  "semester": { "name": "Semester 1 / 2026", "start": "2026-08-03", "end": "2026-12-13" },
  "sessions": [
    { "id": "page-2-row-1-session-1", "code": "01000001", "name": "Fictional course", "section": "101", "day": 5, "start": "08:45", "end": "10:15", "room": "TEST-305", "color": 0 }
  ]
}
```

Dates above are illustrative. Validation requires a real calendar date range, an eight-digit course code, required names/sections/rooms, valid weekdays, exact `HH:mm` times, an end after the start, and unique session IDs. Export projects only the canonical fields: original filenames, full extracted text, student headers, instructor details, and OCR evidence are excluded.

Sessions use the existing `ClassSession` keys (`code`, `name`, `section`, `day`, `start`, `end`, `room`, `color`) and feed the unchanged Bangkok schedule engine. Preview uses them locally without claiming that the schedule is published.

## Testing

Sanitized PDFs are generated in memory from [authored fixtures](tests/fixtures/pdf-fixtures.ts); no real student PDF is committed. Tests cover text extraction with positions, image-only pages, real Thai/English OCR, mixed-page processing, row reconstruction, multiple sessions/sections, classroom preservation, wrapped names, irregular times, missing/uncertain values, invalid ranges, schemas, rendering, editing, confirmation, downloads, cancellation, and Bangkok status boundaries.

The supplied two-page image-only KMITL sample was also verified locally through the browser importer. Both pages ran OCR; its eight detailed rows produced nine sessions, including Friday **08:45–10:15** and **10:30–12:00**, separate sections, and **12:00/16:00** end times. The source and derived inspection files remain ignored and are not part of the repository.

To rerun that optional local verification against the same timetable structure:

```powershell
$env:KOONPINAI_TEST_PDF = 'C:\Path\To\Your\private-timetable.pdf'
npm run test:e2e -- --grep 'optional local KMITL'
Remove-Item Env:KOONPINAI_TEST_PDF
```

The optional test expects two scanned pages and the known nine-session examples above. It is skipped when the variable is absent. Its screenshots, video, and traces are disabled. Normal sanitized browser tests save ignored screenshots to `.impeccable/review/`; failed sanitized tests may save ignored traces to `test-results/`.

See [UI_AUDIT.md](UI_AUDIT.md) for the UI review and refinements, [DESIGN.md](DESIGN.md) for visual tokens, and [PRODUCT.md](PRODUCT.md) for product constraints.

## Known extraction limits

- This is a layout-aware parser for the observed KMITL detailed table, not a universal PDF table extractor. New exports, highly merged columns, rotated/handwritten pages, missing course-code columns, or very poor scans can need manual correction.
- Thai OCR can lose a weekday, diacritic, digit, or separator. Missing/invalid values block preview/export; uncertain values are highlighted and require the reviewer’s explicit confirmation.
- The parser does not derive academic teaching dates from a screenshot timestamp or assume an institution-wide calendar. Confirm the term dates yourself.
- The visual grid does not supply trustworthy exact times when the detailed page is absent. It is used for coverage warnings, not fabricated precision.
- The schedule engine models recurring weekly classes within a term. Cancellations, holidays, exam exceptions, attendance, and physical location are not inferred.

## Account persistence and production

| Environment setting | Current behavior |
| --- | --- |
| `AUTH_URL`, `AUTH_SECRET`, `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET` | Server-only Auth.js configuration; canonical HTTPS origin required in production |
| `AUTH_KEYCLOAK_ISSUER` | Optional explicit value; must match the pinned official KMITL issuer |
| `DATABASE_URL`, optional `DIRECT_DATABASE_URL` | PostgreSQL runtime and migration connections; never public variables |
| `ENABLE_UI_PREVIEW=true` | Fictional development UI only when all real credentials are absent; never a production bypass |
| `NEXT_PUBLIC_PDF_MAX_MB` | Public, build-time PDF size limit from 1 to 50 MiB; defaults to 10 MiB |
| `KOONPINAI_TEST_PDF` | Optional local test input only; never a production setting or a committed private file |

Without a valid session, private pages redirect to `/login`; incomplete configuration leaves the SSO action disabled and auth endpoints fail closed. A partially configured installation never falls back to fictional access. The obsolete `ENABLE_ADMIN_DEMO` flag no longer grants access.

Auth.js uses the official Keycloak provider with pinned OIDC discovery, Code Flow + PKCE S256/state/nonce, independently verified ID-token signatures, encrypted JWT application sessions and database revocation. Identity is the unique validated issuer/subject pair. First login creates a pending account; later logins reuse it. Profiles, versioned policy acknowledgement and access status persist through Drizzle/PostgreSQL. Local logout clears and revokes the application session; it does **not** terminate KMITL SSO. Full RP-Initiated Logout awaits verified client post-logout registration and token-hint requirements.

Live discovery and PostgreSQL connectivity/migration were verified locally. The real browser SSO attempt encountered **502 Bad Gateway on `sso.kmitl.ac.th`**; successful callback/token exchange and real-user creation remain unverified. Mock OIDC tests and synthesized-session browser tests are reported separately in [AUTH.md](AUTH.md). Before production, complete that live approved-client test, verify HTTPS/proxy/callback settings, bootstrap trusted administrators, review policy/privacy/removal rules and operate backups/rate limits/session cleanup. Timetable persistence/publishing, GitHub JSON storage and the KMITL timetable API remain separate future work. Original PDFs stay local. Pages use `noindex` metadata.

No database credentials, API keys or GitHub access token are included. GitHub source-code publication is separate from publishing a user’s timetable data. This documentation update does not publish, commit, push or deploy the app.
