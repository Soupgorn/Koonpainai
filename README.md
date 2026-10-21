# Koonpinai

A Next.js application that calculates friends’ availability from class timetables in **Asia/Bangkok**. It includes an approved-account directory, KMITL OIDC sign-in, PostgreSQL account storage, and a **real, browser-side KMITL timetable PDF importer**. Availability describes the timetable, not attendance or GPS location. Configured users see an empty Friends workspace until a real shared-timetable adapter is implemented. Fixture friends exist only in explicit credential-free development mode; imported schedules remain temporary and can be explicitly exported.

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
| `/` | Authorized Friends workspace; honest empty state for configured users, development-only fixture rows, nickname search and availability filters |
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

Shared directory/profile and personal timetable/import routes require an active application session, completed profile, current policy acknowledgement and approval. Admin routes additionally require an admin role. Pending members can still edit their account/profile and acknowledge policy. Server-side reads and actions enforce these checks independently of the optimistic proxy. Only the explicit credential-free development preview exposes fixture friends; no flag bypasses configured or production access checks. Friend/schedule demo management appears only in the development preview. Configured administrators see the shared-timetable empty state and retain real account/access management; only account/access data persists.

The server-only friends repository returns fixture records only when the explicit credential-free development preview is enabled; configured users see **No shared timetables yet**. No real shared-timetable adapter exists. The development sample badge appears only in that mode. **My Timetable always starts empty**, including development preview; a reviewed real import can populate its temporary in-memory state. The live Asia/Bangkok clock remains, while the former preview-time control and fixed fictional clock are removed.

## Interface and appearance

The approved **Cloud & Sky** system now applies across every existing route. Mali supplies headings and Kodchasan supplies body/UI and timetable data, loaded once in the root layout through `next/font/google` with Thai/Latin subsets and existing Noto Sans Thai fallback coverage. The shadcn preset `b3FNbq6SRM` remains the Nova/Radix component foundation; the final global palette, fonts and penguin identity replace its earlier appearance. No dependencies were added for the migration.

Light mode uses canvas `#F5F8FE`, white cards, navy ink `#1E2A44`, brand blue `#3E79C8` and soft blue `#E5EFFB`. Primary actions use `#326DB5` with white text (5.26:1), hovering to `#285B9B`. Dark mode derives navy canvas `#101C2E`, cards `#182941`, light ink `#EDF5FF` and readable blue links `#9CC9FF`. Green availability and amber class states remain distinct from six stable course-color identities. Shared controls use a 14px base radius, light rules and restrained elevation.

The exact official name is **Koonpinai**. Reusable `BrandMark`, `BrandLogo` and `AppIcon` components use the approved pastel-blue peeking penguin. Its hand-traced true-vector master is `public/brand/koonpinai-mark.svg`; horizontal static wordmarks use outlined Kodchasan lettering, while the UI name stays accessible live text. `node scripts/generate-brand.mjs` reproduces the seventeen SVG/PNG assets and four ICO frames from the same master using the existing canvas dependency. See [brand asset documentation](public/brand/README.md) and [provenance](public/brand/provenance.json). Internal OAuth/database/storage/environment identifiers remain compatible.

The root metadata uses default title **Koonpinai**, page template **%s | Koonpinai**, the generated favicon and Apple touch icon. There is no existing manifest, PWA subsystem or public social-sharing metadata; exported icons do not imply installability.

The compact penguin navbar and 1160px desktop working area frame search, filters and available schedule data. At 760px or less, free-person rows become one column and navigation moves to the bottom bar; current/next-class lines and account-access controls remain readable. At 900px or less, weekly timetables become a day agenda. Mobile PDF review offers Source/Review controls; desktop shows both panels. Source PDFs retain their original colors. Decorative footer, promotional slogans and preview-time controls are removed from actual rendering.

Login preserves the centered single-card composition, fluid up to 420px, with safe-area padding and no application navigation, footer, demonstration panel or preview links. It uses the same Cloud & Sky/Mali/Kodchasan system, pinned to light appearance under either OS theme. The penguin and **Koonpinai** wordmark accompany **เวลาว่างตรงกัน** / **เจอกันง่ายขึ้น** and **เช็กตารางเรียน หาเวลาว่างของเพื่อน** / **แล้วนัดเจอกันได้ง่ายกว่าเดิม**. **Continue with KMITL SSO** submits the original action; unavailable, error and pending states remain honest, with duplicate submissions disabled and **Connecting to KMITL…** announced. Existing authentication/session/security behavior is preserved.

Other routes retain Light/Dark/System through `next-themes`, OS default, 44px header targets and the existing `koonpinai-theme` preference key. Login does not change that preference. Keyboard focus, written statuses, native labeled forms, Radix dialogs and skip navigation remain. Native person/directory transitions use `useMotionAllowed` to bypass participation for reduced motion; CSS removes remaining animations/transitions. Contrast targets remain 4.5:1 normal text, 3:1 large text and discernible control/focus boundaries.

Shared primitives live in `src/app/globals.css`; semantic extensions and effective geometry live in `src/app/redesign.css`, layered after inherited `src/app/approved-design.css`. Login's light composition is in `src/app/login/login.css`. See [DESIGN.md](DESIGN.md) for current tokens and component rules. Final verification results are reported separately; this documentation does not assert test pass counts.

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
