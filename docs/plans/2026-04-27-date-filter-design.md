# Date Filter for Map Page

## Overview

Add a date filter to the map page so users can quickly find listings active today, tomorrow, or this week. Defaults to "Today" on load — the most common use case.

## UI

A **Date button** sits in the filter bar alongside the existing category chips and Tags button.

- **Desktop:** appears in the `desktopFilters` template between the category chips and the Tags button
- **Mobile:** appears in the horizontally-scrollable chips row in the bottom sheet handle

The button label reflects the active selection:
- No date filter selected (All): `Date`
- Filter active: `Date · Today`, `Date · Tomorrow`, `Date · This Week`

Clicking the button toggles a dropdown panel containing four chips: **All / Today / Tomorrow / This Week**. Selecting a chip closes the dropdown and applies the filter. Only one chip is active at a time.

Visual states mirror the Tags button: inactive state is outlined/gray; active state uses the blue accent (`#eff6ff` bg, `#1d4ed8` text, `#93c5fd` border).

## Default State

On initial load, `selectedDateFilter` is `'today'`. The button renders as active ("Date · Today") from the start. No API or URL change is needed to establish this — it is a client-side computed default.

## Filtering Logic

Applied in the existing `get filtered()` getter, after tag filtering, before sorting. All comparisons are against the browser's local time.

| Filter | Condition |
|--------|-----------|
| `today` | `endDatetime > now` AND `startDatetime ≤ end of today` |
| `tomorrow` | `endDatetime ≥ start of tomorrow` AND `startDatetime ≤ end of tomorrow` |
| `this-week` | `endDatetime > now` AND `startDatetime ≤ now + 7 days` |
| `all` | no date check |

"Today" semantics: a listing shows up if it hasn't ended yet **and** it starts at some point today (or already started). A 5 pm search finds lights starting at 6 pm today; it excludes lights that ended at 4 pm.

## Component Changes (`map.component.ts`)

- Add `selectedDateFilter: 'today' | 'tomorrow' | 'this-week' | 'all' = 'today'`
- Add `dateOpen = false`
- Extend `get filtered()` with the date window check
- Add Date button + dropdown to the `desktopFilters` template
- Add Date button + dropdown to the mobile chips row
- `clearFilters()` resets `selectedDateFilter` back to `'today'` (not `'all'`)

## Model / State Changes

`FilterState` gains a `dateFilter` field so the current selection is emitted via `filtersChanged` alongside category/tags/lat/lng/radius.

## No Backend Changes

Filtering is purely client-side on the already-loaded results (up to 50 listings per API call). The backend already excludes expired listings (`includeExpired=false`), so the returned set is always "active or upcoming" — the date chips just narrow it further.

## Out of Scope

- Custom date range picker
- "This Weekend" or other additional windows
- Persisting the date selection across page reloads
