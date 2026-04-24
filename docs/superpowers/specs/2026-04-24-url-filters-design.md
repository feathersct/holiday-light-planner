# URL Filter State — Design Spec

**Date:** 2026-04-24

## Overview

Encode the map's active filters and current center into the URL as query parameters. This makes the page deep-linkable — anyone opening the URL gets the same map view and filters pre-applied. The URL also updates live as the user pans the map or changes filters.

---

## Supported URL Parameters

| Param | Type | Example | Notes |
|---|---|---|---|
| `category` | string | `YARD_SALE` | Must match a valid `Category` value; invalid values ignored |
| `lat` | float | `35.5051` | Map center latitude |
| `lng` | float | `-80.8771` | Map center longitude |
| `radius` | integer | `15` | Search radius in miles; clamped to 1–100, defaults to 10 |
| `tags` | string | `family-friendly,charity` | Comma-separated tag names; unknown names silently skipped |

Example URL: `/?category=YARD_SALE&lat=35.5051&lng=-80.8771&radius=15&tags=family-friendly`

---

## Data Model

### New interface in `listing.model.ts`

```typescript
export interface InitialFilters {
  category?: Category;
  lat?: number;
  lng?: number;
  radius?: number;
  tags?: string[];
}
```

### New interface in `listing.model.ts`

```typescript
export interface FilterState {
  category: Category | '';
  tags: string[];
  lat: number;
  lng: number;
  radius: number;
}
```

---

## Architecture

### AppComponent (modified)

**On init (`ngOnInit`):**
- Parse `window.location.search` into an `InitialFilters` object.
- Validate each param (see Error Handling below).
- Pass the result to `MapComponent` via the new `@Input() initialFilters: InitialFilters | null`.

**On filter change:**
- Listen to the new `@Output() filtersChanged: EventEmitter<FilterState>` on `MapComponent`.
- When it fires and `screen() === 'map'`, build a query string from the `FilterState` and call `location.replaceState('/', queryString)`.
- Params with empty/default values are omitted from the query string (no `category=` or `tags=`).

### MapComponent (modified)

**New input:**
```typescript
@Input() initialFilters: InitialFilters | null = null;
```

**New output:**
```typescript
@Output() filtersChanged = new EventEmitter<FilterState>();
```

**On init (`ngOnInit`):**
- If `initialFilters` contains `lat` and `lng`, use them as the initial map center and skip geolocation entirely.
- Apply `category`, `tags`, and `radius` from `initialFilters` if present.
- `radius` replaces the current hardcoded `10` default.

**Emit `filtersChanged`:**
- After every `moveend` event (map pan/zoom updates lat/lng).
- After every category change.
- After every tag toggle.

The emitted `FilterState` always contains the current map center coordinates, so the URL reflects exactly what the user is looking at.

---

## Error Handling

All invalid params are silently ignored — no error is shown to the user.

| Param | Invalid condition | Fallback |
|---|---|---|
| `category` | Not a valid `Category` value | No category filter |
| `lat` / `lng` | Non-numeric or only one present | Geolocation / default center |
| `radius` | Non-numeric or outside 1–100 | `10` |
| `tags` | Unknown tag name | Skipped individually |

---

## URL Sync Behavior

- **Page load:** Filters and map center are set from URL params before first render.
- **Map pan/zoom:** URL updates on `moveend` with new lat/lng; filters unchanged.
- **Filter change:** URL updates immediately; map center unchanged.
- **Navigating away from map:** URL is not updated (AppComponent only calls `replaceState` when `screen() === 'map'`).
- **Navigating back to map:** Filters are not re-parsed from URL on re-entry — they persist in MapComponent's in-memory state as they already do today.

---

## Out of Scope

- Radius slider UI control (radius is settable via URL but not via the map UI).
- Deep-linking to non-map screens with filters (e.g., `/?screen=submit&category=FOOD_TRUCK`).
- Persisting filter state across sessions (localStorage, cookies).
