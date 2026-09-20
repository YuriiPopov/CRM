# Handoff: B4U — Beauty for You Client App (Android)

## Overview
Native Android client app for a single-branch beauty salon ("Beauty for You"): browse services and masters, book appointments, track visit history, earn/redeem loyalty points, and view a salon news feed. Bottom tab navigation with 5 sections.

## About the Design Files
The bundled HTML file (`B4U Client App Android.dc.html`) is a **design reference** — an interactive HTML/JS prototype built to show exact layout, copy, states and flows. It is NOT production code to embed or wrap in a WebView. The task is to **recreate this design natively for Android** (Kotlin + Jetpack Compose recommended, or Kotlin + XML Views if that's the existing stack) and produce a signed/debug APK.

If there is no existing Android codebase, start a new Android Studio project (Kotlin, Jetpack Compose, Material 3 as the base — then override Material defaults with the tokens below to match this design, which does NOT follow stock Material styling).

## Fidelity
**High-fidelity.** Exact colors, type, spacing, radii and copy are given below and are visible directly in the HTML source. Recreate pixel-close, not just "in the spirit of."

## Design Tokens

Colors:
- Background (screen): #FAF3EE
- Page wrapper background (outer): #EDE6E1
- Card / surface: #FFFFFF, border #F0E1E2
- Primary text (headings): #4A2530 (dark) / #3D2027 (near-black)
- Secondary text: #8B6F73
- Muted/tertiary text, icons: #B98A93
- Accent (primary actions, price, active tab): #C97B8E, pressed/hover #A85B7A
- Dark surface (loyalty card, "next visit" banner): #4A2530, secondary text on it #D9B9BD
- Status — confirmed: text #3F9C5C / bg #EAF4EC
- Status — pending: text #B8791F / bg #FBF0DE
- Status — done: text #8B8B8B / bg #F1F0EF
- Status — cancelled: text #C24B4B / bg #FBEAEA
- Chip inactive bg: #F3E7E4

Typography:
- Headings: Playfair Display, weight 700 (600 for smaller emphasis). Sizes used: 34/24/22/20/19/18/16px.
- Body/UI: Inter, weights 400–700. Sizes used: 10–14.5px (buttons ~12–14px, labels 10.5–11.5px, body 12–13.5px).
- Android equivalents: bundle Playfair Display + Inter as app fonts (Google Fonts, downloadable or packaged) rather than substituting system fonts — the serif/sans contrast is a core part of the identity.

Shape & elevation:
- Card radius: 14px. Large containers (bottom sheet top corners, loyalty card, master avatar frame): 16–22px. Pills/chips/status badges: 999px (fully rounded). Small icon tiles: 10px.
- Card border: 1px solid #F0E1E2 (cards are mostly flat, not shadowed) — except floating elements: master avatar (52dp logo tile) uses a soft shadow (0 3px 10px rgba(74,37,48,.12)); the FAB uses a stronger accent-tinted shadow (0 6px 16px rgba(201,123,142,.45)).

Spacing: base horizontal page padding 18px; card internal padding ~12–14px; gaps between list items 8–10px; section gaps ~22–26px.

## Screens

1. **Aktualności (News)** — entry tab. Title + subtitle, then a vertical feed of cards: image/emoji header (130dp tall placeholder), colored category tag (Nowość/Digest/Inspiracja, each its own accent color), title, body text, date. Empty state: dashed-border placeholder card.

2. **Główna (Home)** — greeting ("Dzień dobry" + client first name) with round avatar/logo top-right. Search-style button ("Znajdź usługę lub mistrza"). 3-column quick action grid (Zarezerwuj / Moje wizyty / loyalty points shortcut). Horizontal-scroll "Popularne usługi" cards (140dp wide: icon tile, name, price · duration). Horizontal-scroll "Twoi mistrzowie" avatars (56dp circle, colored ring per master, name). If there's an upcoming booking, a dark (#4A2530) banner card at the bottom shows it and opens Wizyty on tap.

3. **Usługi (Services)** — title, horizontal category filter chips (pill-shaped, active = accent fill), then services grouped by category as a vertical list of cards (name, duration · price, "Zarezerwuj" button).

4. **Master detail** (pushed from Home/Services, not a tab) — back arrow + title, master photo (76dp circle, colored ring) + name/specialty/rating badge, 3-column portfolio placeholder grid, master's services list (each with its own price + "Wybierz" button), one review quote. Sticky bottom CTA bar: "Zarezerwuj u {name}".

5. **Wizyty (Visits/Bookings)** — title, segmented control (Nadchodzące / Minione) toggling a filtered list. Each booking card: service name + status pill (color per status), date/time · master name, price, and action buttons — Odwołaj (cancel, only if upcoming) or Powtórz (repeat, only if past). Empty state: dashed placeholder. Floating "+" action button bottom-right opens the booking sheet.

6. **Profil (Profile/More)** — avatar-initial header with name + phone. Vertical list of nav rows (icon tile, title, subtitle, chevron): Program lojalnościowy (loyalty), Aktualności, Historia wizyt, Karty podarunkowe (stub), Ustawienia (stub). Contact row: 3 equal buttons (Zadzwoń/Instagram/Facebook) with icon + label, tel: link on Zadzwoń.

7. **Program lojalnościowy (Loyalty)** — pushed from Profil. Dark hero card (#4A2530): balance in points (large Playfair number), "points to next reward" caption, progress bar (accent fill #C97B8E on translucent white track). "Jak zdobywać" earn-rules list (label + "+N pkt" rows). "Wymień punkty" reward list — button shows cost, disabled state (grey) when balance is insufficient. Disclaimer note about the loyalty mechanic possibly changing (points → tiers/stamp-card — keep as a data-driven mechanic, not hardcoded to points only).

8. **Booking sheet (modal, from any screen)** — bottom sheet over a dim scrim: drag handle, title "Nowa rezerwacja", tappable rows to cycle Usługa / Mistrz / Godzina / Płatność (values step through options on tap — for native, prefer a real picker/dropdown instead of tap-to-cycle), a date field, running total, and a full-width "Potwierdź rezerwację" primary button. Payment options include "Zapłać punktami (jeśli wystarczy)" which deducts from loyalty balance instead of charging.

## Navigation
Bottom tab bar, 5 items, icon (44×44dp target) + label, active tab tinted accent (#C97B8E) vs #8B6F73 inactive, inactive icon at ~60% opacity: Aktualności, Główna, Usługi, Wizyty, Profil. Master detail and Loyalty are pushed screens (back arrow), not tabs.

## Interactions & Behavior
- Tapping a service/master anywhere starts the booking flow, pre-filled with that selection.
- Confirming a booking: adds it to Wizyty (status "Potwierdzona"), shows a toast ("Wizyta zarezerwowana!"), and either deducts points (if paying with points) or accrues points at 10% of the service price.
- Cancel sets status to "Odwołana" and removes it from the upcoming list. Repeat re-opens the booking sheet pre-filled with the same service/master.
- Redeeming a reward deducts points and toasts confirmation; shows an error toast if balance is insufficient.
- Toasts: dark pill, bottom-center, auto-dismiss ~2.2s.
- All copy in the prototype is Polish (target locale) — keep Polish as the primary locale, structure strings for easy localization (string resources, not hardcoded).

## State Management
Needed: current tab/screen, selected master (for detail), bookings list (with status + upcoming/past), loyalty point balance, booking-draft (service/master/date/time/payment), transient toast message. In a real app this would be backed by a booking API — the prototype uses in-memory mock data (MASTERS, SERVICES, INITIAL_BOOKINGS, REWARDS, PUBLISHED_NEWS constants in the JS, all visible in the file) that should be replaced with real endpoints.

## Assets
Master photos (`masters/*.webp`), salon logo (`masters/b4u-logo.jpeg`), nav/section icons (`icons/mail.jpg`, `clock.jpg`, `service.jpg`, `calendar.jpg`, `profile.jpg`, `phone.jpg`, `instagram.jpg`, `facebook.jpg`, `settings.jpg`) — all included in this bundle's `icons/` and `masters/` folders. Service/news "icons" in the prototype are emoji placeholders (✂️🎨💇💅🦶🧖💆✨📰💡) — replace with real icon assets or illustrations before shipping.

## Screenshots
`screenshots/` — reference captures of the main tabs and the loyalty screen: 01-aktualnosci, 02-glowna, 03-uslugi, 04-wizyty, 05-profil, 06-lojalnosc.

## Files
- `B4U Client App Android.dc.html` — the full interactive prototype (all screens, all logic) referenced above.
- `icons/`, `masters/` — image assets used by the prototype.
- `screenshots/` — static reference images of each main screen.
