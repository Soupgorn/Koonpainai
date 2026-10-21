# Koonpinai V3 implementation plan

Goal: migrate the existing application to the approved penguin, exact Koonpinai name, Cloud & Sky and Mali/Kodchasan across every real route.
Spec: /home/stars/.codex/attachments/221f883a-7473-4431-a893-779a1eb19d12/Pasted text.txt

Approved design: pale blue #F5F8FE, white #FFFFFF, navy #1E2A44, accent #3E79C8, soft blue #E5EFFB, support #56657B. AA action #326DB5. Mali headings, Kodchasan UI and timetable data. Existing dark preference uses derived navy surfaces; login retains approved light treatment. Penguin is the only expressive signature; no new marketing or decorative panels.

Boundaries: one master mascot SVG, deterministic asset generator, reusable BrandMark/BrandLogo/AppIcon components; existing shared CSS token layers are edited rather than adding a theme. Root fonts apply everywhere; route metadata uses existing Next metadata API. Existing page components keep their forms/actions/model calculations. Fixture records stay exclusively in explicit credential-free development mode; no fabricated replacement backend or new database schema. No SSO/session/storage identifier migration, credentials, production changes or deployment.

- [x] Capture old actual pages and observe failing brand/cleanup check.
- [x] Trace approved penguin; generate vector lockups/monochromes, PNG sizes, ICO and provenance. Replace K asset/component; configure metadata and actual route titles.
- [x] Promote Mali/Kodchasan and approved semantic palette globally. Preserve status/course meanings, contrast and theme behavior.
- [x] Remove actual footer, preview-time controls and highlighted slogans. Refine Friends, timetable empty/full views, account/onboarding/admin/import/error/loading views through shared styles and focused markup changes.
- [x] Add regression checks for exact brand, assets, fonts/colors, removed content, all route layouts and isolated fixture data; update changed UI expectations without weakening business tests.
- [x] Run focused tests, native Playwright desktop/mobile/all required widths and Axe; fix concrete failures in one batch; production build, lint, types, unit tests.
- [x] One mechanical detector; fresh finish review and focused correctness/security review; document final global system and verification limits; deliver actual screenshots/report.

Acceptance: all existing page surfaces use the new global tokens/fonts and mascot; no old visible names/K/footer/highlighted blocks; accessible functional controls retained; no fixtures presented as live records; assets valid and load; real SSO and APIs unchanged. Successful live SSO, live database and real shared timetable backend availability are reported separately from UI verification.
