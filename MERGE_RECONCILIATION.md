# Main / database-first reconciliation

Prepared locally on 22 October 2026. **No commit, push, main merge, deployment or production database operation was performed.**

## Diagnosis and recovery

The original checkout is `D:\Project\Koonpinai`, on `feat/database-first-timetables`. There was no active merge, no MERGE_HEAD and no unresolved index entry there. It contains an unrelated generated `next-env.d.ts` edit and untracked operational/security evidence. Those files were preserved rather than stashed, overwritten or added to this integration.

| Reference | Commit | Meaning |
| --- | --- | --- |
| Local main / common ancestor | `682f7ef4f7006147fcab642ba046235a9d62a8c5` | Previous authentication baseline; local main is one remote commit behind |
| Fresh origin/main / origin/ux-ui/improvement | `8ca7b13a98746938fe5976624031ef17cee50c3d` | Authoritative Cloud & Sky / penguin / login improvements |
| Feature / origin/feat/database-first-timetables | `c442f10acebcc23ccad21bdae1dbe271d2746fa6` | Student-owned timetables and runtime hardening |

The branches each added one commit after the common ancestor. A normal trial merge exposed **23 conflicting files**, including two modify/delete conflicts. Main rewrote shared presentation and temporary personal timetable behavior while the feature, based on the previous design, replaced timetable persistence, import and ownership behavior. These were semantic conflicts as well as text conflicts: simply choosing the feature would regress main's approved identity; simply choosing main would lose persistence and security work.

The integration lives in a separate worktree, **`D:\Project\Koonpinai-reconcile-1792608903178`**, branch **`fix/main-database-first-reconcile-1792608903178`**, created from origin/main. The merge of the feature is resolved and staged, but deliberately **uncommitted** on that branch. Main itself was not merged or moved.

Recovery refs preserve the three starting commits:

- `recovery/reconcile-1792608903178-main`
- `recovery/reconcile-1792608903178-remoteMain`
- `recovery/reconcile-1792608903178-feature`

The original private recovery directory `.private/merge-review-1792608903178` contains the initial status, dirty/untracked file hashes and trial-merge output. The original checkout also records the worktree in `.private/current-reconcile.json`. No reset, force update, blanket ours/theirs resolution or history rewrite was used.

## Conflict decisions

| Conflicting file | Reconciliation |
| --- | --- |
| `.impeccable/direction.md` | Keep main's Cloud & Sky/penguin direction; update only the obsolete import/backend claims |
| `DESIGN.md` | Keep main's palette, typography, composition and light login; describe the new owner editor and preview boundaries |
| `PRODUCT.md` | Keep main's brand/product constraints; reconcile persistence, policy, approvals and student ownership |
| `README.md` | Current database-first setup and operational safeguards, plus main's design/brand tooling; remove obsolete PDF instructions |
| `package-lock.json` | Regenerate from main's lock and the reconciled manifest; preserve common pinned versions, remove PDF/OCR packages |
| `src/app/(preview)/my-timetable/import/page.tsx` | Delete: intentionally retired PDF route, not a missing new feature |
| `src/app/(preview)/my-timetable/page.tsx` | Main's title with authenticated database-first personal loader; pending students can prepare privately after profile/current policy |
| `src/app/admin/page.tsx` | Main's Admin title; use the feature's read-only member timetable links and existing account approval UI |
| `src/app/approved-design.css` | Preserve main exactly |
| `src/app/globals.css` | Preserve main exactly |
| `src/app/layout.tsx` | Preserve main exactly: fonts, metadata, penguin chrome, actual account props and no footer |
| `src/app/page.tsx` | Main's Friends metadata with authorized shared/own database loaders |
| `src/app/redesign.css` | Preserve main's entire existing stylesheet, append only token-based editor/help styles; use main's discernible input borders |
| `src/components/account-screens.tsx` | Main's composition and explicit temporary previews; replace PDF copy with student ownership and add Manage my timetable |
| `src/components/friend-profile.tsx` | Main's compact header/avatar transitions and summary; nullable semesters, owner controls and edit callbacks; no restored preview clock/footer notes |
| `src/components/friends-directory.tsx` | Main's compact workspace, search/filters, row composition and reduced-motion ViewTransitions; real personal data and sample-only fixture label transformations |
| `src/components/personal-preview-provider.tsx` | Retain temporary profile/policy preview state; remove obsolete imported timetable state |
| `src/components/shared.tsx` | Preserve main exactly, including accessible statuses and motion-aware avatars; do not restore PreviewControl |
| `src/components/site-header.tsx` | Preserve main exactly, including penguin, active navigation and theme controls |
| `src/components/weekly-timetable.tsx` | Preserve main's empty-state language/grid/agenda/detail interaction; replace import CTA with owner editor controls, retain exact times/overlap lanes and missing-field safety |
| `src/lib/friends-repository.ts` | Feature's server-only authorized Drizzle reads and missing-storage handling; personal development preview starts empty as main requires |
| `tests/browser/themes.spec.ts` | Main's theme/login/accessibility regressions retained; retire tests for removed PDF and admin timetable editing; new editor tests cover the replacement |
| `tests/fixtures/pdf-fixtures.ts` | Delete: obsolete sanitized PDF fixture only |

Additional integration fixes:

- Restore `@napi-rs/canvas` **as a development dependency**: main's deterministic penguin export script still uses it. Do not restore PDF.js, Tesseract or PDF-lib. The native canvas import/render check passed.
- Preserve main's brand/font/login tests while replacing the obsolete Update/import assertion with empty personal timetable, Set semester and disabled Add class checks.
- Test the personal editor from an empty semester instead of borrowing another fictional student's classes.
- Wait explicitly for the cold friend-profile route to finish navigating before checking its content. The first parallel build/browser run exposed a five-second development compilation timing failure; the complete corrected suite passed.
- Update current documentation to remove contradictory PDF/API-first and old design claims. Historical API documents and the old unapplied proposal are clearly retired, not active execution guidance.

## Preserved security and database architecture

Main's Auth.js configuration, KMITL Keycloak issuer/discovery/PKCE, encrypted sessions, fresh revocation checks, admin/profile flows, proxy and account repository remain intact. The feature's certificate/hostname-validated database client, max-two runtime pool, separate operational credentials, guarded migration runner and managed shutdown remain intact. No TLS verification bypass was introduced.

Students mutate only their own classes through authenticated Server Actions. The server derives ownership from the validated session, rechecks policy/status under transaction locks and supplies transaction-local RLS context; no client member ID or Supabase Auth claims establish ownership. Administrators have no peer timetable edit override. Shared reads exclude pending/suspended/incomplete/old-policy members. Missing storage remains unavailable, not fabricated free time.

Policy `2026-10-22-student-v3` requires renewed acknowledgement. Existing stored acknowledgements are preserved; they are not silently upgraded. One current semester is supported per student. Overlaps require explicit acknowledgement, exact duplicates are rejected, and revision checks prevent stale overwrites.

`0000` and `0001`, including their journal prefix, are unchanged. The only active idx2 is `0002_student_timetables`; the obsolete API-first proposal is archived outside Drizzle's active folder. The new proposal and rollback are unchanged from the feature:

| Artifact | SHA-256 |
| --- | --- |
| `drizzle/0002_student_timetables.sql` | `3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a` |
| `operations/student-timetables.rollback.PROPOSED.sql` | `3fa7a0f7ac71748456b0ca205f7640020e7b2fc8bb27790e48ca59278a7324ff` |

**No production ledger, database, role, RLS policy, grant, credential, account, session or backup was accessed or changed during this reconciliation.** Production application of the replacement migration needs separate fresh preflight, backup/restore evidence and approval. If any environment already applied the old idx2, stop and prepare a forward migration instead.

## Verification on the reconciled result

| Check | Result |
| --- | --- |
| Clean dependency install / lock reconciliation | PASS; Next 16.4.2, React 19.3.1, canvas 1.0.11; no PDF/OCR packages |
| TypeScript | PASS |
| ESLint | PASS |
| Unit/security/TLS suites | 58 PASS, 1 production-configured database test deliberately skipped |
| Desktop/mobile browser suite | 34 PASS, including main's brand/login/motion checks and new owner editor |
| Automated WCAG-tagged accessibility checks | PASS in tested light/dark routes and editor states; 320/390/768/1024/1440 layout coverage |
| PostgreSQL 17.11 isolated Auth.js/account canaries | 12 groups PASS; external OIDC mocked |
| Isolated exact migration/RLS/CRUD/rollback | 13 groups PASS; verified TLS 1.3; owner/admin denials, concurrency and cleanup |
| Actual built Next Server Actions + restricted PostgreSQL | 4 groups PASS; create/edit/reload/delete, peer/pending restrictions and revoked session denial |
| Runtime secret/pool/drain/rollback rehearsal | 8 groups PASS; failed candidate leaves old process healthy, in-flight request drains, clients close, distinct same-policy artifact rollback |
| Secret-free production build / standalone package | PASS; current policy pinned, no startup migration or production connection |
| Production-mode auth smoke, fixture configuration only | PASS; redirects, preview refusal, canonical callback, cookie flags, host rejection and anonymous session |
| Conflict markers, unmerged index and whitespace | PASS |
| Original working files and branch refs | Verified against initial recovery snapshot; no unrelated changes discarded |

The first standalone auth smoke attempt timed out during concurrent build/browser work. A fixture-only diagnostic returned HTTP200 with no startup errors, and the final artifact's complete smoke check passed. No production configuration or authentication was used for that investigation.

The final secret-free Windows artifact is outside Git:

`C:\Users\supakorn\AppData\Local\Temp\koonpinai-artifact-edb22c0b-d2b4-49f5-99f5-e4698fb1069b\artifact`

Manifest SHA-256: `9bda2a38728c514eaea764ca834249ec60bb31d7f396d00cd70535f5342df4a0`.
Build-input digest: `7c8409971e38951ef350d419f486dc50b09dc28ad195677825b792e97a25925b`.

Final synthetic database evidence is retained privately in this worktree at `.private/database-readiness/phase3-runtime-isolated-1792610243944.json`. It records no production connection, successful exact cleanup, stopped local PostgreSQL and DPAPI-sealed fixture working files. External university OIDC was mocked or the browser used synthetic encrypted sessions. This is **not live KMITL SSO verification**. Windows IPC invoked the shared shutdown handler; Linux Docker/POSIX SIGTERM deployment is not certified by this run.

Rendered desktop/mobile light/dark screenshots are ignored local review artifacts:

- `.impeccable/review/approved-redesign/final/` — dashboard, friend profile, My Timetable, account, approval and admin states
- `output/database-first/` — editor, overlaps and owner timetable states
- Main's existing login screenshot checks remain in `tests/browser/login.spec.ts`.

Frontend-design and the installed Impeccable context/craft workflow were used to preserve main's visual authority. The single manual detector pass reported 79 advisory font/radius findings in inherited main CSS, none in the appended editor or reconciled components; these do not justify an unrelated redesign. The Impeccable JSON design sidecar is older than the amended Markdown context; it was preserved rather than regenerated without a design-system request.

## Readiness and remaining boundaries

**Source integration: GO for review/local merge commit.** All conflicts are resolved and staged on the isolated fix branch. This does not authorize merging main or publishing.

**Production migration / runtime cutover / deployment: NO-GO under this task.** The new schema is still a proposal. Fresh production backup/security review, approved canaries, target Linux/container lifecycle and rollback tests, runtime secret delivery, capacity assurance and provider-managed upstream transport questions remain separately gated. The strict forward launcher still targets the reviewed Supabase Session Pooler; future self-hosted CloudStack PostgreSQL needs a separately validated target configuration, not weakened TLS checks.

The original checkout retains untracked operational evidence and its generated file edit. Do not `git add .` there or discard those files to make it clean. This review did not audit or publish private operational evidence as application code.

## Exact next Git commands

Review the prepared index in the isolated worktree:

```powershell
Set-Location 'D:\Project\Koonpinai-reconcile-1792608903178'
git status
git diff --cached --check
git diff --cached --stat
git diff --cached
```

After reviewing, the following creates the pending merge commit **on the fix branch only** (not executed):

```powershell
git commit -m "Reconcile main design with student-owned timetables"
```

Before any subsequent main integration, fetch and verify origin/main is still an ancestor of the reviewed fix commit. If it advanced, reconcile and rerun relevant checks. Obtain owner approval before merging into main or pushing. No force push or reset is needed.
