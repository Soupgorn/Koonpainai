---
name: Koonpinai
description: A quiet, bilingual timetable interface for finding time together.
colors:
  background: "#ffffff"
  foreground: "#202321"
  surface: "#f8f9f7"
  surface-hover: "#f1f3ef"
  border: "#e5e7e2"
  muted: "#687064"
  free: "#23714e"
  free-bg: "#edf6ef"
  class: "#946119"
  class-bg: "#fcf4e5"
  danger: "#a93832"
  primary-hover: "#3f453e"
  destructive-hover: "#8a2b26"
  focus: "#526653"
  input-border: "#daddd5"
  input-focus: "#6e826d"
  ghost-text: "#555e52"
  status-neutral: "#f0f1ee"
  status-neutral-text: "#656d5e"
typography:
  display:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  subheading:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  status:
    fontFamily: '"Noto Sans Thai Variable", "Noto Sans Thai", sans-serif'
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  badge: "4px"
  segment: "5px"
  nav: "6px"
  input: "7px"
  control: "8px"
  timetable: "10px"
  card: "12px"
  dialog: "14px"
  avatar: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  panel: "32px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ghost-text}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.background}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.input}"
    padding: "9px 12px"
  navigation:
    textColor: "{colors.muted}"
    rounded: "{rounded.nav}"
    padding: "8px 12px"
  status-free:
    backgroundColor: "{colors.free-bg}"
    textColor: "{colors.free}"
    typography: "{typography.status}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  status-class:
    backgroundColor: "{colors.class-bg}"
    textColor: "{colors.class}"
    typography: "{typography.status}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  friend-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "22px 22px 15px"
  filter-tabs:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "4px"
---

# Design System: Koonpinai

## Overview

**Creative North Star: "A quiet place between classes"**

Koonpinai presents friends and their timetables with the restraint of a premium monochrome product. White space, ink typography and soft gray borders organize compact information; green and amber communicate availability. English and Thai share one self-hosted variable type family.

The interface feels calm while remaining useful at a glance. Larger screens expose a directory and weekly planning grid; phones give each friend a readable day agenda. Motion describes interaction state, with no entrance choreography. These rules describe the current implementation, rather than an unbuilt theme.

**Key Characteristics:**

- Monochrome structure with restrained semantic availability color.
- One bilingual sans-serif family and tabular timetable numerals.
- Flat bordered surfaces with gently rounded controls.
- Three-to-one-column directory and a mobile day agenda.
- Explicit labels, visible keyboard focus and reduced-motion support.

## Colors

The palette is primarily white and ink with subtly warm green-gray neutrals. Frontmatter values are extracted from `src/app/globals.css`; CSS custom properties remain the implementation source of truth.

### Primary

- **Ink** (`foreground`): primary text and filled actions. Its quieter hover tone is `primary-hover`.
- **Availability green** (`free`, `free-bg`): free-state labels, pale free-state surfaces and caret color.
- **Class amber** (`class`, `class-bg`): in-class and upcoming labels, plus relevant schedule warnings.
- **Destructive red** (`danger`, `destructive-hover`): destructive actions, never availability.

### Neutral

- **White** (`background`): page, card, dialog and primary-button text.
- **Quiet canvas** (`surface`): search, segmented controls and empty states.
- **Hover canvas** (`surface-hover`): secondary action hover and selected navigation.
- **Soft line** (`border`): separators and flat surface boundaries.
- **Muted olive-gray** (`muted`): secondary copy, dates and inactive navigation.
- **Neutral status** (`status-neutral`, `status-neutral-text`): missing schedules and out-of-term states.
- **Control details** (`input-border`, `input-focus`, `focus`, `ghost-text`): field boundaries, focus and secondary actions.

The existing avatar initials and course blocks also use six subdued identifying tints each. These are local identity/course differentiation, not new brand accents or availability meanings. Keep their existing assignments local to those components.

**The Status Has Words Rule.** Availability always has a text label; color and dots reinforce it rather than carrying the meaning alone.

## Typography

**Display Font:** Noto Sans Thai Variable, with Noto Sans Thai and sans-serif fallbacks.
**Body Font:** The same family, self-hosted through `@fontsource-variable/noto-sans-thai` in the root layout.

The type is contemporary and compact without changing voice between Thai and English. Weight and scale provide hierarchy; the system has no separate decorative display or monospace face.

### Hierarchy

- **Display:** the directory introduction uses `display`; at the tablet breakpoint it becomes (43px), then (36px) on phones and (32px) at the smallest breakpoint.
- **Headline:** `headline` supplies the base page heading; phones use (34px), with component-specific profile/admin overrides.
- **Title / subheading:** `title` and `subheading` supply section hierarchy. Directory friend names use (14px), weight (600), line-height (1.5), tracking (-0.01em); mobile names increase to (15px).
- **Body:** `body` is the page default. Introductory copy is (15px), then (13px) on phones. Paragraphs have a maximum measure of (72ch).
- **Label:** `label` describes standard buttons. Navigation is (12px), weight (450); status badges use `status`, with text remaining sentence case.

Time, clock, counts, event times and time inputs use tabular numerals. Compact schedule metadata currently falls below body size; it is a local density choice, not a universal text-size recommendation.

**The One Family Rule.** Keep English and Thai in the same self-hosted family, and use weight, spacing and tabular numerals to clarify the information.

## Layout

The desktop shell is centered with a maximum width of (1240px) and horizontal gutters of (40px). At a (1440px) viewport the directory shows three equal columns, separated by (16px); the profile exposes a seven-day weekly timetable with a (64px) time axis. The header minimum height is (80px). Introductory directory spacing is (66px) above and (40px) below.

The directory becomes two columns at (1050px) and one at (700px). Horizontal shell gutters become (28px) at (1050px), (20px) at (700px), and (15px) at (360px). The shell expands to (1320px) with (55px) gutters at widths of at least (1450px). The list alternative becomes card-like again on phones; the desktop view switch disappears there.

At widths of (900px) or less, the weekly grid is replaced by a day selector and vertically stacked agenda events. Do not squeeze seven tiny day columns into the phone view. At (700px), the search fills its own toolbar row, navigation has a minimum target height of (44px), and the header clock is hidden. Agenda blocks use (19px 16px) padding and (12px) gaps.

Spacing is a practical family of small steps, not a claim that every measured gap lies on one rigid scale. Use frontmatter spacing for repeated rhythm, while keeping established component padding and layout breakpoints.

## Elevation & Depth

Most surfaces are flat and separated by a border, a pale background or whitespace. Directory cards gain a slightly stronger border and near-white background on hover, without lifting. Selected filter/day segments have a small structural shadow; modal dialogs sit above a dimmed overlay with a diffuse shadow. The exact shadow values live in the sidecar.

**The Flat Surface Rule.** Use borders and tone for ordinary hierarchy; reserve cast shadows for selected segments and modal depth.

Interactive color, border and shadow state changes use (160ms ease). The dialog overlay has a brief (150ms ease-out) fade; skeleton feedback uses an alternating (1.5s ease-in-out) animation. Neither is page entrance choreography. Reduced-motion preferences remove animations and transitions.

## Shapes

The recurring form is a softly bordered rectangle. Standard controls use `control`; fields are slightly tighter with `input`; friend cards use `card`; weekly timetable containers use `timetable`; dialogs use `dialog`. Status labels are small rounded rectangles, not pill buttons. Initial avatars are circular, and status dots inherit their label color.

Field borders are (1px); the global keyboard focus outline is (2px), offset by (4px). Focus is visible on controls and links. Card boundaries and internal separators remain quiet enough to keep names, state and timetable information dominant.

## Components

### Buttons

Compact and deliberate. The shared Button exposes `default`, `outline`, `ghost` and `destructive` variants, plus default, `sm` and `icon` sizes. Default controls have a minimum height of (42px), gap (8px), and label typography. Small controls use minimum height (34px), padding (6px 10px) and text (12px); icon controls are (40px) square. Disabled buttons use opacity (0.45) and a not-allowed cursor. Hover changes color or background; keyboard focus uses the global outline.

### Inputs / Fields

White, softly outlined fields use the `input` tokens, minimum height (42px), text (13px) and line-height (1.5). Focus strengthens the border. Invalid fields currently use an amber border and pale warning background. Search is a surface-tinted field with an inline SVG icon and (39px) left padding, becoming white on focus; the mobile directory search has minimum height (46px).

On phones, form fields and directory search use (16px) text to keep entry readable and avoid automatic input zoom. Import source controls and session actions have minimum (44px) targets.

### Navigation

Text and Lucide outline icons sit in softly rounded links. Inactive navigation is muted; hover adds the quiet canvas, while the current route uses the hover canvas and ink text. On phones the header compresses, the secondary clock disappears, and navigation targets become taller. Keep the bilingual wordmark together.

### Chips

Status badges combine a current-color dot with a written status. Free is green; in-class and upcoming are amber; no-schedule and out-of-term are neutral. Badges are indicators rather than interactive filters. Interactive filtering instead uses a surface-tinted segmented group, with white selected segments, ink labels, small count tags and a restrained selected shadow.

### Cards / Containers

Directory cards are whole-card profile links, with an initials avatar, bilingual name, status, present/next class information and a separated bottom row. Default padding is in `friend-card`; phones use (20px 20px 14px), and very wide layouts use (25px 25px 17px). Preserve keyboard focus for the whole link. Do not add independent floating shadows or decorative images.

### Timetable Ribbon and Agenda

The directory's miniature ribbon spans (08–18), showing actual class intervals on a (4px) track. A stronger amber segment indicates an ongoing class; a thin vertical marker shows the current time. It is supplemental to the written status and is hidden from assistive technology in the implementation.

The weekly timetable uses softly tinted course blocks and an inset outline for the current class. On smaller screens the day selector gives access to larger agenda events with start/end times, course names and room information. These are two presentations of the same schedule, not separate content systems.

### Dialogs

Centered white dialogs have width `min(460px, calc(100vw - 32px))`, maximum height `calc(100svh - 48px)`, scrollable content, padding (32px), a close control and modal depth. Phone padding is (29px 23px). The implementation uses Radix dialog primitives for focus and interaction behavior.

### PDF Review

The original PDF and editable sessions share a two-column desktop workspace, then stack at (900px). The source is a contained, keyboard-focusable canvas region with page and zoom controls. Session rows expand into labeled fields without collapsing during edits. Missing values and OCR uncertainty use the established warning treatment, paired with written messages and source-page references. Review confirmation precedes the private timetable/profile preview and JSON download; the interface makes no persistence or publishing claim.

## Do's and Don'ts

### Do:

- **Do** keep white, ink and soft borders as the structural palette.
- **Do** accompany semantic color with readable status text.
- **Do** use the same self-hosted Noto Sans Thai family for English and Thai.
- **Do** preserve the three/two/one-column directory and the day agenda at widths of 900px or less.
- **Do** retain visible keyboard focus, tabular times and reduced-motion support.

### Don't:

- **Don't** introduce saturated decorative accents or reinterpret course tints as availability colors.
- **Don't** add page entrance choreography to the quiet product interface.
- **Don't** add cast shadows to ordinary directory cards.
- **Don't** use tiny timetable metadata sizes as the default for new body copy or controls.
- **Don't** replace written availability labels with color-only dots.
