---
name: Koonpinai
description: The approved Contemporary Social Utility interface for finding a break together.
colors:
  background: "#f7f8fb"
  foreground: "#24263c"
  card: "#ffffff"
  surface: "#ededfc"
  surface-hover: "#f0f0fa"
  primary: "#5657c8"
  primary-hover: "#4545ad"
  primary-foreground: "#ffffff"
  border: "#dfe2eb"
  border-hover: "#a5a6d9"
  input-border: "#8b93a8"
  muted: "#62677b"
  focus: "#5657c8"
  free: "#206443"
  free-bg: "#edf6ef"
  class: "#885a17"
  class-bg: "#faf2e4"
  danger: "#a93832"
  danger-hover: "#8a2b26"
  danger-bg: "#fbf0ef"
  warning-border: "#a97121"
  warning-surface: "#fff9ee"
  class-marker: "#a36c1b"
  status-neutral: "#eceef4"
  ribbon-session: "#c6c7e6"
  ribbon-ongoing: "#ba8d42"
  overlay: "#11182788"
  selection: "#d8daf8"
  today: "#f5f5fe"
  avatar-0-bg: "#ececfc"
  avatar-0-fg: "#4d4fb2"
  avatar-1-bg: "#f7ece6"
  avatar-1-fg: "#95513b"
  avatar-2-bg: "#e8f1f1"
  avatar-2-fg: "#38676b"
  avatar-3-bg: "#f6efda"
  avatar-3-fg: "#806128"
  course-0-bg: "#ebf0ed"
  course-0-text: "#3d5b48"
  course-1-bg: "#faf1dd"
  course-1-text: "#70501d"
  course-2-bg: "#ebedf9"
  course-2-text: "#4e5186"
  course-3-bg: "#f3ebf0"
  course-3-text: "#775269"
  course-4-bg: "#e8eff5"
  course-4-text: "#3f6277"
  course-5-bg: "#f4ece6"
  course-5-text: "#7c5740"
  dark-background: "#101725"
  dark-foreground: "#edf0fa"
  dark-card: "#182132"
  dark-surface: "#252b47"
  dark-surface-hover: "#232e43"
  dark-primary: "#b3b3ff"
  dark-primary-hover: "#c9c9ff"
  dark-primary-foreground: "#171a2d"
  dark-border: "#354259"
  dark-border-hover: "#7783b3"
  dark-input-border: "#7886a0"
  dark-muted: "#adb9d0"
  dark-focus: "#b3b3ff"
  dark-free: "#a5d7b2"
  dark-free-bg: "#19392e"
  dark-class: "#eac57f"
  dark-class-bg: "#3b3020"
  dark-danger: "#ffb7b0"
  dark-danger-hover: "#ffd4cf"
  dark-danger-bg: "#43292f"
  dark-warning-border: "#bc934d"
  dark-warning-surface: "#302a21"
  dark-class-marker: "#eac57f"
  dark-status-neutral: "#28364d"
  dark-ribbon-session: "#6675a1"
  dark-ribbon-ongoing: "#d6b679"
  dark-overlay: "#050910bb"
  dark-selection: "#454573"
  dark-today: "#1e2940"
  dark-avatar-0-bg: "#303354"
  dark-avatar-0-fg: "#c0c0ff"
  dark-avatar-1-bg: "#42332f"
  dark-avatar-1-fg: "#ecc1a9"
  dark-avatar-2-bg: "#223d42"
  dark-avatar-2-fg: "#a7d9d5"
  dark-avatar-3-bg: "#403c2a"
  dark-avatar-3-fg: "#e6d198"
  dark-course-0-bg: "#253d32"
  dark-course-0-text: "#c0dec9"
  dark-course-1-bg: "#443820"
  dark-course-1-text: "#f2d695"
  dark-course-2-bg: "#303455"
  dark-course-2-text: "#d1d2ff"
  dark-course-3-bg: "#423043"
  dark-course-3-text: "#e7bfda"
  dark-course-4-bg: "#233d50"
  dark-course-4-text: "#b9dbea"
  dark-course-5-bg: "#44352e"
  dark-course-5-text: "#eccab0"
typography:
  display:
    fontFamily: 'Manrope, "Noto Sans Thai Variable", sans-serif'
    fontSize: "58px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: 'Manrope, "Noto Sans Thai Variable", sans-serif'
    fontSize: "43px"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'Manrope, "Noto Sans Thai Variable", sans-serif'
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: 'Manrope, "Noto Sans Thai Variable", sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: 'Manrope, "Noto Sans Thai Variable", sans-serif'
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.5
  status:
    fontFamily: 'Manrope, "Noto Sans Thai Variable", sans-serif'
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.5
rounded:
  badge: "5px"
  field: "7px"
  control: "8px"
  container: "12px"
  avatar: "16px"
  profile-avatar: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  panel: "32px"
  desktop-gutter: "44px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    height: "44px"
  button-destructive-hover:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-hover}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    height: "45px"
  navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  status-free:
    backgroundColor: "{colors.free-bg}"
    textColor: "{colors.free}"
    typography: "{typography.status}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  status-class:
    backgroundColor: "{colors.class-bg}"
    textColor: "{colors.class}"
    typography: "{typography.status}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  directory-container:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.container}"
  free-window-row:
    textColor: "{colors.foreground}"
    padding: "23px"
  course-block:
    backgroundColor: "{colors.course-0-bg}"
    textColor: "{colors.course-0-text}"
    rounded: "{rounded.field}"
    padding: "10px 8px"
---

# Design System: Koonpinai

## Overview

**Creative North Star: "Contemporary Social Utility"**

Koonpinai makes a free window easy to spot. The approved Contemporary Social Utility (Concept C) world pairs a geometric K wordmark, Manrope typography, rounded-square initials and flat, ruled groups. Periwinkle identifies actions; green and amber describe availability while course hues identify subjects.

Light appearance uses a near-white canvas and white surfaces. Dark appearance translates the same hierarchy into blue-charcoal and navy surfaces with off-white ink. Both preserve the approved composition, readable Thai names, timetable positions and source-state honesty. Motion explains interaction state rather than staging page entrances.

**Key Characteristics:**

- Free-window-first information hierarchy.
- Flat grouped rows, quiet dividers and rounded-square initials.
- Self-hosted Manrope with Noto Sans Thai fallback.
- Equivalent Light, Dark and System appearance.
- Written status, visible focus and deliberate mobile layouts.

## Colors

The normative frontmatter records the actual light colors and their `dark-` counterparts from `src/app/redesign.css`. CSS custom properties remain the implementation source of truth; `.dark` switches role values without changing content or layout. The approved composition lives in `src/app/approved-design.css`; global shared/admin styles load first, followed by that composition and the redesign overrides.

### Primary

- **Periwinkle action:** `primary`, `primary-hover` and `primary-foreground` identify primary actions, links, active navigation, selection and focus. Dark appearance uses the corresponding soft-periwinkle role values and dark button ink.
- **Availability green:** `free` and `free-bg` describe free and upcoming states. A free-window row shows duration with green text; its written status is unboxed.
- **Class amber:** `class` and `class-bg` describe an ongoing class, with `class-marker` supporting timetable state. These roles do not identify a subject.
- **Feedback red:** `danger`, `danger-hover` and `danger-bg` support destructive actions and feedback. Warning fields use `warning-border` and `warning-surface` with written messages.

### Secondary

Six muted subject pairs (`course-0` through `course-5`) retain green, ochre, violet, mauve, blue and clay identities across appearance modes. Four decorative avatar pairs provide restrained initials variety; the written nickname identifies the person. These colors do not encode availability.

### Neutral

`background` is the page canvas; `card` is the content surface; `foreground` is the main ink; `muted` is supporting text. `surface` and `surface-hover` support selected navigation, contextual strips and hover. `border` supplies quiet grouping rules, while `input-border` gives controls a stronger boundary. `today`, `selection`, `status-neutral`, `overlay` and timetable ribbon roles remain separate contextual treatments. Dark appearance preserves those roles rather than inverting source documents.

**The Status Has Words Rule.** Availability always includes a written label; color reinforces rather than replaces its meaning.

**The Course Identity Rule.** Keep the six course identities stable across themes and separate from availability meaning. Preserve source-document colors.

## Typography

**Display Font:** self-hosted Manrope variable (weights 200–800), served from `public/fonts/manrope.ttf` with its OFL license.
**Body Font:** Manrope, with self-hosted Noto Sans Thai Variable coverage from `@fontsource-variable/noto-sans-thai`, then sans-serif.

The typography is contemporary, compact and readable in English and Thai. Headings use weight and tight tracking for hierarchy; body copy stays relaxed. There is no separate decorative or monospace display family.

### Hierarchy

- **Display:** the login story uses `display`; mobile scales it to (39px).
- **Headline:** normal desktop page headings use `headline`. Directory mobile headings use (29px), standard mobile headings (31px), and profile headings (38px) desktop / (30px) mobile.
- **Title:** section headings use `title`; directory headings use (21px), then (19px) on mobile. Subheadings use (17px), weight (700), line-height (1.4).
- **Body:** `body` is the global default, with paragraphs limited to (64ch). Directory introductions use (15px); mobile supporting copy uses (12–13px).
- **Label / status:** `label` describes shared buttons and `status` the labeled badges. Directory names range from (14–16px), with compact secondary names and time metadata below body size.

Times, the Bangkok clock, schedule axes and time inputs use tabular numerals. On mobile, text-entry fields use (16px) to preserve readable entry and avoid automatic zoom. Compact metadata sizes are local density choices, not general body-copy tokens.

**The Bilingual Reading Rule.** Use Manrope for Latin text and Noto Sans Thai for Thai coverage; retain tabular numerals for time.

## Layout

The main desktop shell has a maximum width of (1328px), including (44px) horizontal gutters and (44px) top padding. The header is (88px) high with a centered content alignment. At widths up to (1150px), shell gutters become (32px); up to (760px), they become (21px) with (26px) top padding and a (76px) header. At (360px) and below the main gutters become (16px).

The directory leads with two-column free-person rows inside one flat bordered group; the list alternative uses one column. Each desktop row has (23px) padding. A compact in-class roster uses aligned identity, course/room, status and next-class columns with horizontal dividers. At (760px) or less, free rows become one column with (16px 14px) padding, roster headings disappear, and each roster entry exposes current course/room plus next-class time and name on separate lines. Preserve whole-row profile links and grouping rules.

Mobile navigation is fixed to the bottom, reserves (78px) body space and includes safe-area padding. Desktop navigation stays in the header. The current route is visible in both. Personal strips and account entries appear for authenticated members or an explicitly enabled fictional development preview.

The friend timetable keeps the seven-day desktop grid, exact event positions and overlapping columns. At (900px) or less it switches to a day selector and agenda. Login and onboarding split narratives/forms on desktop and stack on phones.

## Elevation & Depth

Ordinary surfaces are flat. Rules and background tone define directory groups, roster rows, schedule summaries and form panels. Hover changes tone without translating or lifting rows. Selected segments have no cast shadow. Dialogs and the theme-preference popover use the theme-specific `dialog-shadow`; the sidecar records its exact values.

**The Flat Group Rule.** Use tone, spacing and rules for ordinary hierarchy; reserve cast shadows for dialogs and the theme popover.

Color, border and shadow state changes use (160ms ease). Modal overlays fade at (150ms ease-out); loading skeletons use (1.5s ease-in-out) feedback. Reduced-motion preferences remove transitions and animations and restore automatic scrolling. No entrance choreography is part of the system.

## Shapes

The shared form is a gently rounded rectangle. Controls use `control`, status labels use `badge`, directory and summary containers use `container`, and timetable blocks use `field`. Initials avatars are rounded squares, with (48px) standard size and `avatar` rounding; larger profile initials use (84px) and `profile-avatar`. Mobile variants scale these down rather than becoming circular portraits.

Group and field boundaries are (1px). Ordinary controls use a (3px) primary-colored keyboard outline offset by (3px); search uses a focus-within outline. Preserve stronger input boundaries separately from quiet decorative rules. Theme switch and preference disclosure targets remain (44px) square.

## Components

### Buttons

Primary actions use periwinkle with contrasting foreground, at least (44px) high, (9px 16px) padding and weight (650). Outline actions use a card surface and input border; ghost actions use transparent fill. Both hover to a surface tint. Destructive actions use semantic danger ink on the danger wash. Hover keeps that wash and changes both ink and border to `danger-hover`; it does not fill the button with the text color. Disabled buttons use opacity (0.45) with a not-allowed cursor. The SSO action keeps label-first row order and starts university sign-in when approved-client/session/database configuration is complete; otherwise it is disabled with an explanation.

### Inputs / Fields

Shared fields use a card surface, foreground ink, an input boundary, (45px) minimum height and (9px 12px) padding. Onboarding/profile fields use a slightly tighter corner and (10px 12px) padding; mobile fields are (47px) high with (16px) text. Search includes an inline outline icon, a real text input and a focus-within treatment. Invalid values pair warning borders with explicit validation text. Do not replace native labels or required/disabled semantics with color.

### Navigation

Desktop links use outline icons, medium-weight text, (12px 16px) padding and softly rounded corners. Active links use periwinkle ink on the surface wash. Mobile bottom links combine icon and text with the same active distinction. Theme controls offer a direct Sun/Moon switch and an Appearance disclosure with Light/Dark/System radios, keyboard Escape dismissal and focus return. OS appearance is the default; only the visual preference persists locally.

### Chips

Status badges pair a dot with text: free/upcoming green, in-class amber, no-schedule/out-of-term neutral. In free-window rows the same status is unboxed under the duration. Availability filters are separate controls with count labels: the selected filter uses foreground ink as fill and background-colored text, while unselected filters remain muted with tonal hover. Day selection uses the primary action pair.

### Cards / Containers

The directory is a grouped flat container with ruled child links, not a set of lifted cards. Free rows place initials/name on the left and free-window duration on the right; in-class rows preserve separators and course/room/next-class content. Summaries, policy and access panels use the same card surface and quiet boundaries. Keep the approved composition and source data rather than substituting mockup records.

### Timetable and Agenda

Six subject pairs color events consistently in both themes. The current class has an inset amber marker, today has a subtle contextual column, and all events retain exact schedule geometry. Agenda entries expose start/end times, course and room as larger readable content. Short desktop events may hide secondary metadata instead of distorting their true duration. Clicking an event opens the existing Radix class-detail dialog.

### Timetable Connection and Accounts

Connection information uses a flat ruled panel with a written state, source and actual last-synchronization timestamp. Do not invent progress, dates or success. API unavailable means availability is unknown; it is never styled as Free. The seven connection states use semantic surface/ink tokens in both themes. Refresh remains disabled with a nearby explanation until an approved API exists. At mobile widths source details stack; no horizontal scrolling is introduced. Fictional timetable previews remain explicitly labeled and credential-free only.

Configured accounts use actual server-validated profile/policy/approval and eligible-member directory reads. Forms retain pending/success/error feedback; local logout explains that university SSO may remain active. Sharing acknowledgement and university API permission are separate. No PDF upload/review UI remains. The approved type, layout, theme behavior and timetable visualization remain intact.

## Do's and Don'ts

### Do:

- **Do** preserve the approved Concept C composition and free-window hierarchy.
- **Do** keep course identities consistent across themes and preserve exact normalized schedule times.
- **Do** retain written statuses, visible focus, labeled controls and reduced-motion behavior.
- **Do** preserve mobile next-class names and the day agenda instead of compressing a weekly grid.
- **Do** label fictional data, temporary edits and disconnected account actions honestly.

### Don't:

- **Don't** restore the superseded Blue Mist palette or three-column card directory.
- **Don't** use course colors as availability meaning.
- **Don't** add heavy shadows, gradients, neon accents or page entrance choreography.
- **Don't** treat compact timetable metadata sizes as the default for new body text.
- **Don't** imply that preview edits save, publish, submit approval or grant access.

## Student-managed timetable refinement — 22 October 2026

The approved visual world stays unchanged. My Timetable replaces disabled provider controls with Set/Edit semester and Add class. A focused Radix editor uses existing fields/buttons and theme tokens; mobile places its two actions below the title. Existing weekly blocks open Edit only for the owner; other profiles remain read-only. Optional code/section/location never become fabricated values. Overlap warnings require confirmation, deletions have explicit confirmation, and pending/error/empty/storage-not-enabled states explain the next action. Source/last-sync UI is retired; saved time is labeled in Bangkok. Development changes are explicitly in-memory. Policy copy/version now describes student-entered persistent schedules; see DATABASE_FIRST.md.
