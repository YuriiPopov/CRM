# Handoff: B4U — Master (Mistrz) App

## Overview
Mobile app for a salon master ("mistrz") in the B4U salon platform. Three tabs: Panel (dashboard), Kalendarz (calendar), Profil (profile + work schedule). Companion to the existing B4U Admin App. Two device-frame prototypes are included (Android / Material 3 and iOS) — same screens, same logic, platform-appropriate chrome only.

## About the Design Files
The files in this bundle are **design references built in HTML** (prototypes showing intended look and behavior), not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React Native, SwiftUI/Kotlin native, Flutter, etc.) using its established patterns and libraries — or, if no mobile environment exists yet, to choose the most appropriate framework and implement the designs there.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing and copy (Polish) are final as shown. Recreate pixel-close using the target codebase's component library where one exists.

## Screens / Views

### 1. Panel (Dashboard) — `01-dashboard.png`
- Header: greeting "Cześć, {imię}" (Playfair Display 24px/700, #4A2530) + full date (Playfair Display 19px/600, #8B6F73) left; circular avatar 56×56 with 2px border in the master's accent color, right.
- 3 stat cards in a row (flex:1 each, gap 10px): white bg, 1px solid #F0E1E2, radius 14px, padding 12px, center-aligned. Big number 18px/700 #4A2530, label 11px #8B6F73. Cards: "wizyt dziś", "wizyt w tyg.", "zakończonych".
- "Dzisiaj" section header (Playfair 18px/700) + count on the right (12px #B98A93).
- Empty state (dashed border #E3CBCE, radius 16px, bg #FDF8F6, centered) when no visits today.
- Today's visit list: white card, radius 16px, border #F0E1E2, rows separated by 1px #F5EBEC. Each row: time (42px fixed, 12.5px/700 #4A2530) · 4px colored bar (master's accent color) · service name (13.5px/600 #3D2027, truncated) + client (12px #8B6F73) · status pill (10.5px/600, colored per status, right-aligned). Tapping a row opens the read-only appointment detail sheet.
- "Tydzień" section: 7-column grid, each cell shows day label, date number, and a 16×4px accent bar.

### 2. Kalendarz (Calendar) — `02-calendar-list.png`, `03-calendar-timeline.png`
- Header "Kalendarz" (Playfair 24px/700) + subtitle "Twoje wizyty" (13px #8B6F73).
- 7-day week strip, tappable, selected day highlighted (bg #F3E7E4, label color #C9445A).
- View switch: segmented control "Lista" / "Timeline" (bg #F3E7E4 track, radius 12px, active segment white bg).
- Status filter pill button, cycles through all statuses on tap.
- **List view**: cards identical in style to dashboard's upcoming-visit cards but time/status stacked on the right.
- **Timeline view**: single-master day timeline, 09:00–19:00, 15-min row height (24px), hour labels bold, quarter-hour labels muted; solid line on the hour, dashed on quarters. Visit blocks are absolutely positioned by start time/duration, left border 3px in master's accent color, background = status color, showing time·client + service, truncated.
- Empty states (dashed card) for both views when no visits match filters.

### 3. Profil (Profile) — `04-profile.png`, `05-schedule-sheet-calendar.png`
- Header "Profil" (Playfair 24px/700).
- Identity row: 64×64 circular photo (2px border, accent color) + name (18px/700 #3D2027) + specialty (12.5px #8B6F73).
- 2 stat cards: total visits, rating.
- **Godziny pracy** (work hours) section: header + current ISO week range (dd.mm–dd.mm) on the right. 7 rows, one per weekday: day name (fixed 88px column) + date (fixed 44px column) so all dates align in one vertical column; hours on the right, muted color + "Wolne" label for days off; a "ZMIENIONO" pill tag appears when that day has an admin-confirmed override.
- "Ustawienia grafiku pracy" button opens the **schedule bottom sheet**:
  - Month calendar grid (Pon–Nie), multi-select days by tap (selected = filled accent bg).
  - Small colored dot under a date marks an existing override: amber = pending approval, green = confirmed working day, red = confirmed day off.
  - "Zmiany czekają na zatwierdzenie…" banner appears while any override is pending.
  - OD / DO time inputs, "Ustaw godziny" (green) / "Oznacz jako wolne" (outlined red) action buttons apply to the current multi-selection.
  - "Zapisz i zamknij" closes the sheet; if anything is pending it shows a toast "Wysłano do administratora do zatwierdzenia" instead of saving immediately.
  - A dashed "Podgląd: symuluj potwierdzenie administratora" button is prototype-only scaffolding standing in for the real admin-approval webhook — flips all pending overrides to confirmed. Do not ship this button; the real flow is the admin app confirming/rejecting the request.
- Kontakt card (phone, email) + "Wyloguj się" outlined red button.

## Interactions & Behavior
- Bottom tab bar (Panel/Kalendarz/Profil) switches screens; active tab is full white icon+label, inactive at 45–60% opacity.
- Appointment detail sheet (bottom sheet, slide-up 0.22s ease-out) is **read-only for the master** — status is shown as a static colored pill with the note "Status wizyty ustala administrator" (the admin sets appointment status, not the master).
- Toasts: dark pill, bottom-centered, auto-dismiss ~2.2s, fade+slide-up entrance.
- All bottom sheets: tap the dim backdrop or the sheet's own close/save button to dismiss.

## State Management
- `screen`: 'dashboard' | 'calendar' | 'profile'.
- `calView`: 'list' | 'timeline'; `calWeekIdx`, `filterStatusIdx` for the calendar filters.
- `appointments`: list (id, date, time, service, client, status).
- `showDetail` / `detailId`: appointment detail sheet.
- `showSchedule`, `scheduleMonthOffset`, `selectedDates[]`, `scheduleStart`/`scheduleEnd`: schedule sheet UI state.
- `dateOverrides`: map of `YYYY-MM-DD` → `{ type: 'work'|'off', start?, end?, status: 'pending'|'confirmed' }` — the individual-schedule requests and their approval state. Only `status:'confirmed'` overrides should ever affect the displayed weekly work hours or the general/admin calendar's working/rest-hour markers.
- **Backend implication**: applying a work/off override must create a pending request routed to the admin app; only after the admin approves it does it become the master's active schedule and only then should it surface in the admin-side calendar as working/rest hours.

## Design Tokens
- Colors: bg #EDE6E1 (canvas), app bg #FAF3EE, ink #3D2027 / #4A2530, muted text #8B6F73 / #B98A93, borders #F0E1E2, nav bar #C08658.
- Status colors: confirmed #3F9C5C/#EAF4EC, pending #B8791F/#FBF0DE, cancelled #C24B4B/#FBEAEA, no_show #9B3A3A/#F6DADA, done #8B8B8B/#F1F0EF.
- Accent (per master, e.g. Maria): #4F8A82.
- Typography: headings "Playfair Display" 600/700, body "Inter" 400–700.
- Radii: 12–16px cards/buttons, 999px pills, 22px sheet top corners.
- Device sizes: Android frame 412×924 (Pixel-class), iOS frame 390×844.

## Assets
- Master photo: `masters/maria.webp` (placeholder headshot — replace with real photo asset pipeline).
- No icon/image assets beyond that; bottom-nav icons are flat colored squares as tap-target placeholders — swap for the app's real icon set.

## Files
- `source/B4U Master App Android.dc.html` — Android prototype (all 3 screens + sheets, single interactive file).
- `source/B4U Master App iOS.dc.html` — iOS prototype, same logic/content, iOS frame chrome.
- `source/masters/` — placeholder photo assets referenced by the prototypes.
- `screenshots/` — static captures of each screen/state for quick reference (see Screens section above).
