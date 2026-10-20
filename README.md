# Koonpinai / คุณไปไหน

Find your people. Catch a break together.

A Next.js application that calculates friends’ availability from class timetables in **Asia/Bangkok**. It includes a responsive public directory and a **real, browser-side KMITL timetable PDF importer**. Availability describes the timetable, not attendance or GPS location.

## Run locally

Use **Node.js 22.13+ or Node.js 24+**, with npm. PDF.js 6 requires the newer Node runtime.

```powershell
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000), then [Admin Import](http://localhost:3000/admin/import). No database, API key, or account connection is needed for local processing.

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

Browser tests reuse a development server on port 3000 or start one. Stop a production server on that port before running them: production deliberately disables admin routes by default.

## Pages

| Route | Functionality |
| --- | --- |
| `/` | Fictional friend directory, English/Thai nickname search, availability filters, grid/list views, current course/room/end time, and next class |
| `/friends/[id]` | Current availability, Monday–Sunday desktop timetable, mobile/tablet day agenda, overlapping classes, and class-detail dialogs |
| `/admin` | Temporary demonstration of friend management; changes reset on reload and do not update the public directory |
| `/admin/import` | Real PDF selection, text/OCR extraction, source preview, editable review, validation, private timetable/profile preview, and JSON export |

The public directory still contains twelve explicitly fictional friends. “Try a class-time preview” switches the app clock to Tuesday 20 October 2026 at 10:30 Bangkok time. The preview is labeled above the directory and can be switched back to the live clock. Imported timetable preview also discloses the selected clock; it does not label imported data as fictional.

## Import a real KMITL timetable

1. Export your timetable as a PDF, normally the visual weekly grid followed by detailed course records.
2. Open `/admin/import`, select or drop **one PDF**, and choose **Read timetable**.
3. The app checks each page independently. Usable embedded text is read directly; image-only or insufficient-text pages run Thai and English OCR. Mixed documents are supported.
4. Compare the original PDF with each extracted session. Use the page controls, zoom, or a session’s page reference. On smaller screens the source and editor stack vertically.
5. Enter your chosen nickname and the **actual academic start/end dates**. The document’s creation date is never treated as the semester start.
6. Correct missing/uncertain fields. Add or remove sessions when needed, then confirm that you checked the records against the PDF.
7. Preview the weekly timetable or the existing friend-profile UI. Download the validated JSON.

There is **no public publish action**. Reloading or leaving the import page clears its state. Downloading JSON does not save anything to a server or modify the public directory.

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

## Production and future persistence

Production admin URLs return **404 by default**, and the Admin link is hidden. For an intentional local-only production preview, set `ENABLE_ADMIN_DEMO=true` **before building and starting**. This flag enables the temporary management/import UI; it is not authentication. It must never authorize a future server write API.

Remaining production work:

1. Add real administrator authentication and server-side authorization for every data mutation.
2. Implement the private GitHub JSON adapter with server-only credentials, schema validation, safe concurrent updates, cache invalidation, and recoverable publish errors. The current async read boundary is `src/lib/friends-repository.ts`.
3. Add a deliberate authenticated approval/publish flow. Do not upload original PDFs automatically.
4. Test additional KMITL export variants and decide the model for timetable exceptions.
5. Replace the fictional public records with approved schedules and define privacy/removal rules. Sample pages intentionally use `noindex` metadata.

No database or GitHub access token is included. GitHub source-code publication is separate from publishing a user’s timetable data.
