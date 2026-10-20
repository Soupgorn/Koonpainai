# Koonpinai UI/UX audit

Scope: existing `/`, `/friends/[id]`, `/admin`, and `/admin/import`. The existing white/ink identity, Noto Sans Thai, subdued status tints, spacing rhythm, directory layout, and mobile agenda were retained. Frontend Design and the relevant Impeccable audit, hardening, and polish guidance informed this pass.

| Area | Finding | Change / verification |
| --- | --- | --- |
| Directory hierarchy | Names/status/course details are already the primary scan path; extra statistic cards would dilute it | Retained compact counts, search, filters, and grid/list layouts |
| Status truth | Small day strips must obey the same semester/current-session rules as badges | Strips use the schedule engine; no ongoing bars outside term; regression tests cover this |
| Clock context | A mobile time preview could look like live availability if its disclosure sits below the directory | Bangkok time and preview controls are above cards; active preview retains an explicit fictional-data label |
| Timetable readability | Seven columns cannot carry readable overlapping classes on narrow screens | Retained the desktop grid and switched mobile/tablet views to the day agenda; imported schedules reuse both |
| Import integrity | The old import reviewed hardcoded sample data and offered a demo publish action | Replaced with actual PDF text/OCR extraction, real source preview, explicit confirmation, and private JSON export |
| Import uncertainty | OCR confidence is not evidence that a field is correct | Actual confidence is labeled, uncertain fields are highlighted, missing/invalid values block approval, and original pages remain accessible |
| Term metadata | A document timestamp is not a teaching-date range | Term dates start empty and require valid reviewer input |
| Editor interaction | Binding a disclosure directly to its validation state could collapse it while the administrator typed | Expanded-row state is independent of validation; editing a field keeps its row open |
| Mobile forms | Small form text can trigger unwanted input zoom in mobile Safari | Mobile inputs use 16px text; new PDF controls provide 44px touch targets |
| Source navigation | A native PDF iframe gives uneven mobile controls and little connection to extracted rows | Added a PDF.js canvas viewer with page/zoom controls and row-to-source page links; source/editor stack below 900px |
| Loading and progress | A simulated extraction percentage would mislead users | Show actual processing stages and only measured OCR progress; retain existing route skeletons |
| Failure and recovery | Invalid, oversized, damaged, cancelled, or unrecognized documents must not produce a success state | Specific messages, cancellation, replacement/removal, retry, and explicit manual-entry recovery |
| Accessibility | The importer adds controls and a second rendering of a profile | Form labels, native disclosures, live status, focus, confirmation checkbox, a labeled canvas region, and an embedded profile heading below the page heading |
| Long content | Imported names and original filenames can be longer than fixtures | Names wrap; form/grid children have minimum-width constraints; zoom scroll stays inside the source panel |
| Privacy and publication | The visual workflow must not imply durable storage or permission to publish | Local-processing notice, private-preview text, no public publish button, no token, no upload endpoint, and production admin denial retained |

Automated checks use Chromium desktop/mobile journeys, 320px and tablet overflow checks, and Axe WCAG A/AA rules on the principal screens and review flow. These are bounded checks, not a claim of full accessibility certification or testing on every physical device. Screenshots use sanitized data; the real local PDF test disables visual artifacts.

Backend-only functionality remains deliberately unfinished: authenticated administration, GitHub JSON storage, and public schedule publishing. The existing `/admin` friend-management table is still a clearly labeled temporary demonstration.
